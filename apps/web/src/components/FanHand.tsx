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

    // Realistic hand fan for readability on mobile:
    // - bottoms can overlap / be hidden
    // - we care that TOPS are visible
    // We'll use very small rotation and lots of x-spacing.
    const maxAngle = Math.min(26, 6 + n * 0.6);
    const start = -maxAngle / 2;
    const step = n > 1 ? maxAngle / (n - 1) : 0;

    const maxSpread = 820; // px across; prioritize top visibility
    const spacing = n > 1 ? Math.min(44, maxSpread / (n - 1)) : 0;

    return tiles.map((t, i) => {
      const angle = start + step * i;
      const x = (i - (n - 1) / 2) * spacing;
      return { t, i, angle, x, spacing };
    });
  }, [tiles]);

  const [dragging, setDragging] = useState<null | {
    idx: number;
    startX: number;
    curX: number;
  }>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Prevent iOS Safari page-pan while dragging.
    if (dragging) document.body.classList.add("overflow-hidden");
    else document.body.classList.remove("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, [dragging]);

  const spacing = layout[0]?.spacing ?? 24;

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
    setDragging({ idx, startX: e.clientX, curX: e.clientX });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDragging((d) => (d ? { ...d, curX: e.clientX } : d));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragging) return;
    const from = dragging.idx;
    const to = indexFromClientX(e.clientX);
    setDragging(null);
    if (from !== to) props.setTiles(moveInArray(tiles, from, to));
  }

  const topClipHeight = 165; // only show the top portion; bottoms can converge/overlap offscreen
  const cardW = "clamp(44px, 6vw, 56px)";
  const cardH = "clamp(188px, 24vw, 230px)";

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none"
      style={{ touchAction: "none" }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDragging(null)}
    >
      {/* Clip to show only card tops */}
      <div className="relative w-full overflow-hidden" style={{ height: topClipHeight }}>
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[1200px] max-w-[100vw]" style={{ height: Number(String(cardH).replace(/[^0-9.]/g, "")) || 240 }}>
          {tiles.map((tile, idx) => {
            const base = layout[idx];
            const isSel = props.selected === tile;
            const isHL = props.highlightLike === tile;

            const liftPx = isSel ? 10 : 0;

            const isDraggingThis = dragging?.idx === idx;
            const dx = isDraggingThis ? dragging!.curX - dragging!.startX : 0;

            // Push the card DOWN so only the top is visible inside the clip.
            const sinkPx = 80;

            const style: React.CSSProperties = {
              position: "absolute",
              left: "50%",
              bottom: 0,
              width: cardW,
              height: cardH,
              transformOrigin: "bottom center",
              transform: `translateX(calc(-50% + ${base.x + dx}px)) translateY(${sinkPx - liftPx}px) rotate(${base.angle}deg)` ,
              zIndex: isDraggingThis ? 5000 : 1000 - Math.abs(idx - (tiles.length - 1) / 2),
              touchAction: "none",
            };

            return (
              <button
                key={`${tile}:${idx}`}
                style={style}
                className={
                  "rounded-md overflow-hidden bg-white shadow-sm border transition select-none touch-none " +
                  (isSel ? "border-amber-400 ring-2 ring-amber-200" : "border-white/40") +
                  (isHL ? " ring-2 ring-amber-300" : "")
                }
                onClick={() => props.onSelect(tile)}
                onPointerDown={(e) => onPointerDown(idx, e)}
                onContextMenu={(e) => e.preventDefault()}
                title={tile}
                aria-label={tile}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
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

      {/* Spacer to keep controls from jumping up */}
      <div style={{ height: 140 }} />
    </div>
  );
}
