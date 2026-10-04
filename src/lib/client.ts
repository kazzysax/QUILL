export async function api<T = any>(path: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? (init?.json ? 'POST' : 'GET'),
    headers: init?.json ? { 'content-type': 'application/json' } : undefined,
    body: init?.json ? JSON.stringify(init.json) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Request failed (${res.status}).`), { status: res.status });
  return data as T;
}
export const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
export const usd = (micro: number) => (micro / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
export const ago = (ms: number) => { const s = Math.max(1, Math.round((Date.now() - ms) / 1000)); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`; };
export const explorerTx = (tx: string, cluster: string) => `https://explorer.solana.com/tx/${tx}${cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`}`;
export const explorerAddr = (a: string, cluster: string) => `https://explorer.solana.com/address/${a}${cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`}`;
