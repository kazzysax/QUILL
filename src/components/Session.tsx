'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, short } from '@/lib/client';
import { listWallets, onWalletsChange, type Connected, type WalletChoice } from '@/lib/wallet-client';

interface Ctx { address: string | null; ready: boolean; wallets: WalletChoice[]; connect(w: WalletChoice): Promise<void>; signMessage(m: string): Promise<string>; logout(): Promise<void>; error: string | null }
const S = createContext<Ctx>(null as never);
export const useSession = () => useContext(S);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [wallets, setWallets] = useState<WalletChoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const conn = useRef<Connected | null>(null);

  useEffect(() => {
    setWallets(listWallets());
    const off = onWalletsChange(() => setWallets(listWallets()));
    api('/api/me?optional=1').then((m) => setAddress(m.address ?? null)).catch(() => {}).finally(() => setReady(true));
    return off;
  }, []);

  const connect = useCallback(async (w: WalletChoice) => {
    setError(null);
    try {
      const c = await w.connect();
      const ch = await api('/api/auth/challenge', { json: { address: c.address } });
      const signature = await c.sign(ch.message);
      await api('/api/auth/verify', { json: { address: c.address, nonce: ch.nonce, signature } });
      conn.current = c;
      setAddress(c.address);
    } catch (e: any) { setError(e?.message ?? 'Could not connect.'); throw e; }
  }, []);

  const signMessage = useCallback(async (m: string) => {
    if (!conn.current) {
      const w = listWallets().find((x) => true);
      if (!w) throw new Error('Open your wallet extension, then connect again.');
      conn.current = await w.connect();
      if (conn.current.address !== address) throw new Error('Your wallet switched accounts. Connect again.');
    }
    return conn.current.sign(m);
  }, [address]);

  const logout = useCallback(async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); conn.current = null; setAddress(null); }, []);

  return <S.Provider value={{ address, ready, wallets, connect, signMessage, logout, error }}>{children}</S.Provider>;
}

export function ConnectButton({ className = 'btn' }: { className?: string }) {
  const { address, ready, wallets, connect, logout, error } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  if (!ready) return <button className={className} disabled>Connect wallet</button>;
  return (
    <div className="pop" ref={ref}>
      <button className={className} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{address ? short(address) : 'Connect wallet'}</button>
      {open && (
        <div className="popmenu" role="menu">
          {address ? (
            <>
              <a href="/dashboard">Writer dashboard</a>
              <a href="/write">Write something</a>
              <button onClick={() => { setOpen(false); logout(); }}>Disconnect</button>
            </>
          ) : wallets.length ? (
            wallets.map((w) => (
              <button key={w.name} onClick={() => connect(w).then(() => setOpen(false)).catch(() => {})}>
                {w.icon && <img src={w.icon} alt="" />}{w.name}
              </button>
            ))
          ) : (
            <p>No Solana wallet found. Install <a href="https://phantom.app" target="_blank" rel="noreferrer" style={{ display: 'inline', padding: 0, textDecoration: 'underline' }}>Phantom</a> or Solflare, then reload.</p>
          )}
          {error && <p style={{ color: 'var(--bad)' }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
