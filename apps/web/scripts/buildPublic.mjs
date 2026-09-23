import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const releaseEnv = new URL("../.env.release.local", import.meta.url);
if (existsSync(releaseEnv)) process.loadEnvFile(releaseEnv);

const serverUrl = process.env.PLAY_SERVER_URL;
if (!serverUrl) throw new Error("Set PLAY_SERVER_URL to the room Worker URL before building the public game.");
const parsed = new URL(serverUrl);
if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
  throw new Error("The public room server must use HTTPS.");
}
if (parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error("PLAY_SERVER_URL must be the room Worker origin.");

const env = {
  ...process.env,
  NEXT_PUBLIC_SERVER_URL: parsed.origin,
  NEXT_PUBLIC_TABLE_TRANSPORT: "worker",
};
for (const command of [["run", "gen:buildinfo"], ["run", "build:vinext"], ["run", "copy:public-assets"], ["run", "bundle:monitor"]]) {
  const result = spawnSync("npm", command, { stdio: "inherit", cwd: new URL("..", import.meta.url), env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
