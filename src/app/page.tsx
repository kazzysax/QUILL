import LiveCard from '@/components/LiveCard';
import { Latest } from '@/components/ArticleCards';

export default function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="h">
        <div>
          <h1 id="h">Knowledge for agents. <span>Paid to the people who wrote it.</span></h1>
          <p className="lead">Search is free. When an AI agent reads a full piece, it pays the author in USDC on Solana, straight to their wallet, in the same HTTP request.</p>
          <div className="cta">
            <a className="btn" href="/write">Start writing</a>
            <a className="btn ghost" href="/agent">Watch an agent pay</a>
            <a className="btn ghost hide-sm" href="/library">Browse library</a>
          </div>
        </div>
        <LiveCard />
      </section>

      <section className="s" id="how">
        <h2>One request. <span>One payment. One author paid.</span></h2>
        <p className="sub">Quill uses the x402 standard: the server answers HTTP 402, the agent pays a few cents, and the text arrives. No accounts, no API keys, no middleman holding the money.</p>
        <div className="grid3">
          <div className="tile sky"><h3>Writers publish and sign</h3><p>Connect a Solana wallet, write an article or add a video transcript, and sign it. The signature proves your wallet published exactly this text. You set the price per read.</p></div>
          <div className="tile"><h3>Agents search for free</h3><p>Titles, summaries, previews and prices are open. An agent decides what is worth buying before it spends a cent, and a budget cap keeps it honest.</p></div>
          <div className="tile"><h3>Reads pay the author</h3><p>The agent pays USDC directly to the writer's wallet. It gets the full text and the signed proof, and can check both before it quotes anything.</p></div>
        </div>
      </section>

      <section className="s">
        <h2>Fresh in the library</h2>
        <p className="sub">Previews are free for people too. Agents buy the full text.</p>
        <Latest />
        <p style={{ marginTop: 22 }}><a className="btn ghost" href="/library">See everything</a></p>
      </section>

      <section className="s">
        <div className="grid3">
          <div className="tile"><h3>Works with video</h3><p>Add a link, a transcript and chapter timestamps. Agents read the transcript and cite the exact moment. The video stays where you host it.</p></div>
          <div className="tile"><h3>Tamper-evident</h3><p>Every piece carries a hash and a wallet signature. If a word changes after signing, the check fails. It proves who published it, not that a human typed it.</p></div>
          <div className="tile"><h3>Plug into any agent</h3><p>A plain HTTP endpoint and an MCP server. Any x402 client can pay. Read the <a href="/docs">docs</a> or <a href="/llms.txt">llms.txt</a>.</p></div>
        </div>
      </section>
    </>
  );
}
