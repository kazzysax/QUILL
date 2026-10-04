export const metadata = { title: 'Docs: Quill' };
export default function Docs() {
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <h1>Docs</h1>
      <p className="sub">Search is free. Reading the full text is one paid HTTP request.</p>

      <h2 style={{ fontSize: 28 }}>1. Search</h2>
      <pre>{`GET /api/articles?q=priority+fees&limit=5
→ { "articles": [{ "id", "title", "summary", "preview", "priceUsdc", "writer", "fullUrl" }] }`}</pre>

      <h2 style={{ fontSize: 28, marginTop: 36 }}>2. Pay and read</h2>
      <pre>{`GET /api/articles/:id/full
→ 402 Payment Required
   PAYMENT-REQUIRED: <base64 JSON: scheme exact, network, payTo = the writer, amount, USDC mint>

GET /api/articles/:id/full
   PAYMENT-SIGNATURE: <signed USDC transfer>
→ 200 { title, body, author, proof, cite }
   PAYMENT-RESPONSE: <settlement, with the transaction signature>`}</pre>

      <h2 style={{ fontSize: 28, marginTop: 36 }}>3. With the x402 client</h2>
      <pre>{`import { x402Client, wrapFetchWithPayment } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm/exact/client';

const client = x402Client.fromConfig({
  schemes: [{ network: 'solana:*', client: new ExactSvmScheme(signer) }],
  spendControls: { maxAmountPerPayment: '$0.25' },
});
const res = await wrapFetchWithPayment(fetch, client)(url);`}</pre>
      <p>The agent only needs USDC. The facilitator pays the network fee.</p>

      <h2 style={{ fontSize: 28, marginTop: 36 }}>4. Verify before you quote</h2>
      <p>Every paid response includes the author's signature. Recompute SHA-256 over <code>JSON.stringify([kind, title, summary, body, videoUrl ?? "", chapters ?? ""])</code>, compare it to <code>proof.contentHash</code>, and verify the ed25519 signature over <code>proof.message</code> with the author's wallet. The <a href="/proof">proof page</a> does it in your browser.</p>
      <p>This shows which wallet published exactly this text and that it was not changed. It does not prove a human wrote it.</p>

      <h2 style={{ fontSize: 28, marginTop: 36 }}>5. MCP server</h2>
      <p>Give Claude Desktop or any MCP client two tools, <code>search_knowledge</code> and <code>read_article</code>, with a hard budget:</p>
      <pre>{`{
  "mcpServers": {
    "quill": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "env": {
        "QUILL_URL": "https://YOUR-QUILL-SITE",
        "AGENT_SECRET_KEY": "<devnet wallet, base58>",
        "QUILL_BUDGET_USDC": "0.50"
      }
    }
  }
}`}</pre>
      <p>Machine-readable instructions live at <a href="/llms.txt">/llms.txt</a>.</p>
    </div>
  );
}
