/**
 * Test harness: a fake Solana RPC node plus an x402 "facilitator" that uses the REAL @x402/svm verification code.
 * The facilitator checks the instruction layout, mint, amount and destination exactly like production would;
 * only the chain underneath is fake (it accepts any signature and returns a made-up confirmed status).
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createKeyPairSignerFromBytes, generateKeyPairSigner, getBase58Decoder, getBase58Encoder } from '@solana/kit';
import { x402Facilitator } from '@x402/core/facilitator';
import { ExactSvmScheme as FacilitatorScheme } from '@x402/svm/exact/facilitator';
import { toFacilitatorSvmSigner } from '@x402/svm';

export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
const b58 = getBase58Decoder();
const b58e = getBase58Encoder();

const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const u64 = (n: bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(n); return b; };

function mintData(decimals: number): Buffer {
  return Buffer.concat([u32(0), Buffer.alloc(32), u64(1_000_000_000_000n), Buffer.from([decimals, 1]), u32(0), Buffer.alloc(32)]);
}
function tokenAccountData(mint: string, owner: string, amount: bigint): Buffer {
  return Buffer.concat([
    Buffer.from(b58e.encode(mint)), Buffer.from(b58e.encode(owner)), u64(amount),
    u32(0), Buffer.alloc(32), Buffer.from([1]), u32(0), u64(0n), u64(0n), u32(0), Buffer.alloc(32),
  ]);
}

export interface MockChain {
  rpcUrl: string;
  facilitatorUrl: string;
  feePayer: string;
  /** Addresses that should look like they have NO account (to test the missing token account path). */
  missing: Set<string>;
  sent: { signature: string; base64: string }[];
  unknownMethods: string[];
  close(): Promise<void>;
}

const readBody = (req: IncomingMessage) => new Promise<string>((r) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => r(s)); });

export async function startMockChain(usdcMint: string): Promise<MockChain> {
  const missing = new Set<string>();
  const sent: MockChain['sent'] = [];
  const unknownMethods: string[] = [];
  const feePayerSigner = await generateKeyPairSigner();
  const slot = { n: 1000 };

  // ---- fake RPC
  const rpc = createServer(async (req, res) => {
    const reqs = JSON.parse(await readBody(req));
    const one = (r: { id: number; method: string; params: any[] }) => {
      const ok = (result: unknown) => ({ jsonrpc: '2.0', id: r.id, result });
      const ctx = { slot: ++slot.n };
      switch (r.method) {
        case 'getLatestBlockhash':
          return ok({ context: ctx, value: { blockhash: b58.decode(Buffer.alloc(32, slot.n % 250 + 1)), lastValidBlockHeight: slot.n + 150 } });
        case 'getAccountInfo': {
          const key: string = r.params[0];
          if (missing.has(key)) return ok({ context: ctx, value: null });
          const isMint = key === usdcMint;
          const data = isMint ? mintData(6) : tokenAccountData(usdcMint, key, 1_000_000_000n);
          return ok({ context: ctx, value: { data: [data.toString('base64'), 'base64'], executable: false, lamports: 2_039_280, owner: TOKEN_PROGRAM, rentEpoch: 0, space: data.length } });
        }
        case 'simulateTransaction':
          return ok({ context: ctx, value: { err: null, logs: [], accounts: null, unitsConsumed: 6000, returnData: null, innerInstructions: null } });
        case 'sendTransaction': {
          const raw = Buffer.from(String(r.params[0]), 'base64');
          const sig = b58.decode(raw.subarray(1, 65)); // first signature = fee payer signature
          sent.push({ signature: sig, base64: String(r.params[0]) });
          return ok(sig);
        }
        case 'getSignatureStatuses':
          return ok({ context: ctx, value: (r.params[0] as string[]).map(() => ({ slot: ctx.slot, confirmations: null, err: null, confirmationStatus: 'confirmed' })) });
        case 'getTransaction':
          return ok(null);
        case 'getBlockHeight': return ok(slot.n + 10);
        case 'getEpochInfo': return ok({ absoluteSlot: slot.n, blockHeight: slot.n, epoch: 1, slotIndex: 1, slotsInEpoch: 432000, transactionCount: 1 });
        case 'getHealth': return ok('ok');
        default:
          unknownMethods.push(r.method);
          return { jsonrpc: '2.0', id: r.id, error: { code: -32601, message: `mock: ${r.method} not supported` } };
      }
    };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(Array.isArray(reqs) ? reqs.map(one) : one(reqs)));
  });
  await new Promise<void>((r) => rpc.listen(0, r));
  const rpcUrl = `http://127.0.0.1:${(rpc.address() as { port: number }).port}`;

  // ---- facilitator using the real verification code
  const facilitator = new x402Facilitator().register(DEVNET, new FacilitatorScheme(toFacilitatorSvmSigner(feePayerSigner, { defaultRpcUrl: rpcUrl })));
  const fac = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const json = (code: number, body: unknown) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    try {
      if (req.method === 'GET' && req.url?.startsWith('/supported')) return json(200, facilitator.getSupported());
      const body = JSON.parse(await readBody(req));
      if (req.url?.startsWith('/verify')) return json(200, await facilitator.verify(body.paymentPayload, body.paymentRequirements));
      if (req.url?.startsWith('/settle')) return json(200, await facilitator.settle(body.paymentPayload, body.paymentRequirements));
      json(404, { error: 'not found' });
    } catch (e) {
      json(500, { error: (e as Error).message });
    }
  });
  await new Promise<void>((r) => fac.listen(0, r));
  const facilitatorUrl = `http://127.0.0.1:${(fac.address() as { port: number }).port}`;

  return {
    rpcUrl, facilitatorUrl, feePayer: feePayerSigner.address, missing, sent, unknownMethods,
    close: () => new Promise((r) => { rpc.close(() => fac.close(() => r())); }),
  };
}

export { createKeyPairSignerFromBytes, generateKeyPairSigner };
