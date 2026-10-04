import { NextResponse, type NextRequest } from 'next/server';
import { fail, requireAddress } from '@/lib/auth';
import { listArticles, recentReads, writerStats } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const address = await requireAddress(req);
    const [articles, reads, stats] = await Promise.all([listArticles({ writer: address, limit: 100 }), recentReads(30, address), writerStats(address)]);
    return NextResponse.json({ address, stats, articles, reads });
  } catch (e) { return fail(e); }
}
