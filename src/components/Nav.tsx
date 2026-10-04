'use client';
import { usePathname } from 'next/navigation';
import { ConnectButton } from './Session';

const LINKS: [string, string][] = [['/#how', 'How it works'], ['/library', 'Library'], ['/write', 'Write'], ['/agent', 'Try an agent'], ['/proof', 'Proof'], ['/docs', 'Docs']];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="wrap">
      <nav className="nav" aria-label="Main">
        <a className="logo" href="/"><i />Quill</a>
        <div className="links">{LINKS.map(([h, l]) => <a key={h} href={h} aria-current={path === h ? 'page' : undefined}>{l}</a>)}</div>
        <span style={{ flex: 1 }} className="menu" />
        <ConnectButton />
      </nav>
      <div className="mlinks menu" style={{ display: 'none' }}>{LINKS.map(([h, l]) => <a key={h} href={h} className="tag">{l}</a>)}</div>
    </header>
  );
}
