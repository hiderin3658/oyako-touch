// 音声一括生成スクリプト（ビルド前に実行するオフライン工程）。
//
// 役割:
//   - 設問読み上げ・固定句のナレーションを ElevenLabs TTS で MP3 生成
//   - 正解効果音を ElevenLabs Sound Effects で MP3 生成
//   - 生成済みファイルはスキップする差分生成（--force で再生成）
//
// 設計方針（設計書 §8/§12 準拠）:
//   - 本番ランタイムでは使わない。生成済み MP3 は public/ にコミットし CDN 配信する。
//   - 新規 npm 依存は追加しない。Node 22 のグローバル fetch と --env-file を利用する。
//   - API キーはログに出さない（存在有無のみ表示）。
//
// 実行方法:
//   node --env-file=.env scripts/gen-audio.mjs            本番生成
//   node --env-file=.env scripts/gen-audio.mjs --dry-run  生成対象の一覧表示のみ（API を呼ばない）
//   node --env-file=.env scripts/gen-audio.mjs --force     既存ファイルも再生成

import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// ElevenLabs API 設定
// ※エンドポイント/パラメータに不確実な点があるため、後から実行時に調整できるよう定数化している。
//   voice_id 確定後・初回実行時に公式ドキュメントで最終確認すること。
// ---------------------------------------------------------------------------

// TTS（Text to Speech）エンドポイント。末尾に voice_id を連結して使う。
// 参考: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
const TTS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";

// Sound Effects（効果音）エンドポイント。
// 参考: POST https://api.elevenlabs.io/v1/sound-generation
// ※将来 /v1/sound-effects 等に変わる可能性があるため定数化。実行時に要確認。
const SFX_ENDPOINT = "https://api.elevenlabs.io/v1/sound-generation";

// TTS モデル。日本語プロソディが自然な multilingual v2 を使用（設計書 §8.2）。
const TTS_MODEL_ID = "eleven_multilingual_v2";

// TTS の声質設定（設計書 §8.2 の目安: Stability 0.5 / Similarity 0.75 / Style 0 / Speed≈0.9）。
const TTS_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
  speed: 0.9,
};

// 効果音生成のプロンプト忠実度（0〜1。低いほど自然さ優先）。
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
 * TTS で音声バイナリを取得する。
 * HTTP エラー時はステータスと本文要約を含む Error を投げる。
 */
async function fetchTts(target, { apiKey, voiceId }) {
  const url = `${TTS_ENDPOINT}/${voiceId}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: target.text,
      model_id: TTS_MODEL_ID,
      voice_settings: TTS_VOICE_SETTINGS,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${summarizeBody(bodyText)}`);
  }
  return response.arrayBuffer();
}

/**
 * 効果音で音声バイナリを取得する。
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

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  // 環境変数の検証（dry-run 時はキー無しでも動く）。
  if (!isDryRun) {
    if (!apiKey) {
      console.error("エラー: 環境変数 ELEVENLABS_API_KEY が未設定です。.env に設定してください。");
      console.error("       生成対象の確認だけなら --dry-run を付けて実行できます。");
      process.exit(1);
    }
    if (!voiceId) {
      console.error("エラー: 環境変数 ELEVENLABS_VOICE_ID が未設定です（TTS に必須）。");
      console.error("       ElevenLabs で本番文言を試聴してボイスを確定し、.env に設定してください。");
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
  console.log(`ELEVENLABS_API_KEY: ${apiKey ? "設定済み" : "未設定"} / ELEVENLABS_VOICE_ID: ${voiceId ? "設定済み" : "未設定"}`);
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

      // 実生成。
      try {
        const audio = target.kind === "sfx"
          ? await fetchSfx(target, { apiKey })
          : await fetchTts(target, { apiKey, voiceId });
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
