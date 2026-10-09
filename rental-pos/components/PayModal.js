'use client';
import { useEffect, useState } from 'react';
import { useApp } from './Providers';
import { money, round2, PAY_METHODS } from '@/lib/util';

// Records a later payment on a closed bill that still has an unpaid balance.
export default function PayModal({ bill, onClose, onDone }) {
  const { t } = useApp();
  const owed = bill.settlement ? bill.settlement.outstanding : 0;
  const [given, setGiven] = useState(String(owed));
  const [method, setMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const received = Math.max(0, Number(given) || 0);
  const change = round2(Math.max(0, received - owed));

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/bills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bill.id, action: 'pay', received, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      onDone(data);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 440 }}>
        <h2>{t('pay.title', { no: bill.billNo })}</h2>
        <p className="muted" style={{ marginTop: -6 }}>{bill.customerName} · {bill.phone}</p>
        <div className="kv"><span>{t('pay.owed')}</span><b>{money(owed)}</b></div>

        <label>{t('pm.label')}</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          {PAY_METHODS.map((m) => (
            <option key={m} value={m}>{t('pm.' + m)}</option>
          ))}
        </select>

        <label>{t('ret.received')}</label>
        <input type="number" min="0" step="0.01" inputMode="decimal" value={given} onChange={(e) => setGiven(e.target.value)} />
        {change > 0 && (
          <div className="changebox">
            <span>{t('ret.change')}</span>
            <b>{money(change)}</b>
          </div>
        )}

        {error && <div className="error">{error}</div>}
        <div className="btnrow">
          <button type="button" className="btn sec" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn" disabled={saving || received <= 0} onClick={save}>
            {saving ? t('billing.saving') : t('pay.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
