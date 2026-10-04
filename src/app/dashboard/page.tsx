'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, ago, explorerTx, short, usd } from '@/lib/client';
import { ConnectButton, useSession } from '@/components/Session';

export default function Dashboard() {
  const { address, ready } = useSession();
  const [d, setD] = useState<any>(null);
  const [cluster, setCluster] = useState('devnet');
  const [err, setErr] = useState('');
  const load = useCallback(() => api('/api/dashboard').then(setD).catch((e) => setErr(e.message)), []);
  useEffect(() => { if (address) { load(); api('/api/config').then((c) => setCluster(c.cluster)); const t = setInterval(load, 6000); return () => clearInterval(t); } }, [address, load]);

  if (!ready) return <div className="page"><p className="empty">Loading…</p></div>;
  if (!address) return <div className="page"><h1>Your earnings</h1><p className="sub">Connect your wallet to see what agents have paid you.</p><ConnectButton /></div>;

  async function price(id: string, cur: string) {
    const v = window.prompt('New price per read in USDC (0.001–5)', cur);
    if (!v) return;
    try { await api(`/api/articles/${id}`, { method: 'PATCH', json: { priceUsdc: Number(v) } }); load(); } catch (e: any) { setErr(e.message); }
  }
  async function remove(id: string) {
    if (!window.confirm('Remove this piece? Readers can no longer buy it. Past payments stay on-chain.')) return;
    try { await api(`/api/articles/${id}`, { method: 'DELETE' }); load(); } catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="page">
      <h1>Your earnings</h1>
      <p className="sub" style={{ marginBottom: 0 }}>Paid by agents straight to {short(address)}. Every read links to its transaction.</p>
      {err && <div className="notice err">{err}</div>}
      <div className="stats">
        <div className="stat"><b>${d ? usd(d.stats.earnedMicro) : '–'}</b><span>earned</span></div>
        <div className="stat"><b>{d ? d.stats.reads : '–'}</b><span>reads</span></div>
        <div className="stat"><b>{d ? d.stats.agents : '–'}</b><span>different agents</span></div>
      </div>
      <h2 style={{ fontSize: 26 }}>Your pieces</h2>
      {d && !d.articles.length && <p className="empty">You have not published yet. <a href="/write">Write your first piece</a>.</p>}
      {d && d.articles.length > 0 && (
        <table><thead><tr><th>Title</th><th>Price</th><th>Reads</th><th>Earned</th><th /></tr></thead><tbody>
          {d.articles.map((a: any) => (
            <tr key={a.id}><td><a href={a.url}>{a.title}</a></td><td>${a.priceUsdc}</td><td>{a.reads}</td><td>${usd(a.earnedMicro)}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><button className="btn ghost sm" onClick={() => price(a.id, a.priceUsdc)}>Change price</button> <button className="btn ghost sm" onClick={() => remove(a.id)}>Remove</button></td></tr>
          ))}
        </tbody></table>
      )}
      <h2 style={{ fontSize: 26, marginTop: 44 }}>Recent reads</h2>
      {d && !d.reads.length && <p className="empty">No reads yet. Share your link, or <a href="/agent">run the demo agent</a> on your topic.</p>}
      {d && d.reads.length > 0 && (
        <table><thead><tr><th>Piece</th><th>Agent</th><th>Paid</th><th>When</th><th>Transaction</th></tr></thead><tbody>
          {d.reads.map((r: any) => (
            <tr key={r.id}><td>{r.title}</td><td className="mono">{short(r.payer)}</td><td>${usd(r.amountMicro)}</td><td>{ago(r.createdAt)}</td><td><a href={explorerTx(r.tx, cluster)} target="_blank" rel="noreferrer">{short(r.tx)}</a></td></tr>
          ))}
        </tbody></table>
      )}
    </div>
  );
}
