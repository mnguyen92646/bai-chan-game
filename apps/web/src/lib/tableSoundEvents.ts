import type { PublicGameState } from "../../../../packages/game/src/types";

export type TableSoundEvent = {
  kind: "draw" | "discard" | "an" | "chiu" | "win" | "chiu-win";
  seat: number;
  tile?: string;
  voice?: TableVoice;
};
export type TableVoice = "male" | "female";

export function voicedEvent(event: TableSoundEvent, voices: Partial<Record<number, TableVoice>>): TableSoundEvent {
  return { ...event, voice: voices[event.seat] ?? "male" };
}

/** Only consecutive, accepted public state changes make sound. Never inspect a private hand. */
export function tableSoundEvent(previous: PublicGameState | undefined, next: PublicGameState): TableSoundEvent | undefined {
  if (!previous || previous.handId !== next.handId || next.revision !== previous.revision + 1 || previous.phase !== "playing") return;
  if (next.endReason === "win" && next.winnerSeat !== undefined) {
    const before = previous.players.find(p => p.seat === next.winnerSeat);
    const after = next.players.find(p => p.seat === next.winnerSeat);
    const added = before && after?.melds[before.melds.length];
    const chiu = added?.type === "chiu" ||
      (["discard", "return"].includes(previous.awaiting) && before?.melds.at(-1)?.type === "chiu");
    return { kind: chiu ? "chiu-win" : "win", seat: next.winnerSeat };
  }
  for (const p of next.players) {
    const before = previous.players.find(old => old.playerId === p.playerId);
    if (before && p.melds.length === before.melds.length + 1) {
      const meld = p.melds.at(-1)!;
      return { kind: meld.type === "chiu" ? "chiu" : "an", seat: p.seat, tile: previous.lastDiscard?.tile };
    }
  }
  if (next.wallCount === previous.wallCount - 1 && next.source === "wall")
    return { kind: "draw", seat: previous.turnSeat, tile: next.lastDiscard?.tile };
  if (["opening_discard", "discard", "return"].includes(previous.awaiting) && next.lastDiscard)
    return { kind: "discard", seat: previous.turnSeat, tile: next.lastDiscard.tile };
}

export type SoundMode = "off" | "effects" | "calls" | "cards";
export type VoicePack = "edge" | "google" | "mac" | "previous";
export type SoundPreferences = { mode: SoundMode; volume: number; voicePack?: VoicePack };
export const defaultSoundPreferences: SoundPreferences = { mode: "calls", volume: 0.65 };
export function readSoundPreferences(raw: string | null): SoundPreferences {
  try {
    const parsed = JSON.parse(raw ?? "null");
    if (parsed && ["off", "effects", "calls", "cards"].includes(parsed.mode)) {
      return { ...(["edge", "google", "mac", "previous"].includes(parsed.voicePack) ? { voicePack: parsed.voicePack as VoicePack } : {}), mode: parsed.mode, volume: typeof parsed.volume === "number" && Number.isFinite(parsed.volume) ? Math.min(1, Math.max(0, parsed.volume)) : 0.65 };
    }
  } catch {}
  return defaultSoundPreferences;
}

export function voiceClips(event: TableSoundEvent, mode: SoundMode): string[] {
  if (mode !== "calls" && mode !== "cards") return [];
  if (event.kind === "discard") return [];
  if (event.kind === "draw") return ["boc"];
  const clips = [event.kind];
  // Card names describe the claimed public card, not an inferred private combination.
  if (mode === "cards" && event.tile && /^(?:[1-9]_(?:van|vanh|sach)|chi|lao|thang)$/.test(event.tile))
    return [...clips, `card-${event.tile}`];
  return clips;
}
