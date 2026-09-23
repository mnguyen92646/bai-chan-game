import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
const base = process.env.TEST_SERVER_URL;
if (!base) throw new Error('Set TEST_SERVER_URL to an isolated test server with BOT_DELAY_MS=30.');
const sockets = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const emit = (s, event, data = {}) => new Promise((resolve, reject) => s.timeout(4000).emit(event, data, (err, reply) => err ? reject(err) : resolve(reply)));
async function wait(check) { for (let i=0;i<600;i++) { if(check()) return; await sleep(10); } throw new Error('Broadcast timeout'); }
async function peer(roomId, name, token) {
  const socket = io(base, { forceNew: true, reconnection: false }); sockets.push(socket);
  const p = { socket, room: null, priv: null };
  socket.on('room:state', r => p.room = r); socket.on('game:private', s => p.priv = s);
  await new Promise((resolve,reject) => { socket.on('connect',resolve); socket.on('connect_error',reject); });
  p.join = await emit(socket,'room:join',{roomId,nickname:name,token});
  return p;
}
function humanAction(g, p) {
  if (p.canU) return {type:'win'};
  if (p.canChiu) return {type:'chiu'};
  if (g.awaiting==='reactions') return p.an?.eligible ? {type:'an',tile:p.an.canChan?g.lastDiscard.tile:p.an.caTiles[0]} : {type:'pass'};
  if (g.awaiting==='draw') return {type:'draw'};
  return {type:'discard',tile:(p.discardTiles??p.hand)[0]};
}
try {
 for (const [humans,total] of [[2,4],[2,5],[3,4],[3,5]]) {
  const {roomId} = await (await fetch(`${base}/rooms`,{method:'POST'})).json();
  const peers = [await peer(roomId,'Host')];
  assert.equal((await emit(peers[0].socket,'game:start',{fillBots:true,playerCount:total})).ok,false,'one human is insufficient');
  for(let i=1;i<humans;i++) peers.push(await peer(roomId,`Person ${i}`));
  assert.equal((await emit(peers[1].socket,'game:start',{fillBots:true,playerCount:total})).ok,false,'only host can deal');
  assert.equal((await emit(peers[0].socket,'game:start',{fillBots:true,playerCount:3})).ok,false,'invalid size');
  assert.equal((await emit(peers[0].socket,'game:start',{fillBots:true,playerCount:total})).ok,true);
  await wait(()=>peers.every(p=>p.priv));
  assert.equal(peers[0].room.players.length,total);
  assert.equal(peers[0].room.players.filter(p=>p.isBot).length,total-humans);
  for(let i=0;i<humans;i++) assert.equal(peers[i].priv.hand.length,(total===4?23:19)+(i===0?1:0));
  const late = await peer(roomId,'Mid-hand join');
  assert.equal(late.join.ok,false,'no bot replacement mid-hand'); late.socket.disconnect();
  let lastRev=-1,transitions=0,botTurns=0;
  while(peers[0].room.publicGame.phase==='playing' && transitions<1200) {
    const g=peers[0].room.publicGame;
    assert.ok(g.players.every(p=>!p.hand),'bot and human hands remain private');
    if(g.revision!==lastRev) { transitions++;lastRev=g.revision; }
    const actor=g.responseSeat??g.turnSeat;
    const current=peers.find(p=>p.priv.you.seat===actor);
    if(!current) { botTurns++;await wait(()=>peers[0].room.publicGame.revision>g.revision);continue; }
    const result=await emit(current.socket,'game:action',{handId:g.handId,revision:g.revision,action:humanAction(g,current.priv)});
    assert.equal(result.ok,true,JSON.stringify(result));
    await wait(()=>peers[0].room.publicGame.revision>g.revision);
  }
  assert.ok(transitions<1200);assert.ok(botTurns>0);
  const ended=peers[0].room.publicGame;
  assert.equal(ended.awaiting,'round_end');
  const expected=ended.endReason==='win'?ended.winnerSeat:1;
  const replacementSeat=peers[0].room.players.find(p=>p.isBot).seat;
  const newcomer=await peer(roomId,'New person');peers.push(newcomer);
  assert.equal(newcomer.join.ok,true);assert.equal(newcomer.join.seat,replacementSeat);
  await wait(()=>peers[0].room.players.filter(p=>p.isBot).length===total-humans-1);
  assert.equal((await emit(peers[0].socket,'game:restart')).ok,true);
  await wait(()=>peers.every(p=>p.priv&&p.room.publicGame.handId!==ended.handId));
  assert.equal(peers[0].room.players.length,total);assert.equal(peers[0].room.publicGame.dealerSeat,expected);
  // Disconnect/rejoin preserves a human's identity and private cards.
  const old=peers[1],saved=old.priv.hand.slice();old.socket.disconnect();
  const restored=await peer(roomId,'Rejoined',old.join.token);peers[1]=restored;
  assert.equal(restored.join.playerId,old.join.playerId);assert.deepEqual(restored.priv.hand,saved);
  assert.equal(restored.room.players.find(p=>p.playerId===old.join.playerId).isBot,false);
  // Reset cancels outstanding bot callbacks and removes bots without a phantom hand.
  assert.equal((await emit(peers[0].socket,'room:reset')).ok,true);
  await sleep(100);assert.equal(peers[0].room.publicGame,null);assert.equal(peers[0].room.players.length,1);
  peers.forEach(p=>p.socket.disconnect());
  console.log(`PASS ${humans} humans + ${total-humans} bots: full hand, privacy, host/size guards, replacement, rematch, reconnect, reset (${transitions} transitions).`);
 }
} finally { sockets.forEach(s=>s.disconnect()); }
