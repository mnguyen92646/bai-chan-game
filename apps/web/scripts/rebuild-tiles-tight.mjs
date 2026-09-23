import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Source: pre-classified, high-resolution card crops.
const source = process.argv[2] ?? process.env.BAI_CHAN_SOURCE_TILES_DIR;
if (!source) throw new Error('Pass the card crop directory as an argument or set BAI_CHAN_SOURCE_TILES_DIR.');
const srcDir = path.resolve(source);
const outDir = path.resolve('public/tiles/png');
await fs.mkdir(outDir, { recursive: true });

// Target size: long/thin but not huge. Keep small for filesize.
// (These render into a box; scaling up in CSS is fine.)
const W = 120;
const H = 480; // 1:4

async function writeTile(srcPath, outPath) {
  const buf = await fs.readFile(srcPath);
  // Resize to fill the target (no padding). This keeps the tile art big.
  await sharp(buf)
    .resize(W, H, { fit: 'fill' })
    .png({ compressionLevel: 9, palette: true })
    .toFile(outPath);
}

// chi
await writeTile(path.join(srcDir, 'vanh_chi.png'), path.join(outDir, 'chi.png'));

const suits = ['van', 'vanh', 'sach'];
const ranks = [1,2,3,4,5,6,7,8,9];
const rankNames = {
  1:'nhat',2:'nhi',3:'tam',4:'tu',5:'ngu',6:'luc',7:'that',8:'bat',9:'cuu'
};

for (const r of ranks) {
  for (const s of suits) {
    const src = path.join(srcDir, `${s}_${rankNames[r]}.png`);
    const out = path.join(outDir, `${r}_${s}.png`);
    await writeTile(src, out);
  }
}

console.log('Rebuilt tight tiles into', outDir);
