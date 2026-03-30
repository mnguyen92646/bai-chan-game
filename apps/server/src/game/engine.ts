import { makeChanDeck, shuffle, type TileId } from "./chanDeck";
import type { GameState, PublicGameState, PrivateGameState, PlayerGameState } from "./types";
import { isWinningHand, groupKey } from "./win";

export function startGame(params: {
  players: Array<{ playerId: string; seat: number }>;
  dealerSeat: number;
}): { game: GameState; wall: TileId[] } {
  const deck = shuffle(makeChanDeck());

  const playersById: Record<string, PlayerGameState> = {};

  // Family table (120-card deck):
  // - 5 players: everyone starts with 19; nọc (wall) = 25
  // - 4 players: everyone starts with 23; nọc (wall) = 28
  // No dealer bonus tile on the initial deal.
  const ordered = params.players.slice().sort((a, b) => a.seat - b.seat);

  const nPlayers = params.players.length;
  const base = nPlayers === 4 ? 23 : 19;

  for (const p of ordered) {
    const count = base;
    playersById[p.playerId] = {
      playerId: p.playerId,
      seat: p.seat,
      hand: [],
      discards: [],
      melds: [],
      rules: {
        forbiddenDiscardTiles: [],
        cannotEatTiles: [],
        hasEatenCaEver: false,
        discardedByGroup: {},
        noCaGroups: []
      }
    };
    playersById[p.playerId].hand = deck.splice(0, count) as TileId[];
  }

  const game: GameState = {
    phase: "playing",
    dealerSeat: params.dealerSeat,
    // Family rules: first player must draw.
    turnSeat: params.dealerSeat,
    awaiting: "draw",
    wallCount: deck.length,
    lastDiscard: null,
    players: playersById
  };

  return { game, wall: deck };
}

export function toPublicGameState(params: {
  game: GameState;
  nicknamesById: Map<string, string>;
  connectedById: Map<string, boolean>;
  revealHands?: boolean;
}): PublicGameState {
  const { game } = params;
  const players = Object.values(game.players)
    .map(p => {
      const nickname = params.nicknamesById.get(p.playerId) ?? p.playerId;
      const connected = params.connectedById.get(p.playerId) ?? false;
      return {
        playerId: p.playerId,
        seat: p.seat,
        nickname,
        connected,
        handCount: p.hand.length,
        hand: params.revealHands ? p.hand : undefined,
        discards: p.discards,
        melds: p.melds
      };
    })
    .sort((a, b) => a.seat - b.seat);

  const lastDiscard = game.lastDiscard
    ? { tile: game.lastDiscard.tile, fromSeat: game.players[game.lastDiscard.fromPlayerId]?.seat ?? -1 }
    : null;

  return {
    phase: game.phase,
    dealerSeat: game.dealerSeat,
    turnSeat: game.turnSeat,
    awaiting: game.awaiting,
    wallCount: game.wallCount,
    lastDiscard,
    players,
    revealHands: Boolean(params.revealHands)
  };
}

export function toPrivateGameState(params: {
  game: GameState;
  playerId: string;
  lastDrawnTile?: TileId;
}): PrivateGameState | null {
  const g = params.game;
  const p = g.players[params.playerId];
  if (!p) return null;

  const an = (() => {
    if (g.phase !== "playing") return { eligible: false as const, reason: "not_playing" as const };
    const ld = g.lastDiscard;
    if (!ld) return { eligible: false as const, reason: "no_last_discard" as const };
    if (ld.fromPlayerId === p.playerId) return { eligible: false as const, reason: "discard_from_self" as const };
    if (g.awaiting !== "draw") return { eligible: false as const, reason: "not_awaiting_draw" as const };
    if (g.turnSeat !== p.seat) return { eligible: false as const, reason: "not_your_turn" as const };

    const discardTile = ld.tile;

    // Family rules: do NOT block eating due to your own discard history.
    // cannotEatTiles is used only for the "bỏ ăn" pass-penalty.
    if (p.rules.cannotEatTiles.includes(discardTile)) {
      return { eligible: false as const, reason: "bo_an_pass_penalty" as const };
    }

    const canChan = p.hand.includes(discardTile);

    const k = groupKey(discardTile);

    // Family rules: ăn cạ is allowed whenever you have any compatible tile in the same rank-group.
    const caTiles = Array.from(new Set(p.hand.filter(t => groupKey(t) === k && t !== discardTile))) as TileId[];

    if (!canChan && caTiles.length === 0) {
      return { eligible: false as const, reason: "no_match" as const };
    }

    return {
      eligible: true as const,
      canChan,
      caTiles,
      mustPreferChan: canChan && caTiles.length > 0
    } as const;
  })();

  const canAn = an.eligible === true;

  return {
    you: { playerId: p.playerId, seat: p.seat },
    hand: p.hand,
    lastDrawnTile: params.lastDrawnTile,
    canU: isWinningHand(p.hand),
    canAn,
    an
  };
}
