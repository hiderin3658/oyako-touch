// 比較用・音声生成スクリプト（Gemini TTS / AI Studio）。
//
// 役割:
//   - 設問読み上げ・固定句を「Gemini TTS」で生成する。
//   - モデルごとに public/audio/_compare/<model>/ へ出力し、既存の Cloud TTS と聴き比べられる。
//   - 比較用途のほか、本番採用するモデルの音声を MP3 で生成する用途にも使える。
//
// 設計方針（本番スクリプト scripts/gen-audio.mjs に準拠）:
//   - 本番ランタイムでは使わない。比較出力（_compare/）は gitignore 済みでコミットしない。
//   - 新規 npm 依存は追加しない。Node のグローバル fetch / 標準 Buffer / --env-file を利用。
//   - 秘密情報（APIキー）はログに出さない（存在有無のみ表示）。
//
// 出力形式（MP3 / WAV）:
//   Gemini TTS は「生PCM(16bit/24kHz/モノラル)」を base64 で返すため、まず WAV ヘッダを手書きで付ける。
//   既定は MP3（本番配信向け・容量小）。WAV→MP3 変換は外部の ffmpeg を使う（npm 依存は増やさない）。
//   ffmpeg が無い場合は警告して WAV にフォールバックする。GEMINI_TTS_FORMAT=wav で WAV 固定も可。
//
// 実行方法:
//   node --env-file=.env scripts/gen-audio-gemini.mjs            生成（既定 MP3）
//   node --env-file=.env scripts/gen-audio-gemini.mjs --dry-run  生成対象の一覧表示のみ（API を呼ばない）
//   node --env-file=.env scripts/gen-audio-gemini.mjs --force    既存ファイルも再生成
//   node --env-file=.env scripts/gen-audio-gemini.mjs --limit=5  設問サンプル件数を変更（既定3／固定句は常に全件）
//   GEMINI_TTS_FORMAT=wav node --env-file=.env scripts/gen-audio-gemini.mjs  WAV で出力
//   node --env-file=.env scripts/gen-audio-gemini.mjs --prod --force  本番ナレーション(q/fb)を全件MP3で上書き
//   node --env-file=.env scripts/gen-audio-gemini.mjs --prod --dry-run 本番生成の対象一覧だけ確認

import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Gemini TTS: Gemini API（AI Studio）
//   REST: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
//   認証: APIキー（x-goog-api-key ヘッダ）。AI Studio (https://aistudio.google.com/apikey) で発行。
//   応答: candidates[0].content.parts[].inlineData.data に base64 の生PCM（mimeType に rate）。
//   特徴: 声/言語は自動判定。スタイル（やさしく/ゆっくり等）は自然言語の指示文で制御できる。
// ---------------------------------------------------------------------------
const GEMINI_ENDPOINT_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
// 既定モデル（軽量・比較に十分）。環境変数 GEMINI_TTS_MODEL で変更可。
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-preview-tts";
// 既定の声（若く明るい声。子ども向け）。環境変数 GEMINI_TTS_VOICE で変更可。
//   他候補: Kore(落ち着き) / Aoede(軽やか) / Puck(陽気) / Callirrhoe(おだやか) など30種。
const DEFAULT_GEMINI_VOICE = "Leda";
// スタイル指示（自然言語）。読み上げ本文の前に付けて口調を制御する。
//   ※この指示文自体は読み上げられず、口調にのみ反映される（Gemini TTS の仕様）。
//   空文字（GEMINI_TTS_STYLE=）にすると指示なしの素読みになる。
const DEFAULT_GEMINI_STYLE = "おさない子どもにやさしく、ゆっくり、あかるい声で";

// PCM 既定パラメータ（mimeType に rate があればそちらを優先）。
const DEFAULT_PCM_SAMPLE_RATE = 24000;
const PCM_BITS_PER_SAMPLE = 16;
const PCM_CHANNELS = 1;

