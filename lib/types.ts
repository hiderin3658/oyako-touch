// 問題ドメインの型定義（DOM非依存の純粋な型）

/** 問題カテゴリ。MVPは「いろあわせ」「かたちはめ」の2種目 */
export type Category = "color" | "shape";

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

/** かたちはめの選択肢（図形＋塗り色） */
export interface ShapeChoice extends ChoiceBase {
  shape: "circle" | "square" | "triangle";
  color: string;
}

/** 選択肢のユニオン */
export type Choice = ColorChoice | ShapeChoice;

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
    };

/** 1カテゴリ分のレッスン（問題セット） */
export interface Lesson {
  category: Category;
  title: string;
  problems: Problem[];
}
