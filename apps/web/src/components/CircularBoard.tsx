"use client";
import { type ReactNode } from "react";
import type { PublicGameState, TableCard } from "@/lib/game";
import { useLanguage } from "@/lib/useLanguage";

type BoardProps = {
  game: PublicGameState; seat: number;
  renderTile: (tile: string) => ReactNode;
  inspectPlayer: (seat: number) => void;
  inspectGate: (seat: number) => void;
};

export function sourceLabel(card: TableCard, vi: boolean) {
  return card.source === "wall" ? (card.passedBy.length ? vi ? "Bốc đã bỏ" : "Passed draw" : vi ? "Bốc nọc" : "Wall draw")
    : card.source === "return" ? vi ? "Trả cửa" : "Returned"
    : card.source === "discard" ? vi ? "Đánh" : "Discard" : vi ? "Bài công khai" : "Public card";
}
const marks = { wall: "↑", discard: "→", return: "↩", unknown: "·" };

export function CircularBoard({ game, seat, renderTile, inspectPlayer, inspectGate }: BoardProps) {
  const { locale, t: tr } = useLanguage(), vi = locale === "vi";
  const order = game.players.slice().sort((a,b) => a.seat-b.seat);
  const start = order.findIndex(p => p.seat === seat);
  const players = [...order.slice(start), ...order.slice(0,start)];
  const cards = game.tableCards ?? [];
  const activeGate = game.awaiting === "return" ? game.returnSeat : game.gateSeat;
  const responder = game.responseSeat ?? game.turnSeat;
  const gateName = (number: number) => {
    const name = number === seat ? vi ? "bạn" : "you" : game.players.find(p => p.seat === number)?.nickname ?? String(number);
    return vi ? `Cửa ${name}` : `To ${name}`;
  };
  const gatePlayer = game.players.find(p => p.seat === activeGate);
  return <>
    <div className={`circular-board seats-${players.length}`} aria-label={vi ? "Chỗ ngồi và cửa bài" : "Seats and card gates"}>
      {players.map((p,index) => <section key={p.playerId} className={`ring-player player-${index} ${responder === p.seat && game.phase === "playing" ? "ring-player-active" : ""} ${p.melds.length ? "" : "ring-player-empty"}`} aria-label={p.nickname}>
        <button className="ring-player-name" onClick={() => inspectPlayer(p.seat)} aria-label={tr(`${p.nickname}: ${p.melds.length} sets. View tiles and discards`)}>
          <strong>{p.seat === seat ? tr("You") : p.nickname}{p.isBot && <i className="ring-bot-mark">{tr("Bot")}</i>}</strong>
          <small>{p.connected ? tr(`${p.handCount} tiles`) : tr("Offline")}</small>
        </button>
        <span className={`ring-turn-label ${responder === p.seat && game.phase === "playing" ? "" : "reserved-label"}`} aria-hidden={responder !== p.seat || game.phase !== "playing"}>{game.awaiting === "reactions" ? vi ? "Đang xét bài" : "Responding" : vi ? "Đến lượt" : "Your turn"}</span>
        <div className="ring-melds" aria-label={tr(`${p.nickname}’s exposed sets`)}>{p.melds.map((meld,i) => <div className={`ring-meld ${meld.type === "chiu" ? "ring-chiu" : ""}`} key={i} role="group" aria-label={meld.type === "chiu" ? "Chíu" : meld.kind === "chan" ? "Chắn" : "Cạ"}>
          {(meld.type === "chiu" ? [meld.tile,meld.tile,meld.tile,meld.tile] : meld.tiles).map((tile,j) => <span key={j}>{renderTile(tile)}</span>)}
        </div>)}{Array.from({ length: Math.max(0, 8 - p.melds.length) }, (_, i) => <div className="ring-meld meld-placeholder" aria-hidden="true" key={`empty-${i}`}><span><span className="tile-face" /></span><span><span className="tile-face" /></span></div>)}</div>
      </section>)}
      {players.map((p,index) => {
        const pile = cards.filter(card => card.gateSeat === p.seat);
        const visible = pile.slice(-3);
        const active = activeGate === p.seat && game.phase === "playing";
        const current = pile.find(card => card.id === game.activeCardId);
        // The active card remains visible even if another player is responding to it.
        if (current && !visible.includes(current)) visible.splice(0,1,current);
        return <section key={p.seat} className={`card-gate gate-${index} ${active ? "gate-active" : ""}`} aria-label={gateName(p.seat)}>
          <button className="gate-heading" onClick={() => inspectGate(p.seat)} aria-label={`${gateName(p.seat)} · ${pile.length} ${vi ? "quân, xem tất cả" : "cards, view all"}`}><span>{gateName(p.seat)}</span><b>{pile.length}</b></button>
          <div className="gate-cards">{visible.length ? visible.map(card => <div key={card.id} className={`gate-card ${card.id === game.activeCardId ? "gate-card-offered" : ""}`}>
            {renderTile(card.tile)}<span className="gate-source" title={sourceLabel(card,vi)} aria-label={sourceLabel(card,vi)}>{marks[card.source]}</span>
          </div>) : <span className="gate-empty" aria-hidden="true">· · ·</span>}</div>
          <p className={`gate-action ${active ? "" : "reserved-label"}`} aria-hidden={!active}>{game.awaiting === "return" ? vi ? "Chờ trả cửa" : "Return here" : current ? sourceLabel(current,vi) : vi ? "Đang xét" : "Active card"}</p>
        </section>;
      })}
      <div className="ring-center">
        <strong>{game.wallCount}</strong><span>{vi ? "quân nọc" : "in wall"}</span>
        <small className={gatePlayer && game.phase === "playing" ? "" : "reserved-label"} aria-hidden={!gatePlayer || game.phase !== "playing"}>{game.awaiting === "return" ? vi ? "Trả về" : "Return to" : vi ? "Xét tại" : "At gate"}<br/>{gatePlayer?.seat === seat ? tr("You") : gatePlayer?.nickname || "\u00a0"}</small>
      </div>
    </div>
    <div className="gate-legend"><span>↑ {vi ? "Bốc" : "Draw"}</span><span>→ {vi ? "Đánh" : "Discard"}</span><span>↩ {vi ? "Trả" : "Return"}</span><span>{vi ? "Chạm cửa xem tất cả" : "Tap a gate for all cards"}</span></div>
  </>;
}

