/**
 * BulkPayout PWA logic (bundled by esbuild into bundle.js).
 */
import { Connection, PublicKey } from "@solana/web3.js";
import { Buffer as NodeBuffer } from "buffer";
import { parsePayoutCsv, type PayRow } from "../src/csv.ts";
import { isValidPubkey } from "../src/address.ts";
import { buildAll, feeAndSimulateAll, type BuiltBatch, type TxResult } from "../src/transfer.ts";

// @solana/web3.js and @solana/spl-token expect a global Buffer in the browser.
// esbuild does not polyfill Node globals, so we wire the (bundled) `buffer` package.
const globalScope = globalThis as unknown as { Buffer?: unknown };
if (!globalScope.Buffer) {
  globalScope.Buffer = NodeBuffer;
}

const DEVNET_USDC = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKXV";
const DEVNET_RPCS = ["https://api.devnet.solana.com", "https://rpc.ankr.com/solana_devnet"];
const MAINNET_RPCS = ["https://api.mainnet-beta.solana.com"];
const SAMPLE = `address,amount,memo
11111111111111111111111111111111,5.0,oct bonus
4Nd1mGtJNP5cfXDj3bQQrH4EJFz6P2wMzE4Q5C2YTqR1,12.5,payroll
GVmG2cVNgx5sX8dCw2vU4B6g9aXbQ1eK3sTfPmNkLcRe,100,`;

function el<T extends HTMLElement>(sel: string): T {
  const found = document.querySelector(sel);
  if (!found) throw new Error("missing element " + sel);
  return found as T;
}

const els = {
  csvText: el<HTMLTextAreaElement>("#csvText"),
  csvSummary: el("#csvSummary"),
  rowTableWrap: el("#rowTableWrap"),
  fileInput: el<HTMLInputElement>("#fileInput"),
  loadSample: el<HTMLButtonElement>("#loadSample"),
  tokenSelect: el<HTMLSelectElement>("#tokenSelect"),
  mintInput: el<HTMLInputElement>("#mintInput"),
  decimalsInput: el<HTMLInputElement>("#decimalsInput"),
  payerInput: el<HTMLInputElement>("#payerInput"),
  connectBtn: el<HTMLButtonElement>("#connectBtn"),
  walletInfo: el("#walletInfo"),
  netSelect: el<HTMLSelectElement>("#netSelect"),
  buildBtn: el<HTMLButtonElement>("#buildBtn"),
  simulateBtn: el<HTMLButtonElement>("#simulateBtn"),
  sendBtn: el<HTMLButtonElement>("#sendBtn"),
  statusBox: el("#statusBox"),
  batchesPanel: el("#batchesPanel"),
  batchesBox: el("#batchesBox"),
};

let rows: PayRow[] = [];
let batches: BuiltBatch[] = [];
let results: TxResult[] = [];
let blockhash = "";
let lastValidBlockHeight = 0;
let activeConn: Connection | null = null;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function notify(msg: string, cls = ""): void {
  els.statusBox.innerHTML += `<div class="${cls}">${esc(msg)}</div>`;
  els.statusBox.scrollTop = els.statusBox.scrollHeight;
}
function clearStatus(): void {
  els.statusBox.innerHTML = "";
}
function setBusy(btn: HTMLButtonElement, busy: boolean, label: string): void {
  btn.disabled = busy;
  btn.textContent = label;
}
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
  ]);
}

/** Pick the first devnet/mainnet RPC that answers; keeps a cached connection. */
async function getConn(): Promise<Connection> {
  if (activeConn) return activeConn;
  const list = els.netSelect.value === "mainnet" ? MAINNET_RPCS : DEVNET_RPCS;
  for (const url of list) {
    try {
      const c = new Connection(url, "confirmed");
      const r = await withTimeout(c.getLatestBlockhash("confirmed"), 8000);
      if (r && r.blockhash) {
        activeConn = c;
        return c;
      }
    } catch {
      /* try next */
    }
  }
  activeConn = new Connection(list[0], "confirmed");
  return activeConn;
}

function setTokenPresets(): void {
  if (els.tokenSelect.value === "usdc-dev") {
    els.mintInput.value = DEVNET_USDC;
    els.decimalsInput.value = "6";
  }
}

function refreshRows(): void {
  try {
    const parsed = parsePayoutCsv(els.csvText.value);
    rows = parsed.rows;
    els.csvSummary.textContent = `${rows.length} valid · ${parsed.skipped} skipped`;
  } catch (e) {
    els.csvSummary.textContent = `⚠ ${String(e)}`;
    rows = [];
  }
  renderRowTable();
}

