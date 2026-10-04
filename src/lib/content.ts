import { createHash, randomBytes } from 'node:crypto';

export const LIMITS = {
  title: [5, 120],
  summary: [20, 300],
  body: [200, 30_000],
  tags: 5,
  minPriceMicro: 1_000, // 0.001 USDC
  maxPriceMicro: 5_000_000, // 5 USDC
  chapters: 80,
} as const;

export type Kind = 'article' | 'video';

export interface ArticleInput {
  kind: Kind;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  priceMicro: number;
  videoUrl?: string;
  chapters?: string;
}

export class ValidationError extends Error {}

export function newId(): string {
  return randomBytes(9).toString('base64url').replace(/[-_]/g, 'x').slice(0, 12).toLowerCase();
}

/** The exact data an author signs. Stable field order, so anyone can recompute the hash. */
export function canonicalContent(a: Pick<ArticleInput, 'kind' | 'title' | 'summary' | 'body' | 'videoUrl' | 'chapters'>): string {
  return JSON.stringify([a.kind, a.title, a.summary, a.body, a.videoUrl ?? '', a.chapters ?? '']);
}

export function contentHash(a: Parameters<typeof canonicalContent>[0]): string {
  return createHash('sha256').update(canonicalContent(a)).digest('hex');
}

/** The human-readable statement the author's wallet signs. */
export function authorshipMessage(o: { author: string; title: string; hash: string; signedAt: string }): string {
  return [
    'Quill authorship statement v1',
    'I wrote this and I am publishing it on Quill.',
    '',
    `Author: ${o.author}`,
    `Title: ${o.title}`,
    `SHA-256: ${o.hash}`,
    `Signed: ${o.signedAt}`,
  ].join('\n');
}

/** Short free preview. Never the whole text: at most ~45% of it, capped at 600 characters. */
export function makePreview(body: string): string {
  const clean = body.replace(/\r\n/g, '\n').trim();
  const cap = Math.min(600, Math.floor(clean.length * 0.45));
  if (clean.length <= cap) return clean;
  let cut = clean.slice(0, cap);
  const lastBreak = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
  if (lastBreak > cap * 0.5) cut = cut.slice(0, lastBreak + 1);
  else cut = cut.slice(0, cut.lastIndexOf(' '));
  return cut.trim() + '…';
}

const TAG = /^[a-z0-9][a-z0-9-]{1,23}$/;
const CHAPTER = /^(?:\d{1,2}:)?\d{1,2}:\d{2}\s+\S.{0,100}$/;

export function parseTags(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const out: string[] = [];
  for (const t of list) {
    const tag = String(t).trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag) continue;
    if (!TAG.test(tag)) throw new ValidationError(`Tag "${tag}" must be 2-24 letters, numbers or dashes.`);
    if (!out.includes(tag)) out.push(tag);
  }
  if (out.length > LIMITS.tags) throw new ValidationError(`Use at most ${LIMITS.tags} tags.`);
  return out;
}

export function validateArticle(raw: Record<string, unknown>): ArticleInput {
  const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : '');
  const kind: Kind = raw.kind === 'video' ? 'video' : 'article';
  const title = str(raw.title);
  const summary = str(raw.summary);
  const body = str(raw.body);
  const range = (name: string, v: string, [lo, hi]: readonly [number, number]) => {
    if (v.length < lo || v.length > hi) throw new ValidationError(`${name} must be ${lo}-${hi} characters (now ${v.length}).`);
  };
  range('Title', title, LIMITS.title);
  range('Summary', summary, LIMITS.summary);
  range(kind === 'video' ? 'Transcript' : 'Article text', body, LIMITS.body);

  const price = Number(raw.priceUsdc);
  const priceMicro = Math.round(price * 1_000_000);
  if (!Number.isFinite(price) || priceMicro < LIMITS.minPriceMicro || priceMicro > LIMITS.maxPriceMicro) {
    throw new ValidationError('Price must be between 0.001 and 5 USDC.');
  }

  const input: ArticleInput = { kind, title, summary, body, tags: parseTags(raw.tags), priceMicro };

  if (kind === 'video') {
    const url = str(raw.videoUrl);
    let u: URL;
    try { u = new URL(url); } catch { throw new ValidationError('Add the video link (https://...).'); }
    if (u.protocol !== 'https:') throw new ValidationError('The video link must start with https://');
    input.videoUrl = u.toString();
    const chapters = str(raw.chapters);
    if (chapters) {
      const lines = chapters.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > LIMITS.chapters) throw new ValidationError(`At most ${LIMITS.chapters} chapter lines.`);
      for (const l of lines) if (!CHAPTER.test(l)) throw new ValidationError(`Chapter line "${l.slice(0, 40)}" must look like "02:15 Title".`);
      input.chapters = lines.join('\n');
    }
  }
  return input;
}

/** 20000 -> "0.02", 1000 -> "0.001", 5000000 -> "5.00" */
export function usdc(micro: number): string {
  const [whole, frac = ''] = (micro / 1_000_000).toFixed(6).split('.');
  const trimmed = frac.replace(/0+$/, '').padEnd(2, '0');
  return `${whole}.${trimmed}`;
}
