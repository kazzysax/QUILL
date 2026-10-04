export type Net = 'devnet' | 'mainnet';

const NETS = {
  devnet: {
    caip2: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    usdc: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    facilitator: 'https://x402.org/facilitator',
    rpc: 'https://api.devnet.solana.com',
    cluster: 'devnet',
  },
  mainnet: {
    caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    facilitator: 'https://facilitator.payai.network',
    rpc: 'https://api.mainnet-beta.solana.com',
    cluster: 'mainnet-beta',
  },
} as const;

export interface Config {
  net: Net;
  caip2: string;
  usdcMint: string;
  facilitatorUrl: string;
  rpcUrl: string;
  cluster: string;
  siteUrl: string;
  skipAtaCheck: boolean;
  demoAgentKey?: string;
  demoAgentDailyCapMicro: number;
}

/** Read lazily so tests can set env vars before the first call. */
export function getConfig(): Config {
  const net: Net = process.env.QUILL_NETWORK === 'mainnet' ? 'mainnet' : 'devnet';
  const n = NETS[net];
  return {
    net,
    caip2: n.caip2,
    usdcMint: n.usdc,
    facilitatorUrl: process.env.FACILITATOR_URL || n.facilitator,
    rpcUrl: process.env.SOLANA_RPC_URL || n.rpc,
    cluster: n.cluster,
    siteUrl: (process.env.QUILL_SITE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
    skipAtaCheck: process.env.QUILL_SKIP_ATA_CHECK === '1',
    demoAgentKey: process.env.DEMO_AGENT_SECRET_KEY || undefined,
    demoAgentDailyCapMicro: Math.round(Number(process.env.DEMO_AGENT_DAILY_CAP_USDC || 1) * 1_000_000),
  };
}

/** Link to a transaction on Solana Explorer for the configured cluster. */
export function txUrl(sig: string): string {
  const { cluster } = getConfig();
  return `https://explorer.solana.com/tx/${encodeURIComponent(sig)}${cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`}`;
}

export function addrUrl(addr: string): string {
  const { cluster } = getConfig();
  return `https://explorer.solana.com/address/${encodeURIComponent(addr)}${cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`}`;
}
