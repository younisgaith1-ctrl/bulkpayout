/**
 * Pack a list of payouts into Solana transactions under a byte budget.
 *
 * A Solana transaction has a hard wire limit of 1232 bytes. We keep a
 * conservative soft cap (default 950 bytes) so the assembled
 * VersionedTransaction + signatures always fit, then we verify the real
 * serialized size before sending (see transfer.ts). Batching is greedy and
 * deterministic so tests are stable.
 */
import type { PayRow } from "./csv.ts";

export interface PackOptions {
  /** Soft cap on one transaction's serialized size (bytes). Default 950. */
  maxBytes?: number;
  /** Hard cap on payouts per transaction. Default 20. */
  maxPerBatch?: number;
  /** Fixed overhead: headers + blockhash + instruction counts + 1 signature. Default 110. */
  baseOverhead?: number;
  /** Conservative bytes per transferChecked instruction (no memo). Default 92. */
  perItemBytes?: number;
  /** Extra bytes when a memo is attached. Default 44. */
  memoBytes?: number;
}

export interface PackedItem {
  row: PayRow;
  /** index in the original rows array */
  index: number;
}

export interface Batch {
  items: PackedItem[];
  /** estimated serialized size in bytes */
  estBytes: number;
}

export function packBatches(rows: PayRow[], opts: PackOptions = {}): Batch[] {
  const maxBytes = opts.maxBytes ?? 950;
  const maxPerBatch = opts.maxPerBatch ?? 20;
  const baseOverhead = opts.baseOverhead ?? 110;
  const perItemBytes = opts.perItemBytes ?? 92;
  const memoBytes = opts.memoBytes ?? 44;

  const batches: Batch[] = [];
  let cur: PackedItem[] = [];
  let curBytes = baseOverhead;

  const flush = () => {
    if (cur.length > 0) {
      batches.push({ items: cur, estBytes: curBytes });
      cur = [];
      curBytes = baseOverhead;
    }
  };

  rows.forEach((row, index) => {
    const itemBytes = perItemBytes + (row.memo ? memoBytes : 0);
    const wouldFit = curBytes + itemBytes <= maxBytes;
    const withinCount = cur.length < maxPerBatch;
    if (cur.length > 0 && (!wouldFit || !withinCount)) flush();
    cur.push({ row, index });
    curBytes += itemBytes;
  });
  flush();
  return batches;
}