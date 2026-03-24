import { makeChanDeck, shuffle, type TileId } from "./chanDeck";
import type { GameState, PublicGameState, PrivateGameState, PlayerGameState } from "./types";
import { isWinningHand, groupKey } from "./win";

export function startGame(params: {
  players: Array<{ playerId: string; seat: number }>;
  dealerSeat: number;
}): { game: GameState; wall: TileId[] } {
  const deck = shuffle(makeChanDeck());

  const playersById: Record<string, PlayerGameState> = {};

  // Deal: dealer 20, others 19
  // We deal by seat order starting at dealer for simplicity.
  const ordered = params.players.slice().sort((a, b) => a.seat - b.seat);
  const dealerIndex = ordered.findIndex(p => p.seat === params.dealerSeat);
  const dealOrder = dealerIndex >= 0 ? [...ordered.slice(dealerIndex), ...ordered.slice(0, dealerIndex)] : ordered;

  for (const p of dealOrder) {
    const count = p.seat === params.dealerSeat ? 20 : 19;
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
    turnSeat: params.dealerSeat,
    awaiting: "discard",
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

    // Vinagames: if you previously discarded this tile, you may not eat it later.
    if (p.rules.cannotEatTiles.includes(discardTile)) {
      return { eligible: false as const, reason: "cannot_eat_tile_you_discarded" as const };
    }

    const canChan = p.hand.includes(discardTile);

    const k = groupKey(discardTile);

    // Vinagames: "ăn chọn cạ" — if you already have a cạ in this rank-group, you may not ăn cạ in the same group.
    const distinctInGroup = Array.from(new Set(p.hand.filter(t => groupKey(t) === k)));
    const alreadyHasCaInGroup = distinctInGroup.length >= 2;

    // Vinagames: if you've discarded both sides of a cạ in this rank-group, you may not ăn cạ in this group later.
    const caBannedByHistory = p.rules.noCaGroups.includes(k);

    const caTiles = alreadyHasCaInGroup || caBannedByHistory
      ? ([] as TileId[])
      : (Array.from(new Set(p.hand.filter(t => groupKey(t) === k && t !== discardTile))) as TileId[]);

    if (!canChan && caTiles.length === 0) {
      return {
        eligible: false as const,
        reason: alreadyHasCaInGroup
          ? ("already_has_ca_in_group" as const)
          : caBannedByHistory
            ? ("ca_banned_by_discard_history" as const)
            : ("no_match" as const)
      };
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
