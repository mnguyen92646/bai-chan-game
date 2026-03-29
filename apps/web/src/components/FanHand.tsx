"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
}
from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

    // "One-handed" fan: bottoms converge, tops are visible.
    // The key is rotation + horizontal spacing.
    const maxAngle = Math.min(70, 10 + n * 1.9);
    const start = -maxAngle / 2;
    const step = n > 1 ? maxAngle / (n - 1) : 0;

    // Increase spread so the *tops* are more visible (less crown, more fan)
    const maxSpread = 520; // px total spread across the fan (19–23 tiles on mobile)
    const spacing = n > 1 ? Math.min(28, maxSpread / (n - 1)) : 0;

    return tiles.map((t, i) => {
      const angle = start + step * i;
      const x = (i - (n - 1) / 2) * spacing;
      const distFromCenter = Math.abs(i - (n - 1) / 2);
      return { t, i, angle, x, z: 1000 - distFromCenter };
    });
  }, [tiles]);

  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    // Prevent iOS Safari page-pan while dragging.
    if (dragging) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => document.body.classList.remove("overflow-hidden");
  }, [dragging]);

  // Stable IDs: tiles can repeat so use index IDs.
  const ids = useMemo(() => tiles.map((_, idx) => `i_${idx}`), [tiles]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  );

  function onDragEnd(e: DragEndEvent) {
    setDragging(false);
    const { active, over } = e;
    if (!over) return;
    if (active.id === over.id) return;

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    props.setTiles(arrayMove(tiles, oldIndex, newIndex));
  }

  function FanTile({ id, tile, base }: { id: string; tile: string; base: { angle: number; x: number; z: number } }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const isSel = props.selected === tile;
    const isHL = props.highlightLike === tile;
    const liftPx = isSel ? 18 : 0;

    const baseTransform = `translateX(calc(-50% + ${base.x}px)) translateY(-${liftPx}px) rotate(${base.angle}deg)`;
    const dragTransform = CSS.Transform.toString(transform);

    const style: React.CSSProperties = {
      transform: dragTransform ? `${baseTransform} ${dragTransform}` : baseTransform,
      transition,
      zIndex: base.z,
      width: "clamp(44px, 6vw, 56px)",
      height: "clamp(168px, 22vw, 208px)",
      touchAction: "none",
      opacity: isDragging ? 0.7 : 1,
    };

    return (
      <button
        ref={setNodeRef}
        style={style}
        className={
          "absolute left-1/2 bottom-0 origin-bottom-center rounded-md overflow-hidden bg-white shadow-sm border transition select-none touch-none " +
          (isSel ? "border-amber-400 ring-2 ring-amber-200" : "border-white/40") +
          (isHL ? " ring-2 ring-amber-300" : "")
        }
        onClick={() => props.onSelect(tile)}
        onContextMenu={(e) => e.preventDefault()}
        title={tile}
        aria-label={tile}
        {...attributes}
        {...listeners}
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
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={() => setDragging(true)}
      onDragCancel={() => setDragging(false)}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids}>
        <div className="relative w-full h-[300px] select-none touch-none" style={{ touchAction: "none" }}>
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[1100px] max-w-[100vw] h-[300px]">
            {tiles.map((tile, idx) => {
              const id = ids[idx];
              const base = layout[idx];
              return <FanTile key={id} id={id} tile={tile} base={base} />;
            })}
          </div>
        </div>
      </SortableContext>
    </DndContext>
  );
}
