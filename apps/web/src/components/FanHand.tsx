"use client";

import { useMemo } from "react";

export function FanHand(props: {
  tiles: string[];
  selected: string;
  onSelect: (t: string) => void;
  highlightLike?: string;
}) {
  const tiles = props.tiles ?? [];

  const layout = useMemo(() => {
    const n = tiles.length;

    // "One-handed" fan: bottoms are close together, tops are spaced so every face is visible.
    // Rotation alone causes a weird X-shape overlap; we need a small horizontal spacing too.
    const maxAngle = Math.min(90, 18 + n * 2.4);
    const start = -maxAngle / 2;
    const step = n > 1 ? maxAngle / (n - 1) : 0;

    // keep bottoms mostly together, but give each card a slight x offset so tops don't collide
    const maxSpread = 320; // px total spread across the fan (tuned for 19–23 tiles)
    const spacing = n > 1 ? Math.min(18, maxSpread / (n - 1)) : 0;

    return tiles.map((t, i) => {
      const angle = start + step * i;
      const x = (i - (n - 1) / 2) * spacing;
      const distFromCenter = Math.abs(i - (n - 1) / 2);
      return { t, i, angle, x, z: 1000 - distFromCenter };
    });
  }, [tiles]);

  return (
    <div className="relative w-full h-[280px] select-none">
      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[980px] max-w-[100vw] h-[280px]">
        {layout.map(({ t, i, angle, x, z }) => {
          const isSel = props.selected === t;
          const isHL = props.highlightLike === t;

          const liftPx = isSel ? 18 : 0;

          return (
            <button
              key={`${t}:${i}`}
              className={
                "absolute left-1/2 bottom-0 origin-bottom-center rounded-md overflow-hidden bg-white shadow-sm border transition " +
                (isSel ? "border-amber-400 ring-2 ring-amber-200" : "border-white/40") +
                (isHL ? " ring-2 ring-amber-300" : "")
              }
              style={{
                // Slight x-offset + rotation = classic hand fan where tops are visible.
                transform: `translateX(calc(-50% + ${x}px)) translateY(-${liftPx}px) rotate(${angle}deg)`,
                zIndex: z,
                width: 52,
                height: 192,
              }}
              onClick={() => props.onSelect(t)}
              title={t}
              aria-label={t}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={require("@/lib/tileSrc").tilePngSrc(t)}
                className="w-full h-full object-fill"
                alt={t}
                draggable={false}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
