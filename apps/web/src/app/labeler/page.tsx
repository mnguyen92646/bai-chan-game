"use client";

import { useEffect, useMemo, useState } from "react";

type Label =
  | { kind: "rank"; rank: number; suit: "van" | "vanh" | "sach" }
  | { kind: "yeu"; name: "lao" | "chi" | "thang" };

type LabelKey = string; // e.g. "2_sach" or "chi"

function labelToKey(l: Label): LabelKey {
  if (l.kind === "rank") return `${l.rank}_${l.suit}`;
  return l.name;
}

function keyToLabel(key: LabelKey): Label {
  if (key === "lao" || key === "chi" || key === "thang") return { kind: "yeu", name: key };
  const m = key.match(/^(\d)_(van|vanh|sach)$/);
  if (!m) throw new Error(`Bad label key: ${key}`);
  return { kind: "rank", rank: Number(m[1]), suit: m[2] as any };
}

const TILE_IDS: string[] = [
  // rank tiles
  ...Array.from({ length: 9 }, (_, i) => i + 1).flatMap((r) => [
    `${r}_van`,
    `${r}_vanh`,
    `${r}_sach`
  ]),
  // yeu tiles
  "lao",
  "chi",
  "thang"
];

const LABEL_OPTIONS: Array<{ label: string; key: LabelKey; value: Label }> = [
  // ranks
  ...Array.from({ length: 9 }, (_, i) => i + 1).flatMap((rank) =>
    [
      {
        label: `${rank} · van`,
        key: `${rank}_van`,
        value: { kind: "rank" as const, rank, suit: "van" as const }
      },
      {
        label: `${rank} · văn`,
        key: `${rank}_vanh`,
        value: { kind: "rank" as const, rank, suit: "vanh" as const }
      },
      {
        label: `${rank} · sách`,
        key: `${rank}_sach`,
        value: { kind: "rank" as const, rank, suit: "sach" as const }
      }
    ] as Array<{ label: string; key: LabelKey; value: Label }>
  ),
  // yeu
  { label: "yêu · lão", key: "lao", value: { kind: "yeu", name: "lao" } },
  { label: "yêu · chi", key: "chi", value: { kind: "yeu", name: "chi" } },
  { label: "yêu · thang", key: "thang", value: { kind: "yeu", name: "thang" } }
];

const KEY = "bai-chan-tile-labels:v2";

function loadState(): Record<string, LabelKey> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveState(v: Record<string, LabelKey>) {
  window.localStorage.setItem(KEY, JSON.stringify(v));
}

export default function LabelerPage() {
  const [idx, setIdx] = useState(0);
  const [labels, setLabels] = useState<Record<string, LabelKey>>({});

  useEffect(() => {
    setLabels(loadState());
  }, []);

  const tileId = TILE_IDS[idx] ?? TILE_IDS[0];
  const src = require("@/lib/tileSrc").tilePngSrc(tileId);

  const doneCount = useMemo(() => Object.keys(labels).length, [labels]);

  const usedKeys = useMemo(() => new Set(Object.values(labels)), [labels]);
  const currentKey = labels[tileId];

  const availableOptions = useMemo(() => {
    return LABEL_OPTIONS.filter((opt) => !usedKeys.has(opt.key) || opt.key === currentKey);
  }, [usedKeys, currentKey]);

  function setLabelForCurrent(l: Label) {
    const key = labelToKey(l);

    // Enforce one-to-one: if some other tile already has this key, clear it.
    const next: Record<string, LabelKey> = { ...labels };
    for (const [k, v] of Object.entries(next)) {
      if (k !== tileId && v === key) delete next[k];
    }

    next[tileId] = key;
    setLabels(next);
    saveState(next);
    setIdx((i) => Math.min(i + 1, TILE_IDS.length - 1));
  }

  function clearCurrent() {
    const next: Record<string, LabelKey> = { ...labels };
    delete next[tileId];
    setLabels(next);
    saveState(next);
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(labels, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tile-labels.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto">
      <h1 className="text-xl font-semibold">Tile Labeler</h1>
      <p className="text-sm text-gray-600 mt-1">
        Confirm each tile visually and assign its correct classification.
      </p>

      <div className="mt-4 flex items-center justify-between text-sm">
        <div>
          Tile: <span className="font-mono">{tileId}</span>
        </div>
        <div>
          {idx + 1}/{TILE_IDS.length} · labeled {doneCount}
        </div>
      </div>

      <div className="mt-2 text-sm text-gray-700">
        Current: {currentKey ? <span className="font-mono">{currentKey}</span> : <span className="text-gray-500">(unlabeled)</span>}
        {currentKey ? (
          <button className="ml-3 text-xs underline" onClick={clearCurrent}>
            Clear
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex justify-center">
        <div className="w-24 h-96 border rounded bg-white overflow-hidden">
          <img src={src} className="w-full h-full object-fill" alt={tileId} draggable={false} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {availableOptions.map((opt, j) => {
          const selected = opt.key === currentKey;
          return (
            <button
              key={j}
              className={`border rounded-md px-3 py-2 text-sm ${
                selected
                  ? "bg-emerald-600 text-white border-emerald-700"
                  : "bg-white text-zinc-900 border-zinc-300 hover:bg-zinc-50"
              }`}
              onClick={() => setLabelForCurrent(opt.value)}
            >
              {opt.label}
              {selected ? " ✓" : ""}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2">
        <button className="flex-1 border rounded-md py-2" onClick={() => setIdx((i) => Math.max(0, i - 1))}>
          Prev
        </button>
        <button className="flex-1 border rounded-md py-2" onClick={() => setIdx((i) => Math.min(TILE_IDS.length - 1, i + 1))}>
          Next
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button className="flex-1 bg-black text-white rounded-md py-2" onClick={downloadJson}>
          Download JSON
        </button>
        <button
          className="flex-1 border rounded-md py-2"
          onClick={() => {
            window.localStorage.removeItem(KEY);
            setLabels({});
            setIdx(0);
          }}
        >
          Reset
        </button>
      </div>

      <p className="mt-6 text-xs text-gray-500">
        Tip: open this on your phone and just tap through. When done, hit Download JSON and send it to me.
      </p>
    </main>
  );
}
