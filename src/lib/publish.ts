import { HttpError } from './auth';
import { authorshipMessage, contentHash, makePreview, newId, validateArticle } from './content';
import { writerCanReceive } from './chain';
import { getConfig } from './config';
import { insertArticle, listArticles, getArticle } from './store';
import { verifyWalletSignature } from './wallet';

const MAX_LIVE_PER_WRITER = 50;
const SIGN_WINDOW_MS = 15 * 60_000;

/** Validate the draft and build the exact statement the author's wallet should sign. */
export function prepareArticle(author: string, raw: Record<string, unknown>) {
  const input = validateArticle(raw);
  const hash = contentHash(input);
  const signedAt = new Date().toISOString();
  const message = authorshipMessage({ author, title: input.title, hash, signedAt });
  return { input, hash, signedAt, message };
}

export async function publishArticle(author: string, raw: Record<string, unknown>) {
  const input = validateArticle(raw);
  const signature = typeof raw.signature === 'string' ? raw.signature : '';
  const signedAt = typeof raw.signedAt === 'string' ? raw.signedAt : '';
  const when = Date.parse(signedAt);
  if (!signature || !Number.isFinite(when) || Math.abs(Date.now() - when) > SIGN_WINDOW_MS) {
    throw new HttpError(400, 'Signature missing or too old. Sign again and publish.');
  }
  const hash = contentHash(input);
  const message = authorshipMessage({ author, title: input.title, hash, signedAt });
  if (!(await verifyWalletSignature(author, message, signature))) {
    throw new HttpError(400, 'The signature does not match this text and wallet. Sign again and publish.');
  }
  const mine = await listArticles({ writer: author, limit: MAX_LIVE_PER_WRITER + 1 });
  if (mine.length >= MAX_LIVE_PER_WRITER) throw new HttpError(400, `You can have up to ${MAX_LIVE_PER_WRITER} live pieces.`);

  const recv = await writerCanReceive(author);
  if (!recv.ok) {
    const cfg = getConfig();
    throw new HttpError(
      400,
      `Your wallet has no USDC token account on ${cfg.net} yet, so readers' payments to it would fail. ` +
        (cfg.net === 'devnet' ? 'Get devnet USDC at faucet.circle.com (this creates the account), then publish again.' : 'Receive a small amount of USDC first (this creates the account), then publish again.'),
    );
  }

  const id = newId();
  await insertArticle({ id, writer: author, input, preview: makePreview(input.body), hash, signedMessage: message, signature });
  return (await getArticle(id))!;
}

export function parseChapters(raw: string | null): { t: string; title: string }[] {
  if (!raw) return [];
  return raw.split('\n').map((l) => {
    const m = /^((?:\d{1,2}:)?\d{1,2}:\d{2})\s+(.+)$/.exec(l.trim());
    return m ? { t: m[1]!, title: m[2]! } : null;
  }).filter((x): x is { t: string; title: string } => !!x);
}
