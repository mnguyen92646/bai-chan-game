"use client";
import { useState } from "react";
import { CircularBoard, GateHistory } from "@/components/CircularBoard";
import { GameTable, TableTile, TableSheet } from "@/components/GameTable";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/lib/useLanguage";
import type { PublicGameState, TileId } from "@/lib/game";

export function fixture(count: number, crowded: boolean): PublicGameState {
  const sets = crowded ? 6 : 2;
  const players = Array.from({length:count},(_,i) => ({ playerId:String(i),seat:i+1,nickname:["You","Lan","Minh","Mai","Hương"][i],connected:true,handCount:(count===4?23:19)-2*sets,
    discards:[],melds:Array.from({length:sets},(_,j) => ({type:"an" as const,kind:"chan" as const,tiles:[`${2+(i+j)%8}_sach`,`${2+(i+j)%8}_sach`] as [TileId,TileId],fromSeat:1})) }));
  const tableCards = players.flatMap(p => Array.from({length:crowded?7:3},(_,i) => ({id:`demo-${p.seat}-${i}`,tile:`${2+(p.seat+i)%8}_${i%2 ? "van" : "vanh"}` as TileId,gateSeat:p.seat,source:(["discard","return","wall"] as const)[i%3],sourceSeat:p.seat===1?count:p.seat-1,passedBy:i%3===2?[p.seat===1?count:p.seat-1]:[]})));
  return {handId:"layout-fixture",revision:5,phase:"playing",dealerSeat:1,turnSeat:2,awaiting:"reactions",wallCount:18,source:"discard",gateSeat:2,responseSeat:count,
    lastDiscard:{tile:tableCards.find(c=>c.id==="demo-2-2")!.tile,fromSeat:1},tableCards,activeCardId:"demo-2-2",players};
}
/** Deliberately synthetic stress fixture; never a saved or network game. */
export function TablePreview({ count, crowded, large, draw, won = false }: { count: number; crowded: boolean; large: boolean; draw: boolean; won?: boolean }) {
  const { t: tr } = useLanguage();
  const [stage, setStage] = useState(won ? 4 : crowded ? 3 : draw ? 0 : 2);
  const sets = [0, 2, 4, count === 4 ? 11 : 9, draw ? 0 : 4][stage];
  const game = fixture(count, true);
  const maximum = count === 4 ? 24 : 20;
  const hand = Array.from({ length: maximum - sets * 2 }, (_, i) => `${1 + Math.floor(i / 3) % 9}_${["van", "vanh", "sach"][i % 3]}` as TileId);
  game.players.forEach((p, playerIndex) => {
    p.melds = Array.from({length:sets},(_,j) => ({ type: "an" as const, kind: j % 3 === 0 ? "ca" as const : "chan" as const, tiles: [`${2 + (playerIndex+j)%8}_sach`, `${2 + (playerIndex+j)%8}_${j % 3 === 0 ? "van" : "sach"}`] as [TileId,TileId], fromSeat: 1 }));
    p.handCount = maximum - sets * 2 - 1;
  });
  game.responseSeat = stage % count + 1;
  game.turnSeat = 1;
  game.awaiting = stage === 0 ? "opening_discard" : stage === 2 ? "discard" : "reactions";
  if (stage === 2) game.players[1].melds[0] = { type: "chiu", tile: "3_sach" };
  if (stage === 0) { game.tableCards = []; game.lastDiscard = null; game.activeCardId = undefined; game.gateSeat = undefined; }
  if (stage === 4) {
    game.phase = "lobby"; game.endReason = "win"; game.winnerSeat = 2;
    game.players[1].hand = hand;
    game.players[1].handCount = hand.length;
  }
  const claims = stage === 1 || stage === 3;
  return <div className={large ? "board-preview-large" : undefined}><GameTable game={game} privateState={{ you: { playerId: "0", seat: 1 }, hand, canRespond: claims, canChiu: claims, canU: claims, passWinForfeits: claims, an: claims ? { eligible: true, canChan: true, mustPreferChan: true, caTiles: [] } : undefined }} seat={1} title={tr("Table 123456")} subtitle={`${count} players · sample cards`} onAction={() => {}} result={stage === 4 ? "Lan declared Ù and won the hand." : undefined} onNew={() => setStage(0)} log={stage === 0 ? [] : Array.from({ length: 18 }, (_, i) => ["Lan drew a tile.", "Minh claimed a tile · Chắn.", "Mai discarded lục · văn."][i % 3])} extra={<button className="text-button" onClick={() => setStage((stage + 1) % 5)}>Preview stage {stage} → next</button>} /></div>;
}
export function BoardPreview() {
  const [count,setCount]=useState(4),[large,setLarge]=useState(false),[crowded,setCrowded]=useState(false),[focus,setFocus]=useState<string|null>(null),[gate,setGate]=useState<number|null>(null),[player,setPlayer]=useState<number|null>(null);
  const game=fixture(count,crowded);
  const renderTile=(tile:string)=><TableTile tile={tile} focus={focus} onFocus={t=>setFocus(t===focus?null:t)} />;
  return <main className={`game-shell board-preview ${large?"board-preview-large":""}`}>
    <header className="preview-controls"><strong>Board layout preview · sample cards</strong><LanguageToggle/><label>Players <select value={count} onChange={e=>setCount(Number(e.target.value))}><option value={4}>4</option><option value={5}>5</option></select></label><label><input type="checkbox" checked={large} onChange={e=>setLarge(e.target.checked)}/>200% text</label><label><input type="checkbox" checked={crowded} onChange={e=>setCrowded(e.target.checked)}/>Crowded table</label></header>
    <section className="felt-table gate-board"><CircularBoard game={game} seat={1} renderTile={renderTile} inspectGate={setGate} inspectPlayer={setPlayer}/></section>
    {gate!==null&&<TableSheet title={`Gate ${gate}`} close={()=>setGate(null)}><GateHistory game={game} gate={gate} renderTile={renderTile}/></TableSheet>}
    {player!==null&&<TableSheet title={game.players.find(p=>p.seat===player)!.nickname} close={()=>setPlayer(null)}><div className="discard-history">{game.players.find(p=>p.seat===player)!.melds.flatMap(m=>m.type === "chiu" ? [m.tile,m.tile,m.tile,m.tile] : m.tiles).map((t,i)=><span key={i}>{renderTile(t)}</span>)}</div></TableSheet>}
  </main>;
}
