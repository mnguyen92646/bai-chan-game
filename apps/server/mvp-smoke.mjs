import assert from "node:assert/strict";
import { io } from "socket.io-client";
const base = process.env.TEST_SERVER_URL ?? "http://michaels-mac-mini.tail7c0eb7.ts.net:3101";
const clients = [];
const emit = (s,event,data={}) => new Promise((resolve,reject)=>s.timeout(4000).emit(event,data,(err,response)=>err?reject(err):resolve(response)));
const wait = async predicate => { for(let n=0;n<200;n++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw new Error("Timed out waiting for broadcast"); };
const connect = () => new Promise((resolve,reject)=>{
  const s=io(base,{forceNew:true,reconnection:false});clients.push(s);s.on("connect",()=>resolve(s));s.on("connect_error",reject);
});
try {
 const unknown=await connect();
 const denied=await emit(unknown,"room:join",{roomId:"000000",nickname:"Unknown"});
 assert.equal(denied.ok,false,"an unknown room must not be created by joining");
 unknown.disconnect();
 for(const count of [4,5]){
  const room=await(await fetch(`${base}/rooms`,{method:"POST"})).json();const peers=[];
  assert.match(room.roomId,/^room_[A-Za-z0-9_-]{22}$/,"room invitation has 128 random bits");
  for(let i=0;i<count;i++){
    const socket=await connect(),peer={socket,priv:null,room:null};
    socket.on("game:private",p=>peer.priv=p);socket.on("room:state",r=>peer.room=r);
    peer.join=await emit(socket,"room:join",{roomId:room.roomId,nickname:`Test ${i}`});assert.equal(peer.join.ok,true);peers.push(peer);
  }
  assert.equal((await emit(peers[0].socket,"game:start")).ok,true);
  await wait(()=>peers.every(p=>p.priv&&p.room.publicGame));
  for(let i=0;i<count;i++)assert.equal(peers[i].priv.hand.length,(count===4?23:19)+(i===0?1:0));
  const start=peers[0].room.publicGame;
  const stale={handId:start.handId,revision:start.revision,action:{type:"discard",tile:peers[0].priv.hand[0]}};
  assert.equal((await emit(peers[1].socket,"game:action",stale)).ok,false,"reject wrong player");
  let steps=0,sawDraw=false;
  while(peers[0].room.publicGame.phase==="playing"&&steps++<1000){
    const g=peers[0].room.publicGame;
    const seat=g.responseSeat??g.turnSeat;
    const peer=peers.find(p=>p.priv.you.seat===seat),p=peer.priv;
    assert.ok(g.players.every(x=>x.hand===undefined),"never reveal private hands during play");
    assert.equal(g.tableCards.length,g.players.reduce((n,p)=>n+p.discards.length,0),"all public cards represented at gates");
    if(g.awaiting==="reactions") { const active=g.tableCards.find(c=>c.id===g.activeCardId);assert.ok(active);assert.equal(active.tile,g.lastDiscard.tile);assert.equal(active.gateSeat,g.gateSeat); }
    let action;
    if(p.canU)action={type:"win"};
    else if(p.canChiu)action={type:"chiu"};
    else if(g.awaiting==="reactions")action=p.an?.eligible?{type:"an",tile:p.an.canChan?g.lastDiscard.tile:p.an.caTiles[0]}:{type:"pass"};
    else if(g.awaiting==="draw")action={type:"draw"};
    else action={type:"discard",tile:(p.discardTiles??p.hand)[0]};
    const handBefore=[...p.hand];
    const result=await emit(peer.socket,"game:action",{handId:g.handId,revision:g.revision,action});
    assert.equal(result.ok,true,`${JSON.stringify(action)} in ${g.awaiting}: ${result.error}`);
    await wait(()=>peers.every(x=>x.room.publicGame.revision===g.revision+1));
    if(action.type==="draw"){
      sawDraw=true;assert.deepEqual(peer.priv.hand,handBefore);assert.equal(peer.room.publicGame.source,"wall");
    }
    if(steps===1)assert.equal((await emit(peers[0].socket,"game:action",stale)).ok,false,"reject stale action");
  }
  assert.ok(sawDraw);assert.ok(steps<1000);assert.equal(peers[0].room.publicGame.awaiting,"round_end");
  const ended=peers[0].room.publicGame;
  const expectedOpener=ended.endReason==="win"?ended.winnerSeat:peers[0].priv.you.seat;
  const oldHand=ended.handId;
  assert.equal((await emit(peers[0].socket,"game:restart")).ok,true);
  await wait(()=>peers.every(p=>p.room.publicGame.handId!==oldHand));
  assert.equal(peers[0].room.publicGame.dealerSeat,expectedOpener);
  assert.equal(peers[0].room.publicGame.awaiting,"opening_discard");
  assert.equal((await emit(peers[0].socket,"game:action",stale)).ok,false,"reject previous-hand action even when revision resets");
  const old=peers[0];old.socket.disconnect();const socket=await connect();let restored;
  socket.on("game:private",p=>restored=p);
  const joined=await emit(socket,"room:join",{roomId:room.roomId,nickname:"Restored",token:old.join.token});
  assert.equal(joined.playerId,old.join.playerId);await wait(()=>!!restored);assert.equal(restored.hand.length,(count===4?23:19)+(restored.you.seat===expectedOpener?1:0));
  console.log(`PASS ${count}P: complete hand (${steps} transitions), public draws, private hands, stale/invalid actions, restart, authenticated rejoin.`);
  for(const p of peers)p.socket.disconnect();socket.disconnect();
 }
} finally {clients.forEach(s=>s.disconnect());}
