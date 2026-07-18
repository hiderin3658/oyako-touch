"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Problem } from "@/lib/types";
import { Sparkles } from "@/components/quiz/Sparkles";
import { ShapeFigure } from "./ShapeChoice";
import type { Point } from "./shapeFit";
import {
  advanceTrace,
  initialTraceState,
  isTraceComplete,
  traceRatio,
  type TraceConfig,
  type TraceState,
} from "./traceProgress";
import styles from "./TraceBoard.module.css";

interface TraceBoardProps {
  problem: Problem;
  locked: boolean;
  onPlace: (choiceId: string, correct: boolean) => void;
}

// 道の通過点サンプル数（実機 NM2 で微調整前提）。
const SAMPLE_COUNT = 16;
// 許容半径・先読み・完成率のまとめ（値は viewBox 0..100 のユーザー座標基準）。
const CONFIG: TraceConfig = { tolerance: 22, lookahead: 2, completeRatio: 0.85 };
// 道ガイド（中立色の破線）となぞり跡（アクセント色）の色。
const GUIDE_COLOR = "#C9BDB3";
const TRACE_COLOR = "var(--peach)";

/** container 内の図形の幾何要素（circle/rect/path）を返す。取得不可なら null。 */
function geometryOf(container: HTMLElement | null): SVGGeometryElement | null {
  if (!container || typeof container.querySelector !== "function") {
    return null;
  }
  return container.querySelector("circle, rect, path") as SVGGeometryElement | null;
}

/** getTotalLength を安全に取得する（未対応・例外時は 0）。 */
function safeTotalLength(geo: SVGGeometryElement): number {
  if (typeof geo.getTotalLength !== "function") {
    return 0;
  }
  try {
    return geo.getTotalLength();
  } catch {
    return 0;
  }
}

/**
 * 道ガイドの幾何要素を等間隔サンプリングして通過点列（ユーザー座標）を返す。
 * getTotalLength/getPointAtLength 非対応（jsdom）・例外時は空配列を返しフォールバックに委ねる。
 */
function sampleRoad(container: HTMLElement | null): Point[] {
  const geo = geometryOf(container);
  if (!geo) {
    return [];
  }
  const total = safeTotalLength(geo);
  if (total <= 0 || typeof geo.getPointAtLength !== "function") {
    return [];
  }
  const points: Point[] = [];
  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    const len = (total * i) / (SAMPLE_COUNT - 1);
    try {
      const p = geo.getPointAtLength(len);
      points.push({ x: p.x, y: p.y });
    } catch {
      // 一部でも取得できなければサンプル不能とみなす（フォールバックで成立させる）
      return [];
    }
  }
  return points;
}

/** getBoundingClientRect を安全に取得する（未対応・例外時は null）。 */
function safeRect(el: HTMLElement | null): DOMRect | null {
  if (!el || typeof el.getBoundingClientRect !== "function") {
    return null;
  }
  try {
    return el.getBoundingClientRect();
  } catch {
    return null;
  }
}

