# Bài Chắn

A mobile-first web game using the family's 120-card deck and the original illustrated tile assets.

Play the [public game](https://bai-chan-play.white-violet-3211.workers.dev/) or read the [research note and family rules](https://michaelnguyen.net/baichan.html). If your family plays with this deck, [share your rules](https://github.com/mnguyen92646/bai-chan-game/issues/new?template=family-rules.yml). Code contributions are welcome; start with [CONTRIBUTING.md](CONTRIBUTING.md).

Source code and documentation are MIT licensed. Card art and audio are excluded from that license; see [LICENSE](LICENSE) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Play locally

Requires Node 20+.

```bash
npm install
npm run dev -w apps/server
# In another terminal:
npm run dev -w apps/web
```

Open http://localhost:3000. **Practice** starts immediately with three bots and saves the current hand in browser storage. It needs no game server once the web page has loaded (this is not an offline-installable PWA).

**Create a table** opens a private room. Share its long invitation link with at least one other person; anyone holding the link can take an open seat. In the lobby, choose four or five seats and keep **Fill empty seats with bots** enabled; the host can deal once two people are connected. Turn it off for a table of four or five people. Bots act on the server, with the same rules and paced turns as practice. New people replace bots between hands; disconnected people keep their seats for reconnecting. Rematches retain the bots and table size. Refreshing automatically restores the player's seat using a room-specific token. `/table` still opens the legacy shared table in development.

For a phone on the same network, use your computer's LAN address. If the backend is elsewhere, set `NEXT_PUBLIC_SERVER_URL` before starting/building the web app.

## Tailscale preview

Run `npm run dev:preview:server` and `npm run dev:preview` in separate terminals. Open http://michaels-mac-mini.tail7c0eb7.ts.net:3100 from a device connected to Tailscale. This preview uses ports 3100/3101. `NEXT_PUBLIC_SERVER_PORT` sets the backend port while preserving the page hostname, so remote devices connect to the correct machine. Avoid a localhost `NEXT_PUBLIC_SERVER_URL` for remote testing.

## What is playable

- Draw, inspect/select, discard, ăn chắn/cạ, manual chíu and simplified Ù.
- Four-player practice with paced bots, pause/resume, round outcomes and replay.
- Four/five-seat private rooms with two or more people, optional bot fill, and automatic reconnect.
- Rank-sorted hand, enlarged selected-tile preview, exposed sets and discard history.
- English guidance with Vietnamese game terms and original card faces.

## Board and gates

Seats run clockwise around the wall, with your seat at the bottom. A gate is the receiving area between a player and the preceding seat. Draws appear at the drawing player's gate; a passed draw moves to the next gate. Ordinary discards go to the next gate, and Chíu returns go to the interrupted gate. The gold gate marks the offered card's location; a separate player outline marks the current responder, who may be elsewhere.

Every gate displays its three most recent unclaimed cards. Expand “+ earlier” to see older cards in place, or tap the gate heading for the complete list with draw/discard/return origin and who passed. Claimed cards leave the gate and stay in the claimant's exposed sets. The same offered card also appears beside the hand controls. Tile proportions, concealed-hand layout, visible melds and shared matching highlights are retained.

New public-card metadata tracks provenance without changing card ownership or the rules. Old saves show their remaining public cards with unknown origin; future actions acquire full metadata. Four/five-player grids grow with text instead of clipping or adding nested scroll areas. Touch WebKit uses its Dynamic Type root font; board labels use relative sizing. Crowded layouts were checked at 320px/390px widths with 200% text; larger text may require vertical page scrolling. `/board-preview` is a development-only layout fixture, not a live game.

## Table sounds

In practice or multiplayer, **Vietnamese calls are enabled by default at 65% volume**. Tap the table once to unlock browser audio. Until activated, the footer says **Tap for sound** (Chạm để bật tiếng). Safari activation requests playback routing where supported, primes the output during the tap, and retries an existing audio context when returning from the background. Sound settings include previews and iPhone troubleshooting. A saved Off preference is respected. Tap the speaker beneath the hand to change settings. Calls include “Bốc!”, “Ăn!”, “Chíu!”, “Ù! Ù rồi!” and “Chíu! Ù luôn!”, or choose calls with the claimed card’s name, effects only, or off. Preview buttons and a volume slider are included in English and Vietnamese. Preferences stay on the device; after a reload, tap the table to enable playback again.

Short effects follow accepted public draws, discards, claims and wins. Private claim opportunities make no sound. Initial snapshots, duplicate revisions, reconnect catch-up and background activity remain silent. There is no speech backlog: routine calls cannot interrupt Chíu, and Ù takes priority. Practice assigns the deeper voice to Minh and the brighter voice to Lan and Mai; real players' names do not determine their voice. The deep preset preserves the audition Michael accepted as closer to his family's Bắc 54 accent. These are stock synthetic voices, not recordings of family members or certified dialect models.

The current pack adds presence EQ, pitch-preserving slower Chíu/Ù, and quieter effects under speech. Ăn/Chíu effects are soft paper rustles without the old click. Draws retain a paper flip and light landing; discards retain the soft landing. The sound settings offer both voices for preview.

Assets: `apps/web/public/audio/table-v3` (70 voices and 5 effects). The manifest records phrases, provider context IDs, processing and checksums. Generate each phrase using deep and crisp presets, then run `python3 apps/web/scripts/prepareTableVoices.py male-results.json female-results.json`. Provider URLs are temporary; imported audio is served locally. Older packs remain for comparison. Tests: `node --import tsx --test apps/web/src/lib/tableAudio.test.ts apps/web/src/lib/tableSoundEvents.test.ts`.

### Landscape tablets

At landscape widths of 960px and above, the board is beside the hand and controls. Tall tile proportions, the two-row hand and exposed sets remain visible. Exposed pairs use a fixed fan and reserved slots (12 for four players, 10 for five), so accumulating sets does not resize the board. Turn labels, gate cards and the hand reserve their space. Clockwise arrows and explanatory labels are removed. Claims and Bốc/Bỏ share one compact 48px-high action row; claims get modestly more horizontal width. Gate headings open the full history; the latest three cards remain visible. Normal crowded four- and five-player fixtures fit at 1024×700. Enlarged accessibility text can grow vertically without clipping. Full gate histories open in sheets instead of expanding the board. After Ù, all winning cards are shown in a bounded reveal inside the hand column; losing players can still inspect their own hand. Development-only `/table-preview?players=5&crowded=1` exercises the full layout; `large=1` tests 200% text, `draw=1` starts an opening hand, and `won=1` shows the result. The preview footer advances through empty, partial, Chíu, maximum exposure, and winning states without affecting saved games.


## Rules scope

This is a 120-card family variant with rules shared by practice and multiplayer. Four players receive 24/23/23/23 cards; five receive 20/19/19/19/19. The opener declares an immediate Ù if eligible or discards without drawing. The previous winner opens the next hand.

A winning hand has every card paired: 12 pairs with at least eight Chắn for four players, or 10 pairs with at least six Chắn for five. Concealed pairs count and Chíu counts as two Chắn. Draws are public; claims, returns, pass/discard restrictions and full winning-hand reveal are enforced by one state machine.

New hands use rule profile 4, incorporating family questionnaire agreements and the later Nhất/Yêu correction. Existing profile-2/3 practice hands keep their prior rules until the next hand. See the [public rules overview](docs/public-rules.md) for the current behavior and unresolved choices. Full cước scoring and disputed house rules remain unfinished.

## Project structure

- `apps/web`: Next.js UI. Home, practice, room entry and multiplayer use the new design.
- `apps/server`: Express + Socket.IO authoritative multiplayer service.
- `packages/game`: shared deck, types, projections, win evaluator, practice reducer and tests.
- `apps/web/public/tiles/png`: original tile artwork.
- `MVP_PLAN.md`: implemented scope and remaining release gates.

## Verification

```bash
npm run test -w @bai-chan/game
npm run build -w apps/server
npm run build -w apps/web
# With a disposable test server running on port 3101:
TEST_SERVER_URL=http://localhost:3101 node apps/server/mvp-smoke.mjs
```

The game suite includes 230 complete simulated hands and verifies tile conservation, deal sizes, eligibility, pass penalties, wins with exposed sets and illegal actions. The socket smoke test creates isolated rooms and checks deal/action validation, hidden hands and token-based rejoin.

`npm run lint -w apps/web` still includes pre-existing errors in unused legacy/debug components. The rebuilt gameplay and entry files pass lint.

## Runtime settings and release limits

Server: `PORT` (3001), `JWT_SECRET`, `DEFAULT_ROOM_ID` (000000), `LOGS_DIR` (defaults to `apps/server/logs`). Web: `NEXT_PUBLIC_SERVER_URL` (defaults to current hostname, port 3001).

The local Socket.IO preview keeps multiplayer rooms in memory, so its rooms disappear on server restart. The [public game](https://bai-chan-play.white-violet-3211.workers.dev/) uses a Durable Object per private invitation room and persists its table state. See [the public multiplayer deployment guide](docs/deployment/PUBLIC_MULTIPLAYER.md) for release commands and remaining checks. Full scoring remains a follow-up rule task.


## Mixed-table verification

The server schedules one bot action at a time using the shared practice policy and round transition. Human turns wait for human input. No bot replaces a disconnected person, and bot timers stop when everyone disconnects, the hand ends, or the table resets/restarts. `BOT_DELAY_MS` defaults to 1100ms; use 30ms only for isolated integration tests.

`apps/server/bots-smoke.mjs` requires `TEST_SERVER_URL` pointing to an isolated server. It exercises complete 2+2, 2+3, 3+1 and 3+2 tables, host/size restrictions, private hands, new people replacing bots, rematches, reconnects and reset cleanup. `mvp-smoke.mjs` retains all-human four/five-player coverage.

Direct HTTP Tailscale previews on port 3100 connect to backend port 3101. The HTTPS Funnel uses its own origin; its existing invitation-protected proxy must forward `/rooms`, `/room/default`, `/health`, and `/socket.io/*` to port 3101. The rest goes to the web app. Keep the existing invitation access and do not add password authentication.


## Tile size and recent actions

Open **Settings / Cài đặt** below the hand for both tile size and sound. **Automatic / Tự động**, **Large / Lớn** (1.5×), and **Extra large / Rất lớn** (2×) are saved per browser/device. The phone's larger text setting takes precedence if it needs still-larger tiles. A live two-card preview shows the result. Preferences do not change rules, seats, sounds, or another player's view.

Recent actions reserve room for four two-line entries on phones (more fit when entries use one line), scaling with text. Landscape tablets use four single-line entries. This fixed-height area scrolls to older actions; its list icon opens complete history. Very long entries are abbreviated in the compact list, with full text in history. Increasing the visible history adds board height, including a small increase on landscape tablets.
