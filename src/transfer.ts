/**
 * Build real Solana transactions for every payout batch.
 *
 * Uses only audited token primitives:
 *  - Associated Token Account (create if the recipient has none)
 *  - `transferChecked` (amount + decimals checked on-chain)
 *  - SPL Memo (optional per-recipient memo)
 *
 * No custom program, no custody: the connected wallet signs locally.
 */
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import type { PayRow } from "./csv.ts";
import { packBatches, type PackOptions } from "./batcher.ts";

/** SPL Memo v2 program (works with Token-2022 era). No extra dependency needed. */
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export function createMemoInstruction(
  memo: string,
  signers: PublicKey[] = []
): TransactionInstruction {
  return new TransactionInstruction({
    keys: signers.map((p) => ({ pubkey: p, isSigner: true, isWritable: false })),
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf8"),
  });
}

/** MAX_V0 = 1232 bytes wire limit for the serialized message + signatures. */
export const MAX_TX_BYTES = 1232;

export function toLamports(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid amount");
  return BigInt(Math.round(amount * 10 ** decimals));
}

export interface BuildSpec {
  payer: PublicKey;
  mint: PublicKey;
  decimals: number;
  connection: Connection;
}

export interface BuiltItem {
  row: PayRow;
  ata: PublicKey;
  /** true if this tx also creates the recipient's ATA */
  created: boolean;
}

export interface BuiltBatch {
  index: number;
  items: BuiltItem[];
  tx: VersionedTransaction;
  /** real serialized message size in bytes */
  bytes: number;
}

export async function buildAll(
  rows: PayRow[],
  spec: BuildSpec,
  packOpts: PackOptions = {}
): Promise<{ batches: BuiltBatch[]; blockhash: string; lastValidBlockHeight: number }> {
  const connection = spec.connection;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const sourceAta = getAssociatedTokenAddressSync(TOKEN_PROGRAM_ID, spec.mint, spec.payer);
  const sourceInfo = await connection.getAccountInfo(sourceAta);

  const batches: BuiltBatch[] = [];
  const packed = packBatches(rows, packOpts);
  for (let i = 0; i < packed.length; i++) {
    const batch = packed[i];
    const ixs: TransactionInstruction[] = [];
    const items: BuiltItem[] = [];
    for (const it of batch.items) {
      const recipient = new PublicKey(it.row.address);
      const ata = getAssociatedTokenAddressSync(TOKEN_PROGRAM_ID, spec.mint, recipient);
      const info = await connection.getAccountInfo(ata);
      let created = false;
      if (info === null) {
        created = true;
        ixs.push(
          createAssociatedTokenAccountInstruction(spec.payer, ata, recipient, spec.mint, TOKEN_PROGRAM_ID)
        );
      }
      const lamports = toLamports(it.row.amount, spec.decimals);
      ixs.push(
        createTransferCheckedInstruction(sourceAta, spec.mint, ata, spec.payer, lamports, spec.decimals, [], TOKEN_PROGRAM_ID)
      );
      if (it.row.memo) ixs.push(createMemoInstruction(it.row.memo, [spec.payer]));
      items.push({ row: it.row, ata, created });
    }
    const msg = new TransactionMessage({
      payerKey: spec.payer,
      recentBlockhash: blockhash,
      instructions: ixs,
    }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    const bytes = tx.message.serialize().length;
    if (bytes + 64 > MAX_TX_BYTES) {
      throw new Error(`batch ${i + 1} too large (${bytes + 64}B > ${MAX_TX_BYTES}B) — reduce batch size`);
    }
    batches.push({ index: i, items, tx, bytes });
  }
  void sourceInfo; // existence/balance is surfaced in the UI, not required here
  return { batches, blockhash, lastValidBlockHeight };
}

export interface TxResult {
  index: number;
  feeLamports: number | null;
  simulateError: string | null;
  simulateLogs: string[];
  signature: string | null;
}

/** Fee + simulation for every batch (simulation works unsigned on any network). */
export async function feeAndSimulateAll(
  batches: BuiltBatch[],
  connection: Connection
): Promise<TxResult[]> {
  const out: TxResult[] = [];
  for (const b of batches) {
    let feeLamports: number | null = null;
    try {
      const fee = await connection.getFeeForMessage(b.tx.message, "confirmed");
      feeLamports = fee.value;
    } catch {
      feeLamports = null;
    }
    let simulateError: string | null = null;
    let simulateLogs: string[] = [];
    try {
      const res = await connection.simulateTransaction(b.tx, { commitment: "confirmed" });
      if (res.value.err) {
        simulateError = JSON.stringify(res.value.err);
        simulateLogs = res.value.logs ?? [];
      } else {
        simulateLogs = res.value.logs ?? [];
      }
    } catch (e) {
      simulateError = String(e);
    }
    out.push({ index: b.index, feeLamports, simulateError, simulateLogs, signature: null });
  }
  return out;
}

/** Sign + send + confirm all batches (devnet/mainnet). Sequential to reuse blockhash safely. */
export async function sendAll(
  batches: BuiltBatch[],
  signAndSend: (tx: VersionedTransaction) => Promise<string>,
  connection: Connection,
  blockhash: string,
  lastValidBlockHeight: number
): Promise<TxResult[]> {
  const out: TxResult[] = [];
  for (const b of batches) {
    try {
      const signature = await signAndSend(b.tx);
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );
      out.push({
        index: b.index,
        feeLamports: null,
        simulateError: null,
        simulateLogs: [],
        signature,
      });
    } catch (e) {
      out.push({
        index: b.index,
        feeLamports: null,
        simulateError: `send failed: ${String(e)}`,
        simulateLogs: [],
        signature: null,
      });
    }
  }
  return out;
}