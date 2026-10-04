import { NextResponse, type NextRequest } from 'next/server';
import { createChallenge, fail, readJson, HttpError } from '@/lib/auth';
import { clientIp, limited } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  try {
    if (limited(`challenge:${clientIp(req.headers)}`, 20, 60_000)) throw new HttpError(429, 'Too many attempts. Wait a minute.');
    const body = await readJson(req);
    return NextResponse.json(await createChallenge(String(body.address ?? ''), req.headers.get('host') ?? 'Quill'));
  } catch (e) { return fail(e); }
}
