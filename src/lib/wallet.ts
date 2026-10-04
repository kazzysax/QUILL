import { address, getPublicKeyFromAddress, isAddress, signatureBytes, verifySignature } from '@solana/kit';

export const isSolAddress = (a: unknown): a is string => typeof a === 'string' && isAddress(a);

/** True when `signatureB64` is a valid ed25519 signature of `message` by the wallet `addr`. */
export async function verifyWalletSignature(addr: string, message: string, signatureB64: string): Promise<boolean> {
  try {
    const sig = Buffer.from(signatureB64, 'base64');
    if (sig.length !== 64) return false;
    const key = await getPublicKeyFromAddress(address(addr));
    return await verifySignature(key, signatureBytes(new Uint8Array(sig)), new TextEncoder().encode(message));
  } catch {
    return false;
  }
}
