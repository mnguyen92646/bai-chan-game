import fs from "node:fs";
import path from "node:path";

export type PrivateGameLog = {
  filePath: string;
};

export function newPrivateLog(params: { logsDir: string; roomId: string; gameId: string }): PrivateGameLog {
  const dir = path.join(params.logsDir, "private");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `room-${params.roomId}-game-${params.gameId}.jsonl`);
  return { filePath };
}

export function logJsonl(log: PrivateGameLog, obj: unknown) {
  const ts = new Date().toISOString();
  const line = JSON.stringify({ ts, ...((obj as any) ?? {}) });
  fs.appendFileSync(log.filePath, line + "\n");
}
