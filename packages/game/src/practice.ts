import { startGame, responsePlayer, toPrivateGameState, nextDealerSeat } from "./engine";
import { groupKey } from "./win";
import { transition, type Action, type Round } from "./round";
export type { Action } from "./round";
export type Practice = Round & { version: 2; round: number; lastDrawn?: never };
export const names = ["You", "Lan", "Minh", "Mai"];
export function newPractice(round = 1, previous?: Practice): Practice {
  const players = names.map((_, i) => ({ playerId: String(i), seat: i+1 }));
  const { game, wall } = startGame({ players, dealerSeat: nextDealerSeat(previous?.game,players,1) });
  return { version: 2, game, wall, log: ["Opening player discards first."], round };
}
export function canChiu(game: Practice["game"], id: string) { return !!toPrivateGameState({ game, playerId:id })?.canChiu; }
export function play(state: Practice, id: string, action: Action): Practice {
  const next = transition(state,id,action);
  if (next !== state && next.result?.startsWith("WIN:")) {
    const name = names[Number(next.result.slice(4))]; next.result = `${name} declared Ù and won the hand.`;
  }
  return next;
}
export function nextActor(state: Round): string {
  return responsePlayer(state.game) ?? Object.values(state.game.players).find(p => p.seat === state.game.turnSeat)!.playerId;
}
export function botAction(state: Round, id = nextActor(state)): Action {
  const g = state.game, p = g.players[id], options = toPrivateGameState({ game:g, playerId:id })!;
  if (options.canU) return { type: "win" };
  if (options.canChiu) return { type: "chiu" };
  if (g.awaiting === "reactions") {
    const a = options.an;
    if (a?.eligible) return { type:"an",tile: a.canChan ? g.lastDiscard!.tile : a.caTiles[0] };
    return { type:"pass" };
  }
  if (g.awaiting === "draw") return { type:"draw" };
  const score = (t: typeof p.hand[number]) => p.hand.filter(x => x===t).length*10 + p.hand.filter(x => groupKey(x)===groupKey(t)).length;
  const legal = options.discardTiles ?? p.hand;
  return { type:"discard",tile:legal.slice().sort((a,b)=>score(a)-score(b))[0] };
}
export function restorePracticeWinner(state: Practice): Practice { return state; }
