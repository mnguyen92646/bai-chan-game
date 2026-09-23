import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startGame, anOptions, canWinCard, toPrivateGameState } from '../src/engine';
import { transition, type Round } from '../src/round';
import { botAction } from '../src/practice';
import type { TileId } from '../src/chanDeck';
import { isWinningHand } from '../src/win';

function offer(tile: TileId, source: 'wall' | 'discard' = 'discard'): Round {
  const s: Round = {...startGame({players:Array.from({length:4},(_,i)=>({playerId:String(i),seat:i+1})),dealerSeat:1}),log:[]};
  for (const p of Object.values(s.game.players)) { p.hand=[];p.melds=[];p.discards=[]; }
  s.game.players['3'].discards=[tile];s.game.lastDiscard={tile,fromPlayerId:'3'};
  s.game.awaiting='reactions';s.game.reaction={source,ownerSeat:1,queue:[]};return s;
}
const sampleHand: TileId[] = ['2_van','2_van','1_vanh','6_vanh','3_vanh','8_sach','3_van','1_van','1_van','1_van','7_vanh','6_van','3_sach','3_van','1_sach','3_vanh','8_van'];
const special: TileId[]=['1_van','1_vanh','1_sach','chi','lao','thang'];
const numbered: TileId[]=['2_van','3_van','4_van','5_van','6_van','7_van','8_van','9_van','2_sach','3_sach','4_sach'];
const pairs=(cards:TileId[])=>cards.flatMap(t=>[t,t]);

test('five held Nhất cards can round out Lão as cạ',()=>{
  for(const tile of ['1_van','1_vanh','1_sach'] as TileId[]){
    const s=offer('lao');s.game.players['0'].hand=sampleHand.slice();
    const options=anOptions(s.game,'0');assert.ok(options?.eligible);assert.deepEqual(options.caTiles.slice().sort(),['1_sach','1_van','1_vanh']);
    const next=transition(s,'0',{type:'an',tile});assert.notEqual(next,s);
    assert.deepEqual(next.game.players['0'].melds[0],{type:'an',kind:'ca',tiles:['lao',tile],fromSeat:4});
    assert.equal(next.game.awaiting,'discard');assert.equal(toPrivateGameState({game:next.game,playerId:'0'})?.canU,false);
    assert.equal(next.game.players['0'].hand.length,sampleHand.length-1);
    assert.equal(botAction(s,'0').type,'an');
  }
});
test('special cạ rounding preserves exact pairs and does not split an already-rounded group',()=>{
  const s=offer('lao');s.game.players['0'].hand=['1_van','1_van','1_sach','8_sach'];
  const a=anOptions(s.game,'0');assert.ok(a?.eligible);assert.deepEqual(a.caTiles,['1_sach']);
  s.game.players['0'].hand=['1_van','1_sach','8_sach'];assert.equal(anOptions(s.game,'0')?.eligible,false);
  s.game.players['0'].hand=['1_van','1_van','8_sach'];assert.equal(anOptions(s.game,'0')?.eligible,false);
});
test('special cạ still honors declined/discarded faces and a legal outgoing card',()=>{
  const s=offer('lao');s.game.players['0'].hand=sampleHand.slice();
  s.game.players['0'].rules.passedCaTiles=['lao'];assert.equal(anOptions(s.game,'0')?.eligible,false);
  s.game.players['0'].rules.passedCaTiles=[];s.game.players['0'].rules.discardedByGroup={SPECIAL6:['lao']};assert.equal(anOptions(s.game,'0')?.eligible,false);
  s.game.players['0'].rules.discardedByGroup={};s.game.players['0'].hand=['1_sach','8_van'];s.game.players['0'].rules.forbiddenDiscardTiles=['8_van'];assert.equal(anOptions(s.game,'0')?.eligible,false);
});
test('no mixed Nhất/Yêu cạ may be the completing pair, in either direction',()=>{
  for(const held of special)for(const incoming of special.filter(t=>t!==held)) {
    const s=offer(incoming,'wall');s.game.players['0'].hand=[...pairs(numbered),held];
    assert.equal(isWinningHand([...s.game.players['0'].hand,incoming]),true);
    assert.equal(canWinCard(s.game,'0'),false);
    s.game.reaction!.queue=[{playerId:'0',kind:'win'}];assert.equal(transition(s,'0',{type:'win'}),s);
  }
});
test('existing special cạ may remain in a winning hand; exact Nhất completion still allowed',()=>{
  const s=offer('1_van','wall');s.game.players['0'].hand=[...pairs(numbered.slice(0,10)),'lao','1_sach','1_van'];
  assert.equal(canWinCard(s.game,'0'),true);
  // The exact mate exists but locking it leaves an unpaired ordinary card:
  // the evaluator cannot substitute a mixed special pair to accept a bad hand.
  s.game.players['0'].hand[0]='9_sach';assert.equal(canWinCard(s.game,'0'),false);
  s.game.players['0'].hand=[...pairs(numbered.slice(0,10)),'lao','1_sach','9_van'];
  s.game.lastDiscard!.tile='9_van';assert.equal(canWinCard(s.game,'0'),true);
});
test('profile 3 hands retain prior behavior until the next deal',()=>{
  const s=offer('lao');s.game.profile.version=3;s.game.players['0'].hand=sampleHand.slice();assert.equal(anOptions(s.game,'0')?.eligible,false);
  s.game.lastDiscard!.tile='1_van';s.game.reaction!.source='wall';s.game.players['0'].hand=[...pairs(numbered),'lao'];assert.equal(canWinCard(s.game,'0'),true);
});
