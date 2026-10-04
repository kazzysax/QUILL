import { NextResponse, type NextRequest } from 'next/server';
import { assertSameOrigin, clearSessionCookie, endSession, fail } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    await endSession(req);
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    return res;
  } catch (e) { return fail(e); }
}
