import type { TileId } from "./chanDeck";

// Family rules (current):
// - Win check is ONLY for a 20-tile hand (right after drawing)
// - Win if the 20 tiles can be partitioned into 5 groups of 4.
// - A "group of 4" is 4 tiles that are all mutually matchable.
//   We model matchability via a groupKey:
//     - Normal tiles match by column (rank): all 1s together, all 2s together, etc.
//     - Special six (house rule) are all in one group, and can mix.
//
// Special matching group (family rules):
// "Special 6" are all mutually matchable with each other:
// - Nhất: 1_van, 1_vanh, 1_sach
// - Yêu: lao, chi, thang

export function groupKey(t: TileId): string {
  // Yêu tiles
  if (t === "chi" || (t as any) === "lao" || (t as any) === "thang") return "SPECIAL6";

  const m = String(t).match(/^(\d)_(van|vanh|sach)$/);
  if (!m) return `OTHER:${t}`;
  const rank = Number(m[1]);
  if (rank === 1) return "SPECIAL6";
  return `RANK:${rank}`;
}

export function isWinningHand(hand: TileId[]): boolean {
  if (hand.length !== 20) return false;

  const counts = new Map<string, number>();
  for (const t of hand) {
    const k = groupKey(t);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  // Since every tile belongs to exactly one key in this model, the hand is winnable
  // iff every bucket count is divisible by 4.
  for (const [, c] of counts) {
    if (c % 4 !== 0) return false;
  }
  return true;
}