// 出力形式。既定は MP3（本番配信向け）。GEMINI_TTS_FORMAT=wav で WAV 固定。
const DEFAULT_FORMAT = "mp3";
// MP3 変換の品質（libmp3lame -q:a。0=最高〜9。2 は高音質で十分小さい）。
const MP3_QUALITY = "2";

// 既定の設問サンプル件数（固定句は常に全件、設問はこの件数だけ）。
const DEFAULT_QUESTION_LIMIT = 3;

// 生成のゆらぎ対策。Gemini は生成AIのため、200応答でも音声partを返さないことが稀にある。
// 同様に 429/5xx の一時エラーも数回までやり直す（Cloud TTS にはない挙動への保険）。
const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 800;
// 429（レート制限）は短い待ちでは回復しないため、専用に長めの待機を入れる。
// ループは逐次実行なので、この待ちが後続リクエストのペース配分も兼ねる。
const RATE_LIMIT_DELAY_MS = 20000;
// 分単位(RPM)制限を踏まないための事前ペーシング。各 API 生成の前に空ける間隔（最初の1件は待たない）。
// 既定 8 秒（約7.5 RPM 相当）。GEMINI_TTS_PACING_MS で変更可（0 で無効）。
const DEFAULT_PACING_MS = 8000;

// ---------------------------------------------------------------------------
// パス設定
// ---------------------------------------------------------------------------

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");

const PROBLEMS_DIR = path.join(ROOT_DIR, "content", "problems");
const PHRASES_FILE = path.join(ROOT_DIR, "content", "audio", "phrases.json");

// 比較対象（既存 Cloud TTS の出力先）。
const CLOUD_Q_DIR = path.join(ROOT_DIR, "public", "audio", "q");
const CLOUD_FB_DIR = path.join(ROOT_DIR, "public", "audio", "fb");
// Gemini の出力先（比較用・gitignore 済み）。モデルごとにサブフォルダを分ける。
const COMPARE_DIR = path.join(ROOT_DIR, "public", "audio", "_compare");

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

/** .env の値から末尾のインラインコメント（// 以降）を除去して trim する（保険）。 */
function cleanEnv(value) {
  return value == null ? "" : String(value).replace(/\/\/.*$/, "").trim();
}

/** 指定ミリ秒だけ待つ（リトライ間の小休止）。 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * モデルIDを出力サブフォルダ用の短いラベルに変換する。
 *   gemini-2.5-flash-preview-tts → 2.5-flash
 *   gemini-3.1-flash-tts-preview → 3.1-flash
 *   gemini-2.5-pro-preview-tts   → 2.5-pro
 */
function modelToLabel(model) {
  const label = model
    .replace(/^gemini-/, "")
    .replace(/-preview-tts$|-tts-preview$|-tts$|-preview$/g, "");
  return label || model;
}

/** --limit=N を取り出す（無ければ既定値）。 */
function parseLimit(args) {
  const hit = args.find((a) => a.startsWith("--limit="));
  if (!hit) return DEFAULT_QUESTION_LIMIT;
  const n = Number(hit.slice("--limit=".length));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_QUESTION_LIMIT;
}

// ---------------------------------------------------------------------------
// 生PCM(base64) → WAV(Buffer) 変換（依存なし）
// ---------------------------------------------------------------------------

/**
 * 生PCM(16bit LE/モノラル)に 44 バイトの WAV ヘッダを付けて Buffer を返す。
 * sampleRate は mimeType から取得した値（無ければ既定 24000）。
 */
