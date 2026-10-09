import { test } from "node:test";
import assert from "node:assert/strict";
import { decode, encode, isValidPubkey, assertPubkey } from "../src/address.ts";

const KNOWN = "4Nd1mGtJNP5cfXDj3bQQrH4EJFz6P2wMzE4Q5C2YTqR1"; // 32-byte base58
const SYSTEM = "11111111111111111111111111111111";

test("base58 roundtrip", () => {
  const bytes = decode(KNOWN);
  assert.equal(bytes.length, 32);
  assert.equal(encode(bytes), KNOWN);
});

test("all-zero address decodes to 32 zero bytes", () => {
  const bytes = decode(SYSTEM);
  assert.equal(bytes.length, 32);
  assert.deepEqual(Array.from(bytes), Array(32).fill(0));
});

test("invalid chars rejected", () => {
  assert.throws(() => decode("00llo!!"), /invalid base58/);
});

test("isValidPubkey", () => {
  assert.equal(isValidPubkey(KNOWN), true);
  assert.equal(isValidPubkey(SYSTEM), true);
  assert.equal(isValidPubkey("short"), false);
  assert.equal(isValidPubkey(KNOWN + "9"), false); // too long
  assert.equal(isValidPubkey("0llo"), false);
});

test("assertPubkey throws with context", () => {
  assert.throws(() => assertPubkey("nope", "line 3"), /line 3/);
});