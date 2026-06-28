import type { Category, Choice } from "@/lib/types";
import { ColorChoice } from "./ColorChoice";
import { ShapeChoice } from "./ShapeChoice";
import { NumberChoice } from "./NumberChoice";

/** 選択肢を描画するレンダラの共通シグネチャ（種目に依存しない） */
export type ChoiceRenderer = (props: {
  choice: Choice;
  state: "idle" | "right" | "wrong";
  onSelect: () => void;
}) => JSX.Element;

/** カテゴリごとの選択肢レンダラ */
export const choiceRenderers: Record<Category, ChoiceRenderer> = {
  color: ColorChoice,
  shape: ShapeChoice,
  number: NumberChoice,
};

export { ColorChoice, ShapeChoice, NumberChoice };