function pcmToWav(pcmBuffer, sampleRate) {
  const byteRate = (sampleRate * PCM_CHANNELS * PCM_BITS_PER_SAMPLE) / 8;
  const blockAlign = (PCM_CHANNELS * PCM_BITS_PER_SAMPLE) / 8;
  const dataSize = pcmBuffer.length;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataSize, 4); // RIFF チャンクサイズ
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // fmt チャンクサイズ
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(PCM_CHANNELS, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(PCM_BITS_PER_SAMPLE, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/** mimeType（例 "audio/L16;codec=pcm;rate=24000"）から sampleRate を取り出す。 */
function parseSampleRate(mimeType) {
  const match = /rate=(\d+)/.exec(mimeType ?? "");
  return match ? Number(match[1]) : DEFAULT_PCM_SAMPLE_RATE;
}

/** ffmpeg が PATH にあるか判定する（MP3 変換に必要）。 */
function ffmpegAvailable() {
  return new Promise((resolve) => {
    const probe = spawn("ffmpeg", ["-version"]);
    probe.on("error", () => resolve(false));
    probe.on("close", (code) => resolve(code === 0));
  });
}

/**
 * WAV(Buffer) を ffmpeg で MP3(Buffer) に変換する（標準入出力をパイプ・一時ファイル不要）。
 * 変換失敗時は stderr 要約を含む Error を投げる。
 */
function wavToMp3(wavBuffer) {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-loglevel", "error",
      "-i", "pipe:0",
      "-codec:a", "libmp3lame",
      "-q:a", MP3_QUALITY,
      "-f", "mp3",
      "pipe:1",
    ]);
    const out = [];
    const err = [];
    ff.stdout.on("data", (chunk) => out.push(chunk));
    ff.stderr.on("data", (chunk) => err.push(chunk));
    ff.on("error", (error) => reject(new Error(`ffmpeg 起動に失敗: ${error.message}`)));
    ff.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(out));
      } else {
        reject(new Error(`ffmpeg 変換に失敗 (code ${code}): ${summarizeBody(Buffer.concat(err).toString())}`));
      }
    });
    // stdin への EPIPE で全体が落ちないようガードしてから書き込む。
    ff.stdin.on("error", () => {});
    ff.stdin.write(wavBuffer);
    ff.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// 生成対象の収集（既存コンテンツを流用）
// ---------------------------------------------------------------------------

/**
 * 固定句の対象を収集する（常に全件・表現力の差が出やすい）。
 * Cloud TTS 側の対応ファイルは public/audio/fb/<key>.mp3。
 */
async function collectPhraseTargets(outDir, ext) {
  const phrases = JSON.parse(await readFile(PHRASES_FILE, "utf8"));
  return Object.entries(phrases).map(([key, value]) => ({
    label: key,
    text: value.text,
    outPath: path.join(outDir, `${key}.${ext}`),
    cloudPath: path.join(CLOUD_FB_DIR, `${key}.mp3`),
  }));
}

/**
 * 設問読み上げの対象を収集する（先頭から limit 件だけ）。
 * Cloud TTS 側の対応ファイルは public/audio/q/<id>.mp3。
 */
async function collectQuestionTargets(limit, outDir, ext) {
  const entries = await readdir(PROBLEMS_DIR);
  const jsonFiles = entries.filter((name) => name.endsWith(".json")).sort();

  const targets = [];
  for (const fileName of jsonFiles) {
    const lesson = JSON.parse(
      await readFile(path.join(PROBLEMS_DIR, fileName), "utf8"),
    );
    for (const problem of lesson.problems ?? []) {
      // audio 指定がある問題は既存音声を再利用するため生成しない（参照先が別途生成される）
      if (problem.prompt?.audio) continue;
      const text = problem.prompt?.say ?? problem.prompt?.text;
      if (!text) continue;
      targets.push({
        label: problem.id,
        text,
        outPath: path.join(outDir, `${problem.id}.${ext}`),
        cloudPath: path.join(CLOUD_Q_DIR, `${problem.id}.mp3`),
      });
      if (targets.length >= limit) return targets;
    }
  }
  return targets;
}

// ---------------------------------------------------------------------------
// API 呼び出し
// ---------------------------------------------------------------------------

