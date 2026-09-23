import { test } from "node:test";
import assert from "node:assert/strict";
import { startGame, defaultProfile, toPrivateGameState, toPublicGameState, canWinCard, canChiuCard, nextDealerSeat, nextSeat } from "../src/engine";
import { transition, type Round } from "../src/round";
import { newPractice, botAction } from "../src/practice";
import { isWinningHand } from "../src/win";
import type { TileId } from "../src/chanDeck";

const faces: TileId[]=["1_van","2_van","3_van","4_van","5_van","6_van","7_van","8_van","9_van","2_sach","3_sach","4_sach"];
const pairs=(cards:TileId[])=>cards.flatMap(t=>[t,t]);
function round(n=4): Round {
  const setup=startGame({players:Array.from({length:n},(_,i)=>({playerId:String(i),seat:i+1})),dealerSeat:1});
  for(const p of Object.values(setup.game.players)){p.hand=["9_sach"];p.melds=[];p.discards=[];}
  return {...setup,log:[]};
}
function offer(s:Round,tile:TileId,source:"wall"|"discard"|"return"="wall",owner=1,from="3") {
  s.game.awaiting="reactions";s.game.turnSeat=owner;
  s.game.lastDiscard={tile,fromPlayerId:from};s.game.players[from].discards.push(tile);
  s.game.reaction={source,ownerSeat:owner,queue:[]};return s;
}
function draw(s:Round,tile:TileId,actor="1") {
  s.game.awaiting="draw";s.game.turnSeat=s.game.players[actor].seat;s.game.reaction=undefined;s.game.lastDiscard=null;
  s.wall=[tile,"8_sach"];s.game.wallCount=2;
  return transition(s,actor,{type:"draw"});
}
test("agreed special pairs form complete hands; four held copies need no Chíu declaration",()=>{
  for(const ca of [["1_vanh","1_sach"],["chi","lao"],["1_vanh","chi"]] as TileId[][])
    assert.equal(isWinningHand([...pairs(faces.slice(1,10)),...ca]),true);
  assert.equal(isWinningHand([...pairs(faces.slice(0,8)),"chi","chi","chi","chi"]),true);
});
test("both table sizes offer opening Ù only to the opener, reveal the full winning hand",()=>{
  for(const n of [4,5]){
    let s=round(n);s.game.players["0"].hand=pairs(faces.slice(0,n===4?12:10));
    assert.equal(toPrivateGameState({game:s.game,playerId:"0"})?.canU,true);
    assert.equal(toPrivateGameState({game:s.game,playerId:"1"})?.canU,false);
    assert.equal(transition(s,"1",{type:"win"}),s);
    s=transition(s,"0",{type:"win"});assert.equal(s.game.endReason,"win");assert.equal(s.wall.length,n===4?27:24);
    const pub=toPublicGameState({game:s.game,nicknamesById:new Map(),connectedById:new Map()});
    assert.equal(pub.players[0].hand?.length,n===4?24:20);assert.equal(pub.players[1].hand,undefined);
    assert.equal(nextDealerSeat(s.game,[{seat:1},{seat:2}],2),1);
  }
});
test("Yêu can be Chíu but cannot be the winning card, including return/discard Chíu-Ù",()=>{
  for(const tile of ["chi","lao","thang"] as TileId[])for(const source of ["wall","discard","return"] as const){
    const s=offer(round(),tile,source);s.game.players["0"].hand=[...pairs(faces.slice(0,10)),tile,tile,tile];
    assert.equal(canChiuCard(s.game,"0"),true);assert.equal(canWinCard(s.game,"0"),false);
    s.game.reaction!.queue=[{playerId:"0",kind:"chiu"}];
    const next=transition(s,"0",{type:"chiu"});assert.notEqual(next,s);
    assert.equal(toPrivateGameState({game:next.game,playerId:"0"})?.canU,false);
  }
});
test("ordinary discard cannot win, but discard and returned-card Chíu-Ù can",()=>{
  for(const source of ["discard","return"] as const){
    const s=offer(round(),"9_sach",source);s.game.players["0"].hand=[...pairs(faces.slice(0,11)),"9_sach"];
    assert.equal(canWinCard(s.game,"0"),false);
    s.game.players["0"].hand=[...pairs(faces.slice(0,10)),"9_sach","9_sach","9_sach"];
    assert.equal(canWinCard(s.game,"0"),true);s.game.reaction!.queue=[{playerId:"0",kind:"win"}];
    const won=transition(s,"0",{type:"win"});assert.equal(won.game.endReason,"win");
    assert.deepEqual(won.game.players["0"].melds,[{type:"chiu",tile:"9_sach"}]);
  }
});
test("equal winning claims follow clockwise seat order starting at the active gate",()=>{
  let s=round();
  // Each claimant holds distinct Chắn; both complete a 24-card hand with a cạ.
  const a:TileId[]=["1_van","1_vanh","1_sach","chi","lao","thang","2_van","2_vanh","2_sach","3_van","3_vanh"];
  const b:TileId[]=["4_van","4_vanh","4_sach","5_van","5_vanh","5_sach","6_van","6_vanh","6_sach","7_van","7_vanh"];
  s.game.players["0"].hand=[...pairs(a),"9_van"];s.game.players["2"].hand=[...pairs(b),"9_vanh"];
  s=draw(s,"9_sach");assert.deepEqual(s.game.reaction?.queue.filter(x=>x.kind==="win").map(x=>x.playerId),["2","0"]);
  assert.equal(transition(s,"0",{type:"win"}),s);
  assert.equal(nextSeat(s.game,4),1);
});
test("passing Chắn blocks future claims and discarding the held matching card",()=>{
  let s=offer(round(),"3_vanh");s.game.players["0"].hand=["3_vanh","8_sach"];
  s=transition(s,"0",{type:"pass"});
  s.game.awaiting="discard";s.game.turnSeat=1;s.game.reaction=undefined;
  const priv=toPrivateGameState({game:s.game,playerId:"0"})!;
  assert.deepEqual(priv.discardTiles,["8_sach"]);assert.ok(priv.discardReasons?.["3_vanh"]);
  assert.equal(transition(s,"0",{type:"discard",tile:"3_vanh"}),s);
  s=offer(s,"3_vanh","wall");assert.equal(toPrivateGameState({game:s.game,playerId:"0"})?.canAn,false);
  s.game.players["0"].hand=["3_vanh","3_vanh","3_vanh","8_sach"];assert.equal(canChiuCard(s.game,"0"),false);
});
test("a discarded face cannot later be eaten as Chắn or cạ; a new hand clears history",()=>{
  for(const held of ["3_vanh","3_sach"] as TileId[]){
    let s=round();s.game.players["0"].hand=["3_vanh",held,"8_sach"];
    s=transition(s,"0",{type:"discard",tile:"3_vanh"});s=offer(s,"3_vanh","wall");
    assert.equal(toPrivateGameState({game:s.game,playerId:"0"})?.canAn,false);
    assert.equal(transition(s,"0",{type:"an",tile:held}),s);
  }
  const fresh=round();assert.deepEqual(fresh.game.players["0"].rules.discardedByGroup,{});
});
test("after eating cạ, do not allow discarding both sides of another cạ",()=>{
  let s=offer(round(),"2_van");s.game.players["0"].hand=["2_sach","3_vanh","3_sach","8_van"];
  s=transition(s,"0",{type:"an",tile:"2_sach"});assert.equal(s.game.players["0"].rules.hasEatenCaEver,true);
  s=transition(s,"0",{type:"discard",tile:"3_vanh"});
  s.game.awaiting="discard";s.game.turnSeat=1;s.game.reaction=undefined;
  assert.equal(transition(s,"0",{type:"discard",tile:"3_sach"}),s);
  assert.ok(toPrivateGameState({game:s.game,playerId:"0"})?.discardTiles?.includes("8_van"));
});
test("cannot choose a cạ from an existing cạ of that rank",()=>{
  const s=offer(round(),"2_van");s.game.players["0"].hand=["2_vanh","2_sach","8_van"];
  assert.equal(toPrivateGameState({game:s.game,playerId:"0"})?.canAn,false);
  assert.equal(transition(s,"0",{type:"an",tile:"2_sach"}),s);
  s.game.players["0"].hand=["2_sach","8_van"];assert.equal(toPrivateGameState({game:s.game,playerId:"0"})?.canAn,true);
});
test("do not offer nonwinning claims that leave no legal discard or return",()=>{
  let s=offer(round(),"2_van");s.game.players["0"].hand=["2_sach","3_vanh"];
  s.game.players["0"].rules.forbiddenDiscardTiles=["3_vanh"];
  assert.equal(toPrivateGameState({game:s.game,playerId:"0"})?.canAn,false);
  s.game.players["0"].hand=["2_van","2_van","2_van","3_vanh"];
  s=draw(s,"2_van");assert.ok(!s.game.reaction?.queue.some(x=>x.playerId==="0"));
});
test("passed cạ still permits Chíu; disputed later-Chắn behavior is unchanged",()=>{
  let s=offer(round(),"2_van");s.game.players["0"].hand=["2_sach","8_van"];
  s=transition(s,"0",{type:"pass"});s.game.players["0"].hand=["2_van","2_van","2_van","8_van"];
  s=draw(s,"2_van");assert.equal(toPrivateGameState({game:s.game,playerId:"0"})?.canChiu,true);
});
test("B Chíu the immediate upstream discard and discards normally onward",()=>{
  let s=round();s.game.players["0"].hand=["3_vanh","8_van"];
  s.game.players["1"].hand=["3_vanh","3_vanh","3_vanh","6_vanh"];
  s=transition(s,"0",{type:"discard",tile:"3_vanh"});s=transition(s,"1",{type:"chiu"});
  assert.equal(s.game.awaiting,"discard");assert.equal(s.game.returnSeat,undefined);
  s=transition(s,"1",{type:"discard",tile:"6_vanh"});assert.equal(s.game.turnSeat,3);
});
test("explicitly passing Ù bars a win on a later card and resets at the next deal",()=>{
  let s=round();s.game.players["0"].hand=[...pairs(faces.slice(0,11)),"9_sach"];
  s=draw(s,"9_sach");assert.equal(toPrivateGameState({game:s.game,playerId:"0"})?.canU,true);
  s=transition(s,"0",{type:"pass"});assert.equal(s.game.players["0"].rules.declinedWin,true);
  s=draw(s,"9_sach");assert.equal(s.game.players["0"].rules.winForfeited,true);
  assert.equal(canWinCard(s.game,"0"),false);assert.equal(transition(s,"0",{type:"win"}),s);
  const fresh=round();fresh.game.players["0"].hand=pairs(faces);
  assert.equal(toPrivateGameState({game:fresh.game,playerId:"0"})?.canU,true);
});
test("discarding an opening winner explicitly declines the opening win",()=>{
  let s=round();s.game.players["0"].hand=pairs(faces);
  s=transition(s,"0",{type:"discard",tile:"4_sach"});assert.equal(s.game.players["0"].rules.winForfeited,true);
});
test("winner opens the next practice hand; withdrawn winner and drawn-hand defaults stay unchanged",()=>{
  const old=newPractice();old.game.phase="lobby";old.game.endReason="win";old.game.winnerSeat=3;
  const next=newPractice(2,old);assert.equal(next.game.dealerSeat,3);assert.equal(next.game.players["2"].hand.length,24);
  assert.equal(nextDealerSeat(old.game,[{seat:1},{seat:2}],1),1);
  old.game.endReason="wall_empty";old.game.winnerSeat=undefined;assert.equal(newPractice(2,old).game.dealerSeat,1);
});
test("bots choose a permitted discard when a low-value card is forbidden",()=>{
  const s=round();s.game.players["0"].hand=["2_sach","3_van","3_van"];
  s.game.players["0"].rules.forbiddenDiscardTiles=["2_sach"];
  assert.deepEqual(botAction(s,"0"),{type:"discard",tile:"3_van"});
});
test("version 2 saved hands retain their old opening and history behavior",()=>{
  const s=round();s.game.profile={...defaultProfile,version:2,fivePlayerOpeningBonus:false,allowReturnClaims:false};
  s.game.players["0"].hand=pairs(faces);assert.equal(toPrivateGameState({game:s.game,playerId:"0"})?.canU,false);
  s.game.players["0"].rules.forbiddenDiscardTiles=["1_van"];
  assert.notEqual(transition(s,"0",{type:"discard",tile:"1_van"}),s);
  const setup=startGame({players:Array.from({length:5},(_,i)=>({playerId:String(i),seat:i+1})),dealerSeat:1,profile:s.game.profile});
  assert.equal(setup.wall.length,25);assert.equal(setup.game.awaiting,"draw");
});
