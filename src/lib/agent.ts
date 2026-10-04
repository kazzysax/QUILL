import { createKeyPairSignerFromBytes, getBase58Encoder } from '@solana/kit';
import { x402Client } from '@x402/core/client';
import { decodePaymentResponseHeader, wrapFetchWithPayment } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import { toClientSvmSigner } from '@x402/svm';
import { getConfig } from './config';
import { searchArticles, searchTerms, spentByPayerSince, type ArticleCard } from './store';
import { HttpError } from './auth';
import { contentHash } from './content';
import { verifyWalletSignature } from './wallet';

const PER_RUN_CAP_MICRO = 100_000; // 0.10 USDC
const MAX_ARTICLES = 2;

async function signer() {
  const key = getConfig().demoAgentKey;
  if (!key) throw new HttpError(503, 'The demo agent is not configured on this server.');
  return createKeyPairSignerFromBytes(getBase58Encoder().encode(key) as Uint8Array);
}

export async function demoAgentAddress(): Promise<string | null> {
  if (!getConfig().demoAgentKey) return null;
  try { return (await signer()).address; } catch { return null; }
}

export interface AgentStep { t: number; kind: 'think' | 'search' | 'pay' | 'read' | 'answer'; text: string; data?: unknown }

function sentences(text: string): string[] {
  return text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9`])/).map((s) => s.trim()).filter((s) => s.length > 40 && s.length < 400);
}

/**
 * A small scripted agent, no LLM: it searches, buys the best matches within a budget, and answers by quoting
 * the sentences that best match the question, with citations. It exists to show the real payment flow end to end.
 */
export async function runDemoAgent(question: string, origin: string) {
  const cfg = getConfig();
  const s = await signer();
  const started = Date.now();
  const steps: AgentStep[] = [];
  const log = (kind: AgentStep['kind'], text: string, data?: unknown) => steps.push({ t: Date.now() - started, kind, text, data });

  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const spent = await spentByPayerSince(s.address, dayStart.getTime());
  const left = cfg.demoAgentDailyCapMicro - spent;
  if (left < 1000) throw new HttpError(429, "The demo agent's daily budget is used up. Come back tomorrow or run your own agent with the MCP tool.");
  const budget = Math.min(PER_RUN_CAP_MICRO, left);

  log('think', `Question: "${question}". Budget for this run: ${(budget / 1e6).toFixed(2)} USDC.`);
  const terms = searchTerms(question);
  const found = await searchArticles(question, undefined, 8);
  log('search', found.length ? `Found ${found.length} candidate${found.length > 1 ? 's' : ''} for ${terms.join(', ')}. Previews and prices are free.` : 'Nothing in the library matches that yet.', found.map((a) => ({ id: a.id, title: a.title, priceUsdc: a.priceUsdc })));
  if (!found.length) return { steps, answer: null, purchases: [], spentMicro: 0 };

  const picks: ArticleCard[] = [];
  let planned = 0;
  for (const a of found) {
    if (picks.length >= MAX_ARTICLES) break;
    if (planned + a.priceMicro > budget) continue;
    picks.push(a); planned += a.priceMicro;
  }
  if (!picks.length) throw new HttpError(400, 'The best matches cost more than this demo budget allows.');

  const client = x402Client.fromConfig({
    schemes: [{ network: 'solana:*', client: new ExactSvmScheme(toClientSvmSigner(s), { rpcUrl: cfg.rpcUrl }) }],
    spendControls: { maxAmountPerPayment: '$0.25' },
  });
  const paidFetch = wrapFetchWithPayment(fetch, client);

  const purchases: { id: string; title: string; author: string; priceMicro: number; tx: string | null; body: string; hashOk: boolean }[] = [];
  for (const a of picks) {
    log('pay', `Requesting "${a.title}". The server answers 402 Payment Required: ${a.priceUsdc} USDC to the writer's wallet. Signing and paying.`);
    const res = await paidFetch(`${origin}/api/articles/${a.id}/full`);
    if (!res.ok) {
      log('read', `Could not buy "${a.title}" (HTTP ${res.status}).`);
      continue;
    }
    const hdr = res.headers.get('payment-response') ?? res.headers.get('x-payment-response');
    let tx: string | null = null;
    try { tx = hdr ? (decodePaymentResponseHeader(hdr) as { transaction?: string }).transaction ?? null : null; } catch { /* header optional */ }
    const doc = (await res.json()) as {
      kind: 'article' | 'video'; title: string; summary: string; body: string; videoUrl: string | null; chaptersText: string | null;
      author: { address: string; name: string | null };
      proof: { contentHash: string; message: string; signature: string };
    };
    // Trust, but verify: the text must hash to what the author signed, and the signature must be theirs.
    const recomputed = contentHash({ kind: doc.kind, title: doc.title, summary: doc.summary, body: doc.body, videoUrl: doc.videoUrl ?? undefined, chapters: doc.chaptersText ?? undefined });
    const hashOk = recomputed === doc.proof.contentHash && doc.proof.message.includes(recomputed)
      && (await verifyWalletSignature(doc.author.address, doc.proof.message, doc.proof.signature));
    purchases.push({ id: a.id, title: doc.title, author: doc.author.name ?? doc.author.address, priceMicro: a.priceMicro, tx, body: doc.body, hashOk });
    log('read', `Paid ${a.priceUsdc} USDC${tx ? ` (tx ${tx.slice(0, 8)}…)` : ''}. Received ${doc.body.length.toLocaleString()} characters. Author signature ${hashOk ? 'verified' : 'DID NOT VERIFY'}.`, { id: a.id, tx, verified: hashOk });
  }

  // Extractive answer: the sentences that best match the question.
  const cands: { score: number; text: string; src: number }[] = [];
  purchases.forEach((p, i) => {
    if (!p.hashOk) return; // never quote text that failed verification
    for (const sen of sentences(p.body)) {
      const low = sen.toLowerCase();
      const score = terms.reduce((n, t) => n + (low.includes(t) ? 1 : 0), 0);
      if (score > 0) cands.push({ score, text: sen, src: i });
    }
  });
  cands.sort((x, y) => y.score - x.score);
  const top = cands.slice(0, 4);
  const answer = top.length
    ? top.map((c) => ({ text: c.text, cite: c.src + 1 }))
    : null;
  log('answer', answer ? 'Composed an answer from the purchased text, with citations.' : 'Bought the articles but found no sentence that answers the question directly.');

  return {
    steps,
    answer,
    purchases: purchases.map(({ body: _b, ...p }) => p),
    spentMicro: purchases.reduce((n, p) => n + p.priceMicro, 0),
  };
}

