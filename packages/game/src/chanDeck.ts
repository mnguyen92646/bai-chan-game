export type TileId =
  | "chi"
  | "lao"
  | "thang"
  | `${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}_${"van" | "vanh" | "sach"}`;

export const SUITS = ["van", "vanh", "sach"] as const;

export function makeChanDeck(): TileId[] {
  const deck: TileId[] = [];

  // Family rules: we play with the full 120-card Tổ Tôm-style deck:
  // - 30 distinct tile types × 4 copies each = 120 total.
  // - Normal tiles: ranks 2..9 across 3 suits (24 types)
  // - Special six ("SPECIAL6"): 1_van, 1_vanh, 1_sach, chi, lao, thang (6 types)
  // This matches our win-grouping model in win.ts (SPECIAL6 bucket + rank buckets).

  // Special six
  for (let i = 0; i < 4; i++) deck.push("chi");
  for (let i = 0; i < 4; i++) deck.push("lao");
  for (let i = 0; i < 4; i++) deck.push("thang");
  for (const s of SUITS) {
    const id = `1_${s}` as TileId;
    for (let i = 0; i < 4; i++) deck.push(id);
  }

  // Ranks 2..9
  for (let r = 2; r <= 9; r++) {
    for (const s of SUITS) {
      const id = `${r}_${s}` as TileId;
      for (let i = 0; i < 4; i++) deck.push(id);
    }
  }

  return deck;
}

export function shuffle<T>(arr: T[], rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
