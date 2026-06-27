// 音声一括生成スクリプト（ビルド前に実行するオフライン工程）。
//
// 役割:
//   - 設問読み上げ・固定句のナレーションを Google Cloud Text-to-Speech で MP3 生成
//   - 正解効果音を ElevenLabs Sound Effects で MP3 生成（任意・既存があればスキップ）
//   - 生成済みファイルはスキップする差分生成（--force で再生成）
//
// 設計方針（設計書 §8/§12 準拠）:
//   - 本番ランタイムでは使わない。生成済み MP3 は public/ にコミットし CDN 配信する。
//   - 新規 npm 依存は追加しない。Node 22 のグローバル fetch / 標準 crypto / --env-file を利用。
//   - 秘密情報（鍵・トークン）はログに出さない（存在有無のみ表示）。
//
// 実行方法:
//   node --env-file=.env scripts/gen-audio.mjs            本番生成
//   node --env-file=.env scripts/gen-audio.mjs --dry-run  生成対象の一覧表示のみ（API を呼ばない）
//   node --env-file=.env scripts/gen-audio.mjs --force     既存ファイルも再生成

import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// ナレーション (TTS): Google Cloud Text-to-Speech
//   REST: POST https://texttospeech.googleapis.com/v1/text:synthesize
//   ※この API は API キー認証を受け付けず、OAuth2（サービスアカウント）が必須。
//     環境変数 GOOGLE_APPLICATION_CREDENTIALS にサービスアカウント JSON のパスを指定する。
//     スクリプトが JWT を署名してアクセストークンを取得し、Bearer 認証で呼ぶ（新規依存なし）。
//   声/言語/速度は環境変数で可変。従来声(Neural2)は生成のゆらぎが少なく安定。
// ---------------------------------------------------------------------------
const GOOGLE_TTS_ENDPOINT =
  "https://texttospeech.googleapis.com/v1/text:synthesize";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_TTS_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
// 既定の声（日本語・女性・自然で安定）。環境変数 GOOGLE_TTS_VOICE で変更可。
const DEFAULT_GOOGLE_VOICE = "ja-JP-Neural2-B";
const DEFAULT_GOOGLE_LANGUAGE_CODE = "ja-JP";
// 3歳児向けにゆっくりめ（0.25〜4.0、1.0が標準）。環境変数 GOOGLE_TTS_SPEAKING_RATE で変更可。
const DEFAULT_GOOGLE_SPEAKING_RATE = 0.9;

// ---------------------------------------------------------------------------
// 効果音 (SFX): ElevenLabs Sound Effects（任意）
//   ※Google TTS は効果音を生成できないため、効果音のみ ElevenLabs を使う。
//   ELEVENLABS_API_KEY が無い／既存ファイルがある場合はスキップする。
// ---------------------------------------------------------------------------
const SFX_ENDPOINT = "https://api.elevenlabs.io/v1/sound-generation";
const SFX_PROMPT_INFLUENCE = 0.3;

// ---------------------------------------------------------------------------
// パス設定
// ---------------------------------------------------------------------------

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");

const PROBLEMS_DIR = path.join(ROOT_DIR, "content", "problems");
const PHRASES_FILE = path.join(ROOT_DIR, "content", "audio", "phrases.json");
const SFX_FILE = path.join(ROOT_DIR, "content", "audio", "sfx.json");

const OUT_Q_DIR = path.join(ROOT_DIR, "public", "audio", "q");
const OUT_FB_DIR = path.join(ROOT_DIR, "public", "audio", "fb");
const OUT_SFX_DIR = path.join(ROOT_DIR, "public", "audio", "sfx");

// ---------------------------------------------------------------------------
// 小さなユーティリティ
// ---------------------------------------------------------------------------

/** ファイルが存在するか判定する。 */
async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/** ROOT からの相対パス（ログ表示用）。 */
function toRelative(filePath) {
  return path.relative(ROOT_DIR, filePath);
}

/** レスポンス本文を要約する（長すぎる場合は切り詰める）。秘密情報は元々含まれない想定。 */
function summarizeBody(bodyText) {
  const oneLine = bodyText.replace(/\s+/g, " ").trim();
  const MAX = 300;
  return oneLine.length > MAX ? `${oneLine.slice(0, MAX)}…` : oneLine;
}

/**
 * .env の値から末尾のインラインコメント（// 以降）を除去して trim する。
 * ※.env は本来 // コメントを解釈しないため、誤って書かれても拾えるようにする保険。
 */
function cleanEnv(value) {
  return value == null ? "" : String(value).replace(/\/\/.*$/, "").trim();
}

// ---------------------------------------------------------------------------
// Google サービスアカウント認証（OAuth2 / JWT）
// ---------------------------------------------------------------------------

/**
 * サービスアカウント JSON を読み込んで検証する。
 * client_email と private_key を含む必要がある。
 */