/** イベント座標を安全に数値化する（未定義環境では 0 とみなす）。 */
function coord(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * なぞりの盤面レンダラ。
 * 大きな形の破線ガイド（道）を指でなぞり、道上の通過点を順に消化して大部分をたどると完成。
 * 完成時にのみ onPlace("trace", true) を1回呼ぶ（誤答の概念が無い＝ノーフェイル）。
 * 星・「せいかい！」・音声・advance・ロックは QuizEngine 側と共有する。
 */
export function TraceBoard({ problem, locked, onPlace }: TraceBoardProps) {
  const guideRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // なぞり跡（オーバーレイ）の幾何要素とその全長（進捗の色づきに使う）。
  const overlayGeoRef = useRef<SVGGeometryElement | null>(null);
  const overlayLenRef = useRef(0);
  // 道の通過点列・現在の消化状態・完成/描画中フラグ・サンプル可否。
  const pointsRef = useRef<Point[]>([]);
  const traceStateRef = useRef<TraceState>(initialTraceState());
  const completedRef = useRef(false);
  const drawingRef = useRef(false);
  const canSampleRef = useRef(false);

  // 開始点マークの位置（ユーザー座標）。サンプル前は中央を仮置きする。
  const [startPoint, setStartPoint] = useState<Point>({ x: 50, y: 50 });
  // 完成時のキラキラ演出トリガ。
  const [sparkTrigger, setSparkTrigger] = useState(0);

  // なぞり以外は描画しない（呼び出し側で保証されるが型安全のためガード）。
  const target = problem.category === "nazori" ? problem.target : null;

  /** なぞり跡の色づきを消化率に応じて更新する（dashoffset を縮めて塗り進める）。 */
  const updateOverlay = (ratio: number): void => {
    const len = overlayLenRef.current;
    const geo = overlayGeoRef.current;
    if (len <= 0 || !geo) {
      return;
    }
    geo.style.strokeDasharray = String(len);
    geo.style.strokeDashoffset = String(len * (1 - ratio));
  };

  /** 道ガイドをサンプリングし、なぞり跡の初期状態（全隠し）を整える。 */
  const sampleGuide = (): void => {
    const points = sampleRoad(guideRef.current);
    if (points.length > 0) {
      pointsRef.current = points;
      canSampleRef.current = true;
      setStartPoint(points[0]);
    }
    const geo = geometryOf(overlayRef.current);
    overlayGeoRef.current = geo;
    overlayLenRef.current = geo ? safeTotalLength(geo) : 0;
    // なぞり跡は初期状態では全隠し（消化率 0）。
    updateOverlay(0);
  };

  // 初回レイアウト後に道をサンプリングする（実機は等間隔サンプル、jsdom は空でフォールバック）。
  useLayoutEffect(() => {
    sampleGuide();
    // problem.id ごとに QuizEngine が再マウントするため、依存は不要（マウント時1回）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ポインタ座標を道と同じユーザー座標（0..100）へ写像する。取得不可なら null。
   *  通過点は道ガイド SVG の viewBox（0..100）座標なので、写像も道ガイドの矩形を基準にする
   *  （舞台の padding 分ずれないよう、SVG が 1:1 で満たすガイド領域を基準にする）。 */
  const toUserPoint = (event: React.PointerEvent<HTMLDivElement>): Point | null => {
    const rect = safeRect(guideRef.current);
    if (!rect || rect.width === 0 || rect.height === 0) {
      return null;
    }
    return {
      x: ((coord(event.clientX) - rect.left) / rect.width) * 100,
      y: ((coord(event.clientY) - rect.top) / rect.height) * 100,
    };
  };

  /** 完成を一度だけ通知する（二重発火防止・全色化・キラキラ）。 */
  const fireComplete = (): void => {
    if (completedRef.current) {
      return;
    }
    completedRef.current = true;
    drawingRef.current = false;
    updateOverlay(1);
    setSparkTrigger((value) => value + 1);
    onPlace("trace", true);
  };

  /** 指の現在位置で frontier を前進させ、完成なら通知する（サンプル可能環境のみ）。 */
  const applyFinger = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!canSampleRef.current) {
      return;
    }
    const finger = toUserPoint(event);
    if (!finger) {
      return;
    }
    const next = advanceTrace(traceStateRef.current, pointsRef.current, finger, CONFIG);
    if (next === traceStateRef.current) {
      return;
    }
    traceStateRef.current = next;
    updateOverlay(traceRatio(next, pointsRef.current));
    if (isTraceComplete(next, pointsRef.current, CONFIG)) {
      fireComplete();
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (locked || completedRef.current) {
      return;
    }
    // 初回サンプルが空だった場合はこの時点で再サンプルする（レイアウト遅延・テスト注入への保険）。
    if (pointsRef.current.length === 0) {
      sampleGuide();
    }
    drawingRef.current = true;
    const el = event.currentTarget;
    if (typeof el.setPointerCapture === "function") {
      try {
        el.setPointerCapture(event.pointerId ?? 0);
      } catch {
        // キャプチャ失敗は致命的でない（判定は座標写像で成立する）
      }
    }
    applyFinger(event);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (locked || completedRef.current || !drawingRef.current) {
      return;
    }
    applyFinger(event);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    const el = event.currentTarget;
    if (typeof el.releasePointerCapture === "function") {
      try {
        el.releasePointerCapture(event.pointerId ?? 0);
      } catch {
        // キャプチャ解放失敗は無視してよい
      }
    }
    if (locked || completedRef.current) {
      drawingRef.current = false;
      return;
    }
    if (!drawingRef.current) {
      return;
    }
    drawingRef.current = false;
    // サンプル不能環境（jsdom 等）は 1 セッション（down→up）で完成成立させる（決定論化）。
    // 実機はサンプル可能なので単なるタップでは完成せず、実際になぞる必要がある。
    if (!canSampleRef.current) {
      fireComplete();
    }
    // サンプル可能で未完成なら状態を保持し、指を離しても続きから再開できる（ノーフェイル）。
  };

  // 中断（pointercancel：OSジェスチャ・パーム誤タッチ等）の後始末。
  // 完成通知は呼ばず（誤答経路は使わない）、状態をクリアして再操作で完成できるようにする。
  const handlePointerCancel = (): void => {
    drawingRef.current = false;
    if (completedRef.current) {
      return;
    }
    traceStateRef.current = initialTraceState();
    updateOverlay(0);
  };

  if (!target) {
    return <div />;
  }

  return (
    <div className={styles.board}>
      <div
        className={styles.stage}
        data-testid="trace-board"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* 道ガイド（中立色の破線）。なぞる道すじを示す。 */}
        <div ref={guideRef} className={styles.guide} data-shape={target}>
          <ShapeFigure shape={target} color={GUIDE_COLOR} variant="outline" />
        </div>
        {/* なぞり跡（アクセント色）。消化率に応じて dashoffset で色づく。 */}
        <div ref={overlayRef} className={styles.trace} data-testid="trace-overlay">
          <ShapeFigure shape={target} color={TRACE_COLOR} variant="outline" />
        </div>
        {/* 開始点の目印。 */}
        <span
          className={styles.startMark}
          data-testid="trace-start"
          style={{ left: `${startPoint.x}%`, top: `${startPoint.y}%` }}
        />
        <Sparkles trigger={sparkTrigger} />
      </div>
    </div>
  );
}
