"use client";

import { useRef, useState } from "react";
import type { Problem, ShapeKind } from "@/lib/types";
import { ShapeFigure } from "./ShapeChoice";
import { evaluateDrop, type Point } from "./shapeFit";
import styles from "./ShapeFitBoard.module.css";

interface ShapeFitBoardProps {
  problem: Problem;
  locked: boolean;
  onPlace: (choiceId: string, correct: boolean) => void;
}

// タップ判定のしきい値（px）。総移動量がこれ未満なら「タップ設置」として穴中心で判定する。
const TAP_THRESHOLD = 8;
// スナップ半径は穴半径のこの倍率（実機で微調整前提）。
const SNAP_RATIO = 1.3;

/** ドラッグ中の一時状態（再描画を挟まない値はここに持つ）。 */
interface DragState {
  pieceId: string;
  pointerId: number;
  startX: number;
  startY: number;
  /** 掴んだ瞬間のピース中心（矩形取得不可なら null＝タップ設置扱い）。 */
  startCenter: Point | null;
  /** これまでの最大移動量（タップかドラッグかの判定に使う）。 */
  moved: number;
}

/** 穴・ピース要素の中心座標と半径を返す。矩形取得不可なら null（SSR/jsdom 安全）。 */
function measure(el: Element | null): { center: Point; radius: number } | null {
  if (!el || typeof el.getBoundingClientRect !== "function") {
    return null;
  }
  try {
    const rect = el.getBoundingClientRect();
    return {
      center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      radius: Math.min(rect.width, rect.height) / 2,
    };
  } catch {
    // 一部環境で getBoundingClientRect が失敗してもタップ設置で成立させる
    return null;
  }
}

/** イベント座標を安全に数値化する（未定義環境では 0 とみなしタップ設置で成立させる）。 */
function coord(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * かたはめの盤面レンダラ。
 * 上部の穴（中抜き outline）に、下部トレイのピース（塗り図形）をドラッグして入れる。
 * Pointer Events でドラッグ＆スナップ、加えてタップ設置フォールバックを常時有効にする。
 * 正誤・星・演出・音声は QuizEngine 側と共有し、ここでは onPlace(id, correct) を呼ぶだけ。
 */
export function ShapeFitBoard({ problem, locked, onPlace }: ShapeFitBoardProps) {
  const holeRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  // ドラッグ中のピースの見た目上の移動量（transform 用）。
  const [dragTranslate, setDragTranslate] = useState<{
    id: string;
    dx: number;
    dy: number;
  } | null>(null);
  // 穴に収まったピース（吸着表示）。
  const [placedId, setPlacedId] = useState<string | null>(null);
  // 元位置へ戻し中のピース（やさしく戻すアニメ）。
  const [returningId, setReturningId] = useState<string | null>(null);

  // katahame 以外は描画しない（呼び出し側で保証されるが型安全のためガード）。
  if (problem.category !== "katahame") {
    return <div />;
  }
  const target = problem.target;
  const choices = problem.choices;
  // 全ピース同色なので、穴の輪郭色は共有色を使う（差し込み口を色でも関連づける）。
  const holeColor = choices[0]?.color ?? "#8A7A70";

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    pieceId: string,
  ): void => {
    if (locked) {
      return;
    }
    const info = measure(event.currentTarget);
    dragStateRef.current = {
      pieceId,
      pointerId: event.pointerId ?? 0,
      startX: coord(event.clientX),
      startY: coord(event.clientY),
      startCenter: info ? info.center : null,
      moved: 0,
    };
    setReturningId(null);
    setPlacedId(null);
    // ポインタキャプチャは存在すれば使う（jsdom 非対応でも例外を出さない）
    const el = event.currentTarget;
    if (typeof el.setPointerCapture === "function") {
      try {
        el.setPointerCapture(event.pointerId ?? 0);
      } catch {
        // キャプチャ失敗は致命的でない（タップ設置で成立する）
      }
    }
  };

  const handlePointerMove = (
    event: React.PointerEvent<HTMLButtonElement>,
  ): void => {
    const state = dragStateRef.current;
    if (!state || locked) {
      return;
    }
    const dx = coord(event.clientX) - state.startX;
    const dy = coord(event.clientY) - state.startY;
    state.moved = Math.max(state.moved, Math.hypot(dx, dy));
    setDragTranslate({ id: state.pieceId, dx, dy });
  };

  const handlePointerUp = (
    event: React.PointerEvent<HTMLButtonElement>,
    pieceId: string,
    pieceShape: ShapeKind,
    correct: boolean,
  ): void => {
    const state = dragStateRef.current;
    dragStateRef.current = null;
    setDragTranslate(null);
    if (!state || locked) {
      return;
    }
    const el = event.currentTarget;
    if (typeof el.releasePointerCapture === "function") {
      try {
        el.releasePointerCapture(state.pointerId);
      } catch {
        // キャプチャ解放失敗は無視してよい
      }
    }

    const holeInfo = measure(holeRef.current);
    // 穴中心・スナップ半径。取得不可なら原点・半径0（タップ設置で成立させる）。
    const holeCenter = holeInfo ? holeInfo.center : { x: 0, y: 0 };
    const snapRadius = (holeInfo ? holeInfo.radius : 0) * SNAP_RATIO;

    const dx = coord(event.clientX) - state.startX;
    const dy = coord(event.clientY) - state.startY;
    const movement = Math.max(state.moved, Math.hypot(dx, dy));

    // タップ設置（実質無移動）または矩形不明時は、穴中心で判定＝必ず圏内にする。
    const pieceCenter: Point =
      movement < TAP_THRESHOLD || !state.startCenter
        ? holeCenter
        : { x: state.startCenter.x + dx, y: state.startCenter.y + dy };

    const result = evaluateDrop({
      pieceShape,
      targetShape: target,
      pieceCenter,
      holeCenter,
      snapRadius,
    });

    if (result === "fit") {
      setPlacedId(pieceId);
      onPlace(pieceId, correct);
    } else if (result === "miss") {
      // 形が合わない＝もういちど。元位置へ戻しつつ誤答として通知する。
      setReturningId(pieceId);
      onPlace(pieceId, false);
    } else {
      // 圏外＝無反応（ノーフェイル）。元位置へ戻すだけで onPlace は呼ばない。
      setReturningId(pieceId);
    }
  };

  return (
    <div className={styles.board}>
      <div className={styles.holeZone}>
        <div
          ref={holeRef}
          className={styles.hole}
          data-testid="hole"
          data-shape={target}
        >
          <ShapeFigure shape={target} color={holeColor} variant="outline" />
        </div>
      </div>
      <div className={styles.pieceTray}>
        {choices.map((choice) => {
          const isDragging = dragTranslate?.id === choice.id;
          const transform = isDragging
            ? `translate(${dragTranslate.dx}px, ${dragTranslate.dy}px)`
            : undefined;
          const className = [
            styles.piece,
            placedId === choice.id ? styles.placed : "",
            returningId === choice.id ? styles.returning : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={choice.id}
              type="button"
              className={className}
              style={transform ? { transform } : undefined}
              data-testid="piece"
              data-shape={choice.shape}
              data-correct={choice.correct ? "true" : "false"}
              aria-label={choice.label}
              onPointerDown={(event) => handlePointerDown(event, choice.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) =>
                handlePointerUp(event, choice.id, choice.shape, choice.correct)
              }
            >
              <ShapeFigure shape={choice.shape} color={choice.color} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
