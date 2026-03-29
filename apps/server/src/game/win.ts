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

function requiredPairsForHandSize(n: number): number | null {
  // Family table (120-card deck) uses different hand sizes depending on player count.
  // We model Ù as:
  // - N pairs (chắn = 2 identical) plus
  // - the remaining tiles partition into groups of 4 that are "round" (same groupKey category).
  //
  // From Michael’s notes:
  // - 5 players: win requires 8 pairs at 20 tiles (after draw)
  // For 4 players we choose the most logical extension that keeps the structure the same:
  // - 4 players: 24 tiles (after draw) => 10 pairs + 1 round group of 4.
  if (n === 20) return 8;
  if (n === 24) return 10;
  return null;
}

function canPartitionIntoRoundGroups(tiles: TileId[]): boolean {
  // A "round" group is 4 tiles all compatible by category (groupKey).
  if (tiles.length % 4 !== 0) return false;

  const counts = new Map<string, number>();
  for (const t of tiles) {
    const k = groupKey(t);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const [, c] of counts) {
    if (c % 4 !== 0) return false;
  }
  return true;
}

export function isWinningHand(hand: TileId[]): boolean {
  const neededPairs = requiredPairsForHandSize(hand.length);
  if (!neededPairs) return false;

  // Count exact tiles
  const byTile = new Map<TileId, number>();
  for (const t of hand) byTile.set(t, (byTile.get(t) ?? 0) + 1);

  const tileIds = Array.from(byTile.keys()).sort();

  // Backtracking: choose which exact pairs to take (matters when counts >= 4)
  function dfs(idx: number, pairsTaken: number, remaining: Map<TileId, number>): boolean {
    if (pairsTaken === neededPairs) {
      // Build remaining tiles array
      const rest: TileId[] = [];
      for (const [t, c] of remaining) {
        for (let i = 0; i < c; i++) rest.push(t);
      }
      return canPartitionIntoRoundGroups(rest);
    }
    if (idx >= tileIds.length) return false;

    const t = tileIds[idx];
    const c = remaining.get(t) ?? 0;

    // Option 1: take a pair of this tile (if available)
    if (c >= 2) {
      remaining.set(t, c - 2);
      if (dfs(idx, pairsTaken + 1, remaining)) return true;
      remaining.set(t, c);
    }

    // Option 2: skip to next tile
    return dfs(idx + 1, pairsTaken, remaining);
  }

  return dfs(0, 0, new Map(byTile));
}
