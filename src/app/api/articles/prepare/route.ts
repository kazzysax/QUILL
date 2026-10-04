import { NextResponse, type NextRequest } from 'next/server';
import { fail, readJson, requireAddress } from '@/lib/auth';
import { prepareArticle } from '@/lib/publish';

/** Validates the draft and returns the exact statement for the wallet to sign. */
export async function POST(req: NextRequest) {
  try {
    const address = await requireAddress(req);
    const { hash, signedAt, message } = prepareArticle(address, await readJson(req));
    return NextResponse.json({ hash, signedAt, message });
  } catch (e) { return fail(e); }
}
