# BulkPayout — 3-minute demo video script (no funds needed)

Purpose: show judges a working, real product. Everything below works with an
empty wallet — simulation needs no tokens. If you grab devnet SOL from a
faucet, the final "Send" step becomes a real on-chain payroll.

## Script (record screen, phone or OBS)

**0:00–0:20 — Hook (no talking needed, just text overlay)**
- Open https://younisgaith1-ctrl.github.io/bulkpayout/
- Title card text: "Pay 100 people at once. No custody. No custom contract."

**0:20–0:50 — Load payroll**
- Click "Load sample" (or drag a CSV).
- Show the table: 3 recipients, amounts, memos. Say (or subtitle):
  "Payroll, rewards, refunds — just paste address, amount, memo."

**0:50–1:30 — Build transactions**
- Keep "Devnet USDC" preset.
- Click "Connect wallet" (user clicks through in Phantom), or just type the
  wallet address in the payer box so no wallet is needed on camera.
- Click "Build transactions".
- Show the batch cards: N payouts, tokens total, byte size, fee quote.
  Say: "Every recipient becomes one on-chain transferChecked instruction —
  batched into real Solana transactions, each under the 1232-byte limit."

**1:30–2:20 — Simulate on chain (the selling point)**
- Click "Simulate all on chain".
- Show "fee≈… SOL" + "sim: ok" badges.
  Say: "We simulate every transaction on devnet before you spend a single
  lamport — per-recipient amounts, ATA creation for new wallets, fees."

**2:20–3:00 — Why it matters + close**
- Overlay bullets:
  - No custody — your wallet signs locally
  - No custom contract — audited Solana token primitives only
  - Open source — link github.com/younisgaith1-ctrl/bulkpayout
- Say: "Built for the Solana ecosystem. Payrolls, airdrops, refunds —
  bring treasury ops on-chain, safely."

## Optional extra (if devnet SOL obtained)
- Fund the wallet from https://faucet.solana.com
- Click "Sign & send" → show the transaction landing on
  https://solscan.io (devnet) live.

## Recording tips
- 720p+, landscape, clean tab, default browser zoom.
- Keep the three file tabs open: app, solscan, faucet.
- One take; do not stop to fix mistakes — retake only if it breaks the flow.