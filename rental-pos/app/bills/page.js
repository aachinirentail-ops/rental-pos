'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { money, dueInfo, waLink, reminderText, finalBillText, splitDT, billDue, outstandingOf, itemLabel } from '@/lib/util';
import { useApp } from '@/components/Providers';
import ReturnModal from '@/components/ReturnModal';

function dt(s) {
  const p = splitDT(s);
  return (
    <>
      {p.date}
      <div className="muted">{p.time}</div>
    </>
  );
}

export default function BillsPage() {
  const { t, lang } = useApp();
  const router = useRouter();
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [returning, setReturning] = useState(null);

  const [loadError, setLoadError] = useState('');

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
  }
  useEffect(() => {
    load();
  }, []);

  async function reopen(b) {
    const id = b.id;
    if (!confirm(t('history.confirmReopen', { no: b.billNo }))) return;
    const res = await fetch('/api/bills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'reopen' }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    load();
  }

  async function remove(b) {
    if (!confirm(t('history.confirmDelete', { no: b.billNo }))) return;
    const res = await fetch('/api/bills?id=' + b.id, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    load();
  }

  const rows = bills
    .map((b) => ({ b, info: dueInfo(b) }))
    .filter(({ b, info }) => {
      if (status === 'returned' && b.status !== 'returned') return false;
      if (status === 'active' && b.status !== 'active') return false;
      if (status === 'overdue' && info.state !== 'overdue') return false;
      if (status === 'unpaid' && outstandingOf(b) <= 0) return false;
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return [b.billNo, b.customerName, b.phone, b.nic].some((v) => String(v).toLowerCase().includes(s));
    });

  const shown = (b) => (b.status === 'returned' && b.settlement ? b.settlement.finalTotal : b.total);
  const total = rows.reduce((s, r) => s + shown(r.b), 0);
  const shop = settings ? settings.shopName : '';

  return (
    <>
      <h1>{t('history.title')}</h1>
      {loadError && <div className="error">{loadError}</div>}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <div style={{ flex: 3 }}>
            <label>{t('history.search')}</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <label>{t('common.status')}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">{t('common.all')}</option>
              <option value="active">{t('status.active')}</option>
              <option value="overdue">{t('status.overdue')}</option>
              <option value="returned">{t('status.returned')}</option>
              <option value="unpaid">{t('history.unpaidOnly')}</option>
            </select>
          </div>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {t('history.count', { n: rows.length, total: money(total) })}
        </p>
      </div>

      <div className="card table-wrap">
        <table className="rtable">
          <thead>
            <tr>
              <th>{t('common.bill')}</th>
              <th>{t('common.date')}</th>
              <th>{t('common.customer')}</th>
              <th>{t('common.items')}</th>
              <th>{t('common.due')}</th>
              <th className="right">{t('common.total')}</th>
              <th>{t('common.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr className="empty"><td colSpan="8" className="muted">{t('history.none')}</td></tr>}
            {rows.map(({ b, info }) => (
              <tr key={b.id}>
                <td className="nw" data-label={t('common.bill')}><Link href={`/bills/${b.id}`}><b>{b.billNo}</b></Link></td>
                <td className="nw" data-label={t('common.date')}><div>{dt(b.startAt)}</div></td>
                <td data-label={t('common.customer')}><div>{b.customerName}<div className="muted">{b.phone}</div><div className="muted">{b.nic}</div></div></td>
                <td data-label={t('common.items')}>{b.items.map((i) => `${itemLabel(i)} x${i.qty}`).join(', ')}</td>
                <td className="nw" data-label={t('common.due')}><div>{dt(billDue(b))}</div></td>
                <td className="right nw" data-label={t('common.total')}>{money(shown(b))}</td>
                <td data-label={t('common.status')}><div>
                  <span className={'badge ' + info.state}>{t('status.' + info.state)}</span>
                  {outstandingOf(b) > 0 && <div className="late" style={{ fontSize: 12 }}>{t('history.unpaid', { amt: money(outstandingOf(b)) })}</div>}
                </div></td>
                <td className="right actcell">
                  {b.status === 'active' ? (
                    <>
                      <a className="btn wa small" target="_blank" rel="noreferrer" href={waLink(b.phone, reminderText(b, shop, lang, settings || undefined))}>{t('common.whatsapp')}</a>
                      <button className="btn sec small" onClick={() => setReturning(b)}>{t('common.returned')}</button>
                    </>
                  ) : (
                    <>
                      <a className="btn wa small" target="_blank" rel="noreferrer" href={waLink(b.phone, finalBillText(b, shop, lang))}>{t('common.whatsapp')}</a>
                      <button className="btn sec small" onClick={() => reopen(b)}>{t('common.reopen')}</button>
                    </>
                  )}
                  <Link className="btn sec small" href={`/bills/${b.id}/edit`}>{t('common.edit')}</Link>
                  <button className="btn danger small" onClick={() => remove(b)}>{t('common.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {returning && settings && (
        <ReturnModal
          bill={returning}
          settings={settings}
          onClose={() => setReturning(null)}
          onDone={(bill) => router.push('/bills/' + bill.id)}
        />
      )}
    </>
  );
}