/**
 * Gemini TTS を1回だけ呼んで音声(WAV Buffer)を返す。
 * 一時的に失敗しうるケースは { retryable: true } を持つ Error を投げ、呼び出し側でやり直す。
 */
async function fetchGeminiTtsOnce(spoken, { apiKey, model, voice }) {
  const endpoint = `${GEMINI_ENDPOINT_BASE}/${model}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: spoken }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    const error = new Error(`HTTP ${response.status} ${response.statusText}: ${summarizeBody(bodyText)}`);
    // 日次クォータ（per_day）枯渇は数時間回復しないため、リトライせず即時中断扱いにする。
    const isDailyQuota = response.status === 429 && /per[_ ]?day/i.test(bodyText);
    error.dailyQuota = isDailyQuota;
    // 429（レート上限）/5xx（サーバ側）は一時的とみなしてやり直す。日次枯渇と 4xx は即失敗。
    error.retryable = !isDailyQuota && (response.status === 429 || response.status >= 500);
    // 429（分単位）は回復に時間が要るため、長め待機のフラグを立てる。
    error.rateLimited = error.retryable && response.status === 429;
    throw error;
  }

  const json = await response.json();
  // 音声は inlineData を持つ part に入る（生成AIゆえ、稀に音声partを返さないことがある）。
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const audioPart = parts.find((p) => p.inlineData?.data);
  if (!audioPart) {
    const reason =
      json.promptFeedback?.blockReason ?? json.candidates?.[0]?.finishReason ?? "audioContent が見つかりません";
    const error = new Error(`Gemini 応答に音声がありません（${reason}）`);
    // 安全ブロック(blockReason)以外は生成のゆらぎとみなし、やり直す。
    error.retryable = json.promptFeedback?.blockReason == null;
    throw error;
  }

  const pcm = Buffer.from(audioPart.inlineData.data, "base64");
  const sampleRate = parseSampleRate(audioPart.inlineData.mimeType);
  return pcmToWav(pcm, sampleRate);
}

/**
 * Gemini TTS で音声(WAV Buffer)を取得する（一時失敗は MAX_ATTEMPTS 回までやり直す）。
 * style があれば本文の前に付けて口調を制御する。
 */
async function fetchGeminiTts(target, { apiKey, model, voice, style }) {
  // スタイル指示は読み上げ本文の前に付ける（指示文自体は読まれない）。
  const spoken = style ? `${style}：${target.text}` : target.text;

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchGeminiTtsOnce(spoken, { apiKey, model, voice });
    } catch (error) {
      lastError = error;
      // やり直し不可、または最終試行なら即座に投げる。
      if (!error.retryable || attempt === MAX_ATTEMPTS) throw error;
      // 429 はレート制限ウィンドウの回復を待つため長めに、それ以外は短く待つ。
      const delay = error.rateLimited ? RATE_LIMIT_DELAY_MS : RETRY_DELAY_MS;
      console.warn(`    retry ${attempt}/${MAX_ATTEMPTS - 1}  (${Math.round(delay / 1000)}s待機: ${error.message})`);
      await sleep(delay);
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isForce = args.includes("--force");
  // --prod: 比較用ではなく本番ナレーション（public/audio/q・fb）を生成・上書きする。
  //   全件対象＋出力先を本番ディレクトリにし、MP3 を必須にする。
  const isProd = args.includes("--prod");
  // 本番は全件。比較モードは --limit（既定3）。
  const questionLimit = isProd ? Number.MAX_SAFE_INTEGER : parseLimit(args);

  const apiKey = cleanEnv(process.env.GEMINI_API_KEY);
  const model = cleanEnv(process.env.GEMINI_TTS_MODEL) || DEFAULT_GEMINI_MODEL;
  const voice = cleanEnv(process.env.GEMINI_TTS_VOICE) || DEFAULT_GEMINI_VOICE;
  // スタイルは未設定なら既定、明示的に空文字なら「素読み」にする。
  const style =
    process.env.GEMINI_TTS_STYLE != null
      ? cleanEnv(process.env.GEMINI_TTS_STYLE)
      : DEFAULT_GEMINI_STYLE;
  // リクエスト間ペーシング（ms）。未設定なら既定値。
  const pacingMs =
    process.env.GEMINI_TTS_PACING_MS != null
      ? Math.max(0, Number(cleanEnv(process.env.GEMINI_TTS_PACING_MS)) || 0)
      : DEFAULT_PACING_MS;

  // APIキー検証（dry-run では不要）。
  if (!isDryRun && !apiKey) {
    console.error("エラー: 環境変数 GEMINI_API_KEY が未設定です（Gemini TTS に必須）。");
    console.error("       AI Studio (https://aistudio.google.com/apikey) でキーを発行し .env に設定してください。");
    console.error("       生成対象の確認だけなら --dry-run を付けて実行できます。");
    process.exit(1);
  }

  // 出力形式を決める（既定 MP3）。MP3 は ffmpeg が要る。
  let format = (cleanEnv(process.env.GEMINI_TTS_FORMAT) || DEFAULT_FORMAT).toLowerCase();
  if (format !== "mp3" && format !== "wav") {
    console.warn(`警告: GEMINI_TTS_FORMAT="${format}" は不正です。mp3 として扱います。`);
    format = "mp3";
  }
  if (isProd) {
    // 本番は MP3 固定。WAV を .mp3 パスへ書くと中身と拡張子が不一致になるため許さない。
    format = "mp3";
  }
  if (!isDryRun && format === "mp3" && !(await ffmpegAvailable())) {
    if (isProd) {
      console.error("エラー: --prod は MP3 が必須ですが ffmpeg が見つかりません（macOS: brew install ffmpeg）。");
      process.exit(1);
    }
    console.warn("警告: ffmpeg が見つからないため MP3 変換できません。WAV で出力します。");
    console.warn("       MP3 にするには ffmpeg を入れてください（macOS: brew install ffmpeg）。");
    format = "wav";
  }
  const ext = format;

  // 出力先。比較モードはモデル別フォルダ、本番モード(--prod)は本番ディレクトリ(q/fb)を直接上書き。
  const outDir = path.join(COMPARE_DIR, modelToLabel(model));

  if (!isDryRun) {
    await mkdir(isProd ? CLOUD_Q_DIR : outDir, { recursive: true });
    await mkdir(isProd ? CLOUD_FB_DIR : outDir, { recursive: true });
  }

  const sections = [
    { title: "固定句", targets: await collectPhraseTargets(outDir, ext) },
    {
      title: isProd ? "設問読み上げ（全件）" : `設問読み上げ（先頭${questionLimit}件）`,
      targets: await collectQuestionTargets(questionLimit, outDir, ext),
    },
  ];

  // 本番モードは出力先を本番ファイル（= cloudPath）に切り替える。
  if (isProd) {
    for (const section of sections) {
      for (const target of section.targets) {
        target.outPath = target.cloudPath;
      }
    }
  }

  console.log("=== Gemini TTS 生成スクリプト ===");
  console.log(
    `モード: ${isDryRun ? "dry-run（API 非呼び出し）" : "本番生成"}${isProd ? " / prod（本番ナレーション上書き）" : ""}${isForce ? " / force（再生成）" : ""}`,
  );
  console.log(`モデル: ${model} / 声: ${voice} / 形式: ${format.toUpperCase()}（APIキー ${apiKey ? "設定済み" : "未設定"}）`);
  console.log(`スタイル指示: ${style ? `「${style}」` : "なし（素読み）"}`);
  console.log(
    isProd
      ? "出力先: public/audio/q/ ・ public/audio/fb/  ← 本番ナレーションを上書き"
      : `出力先: ${toRelative(outDir)}/  ← Cloud TTS と聴き比べ`,
  );
  console.log("");

  let generatedCount = 0;
  let skippedCount = 0;
  let plannedCount = 0;
  let failedCount = 0;
  // 日次クォータ枯渇を検知したら以降は全て失敗するため、全体を打ち切る。
  let abortedByDailyQuota = false;
  // 実際に API を呼んだ回数。2件目以降の前にペーシングを入れて RPM 制限を避ける。
  let apiCallCount = 0;

  for (const section of sections) {
    if (abortedByDailyQuota) break;
    console.log(`▼ ${section.title}  [${section.targets.length}件]`);
    for (const target of section.targets) {
      const rel = toRelative(target.outPath);
      const cloudRel = toRelative(target.cloudPath);

      // 差分生成: 既存かつ --force でなければスキップ。
      if (!isForce && (await fileExists(target.outPath))) {
        console.log(`  skip      ${rel}  (既存)`);
        skippedCount += 1;
        continue;
      }

      if (isDryRun) {
        const note = isProd ? "" : `  (比較: ${cloudRel})`;
        console.log(`  生成予定  ${rel}  ← "${target.text}"${note}`);
        plannedCount += 1;
        continue;
      }

      // 直前の生成から一定間隔を空ける（最初の1件は待たない）。
      if (pacingMs > 0 && apiCallCount > 0) {
        await sleep(pacingMs);
      }
      apiCallCount += 1;

      try {
        const wav = await fetchGeminiTts(target, { apiKey, model, voice, style });
        // 既定は MP3。ffmpeg で WAV→MP3 に変換してから書き出す（WAV 指定時はそのまま）。
        const audio = format === "mp3" ? await wavToMp3(wav) : wav;
        await writeFile(target.outPath, audio);
        // 比較モードのみ Cloud TTS 側との対応を表示（本番モードは出力先＝本番ファイル）。
        const note = isProd
          ? ""
          : (await fileExists(target.cloudPath))
            ? `  （比較: ${cloudRel}）`
            : `  （比較先 ${cloudRel} は未生成）`;
        console.log(`  生成      ${rel}${note}`);
        generatedCount += 1;
      } catch (error) {
        // 1件の失敗で全体を止めず、他は続行する。
        console.error(`  失敗      ${rel}  (${error.message})`);
        failedCount += 1;
        // 日次クォータ枯渇は当日中は回復しないため、残りを試さず打ち切る。
        if (error.dailyQuota) {
          console.error("  ⚠️ 日次クォータ(per_day)枯渇を検知しました。残りの生成を打ち切ります（クォータは太平洋時間の深夜にリセット）。");
          abortedByDailyQuota = true;
          break;
        }
      }
    }
    console.log("");
  }

  console.log("=== サマリ ===");
  if (isDryRun) {
    console.log(`生成予定: ${plannedCount}件 / skip: ${skippedCount}件`);
  } else {
    console.log(`生成: ${generatedCount}件 / skip: ${skippedCount}件 / 失敗: ${failedCount}件`);
    if (generatedCount > 0 && isProd) {
      console.log("");
      console.log("▼ 本番ナレーションを更新しました（public/audio/q ・ fb）。");
      console.log("  ※ 失敗が残っていれば --prod を再実行すると未生成分だけ補完されます。");
    } else if (generatedCount > 0) {
      console.log("");
      console.log("▼ 聴き比べ方");
      console.log(`  Gemini : ${toRelative(outDir)}/<id>.${ext}`);
      console.log(`  Cloud  : public/audio/q/<id>.mp3 ・ public/audio/fb/<key>.mp3`);
      console.log(`  ※ Finder で .${ext} を選んでスペースキー（QuickLook）で再生、または npm run dev でブラウザ再生。`);
    }
  }

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("予期せぬエラーで中断しました。", error);
  process.exit(1);
});
