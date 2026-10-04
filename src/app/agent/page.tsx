'use client';
import { useEffect, useState } from 'react';
import { api, explorerAddr, explorerTx, short, usd } from '@/lib/client';

const EXAMPLES = ['Why did my transaction expire?', 'How do priority fees work?', 'Why does my USDC transfer to a new wallet fail?'];

export default function AgentPage() {
  const [cfg, setCfg] = useState<any>(null);
  const [q, setQ] = useState(EXAMPLES[0]!);
  const [run, setRun] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { api('/api/config').then(setCfg).catch(() => {}); }, []);

  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(''); setRun(null);
    try { setRun(await api('/api/agent/run', { json: { question: q } })); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  const enabled = cfg?.demoAgent?.enabled;
  return (
    <div className="page">
      <h1>Watch an agent pay</h1>
      <p className="sub">A small demo agent searches the library for free, buys up to two articles with its own devnet wallet, checks each author's signature, and answers with citations. Spending is capped at $0.10 a run.</p>
      {cfg && !enabled && <div className="notice info">The demo agent has no wallet configured on this server yet. Set DEMO_AGENT_SECRET_KEY to a devnet wallet funded with test USDC.</div>}
      {enabled && <p style={{ color: 'var(--mute)', fontSize: 14 }}>Agent wallet: <a href={explorerAddr(cfg.demoAgent.address, cfg.cluster)} target="_blank" rel="noreferrer">{short(cfg.demoAgent.address)}</a> on Solana {cfg.network}</p>}
      <form onSubmit={go} className="search"><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Question for the agent" maxLength={200} /><button className="btn" disabled={busy || !enabled}>{busy ? 'Paying…' : 'Ask the agent'}</button></form>
      <div className="tags">{EXAMPLES.map((x) => <button key={x} className="tag" onClick={() => setQ(x)}>{x}</button>)}</div>
      {err && <div className="notice err" role="alert">{err}</div>}
      {busy && <p className="empty" style={{ marginTop: 24 }}>The agent is searching, signing payments and waiting for Solana to confirm. This takes a few seconds.</p>}
      {run && (
        <div style={{ marginTop: 26 }}>
          <ol className="steps">{run.steps.map((s: any, i: number) => <li key={i} className={s.kind} style={{ animationDelay: `${i * 90}ms` }}><span className="k">{s.kind}</span><span>{s.text}</span></li>)}</ol>
          {run.answer ? (
            <div className="panel sky"><b>Answer</b>
              <p style={{ fontSize: 18, lineHeight: 1.6 }}>{run.answer.map((a: any, i: number) => <span key={i}>{a.text}<sup className="cite">[{a.cite}]</sup>{' '}</span>)}</p>
              <p style={{ color: 'var(--mute)', fontSize: 14, marginBottom: 0 }}>Spent ${usd(run.spentMicro)} USDC across {run.purchases.length} purchase{run.purchases.length === 1 ? '' : 's'}.</p>
            </div>
          ) : <div className="notice info">The agent found nothing it could answer from. Try a question about transactions, fees, tokens or x402.</div>}
          {run.purchases.length > 0 && (
            <table style={{ marginTop: 18 }}><thead><tr><th>#</th><th>Source</th><th>Author</th><th>Paid</th><th>Verified</th><th>Tx</th></tr></thead><tbody>
              {run.purchases.map((p: any, i: number) => <tr key={p.id}><td>{i + 1}</td><td><a href={`/a/${p.id}`}>{p.title}</a></td><td>{p.author.length > 30 ? short(p.author) : p.author}</td><td>${usd(p.priceMicro)}</td><td style={{ color: p.hashOk ? 'var(--ok)' : 'var(--bad)' }}>{p.hashOk ? 'Signed by author' : 'Failed'}</td><td>{p.tx ? <a href={explorerTx(p.tx, cfg?.cluster ?? 'devnet')} target="_blank" rel="noreferrer">{short(p.tx)}</a> : '–'}</td></tr>)}
            </tbody></table>
          )}
        </div>
      )}
    </div>
  );
}
