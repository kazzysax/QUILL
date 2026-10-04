/**
 * End-to-end payment test. Real Quill server (next start), real x402 packages on both sides,
 * fake chain underneath. Proves: free search, 402 on unpaid, paid read, read recorded, ledger, dashboard, signature checks.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { generateKeyPairSync, sign, randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAddressDecoder, getBase58Decoder } from '@solana/kit';
import { startMockChain } from './mock-chain';

const PORT = Number(process.env.E2E_PORT || 3111);
const base = `http://localhost:${PORT}`;
const USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const ok = (c: unknown, m: string) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function wallet() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32);
  const address = getAddressDecoder().decode(raw) as string;
  const secret = getBase58Decoder().decode(Buffer.concat([seed, raw])); // 64-byte keypair, base58
  return { address, secret, sign: (m: string) => sign(null, Buffer.from(m), privateKey).toString('base64') };
}

export async function startQuill(env: Record<string, string>, port = PORT) {
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', process.env.E2E_DEV ? 'dev' : 'start', '-p', String(port)], {
    env: { ...process.env, ...env, NODE_ENV: process.env.E2E_DEV ? 'development' : 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout!.on('data', (d) => (log += d));
  server.stderr!.on('data', (d) => (log += d));
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`http://localhost:${port}/api/health`)).ok) return { server, log: () => log }; } catch { /* starting */ }
    await sleep(500);
  }
  server.kill();
  throw new Error('server did not start:\n' + log);
}

