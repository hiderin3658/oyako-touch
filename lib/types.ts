// 問題ドメインの型定義（DOM非依存の純粋な型）

/** 問題カテゴリ。「いろあわせ」「かたちはめ」「すうじ」「どうぶつ」の4種目 */
export type Category = "color" | "shape" | "number" | "animal";

/** 設問文と読み上げテキスト。audio は将来のElevenLabs音声用（今回未使用） */
export interface PromptData {
  text: string;
  say: string;
  audio?: string;
}

/** 選択肢の共通プロパティ。label は読み上げ／aria 用のラベル */
interface ChoiceBase {
  id: string;
  correct: boolean;
  label: string;
}

/** いろあわせの選択肢（色つきの円） */
export interface ColorChoice extends ChoiceBase {
  color: string;
}

/** 図形種別。まる・しかく・さんかく・ほし・ハート（レンダラと共有する単一情報源） */
export type ShapeKind =
  | "circle"
  | "square"
  | "triangle"
  | "star"
  | "heart";

/** かたちはめの選択肢（図形＋塗り色） */
export interface ShapeChoice extends ChoiceBase {
  shape: ShapeKind;
  color: string;
}

/** すうじの選択肢（数字グリフ）。value は 1〜10、label は読み（「さん」等） */
export interface NumberChoice extends ChoiceBase {
  value: number;
}

/** どうぶつの選択肢（動物イラスト）。image は public 配下の画像パス */
export interface AnimalChoice extends ChoiceBase {
  image: string;
}

/** 選択肢のユニオン */
export type Choice = ColorChoice | ShapeChoice | NumberChoice | AnimalChoice;

/** 1問の定義。category により choices の型が決まる判別ユニオン */
export type Problem =
  | {
      id: string;
      category: "color";
      type: "select-one";
      prompt: PromptData;
      choices: ColorChoice[];
      reward?: string;
    }
  | {
      id: string;
      category: "shape";
      type: "select-one";
      prompt: PromptData;
      choices: ShapeChoice[];
      reward?: string;
    }
  | {
      id: string;
      category: "number";
      type: "select-number";
      prompt: PromptData;
      choices: NumberChoice[];
      reward?: string;
    }
  | {
      id: string;
      category: "animal";
      type: "select-one";
      prompt: PromptData;
      choices: AnimalChoice[];
      reward?: string;
    };

/** 1カテゴリ分のレッスン（問題セット） */
export interface Lesson {
  category: Category;
  title: string;
  problems: Problem[];
}
