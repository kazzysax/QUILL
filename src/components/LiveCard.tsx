'use client';
import { useEffect, useState } from 'react';
import { api, ago, explorerTx, short, usd } from '@/lib/client';

export default function LiveCard() {
  const [d, setD] = useState<any>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    let on = true;
    const load = () => api('/api/ledger').then((x) => on && setD(x)).catch(() => {});
    load();
    const a = setInterval(load, 5000), b = setInterval(() => tick((n) => n + 1), 1000);
    return () => { on = false; clearInterval(a); clearInterval(b); };
  }, []);
  return (
    <aside className="live" aria-label="Live payments">
      <h3><span className="dot" />Live on Solana {d?.network ?? 'devnet'}</h3>
      <div className="nums">
        <div><b>{d ? d.totals.reads : '–'}</b><span>reads paid</span></div>
        <div><b>${d ? usd(d.totals.paidMicro) : '–'}</b><span>to writers</span></div>
        <div><b>{d ? d.totals.writers : '–'}</b><span>writers</span></div>
      </div>
      {d && d.reads.length === 0 && <p className="empty">No reads yet. Run the demo agent and watch this fill in.</p>}
      <ul className="feed">
        {d?.reads.slice(0, 5).map((r: any) => (
          <li key={r.id}>
            <span className="t">{r.title ?? 'Article'}</span>
            <span><a href={explorerTx(r.tx, d.cluster)} target="_blank" rel="noreferrer">${usd(r.amountMicro)}</a> <span style={{ color: 'var(--mute)' }}>{ago(r.createdAt)}</span></span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
