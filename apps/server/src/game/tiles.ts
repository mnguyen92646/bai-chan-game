export type Suit = "van" | "sach" | "van" | "w";

// Placeholder: we'll replace with proper Chắn tile taxonomy after rules research.
// For now, represent a tile as a string id.
export type TileId = string;

export function makeDeck(): TileId[] {
  // TODO: real Chắn deck
  const ids: TileId[] = [];
  for (let i = 1; i <= 100; i++) ids.push(`T${i}`);
  return ids;
}

export function shuffle<T>(arr: T[], rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
