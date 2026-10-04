import { createHash, randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getConfig } from './config';
import { dropSession, putNonce, putSession, sessionAddress, takeNonce, upsertWriter } from './store';
import { isSolAddress, verifyWalletSignature } from './wallet';

export const COOKIE = 'quill_session';
const CHALLENGE_TTL = 5 * 60_000;
const SESSION_TTL = 30 * 24 * 3600_000;

export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export async function createChallenge(address: string, host: string) {
  if (!isSolAddress(address)) throw new HttpError(400, 'That is not a valid Solana address.');
  const nonce = randomBytes(16).toString('hex');
  const now = Date.now();
  const expiresAt = now + CHALLENGE_TTL;
  const message = [
    `${host} wants you to sign in with your Solana wallet.`,
    '',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued: ${new Date(now).toISOString()}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    '',
    'This only proves you own this address. It is not a transaction and gives no one access to your funds.',
  ].join('\n');
  await putNonce(nonce, address, message, expiresAt);
  return { nonce, message };
}

/** Verifies the signed challenge, then returns a fresh session token. */
export async function completeSignIn(address: string, nonce: string, signature: string): Promise<string> {
  const ch = await takeNonce(nonce);
  if (!ch || ch.address !== address || ch.expiresAt < Date.now()) throw new HttpError(401, 'Sign-in expired. Try again.');
  if (!(await verifyWalletSignature(address, ch.message, signature))) throw new HttpError(401, 'The signature did not match this wallet.');
  await upsertWriter(address);
  const token = randomBytes(32).toString('hex');
  await putSession(sha(token), address, Date.now() + SESSION_TTL);
  return token;
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_TTL / 1000, secure: getConfig().siteUrl.startsWith('https://'),
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function currentAddress(req: NextRequest | { cookies: { get(n: string): { value: string } | undefined } }): Promise<string | null> {
  const token = req.cookies.get(COOKIE)?.value;
  return token ? sessionAddress(sha(token)) : null;
}

export async function requireAddress(req: NextRequest): Promise<string> {
  const a = await currentAddress(req);
  if (!a) throw new HttpError(401, 'Connect your wallet to continue.');
  return a;
}

export async function endSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (token) await dropSession(sha(token));
}

/** Browsers always send Origin on cross-site writes; refuse a mismatch. */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) throw new HttpError(403, 'Cross-origin request refused.');
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  assertSameOrigin(req);
  if (!req.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'Send JSON.');
  try {
    const body = await req.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch { /* fall through */ }
  throw new HttpError(400, 'Invalid JSON.');
}

export function fail(e: unknown): NextResponse {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e && typeof e === 'object' && e.constructor?.name === 'ValidationError') return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  console.error('[quill] unexpected error', e);
  return NextResponse.json({ error: 'Something went wrong on our side.' }, { status: 500 });
}
