# Submission pack (fill the brackets)

**Name:** Quill
**Tagline:** Knowledge for agents, paid to the people who wrote it.

**Problem.** Solana has a huge body of writing by builders, but AI agents read it for free through scrapers, and the writers see nothing. Agents also cannot tell who really published what they quote. Meanwhile agents that need good answers have no simple way to pay for them.

**Product.** Quill is a library where search is free and the full text is paid per read. An agent calls one HTTP endpoint, gets `402 Payment Required`, pays the writer a few cents of USDC, and receives the text plus the author's signed proof. Writers connect a wallet, publish articles or video transcripts, set a price, and watch earnings arrive with transaction links.

**Solana integration.**
- x402 `exact` scheme on Solana: one USDC `TransferChecked` per read, paid directly to the writer's wallet (no custody, no platform cut). The facilitator pays the network fee, so agents need only USDC.
- Wallet sign-in and authorship: the writer's wallet signs a statement containing the SHA-256 of the content (ed25519). Anyone can verify it.
- The server checks the writer's USDC token account exists before publishing, because payments to a missing account fail.
- Public ledger of paid reads with Solana Explorer links.

**Deployment.** Network: Solana devnet. USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. Facilitator `https://x402.org/facilitator`. Demo agent wallet: [address]. Sample writer wallet: [address]. Example payment txs: [explorer links after your real run].
No custom program (payments are plain SPL transfers).

**Links.** Live MVP: [Vercel URL] · Repo: [GitHub URL] · Demo video: [URL] · Colosseum project (country: Germany, via https://arena.colosseum.org/?ref=germany): [URL] · Telegram: [@handle]

**Honest limits.** Proves which wallet published a text, not that a human wrote it. No co-author splits yet. Demo agent is scripted, not an LLM. Devnet only.

## Demo video script (2–3 min)
1. (0:00) Landing page: one sentence of the problem. Show the live ledger at zero.
2. (0:20) Writer view: connect wallet, publish a short article, sign. Show the price.
3. (0:55) /agent: ask "Why did my transaction expire?". Narrate: free search, 402, pay 0.02 USDC to the writer, signature verified.
4. (1:35) Click a transaction link to Solana Explorer. Show the USDC arriving at the writer.
5. (1:55) Dashboard: earnings and reads ticked up.
6. (2:15) Claude Desktop with the MCP server: search_knowledge, read_article, budget refusal.
7. (2:40) Roadmap in one breath.
