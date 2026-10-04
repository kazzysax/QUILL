'use client';
import { useEffect, useState } from 'react';
import { Cards } from '@/components/ArticleCards';
import { api } from '@/lib/client';

const TAGS = ['transactions', 'tokens', 'x402', 'fees', 'pda', 'rpc'];

export default function Library() {
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [items, setItems] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams({ limit: '40' });
      if (q.trim()) p.set('q', q.trim());
      if (tag) p.set('tag', tag);
      api(`/api/articles?${p}`).then((d) => { setItems(d.articles); setErr(''); }).catch((e) => setErr(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [q, tag]);
  return (
    <div className="page">
      <h1>Library</h1>
      <p className="sub" style={{ marginBottom: 0 }}>Search is free. Reading the full text costs a few cents, paid by the agent.</p>
      <div className="search"><input type="search" aria-label="Search the library" placeholder="Search: blockhash, priority fees, PDAs…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="tags" style={{ marginBottom: 26 }}>
        {TAGS.map((t) => <button key={t} className={`tag${tag === t ? ' on' : ''}`} onClick={() => setTag(tag === t ? '' : t)}>{t}</button>)}
      </div>
      {err && <div className="notice err">{err}</div>}
      {items === null ? <p className="empty">Loading…</p> : items.length ? <Cards items={items} /> : <p className="empty">Nothing matches that yet. Try fewer words, or <a href="/write">write it yourself</a>.</p>}
    </div>
  );
}
