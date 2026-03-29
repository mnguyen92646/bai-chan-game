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

    // A "real hand" fan: card bottoms converge (same pivot), card tops spread.
    // We do this by placing all cards on the same bottom pivot and rotating.
    // To keep all cards readable, we allow a wider fan for larger hands.
    const maxAngle = Math.min(140, 26 + n * 3.2);
    const start = -maxAngle / 2;
    const step = n > 1 ? maxAngle / (n - 1) : 0;

    return tiles.map((t, i) => {
      const angle = start + step * i;
      // zIndex: center cards on top so you can still click/select
      const distFromCenter = Math.abs(i - (n - 1) / 2);
      return { t, i, angle, z: 1000 - distFromCenter };
    });
  }, [tiles]);

  return (
    <div className="relative w-full h-[280px] select-none">
      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[880px] max-w-[98vw] h-[280px]">
        {layout.map(({ t, i, angle, z }) => {
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
                // Bottoms converge at the pivot point; tops spread via rotation.
                transform: `translateX(-50%) translateY(-${liftPx}px) rotate(${angle}deg)`,
                zIndex: z,
                width: 52,
                height: 192
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
