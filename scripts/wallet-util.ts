import { generateKeyPairSync, sign, createPrivateKey } from 'node:crypto';
import { getAddressDecoder, getBase58Decoder, getBase58Encoder } from '@solana/kit';

export interface TestWallet { address: string; secret: string; sign(message: string): string }

const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/** Build a signer from a base58 64-byte Solana secret key (seed + public key). */
export function walletFromSecret(secret: string): TestWallet {
  const bytes = Buffer.from(getBase58Encoder().encode(secret));
  if (bytes.length !== 64) throw new Error('Expected a 64-byte base58 secret key.');
  const key = createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, bytes.subarray(0, 32)]), format: 'der', type: 'pkcs8' });
  return {
    address: getAddressDecoder().decode(bytes.subarray(32)) as string,
    secret,
    sign: (m) => sign(null, Buffer.from(m), key).toString('base64'),
  };
}

export function newWallet(): TestWallet {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
  return walletFromSecret(getBase58Decoder().decode(Buffer.concat([seed, raw])));
}
