'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/Providers';

export default function SettingsPage() {
  const { t } = useApp();
  const [s, setS] = useState({ shopName: '', shopPhone: '', graceMinutes: 15, rounding: 'hourly' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then(setS);
  }, []);

  async function save(e) {
    e.preventDefault();
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    });
    if (res.ok) setS(await res.json());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <>
      <h1>{t('settings.title')}</h1>
      <form className="card" onSubmit={save} style={{ maxWidth: 520 }}>
        <label>{t('settings.shopName')}</label>
        <input required value={s.shopName} onChange={(e) => setS({ ...s, shopName: e.target.value })} />
        <label>{t('settings.shopPhone')}</label>
        <input value={s.shopPhone} onChange={(e) => setS({ ...s, shopPhone: e.target.value })} />

        <label>{t('settings.rounding')}</label>
        <select value={s.rounding} onChange={(e) => setS({ ...s, rounding: e.target.value })}>
          <option value="hourly">{t('settings.roundHourly')}</option>
          <option value="daily">{t('settings.roundDaily')}</option>
        </select>
        <label>{t('settings.grace')}</label>
        <input type="number" min="0" max="180" value={s.graceMinutes} onChange={(e) => setS({ ...s, graceMinutes: e.target.value })} />
        <p className="muted" style={{ fontSize: 13 }}>{t('settings.roundHelp')}</p>

        <button className="btn" style={{ marginTop: 6 }}>{t('common.save')}</button>
        {saved && <span style={{ marginLeft: 12, color: 'var(--ok)' }}>{t('settings.saved')}</span>}
      </form>
    </>
  );
}
