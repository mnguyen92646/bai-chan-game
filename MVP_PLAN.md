# Mobile MVP pass

## Goal
Open the game on a phone and play a complete hand immediately; invite family into a private multiplayer room using the same table UI.

## This pass
1. Reuse the original 30 tile faces and family deck/deal model.
2. Extract the pure deck, state and win helpers into a shared package; add a deterministic, testable practice reducer and basic bots.
3. Create an ink-green / ivory / brass mobile UI: home, two-row tile rack, table, contextual actions, rules sheet and round summary.
4. Add instant four-player practice, local resume, and paced bots; support draw, discard, ăn, manual chíu, Ù and wall exhaustion.
5. Rebuild private-room entry and multiplayer table, including automatic reconnect and visible errors.
6. Verify rules/conservation, production builds, changed-file lint and phone/desktop browser flow.

## Rules boundaries

**Research update (2026-09-15):** See [state-machine research](docs/rules/STATE_MACHINE_RESEARCH.md) and [video card notes](docs/rules/VIDEO_CARD_NOTES.md). The inherited private-draw flow, opening and win formula are not validated against the referenced games or family play. The next engine pass must resolve rule profiles, public claim/pass windows, chíu return cards and exhaustion policy before claiming rules fidelity.
The 120-card family variant is retained. The running server currently allows any held tile to be discarded, despite older handoff text describing pair restrictions; this pass follows actual runtime behavior. Scoring remains the existing simplified pair + round-group model, with exposed melds included. Full traditional cước scoring and family-rule certification are follow-up work.

## Later release gates
- Family validation of ăn/chíu timing and four/five-player scoring.
- Persistent multiplayer rooms, rate limits and production secrets/CORS.
- Hosted HTTPS websocket service and public deployment.
- More capable bots, Vietnamese UI parity and optional sound.

## Verification results
- Server and web production builds pass.
- Eight game tests pass, including 200 complete hands with exact tile conservation.
- Four-client socket smoke passes: minimum player count, turns, private hands, late joins and reconnect.
- Browser verified: practice draw/discard, bot turns, cạ claim, enlarged tile inspection, local resume, private room creation/deal and refresh during a 24-tile hand.
- Mobile layouts checked at 320px and 390px; desktop checked separately.
- Rebuilt gameplay files pass lint. Full web lint retains 11 errors and 11 warnings in legacy/debug code.
