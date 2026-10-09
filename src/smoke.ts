/**
 * Quick smoke run: parse a sample CSV -> pack into batches -> print summary.
 * Zero external deps (runs with `node src/smoke.ts`).
 */
import { parsePayoutCsv } from "./csv.ts";
import { packBatches } from "./batcher.ts";

const SAMPLE = `# BulkPayout sample - replace with your own payroll
address,amount,memo
11111111111111111111111111111111,5.0,test
4Nd1mGtJNP5cfXDj3bQQrH4EJFz6P2wMzE4Q5C2YTqR1,12.5,oct bonus
11111111111111111111111111111111,0.25,
GVmG2cVNgx5sX8dCw2vU4B6g9aXbQ1eK3sTfPmNkLcRe,100,payroll`;
const FIVE = "11111111111111111111111111111111";

const result = parsePayoutCsv(SAMPLE);
console.log(`parsed ${result.rows.length} rows, skipped ${result.skipped}`);
result.rows.forEach((r) =>
  console.log(`  ${r.line}: ${r.address.slice(0, 8)}... ${r.amount}${r.memo ? " memo=" + r.memo : ""}`)
);

const wide = Array.from({ length: 75 }, (_, i) => ({
  line: i + 10,
  address: FIVE,
  amount: 1 + i * 0.1,
  memo: i % 3 === 0 ? "periodic bonus" : undefined,
  raw: "",
}));
const batches = packBatches(wide);
console.log(`packed 75 rows into ${batches.length} transactions`);
batches.forEach((b, i) =>
  console.log(`  tx ${i + 1}: ${b.items.length} payouts, est ${b.estBytes} bytes`)
);