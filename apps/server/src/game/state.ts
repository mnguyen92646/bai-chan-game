import type { TileId } from "./tiles";

export type PlayerState = {
  playerId: string;
  seat: number;
  hand: TileId[];
  discards: TileId[];
};

export type GameState = {
  phase: "lobby" | "playing";
  turnSeat: number;
  wall: TileId[];
  players: Record<string, PlayerState>;
};
