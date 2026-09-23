import type { TileId } from "./chanDeck";
import type { Meld } from "./types";

// Family evaluator: complete pairs, minimum 6/8 Chắn at 20/24 cards.
// Concealed pairs count without being exposed through Ăn.
// Special matching group (family rules):
// "Special 6" are all mutually matchable with each other:
// - Nhất: 1_van, 1_vanh, 1_sach
// - Yêu: lao, chi, thang

export function groupKey(t: TileId): string {
  // Yêu tiles
  if (t === "chi" || t === "lao" || t === "thang") return "SPECIAL6";

  const m = String(t).match(/^(\d)_(van|vanh|sach)$/);
  if (!m) return `OTHER:${t}`;
  const rank = Number(m[1]);
  if (rank === 1) return "SPECIAL6";
  return `RANK:${rank}`;
}

/** All exposed melds stay locked; search only the concealed cards. */
export function isWinningHand(hand: TileId[], melds: Meld[] = []): boolean {
  const total = hand.length + melds.reduce((n, m) => n + (m.type === "chiu" ? 4 : 2), 0);
  const minimum = total === 24 ? 8 : total === 20 ? 6 : null;
  if (minimum === null) return false;
  let lockedChan = 0;
  for (const meld of melds) {
    if (meld.type === "chiu") lockedChan += 2;
    else if (meld.kind === "chan") {
      if (meld.tiles[0] !== meld.tiles[1]) return false;
      lockedChan++;
    } else if (meld.tiles[0] === meld.tiles[1] || groupKey(meld.tiles[0]) !== groupKey(meld.tiles[1])) return false;
  }
  const counts = new Map<TileId, number>();
  for (const tile of hand) counts.set(tile, (counts.get(tile) ?? 0) + 1);
  const ids = [...counts.keys()].sort();
  const memo = new Map<string, number>();
  function best(): number {
    const key = ids.map(id => counts.get(id) ?? 0).join(",");
    if (memo.has(key)) return memo.get(key)!;
    const first = ids.find(id => counts.get(id)! > 0);
    if (!first) return 0;
    counts.set(first, counts.get(first)! - 1);
    let result = -Infinity;
    for (const mate of ids) {
      if (!counts.get(mate) || groupKey(first) !== groupKey(mate)) continue;
      counts.set(mate, counts.get(mate)! - 1);
      result = Math.max(result, best() + (first === mate ? 1 : 0));
      counts.set(mate, counts.get(mate)! + 1);
    }
    counts.set(first, counts.get(first)! + 1);
    memo.set(key, result);
    return result;
  }
  return lockedChan + best() >= minimum;
}
