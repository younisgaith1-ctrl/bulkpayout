# BulkPayout — Crypto World's Fair status & plan

## Target
- **Crypto World's Fair** (Colosseum, online global hackathon)
- Submissions due **Oct 12, 2026** (~3 days)
- Prize pool **$840,000** + $2.5M seed
- **Solana ecosystem track: 10 × $10,000** (highest probability lane)
- Register: https://colosseum.com/worldsfair (needs a wallet = user task)

## Product
BulkPayout — mass SPL token payouts (payroll / airdrops / refunds) with:
- CSV upload (address, amount, memo)
- Batched `transferChecked` txns, no custom contract (audited primitives only)
- Simulate mode on devnet without funds + real send via wallet
- PWA, wallet-standard connect (Phantom/Solflare)

## Status (Oct 9)
- [x] README + package.json
- [x] `src/address.ts` — zero-dep base58 validate (32-byte pubkeys)
- [x] `src/csv.ts` — CSV/TSV parse + validation (comments, memos ≤32, bad rows skipped)
- [x] `src/batcher.ts` — greedy byte-budget packing (950B soft cap)
- [x] `src/transfer.ts` — spl-token transferChecked + ATA resolve (web3.js)
- [x] tests 15/15 passing (`node --test tests/*.test.ts`)
- [ ] npm install (@solana/web3.js, @solana/spl-token) + real txn assembly test on devnet
- [ ] PWA UI: wallet connect, CSV drag&drop, batch preview, simulate + send
- [ ] Push to GitHub (public repo), README polish
- [ ] Submission package: demo video script, written description, repo link

## User tasks (all at submission time, ~15 min total)
1. Create a Solana wallet (Phantom or Solflare; devnet funded optional for simulate-only demo)
2. Register at colosseum.com/worldsfair before Oct 12
3. Record a 2–3 min demo video (I provide the script + can do a screen run-through with them)

## Risks / notes
- Deadlines fixed; judging after Oct 12, winners announced later (delayed payout, like STREAM/Madrid)
- Competition real; we win by shipping a working, useful product with a clean demo
- Honest boundary: payout lands in the user's wallet/KYC — no platform pays a third party