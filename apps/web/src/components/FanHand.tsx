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
    const maxAngle = Math.min(80, 10 + n * 2.2);
    const start = -maxAngle / 2;
    const step = n > 1 ? maxAngle / (n - 1) : 0;

    return tiles.map((t, i) => {
      const angle = start + step * i;
      const radius = 240;
      const y = Math.abs(angle) * 0.9; // small lift toward ends
      return { t, i, angle, radius, y };
    });
  }, [tiles]);

  return (
    <div className="relative w-full h-[260px] select-none">
      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[760px] max-w-[98vw] h-[260px]">
        {layout.map(({ t, i, angle, radius, y }) => {
          const isSel = props.selected === t;
          const isHL = props.highlightLike === t;
          const z = i;

          return (
            <button
              key={`${t}:${i}`}
              className={
                "absolute left-1/2 bottom-0 origin-bottom-center rounded-md overflow-hidden bg-white shadow-sm border transition " +
                (isSel ? "-translate-y-4 border-amber-400 ring-2 ring-amber-200" : "border-white/40") +
                (isHL ? " ring-2 ring-amber-300" : "")
              }
              style={{
                transform: `translateX(-50%) rotate(${angle}deg) translateY(-${y}px)`,
                zIndex: z,
                width: 46,
                height: 180
              }}
              onClick={() => props.onSelect(t)}
              title={t}
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
