import type { TileId } from "./chanDeck";

export function countInHand(hand: TileId[], tile: TileId) {
  let c = 0;
  for (const t of hand) if (t === tile) c++;
  return c;
}
