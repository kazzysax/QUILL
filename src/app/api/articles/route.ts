import { NextResponse, type NextRequest } from 'next/server';
import { fail, HttpError, readJson, requireAddress } from '@/lib/auth';
import { publishArticle } from '@/lib/publish';
import { clientIp, limited } from '@/lib/ratelimit';
import { listArticles, searchArticles } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Free for everyone, agents included: titles, summaries, previews and prices. Never the full text. */
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    const q = (p.get('q') ?? '').slice(0, 200);
    const tag = p.get('tag')?.slice(0, 24) || undefined;
    const limit = Math.min(50, Math.max(1, Number(p.get('limit')) || 20));
    const writer = p.get('writer') || undefined;
    const articles = writer ? await listArticles({ writer, limit }) : q || tag ? await searchArticles(q, tag, limit) : await listArticles({ limit });
    return NextResponse.json({ articles });
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  try {
    const address = await requireAddress(req);
    if (limited(`publish:${address}`, 10, 3600_000)) throw new HttpError(429, 'You are publishing too fast. Try again in a bit.');
    if (limited(`publish-ip:${clientIp(req.headers)}`, 30, 3600_000)) throw new HttpError(429, 'Too many publishes from this network.');
    const article = await publishArticle(address, await readJson(req));
    return NextResponse.json({ article: { id: article.id, url: article.url } }, { status: 201 });
  } catch (e) { return fail(e); }
}
