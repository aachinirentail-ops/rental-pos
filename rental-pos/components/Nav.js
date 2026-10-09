'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/billing', label: 'New Bill' },
  { href: '/bills', label: 'Bill History' },
  { href: '/items', label: 'Items' },
  { href: '/settings', label: 'Settings' },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <span className="logo">Rental POS</span>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={'link' + (path === l.href ? ' active' : '')}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
