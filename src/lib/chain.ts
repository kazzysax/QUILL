import { address, createSolanaRpc } from '@solana/kit';
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { getConfig } from './config';

/**
 * A writer is paid straight into their USDC token account. That account must already exist,
 * or the payment transaction fails. Returns false only when we are sure it does not exist.
 */
export async function writerCanReceive(wallet: string): Promise<{ ok: boolean; checked: boolean; ata?: string }> {
  const cfg = getConfig();
  if (cfg.skipAtaCheck) return { ok: true, checked: false };
  try {
    const [ata] = await findAssociatedTokenPda({ owner: address(wallet), mint: address(cfg.usdcMint), tokenProgram: TOKEN_PROGRAM_ADDRESS });
    const rpc = createSolanaRpc(cfg.rpcUrl);
    const res = await rpc.getAccountInfo(ata, { encoding: 'base64' }).send();
    return { ok: res.value !== null, checked: true, ata };
  } catch (e) {
    // An RPC outage should not stop a writer from publishing.
    console.warn('[quill] could not check the writer token account:', (e as Error).message);
    return { ok: true, checked: false };
  }
}
