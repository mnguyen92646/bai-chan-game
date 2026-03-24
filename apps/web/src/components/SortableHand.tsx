"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableTile({
  id,
  tile,
  selected,
  lastDrawn,
  match,
  onSelect
}: {
  id: string;
  tile: string;
  selected: boolean;
  lastDrawn: boolean;
  match: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Critical for iOS: prevent the page from scrolling while dragging a tile (esp. vertical drags).
    touchAction: "none",
    opacity: isDragging ? 0.6 : 1
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      className={`border-2 rounded-md p-0.5 bg-white shadow-sm transition select-none touch-none ${
        selected ? "border-blue-600 ring-2 ring-blue-300" : match ? "border-amber-500 ring-2 ring-amber-200" : "border-transparent"
      } ${lastDrawn ? "ring-2 ring-green-600" : ""}`}
      onClick={onSelect}
      onContextMenu={(e) => e.preventDefault()}
      {...attributes}
      {...listeners}
      aria-label={tile}
    >
      {/* Real-life tiles are long/thin (~1:4). Use responsive sizing so ~10 fit across on iPhone. */}
      <div className="w-7 h-28 sm:w-8 sm:h-32 md:w-10 md:h-40">
        <img
          src={require("@/lib/tileSrc").tilePngSrc(tile)}
          className="w-full h-full object-fill select-none"
          alt={tile}
          draggable={false}
        />
      </div>
    </button>
  );
}

export function SortableHand({
  hand,
  setHand,
  selected,
  setSelected,
  lastDrawnTile,
  highlightLike
}: {
  hand: string[];
  setHand: (next: string[]) => void;
  selected: string;
  setSelected: (t: string) => void;
  lastDrawnTile: string;
  highlightLike?: string;
}) {
  function groupKey(t: string) {
    // Highlight matches based on your rule:
    // Special6 = (Nhất 1_* + Yêu lao/chi/thang) all match each other.
    if (t === "chi" || t === "lao" || t === "thang") return "SPECIAL6";
    const m = t.match(/^(\d)_(van|vanh|sach)$/);
    if (!m) return t;
    const rank = Number(m[1]);
    if (rank === 1) return "SPECIAL6";
    return `RANK_${rank}`;
  }

  const selectedGroup = selected ? groupKey(selected) : "";
  const highlightGroup = highlightLike ? groupKey(highlightLike) : "";

  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    // Prevent page scroll during drag on mobile (esp iOS Safari).
    if (dragging) document.body.classList.add("overflow-hidden");
    else document.body.classList.remove("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, [dragging]);

  // DnD-kit requires stable unique IDs per item. Since tiles can repeat, we key by index.
  const ids = useMemo(() => hand.map((_, idx) => `i_${idx}`), [hand]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 }
    })
  );

  function onDragEnd(e: DragEndEvent) {
    setDragging(false);
    const { active, over } = e;
    if (!over) return;
    if (active.id === over.id) return;

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(hand, oldIndex, newIndex);
    setHand(next);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={() => setDragging(true)}
      onDragCancel={() => setDragging(false)}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="flex flex-wrap gap-1 mt-2">
          {hand.map((tile, idx) => {
            const id = ids[idx];
            return (
              <SortableTile
                key={id}
                id={id}
                tile={tile}
                selected={selected === tile}
                lastDrawn={lastDrawnTile === tile}
                match={(Boolean(selectedGroup) && groupKey(tile) === selectedGroup) || (Boolean(highlightGroup) && groupKey(tile) === highlightGroup)}
                onSelect={() => setSelected(tile)}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
