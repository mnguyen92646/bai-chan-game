export type TileId =
  | "chi"
  | "lao"
  | "thang"
  | `${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}_${"van" | "vanh" | "sach"}`;

export const SUITS = ["van", "vanh", "sach"] as const;

export function makeChanDeck(): TileId[] {
  const deck: TileId[] = [];
  // TEMP: keep the existing 100-tile deck behavior until we finalize your 120-tile family deck.
  // (We still add types/assets for Nhất/Yêu matching & future deck changes.)
  for (let i = 0; i < 4; i++) deck.push("chi");
  for (let r: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 2; r <= 9; r = (r + 1) as any) {
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
