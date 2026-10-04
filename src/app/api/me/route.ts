import { NextResponse, type NextRequest } from 'next/server';
import { currentAddress, fail, requireAddress } from '@/lib/auth';
import { writerCanReceive } from '@/lib/chain';
import { getWriter, writerStats } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.has('optional') && !(await currentAddress(req))) return NextResponse.json({ address: null });
    const address = await requireAddress(req);
    const [w, stats, recv] = await Promise.all([getWriter(address), writerStats(address), writerCanReceive(address)]);
    return NextResponse.json({ address, name: w?.name ?? null, bio: w?.bio ?? null, stats, canReceive: recv.ok, receiveChecked: recv.checked });
  } catch (e) { return fail(e); }
}
