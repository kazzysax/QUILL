import LiveCard from '@/components/LiveCard';
import { Latest } from '@/components/ArticleCards';

const SPEC: [string, string][] = [
  ['Price per read', '0.001 to 5 USDC, set by the writer, changeable any time'],
  ['Platform fee', 'None. Quill takes no cut and never holds funds'],
  ['Payment', 'One USDC transfer, agent wallet to writer wallet'],
  ['Protocol', 'x402, exact scheme, HTTP 402 Payment Required'],
  ['Network', 'Solana devnet today, mainnet ready'],
  ['Network fee', 'Paid by the facilitator, the agent only needs USDC'],
  ['Free preview', 'Up to about 45% of a piece, capped at 600 characters'],
  ['Authorship proof', 'SHA-256 content hash plus ed25519 wallet signature'],
  ['Sign-in', 'Wallet-signed nonce, no email or password'],
  ['Wallets', 'Phantom, Solflare, Backpack (Wallet Standard)'],
  ['Agent access', 'HTTP API, MCP server, llms.txt'],
  ['Content types', 'Articles, and video transcripts with chapters'],
];

const FAQ: [string, string][] = [
  ['Do agents need an account or API key?', 'No. Search is open. To read, an agent answers the 402 with a signed USDC payment. The payment is the key.'],
  ['Where does the money go?', 'Straight to the writer’s wallet in the same request. Quill is never in the middle and takes no fee.'],
  ['What does the signature prove?', 'That a specific wallet published exactly this text, and that nothing changed since. It does not prove a human typed it.'],
  ['Can a writer change the price?', 'Yes, from the dashboard. The new price applies to the next read. Pieces can also be removed.'],
  ['What stops an agent overspending?', 'The agent sets its own limits. The MCP server enforces a hard session budget, and the x402 client supports a per-payment cap.'],
  ['Is this real money?', 'Not yet. This deployment runs on Solana devnet with test USDC, so you can try every step for free.'],
];

export default function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="h">
        <div className="herotext">
          <p className="eyebrow">x402 · USDC · Solana</p>
          <h1 id="h">Knowledge for agents. <span>Paid to the people who wrote it.</span></h1>
          <p className="lead">Search is free. When an AI agent reads a full piece, it pays the author in USDC on Solana, straight to their wallet, in the same HTTP request.</p>
          <div className="cta">
            <a className="btn" href="/write">Start writing</a>
            <a className="btn ghost" href="/agent">Watch an agent pay</a>
          </div>
          <ul className="facts">
            <li><b>0%</b> platform fee</li>
            <li><b>1</b> request to pay and read</li>
            <li><b>$0.001</b> minimum price</li>
          </ul>
        </div>
        <LiveCard />
      </section>

      <section className="s" id="how">
        <div className="split">
          <div>
            <p className="eyebrow">How it works</p>
            <h2>One request. <span>One payment. One author paid.</span></h2>
            <p className="sub">Quill uses x402, the open standard for paying over HTTP. No accounts, no API keys, no middleman holding the money.</p>
            <ol className="flow">
              <li><b>Search for free</b><span>The agent sees titles, summaries, previews and prices before it spends anything.</span></li>
              <li><b>Get a 402</b><span>Asking for the full text returns <code>402 Payment Required</code> with the price and the writer’s wallet.</span></li>
              <li><b>Pay and read</b><span>The agent signs a USDC transfer and repeats the request. The text arrives with a signed proof.</span></li>
              <li><b>Verify, then quote</b><span>The agent checks the hash and the author’s signature, then cites the source.</span></li>
            </ol>
          </div>
          <div className="term" aria-label="Example x402 exchange">
            <div className="termbar"><i /><i /><i /><span>agent → quill</span></div>
<pre>{`GET /api/articles/x402-on-solana/full

HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: {
  "scheme":  "exact",
  "network": "solana:devnet",
  "amount":  "20000",     // 0.02 USDC
  "payTo":   "<writer wallet>"
}

GET /api/articles/x402-on-solana/full
PAYMENT-SIGNATURE: <signed USDC transfer>

HTTP/1.1 200 OK
{ "title", "body", "author",
  "proof": { "contentHash", "signature" } }`}</pre>
          </div>
        </div>
      </section>

      <section className="s">
        <div className="duo">
          <div className="side writer">
            <p className="eyebrow">For writers</p>
            <h3>Publish once. Get paid every time an agent reads.</h3>
            <ul className="ticks">
              <li>Connect Phantom, Solflare or Backpack</li>
              <li>Write an article, or add a video transcript with chapters</li>
              <li>Set your price from 0.001 to 5 USDC</li>
              <li>Sign it, so agents know it is yours and unchanged</li>
              <li>Track every read, with its Solana transaction, on your dashboard</li>
            </ul>
            <a className="btn" href="/write">Start writing</a>
          </div>
          <div className="side agent">
            <p className="eyebrow">For agents and builders</p>
            <h3>Pay a few cents for answers you can cite.</h3>
            <ul className="ticks">
              <li>Free search over a plain HTTP API</li>
              <li>Pay with any x402 client, only USDC needed</li>
              <li>MCP server for Claude Desktop and other MCP clients</li>
              <li>Hard budgets, so an agent never overspends</li>
              <li>Every paid answer carries a verifiable author signature</li>
            </ul>
            <a className="btn ghost" href="/docs">Read the docs</a>
          </div>
        </div>
      </section>

      <section className="s">
        <div className="head">
          <div><p className="eyebrow">Library</p><h2>Fresh in the library</h2></div>
          <a className="btn ghost sm" href="/library">See everything</a>
        </div>
        <p className="sub">Previews are free for people too. Agents buy the full text.</p>
        <Latest />
      </section>

      <section className="s">
        <p className="eyebrow">Specification</p>
        <h2>The details. <span>All of them.</span></h2>
        <dl className="spec">
          {SPEC.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </section>

      <section className="s">
        <div className="trust">
          <div>
            <p className="eyebrow">Proof of authorship</p>
            <h2>Every piece is signed. <span>Anyone can check.</span></h2>
            <p className="sub">When a writer publishes, Quill hashes the content and the writer’s wallet signs it. Paid responses include that proof. If a single word changes after signing, the check fails.</p>
            <div className="cta"><a className="btn ghost" href="/proof">Verify a proof</a></div>
          </div>
          <ul className="checks">
            <li><b>Content hash</b><span>SHA-256 over the title, summary, body and video fields</span></li>
            <li><b>Wallet signature</b><span>ed25519, by the writer’s Solana wallet</span></li>
            <li><b>Checked in your browser</b><span>The proof page re-runs both checks client-side</span></li>
            <li><b>Honest limit</b><span>Proves which wallet published it, not that a human typed it</span></li>
          </ul>
        </div>
      </section>

      <section className="s">
        <p className="eyebrow">FAQ</p>
        <h2>Questions</h2>
        <div className="faq">
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </div>
      </section>

      <section className="s">
        <div className="closer">
          <h2>Write it once. <span>Let agents pay you for it.</span></h2>
          <div className="cta"><a className="btn" href="/write">Start writing</a><a className="btn ghost" href="/agent">Watch an agent pay</a></div>
        </div>
      </section>
    </>
  );
}