async function readServiceAccount(credsPath) {
  const absPath = path.isAbsolute(credsPath)
    ? credsPath
    : path.resolve(process.cwd(), credsPath);
  let json;
  try {
    json = JSON.parse(await readFile(absPath, "utf8"));
  } catch (error) {
    throw new Error(`サービスアカウント JSON を読めません（${absPath}）: ${error.message}`);
  }
  if (!json.client_email || !json.private_key) {
    throw new Error("サービスアカウント JSON に client_email / private_key がありません。");
  }
  return json;
}

/**
 * サービスアカウントで署名した JWT を OAuth2 トークンエンドポイントに渡し、
 * アクセストークン（Bearer）を取得する。標準 crypto のみ使用（新規依存なし）。
 */
async function getGoogleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = serviceAccount.token_uri || GOOGLE_TOKEN_ENDPOINT;

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: GOOGLE_TTS_SCOPE,
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");

  const signingInput = `${header}.${claims}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(serviceAccount.private_key).toString("base64url");
  const assertion = `${signingInput}.${signature}`;

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(`アクセストークン取得に失敗: HTTP ${response.status} ${summarizeBody(bodyText)}`);
  }
  const json = await response.json();
  if (!json.access_token) {
    throw new Error("トークンレスポンスに access_token がありません。");
  }
  return json.access_token;
}

// ---------------------------------------------------------------------------
// 生成対象の収集
// ---------------------------------------------------------------------------

/**
 * 設問読み上げの対象を収集する。
 * content/problems/*.json の各 problem の id と prompt.say を使う。
 */
async function collectQuestionTargets() {
  const entries = await readdir(PROBLEMS_DIR);
  const jsonFiles = entries.filter((name) => name.endsWith(".json")).sort();

  const targets = [];
  for (const fileName of jsonFiles) {
    const raw = await readFile(path.join(PROBLEMS_DIR, fileName), "utf8");
    const lesson = JSON.parse(raw);
    for (const problem of lesson.problems ?? []) {
      // prompt.say があれば優先、無ければ prompt.text にフォールバック
      const text = problem.prompt?.say ?? problem.prompt?.text;
      if (!text) {
        console.warn(`警告: ${fileName} の ${problem.id} に読み上げ文言がありません。スキップします。`);
        continue;
      }
      targets.push({
        kind: "tts",
        label: problem.id,
        text,
        outPath: path.join(OUT_Q_DIR, `${problem.id}.mp3`),
      });
    }
  }
  return targets;
}

/**
 * 固定句の対象を収集する。
 * content/audio/phrases.json の各キーの text を使う。
 */
async function collectPhraseTargets() {
  const raw = await readFile(PHRASES_FILE, "utf8");
  const phrases = JSON.parse(raw);

  const targets = [];
  for (const [key, value] of Object.entries(phrases)) {
    targets.push({
      kind: "tts",
      label: key,
      text: value.text,
      outPath: path.join(OUT_FB_DIR, `${key}.mp3`),
    });
  }
  return targets;
}

/**
 * 効果音の対象を収集する。
 * content/audio/sfx.json の各キーの prompt と duration_seconds を使う。
 */
async function collectSfxTargets() {
  const raw = await readFile(SFX_FILE, "utf8");
  const sfx = JSON.parse(raw);

  const targets = [];
  for (const [key, value] of Object.entries(sfx)) {
    targets.push({
      kind: "sfx",
      label: key,
      text: value.prompt,
      durationSeconds: value.duration_seconds,
      outPath: path.join(OUT_SFX_DIR, `${key}.mp3`),
    });
  }
  return targets;
}

// ---------------------------------------------------------------------------
// API 呼び出し
// ---------------------------------------------------------------------------

/**
 * Google Cloud TTS で音声バイナリ（MP3）を取得する。
 * アクセストークンで Bearer 認証する。HTTP エラー時は Error を投げる。
 */
async function fetchTts(target, { accessToken, voice, languageCode, speakingRate }) {
  const response = await fetch(GOOGLE_TTS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: { text: target.text },
      voice: { languageCode, name: voice },
      audioConfig: { audioEncoding: "MP3", speakingRate },
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${summarizeBody(bodyText)}`);
  }
  const json = await response.json();
  if (!json.audioContent) {
    throw new Error("Google TTS のレスポンスに audioContent がありません。");
  }
  // audioContent は base64 エンコードされた MP3
  return Buffer.from(json.audioContent, "base64");
}

/**
 * ElevenLabs で効果音バイナリを取得する。
 * HTTP エラー時はステータスと本文要約を含む Error を投げる。
 */
