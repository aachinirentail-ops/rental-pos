'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  money,
  compact,
  today,
  nowLocal,
  addDays,
  dueInfo,
  waLink,
  reminderText,
  fmtDT,
  fmtClock,
  fmtLongDate,
  dayShort,
  fmtDuration,
  billDue,
  itemLabel,
  outstandingOf,
  stockState,
  PAY_METHODS,
} from '@/lib/util';
import { useApp } from '@/components/Providers';
import ReturnModal from '@/components/ReturnModal';
import LiveClock from '@/components/LiveClock';

const STATE_ICON = { out: '✕', low: '⚠', ok: '✓' };
const STATE_BADGE = { out: 'overdue', low: 'due-today', ok: 'returned' };
const STATE_RANK = { out: 0, low: 1, ok: 2 };

export default function Dashboard() {
  const { t, lang } = useApp();
  const router = useRouter();
  const [bills, setBills] = useState([]);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [returning, setReturning] = useState(null);
  const [updatedAt, setUpdatedAt] = useState('');
  const [period, setPeriod] = useState(30); // 7 | 30 | 0 (= all time)
  const [onlyLow, setOnlyLow] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, i] = await Promise.all([
        fetch('/api/bills').then((r) => r.json()),
        fetch('/api/items').then((r) => r.json()),
      ]);
      setBills(Array.isArray(b.bills) ? b.bills : []);
      setSettings(b.settings || null);
      setItems(Array.isArray(i) ? i : []);
      setUpdatedAt(nowLocal());
      setError('');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  // refresh every minute, and whenever the tab comes back to the front.
  // "today" is worked out from the Sri Lanka clock on every render, so after midnight the
  // day's figures start again from zero and the 7-day chart moves on by itself.
  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  if (loading) return <p className="muted">{t('common.loading')}</p>;
  if (error) return <div className="error">{error}</div>;

  const day = today();
  const month = day.slice(0, 7);
  const active = bills.filter((b) => b.status === 'active').map((b) => ({ b, info: dueInfo(b) }));
  const byDue = (x, y) => billDue(x.b).localeCompare(billDue(y.b));
  const alerts = active.filter((x) => ['overdue', 'due-today', 'due-tomorrow'].includes(x.info.state)).sort(byDue);
  const others = active.filter((x) => !alerts.includes(x)).sort(byDue);
  const overdue = alerts.filter((x) => x.info.state === 'overdue').length;
  const dueSoon = alerts.length - overdue;

  /* money really received (advances + payments on return, minus refunds), by the day it was received */
  const payments = bills.flatMap((b) => b.payments || []);
  const sumPay = (match) => payments.filter((p) => match((p.at || '').slice(0, 10))).reduce((s, p) => s + p.amount, 0);
  const todayIncome = sumPay((d) => d === day);
  const monthIncome = sumPay((d) => d.startsWith(month));
  const todayByMethod = PAY_METHODS.map((m) => ({
    m,
    v: payments.filter((p) => (p.at || '').slice(0, 10) === day && p.method === m).reduce((s, p) => s + p.amount, 0),
  })).filter((x) => x.v !== 0);
  const unpaid = bills.reduce((s, b) => s + outstandingOf(b), 0);
  const shop = settings ? settings.shopName : '';

  /* income, last 7 days (Sri Lanka dates) */
  const days7 = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6));
  const income7 = days7.map((d) => ({ d, v: sumPay((x) => x === d) }));
  const max7 = Math.max(1, ...income7.map((x) => x.v));

  /* most rented items */
  const since = period ? addDays(day, 1 - period) : '';
  const rentedBy = new Map();
  for (const b of bills) {
    if (since && b.startAt.slice(0, 10) < since) continue;
    for (const l of b.items) {
      const cur = rentedBy.get(l.itemId) || { name: l.name, code: l.code, qty: 0 };
      cur.qty += l.qty;
      rentedBy.set(l.itemId, cur);
    }
  }
  const top = [...rentedBy.values()].sort((a, b) => b.qty - a.qty).slice(0, 6);
  const topMax = Math.max(1, ...top.map((x) => x.qty));

  /* stock */
  const stock = items
    .map((it) => ({ it, st: stockState(it) }))
    .sort((a, b) => STATE_RANK[a.st] - STATE_RANK[b.st] || a.it.available - b.it.available || a.it.name.localeCompare(b.it.name));
  const lowList = stock.filter((x) => x.st !== 'ok');
  const stockShown = onlyLow ? lowList : stock;
  const unitsTotal = items.reduce((s, i) => s + i.stock, 0);
  const unitsOut = items.reduce((s, i) => s + i.rented, 0);

  function row({ b, info }) {
    return (
      <tr key={b.id}>
        <td data-label={t('common.bill')}><Link href={`/bills/${b.id}`}><b>{b.billNo}</b></Link></td>
        <td data-label={t('common.customer')}>{b.customerName}<div className="muted">{b.phone}</div></td>
        <td data-label={t('common.items')}>{b.items.map((i) => `${itemLabel(i)} x${i.qty}`).join(', ')}</td>
        <td data-label={t('common.due')}>{fmtDT(billDue(b))}</td>
        <td data-label={t('common.status')}>
          <span className={'badge ' + info.state}>
            {t('status.' + info.state)}
            {info.state === 'overdue' ? ` · ${fmtDuration(info.ms, lang)}` : ''}
          </span>
        </td>
        <td className="right actcell">
          <a className="btn wa small" href={waLink(b.phone, reminderText(b, shop, lang, settings || undefined))} target="_blank" rel="noreferrer">
            {t('common.whatsapp')}
          </a>
          <button className="btn sec small" onClick={() => setReturning(b)}>{t('common.returned')}</button>
        </td>
      </tr>
    );
  }

  const head = (
    <thead>
      <tr>
        <th>{t('common.bill')}</th>
        <th>{t('common.customer')}</th>
        <th>{t('common.items')}</th>
        <th>{t('common.due')}</th>
        <th>{t('common.status')}</th>
        <th></th>
      </tr>
    </thead>
  );

  return (
    <>
      <div className="dashhead">
        <div>
          <h1 style={{ marginBottom: 4 }}>{t('dash.title')}</h1>
          <div className="muted">
            {fmtLongDate(day, lang)} · {t('dash.slTime')}
            {updatedAt ? ` · ${t('dash.updated', { time: fmtClock(updatedAt) })}` : ''}
          </div>
        </div>
        <LiveClock big />
      </div>

      <div className="grid stats">
        <div className="card stat">
          <div className="label">{t('dash.todayIncome')}</div>
          <div className="value">{money(todayIncome)}</div>
          {todayByMethod.length > 0 && (
            <div className="sub">
              {todayByMethod.map((x) => `${t('pm.' + x.m)} ${money(x.v)}`).join(' · ')}
            </div>
          )}
        </div>
        <div className="card stat"><div className="label">{t('dash.monthIncome')}</div><div className="value">{money(monthIncome)}</div></div>
        <div className="card stat"><div className="label">{t('dash.activeRentals')}</div><div className="value">{active.length}</div></div>
        <div className="card stat danger"><div className="label">{t('dash.overdue')}</div><div className="value">{overdue}</div></div>
        <div className="card stat warn"><div className="label">{t('dash.dueSoon')}</div><div className="value">{dueSoon}</div></div>
        <div className="card stat warn"><div className="label">{t('dash.unpaid')}</div><div className="value">{money(unpaid)}</div></div>
        <div className="card stat"><div className="label">{t('dash.totalBills')}</div><div className="value">{bills.length}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>{t('dash.alerts')}</h2>
        {alerts.length === 0 ? (
          <p className="muted">{t('dash.noAlerts')}</p>
        ) : (
          <div className="table-wrap">
            <table className="rtable">{head}<tbody>{alerts.map(row)}</tbody></table>
          </div>
        )}
      </div>

      {others.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>{t('dash.otherActive')}</h2>
          <div className="table-wrap">
            <table className="rtable">{head}<tbody>{others.map(row)}</tbody></table>
          </div>
        </div>
      )}

      <div className="grid two" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2>{t('dash.last7')}</h2>
          <p className="muted" style={{ fontSize: 13, margin: '-6px 0 12px' }}>{t('dash.last7Note')}</p>
          <div className="cols" role="img" aria-label={t('dash.last7')}>
            {income7.map(({ d, v }) => (
              <div className="col" key={d} title={`${fmtLongDate(d, lang)}: ${money(v)}`}>
                <div className="colval">{v > 0 ? compact(v) : ''}</div>
                <div className="colbar">
                  <span
                    className={'bar' + (d === day ? ' now' : '')}
                    style={{ height: v > 0 ? Math.max(4, Math.round((v / max7) * 100)) + '%' : '0' }}
                  />
                </div>
                <div className={'collabel' + (d === day ? ' now' : '')}>{dayShort(d, lang)}</div>
                <div className="collabel2">{d.slice(8)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="cardhead">
            <h2>{t('dash.topItems')}</h2>
            <div className="chips" style={{ marginBottom: 0 }}>
              {[[7, 'dash.p7'], [30, 'dash.p30'], [0, 'dash.pAll']].map(([v, k]) => (
                <button key={v} className={'chip' + (period === v ? ' on' : '')} onClick={() => setPeriod(v)}>{t(k)}</button>
              ))}
            </div>
          </div>
          {top.length === 0 ? (
            <p className="muted">{t('dash.noRentals')}</p>
          ) : (
            <div className="hbars">
              {top.map((x, i) => (
                <div className="hbar" key={x.name + i} title={`${itemLabel(x)}: ${t('dash.rentedQty', { n: x.qty })}`}>
                  <div className="hlabel">{itemLabel(x)}</div>
                  <div className="htrack"><span className="hfill" style={{ width: Math.max(3, Math.round((x.qty / topMax) * 100)) + '%' }} /></div>
                  <div className="hval">{x.qty}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="cardhead">
          <h2>{t('dash.stockTitle')}</h2>
          <button className={'chip' + (onlyLow ? ' on' : '')} onClick={() => setOnlyLow(!onlyLow)}>{t('dash.onlyLow')} ({lowList.length})</button>
        </div>
        <p className="muted" style={{ fontSize: 13, margin: '-6px 0 12px' }}>{t('dash.stockNote')}</p>

        <div className="miniStats">
          <div><span className="muted">{t('dash.totalUnits')}</span><b>{unitsTotal}</b></div>
          <div><span className="muted">{t('dash.unitsOut')}</span><b style={{ color: 'var(--s2)' }}>{unitsOut}</b></div>
          <div><span className="muted">{t('dash.unitsLeft')}</span><b style={{ color: 'var(--s1)' }}>{Math.max(0, unitsTotal - unitsOut)}</b></div>
        </div>

        <div className="legend">
          <span><i className="sw" style={{ background: 'var(--s1)' }} />{t('dash.left')}</span>
          <span><i className="sw" style={{ background: 'var(--s2)' }} />{t('dash.out')}</span>
        </div>

        {stockShown.length === 0 ? (
          <p className="muted">{items.length === 0 ? t('dash.noItems') : t('dash.lowNone')}</p>
        ) : (
          <div className="table-wrap">
            <table className="rtable">
              <thead>
                <tr>
                  <th></th>
                  <th>{t('common.item')}</th>
                  <th className="num">{t('dash.total')}</th>
                  <th className="num">{t('dash.out')}</th>
                  <th className="num">{t('dash.left')}</th>
                  <th style={{ minWidth: 140 }}></th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {stockShown.map(({ it, st }) => {
                  const total = Math.max(1, it.stock);
                  return (
                    <tr key={it.id}>
                      <td className="thumbcell">
                        {it.photo ? (
                          <img className="thumb" src={'/api/uploads/' + it.photo} alt={it.name} loading="lazy" />
                        ) : (
                          <span className="thumb ph" aria-hidden="true">🛠️</span>
                        )}
                      </td>
                      <td data-label={t('common.item')}>
                        <b>{it.name}</b>
                        <div className="muted">{it.code ? `${it.code} · ` : ''}{it.category}</div>
                      </td>
                      <td className="num" data-label={t('dash.total')}>{it.stock}</td>
                      <td className="num" data-label={t('dash.out')}>{it.rented}</td>
                      <td className="num" data-label={t('dash.left')}><b>{it.available}</b></td>
                      <td className="barcell" title={t('dash.leftOf', { a: it.available, b: it.stock })}>
                        <div className="stack" role="img" aria-label={t('dash.leftOf', { a: it.available, b: it.stock })}>
                          {it.available > 0 && <span style={{ flex: it.available / total, background: 'var(--s1)' }} />}
                          {it.rented > 0 && <span style={{ flex: it.rented / total, background: 'var(--s2)' }} />}
                        </div>
                      </td>
                      <td data-label={t('common.status')}>
                        <span className={'badge ' + STATE_BADGE[st]}>
                          {STATE_ICON[st]} {t(st === 'out' ? 'dash.sOut' : st === 'low' ? 'dash.sLow' : 'dash.sOk')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid two">
        <div className="card">
          <h2>{t('dash.lowTitle')}</h2>
          {lowList.length === 0 ? (
            <p className="muted">{t('dash.lowNone')}</p>
          ) : (
            lowList.map(({ it, st }) => (
              <div key={it.id} className="kv" style={{ alignItems: 'center' }}>
                <span style={{ color: 'var(--text)' }}>{itemLabel(it)} <span className="muted">· {t('dash.leftOf', { a: it.available, b: it.stock })}</span></span>
                <span className={'badge ' + STATE_BADGE[st]}>{STATE_ICON[st]} {t(st === 'out' ? 'dash.sOut' : 'dash.sLow')}</span>
              </div>
            ))
          )}
        </div>
        <div className="card">
          <h2>{t('dash.quick')}</h2>
          <div className="actions" style={{ justifyContent: 'flex-start' }}>
            <Link className="btn" href="/billing">{t('dash.newBill')}</Link>
            <Link className="btn" href="/returns">{t('nav.returns')}</Link>
            <Link className="btn sec" href="/items">{t('dash.manageItems')}</Link>
            <Link className="btn sec" href="/bills">{t('nav.billHistory')}</Link>
          </div>
        </div>
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
