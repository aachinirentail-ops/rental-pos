'use client';
import { useEffect, useState } from 'react';
import { useApp } from './Providers';
import {
  calcSettlement,
  money,
  nowLocal,
  isValidLocal,
  fmtDT,
  fmtDuration,
  billStart,
  billDue,
  toMs,
  itemLabel,
  PAY_METHODS,
  MIN,
  HOUR,
} from '@/lib/util';

// Closes a rental: works out days + hours really used, lets you give a discount,
// add an extra charge, and record the money received (cash handed over, change to give back,
// or a bank transfer / card payment).
export default function ReturnModal({ bill, settings, onClose, onDone }) {
  const { t, lang } = useApp();
  const [returnedAt, setReturnedAt] = useState(() => nowLocal());
  const [basis, setBasis] = useState('actual');
  const [extra, setExtra] = useState('');
  const [extraNote, setExtraNote] = useState('');
  const [dType, setDType] = useState(bill.discountType || 'amount');
  const [dValue, setDValue] = useState(bill.discountValue ? String(bill.discountValue) : '');
  const [method, setMethod] = useState('cash');
  const [given, setGiven] = useState(null); // null = the customer pays exactly the balance
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const okAt =
    isValidLocal(returnedAt) &&
    toMs(returnedAt) >= toMs(billStart(bill)) &&
    toMs(returnedAt) <= toMs(nowLocal()) + 10 * MIN;
  const at = isValidLocal(returnedAt) ? returnedAt : nowLocal();
  const base = { returnedAt: at, basis, extraCharge: extra, extraNote, discountType: dType, discountValue: dValue, method };
  const s0 = calcSettlement(bill, { ...base, received: 0 }, settings);
  const received = given === null ? s0.due : Math.max(0, Number(given) || 0);
  const s = calcSettlement(bill, { ...base, received }, settings);

  const dueMs = toMs(billDue(bill));
  const diff = toMs(at) - dueMs;
  const timing =
    Math.abs(diff) < 60000
      ? t('ret.onTime')
      : diff > 0
      ? t('ret.late', { d: fmtDuration(diff, lang) })
      : t('ret.early', { d: fmtDuration(-diff, lang) });

  async function confirmReturn() {
    if (!okAt) return setError(t('ret.badDate'));
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/bills', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bill.id, action: 'return', ...base, received }),
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
      <div className="modal" role="dialog" aria-modal="true">
        <h2>{t('ret.title', { no: bill.billNo })}</h2>
        <p className="muted" style={{ marginTop: -6 }}>
          {bill.customerName} · {bill.phone}
          {bill.nic ? ` · ${bill.nic}` : ''}
          <br />
          {bill.items.map((i) => `${itemLabel(i)} x${i.qty}`).join(', ')}
        </p>

        <div className="kv"><span>{t('ret.rentedFrom')}</span><b>{fmtDT(billStart(bill))}</b></div>
        <div className="kv"><span>{t('ret.booked')}</span><b>{fmtDT(billDue(bill))} ({bill.halfDay ? t('common.halfDay') : t('common.daysN', { n: bill.days })})</b></div>

        <label>{t('ret.returnedAt')}</label>
        <input type="datetime-local" value={returnedAt} onChange={(e) => setReturnedAt(e.target.value)} />
        {!okAt && <div className="error">{t('ret.badDate')}</div>}

        <div className="kv" style={{ marginTop: 8 }}>
          <span>{t('ret.timeUsed')}</span>
          <b>{fmtDuration(s.usedMinutes * MIN, lang)} <span className={diff > 60000 ? 'late' : 'muted'}>· {timing}</span></b>
        </div>

        <label>{t('ret.basis')}</label>
        <select value={basis} onChange={(e) => setBasis(e.target.value)}>
          <option value="actual">{t('ret.basisActual')}</option>
          <option value="booked">{t('ret.basisBooked')}</option>
        </select>

        <div className="row">
          <div>
            <label>{t('ret.extra')}</label>
            <input type="number" min="0" step="0.01" value={extra} onChange={(e) => setExtra(e.target.value)} />
          </div>
          <div>
            <label>{t('ret.extraNote')}</label>
            <input value={extraNote} onChange={(e) => setExtraNote(e.target.value)} />
          </div>
        </div>

        <div className="row">
          <div>
            <label>{t('billing.discType')}</label>
            <select value={dType} onChange={(e) => setDType(e.target.value)}>
              <option value="amount">{t('billing.amountRs')}</option>
              <option value="percent">{t('billing.percent')}</option>
            </select>
          </div>
          <div>
            <label>{t('ret.discount')}</label>
            <input type="number" min="0" step="0.01" value={dValue} onChange={(e) => setDValue(e.target.value)} />
          </div>
        </div>

        <div className="totals">
          <div><span>{t('ret.rentalCharge')} <small className="muted">({fmtDuration(s.billedHours * HOUR, lang)})</small></span><span>{money(s.rentalCharge)}</span></div>
          {s.halfDay && <div><span className="muted">{t('ret.halfApplied')}</span><span></span></div>}
          {s.extraCharge > 0 && <div><span>{t('ret.extraShort')}</span><span>+ {money(s.extraCharge)}</span></div>}
          {s.discountAmount > 0 && <div><span>{t('common.discount')}</span><span>- {money(s.discountAmount)}</span></div>}
          <div className="grand"><span>{t('ret.finalTotal')}</span><span>{money(s.finalTotal)}</span></div>
          <div><span>{t('ret.advancePaid')}</span><span>- {money(s.advance)}</span></div>
          {s.refund > 0 ? (
            <div style={{ color: 'var(--ok)', fontWeight: 700 }}><span>{t('ret.refund')}</span><span>{money(s.refund)}</span></div>
          ) : (
            <div style={{ fontWeight: 700 }}><span>{t('ret.toCollect')}</span><span>{money(s.due)}</span></div>
          )}
        </div>

        {(s.due > 0 || s.refund > 0) && (
          <>
            <label>{t('pm.label')}</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAY_METHODS.map((m) => (
                <option key={m} value={m}>{t('pm.' + m)}</option>
              ))}
            </select>
          </>
        )}

        {s.due > 0 && (
          <>
            <label>{t('ret.received')}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={given === null ? String(s0.due) : given}
              onChange={(e) => setGiven(e.target.value)}
            />
            <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>{t('ret.receivedHint')}</p>
            {s.change > 0 && (
              <div className="changebox">
                <span>{t('ret.change')}</span>
                <b>{money(s.change)}</b>
              </div>
            )}
            {s.outstanding > 0 && (
              <div className="warnbox">{t('ret.outstanding')}: <b>{money(s.outstanding)}</b></div>
            )}
          </>
        )}

        {error && <div className="error">{error}</div>}
        <div className="btnrow">
          <button type="button" className="btn sec" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="btn" disabled={saving || !okAt} onClick={confirmReturn}>
            {saving ? t('billing.saving') : t('ret.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
