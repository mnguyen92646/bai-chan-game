"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export function FanHand(props: {
  tiles: string[];
  setTiles: (next: string[]) => void;
  selected: string;
  onSelect: (t: string) => void;
  highlightLike?: string;
}) {
  const tiles = props.tiles ?? [];

  const layout = useMemo(() => {
    const n = tiles.length;

    // True "hand-held" fan:
    // - bottoms converge towards a single thumb point
    // - tops spread and are readable
    // Achieve this by rotating around a point *below* the card bottom (thumb pivot).

    // Wider open so each top is visible (like a one-handed card fan)
    // Keep compact horizontally (especially on iPhone).
    // Wider pivot => huge spread, so keep angles conservative.
    const maxAngle = Math.min(88, 18 + n * 1.6);
    const start = -maxAngle / 2;
    const step = n > 1 ? maxAngle / (n - 1) : 0;

    // Horizontal spacing is mainly for drag/drop indexing, not for visuals.
    const spacing = n > 1 ? 18 : 0;

    // IMPORTANT: no extra y-arc math here.
    // The "fan" curvature should come from rotation about a thumb point below the cards.
    // Adding y offsets makes it look like a U/∩ curve instead of a collapsible fan.

    return tiles.map((t, i) => {
      const angle = start + step * i;
      // bias right: shift the "center" slightly left so more cards end up on the right
      const x = (i - (n - 1) / 2 - 1.0) * spacing;

      const distFromCenter = Math.abs(i - (n - 1) / 2);
      const z = 1000 - distFromCenter;
      return { t, i, x, y: 0, angle, spacing, z };
    });
  }, [tiles]);

  const [dragging, setDragging] = useState<null | {
    idx: number;
    startX: number;
    curX: number;
    targetIdx: number;
  }>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Prevent iOS Safari page-pan while dragging.
    if (dragging) document.body.classList.add("overflow-hidden");
    else document.body.classList.remove("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, [dragging]);

  // Use a stable pixel spacing for drag index estimation.
  // (The visual fan is rotation-based, so layout spacing is not reliable for hit-testing.)
  const spacing = 32;

  function indexFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const center = rect.width / 2;
    const offset = x - center;
    const raw = offset / spacing + (tiles.length - 1) / 2;
    const idx = Math.round(raw);
    return Math.max(0, Math.min(tiles.length - 1, idx));
  }

  function moveInArray<T>(arr: T[], from: number, to: number) {
    const next = arr.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

  function onPointerDown(idx: number, e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const t = indexFromClientX(e.clientX);
    setDragging({ idx, startX: e.clientX, curX: e.clientX, targetIdx: t });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const t = indexFromClientX(e.clientX);
    setDragging((d) => (d ? { ...d, curX: e.clientX, targetIdx: t } : d));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragging) return;
    const from = dragging.idx;
    const to = dragging.targetIdx;
    setDragging(null);
    if (from !== to) props.setTiles(moveInArray(tiles, from, to));
  }

  // Card size tuned for iPhone: keep readable but not overly wide.
  const cardW = "clamp(40px, 5.4vw, 52px)";
  const cardH = "clamp(176px, 22vw, 220px)";

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none"
      style={{ touchAction: "none" }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDragging(null)}
    >
      <div className="relative w-full h-[250px]">
        {/* Bias the fan slightly to the right so "unmatched" tiles naturally sit right/top */}
        <div className="absolute left-1/2 bottom-0 w-[1200px] max-w-[100vw] h-[250px]" style={{ transform: "translateX(calc(-50% + 28px))" }}>
          {tiles.map((tile, idx) => {
            const base = layout[idx];
            const isSel = props.selected === tile;
            const isHL = props.highlightLike === tile;

            const liftPx = isSel ? 16 : 0;
            const sinkPx = 0; // container bottom is already sunk; keep transform clean

            const isDraggingThis = dragging?.idx === idx;
            const dx = isDraggingThis ? dragging!.curX - dragging!.startX : 0;

            const style: React.CSSProperties = {
              position: "absolute",
              left: "50%",
              bottom: 0,
              width: cardW,
              height: cardH,
              // Pivot far below the card bottom so bottoms converge to a thumb point.
              transformOrigin: "50% 240%", 
              transform: `translateX(calc(-50% + ${base.x + dx}px)) translateY(${base.y + sinkPx - liftPx}px) rotate(${base.angle}deg)`,
              zIndex: isDraggingThis ? 5000 : base.z ?? 1000,
              touchAction: "none",
            };

            const target = dragging?.targetIdx ?? -1;
            const willLandLeft = dragging ? Math.min(dragging.idx, target) : -1;
            const willLandRight = dragging ? Math.max(dragging.idx, target) : -1;
            const showLandingCue = dragging && idx !== dragging.idx && (idx === target || idx === target - 1);
            const showRail = dragging && (idx === target || (target === 0 && idx === 0));

            return (
              <button
                key={`${tile}:${idx}`}
                style={style}
                className={
                  "rounded-md overflow-hidden bg-white shadow-sm border transition select-none touch-none relative " +
                  (isSel ? "border-amber-400 ring-2 ring-amber-200" : "border-white/40") +
                  (isHL ? " ring-2 ring-amber-300" : "") +
                  (showLandingCue ? " ring-2 ring-sky-300 border-sky-400" : "")
                }
                onClick={() => props.onSelect(tile)}
                onPointerDown={(e) => onPointerDown(idx, e)}
                onContextMenu={(e) => e.preventDefault()}
                title={tile}
                aria-label={tile}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {showRail ? (
                  <div className="absolute -right-1 top-2 bottom-2 w-[3px] bg-sky-300 shadow-[0_0_0_1px_rgba(56,189,248,0.35)] rounded" />
                ) : null}
                <img
                  src={require("@/lib/tileSrc").tilePngSrc(tile)}
                  className="w-full h-full object-fill"
                  alt={tile}
                  draggable={false}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* spacer so controls don't overlap the hand */}
      <div style={{ height: 40 }} />
    </div>
  );
}
