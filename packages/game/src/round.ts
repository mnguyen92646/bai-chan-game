import type { TileId } from "./chanDeck";
import type { GameState, Reaction, TableCard } from "./types";
import { anOptions, canChiuCard, canFinishChiu, canWinCard, discardReason, nextSeat, responsePlayer, seats, toPrivateGameState } from "./engine";
import { groupKey } from "./win";
import { initializeTableCards, passTableCard } from "./tableCards";

export type Action = { type: "draw" | "pass" | "chiu" | "win" } | { type: "discard" | "an"; tile: TileId };
export type Round = { game: GameState; wall: TileId[]; log: string[]; result?: string };
function take(g: GameState) {
  const d = g.lastDiscard!;
  const pile = g.players[d.fromPlayerId].discards;
  if (pile[pile.length - 1] !== d.tile) throw new Error("Active card is missing from its public pile");
  g.tableCards = g.tableCards?.filter(c => c.id !== g.activeCardId);
  g.activeCardId = undefined;
  pile.pop(); g.lastDiscard = null; return d.tile;
}
function end(s: Round, winner?: string) {
  const g = s.game;
  g.phase = "lobby"; g.awaiting = "round_end"; g.endReason = winner ? "win" : "wall_empty";
  g.winnerSeat = winner ? g.players[winner].seat : undefined;
  g.reaction = undefined; g.returnSeat = undefined; g.chiuWinTile = undefined;
  g.activeCardId = undefined;
  s.result = winner ? `WIN:${winner}` : "The wall is empty. This hand is a draw.";
}
function ready(s: Round, seat: number) {
  s.game.turnSeat = seat; s.game.awaiting = "draw"; s.game.reaction = undefined; s.game.lastDiscard = null;
  s.game.activeCardId = undefined;
  if (!s.wall.length) end(s);
}
function offer(g: GameState, tile: TileId, fromId: string, owner: number, source: Reaction["source"], carried?: TableCard) {
  // Same-card claim timing stays unchanged; declining Ù forfeits later offers.
  if (g.profile.version >= 3) for (const p of Object.values(g.players)) {
    if (p.rules.declinedWin) p.rules.winForfeited = true;
  }
  g.lastDiscard = { tile, fromPlayerId: fromId };
  g.turnSeat = owner; g.awaiting = "reactions"; g.reaction = { source, ownerSeat: owner, queue: [] };
  const card: TableCard = carried ? {...carried, gateSeat: owner} : {
    id: `${g.handId}:${g.revision+1}`, tile, gateSeat: owner, source, sourceSeat: g.players[fromId].seat, passedBy: [],
  };
  (g.tableCards ??= []).push(card); g.activeCardId = card.id;
  // Agreed priority: wins before Chíu, then normal Ăn.
  // Equal-priority claims follow seat order starting at the offered card's gate.
  const order = seats(g); const i = order.findIndex(p => p.seat === owner);
  const ordered = [...order.slice(i), ...order.slice(0, i)];
  g.reaction.queue = [
    ...ordered.filter(p => canWinCard(g,p.playerId)).map(p => ({ playerId: p.playerId, kind: "win" as const })),
    ...ordered.filter(p => canChiuCard(g,p.playerId) && canFinishChiu(g,p.playerId)).map(p => ({ playerId: p.playerId, kind: "chiu" as const })),
  ];
}
/** Pure shared transition; rejected/stale actions do not mutate state. */
export function transition<T extends Round>(state: T, id: string, action: Action, revision = state.game.revision): T {
  if (state.game.phase !== "playing" || state.result || revision !== state.game.revision || !state.game.players[id]) return state;
  const s = structuredClone(state), g = s.game, p = g.players[id];
  initializeTableCards(g);
  const info = toPrivateGameState({ game: g, playerId: id })!;
  const acting = p.seat === g.turnSeat;
  let message = "";
  if (action.type === "draw") {
    if (!acting || g.awaiting !== "draw") return state;
    if (!s.wall.length) end(s);
    else {
      const tile = s.wall.shift()!; g.wallCount = s.wall.length;
      p.discards.push(tile); offer(g,tile,id,p.seat,"wall"); message = `DRAW seat=${p.seat} tile=${tile}`;
    }
  } else if (action.type === "pass") {
    if (responsePlayer(g) !== id || !g.reaction || !g.lastDiscard) return state;
    if (g.reaction.queue.length) {
      if (g.profile.version >= 3 && g.reaction.queue[0].kind === "win") p.rules.declinedWin = true;
      g.reaction.queue.shift();
    } else {
      const a = anOptions(g,id), tile = g.lastDiscard.tile;
      if (a?.eligible) {
        if (a.canChan) {
          p.rules.cannotEatTiles.push(tile);
          if (g.profile.version >= 3) p.rules.forbiddenDiscardTiles.push(tile);
        }
        else (p.rules.passedCaTiles ??= []).push(tile);
      }
      const source = g.reaction.source;
      passTableCard(g,p.seat);
      if (source === "wall") {
        // Pass the public card to the next gate; never discard from the private hand.
        g.reaction = { source: "discard", ownerSeat: nextSeat(g,p.seat), queue: [] };
        g.turnSeat = g.reaction.ownerSeat;
        passTableCard(g,p.seat,g.reaction.ownerSeat);
      } else if (source === "return") {
        const carried = g.tableCards?.find(c => c.id === g.activeCardId);
        const returned = take(g); p.discards.push(returned);
        offer(g,returned,id,nextSeat(g,p.seat),"discard",carried);
      } else ready(s,p.seat);
    }
    message = `PASS seat=${p.seat}`;
  } else if (action.type === "an") {
    const a = info.an;
    if (!a?.eligible || !g.lastDiscard || !p.hand.includes(action.tile) || (a.canChan ? action.tile !== g.lastDiscard.tile : !a.caTiles.includes(action.tile))) return state;
    const fromSeat = g.players[g.lastDiscard.fromPlayerId].seat;
    const tile = take(g); p.hand.splice(p.hand.indexOf(action.tile),1);
    p.melds.push({ type: "an", kind: tile === action.tile ? "chan" : "ca", tiles: [tile,action.tile], fromSeat });
    if (g.profile.version >= 3 && tile !== action.tile) p.rules.hasEatenCaEver = true;
    g.reaction = undefined; g.awaiting = "discard"; g.turnSeat = p.seat; g.chiuWinTile = undefined;
    message = `AN seat=${p.seat} tile=${tile} kind=${tile === action.tile ? "chan" : "ca"}`;
  } else if (action.type === "chiu") {
    if (!info.canChiu || !g.reaction) return state;
    const owner = g.reaction.ownerSeat, tile = take(g);
    for (let i=0;i<3;i++) p.hand.splice(p.hand.indexOf(tile),1);
    p.melds.push({ type: "chiu", tile });
    g.reaction = undefined; g.turnSeat = p.seat;
    g.awaiting = owner === p.seat ? "discard" : "return";
    g.returnSeat = owner === p.seat ? undefined : owner; g.chiuWinTile = tile;
    message = `CHIU seat=${p.seat} tile=${tile}`;
  } else if (action.type === "discard") {
    if (!acting || !["opening_discard","discard","return"].includes(g.awaiting) || !p.hand.includes(action.tile)) return state;
    if (discardReason(g,p,action.tile)) return state;
    if (g.profile.version >= 3) {
      if (info.canU) p.rules.declinedWin = true;
      const group = groupKey(action.tile);
      const prior = p.rules.discardedByGroup[group] ?? [];
      p.rules.discardedByGroup[group] = [...new Set([...prior,action.tile])];
    }
    const returning = g.awaiting === "return", owner = returning ? g.returnSeat! : nextSeat(g,p.seat);
    p.hand.splice(p.hand.indexOf(action.tile),1); p.discards.push(action.tile);
    g.returnSeat = undefined; g.chiuWinTile = undefined;
    offer(g,action.tile,id,owner,returning ? "return" : "discard");
    message = `${returning ? "RETURN" : "DISCARD"} seat=${p.seat} tile=${action.tile}`;
  } else if (action.type === "win") {
    if (!info.canU) return state;
    if (g.awaiting === "reactions") {
      const chiu = g.reaction?.source !== "wall";
      const tile = take(g);
      if (chiu) {
        for(let i=0;i<3;i++) p.hand.splice(p.hand.indexOf(tile),1);
        p.melds.push({ type: "chiu", tile });
      } else p.hand.push(tile); // Winning reveal only; never a playable private draw.
    }
    end(s,id); message = `WIN seat=${p.seat}`;
  } else return state;
  g.revision++;
  if(message) s.log = [...s.log,message].slice(-60);
  return s;
}
