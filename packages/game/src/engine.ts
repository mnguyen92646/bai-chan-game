import { makeChanDeck, shuffle, type TileId } from "./chanDeck";
import type { GameState, PublicGameState, PrivateGameState, PlayerGameState, RuleProfile } from "./types";
import { isWinningHand, groupKey } from "./win";
import { tableCardsView } from "./tableCards";

// Version 4 permits odd-card special cạ, but not as the completing win pair.
export const defaultProfile: RuleProfile = { version: 4, fivePlayerOpeningBonus: true, allowYeuWin: false, allowReturnClaims: true };
export function seats(game: GameState) { return Object.values(game.players).sort((a, b) => a.seat - b.seat); }
export function nextSeat(game: GameState, seat: number) {
  const order = seats(game); return order[(order.findIndex(p => p.seat === seat) + 1) % order.length].seat;
}
export function nextDealerSeat(previous: GameState | undefined, players: Array<{seat: number}>, fallback: number) {
  const winner = previous?.winnerSeat;
  return previous?.endReason === "win" && winner !== undefined && players.some(p => p.seat === winner) ? winner : fallback;
}
export function discardReason(g: GameState, p: PlayerGameState, tile: TileId): string | undefined {
  if (g.profile.version < 3) return undefined;
  if (p.rules.forbiddenDiscardTiles.includes(tile)) return "You passed a Chắn on this card and cannot discard it.";
  if (p.rules.hasEatenCaEver && (p.rules.discardedByGroup[groupKey(tile)] ?? []).some(t => t !== tile))
    return "After eating cạ, you cannot discard both sides of a cạ.";
  return undefined;
}
export function legalDiscards(g: GameState, p: PlayerGameState): TileId[] {
  return [...new Set(p.hand)].filter(t => !discardReason(g,p,t));
}
function afterClaim(g: GameState, p: PlayerGameState, tile: TileId, count: number, ca = false): boolean {
  const hand = p.hand.slice();
  for (let i=0;i<count;i++) { const index=hand.indexOf(tile); if(index<0)return false; hand.splice(index,1); }
  return legalDiscards(g,{...p,hand,rules:{...p.rules,hasEatenCaEver:p.rules.hasEatenCaEver || ca}}).length > 0;
}
export function canFinishChiu(g: GameState, id: string): boolean {
  const p=g.players[id],tile=g.lastDiscard?.tile;
  return !!p && !!tile && afterClaim(g,p,tile,3);
}
export function startGame(params: { players: Array<{ playerId: string; seat: number }>; dealerSeat: number; profile?: RuleProfile }): { game: GameState; wall: TileId[] } {
  if (![4, 5].includes(params.players.length)) throw new Error("A table needs four or five players");
  if (new Set(params.players.map(p => p.seat)).size !== params.players.length || new Set(params.players.map(p => p.playerId)).size !== params.players.length || !params.players.some(p => p.seat === params.dealerSeat)) throw new Error("Invalid seats");
  const profile = { ...(params.profile ?? defaultProfile) };
  const deck = shuffle(makeChanDeck());
  const players: Record<string, PlayerGameState> = {};
  const bonus = params.players.length === 4 || profile.fivePlayerOpeningBonus;
  for (const p of params.players.slice().sort((a,b) => a.seat-b.seat)) {
    const count = (params.players.length === 4 ? 23 : 19) + (bonus && p.seat === params.dealerSeat ? 1 : 0);
    players[p.playerId] = { ...p, hand: deck.splice(0, count), discards: [], melds: [], rules: {
      forbiddenDiscardTiles: [], cannotEatTiles: [], passedCaTiles: [], hasEatenCaEver: false, discardedByGroup: {}, noCaGroups: [],
    } };
  }
  return { game: { handId: `${Date.now()}-${Math.random().toString(36).slice(2)}`, revision: 0, profile, phase: "playing", dealerSeat: params.dealerSeat, turnSeat: params.dealerSeat, awaiting: bonus ? "opening_discard" : "draw", wallCount: deck.length, lastDiscard: null, players }, wall: deck };
}
export function responsePlayer(game: GameState): string | undefined {
  if (game.awaiting !== "reactions") return undefined;
  return game.reaction?.queue[0]?.playerId ?? seats(game).find(p => p.seat === game.reaction?.ownerSeat)?.playerId;
}
export function canChiuCard(g: GameState, id: string): boolean {
  const p = g.players[id], d = g.lastDiscard;
  return !!p && !!d && !!g.reaction && (g.reaction.source !== "return" || g.profile.allowReturnClaims) &&
    (g.reaction.source === "wall" || d.fromPlayerId !== id) && !p.rules.cannotEatTiles.includes(d.tile) && p.hand.filter(t => t === d.tile).length === 3;
}
export function canWinCard(g: GameState, id: string): boolean {
  const p = g.players[id], d = g.lastDiscard;
  if (!p || !d || !g.reaction) return false;
  if (g.profile.version >= 3 && p.rules.winForfeited) return false;
  if (!g.profile.allowYeuWin && ["chi", "lao", "thang"].includes(d.tile)) return false;
  if (g.reaction.source !== "wall" && !canChiuCard(g, id)) return false;
  const expected = Object.keys(g.players).length === 4 ? 24 : 20;
  const total = p.hand.length + p.melds.reduce((n,m) => n + (m.type === "chiu" ? 4 : 2), 0) + 1;
  if (total !== expected) return false;
  if (g.profile.version >= 4 && groupKey(d.tile) === "SPECIAL6") {
    // The incoming card must complete an exact pair, not round out special cạ.
    // Lock that pair before evaluating: a different rearrangement must not let
    // the winning card sneak back into a mixed Nhất/Yêu pair.
    const mate = p.hand.indexOf(d.tile);
    if (mate < 0) return false;
    const remaining = p.hand.slice(); remaining.splice(mate, 1);
    return isWinningHand(remaining, [...p.melds, { type: "an", kind: "chan", tiles: [d.tile, d.tile], fromSeat: p.seat }]);
  }
  return isWinningHand([...p.hand, d.tile], p.melds);
}
export function anOptions(g: GameState, id: string): PrivateGameState["an"] {
  const p = g.players[id], d = g.lastDiscard;
  if (g.phase !== "playing") return { eligible: false, reason: "not_playing" };
  if (!d) return { eligible: false, reason: "no_last_discard" };
  if (g.awaiting !== "reactions" || !g.reaction || g.reaction.queue.length) return { eligible: false, reason: "not_awaiting_draw" };
  if (!p || g.reaction.ownerSeat !== p.seat) return { eligible: false, reason: "not_your_turn" };
  if (g.reaction.source !== "wall" && d.fromPlayerId === id) return { eligible: false, reason: "discard_from_self" };
  if (p.rules.cannotEatTiles.includes(d.tile)) return { eligible: false, reason: "bo_an_pass_penalty" };
  if (g.profile.version >= 3 && Object.values(p.rules.discardedByGroup).some(tiles => tiles.includes(d.tile)))
    return { eligible: false, reason: "bo_an_pass_penalty" };
  if (p.hand.length < 2) return { eligible: false, reason: "no_match" };
  const hasChan = p.hand.includes(d.tile);
  const canChan = hasChan && afterClaim(g,p,d.tile,1);
  const caTiles = p.rules.passedCaTiles?.includes(d.tile) ? [] : [...new Set(p.hand.filter(t => t !== d.tile && groupKey(t) === groupKey(d.tile)))].filter(t =>
    // Do not split an existing cross-suit pair to eat another cạ of that group.
    (g.profile.version < 3 || (g.profile.version >= 4 && groupKey(t) === "SPECIAL6"
      // Preserve exact pairs; an odd-sized special group has one spare card
      // even when several different faces in it could form cạ with each other.
      ? p.hand.filter(other => groupKey(other) === "SPECIAL6").length % 2 === 1 && p.hand.filter(other => other === t).length % 2 === 1
      : !p.hand.some(other => other !== t && groupKey(other) === groupKey(t)))) && afterClaim(g,p,t,1,true));
  // Chắn preference remains the existing default while the family disagrees.
  if (hasChan && !canChan) return { eligible: false, reason: "no_match" };
  if (!canChan && !caTiles.length) return { eligible: false, reason: "no_match" };
  return { eligible: true, canChan, caTiles, mustPreferChan: canChan && caTiles.length > 0 };
}
export function toPrivateGameState(params: { game: GameState; playerId: string; lastDrawnTile?: TileId }): PrivateGameState | null {
  const g = params.game, p = g.players[params.playerId]; if (!p) return null;
  const responder = responsePlayer(g) === p.playerId;
  const priority = g.reaction?.queue[0]?.kind;
  const an = anOptions(g, p.playerId);
  const afterChiu = g.phase === "playing" && ["return", "discard"].includes(g.awaiting) && g.turnSeat === p.seat && !!g.chiuWinTile && (g.profile.allowYeuWin || !["chi", "lao", "thang"].includes(g.chiuWinTile));
  const openingWin = g.profile.version >= 3 && g.awaiting === "opening_discard" && g.turnSeat === p.seat && g.dealerSeat === p.seat;
  return { you: { playerId: p.playerId, seat: p.seat }, hand: p.hand, an, canAn: an?.eligible === true,
    canRespond: responder, canPass: responder,
    canChiu: responder && priority === "chiu" && canChiuCard(g, p.playerId) && canFinishChiu(g,p.playerId),
    canU: g.phase === "playing" && !(g.profile.version >= 3 && p.rules.winForfeited) && ((responder && priority === "win" && canWinCard(g, p.playerId)) || ((openingWin || afterChiu) && isWinningHand(p.hand, p.melds))),
    discardTiles: legalDiscards(g,p),
    discardReasons: Object.fromEntries([...new Set(p.hand)].flatMap(t => {const reason=discardReason(g,p,t);return reason?[[t,reason]]:[];})),
    winForfeited: g.profile.version >= 3 && !!p.rules.winForfeited,
    passWinForfeits: g.profile.version >= 3,
  };
}
export function toPublicGameState(params: { game: GameState; nicknamesById: Map<string,string>; connectedById: Map<string,boolean>; revealHands?: boolean }): PublicGameState {
  const g = params.game;
  const table = tableCardsView(g);
  return { handId: g.handId, revision: g.revision, phase: g.phase, winnerSeat: g.winnerSeat, dealerSeat: g.dealerSeat, turnSeat: g.turnSeat, awaiting: g.awaiting, wallCount: g.wallCount, source: g.reaction?.source, returnSeat: g.returnSeat, endReason: g.endReason,
    tableCards: table.cards.map(c => ({...c, passedBy: [...c.passedBy]})), activeCardId: table.activeCardId, gateSeat: g.reaction?.ownerSeat,
    responseSeat: g.players[responsePlayer(g) ?? ""]?.seat,
    lastDiscard: g.lastDiscard ? { tile: g.lastDiscard.tile, fromSeat: g.players[g.lastDiscard.fromPlayerId]?.seat ?? -1 } : null,
    players: seats(g).map(p => ({ playerId: p.playerId, seat: p.seat, nickname: params.nicknamesById.get(p.playerId) ?? p.playerId, connected: params.connectedById.get(p.playerId) ?? false, handCount: p.hand.length,
      hand: params.revealHands || (g.phase === "lobby" && g.winnerSeat === p.seat) ? p.hand.slice() : undefined, discards: p.discards, melds: p.melds })), revealHands: Boolean(params.revealHands) };
}
