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
  /** Passed available Chắn: this exact face may not be discarded later in profile 3. */
  forbiddenDiscardTiles: TileId[];
  /** Passed an available Chắn: this exact face is blocked for future claims. */
  cannotEatTiles: TileId[];
  passedCaTiles?: TileId[];
  /** An explicit declined win bars winning on a later offered card. */
  declinedWin?: boolean;
  winForfeited?: boolean;

  /** After eating cạ, discarding both distinct faces of a compatible cạ is forbidden. */
  hasEatenCaEver: boolean;

  /** Track distinct discarded tiles by rank-group (groupKey). */
  discardedByGroup: Record<string, TileId[]>;

  /** Reserved legacy field; additional bans after discarding a cạ remain disputed and are not enforced. */
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
  isBot?: boolean;
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

export type Awaiting = "opening_discard" | "draw" | "reactions" | "discard" | "return" | "round_end";
export type Reaction = {
  source: "wall" | "discard" | "return";
  ownerSeat: number;
  queue: { playerId: string; kind: "win" | "chiu" }[];
};
/** Public presentation metadata only; physical cards remain in player.discards. */
export type TableCard = {
  id: string;
  tile: TileId;
  gateSeat: number;
  source: "wall" | "discard" | "return" | "unknown";
  sourceSeat: number;
  passedBy: number[];
};
export type RuleProfile = {
  version: 2 | 3 | 4;
  // Unresolved choices stay explicit rather than changing with a new client.
  fivePlayerOpeningBonus: boolean;
  allowYeuWin: boolean;
  allowReturnClaims: boolean;
};
export type GameState = {
  handId: string;
  revision: number;
  profile: RuleProfile;
  reaction?: Reaction;
  tableCards?: TableCard[];
  activeCardId?: string;
  returnSeat?: number;
  chiuWinTile?: TileId;
  endReason?: "win" | "wall_empty";

  phase: "lobby" | "playing";
  /** Accepted winner; concealed tiles become public after the hand ends. */
  winnerSeat?: number;
  dealerSeat: number;
  turnSeat: number;
  // Explicit opening, public-reaction, return and terminal phases.
  awaiting: Awaiting;
  wallCount: number;
  lastDiscard: null | { tile: TileId; fromPlayerId: string };
  players: Record<string, PlayerGameState>;
};

export type PublicGameState = {
  handId: string;
  revision: number;
  source?: Reaction["source"];
  responseSeat?: number;
  gateSeat?: number;
  tableCards?: TableCard[];
  activeCardId?: string;
  returnSeat?: number;
  endReason?: "win" | "wall_empty";

  phase: "lobby" | "playing";
  /** Accepted winner; concealed tiles become public after the hand ends. */
  winnerSeat?: number;
  dealerSeat: number;
  turnSeat: number;
  awaiting: Awaiting;
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
  canChiu?: boolean;
  canRespond?: boolean;
  canPass?: boolean;
  discardTiles?: TileId[];
  discardReasons?: Partial<Record<TileId, string>>;
  winForfeited?: boolean;
  passWinForfeits?: boolean;

  /**
   * Back-compat boolean used by early UI/bots.
   * True iff there is at least one legal "ăn" action now.
   */
  canAn?: boolean;

  /** Family-rules ăn options from the current lastDiscard (if any). */
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
          | "bo_an_pass_penalty";
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
