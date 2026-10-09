'use client';
import { useEffect, useState } from 'react';
import { useApp } from './Providers';
import { nowLocal, fmtLongDate, fmtClock } from '@/lib/util';

// Sri Lanka date + time (UTC+5:30), whatever the clock/timezone of this device is.
// Renders nothing until the browser has loaded, so the server and browser HTML always match.
export default function LiveClock({ big = false }) {
  const { lang, t } = useApp();
  const [now, setNow] = useState('');

  useEffect(() => {
    const tick = () => setNow(nowLocal());
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <div className={big ? 'clock big' : 'clock'} style={{ minHeight: big ? 44 : 34 }} />;
  return (
    <div className={big ? 'clock big' : 'clock'} title={t('dash.slTime')}>
      <div className="clock-time">{fmtClock(now)}</div>
      <div className="clock-date">{fmtLongDate(now, lang)}</div>
      {big && <div className="clock-zone">{t('dash.slTime')}</div>}
    </div>
  );
}