export function GateHistory({ game, gate, renderTile }: { game: PublicGameState; gate: number; renderTile: (tile:string) => ReactNode }) {
  const { locale } = useLanguage(), vi = locale === "vi";
  const cards = game.tableCards?.filter(card => card.gateSeat === gate) ?? [];
  const name = (seat: number) => game.players.find(p => p.seat === seat)?.nickname ?? String(seat);
  return <div className="gate-history">
    <p>{vi ? "Các quân còn công khai ở cửa này, từ cũ đến mới. Quân đã ăn hoặc chíu nằm trong bộ của người nhận." : "Unclaimed public cards at this gate, oldest first. Eaten or Chíu cards are in the claimant’s sets."}</p>
    {!cards.length && <p>{vi ? "Chưa có quân ở cửa này." : "No cards at this gate yet."}</p>}
    <div className="gate-history-cards">{cards.map(card => <div key={card.id}>
      {renderTile(card.tile)}<strong>{sourceLabel(card,vi)}</strong><small>{name(card.sourceSeat)}</small>
      {!!card.passedBy.length && <small>{vi ? "Đã bỏ: " : "Passed: "}{card.passedBy.map(name).join(" → ")}</small>}
      {card.id === game.activeCardId && <b>{vi ? "Đang xét" : "Active"}</b>}
    </div>)}</div>
  </div>;
}
