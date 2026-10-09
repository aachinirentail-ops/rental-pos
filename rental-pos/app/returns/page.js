'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  money,
  nowLocal,
  toMs,
  MIN,
  dueInfo,
  waLink,
  reminderText,
  finalBillText,
  fmtDT,
  fmtDuration,
  billStart,
  billDue,
  itemLabel,
  nicKey,
  normalizePhone,
  outstandingOf,
} from '@/lib/util';
import { useApp } from '@/components/Providers';
import ReturnModal from '@/components/ReturnModal';

// Customer hands the items back: type the NIC number, find the open rental, close the bill.
export default function ReturnsPage() {
  const { t, lang } = useApp();
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [returning, setReturning] = useState(null);
  const [done, setDone] = useState(null); // the bill that was just closed
  const [, setTick] = useState(0);
  const inputRef = useRef(null);

  async function load() {
    try {
      const res = await fetch('/api/bills');
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setBills(d.bills || []);
      setSettings(d.settings || null);
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
    if (inputRef.current) inputRef.current.focus();
    const id = setInterval(() => {
      load();
      setTick((x) => x + 1);
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const needle = q.trim().toLowerCase();
  const nk = nicKey(q);
  const digits = q.replace(/\D/g, '');
  const match = (b) =>
    !needle ||
    b.billNo.toLowerCase().includes(needle) ||
    b.customerName.toLowerCase().includes(needle) ||
    (nk.length >= 3 && nicKey(b.nic).includes(nk)) ||
    (digits.length >= 3 && normalizePhone(b.phone).includes(digits.replace(/^0/, '94')));

  const active = bills
    .filter((b) => b.status === 'active' && match(b))
    .sort((a, b) => billDue(a).localeCompare(billDue(b)));
  const owing = needle ? bills.filter((b) => outstandingOf(b) > 0 && match(b)) : [];
  const shop = settings ? settings.shopName : '';
  const now = nowLocal();

  return (
    <>
      <h1>{t('returns.title')}</h1>
      <p className="muted" style={{ marginTop: -8 }}>{t('returns.help')}</p>

      {loadError && <div className="error">{loadError}</div>}

      {done && (
        <div className="foundbox" style={{ marginBottom: 14 }}>
          ✓ <b>{t('returns.closed', { no: done.billNo })}</b>
          <div className="actions" style={{ justifyContent: 'flex-start', margin: '10px 0 0' }}>
            <a className="btn wa small" target="_blank" rel="noreferrer" href={waLink(done.phone, finalBillText(done, shop, lang))}>
              {t('invoice.sendFinal')}
            </a>
            <Link className="btn sec small" href={`/bills/${done.id}`}>{t('returns.openBill')}</Link>
            <button className="btn sec small" onClick={() => setDone(null)}>✕</button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <label style={{ marginTop: 0 }}>{t('returns.search')}</label>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('returns.placeholder')}
          autoComplete="off"
          style={{ fontSize: 18 }}
        />
        <p className="muted" style={{ margin: '8px 0 0' }}>
          {needle ? t('returns.matches', { n: active.length }) : t('returns.all', { n: active.length })}
        </p>
      </div>

      {owing.length > 0 && (
        <div className="warnbox" style={{ marginBottom: 14 }}>
          ⚠ {t('returns.owes')}:
          {owing.map((b) => (
            <div key={b.id}>
              <Link href={`/bills/${b.id}`}><b>{b.billNo}</b></Link> · {b.customerName} · {money(outstandingOf(b))}
            </div>
          ))}
        </div>
      )}

      {loading && <p className="muted">{t('common.loading')}</p>}
      {!loading && active.length === 0 && <div className="card muted">{t('returns.none')}</div>}

      <div className="grid">
        {active.map((b) => {
          const info = dueInfo(b);
          const used = Math.max(0, toMs(now) - toMs(billStart(b)));
          return (
            <div className="card" key={b.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <Link href={`/bills/${b.id}`}><b style={{ fontSize: 17 }}>{b.billNo}</b></Link>
                  <div style={{ marginTop: 4 }}>
                    <b>{b.customerName}</b>
                    <div className="muted">NIC: {b.nic || '-'} · {b.phone}</div>
                  </div>
                </div>
                <span className={'badge ' + info.state}>
                  {t('status.' + info.state)}
                  {info.state === 'overdue' ? ` · ${fmtDuration(info.ms, lang)}` : ''}
                </span>
              </div>
              <div style={{ margin: '10px 0' }}>
                {b.items.map((i) => (
                  <div key={i.itemId}>{itemLabel(i)} <span className="muted">x{i.qty}</span></div>
                ))}
              </div>
              <div className="kv"><span>{t('ret.rentedFrom')}</span><b>{fmtDT(billStart(b))}</b></div>
              <div className="kv"><span>{t('invoice.returnBy')}</span><b>{fmtDT(billDue(b))}</b></div>
              <div className="kv"><span>{t('returns.soFar')}</span><b>{fmtDuration(used, lang)}</b></div>
              <div className="actions" style={{ justifyContent: 'flex-start', marginBottom: 0 }}>
                <button className="btn" onClick={() => setReturning(b)}>{t('common.returned')}</button>
                <a className="btn wa" target="_blank" rel="noreferrer" href={waLink(b.phone, reminderText(b, shop, lang, settings || undefined))}>
                  {t('common.whatsapp')}
                </a>
                <Link className="btn sec" href={`/bills/${b.id}`}>{t('returns.openBill')}</Link>
              </div>
            </div>
          );
        })}
      </div>

      {returning && settings && (
        <ReturnModal
          bill={returning}
          settings={settings}
          onClose={() => setReturning(null)}
          onDone={(bill) => {
            setReturning(null);
            setDone(bill);
            setQ('');
            load();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </>
  );
}
