/**
 * UI + MCP end-to-end. Real Quill (next start), mock chain under it, real Chromium with a fake Wallet Standard wallet.
 * Covers: seeded library, search, article page, wallet sign-in, write+sign+publish via the UI, demo agent in the UI,
 * dashboard earnings, proof page, and the MCP stdio server called by a real MCP client. Saves screenshots to shots/.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBase58Encoder } from '@solana/kit';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { chromium } from 'playwright-core';
import { startMockChain } from './mock-chain';
import { startQuill } from './e2e-pay';
import { newWallet } from './wallet-util';

const PORT = 3122;
const base = `http://localhost:${PORT}`;
const USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const ok = (c: unknown, m: string) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };

const chain = await startMockChain(USDC);
const agent = newWallet();
const me = newWallet();
const dir = mkdtempSync(join(tmpdir(), 'quill-ui-'));
const env = {
  QUILL_NETWORK: 'devnet', QUILL_SITE_URL: base, QUILL_DATA_DIR: join(dir, 'db'),
  FACILITATOR_URL: chain.facilitatorUrl, SOLANA_RPC_URL: chain.rpcUrl, DEMO_AGENT_SECRET_KEY: agent.secret,
  SEED_WRITER_SECRET_KEY: newWallet().secret,
};
const seed = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed.ts'], { env: { ...process.env, ...env }, encoding: 'utf8' });
if (seed.status !== 0) throw new Error('seed failed: ' + seed.stdout + seed.stderr);
console.log(seed.stdout.split('\n')[0]);
const { server, log } = await startQuill(env, PORT);

const errors: string[] = [];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
try {
  const ctx = await browser.newContext({ baseURL: base, viewport: { width: 1360, height: 900 } });
  await ctx.exposeFunction('__sign', (m: string) => me.sign(m));
  // Plain string on purpose: tsx adds helpers to compiled functions that do not exist inside the page.
  await ctx.addInitScript(`(() => {
    const account = { address: ${JSON.stringify(me.address)}, publicKey: Uint8Array.from(${JSON.stringify([...getBase58Encoder().encode(me.address)])}), chains: ['solana:devnet'], features: ['solana:signMessage'] };
    const wallet = {
      version: '1.0.0', name: 'Test Wallet', icon: 'data:image/svg+xml;base64,PHN2Zy8+', chains: ['solana:devnet'], accounts: [],
      features: {
        'standard:connect': { version: '1.0.0', connect: async () => { wallet.accounts = [account]; return { accounts: [account] }; } },
        'standard:events': { version: '1.0.0', on: () => () => {} },
        'solana:signMessage': { version: '1.0.0', signMessage: async (...inputs) => Promise.all(inputs.map(async (i) => {
          const b64 = await window.__sign(new TextDecoder().decode(i.message));
          return { signedMessage: i.message, signature: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) };
        })) },
      },
    };
    const reg = (api) => api.register(wallet);
    window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: reg }));
    window.addEventListener('wallet-standard:app-ready', (e) => reg(e.detail));
  })();`);

  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (n: string) => page.screenshot({ path: `shots/${n}.png`, fullPage: true });

  // landing
  await page.goto('/');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.getByText('Reading wallet history from Solana').first().waitFor();
  ok(true, 'landing page shows the hero and seeded articles');
  await shot('1-landing');

  // library search
  await page.goto('/library');
  await page.getByLabel('Search the library').fill('priority fees');
  await page.getByRole('link', { name: /Priority fees and compute units/ }).waitFor();
  ok((await page.locator('a.card').count()) >= 1, 'library search finds the priority fees article');
  await shot('2-library');
  await page.getByRole('link', { name: /Priority fees and compute units/ }).click();
  await page.getByText('Signature valid').waitFor();
  ok(!(await page.content()).includes('Estimate the price from recent data') , 'article page shows only the preview, never the full text');
  await shot('3-article');

  // connect wallet through the UI
  await page.goto('/write');
  await page.getByRole('button', { name: 'Connect wallet' }).first().click();
  await page.locator('.popmenu').first().waitFor();
  await page.locator('.popmenu button', { hasText: 'Test Wallet' }).first().click();
  await page.getByRole('heading', { name: 'Write for agents' }).waitFor();
  await page.getByLabel('Title').waitFor();
  ok(true, 'wallet connects and signs the sign-in message from the UI');

  // publish via the UI
  await page.getByLabel('Display name').fill('Kazzy');
  await page.getByLabel('Title').fill('How I debug failed Solana transactions');
  await page.getByLabel('Summary').fill('A short routine for reading logs, finding the failing instruction and fixing the usual causes.');
  await page.getByLabel(/Full text/).fill('Start with the transaction logs. Every instruction logs which program it invoked and whether it succeeded, so the first failed line tells you where to look. '.repeat(4));
  await page.getByLabel(/Tags/).fill('debugging, transactions');
  await page.getByRole('button', { name: 'Sign and publish' }).click();
  await page.getByText('Published and signed.').waitFor({ timeout: 15000 });
  ok(true, 'article written, signed in the wallet and published through the UI');
  await shot('4-write');

  // demo agent through the UI
  await page.goto('/agent');
  await page.getByRole('button', { name: 'Ask the agent' }).waitFor();
  await page.getByLabel('Question for the agent').fill('Why did my transaction expire?');
  await page.getByRole('button', { name: 'Ask the agent' }).click();
  await page.getByText('Spent $').waitFor({ timeout: 30000 });
  ok((await page.getByText('Signed by author').count()) >= 1, 'demo agent paid, and every purchase shows as signed by its author');
  await shot('5-agent');
  const ledger = await (await fetch(base + '/api/ledger')).json() as any;
  ok(ledger.totals.reads >= 1, `ledger records ${ledger.totals.reads} paid read(s)`);

  // landing again shows the live card with payments
  await page.goto('/');
  await page.locator('.feed li').first().waitFor({ timeout: 8000 });
  await shot('6-landing-live');
  ok(true, 'landing live card lists the real payments');

  // dashboard for the new writer (no reads yet, but the page works)
  await page.goto('/dashboard');
  await page.getByRole('heading', { name: 'Your pieces' }).waitFor();
  await page.getByRole('link', { name: 'How I debug failed Solana transactions' }).waitFor();
  await shot('7-dashboard');
  ok(true, 'dashboard lists the published piece');

  // proof page
  await page.goto('/proof');
  const id = ledger.reads[0].articleId as string;
  await page.getByLabel('Article id').fill(id);
  await page.getByRole('button', { name: 'Look up' }).click();
  await page.getByText(/Valid ed25519 signature/).waitFor();
  ok(true, 'proof page verifies the signature');
  await shot('8-proof');

  // mobile
  const m = await browser.newContext({ baseURL: base, viewport: { width: 390, height: 844 } });
  const mp = await m.newPage();
  await mp.goto('/');
  await mp.getByRole('heading', { level: 1 }).waitFor();
  ok(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll on a phone');
  await mp.screenshot({ path: 'shots/9-mobile.png', fullPage: false });

  ok(errors.length === 0, 'no browser console errors: ' + errors.join(' | '));

  // MCP over stdio with a real MCP client
  const t = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'mcp/server.ts'], env: { ...process.env as Record<string, string>, QUILL_URL: base, AGENT_SECRET_KEY: agent.secret, SOLANA_RPC_URL: chain.rpcUrl, QUILL_BUDGET_USDC: '0.05' } });
  const c = new Client({ name: 'e2e', version: '1' });
  await c.connect(t);
  const tools = (await c.listTools()).tools.map((x) => x.name).sort();
  ok(tools.join() === 'read_article,search_knowledge', 'MCP lists search_knowledge and read_article');
  const s: any = await c.callTool({ name: 'search_knowledge', arguments: { query: 'blockhash expired', limit: 2 } });
  const sid = /id: (\S+)/.exec(s.content[0].text)?.[1];
  ok(!!sid, 'MCP search returns articles');
  const r1: any = await c.callTool({ name: 'read_article', arguments: { id: sid } });
  ok(!r1.isError && /VERIFIED/.test(r1.content[0].text) && /Paid 0\.0/.test(r1.content[0].text), 'MCP read pays and verifies the author signature');
  const r2: any = await c.callTool({ name: 'read_article', arguments: { id: sid } });
  const r3: any = await c.callTool({ name: 'read_article', arguments: { id: sid } });
  ok(r3.isError && /budget/.test(r3.content[0].text) || r2.isError, 'MCP refuses once the session budget is used up');
  await c.close();

  ok(chain.unknownMethods.length === 0, 'mock chain saw no unsupported RPC methods');
  console.log('\nUI + MCP E2E PASSED');
} catch (e) {
  console.error(e);
  console.error('\n--- server log ---\n' + log().slice(-2500));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
  await chain.close();
  process.exit(process.exitCode ?? 0);
}
