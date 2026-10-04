/**
 * One tiny SQL layer with two backends that speak the same Postgres dialect:
 *  - DATABASE_URL set  -> real Postgres (Neon, Supabase, ...)
 *  - otherwise         -> PGlite (Postgres compiled to WASM), stored in ./.data or in memory
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Where the data lives, for the health endpoint. */
  kind: 'postgres' | 'pglite-disk' | 'pglite-memory';
  close?: () => Promise<unknown>;
}

const SCHEMA = `
create table if not exists writers (
  address text primary key,
  display_name text,
  bio text,
  created_at double precision not null
);
create table if not exists articles (
  id text primary key,
  writer text not null references writers(address),
  kind text not null default 'article',
  title text not null,
  summary text not null,
  tags text not null default '',
  body text not null,
  preview text not null,
  video_url text,
  chapters text,
  price_micro integer not null,
  content_hash text not null,
  signed_message text not null,
  signature text not null,
  status text not null default 'live',
  created_at double precision not null,
  updated_at double precision not null
);
create index if not exists articles_writer_idx on articles(writer);
create index if not exists articles_created_idx on articles(created_at desc);
create table if not exists reads (
  id serial primary key,
  article_id text not null,
  writer text not null,
  payer text not null,
  tx text not null unique,
  amount_micro integer not null,
  network text not null,
  created_at double precision not null
);
create index if not exists reads_article_idx on reads(article_id);
create index if not exists reads_created_idx on reads(created_at desc);
create index if not exists reads_payer_idx on reads(payer, created_at desc);
create table if not exists sessions (
  token_hash text primary key,
  address text not null,
  expires_at double precision not null
);
create table if not exists nonces (
  nonce text primary key,
  address text not null,
  message text not null,
  expires_at double precision not null
);
`;

const g = globalThis as unknown as { __quillDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  return (g.__quillDb ??= open().catch((e) => {
    g.__quillDb = undefined; // allow a retry after a failure
    throw e;
  }));
}

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const postgres = (await import('postgres')).default;
    const sql = postgres(url, { max: 5, prepare: false, idle_timeout: 20 });
    await sql.unsafe(SCHEMA);
    return {
      kind: 'postgres',
      query: async (q, params = []) => (await sql.unsafe(q, params as never[])) as unknown as never[],
      close: () => sql.end(),
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const onVercel = !!process.env.VERCEL;
  const dir = process.env.QUILL_DATA_DIR === 'memory' || onVercel ? undefined : process.env.QUILL_DATA_DIR || '.data/pglite';
  if (onVercel) console.warn('[quill] DATABASE_URL is not set: using an in-memory database that resets on every cold start. Set DATABASE_URL.');
  const pg = new PGlite(dir);
  await pg.exec(SCHEMA);
  return {
    kind: dir ? 'pglite-disk' : 'pglite-memory',
    query: async (q, params = []) => (await pg.query(q, params as never[])).rows as never[],
    close: () => pg.close(),
  };
}
