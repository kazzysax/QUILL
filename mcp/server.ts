/**
 * Quill MCP server (stdio). Gives any MCP client two tools:
 *   search_knowledge  free search over Quill
 *   read_article      pays the author over x402, verifies the signature, returns the text with a citation
 * Env: QUILL_URL, AGENT_SECRET_KEY (base58 64-byte, use a small devnet wallet), QUILL_BUDGET_USDC (default 0.50),
 *      QUILL_MAX_PER_READ_USDC (default 0.25), SOLANA_RPC_URL (optional)
 * Logs go to stderr only: stdout is the MCP channel.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createKeyPairSignerFromBytes, getBase58Encoder } from '@solana/kit';
import { x402Client } from '@x402/core/client';
import { decodePaymentResponseHeader, wrapFetchWithPayment } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import { toClientSvmSigner } from '@x402/svm';
import { z } from 'zod';
import { contentHash } from '../src/lib/content';
import { verifyWalletSignature } from '../src/lib/wallet';

const base = (process.env.QUILL_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const budget = Math.round(Number(process.env.QUILL_BUDGET_USDC ?? '0.50') * 1e6);
const perRead = Math.round(Number(process.env.QUILL_MAX_PER_READ_USDC ?? '0.25') * 1e6);
let spent = 0;

const secret = process.env.AGENT_SECRET_KEY;
let paidFetch: typeof fetch | null = null;
async function getPaidFetch() {
  if (paidFetch) return paidFetch;
  if (!secret) throw new Error('AGENT_SECRET_KEY is not set, so this server can search but not buy.');
  const signer = await createKeyPairSignerFromBytes(getBase58Encoder().encode(secret) as Uint8Array);
  const client = x402Client.fromConfig({
    schemes: [{ network: 'solana:*', client: new ExactSvmScheme(toClientSvmSigner(signer), process.env.SOLANA_RPC_URL ? { rpcUrl: process.env.SOLANA_RPC_URL } : undefined) }],
    spendControls: { maxAmountPerPayment: `$${(perRead / 1e6).toFixed(2)}` },
  });
  return (paidFetch = wrapFetchWithPayment(fetch, client) as typeof fetch);
}

const text = (t: string, isError = false) => ({ content: [{ type: 'text' as const, text: t }], isError });
const server = new McpServer({ name: 'quill', version: '0.1.0' });

server.tool(
  'search_knowledge',
  'Search Quill for human-written Solana knowledge. Free. Returns ids, summaries, previews and the USDC price of each full text.',
  { query: z.string().min(2).max(200), limit: z.number().int().min(1).max(10).optional() },
  async ({ query, limit }) => {
    const res = await fetch(`${base}/api/articles?${new URLSearchParams({ q: query, limit: String(limit ?? 5) })}`);
    if (!res.ok) return text(`Search failed (HTTP ${res.status}).`, true);
    const { articles } = (await res.json()) as { articles: any[] };
    if (!articles.length) return text('No matches. Try different words.');
    return text(articles.map((a) => `id: ${a.id}\ntitle: ${a.title}\nprice: ${a.priceUsdc} USDC\nsummary: ${a.summary}\npreview: ${a.preview}`).join('\n\n---\n\n'));
  },
);

server.tool(
  'read_article',
  `Buy and read the full text of one article by id. Pays the author in USDC over x402 (budget ${(budget / 1e6).toFixed(2)} USDC per session). Verifies the author's signature before returning.`,
  { id: z.string().min(4).max(64) },
  async ({ id }) => {
    try {
      const meta = await fetch(`${base}/api/articles/${encodeURIComponent(id)}`);
      if (!meta.ok) return text(`No article with id ${id}.`, true);
      const price = ((await meta.json()) as any).article.priceMicro as number;
      if (price > perRead) return text(`Refused: ${(price / 1e6).toFixed(3)} USDC is above the per-read cap.`, true);
      if (spent + price > budget) return text(`Refused: this would exceed the session budget (${(spent / 1e6).toFixed(3)} of ${(budget / 1e6).toFixed(2)} USDC already spent).`, true);
      const res = await (await getPaidFetch())(`${base}/api/articles/${encodeURIComponent(id)}/full`);
      if (!res.ok) return text(`Payment or read failed (HTTP ${res.status}). Nothing was charged unless a transaction is shown.`, true);
      const hdr = res.headers.get('payment-response') ?? res.headers.get('x-payment-response');
      let tx = '';
      try { tx = hdr ? ((decodePaymentResponseHeader(hdr) as any).transaction ?? '') : ''; } catch { /* optional */ }
      spent += price;
      const d = (await res.json()) as any;
      const hash = contentHash({ kind: d.kind, title: d.title, summary: d.summary, body: d.body, videoUrl: d.videoUrl ?? undefined, chapters: d.chaptersText ?? undefined });
      const ok = hash === d.proof.contentHash && d.proof.message.includes(hash) && (await verifyWalletSignature(d.author.address, d.proof.message, d.proof.signature));
      return text([
        `Paid ${(price / 1e6).toFixed(3)} USDC${tx ? ` (tx ${tx})` : ''}. Session spend: ${(spent / 1e6).toFixed(3)} of ${(budget / 1e6).toFixed(2)} USDC.`,
        `Author signature: ${ok ? 'VERIFIED' : 'FAILED, do not rely on this text'}`,
        `Cite as: ${d.cite}`,
        d.chaptersText ? `Chapters:\n${d.chaptersText}\nVideo: ${d.videoUrl}` : '',
        '', `# ${d.title}`, '', d.body,
      ].filter((x) => x !== '').join('\n'), !ok);
    } catch (e: any) { return text(`Could not read: ${e?.message ?? e}`, true); }
  },
);

await server.connect(new StdioServerTransport());
console.error(`Quill MCP ready: ${base}, budget ${(budget / 1e6).toFixed(2)} USDC`);
