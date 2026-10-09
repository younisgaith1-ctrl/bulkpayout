/**
 * Zero-dependency Solana base58 helpers (32-byte pubkeys).
 * Runs under Node >= 24 type-stripping and in the browser.
 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const MAP = new Map<string, bigint>();
for (let i = 0; i < ALPHABET.length; i++) MAP.set(ALPHABET[i], BigInt(i));

export function normalize(s: string): string {
  return s.trim();
}

export function decode(s: string): Uint8Array {
  if (!s) throw new Error("empty base58 string");
  let num = 0n;
  for (const ch of s) {
    const v = MAP.get(ch);
    if (v === undefined) throw new Error(`invalid base58 character: ${JSON.stringify(ch)}`);
    num = num * 58n + v;
  }
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }
  const out = new Uint8Array(zeros + bytes.length);
  out.set(bytes, zeros);
  return out;
}

export function encode(bytes: Uint8Array): string {
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let leading = 0;
  while (leading < bytes.length && bytes[leading] === 0) leading++;
  let out = "";
  while (num > 0n) {
    out = ALPHABET[Number(num % 58n)] + out;
    num /= 58n;
  }
  return "1".repeat(leading) + out;
}

/** A valid Solana pubkey is exactly 32 bytes. */
export function isValidPubkey(s: string): boolean {
  const t = s.trim();
  if (t.length < 32 || t.length > 44) return false;
  try {
    return decode(t).length === 32;
  } catch {
    return false;
  }
}

export function assertPubkey(s: string, ctx: string): string {
  const t = s.trim();
  if (!isValidPubkey(t)) throw new Error(`${ctx}: invalid Solana address "${s}"`);
  return t;
}