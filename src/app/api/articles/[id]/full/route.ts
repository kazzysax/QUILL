import { NextResponse, type NextRequest } from 'next/server';
import { withX402 } from '@x402/next';
import { getConfig } from '@/lib/config';
import { usdc } from '@/lib/content';
import { parseChapters } from '@/lib/publish';
import { getArticle } from '@/lib/store';
import { articleIdFromPath, getResourceServer, PAID_ROUTE } from '@/lib/x402';

export const dynamic = 'force-dynamic';

const idOf = (path: string) => articleIdFromPath(path);

/** Runs only after the x402 layer has verified a payment. Settlement happens after this returns successfully. */
async function handler(req: NextRequest): Promise<NextResponse> {
  // Defence in depth: if the paywall layer were ever bypassed by a route mismatch, still refuse to serve free.
  if (!req.headers.get('payment-signature') && !req.headers.get('x-payment')) {
    return NextResponse.json({ error: 'Payment required.' }, { status: 402 });
  }
  const a = await getArticle(idOf(new URL(req.url).pathname) ?? '');
  if (!a) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const site = getConfig().siteUrl;
  return NextResponse.json(
    {
      id: a.id,
      kind: a.kind,
      title: a.title,
      summary: a.summary,
      tags: a.tags,
      author: { address: a.writer.address, name: a.writer.name },
      publishedAt: new Date(a.createdAt).toISOString(),
      body: a.body,
      videoUrl: a.videoUrl,
      chapters: parseChapters(a.chapters),
      chaptersText: a.chapters,
      proof: { contentHash: a.contentHash, message: a.signedMessage, signature: a.signature, proofUrl: `${site}/api/articles/${a.id}/proof` },
      cite: `${a.title} by ${a.writer.name ?? a.writer.address}, ${site}/a/${a.id}`,
    },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}

const cfg = getConfig();

const paid = withX402(
  handler,
  {
    [PAID_ROUTE]: {
      accepts: [
        {
          scheme: 'exact',
          network: cfg.caip2 as `${string}:${string}`,
          // Each article has its own price and pays its own writer's wallet directly.
          price: async (ctx) => {
            const a = await getArticle(idOf(ctx.path) ?? '');
            return `$${((a?.priceMicro ?? 0) / 1_000_000).toFixed(6)}`;
          },
          payTo: async (ctx) => {
            const a = await getArticle(idOf(ctx.path) ?? '');
            if (!a) throw new Error('article not found');
            return a.writer.address;
          },
        },
      ],
      description: 'Full text of one Quill article, paid to its writer',
      mimeType: 'application/json',
      // Even unpaid callers see what they would be buying.
      unpaidResponseBody: async (ctx) => {
        const a = await getArticle(idOf(ctx.path) ?? '');
        return {
          contentType: 'application/json',
          body: a
            ? { title: a.title, summary: a.summary, preview: a.preview, priceUsdc: usdc(a.priceMicro), author: a.writer.address, kind: a.kind }
            : {},
        };
      },
    },
  },
  getResourceServer(),
);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getArticle(id);
  if (!a) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return paid(req);
}
