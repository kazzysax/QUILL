import { NextResponse, type NextRequest } from 'next/server';
import { runDemoAgent } from '@/lib/agent';
import { fail, HttpError, readJson } from '@/lib/auth';
import { clientIp, limited } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (limited(`agent:${clientIp(req.headers)}`, 4, 60_000)) throw new HttpError(429, 'Slow down: the demo agent runs a few times a minute.');
    if (limited('agent:all', 30, 60_000)) throw new HttpError(429, 'The demo agent is busy. Try again in a minute.');
    const q = String((await readJson(req)).question ?? '').trim().slice(0, 200);
    if (q.length < 3) throw new HttpError(400, 'Ask a question first.');
    return NextResponse.json(await runDemoAgent(q, req.nextUrl.origin));
  } catch (e) { return fail(e); }
}
