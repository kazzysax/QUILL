import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { demoAgentAddress } from '@/lib/agent';
import { totals } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cfg = getConfig();
  return NextResponse.json({
    network: cfg.net,
    cluster: cfg.cluster,
    usdcMint: cfg.usdcMint,
    facilitator: cfg.facilitatorUrl,
    siteUrl: cfg.siteUrl,
    demoAgent: { enabled: !!cfg.demoAgentKey, address: await demoAgentAddress(), dailyCapUsdc: cfg.demoAgentDailyCapMicro / 1e6 },
    totals: await totals(),
  });
}
