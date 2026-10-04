'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { ConnectButton, useSession } from '@/components/Session';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="f"><span>{label}{hint && <> <small>{hint}</small></>}</span>{children}</label>;
}

export default function Write() {
  const { address, ready, signMessage } = useSession();
  const [me, setMe] = useState<any>(null);
  const [kind, setKind] = useState<'article' | 'video'>('article');
  const [f, setF] = useState({ title: '', summary: '', body: '', tags: '', priceUsdc: '0.02', videoUrl: '', chapters: '' });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ url: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { if (address) api('/api/me').then((m) => { setMe(m); setName(m.name ?? ''); }).catch(() => {}); }, [address]);

  async function publish(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setDone(null);
    const payload = { kind, ...f, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), videoUrl: kind === 'video' ? f.videoUrl : undefined, chapters: kind === 'video' ? f.chapters : undefined };
    try {
      setBusy('Checking your draft…');
      if (name.trim() !== (me?.name ?? '')) await api('/api/me/profile', { method: 'PUT', json: { name, bio: me?.bio } });
      const prep = await api('/api/articles/prepare', { json: payload });
      setBusy('Approve the signature in your wallet. It is a message, not a payment.');
      const signature = await signMessage(prep.message);
      setBusy('Publishing…');
      const r = await api('/api/articles', { json: { ...payload, signature, signedAt: prep.signedAt } });
      setDone(r.article);
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  }

  if (!ready) return <div className="page"><p className="empty">Loading…</p></div>;
  if (!address) return (
    <div className="page">
      <div className="split">
        <div>
          <p className="eyebrow">For writers</p>
          <h1>Write for agents</h1>
          <p className="sub">Connect the Solana wallet you want to be paid in. You sign in with a message, so no transaction and no fee.</p>
          <ConnectButton />
          <p className="note">Works with Phantom, Solflare and Backpack.</p>
        </div>
        <ol className="flow">
          <li><b>Connect your wallet</b><span>This is where readers pay you. Sign in with a message, never a transaction.</span></li>
          <li><b>Write or paste a transcript</b><span>An article, or a video link with its transcript and chapter times.</span></li>
          <li><b>Set your price</b><span>Anything from 0.001 to 5 USDC per read. Change it later from your dashboard.</span></li>
          <li><b>Sign and publish</b><span>Your wallet signs the exact text, so agents can verify it is yours and unchanged.</span></li>
          <li><b>Get paid per read</b><span>Every time an agent reads it, USDC lands in your wallet. Quill takes nothing.</span></li>
        </ol>
      </div>
    </div>
  );
  return (
    <div className="page">
      <h1>Write for agents</h1>
      <p className="sub">Agents pay the price you set, straight to your wallet, each time they read the full text.</p>
      {me && me.receiveChecked && !me.canReceive && (
        <div className="notice err">Your wallet has no USDC token account yet, so payments to it would fail and Quill will not let you publish. Get devnet USDC at <a href="https://faucet.circle.com" target="_blank" rel="noreferrer">faucet.circle.com</a> (choose Solana Devnet and paste your address), then come back.</div>
      )}
      {done && <div className="notice ok">Published and signed. <a href={done.url}>Open it</a> · <a href="/dashboard">Go to your dashboard</a></div>}
      {err && <div className="notice err" role="alert">{err}</div>}
      <form onSubmit={publish} style={{ maxWidth: 760 }}>
        <div className="seg" role="group" aria-label="Type"><button type="button" aria-pressed={kind === 'article'} onClick={() => setKind('article')}>Article</button><button type="button" aria-pressed={kind === 'video'} onClick={() => setKind('video')}>Video</button></div>
        <Field label="Display name" hint="(optional, shown instead of your address)"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></Field>
        <Field label="Title"><input value={f.title} onChange={set('title')} required minLength={5} maxLength={120} /></Field>
        <Field label="Summary" hint="(free, shown in search, 20–300 characters)"><textarea value={f.summary} onChange={set('summary')} required minLength={20} maxLength={300} style={{ minHeight: 80 }} /></Field>
        {kind === 'video' && <><Field label="Video link" hint="(https, YouTube or anywhere. Quill does not host video)"><input type="url" value={f.videoUrl} onChange={set('videoUrl')} required placeholder="https://" /></Field>
          <Field label="Chapters" hint="(one per line, like 02:15 Setting up the wallet)"><textarea value={f.chapters} onChange={set('chapters')} /></Field></>}
        <Field label={kind === 'video' ? 'Transcript' : 'Full text'} hint="(paid. Agents see only a short preview before paying)"><textarea value={f.body} onChange={set('body')} required minLength={200} style={{ minHeight: 280 }} /></Field>
        <div className="two" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Tags" hint="(comma separated, up to 5)"><input value={f.tags} onChange={set('tags')} placeholder="tokens, anchor" /></Field>
          <Field label="Price per read" hint="(USDC, 0.001–5)"><input type="number" step="0.001" min="0.001" max="5" value={f.priceUsdc} onChange={set('priceUsdc')} required /></Field>
        </div>
        <p style={{ color: 'var(--mute)', fontSize: 14, marginTop: 18 }}>By publishing you sign a statement that this wallet published this exact text. Only publish work you wrote or have the right to sell.</p>
        <div className="row"><button className="btn" disabled={!!busy}>{busy ? 'Working…' : 'Sign and publish'}</button>{busy && <span style={{ color: 'var(--mute)' }}>{busy}</span>}</div>
      </form>
    </div>
  );
}
