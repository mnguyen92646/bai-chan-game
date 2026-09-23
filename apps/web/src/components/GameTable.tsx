/* eslint-disable @next/next/no-img-element */
"use client";
import { useLanguage } from "@/lib/useLanguage";
import { CircularBoard, GateHistory } from "@/components/CircularBoard";
import { RulesGuide } from "@/components/RulesGuide";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SpeakerIcon, TableSoundSettings } from "@/components/TableSoundSettings";
import { TileSizeSettings } from "@/components/TileSizeSettings";
import { useTileSize } from "@/lib/useTileSize";
import type { CSSProperties } from "react";
import { useTableAudio } from "@/lib/useTableAudio";
import type { TableVoice } from "@/lib/tableSoundEvents";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { tilePngSrc } from "@/lib/tileSrc";
import { tileInfo } from "@/lib/tileMeta";
import type { Action, PublicGameState, PrivateGameState } from "@/lib/game";

export function Card({
  tile,
  small = false,
}: {
  tile: string;
  small?: boolean;
}) {

  return (
    <span className={`tile-face ${small ? "tile-small" : ""}`}>
      <img
        src={tilePngSrc(tile)}
        alt={tileInfo(tile).labelVi}
        draggable={false}
      />
      <span>
        {tileInfo(tile).rank ?? "✦"}
        <small>{tileInfo(tile).suitNameVi ?? tile}</small>
      </span>
    </span>
  );
}
export function TableTile({
  tile,
  focus,
  onFocus,
}: {
  tile: string;
  focus: string | null;
  onFocus: (tile: string) => void;
}) {
  const { t: tr } = useLanguage();
  return (
    <button
      className={`table-tile ${focus === tile ? "matching-tile" : ""}`}
      aria-label={tr(`Highlight ${tileInfo(tile).labelVi}`)}
      aria-pressed={focus === tile}
      onClick={() => onFocus(tile)}
    >
      <Card tile={tile} small />
    </button>
  );
}

