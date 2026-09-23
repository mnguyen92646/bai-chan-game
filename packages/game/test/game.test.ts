import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChanDeck, type TileId } from "../src/chanDeck";
import { startGame, toPrivateGameState, toPublicGameState, responsePlayer } from "../src/engine";
import { isWinningHand } from "../src/win";
import { newPractice, play, botAction, nextActor, type Practice } from "../src/practice";
import { transition } from "../src/round";
const pairs = (tiles: TileId[]) => tiles.flatMap(t => [t,t]);
function offered(source: "wall" | "discard" | "return" = "wall", tile: TileId = "2_van", owner = 1): Practice {
  const s = newPractice();
  for (const p of Object.values(s.game.players)) { p.hand = ["9_sach"]; p.discards=[]; p.melds=[]; }
  s.game.awaiting="reactions";s.game.turnSeat=owner;
  s.game.lastDiscard={tile,fromPlayerId: "3"};s.game.players["3"].discards=[tile];
  s.game.reaction={source,ownerSeat:owner,queue:[]};return s;
}
function inventory(s: Practice) {
  return [...s.wall,...Object.values(s.game.players).flatMap(p=>[...p.hand,...p.discards,...p.melds.flatMap(m=>m.type==="chiu"?[m.tile,m.tile,m.tile,m.tile]:m.tiles)])].sort();
}
test("120 cards: four copies of thirty faces",()=>{
  const deck=makeChanDeck();assert.equal(deck.length,120);assert.equal(new Set(deck).size,30);
  for(const t of new Set(deck))assert.equal(deck.filter(x=>x===t).length,4);
});
test("opening deal: 4P 24/23 with 27 wall; 5P 20/19 with 24 wall",()=>{
  for(const n of [4,5]){
    const {game,wall}=startGame({players:Array.from({length:n},(_,i)=>({playerId:String(i),seat:i+1})),dealerSeat:2});
    assert.equal(wall.length,n===4?27:24);
    for(const p of Object.values(game.players))assert.equal(p.hand.length,(n===4?23:19)+(p.seat===2?1:0));
    assert.equal(game.awaiting,"opening_discard");
  }
  assert.throws(()=>startGame({players:[],dealerSeat:1}));
});
test("all pairs with exactly 6/8 Chắn and four cạ win; insufficient or unpaired cards fail",()=>{
  const ca:TileId[]=["6_van","6_sach","7_van","7_sach","8_van","8_sach","9_van","9_sach"];
  const six:TileId[]=["1_van","2_van","2_sach","3_van","4_van","5_van"];
  assert.equal(isWinningHand([...pairs(six),...ca]),true);
  assert.equal(isWinningHand([...pairs([...six,"3_sach","4_sach"]),...ca]),true);
  assert.equal(isWinningHand([...pairs(six.slice(1)),"1_van","1_sach",...ca]),false);
  assert.equal(isWinningHand([...pairs(six),...ca.slice(0,-1),"2_vanh"]),false);
  assert.equal(isWinningHand(pairs([...six,"6_van","7_van","8_van","9_van"])),true);
});
test("exposed cạ cannot be recombined into Chắn, even if flattening would win",()=>{
  const hand=pairs(["2_van","3_van","4_van","5_van"]);
  const melds=Array.from({length:6},(_,i)=>({type:"an" as const,kind:"ca" as const,tiles:[`${6+Math.floor(i/2)}_van`,`${6+Math.floor(i/2)}_sach`] as [TileId,TileId],fromSeat:2}));
  assert.equal(isWinningHand(hand,melds),false);
  assert.equal(isWinningHand([...hand,...melds.flatMap(m=>m.tiles)]),true);
});
test("concealed pairs and Chíu count retain the winning shape",()=>{
  const hand=pairs(["3_sach","6_van","lao","2_van"]);
  const melds=(["5_vanh","5_sach","4_van","1_vanh","9_van","1_sach"] as TileId[]).map(tile=>({type:"an" as const,kind:"chan" as const,tiles:[tile,tile] as [TileId,TileId],fromSeat:4}));
  assert.equal(isWinningHand(hand,[...melds,{type:"chiu",tile:"7_vanh"}]),true);
  assert.equal(isWinningHand([...hand,"7_vanh","7_vanh","7_vanh","7_vanh"],melds),true);
});
test("public draw does not grow hand; passing does not discard from hand",()=>{
  let s=offered();s.game.awaiting="draw";s.game.reaction=undefined;s.game.lastDiscard=null;
  s.wall=["2_van","8_sach"];const before=s.game.players["0"].hand.slice();
  s=play(s,"0",{type:"draw"});assert.deepEqual(s.game.players["0"].hand,before);
  assert.equal(s.game.lastDiscard?.tile,"2_van");assert.equal(s.game.reaction?.source,"wall");
  s=play(s,"0",{type:"pass"});assert.deepEqual(s.game.players["0"].hand,before);assert.equal(s.game.turnSeat,2);
  s=play(s,"1",{type:"pass"});assert.equal(s.game.awaiting,"draw");assert.equal(s.game.turnSeat,2);
});
test("Ăn takes one private card and locks a two-card meld; cạ allowed before sufficient Chắn",()=>{
  const s=offered();s.game.players["0"].hand=["2_sach","8_van"];
  const next=play(s,"0",{type:"an",tile:"2_sach"});
  assert.equal(next.game.players["0"].hand.length,1);assert.equal(next.game.players["0"].melds.length,1);
  assert.equal(next.game.players["3"].discards.length,0);assert.equal(next.game.awaiting,"discard");
});
test("B wall draw → D Chíu → return to B; B may pass same card or eat and discard",()=>{
  let s=offered();s.game.awaiting="draw";s.game.reaction=undefined;s.game.turnSeat=2;
  s.game.players["3"].hand=["2_van","2_van","2_van","6_sach","8_sach"];
  s.game.players["1"].hand=["6_van","7_sach"];s.wall=["2_van","9_van"];
  s=play(s,"1",{type:"draw"});assert.equal(responsePlayer(s.game),"3");
  s=play(s,"3",{type:"chiu"});assert.equal(s.game.awaiting,"return");assert.equal(s.game.returnSeat,2);
  s=play(s,"3",{type:"discard",tile:"6_sach"});assert.equal(s.game.turnSeat,2);assert.equal(s.game.reaction?.source,"return");
  const passed=play(s,"1",{type:"pass"});assert.equal(passed.game.turnSeat,3);
  assert.deepEqual(passed.game.players["1"].hand,["6_van","7_sach"]);assert.equal(passed.game.players["1"].discards.at(-1),"6_sach");
  let eaten=play(s,"1",{type:"an",tile:"6_van"});assert.equal(eaten.game.awaiting,"discard");
  eaten=play(eaten,"1",{type:"discard",tile:"7_sach"});assert.equal(eaten.game.turnSeat,3);
});
test("passing cạ permits later Chắn, passing Chắn prohibits later Ăn and Chíu",()=>{
  let s=offered("discard");s.game.players["0"].hand=["2_sach","8_van"];
  s=play(s,"0",{type:"pass"});assert.deepEqual(s.game.players["0"].rules.passedCaTiles,["2_van"]);
  s.game.awaiting="reactions";s.game.lastDiscard={tile:"2_van",fromPlayerId:"3"};s.game.reaction={source:"discard",ownerSeat:1,queue:[]};
  assert.equal(toPrivateGameState({game:s.game,playerId:"0"})?.canAn,false);
  s.game.players["0"].hand.push("2_van");assert.equal(toPrivateGameState({game:s.game,playerId:"0"})?.canAn,true);
  s=play(s,"0",{type:"pass"});assert.deepEqual(s.game.players["0"].rules.cannotEatTiles,["2_van"]);
  s.game.awaiting="draw";s.game.turnSeat=2;s.game.players["0"].hand=["2_van","2_van","2_van"];
  s.wall=["2_van"];s=play(s,"1",{type:"draw"});assert.ok(!s.game.reaction?.queue.some(x=>x.playerId==="0"));
});
test("last wall card can win before exhaustion; all-pass ends in explicit draw",()=>{
  let s=offered();s.game.awaiting="draw";s.game.reaction=undefined;s.game.turnSeat=2;s.wall=["9_sach"];
  s.game.players["0"].hand=[...pairs(["1_van","2_van","3_van","4_van","5_van","6_van","7_van","8_van","2_sach","3_sach","4_sach"]),"9_sach"];
  s=play(s,"1",{type:"draw"});assert.equal(s.result,undefined);assert.equal(responsePlayer(s.game),"0");
  const won=play(s,"0",{type:"win"});assert.equal(won.game.awaiting,"round_end");assert.equal(won.game.winnerSeat,1);
  const pub=toPublicGameState({game:won.game,nicknamesById:new Map(),connectedById:new Map()});
  assert.equal(pub.players[0].hand?.length,24);assert.ok(pub.players.slice(1).every(p=>p.hand===undefined));
  let drawn=play(s,"0",{type:"pass"});
  for(let i=0;i<20&&!drawn.result;i++) drawn=play(drawn,nextActor(drawn),{type:"pass"});
  assert.equal(drawn.game.endReason,"wall_empty");assert.equal(drawn.game.winnerSeat,undefined);
});
test("stale revisions and out-of-turn actions cannot mutate state",()=>{
  const s=newPractice();assert.equal(transition(s,"0",{type:"draw"}),s);
  assert.equal(transition(s,"1",{type:"discard",tile:s.game.players["1"].hand[0]}),s);
  assert.equal(transition(s,"0",{type:"discard",tile:s.game.players["0"].hand[0]},99),s);
});
test("200 bot hands preserve all 120 cards, holding counts and terminate",()=>{
  const expected=makeChanDeck().sort();
  for(let run=0;run<200;run++){
    let s=newPractice();let steps=0;
    while(!s.result&&steps++<1000){
      const next=play(s,nextActor(s),botAction(s));assert.notEqual(next,s,`stalled ${s.game.awaiting}`);s=next;
      assert.deepEqual(inventory(s),expected);
      if(s.game.awaiting==="reactions"||s.game.awaiting==="draw")for(const p of Object.values(s.game.players)){
        assert.equal(p.hand.length+p.melds.reduce((n,m)=>n+(m.type==="chiu"?4:2),0),23);
      }
    }
    assert.ok(s.result,"must terminate");
  }
});