function renderRowTable(): void {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  let html = `<table><thead><tr><th>#</th><th>address</th><th>amount</th><th>memo</th></tr></thead><tbody>`;
  for (const r of rows.slice(0, 60)) {
    html += `<tr><td>${r.line}</td><td>${esc(r.address)}</td><td>${r.amount}</td><td>${esc(r.memo ?? "")}</td></tr>`;
  }
  if (rows.length > 60) html += `<tr><td colspan="4" class="muted">… +${rows.length - 60} more</td></tr>`;
  html += `</tbody></table>`;
  if (rows.length) html += `<div class="muted" style="margin-top:8px">total: <b>${total.toFixed(6)}</b> across ${rows.length} recipients</div>`;
  els.rowTableWrap.innerHTML = html;
}

function renderBatches(): void {
  let html = "";
  for (const b of batches) {
    const sum = b.items.reduce((s, it) => s + it.row.amount, 0);
    const r = results.find((x) => x.index === b.index);
    const fee = r && r.feeLamports != null ? `${(r.feeLamports / 1e9).toFixed(6)} SOL` : "—";
    const sim = r
      ? r.simulateError
        ? `<span class="err">sim: ${esc(r.simulateError)}</span>`
        : `<span class="ok">sim: ok</span>`
      : "";
    const sig = r && r.signature ? `<span class="ok">✓ ${esc(r.signature.slice(0, 8))}…</span>` : "";
    html += `<div class="card"><h3>tx ${b.index + 1} — ${b.items.length} payouts · ${sum} tokens · ${b.bytes}B</h3>
      <div class="meta">fee≈${fee} &nbsp; ${sim} &nbsp; ${sig}</div>
      <details><summary>show recipients</summary><table><thead><tr><th>address</th><th>amount</th><th>memo</th><th>ATA</th></tr></thead><tbody>`;
    for (const it of b.items) {
      html += `<tr><td>${esc(it.row.address)}</td><td>${it.row.amount}</td><td>${esc((it.row.memo ?? "").slice(0, 12))}</td><td>${it.created ? "created" : "exists"}</td></tr>`;
    }
    html += `</tbody></table></details></div>`;
  }
  els.batchesBox.innerHTML = html;
}

function readDecimals(): number {
  return Math.max(0, Math.min(9, parseInt(els.decimalsInput.value, 10) || 0));
}

async function doBuild(): Promise<void> {
  clearStatus();
  setTokenPresets(); // enforce preset when selected
  if (rows.length === 0) {
    notify("no rows loaded — paste a CSV or click 'Load sample'", "err");
    return;
  }
  const mintStr = els.mintInput.value.trim();
  let payer: PublicKey;
  try {
    payer = new PublicKey(els.payerInput.value.trim());
  } catch {
    notify("payer address is empty or invalid — connect a wallet or type a valid address", "err");
    return;
  }
  if (!isValidPubkey(mintStr)) {
    notify(`invalid mint address: "${mintStr}". Set the token dropdown to "Devnet USDC (6 decimals)" or paste a valid SPL mint.`, "err");
    return;
  }
  setBusy(els.buildBtn, true, "Building…");
  notify("building… selecting RPC + checking recipient accounts");
  try {
    const conn = await getConn();
    const built = await withTimeout(
      buildAll(rows, { payer, mint: new PublicKey(els.mintInput.value.trim()), decimals: readDecimals(), connection: conn }),
      45000
    );
    batches = built.batches;
    blockhash = built.blockhash;
    lastValidBlockHeight = built.lastValidBlockHeight;
    results = [];
    els.batchesPanel.style.display = "block";
    renderBatches();
    notify(`✅ built ${batches.length} transactions for ${rows.length} payouts`, "ok");
  } catch (e) {
    notify(`❌ build failed: ${String(e)}`, "err");
  } finally {
    setBusy(els.buildBtn, false, "Build transactions");
  }
}

async function doSimulate(): Promise<void> {
  clearStatus();
  if (batches.length === 0) {
    notify("build transactions first", "err");
    return;
  }
  setBusy(els.simulateBtn, true, "Simulating…");
  notify("simulating every batch on chain…");
  try {
    const conn = await getConn();
    results = await withTimeout(feeAndSimulateAll(batches, conn), 60000);
    renderBatches();
    const ok = results.filter((r) => !r.simulateError && r.feeLamports != null).length;
    notify(
      `simulation done: ${ok}/${results.length} clean fee quotes. Errors like “insufficient funds” are expected without devnet tokens — the plumbing is verified.`,
      ok ? "ok" : ""
    );
  } catch (e) {
    notify(`❌ simulate failed: ${String(e)}`, "err");
  } finally {
    setBusy(els.simulateBtn, false, "Simulate all on chain (no funds needed)");
  }
}

