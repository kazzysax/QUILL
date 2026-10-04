import { NextResponse, type NextRequest } from 'next/server';
import { completeSignIn, fail, HttpError, readJson, setSessionCookie } from '@/lib/auth';
import { clientIp, limited } from '@/lib/ratelimit';
import { isSolAddress } from '@/lib/wallet';

export async function POST(req: NextRequest) {
  try {
    if (limited(`verify:${clientIp(req.headers)}`, 20, 60_000)) throw new HttpError(429, 'Too many attempts. Wait a minute.');
    const body = await readJson(req);
    const address = String(body.address ?? '');
    if (!isSolAddress(address) || typeof body.nonce !== 'string' || typeof body.signature !== 'string') throw new HttpError(400, 'Address, nonce and signature are required.');
    const token = await completeSignIn(address, body.nonce, body.signature);
    const res = NextResponse.json({ address });
    setSessionCookie(res, token);
    return res;
  } catch (e) { return fail(e); }
}
