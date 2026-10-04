# Quill

**Knowledge for agents, paid to the people who wrote it.**
AI agents search a library of Solana knowledge for free. To read a full piece they pay the author in USDC over [x402](https://docs.x402.org), straight to the author's wallet, in the same HTTP request. Every piece is signed by its author's wallet so agents can verify it before they quote it.

Built for the Road to Colosseum hackathon (Superteam Germany).

## What is in the MVP

- **Writers**: connect a Solana wallet (Wallet Standard: Phantom, Solflare, Backpack), write an article or add a video transcript with chapters, set a price (0.001–5 USDC), sign, publish. A dashboard shows earnings, every read with its Solana Explorer link, and lets you change the price or remove a piece.
- **Agents**: free search (`GET /api/articles?q=`), then a paid read (`GET /api/articles/:id/full`) that answers `402 Payment Required`. Any x402 client can pay. An MCP server (`npm run mcp`) gives Claude Desktop and other MCP clients `search_knowledge` and `read_article` with a hard session budget.
- **Proof**: each piece stores a SHA-256 of its content and the author's wallet signature over it. Paid responses include the proof; `/proof` re-checks it in the browser. This proves *which wallet published exactly this text*, not that a human wrote it.
- **Demo agent** (`/agent`): a scripted agent that searches, pays up to two articles from its own devnet wallet, verifies signatures and answers with citations. It uses no LLM; it exists to show the real payment flow.
- **Public ledger**: the landing page lists recent paid reads with transaction links.

Payments are one USDC transfer to the writer. Quill takes no cut and never holds funds. The x402 `exact` scheme allows a single transfer per payment, so co-author splits are not in this MVP.

## Run it

```bash
npm install
cp .env.example .env.local      # then edit
npm run seed                    # 8 labelled sample articles
npm run dev                     # http://localhost:3000
```

Without `DATABASE_URL` it uses an embedded Postgres (PGlite) in `.data/`. For production set `DATABASE_URL` (Neon, Supabase, any Postgres); tables are created on first start.

### Environment

| Variable | Purpose |
|---|---|
| `QUILL_NETWORK` | `devnet` (default) or `mainnet` |
| `QUILL_SITE_URL` | public URL, used in links and for Secure cookies |
| `DATABASE_URL` | Postgres connection string (required on Vercel) |
| `FACILITATOR_URL` | defaults to `https://x402.org/facilitator` (devnet) or PayAI (mainnet) |
| `SOLANA_RPC_URL` | optional RPC override |
| `DEMO_AGENT_SECRET_KEY` | base58 64-byte key of a **devnet-only** wallet holding test USDC |
| `DEMO_AGENT_DAILY_CAP_USDC` | spend cap for the demo agent (default small) |

### Fund the wallets (devnet)

1. Get test USDC at <https://faucet.circle.com> (Solana Devnet). The **demo agent** wallet needs USDC only; the facilitator pays the network fee.
2. Every **writer** wallet needs a USDC token account, or reader payments to it fail. Receiving faucet USDC creates it. Quill checks this before publishing and tells the writer what to do.
3. `npm run seed` writes a sample-writer key to `.data/seed-writer.json`. To be paid for the samples yourself, run `SEED_WRITER_SECRET_KEY=<base58> npm run seed`.

### Deploy (Vercel + Neon)

1. Push this repo to GitHub, import it in Vercel.
2. Add a Neon (or other Postgres) database and set `DATABASE_URL`. Set `QUILL_SITE_URL`, `DEMO_AGENT_SECRET_KEY`.
3. Deploy, then run `DATABASE_URL=... SEED_WRITER_SECRET_KEY=... npm run seed` once from your machine.
4. Without `DATABASE_URL` Vercel falls back to an in-memory database that resets on cold start (a warning is logged).

### MCP server

```json
{ "mcpServers": { "quill": {
  "command": "npx", "args": ["tsx", "mcp/server.ts"],
  "env": { "QUILL_URL": "https://YOUR-SITE", "AGENT_SECRET_KEY": "<devnet wallet>", "QUILL_BUDGET_USDC": "0.50" }
} } }
```

## Tests

```bash
npm test          # unit tests
npm run e2e       # payment flow: real Next server + real x402 packages + mock chain
npx tsx scripts/e2e-ui.ts   # browser (Chromium) + MCP stdio client, saves screenshots to shots/
```

## What has and has not been verified

Verified in a sandbox with **no access to Solana or x402.org**: the full flow with the real `@x402/*` client and server code, and the real `@x402/svm` facilitator verification logic, running against a **mock chain** (fake RPC and facilitator endpoints): 402 challenge, per-article price and payee, payment, read recording, signature checks, ATA guard, access control, UI with a fake Wallet Standard wallet, MCP over stdio.

**Not yet verified against the real network**: the live x402.org facilitator, real devnet RPC and USDC transfers, a real wallet extension signing, Postgres via `DATABASE_URL`, and a Vercel deploy. Do one real devnet run before recording the demo.

## Security notes

Sign-in is a wallet-signed nonce; sessions are HttpOnly cookies; state-changing routes require same-origin and JSON; inputs are length-limited; React escapes all output; video links must be https; rate limits are in-memory (per instance). The demo agent key must be devnet-only and is never logged.

## Roadmap

Co-author splits (needs a splitter program, since x402 `exact` allows one transfer), on-chain attestations of authorship (Solana Attestation Service), tips, reputation, channel-ownership checks for video, discovery via x402 Bazaar.
