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

    // Return to the "crown" baseline, but shape it into a compact FAN:
    // - cards lie on an arc (y offset based on angle)
    // - rotation spreads the tops
    // - small x-spacing prevents severe overlap collisions
    const maxAngle = Math.min(128, 28 + n * 3.4);
    const start = -maxAngle / 2;
    const step = n > 1 ? maxAngle / (n - 1) : 0;

    const maxSpread = 500;
    const spacing = n > 1 ? Math.min(24, maxSpread / (n - 1)) : 0;

    // Arc depth controls how round the bottom feels.
    // Push this harder so the fan is clearly rounded (less "square").
    const arcDepth = Math.min(160, 64 + n * 2.4);

    return tiles.map((t, i) => {
      const angle = start + step * i;
      const x = (i - (n - 1) / 2) * spacing;
      const rad = (angle * Math.PI) / 180;
      // center lowest, edges higher -> rounded fan arc
      // (1 - cos) gives a smooth bowl; scale it up for a more circular feel.
      const y = -Math.round(arcDepth * (1 - Math.cos(rad)));
      const distFromCenter = Math.abs(i - (n - 1) / 2);
      const z = 1000 - distFromCenter;
      return { t, i, x, y, angle, spacing, z };
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
      <div className="relative w-full h-[250px]">
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[1200px] max-w-[100vw] h-[250px]">
          {tiles.map((tile, idx) => {
            const base = layout[idx];
            const isSel = props.selected === tile;
            const isHL = props.highlightLike === tile;

            const liftPx = isSel ? 16 : 0;

            const isDraggingThis = dragging?.idx === idx;
            const dx = isDraggingThis ? dragging!.curX - dragging!.startX : 0;

            const style: React.CSSProperties = {
              position: "absolute",
              left: "50%",
              bottom: 0,
              width: cardW,
              height: cardH,
              transformOrigin: "bottom center",
              transform: `translateX(calc(-50% + ${base.x + dx}px)) translateY(${base.y - liftPx}px) rotate(${base.angle}deg)`,
              // center cards slightly on top; dragged card above all
              zIndex: isDraggingThis ? 5000 : base.z ?? 1000,
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

      {/* spacer so controls don't overlap the hand */}
      <div style={{ height: 40 }} />
    </div>
  );
}
