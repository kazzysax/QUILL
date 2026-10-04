import { NextResponse, type NextRequest } from 'next/server';
import { fail, readJson, requireAddress } from '@/lib/auth';
import { setWriterProfile } from '@/lib/store';

export async function PUT(req: NextRequest) {
  try {
    const address = await requireAddress(req);
    const body = await readJson(req);
    const clean = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    await setWriterProfile(address, clean(body.name, 40), clean(body.bio, 200));
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
