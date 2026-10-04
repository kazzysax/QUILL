'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, short } from '@/lib/client';

async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function Inner() {
  const sp = useSearchParams();
  const [id, setId] = useState(sp.get('id') ?? '');
  const [proof, setProof] = useState<any>(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [fields, setFields] = useState<any>(null);
  const [match, setMatch] = useState<null | boolean>(null);

  const load = (v: string) => { setProof(null); setErr(''); setMatch(null); if (v) api(`/api/articles/${v.trim()}/proof`).then(setProof).catch((e) => setErr(e.message)); };
  useEffect(() => { if (sp.get('id')) load(sp.get('id')!); }, []); // eslint-disable-line

  async function check() {
    setMatch(null);
    try {
      const f = JSON.parse(text);
      const canon = JSON.stringify([f.kind ?? 'article', f.title, f.summary, f.body, f.videoUrl ?? '', f.chapters ?? '']);
      setFields(f);
      setMatch((await sha256(canon)) === proof.contentHash);
    } catch { setErr('Paste the JSON an agent received from the paid endpoint (title, summary, body …).'); }
  }

  return (
    <div className="page">
      <h1>Check authorship</h1>
      <p className="sub">Every piece is signed by its author's wallet. The signature covers a hash of the full text, so any edit after signing breaks it.</p>
      <div className="search"><input value={id} onChange={(e) => setId(e.target.value)} placeholder="Article id" aria-label="Article id" /><button className="btn" onClick={() => load(id)}>Look up</button></div>
      {err && <div className="notice err">{err}</div>}
      {proof && (
        <div className="panel">
          <p style={{ fontWeight: 600, color: proof.signatureValid ? 'var(--ok)' : 'var(--bad)', marginTop: 0 }}>{proof.signatureValid ? `Valid ed25519 signature by ${short(proof.author)}` : 'Signature does not verify'}</p>
          <p style={{ color: 'var(--mute)' }}>Signed statement:</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{proof.message}</pre>
          <p style={{ color: 'var(--mute)' }}>Signature (base64):</p><div className="mono">{proof.signature}</div>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '22px 0' }} />
          <b>Compare against the text you received</b>
          <p style={{ color: 'var(--mute)', fontSize: 15 }}>Paste the JSON from the paid response. Your browser recomputes the hash and compares.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder='{"kind":"article","title":"…","summary":"…","body":"…"}' aria-label="Paid response JSON" />
          <p><button className="btn" onClick={check} disabled={!text.trim()}>Verify text</button></p>
          {match === true && <div className="notice ok">The text matches what the author signed.</div>}
          {match === false && <div className="notice err">The text does not match the signed hash. It was changed after signing, or it is a different piece.</div>}
        </div>
      )}
    </div>
  );
}
export default function ProofPage() { return <Suspense><Inner /></Suspense>; }
