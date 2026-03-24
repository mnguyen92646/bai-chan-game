import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const inDir = path.resolve('public/tiles/svg');
const outDir = path.resolve('public/tiles/png');
await fs.mkdir(outDir, { recursive: true });

// Render settings
const width = 240; // base width
const height = 320;
const scale = Number(process.env.SCALE ?? 2); // 2x for retina

const files = (await fs.readdir(inDir)).filter(f => f.endsWith('.svg'));

for (const f of files) {
  const inPath = path.join(inDir, f);
  const outPath = path.join(outDir, f.replace(/\.svg$/i, '.png'));

  const buf = await fs.readFile(inPath);

  // Note: sharp renders SVG; we also explicitly resize to desired output.
  await sharp(buf, { density: 300 })
    .resize(width * scale, height * scale)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath);
}

console.log(`Rendered ${files.length} PNGs to ${outDir} at ${scale}x (${width*scale}x${height*scale})`);
