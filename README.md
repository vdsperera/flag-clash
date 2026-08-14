# Flag Clash — Project Description

## Concept

A single-page web app where two national flags (currently India and Sri Lanka) are
stacked directly on top of each other in the same space. Users back one flag or
the other, and each click "pushes" that flag to become more visually dominant —
more opaque, on top in the stacking order — while the other flag fades and sinks
behind it. If one side pulls far enough ahead, its flag becomes fully clear and
the other becomes fully hidden.

Each point now costs real money (simulated for now): **0.1 USDT per click**,
paid out of an in-app wallet that the user tops up.

Think of it as a "tug of war" / crowd-support visualization, similar in spirit to
online fundraiser battles or vote-with-your-wallet contests — except the visual
payoff is literal: the flag with more backing becomes clearer.

## Core Mechanics

### 1. Side selection
- User picks a side via:
  - `Numpad 1` → back India
  - `Numpad 2` → back Sri Lanka
  - Clicking directly on either flag
  - Clicking either half of the scoreboard
- The selected side is highlighted (gold border/label) in the scoreboard and on
  the flag itself.

### 2. Scoring / clicking
- Once a side is selected, **any other click on the page** registers a point for
  that side — provided the wallet has enough balance.
- Each point costs `POINT_COST = 0.1` USDT, deducted from the wallet immediately.
- If the wallet balance is insufficient, the click is rejected, a message
  prompts the user to top up, and the Top Up button pulses to draw attention.

### 3. Visual reveal formula
- `diff = scoreIndia − scoreSriLanka`
- `diffClamped = clamp(diff, −THRESHOLD, THRESHOLD)` where `THRESHOLD = 10`
- `opacityIndia = 0.5 + (diffClamped / THRESHOLD) * 0.5` → ranges 0 to 1
- `opacitySriLanka = 1 − opacityIndia`
- At a tie, both flags sit at 50% opacity (evenly overlapped).
- At `|diff| >= THRESHOLD` (a 10-point lead), the leading flag is fully opaque
  (1.0) and the trailing flag is fully transparent (0.0) — "hidden behind."
- The flag currently ahead is also raised to the top `z-index`.
- A thin gold "seam" line between the flags drifts toward whichever side is
  winning, as an extra visual cue of the pull direction.
- `THRESHOLD` and `POINT_COST` are both single constants near the top of the
  script — trivial to retune.

### 4. Wallet (currently simulated)
- A wallet bar at the top shows a balance in USDT, labeled "ERC-20 · simulated"
  (network chosen for future real integration: **Ethereum / ERC-20**).
- **Top Up** opens a modal with quick preset amounts (+5 / +10 / +25 / +50
  USDT). Selecting one plays a ~1.4s "Confirming transaction on-chain…" spinner
  (purely cosmetic delay) and then credits the balance.
- **No real cryptocurrency, wallet connection, or blockchain call is involved
  yet.** This is a front-end-only simulation for prototyping the flow and UX.
- A "Reset wallet" button and a "Reset scores" button are provided for testing.

## Current Tech Implementation

- **Single self-contained HTML file** (`flag-clash.html`) — no build step, no
  dependencies, no backend. Pure HTML/CSS/vanilla JS.
- Flags are drawn as inline **SVG** (not raster images), so they scale cleanly:
  - India: three horizontal bands (saffron/white/green) with a 24-spoke Ashoka
    Chakra generated programmatically.
  - Sri Lanka: simplified lion flag — maroon field with gold border, green and
    orange vertical stripes at the hoist, and a stylized lion emblem with
    corner bo leaves rendered as simple shapes (not a pixel-accurate emblem).
- All state (scores, wallet balance, selected side) lives in plain JS variables
  in a single closure — no persistence, resets on page reload.
- Fully responsive layout; works on mobile (numpad keys obviously won't apply
  there, but click/tap selection does).
- `prefers-reduced-motion` respected for transitions.

## What's Explicitly NOT Built Yet (real-money path)

This is the important part for a handoff — the payment layer is a UI mockup,
not a working payment system. To make it real, the following pieces are
needed and are **not present**:

1. **Wallet connection** — e.g. MetaMask / WalletConnect / RainbowKit
   integration to let a user connect an actual Ethereum wallet.
2. **On-chain USDT transfer** — a real ERC-20 `transfer` call from the user's
   wallet to a receiving address, using a library like `ethers.js` or `viem`.
3. **Backend verification** — a server that watches for the incoming
   transaction, confirms it on-chain (correct token, amount, recipient,
   sufficient confirmations), and *only then* credits the user's in-app
   balance. Crediting balance purely from client-side "I sent it, trust me"
   logic is not safe — funds could be faked.
4. **Custody / balance ledger** — a database mapping wallet addresses (or
   accounts) to USDT balances and point-spend history, since balances can't
   safely live only in browser memory once real money is involved.
5. **Withdrawal path** (if needed) — if users should be able to cash out
   unspent balance, that's a separate flow requiring its own security review.
6. **Compliance considerations** — depending on the jurisdiction and how the
   "winning" flag mechanic is framed (pure visualization vs. any kind of
   payout/reward for backing the winning side), this may need to be reviewed
   against gambling/money-transmission regulations before going live with real
   funds. Nothing about the current build implies a payout to users — it's a
   visual support/backing mechanic only — but that's worth confirming
   explicitly before real money is involved.

## Suggested Next Steps (for whoever picks this up)

1. Wire up a real wallet connector (MetaMask first) for read-only balance
   display and "connect wallet" UX.
2. Stand up a minimal backend (even a lightweight serverless function) that
   can verify an incoming USDT transfer on Ethereum and credit balance.
3. Move scores/wallet state server-side so it can't be manipulated by editing
   client JS.
4. Decide whether flags/points should be per-user-global (everyone sees the
   same running total, like a live leaderboard) or per-session/local — the
   current build is local-only and resets per browser tab.
5. Optionally support more flag pairs / a config-driven flag list instead of
   the two hardcoded flags.

## File

- `flag-clash.html` — the full working prototype described above.
