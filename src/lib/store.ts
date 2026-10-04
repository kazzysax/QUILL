import { getDb } from './db';
import { usdc } from './content';
import type { ArticleInput } from './content';

export interface ArticleCard {
  id: string;
  kind: 'article' | 'video';
  title: string;
  summary: string;
  preview: string;
  tags: string[];
  priceMicro: number;
  priceUsdc: string;
  writer: { address: string; name: string | null };
  reads: number;
  earnedMicro: number;
  videoUrl: string | null;
  createdAt: number;
  url: string;
  fullUrl: string;
}

export interface ArticleFull extends ArticleCard {
  body: string;
  chapters: string | null;
  contentHash: string;
  signedMessage: string;
  signature: string;
}

type Row = Record<string, any>;

const SELECT = `
  select a.*, w.display_name,
    coalesce(r.n, 0)::int as reads, coalesce(r.s, 0)::float8 as earned
  from articles a
  join writers w on w.address = a.writer
  left join (select article_id, count(*) as n, sum(amount_micro) as s from reads group by article_id) r on r.article_id = a.id
`;

function card(r: Row): ArticleCard {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    summary: r.summary,
    preview: r.preview,
    tags: r.tags ? String(r.tags).split(',') : [],
    priceMicro: Number(r.price_micro),
    priceUsdc: usdc(Number(r.price_micro)),
    writer: { address: r.writer, name: r.display_name ?? null },
    reads: Number(r.reads ?? 0),
    earnedMicro: Number(r.earned ?? 0),
    videoUrl: r.video_url ?? null,
    createdAt: Number(r.created_at),
    url: `/a/${r.id}`,
    fullUrl: `/api/articles/${r.id}/full`,
  };
}

function full(r: Row): ArticleFull {
  return {
    ...card(r),
    body: r.body,
    chapters: r.chapters ?? null,
    contentHash: r.content_hash,
    signedMessage: r.signed_message,
    signature: r.signature,
  };
}

// ---------------------------------------------------------------- writers

export async function upsertWriter(address: string): Promise<void> {
  const db = await getDb();
  await db.query('insert into writers (address, created_at) values ($1, $2) on conflict (address) do nothing', [address, Date.now()]);
}

export async function getWriter(address: string) {
  const db = await getDb();
  const [w] = await db.query<Row>('select * from writers where address = $1', [address]);
  return w ? { address: w.address as string, name: (w.display_name as string | null) ?? null, bio: (w.bio as string | null) ?? null, createdAt: Number(w.created_at) } : null;
}

export async function setWriterProfile(address: string, name: string | null, bio: string | null): Promise<void> {
  const db = await getDb();
  await db.query('update writers set display_name = $2, bio = $3 where address = $1', [address, name, bio]);
}

// ---------------------------------------------------------------- articles

export async function insertArticle(o: {
  id: string; writer: string; input: ArticleInput; preview: string; hash: string; signedMessage: string; signature: string;
}): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.query(
    `insert into articles (id, writer, kind, title, summary, tags, body, preview, video_url, chapters, price_micro, content_hash, signed_message, signature, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)`,
    [o.id, o.writer, o.input.kind, o.input.title, o.input.summary, o.input.tags.join(','), o.input.body, o.preview,
      o.input.videoUrl ?? null, o.input.chapters ?? null, o.input.priceMicro, o.hash, o.signedMessage, o.signature, now],
  );
}

export async function getArticle(id: string): Promise<ArticleFull | null> {
  const db = await getDb();
  const [r] = await db.query<Row>(`${SELECT} where a.id = $1 and a.status = 'live'`, [id]);
  return r ? full(r) : null;
}

export async function listArticles(o: { writer?: string; limit?: number } = {}): Promise<ArticleCard[]> {
  const db = await getDb();
  const rows = o.writer
    ? await db.query<Row>(`${SELECT} where a.status = 'live' and a.writer = $1 order by a.created_at desc limit $2`, [o.writer, o.limit ?? 200])
    : await db.query<Row>(`${SELECT} where a.status = 'live' order by a.created_at desc limit $1`, [o.limit ?? 200]);
  return rows.map(card);
}

export async function setArticlePrice(id: string, writer: string, priceMicro: number): Promise<boolean> {
  const db = await getDb();
  const r = await db.query<Row>(`update articles set price_micro = $3, updated_at = $4 where id = $1 and writer = $2 and status = 'live' returning id`, [id, writer, priceMicro, Date.now()]);
  return r.length > 0;
}

export async function removeArticle(id: string, writer: string): Promise<boolean> {
  const db = await getDb();
  const r = await db.query<Row>(`update articles set status = 'removed', updated_at = $3 where id = $1 and writer = $2 and status = 'live' returning id`, [id, writer, Date.now()]);
  return r.length > 0;
}

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'how', 'what', 'why', 'do', 'does', 'i', 'my', 'with', 'it', 'be', 'can', 'solana']);

export function searchTerms(q: string): string[] {
  const words = q.toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g) ?? [];
  const keep = words.filter((w) => !STOP.has(w));
  return [...new Set(keep.length ? keep : words)].slice(0, 8);
}

