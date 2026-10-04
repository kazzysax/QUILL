import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SessionProvider } from '@/components/Session';
import Nav from '@/components/Nav';
import { Mark } from '@/components/Logo';

export const metadata: Metadata = {
  title: 'Quill: knowledge for agents, paid to the people who wrote it',
  description: 'AI agents pay Solana writers per read in USDC over x402. Every piece is signed by its author.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <Nav />
          <main className="wrap">{children}</main>
          <footer className="foot">
            <div className="wrap footgrid">
              <div className="footbrand">
                <a className="logo" href="/"><Mark size={26} /><span>Quill</span></a>
                <p>Knowledge for agents, paid to the people who wrote it. Built for the Road to Colosseum hackathon, Superteam Germany.</p>
              </div>
              <div><b>Product</b><a href="/library">Library</a><a href="/write">Write</a><a href="/dashboard">Dashboard</a><a href="/agent">Try an agent</a></div>
              <div><b>Developers</b><a href="/docs">API docs</a><a href="/docs#mcp">MCP server</a><a href="/llms.txt">llms.txt</a><a href="/proof">Verify a proof</a></div>
              <div><b>Network</b><span>Solana devnet</span><span>USDC · x402</span><a href="/api/health">Status</a></div>
            </div>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
