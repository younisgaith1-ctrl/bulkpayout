/**
 * Real devnet connectivity check for the transaction assembler.
 * Builds batches for a sample payroll and verifies: real blockhash,
 * serialized sizes under the 1232B limit, fee quotes, simulation behavior.
 *
 * Run: node src/devnet-check.ts
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { parsePayoutCsv } from "./csv.ts";
import { buildAll, feeAndSimulateAll, MAX_TX_BYTES } from "./transfer.ts";

const DEVNET_USDC = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKXV";
const PAYER = "EfXwU8P7Q7bbW1yPavVn2hM5Pf4hBEZBv9D3GX5jQJ9q"; // random devnet-ish key, not ours

const SAMPLE = `address,amount,memo
11111111111111111111111111111111,5.0,oct bonus
4Nd1mGtJNP5cfXDj3bQQrH4EJFz6P2wMzE4Q5C2YTqR1,12.5,payroll
GVmG2cVNgx5sX8dCw2vU4B6g9aXbQ1eK3sTfPmNkLcRe,100,`;

async function main(): Promise<void> {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const rows = parsePayoutCsv(SAMPLE).rows;
  console.log(`parsed ${rows.length} rows; connecting to devnet…`);

  const { batches, blockhash } = await buildAll(rows, {
    payer: new PublicKey(PAYER),
    mint: new PublicKey(DEVNET_USDC),
    decimals: 6,
    connection,
  });

  console.log(`blockhash: ${blockhash}`);
  let ok = true;
  for (const b of batches) {
    const size = b.bytes + 64; // +1 signature
    console.log(`tx ${b.index + 1}: ${b.items.length} payouts, message ${b.bytes}B (+64 sig = ${size}B) ${size <= MAX_TX_BYTES ? "✓" : "✗ OVER LIMIT"}`);
    if (size > MAX_TX_BYTES) ok = false;
  }

  const results = await feeAndSimulateAll(batches, connection);
  for (const r of results) {
    console.log(`tx ${r.index + 1}: fee=${r.feeLamports != null ? r.feeLamports + " lamports" : "n/a"} sim=${r.simulateError ?? "ok"}`);
    if (r.simulateLogs.length) console.log(`   last log: ${r.simulateLogs[r.simulateLogs.length - 1]?.slice(0, 120)}`);
  }

  console.log(ok ? "\nALL SIZE CHECKS PASSED" : "\nSIZE LIMIT VIOLATION");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("devnet check failed:", e);
  process.exit(1);
});