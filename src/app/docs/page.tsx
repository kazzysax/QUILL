export const metadata = { title: 'Docs: Quill' };
export default function Docs() {
  return (
    <div className="page docs">
      <aside className="toc" aria-label="On this page">
        <b>On this page</b>
        <a href="#search">1. Search</a><a href="#pay">2. Pay and read</a><a href="#client">3. x402 client</a><a href="#verify">4. Verify</a><a href="#mcp">5. MCP server</a><a href="#ref">Endpoint reference</a><a href="#limits">Limits</a>
      </aside>
      <div className="docbody">
      <p className="eyebrow">Developers</p>
      <h1>Docs</h1>
      <p className="sub">Search is free. Reading the full text is one paid HTTP request. No account, no API key: the payment is the key.</p>
      <div className="kv"><div><span>Base URL</span><code>https://quill-io.vercel.app</code></div><div><span>Network</span><code>solana:devnet</code></div><div><span>Asset</span><code>USDC</code></div><div><span>Scheme</span><code>x402 exact</code></div></div>

      <h2 id="search">1. Search</h2>
      <pre>{`GET /api/articles?q=priority+fees&limit=5
→ { "articles": [{ "id", "title", "summary", "preview", "priceUsdc", "writer", "fullUrl" }] }`}</pre>

      <h2 id="pay">2. Pay and read</h2>
      <pre>{`GET /api/articles/:id/full
→ 402 Payment Required
   PAYMENT-REQUIRED: <base64 JSON: scheme exact, network, payTo = the writer, amount, USDC mint>

GET /api/articles/:id/full
   PAYMENT-SIGNATURE: <signed USDC transfer>
→ 200 { title, body, author, proof, cite }
   PAYMENT-RESPONSE: <settlement, with the transaction signature>`}</pre>

      <h2 id="client">3. With the x402 client</h2>
      <pre>{`import { x402Client, wrapFetchWithPayment } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm/exact/client';

const client = x402Client.fromConfig({
  schemes: [{ network: 'solana:*', client: new ExactSvmScheme(signer) }],
  spendControls: { maxAmountPerPayment: '$0.25' },
});
const res = await wrapFetchWithPayment(fetch, client)(url);`}</pre>
      <p>The agent only needs USDC. The facilitator pays the network fee.</p>

      <h2 id="verify">4. Verify before you quote</h2>
      <p>Every paid response includes the author's signature. Recompute SHA-256 over <code>JSON.stringify([kind, title, summary, body, videoUrl ?? "", chapters ?? ""])</code>, compare it to <code>proof.contentHash</code>, and verify the ed25519 signature over <code>proof.message</code> with the author's wallet. The <a href="/proof">proof page</a> does it in your browser.</p>
      <p>This shows which wallet published exactly this text and that it was not changed. It does not prove a human wrote it.</p>

      <h2 id="mcp">5. MCP server</h2>
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

      <h2 id="ref">Endpoint reference</h2>
      <table className="ref"><thead><tr><th>Method</th><th>Path</th><th>What it does</th><th>Cost</th></tr></thead><tbody>
        <tr><td><code>GET</code></td><td><code>/api/articles?q=&amp;tag=&amp;limit=</code></td><td>Search titles, summaries, previews and prices</td><td>Free</td></tr>
        <tr><td><code>GET</code></td><td><code>/api/articles/:id</code></td><td>One piece: metadata and free preview</td><td>Free</td></tr>
        <tr><td><code>GET</code></td><td><code>/api/articles/:id/full</code></td><td>Full text plus signed proof. Answers 402 until paid</td><td>Writer’s price</td></tr>
        <tr><td><code>GET</code></td><td><code>/api/articles/:id/proof</code></td><td>Author, content hash and signature check</td><td>Free</td></tr>
        <tr><td><code>GET</code></td><td><code>/api/ledger</code></td><td>Public list of recent paid reads with transactions</td><td>Free</td></tr>
        <tr><td><code>GET</code></td><td><code>/api/config</code></td><td>Network, USDC mint and demo-agent status</td><td>Free</td></tr>
        <tr><td><code>GET</code></td><td><code>/api/health</code></td><td>Service and database status</td><td>Free</td></tr>
        <tr><td><code>GET</code></td><td><code>/llms.txt</code></td><td>Plain-text instructions for language models</td><td>Free</td></tr>
      </tbody></table>
      <p className="note">Writer routes (publish, edit price, remove, dashboard) need a wallet sign-in and are meant for the website, not for agents.</p>

      <h2 id="limits">Limits</h2>
      <ul className="ticks">
        <li>Price per read: 0.001 to 5 USDC, set by the writer</li>
        <li>Free preview: up to about 45% of the text, at most 600 characters</li>
        <li>One payment goes to one wallet; co-author splits are not supported yet</li>
        <li>Rate limits are per server instance, a basic guard rather than a security boundary</li>
        <li>This deployment runs on devnet with test USDC</li>
      </ul>
      </div>
    </div>
  );
}
