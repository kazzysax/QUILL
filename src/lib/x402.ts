import { HTTPFacilitatorClient } from '@x402/core/server';
import { x402ResourceServer } from '@x402/next';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import { getConfig } from './config';
import { getArticle, recordRead } from './store';

const g = globalThis as unknown as { __quillX402?: x402ResourceServer };

export const PAID_ROUTE = '/api/articles/[id]/full';
const PATH_RE = /^\/api\/articles\/([a-z0-9]+)\/full\/?$/;

export const articleIdFromPath = (path: string): string | null => PATH_RE.exec(path)?.[1] ?? null;

/** The shared x402 resource server: one facilitator, Solana USDC, and a hook that records every settled read. */
export function getResourceServer(): x402ResourceServer {
  if (g.__quillX402) return g.__quillX402;
  const cfg = getConfig();
  const server = new x402ResourceServer(new HTTPFacilitatorClient({ url: cfg.facilitatorUrl }))
    .register(cfg.caip2 as `${string}:${string}`, new ExactSvmScheme());

  server.onAfterSettle(async (ctx) => {
    try {
      if (!ctx.result.success) return;
      const path = (ctx.transportContext as { request?: { path?: string } } | undefined)?.request?.path ?? '';
      const id = articleIdFromPath(path);
      if (!id) return;
      const article = await getArticle(id);
      if (!article) return;
      await recordRead({
        articleId: id,
        writer: article.writer.address,
        payer: String(ctx.result.payer ?? 'unknown'),
        tx: String(ctx.result.transaction),
        amountMicro: Number(ctx.requirements.amount),
        network: String(ctx.requirements.network),
      });
    } catch (e) {
      // The payment already settled on-chain; never fail the reader because our bookkeeping hiccuped.
      console.error('[quill] could not record a settled read', e);
    }
  });

  g.__quillX402 = server;
  return server;
}
