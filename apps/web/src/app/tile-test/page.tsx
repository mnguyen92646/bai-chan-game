"use client";

import { tilePngSrc } from "@/lib/tileSrc";

const tiles = ["7_vanh", "8_vanh", "9_vanh"];

export default function TileTestPage() {
  return (
    <main className="min-h-screen p-4 max-w-md mx-auto">
      <h1 className="text-xl font-semibold">Tile test</h1>
      <p className="text-sm text-gray-600 mt-1">Tap a tile to open its direct PNG (cache-busted).</p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {tiles.map((t) => {
          const href = tilePngSrc(t);
          return (
            <a key={t} href={href} className="block text-center">
              <div className="w-16 h-64 border rounded bg-white overflow-hidden mx-auto">
                <img src={href} className="w-full h-full object-fill" alt={t} />
              </div>
              <div className="mt-2 text-xs font-mono text-zinc-800">{t}</div>
            </a>
          );
        })}
      </div>

      <div className="mt-6">
        <a href="/" className="text-sm underline">Back</a>
      </div>
    </main>
  );
}
