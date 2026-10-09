'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  money,
  dueInfo,
  waLink,
  reminderText,
  invoiceText,
  finalBillText,
  fmtDT,
  fmtDuration,
  billStart,
  billDue,
  itemLabel,
  methodLabel,
  MIN,
} from '@/lib/util';
import { useApp } from '@/components/Providers';
import ReturnModal from '@/components/ReturnModal';
import PayModal from '@/components/PayModal';

export default function InvoicePage() {
  const { t, lang } = useApp();
  const router = useRouter();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [returning, setReturning] = useState(false);
  const [paying, setPaying] = useState(false);

  async function load() {
    const res = await fetch('/api/bills?id=' + id);
    const d = await res.json();
    if (!res.ok) return setErr(t('invoice.notFound'));
    setData(d);
  }
  useEffect(() => {
    load();
  }, [id]);

  async function patch(body) {
    const res = await fetch('/api/bills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    });
    const d = await res.json();
    if (!res.ok) return alert(d.error);
    load();
  }

  async function remove() {
    if (!confirm(t('history.confirmDelete', { no: data.bill.billNo }))) return;
    const res = await fetch('/api/bills?id=' + id, { method: 'DELETE' });
    if (!res.ok) return alert((await res.json()).error);
    router.push('/bills');
  }

  if (err) return <p className="error">{err}</p>;
  if (!data) return <p className="muted">{t('common.loading')}</p>;

  const { bill: b, settings } = data;
  const s = b.settlement;
  const info = dueInfo(b);
  const closed = b.status === 'returned' && s;
  const balance = Math.max(0, b.total - (b.advance || 0));
  const payLabel = { advance: t('pay.advance'), final: t('pay.final'), refund: t('pay.refund') };

  return (
    <>
      <div className="actions">
        <button className="btn" onClick={() => window.print()}>{t('common.print')}</button>
        {closed ? (
          <a className="btn wa" target="_blank" rel="noreferrer" href={waLink(b.phone, finalBillText(b, settings.shopName, lang))}>
            {t('invoice.sendFinal')}
          </a>
        ) : (
          <>
            <a className="btn wa" target="_blank" rel="noreferrer" href={waLink(b.phone, invoiceText(b, settings.shopName, lang))}>
              {t('invoice.sendInvoice')}
            </a>
            <a className="btn wa" target="_blank" rel="noreferrer" href={waLink(b.phone, reminderText(b, settings.shopName, lang, settings))}>
              {t('invoice.sendReminder')}
            </a>
          </>
        )}
        {b.status === 'active' && <button className="btn sec" onClick={() => setReturning(true)}>{t('invoice.markReturned')}</button>}
        {closed && s.outstanding > 0 && <button className="btn sec" onClick={() => setPaying(true)}>{t('invoice.recordPayment')}</button>}
        {b.status === 'returned' && <button className="btn sec" onClick={() => confirm(t('history.confirmReopen', { no: b.billNo })) && patch({ action: 'reopen' })}>{t('common.reopen')}</button>}
        <Link className="btn sec" href={`/bills/${b.id}/edit`}>{t('common.edit')}</Link>
        <button className="btn danger" onClick={remove}>{t('common.delete')}</button>
        <Link className="btn sec" href="/billing">{t('invoice.newBill')}</Link>
      </div>

      <div className="invoice">
        <h1>{settings.shopName}</h1>
        {settings.shopPhone && <p style={{ textAlign: 'center', margin: 0 }} className="muted">{settings.shopPhone}</p>}
        <hr />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <b>{closed ? t('invoice.finalBill') + ' · ' : ''}{t('invoice.billNo', { no: b.billNo })}</b>
            <div className="muted">{new Date(b.createdAt).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })}</div>
          </div>
          <span className={'badge ' + info.state}>{t('status.' + info.state)}</span>
        </div>

        <p>
          <b>{b.customerName}</b><br />
          {b.phone}<br />
          NIC: {b.nic || '-'}
        </p>

        <table>
          <thead>
            <tr>
              <th>{t('common.item')}</th>
              <th>{t('common.qty')}</th>
              <th>{t('invoice.rateDay')}</th>
            </tr>
          </thead>
          <tbody>
            {b.items.map((i) => (
              <tr key={i.itemId}>
                <td>{i.code ? <span className="muted">{i.code} · </span> : null}{i.name}</td>
                <td>{i.qty}</td>
                <td>
                  {money(i.rate)}
                  {i.halfRate > 0 && <div className="muted" style={{ fontSize: 12 }}>{t('invoice.halfRateShort', { amt: money(i.halfRate) })}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="kv"><span>{t('invoice.rentedAt')}</span><b>{fmtDT(billStart(b))}</b></div>
        <div className="kv"><span>{t('invoice.returnBy')}</span><b>{fmtDT(billDue(b))} ({b.halfDay ? t('common.halfDay') : t('common.daysN', { n: b.days })})</b></div>
        {closed && (
          <>
            <div className="kv"><span>{t('invoice.returnedAt')}</span><b>{fmtDT(s.returnedAt)}</b></div>
            <div className="kv"><span>{t('invoice.timeUsed')}</span><b>{fmtDuration(s.usedMinutes * MIN, lang)}</b></div>
          </>
        )}

        {closed ? (
          <div className="totals">
            <div><span>{t('invoice.rentalCharge')}</span><span>{money(s.rentalCharge)}</span></div>
            {s.extraCharge > 0 && <div><span>{t('invoice.extra')}{s.extraNote ? ` (${s.extraNote})` : ''}</span><span>+ {money(s.extraCharge)}</span></div>}
            {s.discountAmount > 0 && (
              <div>
                <span>{s.discountType === 'percent' ? t('invoice.discountPct', { v: s.discountValue }) : t('common.discount')}</span>
                <span>- {money(s.discountAmount)}</span>
              </div>
            )}
            <div className="grand"><span>{t('invoice.finalTotal')}</span><span>{money(s.finalTotal)}</span></div>
            <div><span>{t('common.advance')}</span><span>{money(s.advance)}</span></div>
            {s.paidNow > 0 && <div><span>{t('invoice.paidOnReturn')} <small className="muted">({methodLabel(s.method, lang)})</small></span><span>{money(s.paidNow)}</span></div>}
            {s.change > 0 && <div><span>{t('invoice.receivedAmt')}</span><span>{money(s.tendered)}</span></div>}
            {s.change > 0 && <div><span>{t('invoice.changeGiven')}</span><span>{money(s.change)}</span></div>}
            {s.refund > 0 && <div><span>{t('invoice.refunded')}</span><span>{money(s.refund)}</span></div>}
            {s.outstanding > 0 && <div className="late"><b>{t('invoice.unpaid')}</b><b>{money(s.outstanding)}</b></div>}
          </div>
        ) : (
          <div className="totals">
            <div><span>{t('common.subtotal')}</span><span>{money(b.subtotal)}</span></div>
            {b.discountAmount > 0 && (
              <div>
                <span>{b.discountType === 'percent' ? t('invoice.discountPct', { v: b.discountValue }) : t('common.discount')}</span>
                <span>- {money(b.discountAmount)}</span>
              </div>
            )}
            <div className="grand"><span>{t('billing.estimated')}</span><span>{money(b.total)}</span></div>
            <div><span>{t('common.advance')}</span><span>{money(b.advance)}</span></div>
            <div><span>{t('common.balance')}</span><span>{money(balance)}</span></div>
          </div>
        )}
        {!closed && <p className="muted" style={{ fontSize: 13 }}>{t('billing.estimateNote')}</p>}

        {b.notes && <p className="muted">{t('invoice.notes')}: {b.notes}</p>}

        {b.payments.length > 0 && (
          <div className="noprint">
            <h2 style={{ marginTop: 18 }}>{t('invoice.payments')}</h2>
            {b.payments.map((p, i) => (
              <div className="kv" key={i}>
                <span>
                  {fmtDT(p.at)} · {payLabel[p.type] || p.type} · {methodLabel(p.method, lang)}
                  {p.change > 0 ? ` · ${t('invoice.receivedAmt')} ${money(p.tendered)}, ${t('invoice.changeGiven')} ${money(p.change)}` : ''}
                  {p.note ? ` · ${p.note}` : ''}
                </span>
                <b>{money(p.amount)}</b>
              </div>
            ))}
          </div>
        )}

        {(b.idPhoto || b.idPhotoBack) && (
          <div className="noprint">
            <p className="muted" style={{ marginBottom: 0 }}>{t('invoice.idPhoto')}</p>
            <div className="photos">
              {b.idPhoto && <img className="idphoto" src={'/api/uploads/' + b.idPhoto} alt={t('photo.front')} />}
              {b.idPhotoBack && <img className="idphoto" src={'/api/uploads/' + b.idPhotoBack} alt={t('photo.back')} />}
            </div>
          </div>
        )}
        <p style={{ textAlign: 'center', marginTop: 24 }}>{t('common.thankYou')}</p>
      </div>

      {paying && (
        <PayModal
          bill={b}
          onClose={() => setPaying(false)}
          onDone={() => { setPaying(false); load(); }}
        />
      )}

      {returning && (
        <ReturnModal
          bill={b}
          settings={settings}
          onClose={() => setReturning(false)}
          onDone={() => { setReturning(false); load(); }}
        />
      )}
    </>
  );
}
