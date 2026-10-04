/**
 * Publishes the sample articles under a "Quill Samples" writer.
 *   npm run seed                                  -> generates a wallet, saves its key in .data/seed-writer.json
 *   SEED_WRITER_SECRET_KEY=<base58> npm run seed   -> uses your own wallet (so payments reach you)
 * Safe to run twice: existing titles are skipped. Honors DATABASE_URL like the app does.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { authorshipMessage, contentHash, makePreview, newId } from '../src/lib/content';
import { getDb } from '../src/lib/db';
import { insertArticle, setWriterProfile, upsertWriter } from '../src/lib/store';
import { SEED_ARTICLES } from '../src/lib/seed-content';
import { newWallet, walletFromSecret } from './wallet-util';

const FILE = '.data/seed-writer.json';

let secret = process.env.SEED_WRITER_SECRET_KEY;
if (!secret && existsSync(FILE)) secret = JSON.parse(readFileSync(FILE, 'utf8')).secret;
if (!secret) {
  const w = newWallet();
  mkdirSync('.data', { recursive: true });
  writeFileSync(FILE, JSON.stringify({ address: w.address, secret: w.secret }), { mode: 0o600 });
  secret = w.secret;
  console.log(`Generated a sample-writer wallet and saved its key to ${FILE} (keep it private, devnet only).`);
}
const writer = walletFromSecret(secret);

const db = await getDb();
await upsertWriter(writer.address);
await setWriterProfile(writer.address, 'Quill Samples', 'Sample articles written by the Quill team so the demo has something to read.');
const have = new Set((await db.query<{ title: string }>('select title from articles where writer = $1', [writer.address])).map((r) => r.title));

let added = 0;
for (const a of SEED_ARTICLES) {
  if (have.has(a.title)) continue;
  const input = { kind: 'article' as const, title: a.title, summary: a.summary, body: a.body, tags: a.tags.split(','), priceMicro: Math.round(a.priceUsdc * 1_000_000) };
  const hash = contentHash(input);
  const message = authorshipMessage({ author: writer.address, title: input.title, hash, signedAt: new Date().toISOString() });
  await insertArticle({ id: newId(), writer: writer.address, input, preview: makePreview(input.body), hash, signedMessage: message, signature: writer.sign(message) });
  added++;
}
console.log(`Seeded ${added} article(s) for ${writer.address} (${SEED_ARTICLES.length - added} already there).`);
console.log('Payments to this writer need a USDC token account: send the wallet some devnet USDC from faucet.circle.com.');
await db.close?.();
process.exit(0);
