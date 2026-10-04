'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { ConnectButton } from './Session';
import { Logo } from './Logo';

const LINKS: [string, string][] = [['/#how', 'How it works'], ['/library', 'Library'], ['/write', 'Write'], ['/agent', 'Try an agent'], ['/proof', 'Proof'], ['/docs', 'Docs']];

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="top">
      <div className="wrap">
        <nav className="nav" aria-label="Main">
          <Logo />
          <div className="links">{LINKS.map(([h, l]) => <a key={h} href={h} aria-current={path === h ? 'page' : undefined}>{l}</a>)}</div>
          <span className="grow" />
          <span className="netpill" title="Payments run on Solana devnet with test USDC"><i />Devnet</span>
          <ConnectButton />
          <button className="burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}><span /><span /></button>
        </nav>
        {open && <div className="mlinks">{LINKS.map(([h, l]) => <a key={h} href={h} onClick={() => setOpen(false)}>{l}</a>)}</div>}
      </div>
    </header>
  );
}
