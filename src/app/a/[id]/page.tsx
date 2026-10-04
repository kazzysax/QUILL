'use client';
import { use, useEffect, useState } from 'react';
import { api, explorerAddr, short } from '@/lib/client';

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [a, setA] = useState<any>(null);
  const [proof, setProof] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api(`/api/articles/${id}`).then((d) => setA(d.article)).catch((e) => setErr(e.message));
    api(`/api/articles/${id}/proof`).then(setProof).catch(() => {});
    api('/api/config').then(setCfg).catch(() => {});
  }, [id]);
  if (err) return <div className="page"><div className="notice err">{err === 'Not found.' ? 'This piece does not exist, or its author removed it.' : err}</div><a className="btn ghost" href="/library">Back to library</a></div>;
  if (!a) return <div className="page"><p className="empty">Loading…</p></div>;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return (
    <div className="page">
      <div className="two">
        <article>
          <div className="tags" style={{ marginBottom: 14 }}>{a.kind === 'video' && <span className="tag">video</span>}{a.tags.map((t: string) => <span className="tag" key={t}>{t}</span>)}</div>
          <h1>{a.title}</h1>
          <p className="sub" style={{ marginBottom: 22 }}>{a.summary}</p>
          <p style={{ color: 'var(--mute)', margin: '0 0 28px' }}>
            By <a href={cfg ? explorerAddr(a.writer.address, cfg.cluster) : '#'} target="_blank" rel="noreferrer">{a.writer.name ?? short(a.writer.address)}</a> · {a.reads} read{a.reads === 1 ? '' : 's'}
          </p>
          {a.videoUrl && <p><a className="btn ghost sm" href={a.videoUrl} target="_blank" rel="noreferrer">Open the video</a></p>}
          <p className="notice info">This is the free preview. Agents buy the full text for ${a.priceUsdc} USDC, paid to the author.</p>
          <div className="lock"><div className="prose">{a.preview}…</div></div>
        </article>
        <aside style={{ display: 'grid', gap: 16 }}>
          <div className="panel sky">
            <b style={{ fontSize: 30, letterSpacing: '-.03em' }}>${a.priceUsdc}</b> <span style={{ color: 'var(--mute)' }}>USDC per read</span>
            <p style={{ color: 'var(--mute)', fontSize: 15, margin: '10px 0 0' }}>Paid in full to the author's wallet. Quill takes no cut.</p>
          </div>
          <div className="panel">
            <b>Authorship</b>
            {proof ? (
              <>
                <p style={{ color: proof.signatureValid ? 'var(--ok)' : 'var(--bad)', fontWeight: 600, margin: '8px 0' }}>{proof.signatureValid ? 'Signature valid' : 'Signature does not verify'}</p>
                <p style={{ color: 'var(--mute)', fontSize: 14, margin: '0 0 8px' }}>Signed by {short(proof.author)} over this content hash:</p>
                <div className="mono">{proof.contentHash}</div>
                <p style={{ marginTop: 12 }}><a href={`/proof?id=${a.id}`}>Check it yourself</a></p>
              </>
            ) : <p className="empty">Loading proof…</p>}
          </div>
          <div className="panel">
            <b>Read it as an agent</b>
            <pre>{`curl -i ${origin}${a.fullUrl}\n# 402 Payment Required\n# pay with any x402 client`}</pre>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--mute)' }}>Or <a href="/agent">watch the demo agent</a> do it.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
