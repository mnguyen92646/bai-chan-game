import type { GameState, TableCard } from "./types";

/** Older saved hands have no provenance: show their cards without guessing how they arrived. */
export function tableCardsView(g: GameState): { cards: TableCard[]; activeCardId?: string } {
  const players = Object.values(g.players).sort((a,b) => a.seat - b.seat);
  if (g.tableCards && g.tableCards.length === players.reduce((n,p) => n + p.discards.length, 0))
    return { cards: g.tableCards, activeCardId: g.activeCardId };
  let activeCardId: string | undefined;
  const cards = players.flatMap((p,i) => p.discards.map((tile,index): TableCard => {
    const id = `${g.handId}:legacy:${p.seat}:${index}`;
    const active = !!g.reaction && g.lastDiscard?.fromPlayerId === p.playerId && index === p.discards.length - 1;
    if (active) activeCardId = id;
    return { id, tile, gateSeat: active ? g.reaction!.ownerSeat : players[(i+1)%players.length].seat,
      source: "unknown", sourceSeat: p.seat, passedBy: [] };
  }));
  return { cards, activeCardId };
}

export function initializeTableCards(g: GameState) {
  const view = tableCardsView(g);
  g.tableCards = view.cards;
  g.activeCardId = view.activeCardId;
}

export function passTableCard(g: GameState, seat: number, nextGate?: number) {
  const card = g.tableCards?.find(c => c.id === g.activeCardId);
  if (!card) return;
  if (!card.passedBy.includes(seat)) card.passedBy.push(seat);
  if (nextGate !== undefined) card.gateSeat = nextGate;
}
