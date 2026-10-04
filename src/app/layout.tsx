import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SessionProvider } from '@/components/Session';
import Nav from '@/components/Nav';

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
          <footer className="wrap">
            <span>Quill. Built for the Road to Colosseum hackathon, Superteam Germany.</span>
            <span><a href="/llms.txt">llms.txt</a> · <a href="/api/health">status</a></span>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
