import { getWallets } from '@wallet-standard/app';

/** A connected Solana wallet that can sign a plain text message. It never sends a transaction. */
export interface Connected { name: string; address: string; sign(message: string): Promise<string> }
export interface WalletChoice { name: string; icon?: string; connect(): Promise<Connected> }

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const toBytes = (s: string) => new TextEncoder().encode(s);

/* eslint-disable @typescript-eslint/no-explicit-any */
export function listWallets(): WalletChoice[] {
  const out: WalletChoice[] = [];
  const seen = new Set<string>();
  for (const w of getWallets().get() as any[]) {
    const f = w.features;
    if (!f?.['standard:connect'] || !f?.['solana:signMessage']) continue;
    if (!w.chains?.some((c: string) => c.startsWith('solana:'))) continue;
    seen.add(w.name);
    out.push({
      name: w.name,
      icon: w.icon,
      async connect() {
        const { accounts } = await f['standard:connect'].connect();
        const account = accounts?.[0] ?? w.accounts?.[0];
        if (!account) throw new Error('The wallet did not share an account.');
        return {
          name: w.name,
          address: account.address,
          async sign(message: string) {
            const [res] = await f['solana:signMessage'].signMessage({ account, message: toBytes(message) });
            return toBase64(new Uint8Array(res.signature));
          },
        };
      },
    });
  }
  // Older Phantom builds expose window.phantom.solana without registering with Wallet Standard.
  const p = (window as any).phantom?.solana;
  if (p?.isPhantom && !seen.has('Phantom')) {
    out.push({
      name: 'Phantom',
      async connect() {
        const r = await p.connect();
        return {
          name: 'Phantom',
          address: r.publicKey.toString(),
          async sign(message: string) {
            const res = await p.signMessage(toBytes(message), 'utf8');
            return toBase64(new Uint8Array(res.signature));
          },
        };
      },
    });
  }
  return out;
}

/** Wallets can register after the page loads, so let the UI re-read the list. */
export function onWalletsChange(fn: () => void): () => void {
  const api = getWallets();
  const a = api.on('register', fn);
  const b = api.on('unregister', fn);
  return () => { a(); b(); };
}
