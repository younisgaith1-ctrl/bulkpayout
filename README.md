# BulkPayout — Mass SPL token payouts on Solana (Crypto World's Fair entry)

**Category:** Crypto World's Fair · Solana Ecosystem track (10 × $10,000)
**Submission due:** Oct 12, 2026

A wallet-connected progressive web app to pay many recipients in any SPL
token in one place:

- Upload a CSV of `address, amount, memo` rows
- We build **batched `transferChecked` transactions** (Token / Token-2022 —
  no custom program, audited primitives only)
- Configurable batch size, priority fees (compute unit price + limit),
  and per-transfer memo
- Send → track → resubmit failed transactions
- **Simulate mode**: preview every transaction on devnet without funds,
  including per-recipient amounts and estimated fees

## Why it matters
Payroll, community rewards, airdrops, refunds, and loyalty payouts are
currently done with slow one-by-one scripts or by trusting third-party
dashboard tools with custody. BulkPayout keeps custody fully in the user's
wallet: the app is only a transaction builder/signer UI.

## Highlights
- No custody: everything signed locally by the connected wallet
- No custom smart contract → only audited Solana token primitives
- Real batching logic with byte-budget packing (see `src/batcher.ts`)
- Zero-dependency base58 + CSV validation local to the client
- Vanilla TS, runs on Node ≥ 24 (type-stripping) and in the browser

## Run & demo
Live (GitHub Pages): **https://younisgaith1-ctrl.github.io/bulkpayout/**

```bash
npm install
npm test                  # 15 unit tests
npm run check             # real devnet check: blockhash, sizes, fees, simulation
npm run build             # bundles the PWA (bundle.js, no framework)
npm run serve             # http://localhost:4173 (ui/app.ts source)
```

Demo flow (no devnet tokens required):
1. Paste the sample CSV → valid rows are validated locally.
2. Keep **Devnet USDC** preset (Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKXV).
3. Connect a wallet (or type a payer) → **Build transactions**: every payout
   becomes a real, size-checked `transferChecked` transaction.
4. **Simulate all on chain** → per-batch fee quotes + program logs (this works
   with zero funds — great for judges).
5. Optional: fund the wallet from https://faucet.solana.com, then
   **Sign & send** for a live devnet payroll.

## Repo layout
```
src/csv.ts        CSV parsing + validation
src/address.ts    Solana base58 validate/normalize (zero-dep)
src/batcher.ts    pack transfers into transactions under a byte budget
src/transfer.ts   real tx assembly (ATA creation + transferChecked + memo)
src/devnet-check.ts  live devnet verification script
ui/app.ts         PWA source (bundled by esbuild)
index.html        PWA shell (served by GitHub Pages)
bundle.js         bundled app
tests/            node:test suites
```