// 出題音声の再利用（prompt.audio によるオプトイン共有）の整合性テスト。
// content/problems/*.json と public/audio/q/*.mp3 を実際に走査し、
// 参照先の存在・読みの一致・孤立ファイルの不在を検証する。
// 設計: docs/audio-dedup/実装計画.md ／ テスト仕様書.md（T-01〜T-05）

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Problem } from "@/lib/types";

// このテストファイル（lib/__tests__）からリポジトリルートを求める。
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROBLEMS_DIR = join(ROOT, "content/problems");
const Q_DIR = join(ROOT, "public/audio/q");

// 全カテゴリの問題を1配列に読み込む。
function loadAllProblems(): Problem[] {
  const files = readdirSync(PROBLEMS_DIR).filter((f) => f.endsWith(".json"));
  const all: Problem[] = [];
  for (const file of files) {
    const data = JSON.parse(readFileSync(join(PROBLEMS_DIR, file), "utf8"));
    for (const problem of data.problems as Problem[]) {
      all.push(problem);
    }
  }
  return all;
}

const allProblems = loadAllProblems();
const problemById = new Map(allProblems.map((p) => [p.id, p]));
// audio 未指定の問題 = 音声を生成する「参照先」候補。
const generatorIds = new Set(
  allProblems.filter((p) => !p.prompt.audio).map((p) => p.id),
);
// audio 指定あり = 既存音声を再利用する側。
const reusedProblems = allProblems.filter((p) => p.prompt.audio);

describe("出題音声の再利用（audio）整合", () => {
  it("再利用側が1件以上あり、全問が生成側/再利用側のいずれか", () => {
    expect(reusedProblems.length).toBeGreaterThan(0);
    expect(generatorIds.size + reusedProblems.length).toBe(allProblems.length);
  });

  it("audio 参照先は実在し、同カテゴリの生成対象である（T-01）", () => {
    for (const problem of reusedProblems) {
      const ref = problemById.get(problem.prompt.audio as string);
      expect(ref, `${problem.id} の参照先 ${problem.prompt.audio} が存在しない`).toBeDefined();
      expect(
        generatorIds.has(problem.prompt.audio as string),
        `${problem.id} -> ${problem.prompt.audio} は生成対象(audio未指定)でない`,
      ).toBe(true);
      expect(ref!.category, `${problem.id} と参照先のカテゴリが不一致`).toBe(
        problem.category,
      );
    }
  });

  it("audio は自己参照でない（T-04）", () => {
    for (const problem of reusedProblems) {
      expect(problem.prompt.audio, `${problem.id} が自己参照`).not.toBe(problem.id);
    }
  });

  it("再利用側の読み(say)は参照先と一致する（誤読防止）", () => {
    for (const problem of reusedProblems) {
      const ref = problemById.get(problem.prompt.audio as string)!;
      const mySay = problem.prompt.say ?? problem.prompt.text;
      const refSay = ref.prompt.say ?? ref.prompt.text;
      expect(
        mySay,
        `${problem.id} の読みが参照先 ${problem.prompt.audio} と不一致`,
      ).toBe(refSay);
    }
  });

  it("全ての生成対象に対応する MP3 が存在する（T-02）", () => {
    for (const id of generatorIds) {
      expect(existsSync(join(Q_DIR, `${id}.mp3`)), `${id}.mp3 が存在しない`).toBe(
        true,
      );
    }
  });

  it("public/audio/q に孤立した（参照されない）MP3 が無い（T-03）", () => {
    const files = readdirSync(Q_DIR).filter((f) => f.endsWith(".mp3"));
    for (const file of files) {
      const stem = file.replace(/\.mp3$/, "");
      expect(
        generatorIds.has(stem),
        `${file} は生成対象でない孤立ファイル（削除漏れ）`,
      ).toBe(true);
    }
  });

  it("MP3 数 = 生成対象数（重複が解消されている）（T-05）", () => {
    const mp3Count = readdirSync(Q_DIR).filter((f) => f.endsWith(".mp3")).length;
    expect(mp3Count).toBe(generatorIds.size);
  });
});
