import { test } from "node:test";
import assert from "node:assert/strict";
import { newPractice, play, botAction, nextActor } from "../src/practice";
import { toPublicGameState, startGame } from "../src/engine";
import { transition } from "../src/round";
import { tableCardsView } from "../src/tableCards";

function drawFixture() {
  const s = newPractice();
  for (const p of Object.values(s.game.players)) { p.hand = ["9_sach", "8_vanh"]; p.discards = []; p.melds = []; }
  s.game.awaiting = "draw"; s.game.turnSeat = 2; s.wall = ["3_vanh", "7_van"]; s.game.wallCount = 2;
  return s;
}

test("a wall draw moves to the next gate when passed, retaining its origin and identity", () => {
  let s = play(drawFixture(), "1", {type:"draw"});
  const id = s.game.activeCardId;
  assert.deepEqual(s.game.tableCards?.map(c => [c.tile,c.source,c.gateSeat]), [["3_vanh","wall",2]]);
  s = play(s,"1",{type:"pass"});
  assert.equal(s.game.activeCardId,id); assert.equal(s.game.tableCards?.[0].gateSeat,3);
  assert.deepEqual(s.game.tableCards?.[0].passedBy,[2]);
  s = play(s,"2",{type:"pass"});
  assert.equal(s.game.activeCardId,undefined); assert.equal(s.game.tableCards?.[0].gateSeat,3);
  assert.deepEqual(s.game.tableCards?.[0].passedBy,[2,3]);
  assert.equal(s.game.players["1"].discards[0],"3_vanh");
});

test("the reacting player does not move the gate; Chíu removes its offered card", () => {
  const s = drawFixture(); s.game.players["3"].hand = ["3_vanh","3_vanh","3_vanh","6_sach","8_sach"];
  let next = play(s,"1",{type:"draw"});
  const publicState = toPublicGameState({game:next.game,nicknamesById:new Map(),connectedById:new Map()});
  assert.equal(publicState.responseSeat,4); assert.equal(publicState.gateSeat,2);
  next = play(next,"3",{type:"chiu"});
  assert.equal(next.game.tableCards?.length,0); assert.equal(next.game.returnSeat,2);
  next = play(next,"3",{type:"discard",tile:"6_sach"});
  const card = next.game.tableCards![0];
  assert.equal(card.gateSeat,2); assert.equal(card.source,"return"); assert.equal(card.sourceSeat,4);
  next = play(next,"1",{type:"pass"});
  assert.equal(next.game.tableCards![0].id,card.id); assert.equal(next.game.tableCards![0].source,"return");
  assert.equal(next.game.tableCards![0].gateSeat,3); assert.deepEqual(next.game.tableCards![0].passedBy,[2]);
});

test("eating removes the right physical copy from gate metadata", () => {
  const s = drawFixture(); s.game.players["1"].hand = ["3_vanh","8_sach"];
  s.game.players["0"].discards = ["3_vanh"];
  let next = play(s,"1",{type:"draw"});
  assert.equal(next.game.tableCards?.length,2);
  next = play(next,"1",{type:"an",tile:"3_vanh"});
  assert.equal(next.game.tableCards?.length,1); assert.equal(next.game.tableCards![0].source,"unknown");
  assert.equal(next.game.activeCardId,undefined);
});

test("older saves show all remaining public cards without invented draw provenance", () => {
  const s=drawFixture();s.game.players["0"].discards=["2_van","2_sach"];
  const view=tableCardsView(s.game);
  assert.equal(view.cards.length,2);assert.ok(view.cards.every(c=>c.source==="unknown"));
  assert.equal(s.game.tableCards,undefined,"read-only projection does not mutate the save");
});

test("gate metadata and physical public piles stay in sync across complete 4P/5P hands", () => {
  for (const count of [4,5]) {
    const {game,wall}=startGame({players:Array.from({length:count},(_,i)=>({playerId:String(i),seat:i+1})),dealerSeat:1});
    let s={game,wall,log:[] as string[]};
    for(let n=0;s.game.phase==="playing" && n<1000;n++) {
      const id=nextActor(s);const next=transition(s,id,botAction(s,id));assert.notEqual(next,s);s=next;
      const cards=tableCardsView(s.game).cards;
      assert.deepEqual(cards.map(c=>c.tile).sort(),Object.values(s.game.players).flatMap(p=>p.discards).sort());
      assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
      if(s.game.activeCardId)assert.equal(cards.filter(c=>c.id===s.game.activeCardId).length,1);
    }
    assert.equal(s.game.phase,"lobby");
  }
});
