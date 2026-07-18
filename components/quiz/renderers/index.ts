import type { Category, Choice, Problem } from "@/lib/types";
import { ColorChoice } from "./ColorChoice";
import { ShapeChoice } from "./ShapeChoice";
import { NumberChoice } from "./NumberChoice";
import { AnimalChoice } from "./AnimalChoice";
import { SizeChoice } from "./SizeChoice";
import { CountChoice } from "./CountChoice";
import { ShapeFitBoard } from "./ShapeFitBoard";

/** タップ3択で描画するカテゴリ（盤面描画の katahame を除く）。 */
export type TapCategory = Exclude<Category, "katahame">;

/** 選択肢を描画するレンダラの共通シグネチャ（種目に依存しない） */
export type ChoiceRenderer = (props: {
  choice: Choice;
  state: "idle" | "right" | "wrong";
  onSelect: () => void;
}) => JSX.Element;

/**
 * タップ系カテゴリごとの選択肢レンダラ。
 * Record<TapCategory> にすることで、Category を拡張してもタップ種目の網羅性を型で保つ。
 */
export const choiceRenderers: Record<TapCategory, ChoiceRenderer> = {
  color: ColorChoice,
  shape: ShapeChoice,
  number: NumberChoice,
  animal: AnimalChoice,
  size: SizeChoice,
  count: CountChoice,
};

/** 盤面（穴＋複数ピース）をまとめて描画するレンダラのシグネチャ。 */
export type BoardRenderer = (props: {
  problem: Problem;
  locked: boolean;
  onPlace: (choiceId: string, correct: boolean) => void;
}) => JSX.Element;

/** 盤面描画が必要なカテゴリのレンダラ（登録が無いカテゴリは従来の per-choice 描画）。 */
export const boardRenderers: Partial<Record<Category, BoardRenderer>> = {
  katahame: ShapeFitBoard,
};

/** タップ系カテゴリ（盤面描画でない）かを判定する型ガード。 */
export function isTapCategory(category: Category): category is TapCategory {
  return category !== "katahame";
}

export {
  ColorChoice,
  ShapeChoice,
  NumberChoice,
  AnimalChoice,
  SizeChoice,
  CountChoice,
  ShapeFitBoard,
};
