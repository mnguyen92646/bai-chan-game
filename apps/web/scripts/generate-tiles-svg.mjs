import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('public/tiles/svg');
await fs.mkdir(outDir, { recursive: true });

// Minimal, original tile design. Uses system fonts; you can later switch to embedded fonts.
// We intentionally do NOT copy any specific commercial deck artwork.

const TILE_W = 240;
const TILE_H = 320;

function tileSvg({ code, suitLabel, rankLabel, accent }) {
  const bg = '#f7f2e8';
  const border = '#3a2e2a';
  const accentColor = accent ?? '#c1121f';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_W}" height="${TILE_H}" viewBox="0 0 ${TILE_W} ${TILE_H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.8"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.08"/>
    </linearGradient>
  </defs>
  <rect x="10" y="10" rx="22" ry="22" width="${TILE_W - 20}" height="${TILE_H - 20}" fill="${bg}" stroke="${border}" stroke-width="6"/>
  <rect x="18" y="18" rx="18" ry="18" width="${TILE_W - 36}" height="${TILE_H - 36}" fill="url(#g)" opacity="0.55"/>

  <text x="24" y="44" font-family="ui-serif, 'Noto Serif CJK SC', 'Noto Serif', serif" font-size="22" fill="${border}" opacity="0.9">${code}</text>

  <text x="${TILE_W / 2}" y="160" text-anchor="middle"
        font-family="ui-serif, 'Noto Serif CJK SC', 'Noto Serif', serif" font-size="96" fill="${accentColor}">${rankLabel}</text>

  <text x="${TILE_W / 2}" y="220" text-anchor="middle"
        font-family="ui-sans-serif, system-ui, -apple-system" font-size="28" fill="${border}" opacity="0.9">${suitLabel}</text>

  <text x="${TILE_W / 2}" y="292" text-anchor="middle"
        font-family="ui-sans-serif, system-ui, -apple-system" font-size="18" fill="${border}" opacity="0.65">Bài Chắn</text>
</svg>`;
}

function write(name, svg) {
  return fs.writeFile(path.join(outDir, name), svg, 'utf8');
}

// Tile ids (engine naming): chi, then rank2-9 x suits.
const suits = [
  { id: 'van', label: 'Vạn' },
  { id: 'vanh', label: 'Văn' },
  { id: 'sach', label: 'Sách' }
];

const jobs = [];

// Chi Chi (special)
jobs.push(write('chi.svg', tileSvg({ code: 'CHI', suitLabel: 'Chi Chi', rankLabel: 'Chi', accent: '#0b6e4f' })));

for (let r = 2; r <= 9; r++) {
  for (const s of suits) {
    const id = `${r}_${s.id}.svg`;
    // Accent: make "Văn" red-ish, "Sách" green-ish, "Vạn" black-ish for variety (original aesthetic)
    const accent = s.id === 'vanh' ? '#c1121f' : s.id === 'sach' ? '#0b6e4f' : '#111111';
    jobs.push(write(id, tileSvg({ code: `${r}-${s.label}`, suitLabel: s.label, rankLabel: String(r), accent })));
  }
}

await Promise.all(jobs);
console.log(`Wrote ${jobs.length} SVG templates to ${outDir}`);
