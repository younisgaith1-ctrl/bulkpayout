/**
 * CSV/TSV parsing + validation for payroll rows.
 * Accepted headers (case-insensitive): address, amount, memo
 * amount is in human units (e.g. 12.5); decimals are applied at build time.
 */
import { isValidPubkey, normalize } from "./address.ts";

export interface PayRow {
  line: number;
  address: string;
  amount: number;
  memo?: string;
  raw: string;
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if ((c === "," || c === "\t" || c === ";") && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const HEADER_ALIASES: Record<string, "address" | "amount" | "memo"> = {
  address: "address",
  addr: "address",
  wallet: "address",
  receiver: "address",
  recipient: "address",
  amount: "amount",
  value: "amount",
  qty: "amount",
  memo: "memo",
  note: "memo",
  reference: "memo",
};

export interface CsvParseResult {
  rows: PayRow[];
  skipped: number;
}

export function parsePayoutCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/);
  const rows: PayRow[] = [];
  let header: ("address" | "amount" | "memo")[] | null = null;
  let skipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      if (trimmed === "" || trimmed.startsWith("#")) continue;
    }
    const cells = splitLine(raw);
    if (!header) {
      if (cells.length === 0) continue;
      header = cells.map((c) => HEADER_ALIASES[c.toLowerCase()] ?? null);
      if (!header.includes("address") || !header.includes("amount")) {
        throw new Error(
          `line ${i + 1}: header must include an address column and an amount column. Found: ${cells.join(", ")}`
        );
      }
      continue;
    }
    const get = (k: "address" | "amount" | "memo"): string | undefined => {
      const idx = header!.indexOf(k);
      return idx >= 0 ? cells[idx] : undefined;
    };
    const addressRaw = get("address");
    const amountRaw = get("amount");
    const memo = get("memo");
    if (addressRaw === undefined || amountRaw === undefined) {
      skipped++;
      continue;
    }
    const address = normalize(addressRaw);
    if (!isValidPubkey(address)) {
      skipped++;
      continue;
    }
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      skipped++;
      continue;
    }
    const m = memo !== undefined && memo !== "" ? memo.slice(0, 32) : undefined;
    rows.push({ line: i + 1, address, amount, memo: m, raw });
  }
  return { rows, skipped };
}