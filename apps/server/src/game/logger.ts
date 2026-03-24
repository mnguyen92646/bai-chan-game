import fs from "node:fs";
import path from "node:path";

export type GameLogger = {
  filePath: string;
  buffer: string[];
  maxBuffer: number;
};

export function newLogger(params: { logsDir: string; roomId: string; gameId: string; maxBuffer?: number }): GameLogger {
  const filePath = path.join(params.logsDir, `room-${params.roomId}-game-${params.gameId}.log`);
  return { filePath, buffer: [], maxBuffer: params.maxBuffer ?? 200 };
}

export function logLine(logger: GameLogger, line: string) {
  const ts = new Date().toISOString();
  const full = `${ts} ${line}`;
  logger.buffer.push(full);
  if (logger.buffer.length > logger.maxBuffer) {
    logger.buffer.splice(0, logger.buffer.length - logger.maxBuffer);
  }
  fs.appendFileSync(logger.filePath, full + "\n");
}