test("win reactions outrank Chíu; lower-priority packets cannot steal the card",()=>{
  let s=offered();s.game.awaiting="draw";s.game.reaction=undefined;s.game.turnSeat=2;s.wall=["9_sach","1_van"];
  s.game.players["0"].hand=[...pairs(["1_van","2_van","3_van","4_van","5_van","2_sach","3_sach","4_sach"]),"6_van","6_sach","7_van","7_sach","8_van","8_sach","9_van"];
  s.game.players["3"].hand=["9_sach","9_sach","9_sach","5_sach"];
  s=play(s,"1",{type:"draw"});assert.equal(responsePlayer(s.game),"0");
  assert.equal(play(s,"3",{type:"chiu"}),s);
  s=play(s,"0",{type:"pass"});assert.equal(responsePlayer(s.game),"3");
  assert.equal(play(s,"3",{type:"chiu"}).game.awaiting,"return");
});
test("five-player simulations conserve cards and terminate through shared phases",()=>{
  for(let run=0;run<30;run++){
    const setup=startGame({players:Array.from({length:5},(_,i)=>({playerId:String(i),seat:i+1})),dealerSeat:1});
    let s:Practice={...setup,version:2,round:1,log:[]};let steps=0;
    while(!s.result&&steps++<1000){const n=transition(s,nextActor(s),botAction(s));assert.notEqual(n,s);s=n;assert.deepEqual(inventory(s),makeChanDeck().sort());}
    assert.ok(s.result);
  }
});
test("cannot eat the last private card unless declaring a legal win instead",()=>{
  const s=offered();s.game.players["0"].hand=["2_van"];
  assert.equal(toPrivateGameState({game:s.game,playerId:"0"})?.canAn,false);
  assert.equal(play(s,"0",{type:"an",tile:"2_van"}),s);
});