async function fetchSfx(target, { apiKey }) {
  const response = await fetch(SFX_ENDPOINT, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: target.text,
      duration_seconds: target.durationSeconds,
      prompt_influence: SFX_PROMPT_INFLUENCE,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${summarizeBody(bodyText)}`);
  }
  return response.arrayBuffer();
}

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isForce = args.includes("--force");

  // ナレーション(TTS) = Google Cloud TTS（サービスアカウント認証）
  // 値は cleanEnv で末尾の // コメント・余分な空白を除去してから使う。
  const credsPath = cleanEnv(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const googleVoice = cleanEnv(process.env.GOOGLE_TTS_VOICE) || DEFAULT_GOOGLE_VOICE;
  const googleLanguageCode =
    cleanEnv(process.env.GOOGLE_TTS_LANGUAGE_CODE) || DEFAULT_GOOGLE_LANGUAGE_CODE;
  const googleSpeakingRate =
    Number(cleanEnv(process.env.GOOGLE_TTS_SPEAKING_RATE)) || DEFAULT_GOOGLE_SPEAKING_RATE;
  // 効果音(SFX) = ElevenLabs（任意）
  const elevenApiKey = process.env.ELEVENLABS_API_KEY;

  // 認証情報の検証＆アクセストークン取得（dry-run では不要）。
  let googleAccessToken = null;
  if (!isDryRun) {
    if (!credsPath) {
      console.error("エラー: 環境変数 GOOGLE_APPLICATION_CREDENTIALS が未設定です（ナレーション生成に必須）。");
      console.error("       Google Cloud でサービスアカウントを作成→JSON 鍵をダウンロードし、そのパスを .env に設定してください。");
      console.error("       生成対象の確認だけなら --dry-run を付けて実行できます。");
      process.exit(1);
    }
    try {
      const serviceAccount = await readServiceAccount(credsPath);
      googleAccessToken = await getGoogleAccessToken(serviceAccount);
    } catch (error) {
      console.error(`エラー: Google 認証に失敗しました。${error.message}`);
      process.exit(1);
    }
  }

  // 出力先ディレクトリを用意（dry-run では作らない）。
  if (!isDryRun) {
    await mkdir(OUT_Q_DIR, { recursive: true });
    await mkdir(OUT_FB_DIR, { recursive: true });
    await mkdir(OUT_SFX_DIR, { recursive: true });
  }

  // 生成対象をセクションごとに収集。
  const sections = [
    { title: "設問読み上げ (public/audio/q/)", targets: await collectQuestionTargets() },
    { title: "固定句 (public/audio/fb/)", targets: await collectPhraseTargets() },
    { title: "効果音 (public/audio/sfx/)", targets: await collectSfxTargets() },
  ];

  console.log("=== 音声生成スクリプト ===");
  console.log(`モード: ${isDryRun ? "dry-run（API 非呼び出し）" : "本番生成"}${isForce ? " / force（再生成）" : ""}`);
  console.log(
    `TTS : Google [${googleVoice} / ${googleLanguageCode} / rate ${googleSpeakingRate}]（認証 ${credsPath ? "設定済み" : "未設定"}）`,
  );
  console.log(`SFX : ElevenLabs（key ${elevenApiKey ? "設定済み" : "未設定"}）`);
  console.log("");

  let generatedCount = 0;
  let skippedCount = 0;
  let plannedCount = 0;
  let failedCount = 0;

  for (const section of sections) {
    console.log(`▼ ${section.title}  [${section.targets.length}件]`);
    for (const target of section.targets) {
      const rel = toRelative(target.outPath);
      const detail = target.kind === "sfx"
        ? `prompt="${target.text}" (${target.durationSeconds}s)`
        : `"${target.text}"`;

      // 差分生成: 既存かつ --force でなければスキップ。
      if (!isForce && (await fileExists(target.outPath))) {
        console.log(`  skip      ${rel}  (既存)`);
        skippedCount += 1;
        continue;
      }

      if (isDryRun) {
        console.log(`  生成予定  ${rel}  ← ${detail}`);
        plannedCount += 1;
        continue;
      }

      // 効果音は ElevenLabs キーが無ければスキップ（TTS は止めない）。
      if (target.kind === "sfx" && !elevenApiKey) {
        console.warn(`  skip      ${rel}  (効果音用 ELEVENLABS_API_KEY 未設定のためスキップ)`);
        skippedCount += 1;
        continue;
      }

      // 実生成。
      try {
        const audio = target.kind === "sfx"
          ? await fetchSfx(target, { apiKey: elevenApiKey })
          : await fetchTts(target, {
              accessToken: googleAccessToken,
              voice: googleVoice,
              languageCode: googleLanguageCode,
              speakingRate: googleSpeakingRate,
            });
        await writeFile(target.outPath, Buffer.from(audio));
        console.log(`  生成      ${rel}`);
        generatedCount += 1;
      } catch (error) {
        // 1件の失敗で全体を止めず、他は続行する。
        console.error(`  失敗      ${rel}  (${error.message})`);
        failedCount += 1;
      }
    }
    console.log("");
  }

  // サマリ。
  console.log("=== サマリ ===");
  if (isDryRun) {
    console.log(`生成予定: ${plannedCount}件 / skip: ${skippedCount}件`);
  } else {
    console.log(`生成: ${generatedCount}件 / skip: ${skippedCount}件 / 失敗: ${failedCount}件`);
  }

  // 失敗があれば異常終了で通知する（dry-run では失敗カウントは増えない）。
  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  // 予期せぬ例外はスタックトレースを残して異常終了する。
  console.error("予期せぬエラーで中断しました。", error);
  process.exit(1);
});
