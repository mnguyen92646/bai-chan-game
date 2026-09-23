"use client";
import { useLanguage } from "@/lib/useLanguage";
import { LanguageToggle } from "@/components/LanguageToggle";
import Link from "next/link";
import { useState } from "react";
import { Card, Rules } from "@/components/GameTable";
export default function HomePage() {
  const { t: tr } = useLanguage();
  const [help, setHelp] = useState(false);
  return (
    <main className="home-shell">
      <header className="game-header">
        <span className="wordmark">bài chắn</span>
        <LanguageToggle />
        <span className="edition">{tr("120 TILES")}</span>
      </header>
      <section className="home-hero">
        <p className="eyebrow">BÀI CHẮN</p>
        <h1>{tr("Play Chắn.")}</h1>
        <p className="hero-copy">{tr("Practice against bots or play in a private room.")}</p>
        <div className="hero-cards" aria-hidden="true">
          {["3_van", "8_sach", "chi", "8_vanh", "3_sach"].map((t, i) => (
            <div
              key={t}
              style={{
                transform: `translateY(${Math.abs(i - 2) * 12}px) rotate(${(i - 2) * 10}deg)`,
              }}
            >
              <Card tile={t} />
            </div>
          ))}
        </div>
        <div className="hero-caption">
          <span />{tr("DRAW · CLAIM · DISCARD")}<span />
        </div>
      </section>
      <section className="home-actions">
        <Link className="primary-button" href="/practice">
          <span>{tr("Play a practice hand")}<small>{tr("Play against three bots")}</small>
          </span>
          <span>↗</span>
        </Link>
        <div className="home-secondary">
          <Link className="secondary-button" href="/create">{tr("Create a table")}<span>＋</span>
          </Link>
          <Link className="secondary-button" href="/join">{tr("Join a table")}<span>↗</span>
          </Link>
        </div>
        <button className="learn-button" onClick={() => setHelp(true)}>
          <u>{tr("Learn the basics")}</u> <span>→</span>
        </button>
      </section>
      <footer className="home-footer">
        <small>{tr("120-tile variant · 4–5 players")}</small>
      </footer>
      {help && <Rules close={() => setHelp(false)} />}
    </main>
  );
}
