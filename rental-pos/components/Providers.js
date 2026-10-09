'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DICT } from '@/lib/i18n';

const Ctx = createContext({
  lang: 'en',
  theme: 'light',
  t: (k) => k,
  toggleLang() {},
  toggleTheme() {},
});

export const useApp = () => useContext(Ctx);

export function Providers({ children }) {
  const [lang, setLang] = useState('en');
  const [theme, setTheme] = useState('light');
  const [ready, setReady] = useState(false);

  // read the saved choice once, after the page has loaded in the browser
  useEffect(() => {
    try {
      const l = localStorage.getItem('lang');
      if (l === 'si' || l === 'en') setLang(l);
      const th =
        localStorage.getItem('theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      setTheme(th === 'dark' ? 'dark' : 'light');
    } catch {}
    setReady(true);
  }, []);

  // apply it (only after the saved value was read, so dark mode does not flash light)
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
  }, [ready, theme, lang]);

  const toggleLang = useCallback(() => {
    setLang((cur) => {
      const next = cur === 'en' ? 'si' : 'en';
      try { localStorage.setItem('lang', next); } catch {}
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((cur) => {
      const next = cur === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch {}
      return next;
    });
  }, []);

  const t = useCallback(
    (key, vars) => {
      let s = (DICT[lang] && DICT[lang][key]) ?? DICT.en[key] ?? key;
      if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
      return s;
    },
    [lang]
  );

  const value = useMemo(
    () => ({ lang, theme, t, toggleLang, toggleTheme }),
    [lang, theme, t, toggleLang, toggleTheme]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
