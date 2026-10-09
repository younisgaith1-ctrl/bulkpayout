import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePayoutCsv } from "../src/csv.ts";

const GOOD = `# comment
address,amount,memo
11111111111111111111111111111111,5.0,test
4Nd1mGtJNP5cfXDj3bQQrH4EJFz6P2wMzE4Q5C2YTqR1,12.5,oct bonus`;

test("parses valid rows, skips comments", () => {
  const r = parsePayoutCsv(GOOD);
  assert.equal(r.rows.length, 2);
  assert.equal(r.skipped, 0);
  assert.equal(r.rows[1].amount, 12.5);
  assert.equal(r.rows[1].memo, "oct bonus");
});

test("skips invalid addresses and non-positive amounts", () => {
  const r = parsePayoutCsv(
    "address,amount\n11111111111111111111111111111111,-5\nnot-a-key,10\n11111111111111111111111111111111,0\n11111111111111111111111111111111,3\n"
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].amount, 3);
  assert.equal(r.skipped, 3);
});

test("header validation throws when columns missing", () => {
  assert.throws(() => parsePayoutCsv("foo,bar\n1,2"), /must include an address column/);
});

test("memo truncated to 32 chars", () => {
  const r = parsePayoutCsv(
    `address,amount,memo\n11111111111111111111111111111111,1,${"x".repeat(60)}\n`
  );
  assert.equal(r.rows[0].memo!.length, 32);
});

test("tabs and semicolons accepted as delimiters", () => {
  const r = parsePayoutCsv(
    "address;amount\n11111111111111111111111111111111\t2.5\n"
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].amount, 2.5);
});