async function doSend(): Promise<void> {
  clearStatus();
  setTokenPresets();
  const win = window as unknown as { solana?: any; phantom?: { solana?: any } };
  const sol = win.solana ?? win.phantom?.solana;
  if (!sol || !sol.publicKey) {
    notify("connect a wallet first (Phantom/Solflare)", "err");
    return;
  }
  if (rows.length === 0) {
    notify("no rows loaded", "err");
    return;
  }
  setBusy(els.sendBtn, true, "Sending…");
  try {
    const payer = new PublicKey(sol.publicKey.toString());
    activeConn = null;
    const conn = await getConn();
    const mintStr = els.mintInput.value.trim();
    if (!isValidPubkey(mintStr)) {
      notify(`invalid mint address: "${mintStr}". Set the token dropdown to "Devnet USDC (6 decimals)" or paste a valid SPL mint.`, "err");
      setBusy(els.sendBtn, false, "Sign & send (needs wallet)");
      return;
    }
    const built = await buildAll(rows, {
      payer,
      mint: new PublicKey(mintStr),
      decimals: readDecimals(),
      connection: conn,
    });
    batches = built.batches;
    blockhash = built.blockhash;
    lastValidBlockHeight = built.lastValidBlockHeight;
    results = [];
    els.batchesPanel.style.display = "block";
    renderBatches();
    notify(`sending ${batches.length} tx to ${els.netSelect.value}…`);
    for (const b of batches) {
      try {
        const signed = await sol.signTransaction(b.tx);
        const signature = await conn.sendRawTransaction(signed.serialize());
        let err: string | null = null;
        try {
          const r = await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
          if (r.value.err) err = JSON.stringify(r.value.err);
        } catch (e) {
          err = String(e);
        }
        results.push({ index: b.index, feeLamports: null, simulateError: err, simulateLogs: [], signature });
        notify(err ? `tx ${b.index + 1}: ${err}` : `tx ${b.index + 1}: ${signature}`, err ? "err" : "ok");
      } catch (e) {
        results.push({ index: b.index, feeLamports: null, simulateError: String(e), simulateLogs: [], signature: null });
        notify(`tx ${b.index + 1}: ${String(e)}`, "err");
      }
    }
    renderBatches();
  } catch (e) {
    notify(`❌ send failed: ${String(e)}`, "err");
  } finally {
    setBusy(els.sendBtn, false, "Sign & send (needs wallet)");
  }
}

async function doConnect(): Promise<void> {
  const win = window as unknown as { solana?: any; phantom?: { solana?: any } };
  const sol = win.solana ?? win.phantom?.solana;
  if (!sol) {
    const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    els.walletInfo.textContent = isMobile
      ? "no wallet detected — open this page inside the wallet's own browser"
      : "wallet not detected. 1) install the Phantom browser extension 2) restart the browser 3) hard-reload (Ctrl+Shift+R) 4) click again.";
    return;
  }
  try {
    await sol.connect({ onlyIfTrusted: false });
    const pk = sol.publicKey.toString();
    els.payerInput.value = pk;
    els.walletInfo.textContent = `connected ${pk.slice(0, 6)}…${pk.slice(-4)}`;
    els.connectBtn.textContent = "Wallet connected ✓";
  } catch (e) {
    els.walletInfo.textContent = `connect failed: ${String(e)}`;
  }
}

function main(): void {
  setTokenPresets();
  els.tokenSelect.addEventListener("change", setTokenPresets);
  els.netSelect.addEventListener("change", () => {
    activeConn = null;
  });
  els.csvText.addEventListener("input", refreshRows);
  els.loadSample.addEventListener("click", () => {
    els.csvText.value = SAMPLE;
    refreshRows();
  });
  els.fileInput.addEventListener("change", async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    els.csvText.value = await f.text();
    refreshRows();
  });
  els.buildBtn.addEventListener("click", () => void doBuild());
  els.simulateBtn.addEventListener("click", () => void doSimulate());
  els.sendBtn.addEventListener("click", () => void doSend());
  els.connectBtn.addEventListener("click", () => void doConnect());
  refreshRows();
}

main();