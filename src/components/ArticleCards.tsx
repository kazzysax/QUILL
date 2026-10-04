'use client';
import { useEffect, useState } from 'react';
import { api, short } from '@/lib/client';

export function Cards({ items }: { items: any[] }) {
  return (
    <div className="cards">
      {items.map((a) => (
        <a className="card" key={a.id} href={a.url}>
          <div className="tags">{a.kind === 'video' && <span className="tag">video</span>}{a.tags.slice(0, 3).map((t: string) => <span className="tag" key={t}>{t}</span>)}</div>
          <h3>{a.title}</h3>
          <p>{a.summary}</p>
          <div className="meta"><span>{a.writer.name ?? short(a.writer.address)} · {a.reads} read{a.reads === 1 ? '' : 's'}</span><span className="price">${a.priceUsdc}</span></div>
        </a>
      ))}
    </div>
  );
}

export function Latest({ limit = 6 }: { limit?: number }) {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => { api(`/api/articles?limit=${limit}`).then((d) => setItems(d.articles)).catch(() => setItems([])); }, [limit]);
  if (!items) return <p className="empty">Loading…</p>;
  if (!items.length) return <p className="empty">Nothing published yet. <a href="/write">Write the first piece</a>.</p>;
  return <Cards items={items} />;
}
