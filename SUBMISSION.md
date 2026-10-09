# BulkPayout — written submission (paste-ready for Colosseum form)

## Project name
BulkPayout — Mass SPL token payouts on Solana

## One-liner
Pay 100 recipients in any SPL token with batched, size-checked Solana
transactions — no custody, no custom contract, simulate before you send.

## Problem
Payroll, community rewards, airdrops, and refunds on Solana are done with
slow one-by-one scripts or by trusting custodial dashboard tools. Teams need
a way to batch-pay large recipient lists while keeping funds in their own
wallet and using only audited primitives.

## Solution
A wallet-connected PWA that turns a CSV of `address, amount, memo` rows into
real batched Solana transactions:
- CSV import with local validation (base58 check, amount > 0, memo ≤ 32 chars)
- Byte-budget batching under the 1232-byte transaction limit
- Per-recipient ATA creation + `transferChecked` (Token Program) + optional
  SPL memo — no custom smart contract, no custody
- On-chain simulation of every batch before spending a lamport (works with
  zero funds — great for auditability)
- Optional live send on devnet/mainnet with the connected wallet

## Why it's different
- **Safer**: funds never leave the user's wallet; app is only a
  builder/signer UI.
- **Verifiable**: every instruction is a standard Token Program call —
  no hidden logic to audit.
- **Immediate**: from CSV to signed transactions in seconds.

## Impact / who it serves
Treasury managers, guild leads, token projects, event organizers, and
community teams that run recurring payouts without engineering staff.

## Tech
TypeScript · @solana/web3.js + @solana/spl-token · esbuild-bundled PWA ·
GitHub Pages hosting · 15 unit tests · live devnet verification script
(`npm run check`).

## Links
- Live app: https://younisgaith1-ctrl.github.io/bulkpayout/
- Repo: https://github.com/younisgaith1-ctrl/bulkpayout
- Demo video: [link to uploaded video]