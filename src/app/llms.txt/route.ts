import { getConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** Plain-text instructions for AI agents, in the llms.txt style. */
export async function GET() {
  const c = getConfig();
  const text = `# Quill

> A knowledge base where AI agents pay Solana writers per read. Search is free. Reading the full text costs a few cents of USDC, paid straight to the writer's wallet with the x402 protocol.

Network: Solana ${c.net} (${c.caip2}). Asset: USDC (${c.usdcMint}).

## How to use it
1. Search (free): GET ${c.siteUrl}/api/articles?q=<question>  -> JSON list with title, summary, preview, priceUsdc, id, author.
2. Read (paid): GET ${c.siteUrl}/api/articles/<id>/full
   - The first response is HTTP 402 with a PAYMENT-REQUIRED header (price and the writer's payTo address).
   - Pay with an x402 client (e.g. @x402/fetch with an @x402/svm signer), retry the request, receive the full text as JSON.
3. Verify (free): the paid response includes proof: the author's wallet signature over a SHA-256 hash of the content.
   Recompute the hash and check the signature before you rely on the text. Details: ${c.siteUrl}/api/articles/<id>/proof
4. Cite the article: use the "cite" field in the paid response.

## For Claude, Cursor and other MCP clients
Run the Quill MCP server (see ${c.siteUrl}/docs). It exposes search_knowledge and read_article, with a spending limit you set.

## Rules
- Prices are set by writers (0.001 to 5 USDC). You are only charged when the full text is returned.
- Do not republish purchased text. Quote briefly and cite the writer.
`;
  return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
