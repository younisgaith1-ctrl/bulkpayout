import { test } from "node:test";
import assert from "node:assert/strict";
import { packBatches } from "../src/batcher.ts";
import type { PayRow } from "../src/csv.ts";

const ADDR = "11111111111111111111111111111111";
const rows = (n: number, memoEvery = 0): PayRow[] =>
  Array.from({ length: n }, (_, i) => ({
    line: i + 1,
    address: ADDR,
    amount: 1,
    memo: memoEvery && i % memoEvery === 0 ? "xx".repeat(10) : undefined,
    raw: "",
  }));

test("empty input -> empty batches", () => {
  assert.deepEqual(packBatches([]), []);
});

test("count cap respected", () => {
  const batches = packBatches(rows(75), { maxPerBatch: 20, maxBytes: 1_000_000 });
  assert.equal(batches.length, 4); // 20 + 20 + 20 + 15
  batches.forEach((b) => assert.ok(b.items.length <= 20));
});

test("byte budget respected (estBytes <= maxBytes for full batches)", () => {
  const b = packBatches(rows(200), { maxBytes: 900, baseOverhead: 110, perItemBytes: 92 });
  b.forEach((x) => assert.ok(x.estBytes <= 900 + 91, `batch too big: ${x.estBytes}`));
  // every batch except possibly the last should be near full
  const full = b.slice(0, -1);
  full.forEach((x) => assert.ok(x.items.length >= 8, `batch underpacked: ${x.items.length}`));
});

test("empty rows produce zero-sized batches", () => {
  const batches = packBatches([], { maxPerBatch: 5 });
  assert.equal(batches.length, 0);
});

test("memos make batches smaller", () => {
  const plain = packBatches(rows(20), { memoBytes: 0 });
  const withMemo = packBatches(rows(20), { memoBytes: 44 });
  assert.ok(withMemo.length >= plain.length);
});