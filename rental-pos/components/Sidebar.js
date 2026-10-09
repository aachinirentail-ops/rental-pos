'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp } from './Providers';
import LiveClock from './LiveClock';

const LINKS = [
  { href: '/', key: 'nav.dashboard', icon: '📊' },
  { href: '/billing', key: 'nav.newBill', icon: '🧾' },
  { href: '/returns', key: 'nav.returns', icon: '↩️' },
  { href: '/bills', key: 'nav.billHistory', icon: '🗂️' },
  { href: '/items', key: 'nav.items', icon: '🛠️' },
  { href: '/settings', key: 'nav.settings', icon: '⚙️' },
];

export default function Sidebar() {
  const path = usePathname();
  const { t, theme, toggleLang, toggleTheme } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false); // close the mobile menu after navigating
  }, [path]);

  const isActive = (href) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));

  return (
    <>
      <header className="topbar">
        <button className="iconbtn" onClick={() => setOpen(true)} aria-label={t('toggle.menu')}>☰</button>
        <b>{t('appName')}</b>
        <span style={{ flex: 1 }} />
        <button className="iconbtn" onClick={toggleLang}>{t('toggle.lang')}</button>
        <button className="iconbtn" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
      </header>

      {open && <div className="overlay" onClick={() => setOpen(false)} />}

      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="brand">🔧 {t('appName')}</div>
        <nav className="sidenav">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={'sidelink' + (isActive(l.href) ? ' active' : '')}>
              <span className="ico">{l.icon}</span>
              <span>{t(l.key)}</span>
            </Link>
          ))}
        </nav>

        <div className="sidefoot">
          <LiveClock />
          <button className="sidebtn" onClick={toggleLang}>
            <span className="ico">🌐</span>
            <span>{t('toggle.lang')}</span>
          </button>
          <button className="sidebtn" onClick={toggleTheme}>
            <span className="ico">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span>{theme === 'dark' ? t('toggle.light') : t('toggle.dark')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