/** Simple ranked search over title, tags, summary and preview. */
export async function searchArticles(q: string, tag?: string, limit = 20): Promise<ArticleCard[]> {
  const all = await listArticles({ limit: 500 });
  const pool = tag ? all.filter((a) => a.tags.includes(tag.toLowerCase())) : all;
  const terms = searchTerms(q);
  if (!terms.length) return pool.slice(0, limit);
  const scored = pool.map((a) => {
    const title = a.title.toLowerCase(), summary = a.summary.toLowerCase(), prev = a.preview.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (title.includes(t)) score += 5;
      if (a.tags.some((x) => x === t || x.includes(t))) score += 4;
      if (summary.includes(t)) score += 3;
      if (prev.includes(t)) score += 1;
    }
    return { a, score };
  });
  return scored.filter((s) => s.score > 0).sort((x, y) => y.score - x.score || y.a.reads - x.a.reads).slice(0, limit).map((s) => s.a);
}

// ---------------------------------------------------------------- reads (payments)

export interface ReadRow {
  id: number; articleId: string; title: string | null; writer: string; payer: string; tx: string; amountMicro: number; network: string; createdAt: number;
}

const readRow = (r: Row): ReadRow => ({
  id: Number(r.id), articleId: r.article_id, title: r.title ?? null, writer: r.writer, payer: r.payer, tx: r.tx,
  amountMicro: Number(r.amount_micro), network: r.network, createdAt: Number(r.created_at),
});

/** Idempotent: the same transaction is only ever recorded once. */
export async function recordRead(o: { articleId: string; writer: string; payer: string; tx: string; amountMicro: number; network: string }): Promise<boolean> {
  const db = await getDb();
  const r = await db.query<Row>(
    `insert into reads (article_id, writer, payer, tx, amount_micro, network, created_at) values ($1,$2,$3,$4,$5,$6,$7) on conflict (tx) do nothing returning id`,
    [o.articleId, o.writer, o.payer, o.tx, o.amountMicro, o.network, Date.now()],
  );
  return r.length > 0;
}

export async function recentReads(limit = 20, writer?: string): Promise<ReadRow[]> {
  const db = await getDb();
  const sql = `select r.*, a.title from reads r left join articles a on a.id = r.article_id ${writer ? 'where r.writer = $2' : ''} order by r.created_at desc limit $1`;
  const rows = await db.query<Row>(sql, writer ? [limit, writer] : [limit]);
  return rows.map(readRow);
}

export async function spentByPayerSince(payer: string, since: number): Promise<number> {
  const db = await getDb();
  const [r] = await db.query<Row>('select coalesce(sum(amount_micro), 0)::float8 as s from reads where payer = $1 and created_at >= $2', [payer, since]);
  return Number(r?.s ?? 0);
}

export async function totals() {
  const db = await getDb();
  const [r] = await db.query<Row>(`select
    (select count(*) from articles where status = 'live')::int as articles,
    (select count(*) from writers w where exists (select 1 from articles a where a.writer = w.address and a.status = 'live'))::int as writers,
    (select count(*) from reads)::int as reads,
    (select coalesce(sum(amount_micro), 0) from reads)::float8 as paid`);
  return { articles: Number(r!.articles), writers: Number(r!.writers), reads: Number(r!.reads), paidMicro: Number(r!.paid) };
}

export async function writerStats(address: string) {
  const db = await getDb();
  const [r] = await db.query<Row>(`select count(*)::int as reads, coalesce(sum(amount_micro), 0)::float8 as earned, count(distinct payer)::int as agents from reads where writer = $1`, [address]);
  return { reads: Number(r!.reads), earnedMicro: Number(r!.earned), agents: Number(r!.agents) };
}

// ---------------------------------------------------------------- auth tables

export async function putNonce(nonce: string, address: string, message: string, expiresAt: number) {
  const db = await getDb();
  await db.query('delete from nonces where expires_at < $1', [Date.now()]);
  await db.query('insert into nonces (nonce, address, message, expires_at) values ($1,$2,$3,$4)', [nonce, address, message, expiresAt]);
}

/** Returns the stored challenge and deletes it, so a nonce works exactly once. */
export async function takeNonce(nonce: string) {
  const db = await getDb();
  const rows = await db.query<Row>('delete from nonces where nonce = $1 returning *', [nonce]);
  const r = rows[0];
  return r ? { address: r.address as string, message: r.message as string, expiresAt: Number(r.expires_at) } : null;
}

export async function putSession(tokenHash: string, address: string, expiresAt: number) {
  const db = await getDb();
  await db.query('delete from sessions where expires_at < $1', [Date.now()]);
  await db.query('insert into sessions (token_hash, address, expires_at) values ($1,$2,$3)', [tokenHash, address, expiresAt]);
}

export async function sessionAddress(tokenHash: string): Promise<string | null> {
  const db = await getDb();
  const [r] = await db.query<Row>('select address from sessions where token_hash = $1 and expires_at > $2', [tokenHash, Date.now()]);
  return r ? (r.address as string) : null;
}

export async function dropSession(tokenHash: string) {
  const db = await getDb();
  await db.query('delete from sessions where token_hash = $1', [tokenHash]);
}
