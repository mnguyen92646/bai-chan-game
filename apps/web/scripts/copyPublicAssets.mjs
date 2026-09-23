import { copyFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public");
const destination = join(root, "dist", "client");
const allowedRoots = ["tiles/png", "tiles/svg", "audio"];

async function copyAllowed(folder, extension) {
  const entries = await readdir(join(source, folder), { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const child = join(folder, entry.name);
    if (entry.isDirectory()) await copyAllowed(child, extension);
    else if (entry.isFile() && entry.name.endsWith(extension)) {
      await mkdir(dirname(join(destination, child)), { recursive: true });
      await copyFile(join(source, child), join(destination, child));
    }
  }
}

for (const folder of allowedRoots) await copyAllowed(folder, folder === "audio" ? ".mp3" : folder === "tiles/png" ? ".png" : ".svg");
for (const file of ["tiles/back.png", "tiles/back.svg"]) {
  await mkdir(dirname(join(destination, file)), { recursive: true });
  await copyFile(join(source, file), join(destination, file));
}

async function assertNoPrivateFiles(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.name === "hoi-luat-chan.txt" || (entry.name.startsWith(".") && ![".assetsignore", ".vite"].includes(entry.name)))
      throw new Error(`Unexpected public asset: ${relative(destination, path)}`);
    if (entry.isDirectory()) await assertNoPrivateFiles(path);
    else if (!entry.isFile() || !(await stat(path)).size) throw new Error(`Invalid public asset: ${relative(destination, path)}`);
  }
}

await assertNoPrivateFiles(destination);

async function assertNoPrivateRoutes(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) await assertNoPrivateRoutes(path);
    else if (entry.isFile() && /\.(js|mjs)$/.test(entry.name)) {
      const body = await readFile(path, "utf8");
      if (/family-rules|rules-survey|hoi-luat-chan\.txt|SurveyWizard|SurveyRecorder/.test(body))
        throw new Error(`Private route included in public bundle: ${relative(root, path)}`);
    }
  }
}

await assertNoPrivateRoutes(join(root, "dist", "server"));
await assertNoPrivateRoutes(destination);