export function TableSheet({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const { t: tr } = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.showModal();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="table-sheet"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="sheet-content">
        <header>
          <h2>{title}</h2>
          <button className="text-button" onClick={close} autoFocus>{tr("Done")}</button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function Rules({ close }: { close: () => void }) {
  const { t: tr } = useLanguage();
  return (
    <TableSheet title={tr("How to play")} close={close}>
      <RulesGuide />
    </TableSheet>
  );
}
export function GameTable({
  game,
  privateState,
  seat,
  title,
  subtitle,
  onAction,
  onNew,
  result,
  log,
  disabled = false,
  extra,
  voices,
}: {
  game: PublicGameState;
  privateState: PrivateGameState;
  seat: number;
  title: string;
  subtitle: string;
  onAction: (action: Action) => void;
  onNew?: () => void;
  result?: string;
  log: string[];
  disabled?: boolean;
  extra?: React.ReactNode;
  voices?: Partial<Record<number, TableVoice>>;
}) {
  const { t: tr } = useLanguage();
  const [focusTile, setFocusTile] = useState<string | null>(null);
  const focus = (tile: string) =>
    setFocusTile((current) => (current === tile ? null : tile));
  const [selected, setSelected] = useState<number | null>(null);
  const [previewEdge, setPreviewEdge] = useState<"left" | "right" | null>(null);
  const [help, setHelp] = useState(false);
  const closeHelp = useCallback(() => setHelp(false), []);
  const [history, setHistory] = useState(false);
  const [ownHand, setOwnHand] = useState(false);
  const tiles = useTileSize();
  const [soundSettings, setSoundSettings] = useState(false);
  const sound = useTableAudio(game, disabled, voices);
  const [inspectedGate, setInspectedGate] = useState<number | null>(null);
  const [inspectedSeat, setInspectedSeat] = useState<number | null>(null);
  const inspected = game.players.find((p) => p.seat === inspectedSeat);
  const [sort, setSort] = useState(true);
  const hand = sort
    ? privateState.hand
        .slice()
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : privateState.hand;
  const tile = selected === null ? undefined : hand[selected];
  const myTurn = game.turnSeat === seat;
  const active = game.players.find((p) => p.seat === (game.responseSeat ?? game.turnSeat));
  const winner =
    game.phase === "lobby"
      ? game.players.find((p) => p.seat === game.winnerSeat)
      : undefined;
  const me = game.players.find((p) => p.seat === seat);
  const an = privateState.an?.eligible ? privateState.an : null;
  const canChiu = privateState.canChiu;
  const needsDiscard = ["opening_discard", "discard", "return"].includes(game.awaiting);
  const discardBlocked = tile ? privateState.discardReasons?.[tile] : undefined;
  const canAct = game.awaiting === "reactions" ? privateState.canRespond : myTurn;
  const hasClaim = !!(canChiu || an || privateState.canU);
  const act = (action: Action) => {
    setSelected(null);
    setFocusTile(null);
    onAction(action);
  };
  const readableLog = log
    .map((line) => {
      const match = line.match(/^(?:\S+ )?(DRAW|DISCARD|AN|CHIU|RETURN|PASS|WIN) seat=(\d+)(.*)$/);
      if (!match) {
        if (/^\d{4}-/.test(line)) {
          if (/GAME_START|GAME_RESTART/.test(line)) return tr("New hand started.");
          if (/WALL_EMPTY/.test(line)) return tr("Wall empty. Hand complete.");
          return null;
        }
        return tr(line.replace(
          /(discarded )([1-9]_(?:vanh|van|sach)|lao|chi|thang)(\.)/,
          (_, prefix, id, suffix) =>
            `${prefix}${tileInfo(id).labelVi}${suffix}`,
        ));
      }
      const name =
        game.players.find((p) => p.seat === Number(match[2]))?.nickname ??
        tr(`Seat ${match[2]}`);
      const tileId = match[3].match(/tile=(\S+)/)?.[1];
      const label = tileId ? tileInfo(tileId).labelVi : "";
      if (match[1] === "RETURN") return tr(`${name} returned ${label}.`);
      if (match[1] === "PASS") return tr(`${name} passed.`);
      if (match[1] === "WIN") return tr(`${name} declared Ù!`);
      return match[1] === "DRAW"
        ? tr(`${name} drew a tile.`)
        : match[1] === "DISCARD"
          ? tr(`${name} discarded ${label}.`)
          : tr(`${name} claimed ${label} · ${match[1] === "CHIU" ? "Chíu" : match[3].includes("kind=chan") ? "Chắn" : "Cạ"}.`);
    })
    .filter((line): line is string => line !== null);
  const headline = result ? tr("Hand complete") : disabled ? tr("Reconnecting…")
    : canAct ? game.awaiting === "return" ? tr(`Return a card to ${game.players.find(p => p.seat === game.returnSeat)?.nickname ?? "the interrupted player"}`)
      : game.awaiting === "opening_discard" ? tr(privateState.canU ? "Opening hand — declare Ù or discard" : "Opening turn — discard one card")
      : game.awaiting === "reactions" ? tr("Public card — claim or pass")
      : game.awaiting === "draw" ? tr("Your turn — draw or claim") : tr("Your turn — select a tile")
    : tr(`${active?.nickname ?? "Another player"}’s turn`);
  return (
    <main style={{ "--tile-preference": `${tiles.size}px` } as CSSProperties} className={`game-shell game-table ${result ? "game-complete" : "game-playing"}`} onPointerDownCapture={sound.unlock} onClickCapture={sound.unlock} onKeyDownCapture={sound.unlock}>
      <header className="game-header">
        <Link href="/" className="wordmark">
          bài chắn
        </Link>
        <div className="header-right">
          <LanguageToggle compact />
          <span className="mode-label">{title}</span>
          <button
            className="icon-button"
            aria-label={tr("How to play")}
            onClick={() => setHelp(true)}
          >
            ?
          </button>
        </div>
      </header>
      <div className="table-meta">
        <span>
          <i className={disabled ? "status-dot offline" : "status-dot"} />
          {subtitle}
        </span>
        <span>{tr("120 tiles")}</span>
      </div>
      <section className="felt-table gate-board" aria-label={tr("Game table")}>
        <CircularBoard game={game} seat={seat} inspectPlayer={setInspectedSeat} inspectGate={setInspectedGate} renderTile={t => <TableTile tile={t} focus={focusTile} onFocus={focus} />} />
        <div className="table-activity">
          <button className="activity-history" aria-label={tr("Table history")} title={tr("Table history")} onClick={() => setHistory(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="3" cy="6" r=".7"/><circle cx="3" cy="12" r=".7"/><circle cx="3" cy="18" r=".7"/></svg>
          </button>
          <div className="activity-scroll" role="region" aria-label={tr("Recent actions")} tabIndex={0}>
            {readableLog.slice().reverse().map((line, i) => <p key={`${readableLog.length - i}-${line}`} title={line}>{line}</p>)}
          </div>
        </div>
      </section>
      <section className="hand-panel">
        {!winner?.hand && <>
        <div className="turn-prompt" aria-live="polite">
          {game.lastDiscard && game.awaiting === "reactions" ? <button className={`table-tile hand-offered-card ${focusTile === game.lastDiscard.tile ? "matching-tile" : ""}`} aria-label={tr(`Highlight ${tileInfo(game.lastDiscard.tile).labelVi}`)} aria-pressed={focusTile === game.lastDiscard.tile} onClick={() => focus(game.lastDiscard!.tile)}><Card tile={game.lastDiscard.tile} small /></button> : <span className="turn-symbol">{canAct ? "↳" : "◷"}</span>}
          <div>
            <strong>{headline}</strong>
            {game.lastDiscard && game.awaiting === "reactions" && <small>{tr("Card in play")} · {tileInfo(game.lastDiscard.tile).labelVi}</small>}
            <small>
              {result
                ? tr(result)
                : tile
                  ? tileInfo(tile).labelVi
                  : myTurn
                    ? tr("Select a tile, then discard.")
                    : tr("Tap a player to see their sets.")}
            </small>
          </div>
        </div>
        </>}
      {winner?.hand && (
        <section className="winner-reveal" aria-label={tr("Winning hand")}>
          <header className="winner-heading">
          <h2 aria-live="polite">{tr(`${winner.nickname} declared Ù`)}</h2>
          {winner.seat !== seat && <button className="text-button" onClick={() => setOwnHand(true)}>{tr("YOUR HAND")}</button>}
          </header>
          <p>{tr("Full hand revealed ·")}{" "}
            {winner.hand.length +
              winner.melds.reduce(
                (n, m) => n + (m.type === "chiu" ? 4 : 2),
                0,
              )}{" "}{tr("tiles")}</p>
          <h3>{tr("Concealed tiles · now revealed")}</h3>
          <div className="winner-tiles">
            {winner.hand
              .slice()
              .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
              .map((t, i) => (
                <TableTile key={i} tile={t} focus={focusTile} onFocus={focus} />
              ))}
          </div>
          {!!winner.melds.length && (
            <>
              <h3>{tr("Exposed sets")}</h3>
              <div className="winner-sets">
                {winner.melds.map((m, i) => (
                  <div
                    key={i}
                    role="group"
                    aria-label={
                      m.type === "chiu"
                        ? "Chíu"
                        : m.kind === "chan"
                          ? "Chắn"
                          : "Cạ"
                    }
                  >
                    <span>
                      {m.type === "chiu"
                        ? "Chíu"
                        : m.kind === "chan"
                          ? "Chắn"
                          : "Cạ"}
                    </span>
                    <div>
                      {(m.type === "chiu"
                        ? [m.tile, m.tile, m.tile, m.tile]
                        : m.tiles
                      ).map((t, j) => (
                        <TableTile
                          key={j}
                          tile={t}
                          focus={focusTile}
                          onFocus={focus}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
        {!winner?.hand && <>
        <div className="hand-heading">
          <button
            className="text-button"
            onClick={() => setInspectedSeat(seat)}
          >
            {tr("Your sets")} ({me?.melds.length ?? 0})
          </button>
          <span>{tr("YOUR HAND")}<b>{hand.length}</b>
          </span>
          <button
            className="text-button"
            onClick={() => {
              setSort(!sort);
              setSelected(null);
            }}
          >
            {sort ? tr("↕ Sorted by rank") : tr("↕ Deal order")}
          </button>
        </div>
        <div className="tile-rack">
          {hand.map((t, i) => (
            <button
              key={`${t}-${i}`}
              aria-label={tr(`Select ${tileInfo(t).labelVi}, tile ${i + 1}`)}
              aria-pressed={selected === i}
              className={`hand-tile ${focusTile === t ? "matching-tile" : ""} ${selected === i ? "selected" : ""} ${privateState.lastDrawnTile === t ? "drawn" : ""}`}
              onClick={(event) => {
                // Row ends change with larger text: keep the magnifier inside
                // the viewport rather than assuming every row has 12 cards.
                const bounds = event.currentTarget.getBoundingClientRect();
                const previewWidth = 48 * Math.max(tiles.size, parseFloat(getComputedStyle(document.documentElement).fontSize) / 17);
                const center = bounds.left + bounds.width / 2;
                setPreviewEdge(center - previewWidth / 2 < 8 ? "left" : center + previewWidth / 2 > document.documentElement.clientWidth - 8 ? "right" : null);
                setSelected(selected === i ? null : i);
                setFocusTile(selected === i ? null : t);
              }}
            >
              <Card tile={t} />
              {selected === i && (
                <span className="tile-preview" aria-hidden="true" style={previewEdge === "left" ? { left: 0, right: "auto", transform: "none" } : previewEdge === "right" ? { left: "auto", right: 0, transform: "none" } : { left: "50%", right: "auto", transform: "translateX(-50%)" }}>
                  <Card tile={t} />
                </span>
              )}
            </button>
          ))}
          {Array.from({ length: Math.max(0, 24 - hand.length) }, (_, i) => <span className="hand-tile hand-placeholder" aria-hidden="true" key={`empty-${i}`}><span className="tile-face" /></span>)}
        </div>
        </>}
        <div className={`actions ${hasClaim && !result ? "actions-with-claims" : ""}`}>
          {result ? (
            <button
              className="primary-button"
              disabled={!onNew}
              onClick={onNew}
            >{tr("Next hand")}</button>
          ) : (
            <>
              {canChiu && (
                <button
                  className="primary-button claim-button"
                  disabled={disabled}
                  onClick={() => act({ type: "chiu" })}
                >
                  Chíu
                </button>
              )}
              {an && (
                <button
                  className="primary-button claim-button eat-button"
                  disabled={
                    disabled ||
                    (!an.canChan && (!tile || !an.caTiles.includes(tile)))
                  }
                  onClick={() =>
                    act({
                      type: "an",
                      tile: an.canChan ? game.lastDiscard!.tile : tile!,
                    })
                  }
                >
                  {an.canChan ? "Ăn chắn" : "Ăn cạ"}
                </button>
              )}
              {privateState.canU && (
                <button
                  className="primary-button claim-button win-button"
                  aria-label={tr("Ù · Win")}
                  disabled={disabled}
                  onClick={() => act({ type: "win" })}
                >Ù</button>
              )}
              <button
                className={`${hasClaim ? "secondary-button alternative-action" : "primary-button"} routine-action`}
                disabled={disabled || !canAct || (needsDiscard && (!tile || !!discardBlocked))}
                onClick={() => act(game.awaiting === "reactions" ? { type: "pass" }
                  : game.awaiting === "draw" ? { type: "draw" } : { type: "discard", tile: tile! })}
              >
                {canAct && game.awaiting === "draw" && <span className="draw-arrow" aria-hidden="true">↑</span>}
                {!canAct ? tr("Waiting…") : game.awaiting === "reactions" ? tr(privateState.canU ? "Pass Ù" : "Pass")
                  : game.awaiting === "draw" ? tr("Draw")
                  : !tile ? tr("Select a tile") : game.awaiting === "return" ? tr("Return card") : tr("Discard")}
              </button>
            </>
          )}
        </div>
        <div className="action-feedback">
        {needsDiscard && myTurn && discardBlocked && <p className="action-hint" role="status">{tr(discardBlocked)}</p>}
        {!result && privateState.canU && privateState.passWinForfeits && <p className="action-hint">{tr("Passing or discarding instead of Ù gives up winning on later cards this hand.")}</p>}
        {!result && privateState.winForfeited && <p className="action-hint">{tr("You passed Ù earlier. You can keep playing, but cannot win this hand.")}</p>}
        {an && !an.canChan && (
          <p className="action-hint">{tr("To eat cạ, select:")}{" "}
            {an.caTiles.map((t) => tileInfo(t).labelVi).join(tr(" or "))}.
          </p>
        )}
        </div>
      </section>
      <footer className="game-footer">
        <button className="text-button" onClick={() => setHistory(!history)}>{tr("History")}</button>
        <button className="text-button table-sound-button" onClick={() => setSoundSettings(true)} aria-label={tr("Settings")}>
          <SpeakerIcon muted={sound.preferences.mode === "off" || sound.preferences.volume === 0 || !sound.ready} />
          <span>{tr("Settings")}<small>{tr(sound.preferences.mode === "off" || sound.preferences.volume === 0 ? "Sound off" : !sound.ready ? "Tap for sound" : "Sound on")}</small></span>
        </button>
        {extra}
      </footer>
      {soundSettings && <TableSheet title={tr("Settings")} close={() => setSoundSettings(false)}><TileSizeSettings size={tiles.size} change={tiles.change} /><h3>{tr("Table sounds")}</h3><TableSoundSettings sound={sound} /></TableSheet>}
      {ownHand && <TableSheet title={tr("YOUR HAND")} close={() => setOwnHand(false)}><div className="discard-history">{hand.map((t, i) => <TableTile key={i} tile={t} focus={focusTile} onFocus={focus} />)}</div></TableSheet>}
      {inspectedGate !== null && <TableSheet title={`${tr("Gate")} · ${game.players.find(p => p.seat === inspectedGate)?.nickname ?? inspectedGate}`} close={() => setInspectedGate(null)}>
        <GateHistory game={game} gate={inspectedGate} renderTile={t => <TableTile tile={t} focus={focusTile} onFocus={focus} />} />
      </TableSheet>}
      {history && (
        <TableSheet title={tr("Table history")} close={() => setHistory(false)}>
          {game.players.map(p => <section key={p.playerId}><h3>{tr("Gate")} · {p.nickname}</h3><GateHistory game={game} gate={p.seat} renderTile={t => <TableTile tile={t} focus={focusTile} onFocus={focus} />} /></section>)}
          {readableLog
            .slice()
            .reverse()
            .map((l, i) => (
              <p key={i}>{l}</p>
            ))}
        </TableSheet>
      )}
      {inspected && (
        <TableSheet
          title={tr(`${inspected.nickname} · ${inspected.handCount} tiles`)}
          close={() => setInspectedSeat(null)}
        >
          <h3>{tr("Exposed sets")}</h3>
          <div className="set-list">
            {inspected.melds.length ? (
              inspected.melds.map((m, i) => (
                <div key={i}>
                  <strong>
                    {m.type === "chiu"
                      ? "Chíu"
                      : m.kind === "chan"
                        ? "Chắn"
                        : "Cạ"}
                  </strong>
                  <div className="discard-history">
                    {(m.type === "chiu"
                      ? [m.tile, m.tile, m.tile, m.tile]
                      : m.tiles
                    ).map((t, j) => (
                      <TableTile
                        key={j}
                        tile={t}
                        focus={focusTile}
                        onFocus={focus}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p>{tr("No exposed sets.")}</p>
            )}
          </div>
          <h3>{tr("Discards")}</h3>
          <div className="discard-history">
            {inspected.discards.length ? (
              inspected.discards.map((t, i) => (
                <TableTile key={i} tile={t} focus={focusTile} onFocus={focus} />
              ))
            ) : (
              <p>{tr("No discards.")}</p>
            )}
          </div>
        </TableSheet>
      )}
      {help && <Rules close={closeHelp} />}
    </main>
  );
}
