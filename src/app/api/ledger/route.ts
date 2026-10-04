import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { recentReads, totals } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Public: every read is a public on-chain payment, so the ledger is open. */
export async function GET() {
  const [reads, t] = await Promise.all([recentReads(12), totals()]);
  return NextResponse.json({ network: getConfig().net, cluster: getConfig().cluster, totals: t, reads });
}
