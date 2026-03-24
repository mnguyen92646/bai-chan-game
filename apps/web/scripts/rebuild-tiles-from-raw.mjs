import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const rawDir = path.resolve('public/tiles/png_raw_from_mockup');
const outDir = path.resolve('public/tiles/png');
await fs.mkdir(outDir, { recursive: true });

// Target canvas (2x). Keep consistent with UI sizing.
const CANVAS_W = 480;
const CANVAS_H = 640;

const files = (await fs.readdir(rawDir)).filter(f => f.endsWith('.png'));

for (const f of files) {
  const inPath = path.join(rawDir, f);
  const outPath = path.join(outDir, f);

  const buf = await fs.readFile(inPath);

  // Resize to fit canvas height with padding, preserving aspect ratio.
  const tile = sharp(buf).ensureAlpha();
  const resized = await tile
    .resize({ width: CANVAS_W, height: CANVAS_H, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await fs.writeFile(outPath, resized);
}

console.log(`Rebuilt ${files.length} tiles with padding into ${outDir}`);
