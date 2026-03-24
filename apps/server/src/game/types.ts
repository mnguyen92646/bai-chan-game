import type { TileId } from "./chanDeck";

export type Meld =
  | { type: "chiu"; tile: TileId }
  | {
      type: "an";
      kind: "chan" | "ca";
      // The 2-tile meld you formed, including the claimed discard.
      tiles: [TileId, TileId];
      fromSeat: number;
    };

export type PlayerRulesState = {
  /** Vinagames "bỏ ăn" rule: if you ate or passed on a tile, you may not discard that tile later. */
  forbiddenDiscardTiles: TileId[];
  /** Vinagames: if you have discarded a tile before, you may not eat that tile later. */
  cannotEatTiles: TileId[];

  /** If you have ever eaten a cạ, Vinagames forbids discarding both tiles of a cạ as trash later. */
  hasEatenCaEver: boolean;

  /** Track distinct discarded tiles by rank-group (groupKey). */
  discardedByGroup: Record<string, TileId[]>;

  /** If you have discarded both sides of a cạ in a rank-group, Vinagames: later you may not ăn cạ in that group (only ăn chắn). */
  noCaGroups: string[];
};

export type PlayerGameState = {
  playerId: string;
  seat: number;
  hand: TileId[];
  discards: TileId[];
  melds: Meld[];
  rules: PlayerRulesState;
};

export type PublicPlayerState = {
  playerId: string;
  seat: number;
  nickname: string;
  connected: boolean;
  handCount: number;
  // Debug/training mode only: reveal full hand to everyone.
  hand?: TileId[];
  discards: TileId[];
  melds: Meld[];
};

export type GameState = {
  phase: "lobby" | "playing";
  dealerSeat: number;
  turnSeat: number;
  // awaiting:
  // - draw: current turn player must draw (manual)
  // - discard: current turn player must discard
  awaiting: "draw" | "discard";
  wallCount: number;
  lastDiscard: null | { tile: TileId; fromPlayerId: string };
  players: Record<string, PlayerGameState>;
};

export type PublicGameState = {
  phase: "lobby" | "playing";
  dealerSeat: number;
  turnSeat: number;
  awaiting: "draw" | "discard";
  wallCount: number;
  lastDiscard: null | { tile: TileId; fromSeat: number };
  players: PublicPlayerState[];
  revealHands?: boolean;
};

export type PrivateGameState = {
  you: { playerId: string; seat: number };
  hand: TileId[];
  lastDrawnTile?: TileId;
  canU?: boolean;

  /**
   * Back-compat boolean used by early UI/bots.
   * True iff there is at least one legal "ăn" action now.
   */
  canAn?: boolean;

  /** Vinagames-style ăn options from the current lastDiscard (if any). */
  an?:
    | {
        eligible: false;
        reason:
          | "no_last_discard"
          | "not_your_turn"
          | "not_awaiting_draw"
          | "not_playing"
          | "discard_from_self"
          | "no_match"
          | "cannot_eat_tile_you_discarded"
          | "already_has_ca_in_group"
          | "ca_banned_by_discard_history";
      }
    | {
        eligible: true;
        // true if you can eat a chắn (exact tile)
        canChan: boolean;
        // tiles in hand that can be paired with discard to make a cạ (choose 1)
        caTiles: TileId[];
        // if canChan is true, Vinagames requires taking chan over ca.
        mustPreferChan: boolean;
      };
};