class Session {
  cookie = '';
  constructor(readonly w: ReturnType<typeof wallet>) {}
  async call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', origin: base, cookie: this.cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get('set-cookie'); if (set) this.cookie = set.split(';')[0]!;
    return { status: res.status, data: (await res.json().catch(() => ({}))) as any, headers: res.headers };
  }
  async signIn() {
    const ch = (await this.call('POST', '/api/auth/challenge', { address: this.w.address })).data;
    const r = await this.call('POST', '/api/auth/verify', { address: this.w.address, nonce: ch.nonce, signature: this.w.sign(ch.message) });
    if (r.status !== 200) throw new Error('sign-in failed ' + JSON.stringify(r.data));
  }
  async publish(fields: Record<string, unknown>) {
    const prep = await this.call('POST', '/api/articles/prepare', fields);
    if (prep.status !== 200) return prep;
    return this.call('POST', '/api/articles', { ...fields, signature: this.w.sign(prep.data.message), signedAt: prep.data.signedAt });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chain = await startMockChain(USDC);
  const agent = wallet();
  const writer = wallet();
  const dir = mkdtempSync(join(tmpdir(), 'quill-'));
  const { server, log } = await startQuill({
    QUILL_NETWORK: 'devnet', QUILL_SITE_URL: base, QUILL_DATA_DIR: join(dir, 'db'),
    FACILITATOR_URL: chain.facilitatorUrl, SOLANA_RPC_URL: chain.rpcUrl,
    DEMO_AGENT_SECRET_KEY: agent.secret, DEMO_AGENT_DAILY_CAP_USDC: '1',
  });
  try {
    const w = new Session(writer);
    ok((await w.call('GET', '/api/me')).status === 401, 'not signed in -> 401');
    await w.signIn();
    ok((await w.call('GET', '/api/me')).data.address === writer.address, 'wallet sign-in works');
    ok((await new Session(wallet()).call('POST', '/api/auth/verify', { address: writer.address, nonce: 'x', signature: 'AAAA' })).status === 401, 'bad sign-in refused');

    const draft = {
      kind: 'article', title: 'Why Solana transactions expire', summary: 'Blockhash lifetime explained in plain words for builders.',
      body: 'A Solana transaction names a recent blockhash. The network only accepts a transaction while that blockhash is recent, roughly 150 blocks. '.repeat(6) + 'Fetch a fresh blockhash before you sign, and track the last valid block height so you know when to give up and retry.',
      tags: 'transactions, blockhash', priceUsdc: 0.02,
    };
    chain.missing.add('placeholder');
    const pub = await w.publish(draft);
    ok(pub.status === 201, 'writer publishes a signed article: ' + JSON.stringify(pub.data));
    const id = pub.data.article.id as string;

    // bad signature must be refused
    const prep = await w.call('POST', '/api/articles/prepare', { ...draft, title: 'Another title for forgery' });
    const forged = await w.call('POST', '/api/articles', { ...draft, title: 'Another title for forgery', signature: new Session(wallet()).w.sign(prep.data.message), signedAt: prep.data.signedAt });
    ok(forged.status === 400, 'signature from the wrong wallet is refused');
    const tampered = await w.call('POST', '/api/articles', { ...draft, signature: writer.sign(prep.data.message), signedAt: prep.data.signedAt });
    ok(tampered.status === 400, 'signature over different content is refused');

    // free endpoints
    const search = (await w.call('GET', '/api/articles?q=blockhash expire')).data;
    ok(search.articles.length === 1 && search.articles[0].id === id, 'free search finds it');
    ok(!('body' in search.articles[0]), 'search never returns the full text');
    const proof = (await w.call('GET', `/api/articles/${id}/proof`)).data;
    ok(proof.signatureValid === true && proof.author === writer.address, 'free proof endpoint verifies the author signature');

    // unpaid read -> 402
    const unpaid = await fetch(`${base}/api/articles/${id}/full`);
    ok(unpaid.status === 402, 'unpaid read gets HTTP 402');
    const reqHeader = unpaid.headers.get('payment-required');
    ok(!!reqHeader, 'PAYMENT-REQUIRED header present');
    const requirement = JSON.parse(Buffer.from(reqHeader!, 'base64').toString());
    const acc = requirement.accepts[0];
    ok(acc.payTo === writer.address && acc.amount === '20000' && acc.asset === USDC, `402 asks 0.02 USDC (${acc.amount}) to the WRITER wallet in devnet USDC`);
    const unpaidBody = await unpaid.json();
    ok(!JSON.stringify(unpaidBody).includes('Fetch a fresh blockhash'), 'the 402 body shows a preview but not the full text');
    ok((await fetch(`${base}/api/articles/nope1234/full`)).status === 404, 'unknown article -> 404 (not a payment request)');

    // demo agent pays through the real x402 client
    const run = await new Session(wallet()).call('POST', '/api/agent/run', { question: 'why does my transaction expire blockhash' });
    ok(run.status === 200, 'demo agent run succeeded: ' + JSON.stringify(run.data).slice(0, 300));
    ok(run.data.purchases.length === 1 && run.data.purchases[0].tx, 'agent bought the article and got a transaction signature');
    ok(run.data.purchases[0].hashOk === true, 'agent verified the author signature and content hash');
    ok(run.data.spentMicro === 20000, 'agent spent exactly 0.02 USDC');
    ok(run.data.answer?.length > 0, 'agent composed a cited answer');
    ok(chain.sent.length === 1, 'exactly one transaction was submitted to the chain');

    // ledger and dashboard
    const ledger = (await new Session(wallet()).call('GET', '/api/ledger')).data;
    ok(ledger.reads.length === 1 && ledger.reads[0].writer === writer.address && ledger.reads[0].tx === run.data.purchases[0].tx, 'public ledger shows the paid read');
    const dash = (await w.call('GET', '/api/dashboard')).data;
    ok(dash.stats.reads === 1 && dash.stats.earnedMicro === 20000 && dash.articles[0].reads === 1, 'writer dashboard shows 1 read and 0.02 USDC earned');

    // writer without a token account is refused
    const w2 = new Session(wallet());
    await w2.signIn();
    const { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } = await import('@solana-program/token');
    const { address } = await import('@solana/kit');
    const [ata] = await findAssociatedTokenPda({ owner: address(w2.w.address), mint: address(USDC), tokenProgram: TOKEN_PROGRAM_ADDRESS });
    chain.missing.add(ata);
    const noAta = await w2.publish({ ...draft, title: 'A second writer without USDC' });
    ok(noAta.status === 400 && /USDC token account/.test(noAta.data.error), 'writer with no USDC token account gets a clear error');

    // other people cannot modify
    ok((await w2.call('DELETE', `/api/articles/${id}`)).status === 404, "another wallet cannot delete someone else's article");
    ok((await w.call('PATCH', `/api/articles/${id}`, { priceUsdc: 0.05 })).status === 200, 'author can change the price');
    const re = await fetch(`${base}/api/articles/${id}/full`);
    ok(JSON.parse(Buffer.from(re.headers.get('payment-required')!, 'base64').toString()).accepts[0].amount === '50000', 'new price applies to the next request');

    ok(chain.unknownMethods.length === 0, 'mock chain saw no unsupported RPC methods: ' + chain.unknownMethods.join(','));
    console.log('\nPAYMENT E2E PASSED');
  } catch (e) {
    console.error(e);
    console.error('\n--- server log ---\n' + log().slice(-3000));
    process.exitCode = 1;
  } finally {
    server.kill();
    await chain.close();
    process.exit(process.exitCode ?? 0);
  }
}
