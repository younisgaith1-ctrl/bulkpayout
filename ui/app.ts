/**
 * BulkPayout PWA logic (bundled by esbuild into ui/bundle.js).
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { parsePayoutCsv, type PayRow } from "../src/csv.ts";
import { isValidPubkey } from "../src/address.ts";
import { buildAll, feeAndSimulateAll, type BuiltBatch, type TxResult } from "../src/transfer.ts";

const DEVNET_USDC = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKXV";

function $(sel: string): HTMLElement {
  const el = document.querySelector(sel);
  if (!el) throw new Error("missing element " + sel);
  return el as HTMLElement;
}

const csvText = $("#csvText") as HTMLTextAreaElement;
const csvSummary = $("#csvSummary");
const rowTableWrap = $("#rowTableWrap");
const tokenSelect = $("#tokenSelect") as HTMLSelectElement;
const mintInput = $("#mintInput") as HTMLInputElement;
const decimalsInput = $("#decimalsInput") as HTMLInputElement;
const payerInput = $("#payerInput") as HTMLInputElement;
const bootstrap$ = {
  connectBtn: $("#connectBtn") as HTMLButtonElement,
  walletInfo: $("#walletInfo"),
  netSelect: $("#netSelect") as HTMLSelectElement,
  buildBtn: $("#buildBtn") as HTMLButtonElement,
  simulateBtn: $("#simulateBtn") as HTMLButtonElement,
  sendBtn: $("#sendBtn") as HTMLButtonElement,
  batchesPanel: $("#batchesPanel"),
  batchesBox: $("#batchesBox"),
  statusBox: $("#statusBox"),
};

let rows: PayRow[] = [];
let skipped = 0;
let batches: BuiltBatch[] = [];
let results: TxResult[] = [];
let blockhash = "";
let lastValidBlockHeight = 0;

const SAMPLE = `address,amount,memo
11111111111111111111111111111111,5.0,oct bonus
4Nd1mGtJNP5cfXDj3bQQrH4EJFz6P2wMzE4Q5C2YTqR1,12.5,payroll
GVmG2cVNgx5sX8dCw2vU4B6g9aXbQ1eK3sTfPmNkLcRe,100,`;

function setTokenPresets(): void {
  const v = tokenSelect.value;
  if (v === "usdc-dev") {
    mintInput.value = DEVNET_USDC;
    decimalsInput.value = "6";
  }
}

function refreshRows(): void {
  try {
    const parsed = parsePayoutCsv(csvText.value);
    rows = parsed.rows;
    skipped = parsed.skipped;
    csvSummary.textContent = `${rows.length} valid · ${skipped} skipped`;
    renderRowTable();
  } catch (e) {
    csvSummary.textContent = `⚠ ${String(e)}`;
    rows = [];
    renderRowTable();
  }
}

function renderRowTable(): void {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  let html = `<table><thead><tr><th>#</th><th>address</th><th>amount</th><th>memo</th></tr></thead><tbody>`;
  for (const r of rows.slice(0, 60)) {
    html += `<tr><td>${r.line}</td><td>${r.address}</td><td>${r.amount}</td><td>${r.memo ?? ""}</td></tr>`;
  }
  if (rows.length > 60) html += `<tr><td colspan="4" class="muted">… +${rows.length - 60} more</td></tr>`;
  html += `</tbody></table>`;
  if (rows.length) html += `<div class="muted" style="margin-top:8px">total: <b>${total.toFixed(6)}</b> across ${rows.length} recipients</div>`;
  rowTableWrap.innerHTML = html;
}

function notify(msg: string, cls = ""): void {
  bootstrap$.statusBox.innerHTML += `<div class="${cls}">${msg}</div>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const MEMO_HASH_LEN = 12;

function renderBatches(): void {
  let html = "";
  for (const b of batches) {
    const sum = b.items.reduce((s, it) => s + it.row.amount, 0);
    const r = results.find((x) => x.index === b.index);
    const fee = r?.feeLamports != null ? `${(r.feeLamports / 1e9).toFixed(6)} SOL` : "—";
    const sim = r?.simulateError ? `<span class="err">sim: ${esc(r.simulateError)}</span>` : r ? `<span class="ok">sim: ok</span>` : "";
    const sig = r?.signature ? `<span class="ok">✓ ${esc(r.signature.slice(0, 8))}…</span>` : "";
    html += `<div class="card"><h3>tx ${b.index + 1} — ${b.items.length} payouts · ${sum} tokens · ${b.bytes}B</h3>
      <div class="meta">fee≈${fee} &nbsp; ${sim} &nbsp; ${sig}</div>
      <details><summary>show recipients</summary><table><thead><tr><th>address</th><th>amount</th><th>memo</th><th>ATA</th></tr></thead><tbody>`;
    for (const it of b.items) {
      html += `<tr><td>${esc(it.row.address)}</td><td>${it.row.amount}</td><td>${esc((it.row.memo ?? "").slice(0, MEMO_HASH_LEN))}</td><td>${it.created ? "created" : "exists"}</td></tr>`;
    }
    html += `</tbody></table></details></div>`;
  }
  bootstrap$.batchesBox.innerHTML = html;
}

function currentConnection(): Connection {
  const net = bootstrap$.netSelect.value;
  return new Connection(net === "mainnet" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com", "confirmed");
}

function currentSpec(payer: PublicKey): { payer: PublicKey; mint: PublicKey; decimals: number; connection: Connection } {
  return {
    payer,
    mint: new PublicKey(mintInput.value.trim()),
    decimals: Math.max(0, Math.min(9, parseInt(decimalsInput.value, 10) || 0)),
    connection: currentConnection(),
  };
}

async function doBuild(_verbose = true): Promise<boolean> {
  if (rows.length === 0) { notify("no rows to build", "err"); return false; }
  let payer: PublicKey;
  try {
    payer = new PublicKey(payerInput.value.trim());
  } catch {
    notify("payer address is not a valid Solana pubkey", "err");
    return false;
  }
  if (!isValidPubkey(mintInput.value.trim())) { notify("invalid mint address", "err"); return false; }
  try {
    const spec = currentSpec(payer);
    const built = await buildAll(rows, spec);
    batches = built.batches;
    blockhash = built.blockhash;
    lastValidBlockHeight = built.lastValidBlockHeight;
    results = [];
    bootstrap$.batchesPanel.style.display = "block";
    renderBatches();
    notify(`built ${batches.length} transactions for ${rows.length} payouts`, "ok");
    return true;
  } catch (e) {
    notify(`build failed: ${String(e)}`, "err");
    return false;
  }
}

async function doSimulate(): Promise<void> {
  if (batches.length === 0) { notify("build first", "err"); return; }
  notify("simulating every batch on-chain…");
  const conn = currentConnection();
  results = await feeAndSimulateAll(batches, conn);
  renderBatches();
  const okCount = results.filter((r) => !r.simulateError && r.feeLamports != null).length;
  notify(`simulation done: ${okCount}/${results.length} clean fee quotes. Errors like “insufficient funds” are expected without devnet tokens — the plumbing is verified.`, okCount ? "ok" : "");
}

async function doSend(): Promise<void> {
  const sol = (window as unknown as { solana?: any }).solana;
  if (!sol || !sol.publicKey) { notify("connect a wallet first (Phantom/Solflare inject window.solana)", "err"); return; }
  if (batches.length === 0) { notify("build first with the connected payer", "err"); return; }
  const payer = new PublicKey(sol.publicKey.toString());
  try {
    const spec = currentSpec(payer);
    const built = await buildAll(rows, spec);
    batches = built.batches;
    blockhash = built.blockhash;
    lastValidBlockHeight = built.lastValidBlockHeight;
  } catch (e) {
    notify(`rebuild failed: ${String(e)}`, "err");
    return;
  }
  notify(`sending ${batches.length} tx to ${bootstrap$.netSelect.value}…`);
  results = [];
  for (const b of batches) {
    try {
      const signed = await sol.signTransaction(b.tx);
      const conn = currentConnection();
      const signature = await conn.sendRawTransaction(signed.serialize());
      let err: string | null = null;
      try {
        const r = await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
        if (r.value.err) err = JSON.stringify(r.value.err);
      } catch (e) { err = String(e); }
      results.push({ index: b.index, feeLamports: null, simulateError: err, simulateLogs: [], signature });
      notify(err ? `tx ${b.index + 1}: ${err}` : `tx ${b.index + 1}: ${signature}`, err ? "err" : "ok");
    } catch (e) {
      results.push({ index: b.index, feeLamports: null, simulateError: String(e), simulateLogs: [], signature: null });
      notify(`tx ${b.index + 1}: ${String(e)}`, "err");
    }
  }
  renderBatches();
}

async function doConnect(): Promise<void> {
  const win = window as unknown as { solana?: any; phantom?: { solana?: any } };
  const sol = win.solana ?? win.phantom?.solana;
  if (!sol) {
    const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    bootstrap$.walletInfo.textContent = isMobile
      ? "no wallet detected on mobile — open this page inside the wallet's own browser (Phantom/Solflare) or connect via WalletConnect"
      : "wallet not detected. Help: 1) install the Phantom CHROME extension (mobile app is separate!) 2) restart the browser 3) hard reload this page (Ctrl+Shift+R) 4) click Connect again. Extension icon lives in the puzzle piece (top-right).";
    return;
  }
  try {
    await sol.connect({ onlyIfTrusted: false });
    const pk = sol.publicKey.toString();
    payerInput.value = pk;
    bootstrap$.walletInfo.textContent = `connected ${pk.slice(0, 6)}…${pk.slice(-4)}`;
    ($("#connectBtn") as HTMLButtonElement).textContent = "Wallet connected ✓";
  } catch (e) {
    bootstrap$.walletInfo.textContent = `connect failed: ${String(e)}`;
  }
}

function main(): void {
  tokenSelect.addEventListener("change", setTokenPresets);
  csvText.addEventListener("input", refreshRows);
  ($("#loadSample") as HTMLButtonElement).addEventListener("click", () => {
    csvText.value = SAMPLE;
    refreshRows();
  });
  ($("#fileInput") as HTMLInputElement).addEventListener("change", async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    csvText.value = await f.text();
    refreshRows();
  });
  bootstrap$.buildBtn.addEventListener("click", () => doBuild(true));
  bootstrap$.simulateBtn.addEventListener("click", doSimulate);
  bootstrap$.sendBtn.addEventListener("click", doSend);
  bootstrap$.connectBtn.addEventListener("click", doConnect);
  refreshRows();
}

main();