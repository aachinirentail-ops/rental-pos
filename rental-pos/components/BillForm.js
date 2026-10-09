'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from './Providers';
import PhotoField from './PhotoField';
import { compressImage } from '@/lib/image';
import { money, nowLocal, addDays, fmtDT, calcBooking, customerKey, nicKey, normalizePhone, itemLabel, halfRateOf, hasHalfRate, PAY_METHODS } from '@/lib/util';

// One form for both "New bill" and "Edit bill" (editId = id of the bill to edit)
export default function BillForm({ editId = null }) {
  const { t } = useApp();
  const router = useRouter();

  const [items, setItems] = useState([]);
  const [bills, setBills] = useState([]);
  const [orig, setOrig] = useState(null); // the bill being edited
  const [loadError, setLoadError] = useState('');

  const [cat, setCat] = useState('__all');
  const [pick, setPick] = useState('');
  const [pickQty, setPickQty] = useState(1);
  const [cart, setCart] = useState([]); // [{itemId, qty}]

  const [customer, setCustomer] = useState({ customerName: '', phone: '', nic: '' });
  const [query, setQuery] = useState('');
  const [matched, setMatched] = useState(null);
  const [idFront, setIdFront] = useState('');
  const [idBack, setIdBack] = useState('');
  const [fileFront, setFileFront] = useState(null);
  const [fileBack, setFileBack] = useState(null);

  const [startAt, setStartAt] = useState(''); // filled in after mount (avoids a server/browser clock mismatch)
  const [days, setDays] = useState(1);
  const [halfDay, setHalfDay] = useState(false); // half-day rental (up to 12 hours)
  const [discountType, setDiscountType] = useState('amount');
  const [discountValue, setDiscountValue] = useState('');
  const [advance, setAdvance] = useState('');
  const [advanceMethod, setAdvanceMethod] = useState('cash');
  const [itemQuery, setItemQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  /* ------------------------------- loading ------------------------------- */
  useEffect(() => {
    if (!editId) setStartAt(nowLocal());
    fetch('/api/items').then((r) => r.json()).then(setItems).catch(() => {});
    fetch('/api/bills').then((r) => r.json()).then((d) => setBills(d.bills || [])).catch(() => {});
  }, [editId]);

  useEffect(() => {
    if (!editId) return;
    fetch('/api/bills?id=' + editId)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) return setLoadError(d.error || 'Not found');
        const b = d.bill;
        setOrig(b);
        setCart(b.items.map((l) => ({ itemId: l.itemId, qty: l.qty })));
        setCustomer({ customerName: b.customerName, phone: b.phone, nic: b.nic });
        setIdFront(b.idPhoto);
        setIdBack(b.idPhotoBack);
        setStartAt(b.startAt);
        setDays(b.days);
        setHalfDay(!!b.halfDay);
        setDiscountType(b.discountType || 'amount');
        setDiscountValue(b.discountValue ? String(b.discountValue) : '');
        setAdvance(b.advance ? String(b.advance) : '');
        setAdvanceMethod(b.advanceMethod || 'cash');
        setNotes(b.notes || '');
      })
      .catch((e) => setLoadError(e.message));
  }, [editId]);

  const locked = !!orig && orig.status === 'returned';

  /* ------------------------------- customers ----------------------------- */
  // one entry per customer (NIC, or phone when there is no NIC), newest bill first
  const customers = useMemo(() => {
    const map = new Map();
    for (const b of bills) {
      const key = customerKey(b);
      if (!key) continue;
      let c = map.get(key);
      if (!c) {
        c = { key, customerName: b.customerName, phone: b.phone, nic: b.nic, idPhoto: '', idPhotoBack: '', count: 0, active: 0 };
        map.set(key, c);
      }
      c.count += 1;
      if (b.status === 'active') c.active += 1;
      if (!c.idPhoto && b.idPhoto) c.idPhoto = b.idPhoto;
      if (!c.idPhotoBack && b.idPhotoBack) c.idPhotoBack = b.idPhotoBack;
    }
    return [...map.values()];
  }, [bills]);

  const q = query.trim().toLowerCase();
  const qNic = nicKey(query);
  const qDigits = query.replace(/\D/g, '');
  const results = !q
    ? []
    : customers
        .filter(
          (c) =>
            (qNic && nicKey(c.nic).includes(qNic)) ||
            c.customerName.toLowerCase().includes(q) ||
            (qDigits.length >= 3 && normalizePhone(c.phone).includes(qDigits.replace(/^0/, '94')))
        )
        .slice(0, 6);

  // choose a customer from the search list: fills everything, including the stored ID photos
  function chooseCustomer(c) {
    setCustomer({ customerName: c.customerName, phone: c.phone, nic: c.nic });
    setIdFront(c.idPhoto);
    setIdBack(c.idPhotoBack);
    setFileFront(null);
    setFileBack(null);
    setMatched(c);
    setQuery('');
  }

  // typing a NIC that was used before fills in the rest automatically
  function onNic(v) {
    const k = nicKey(v);
    const hit = !editId && k.length >= 5 ? customers.find((c) => nicKey(c.nic) === k) : null;
    setCustomer((c) =>
      hit ? { customerName: c.customerName || hit.customerName, phone: c.phone || hit.phone, nic: v } : { ...c, nic: v }
    );
    if (hit) {
      if (!idFront && !fileFront) setIdFront(hit.idPhoto);
      if (!idBack && !fileBack) setIdBack(hit.idPhotoBack);
    }
    setMatched(hit || null);
  }

  /* --------------------------------- items ------------------------------- */
  const categories = [...new Set(items.map((i) => i.category))].sort();
  const ownQty = (id) =>
    orig && orig.status === 'active' ? orig.items.find((l) => l.itemId === id)?.qty || 0 : 0;
  const availOf = (it) => it.available + ownQty(it.id); // the bill's own items count as free while editing
  const inCart = (id) => cart.find((c) => c.itemId === id)?.qty || 0;
  const iq = itemQuery.trim().toLowerCase();
  const pickable = items.filter(
    (i) =>
      (cat === '__all' || i.category === cat) &&
      availOf(i) - inCart(i.id) > 0 &&
      (!iq || i.name.toLowerCase().includes(iq) || String(i.code || '').toLowerCase().includes(iq))
  );

  function addToCart() {
    if (!pick) return;
    const it = items.find((i) => i.id === pick);
    if (!it) return;
    const qty = Math.max(1, parseInt(pickQty, 10) || 1);
    if (inCart(pick) + qty > availOf(it)) {
      return setError(t('billing.errOnly', { n: availOf(it) - inCart(pick), name: it.name }));
    }
    setError('');
    setCart((c) =>
      c.some((x) => x.itemId === pick)
        ? c.map((x) => (x.itemId === pick ? { ...x, qty: x.qty + qty } : x))
        : [...c, { itemId: pick, qty }]
    );
    setPick('');
    setPickQty(1);
  }

  const rateOf = (id) => orig?.items.find((l) => l.itemId === id)?.rate ?? items.find((i) => i.id === id)?.rate ?? 0;
  const nameOf = (id) => items.find((i) => i.id === id)?.name ?? orig?.items.find((l) => l.itemId === id)?.name ?? '?';
  const codeOf = (id) => items.find((i) => i.id === id)?.code ?? orig?.items.find((l) => l.itemId === id)?.code ?? '';
  const halfOf = (id) => orig?.items.find((l) => l.itemId === id)?.halfRate ?? items.find((i) => i.id === id)?.halfRate ?? 0;
  const lines = cart.map((c) => ({ ...c, rate: rateOf(c.itemId), halfRate: halfOf(c.itemId), name: nameOf(c.itemId), code: codeOf(c.itemId) }));

  const bk = calcBooking(lines, days, discountType, discountValue, halfDay);
  const adv = Math.max(0, Number(advance) || 0);
  const returnAt = startAt ? addDays(startAt, halfDay ? 0.5 : bk.days) : '';

  /* -------------------------------- submit ------------------------------- */
  async function uploadOne(file) {
    const small = await compressImage(file);
    const fd = new FormData();
    fd.append('file', small);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('billing.errPhoto'));
    return data.name;
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!locked && cart.length === 0) return setError(t('billing.errNoItem'));
    setSaving(true);
    try {
      const front = fileFront ? await uploadOne(fileFront) : idFront;
      const back = fileBack ? await uploadOne(fileBack) : idBack;
      const res = await fetch('/api/bills', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editId || undefined,
          ...customer,
          idPhoto: front,
          idPhotoBack: back,
          items: cart,
          startAt,
          days: bk.days,
          halfDay,
          discountType,
          discountValue: Number(discountValue) || 0,
          advance: adv,
          advanceMethod,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('billing.errBill'));
      router.push('/bills/' + data.id);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  /* --------------------------------- view -------------------------------- */
  if (loadError) return <p className="error">{loadError}</p>;
  if (editId && !orig) return <p className="muted">{t('common.loading')}</p>;

  return (
    <>
      <h1>{editId ? t('billing.editTitle', { no: orig.billNo }) : t('billing.title')}</h1>
      {locked && <div className="warnbox" style={{ marginBottom: 14 }}>{t('billing.lockedNote')}</div>}

      <form onSubmit={submit}>
        <div className="grid two">
          {!locked && (
            <div className="card">
              <h2>{t('billing.step1')}</h2>
              <div className="chips">
                <button type="button" className={'chip' + (cat === '__all' ? ' on' : '')} onClick={() => { setCat('__all'); setPick(''); }}>
                  {t('common.all')}
                </button>
                {categories.map((c) => (
                  <button type="button" key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => { setCat(c); setPick(''); }}>
                    {c}
                  </button>
                ))}
              </div>
              <label>{t('billing.itemSearch')}</label>
              <input value={itemQuery} onChange={(e) => { setItemQuery(e.target.value); setPick(''); }} autoComplete="off" />
              <div className="row">
                <div style={{ flex: 3 }}>
                  <label>{t('common.item')}</label>
                  <select value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">{t('billing.selectItem')}</option>
                    {pickable.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.code ? `[${i.code}] ` : ''}{i.name} — {money(i.rate)} ({t('billing.availableN', { n: availOf(i) - inCart(i.id) })})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>{t('common.qty')}</label>
                  <input type="number" min="1" value={pickQty} onChange={(e) => setPickQty(e.target.value)} />
                </div>
                <button type="button" className="btn" style={{ flex: 'none' }} onClick={addToCart}>{t('common.add')}</button>
              </div>

              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t('common.item')}</th>
                      <th>{t('common.qty')}</th>
                      <th>{t('common.rate')}</th>
                      <th className="right">{t('common.amount')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 && <tr><td colSpan="5" className="muted">{t('billing.noItems')}</td></tr>}
                    {lines.map((l) => (
                      <tr key={l.itemId}>
                        <td>{itemLabel(l)}</td>
                        <td>{l.qty}</td>
                        <td>{money(l.rate)}</td>
                        <td className="right">{money(halfDay ? l.qty * halfRateOf(l) : l.qty * l.rate * bk.days)}</td>
                        <td className="right">
                          <button type="button" className="btn danger small" onClick={() => setCart(cart.filter((c) => c.itemId !== l.itemId))}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card" style={locked ? { gridColumn: '1 / -1' } : undefined}>
            <h2>{t('billing.step2')}</h2>

            {!editId && (
              <div className="finder">
                <label>{t('billing.find')}</label>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('billing.findPlaceholder')}
                  autoComplete="off"
                />
                {q && (
                  <div className="results">
                    {results.length === 0 && <div className="muted" style={{ padding: 10 }}>{t('billing.noMatch')}</div>}
                    {results.map((c) => (
                      <button type="button" key={c.key} className="result" onClick={() => chooseCustomer(c)}>
                        <b>{c.customerName}</b>
                        <span className="muted"> · {c.nic || '-'} · {c.phone}</span>
                        <span className="muted"> · {t('billing.prevRentals', { n: c.count })}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {matched && (
              <div className="foundbox">
                ✓ {t('billing.found', { n: matched.count })}
                {matched.active > 0 && <div className="late">⚠ {t('billing.hasActive', { n: matched.active })}</div>}
              </div>
            )}

            <label>{t('billing.nicNumber')}</label>
            <input required value={customer.nic} onChange={(e) => onNic(e.target.value)} />
            <label>{t('billing.custName')}</label>
            <input required value={customer.customerName} onChange={(e) => setCustomer({ ...customer, customerName: e.target.value })} />
            <label>{t('billing.waNumber')}</label>
            <input required inputMode="tel" placeholder="0771234567" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />

            <div className="photos">
              <PhotoField
                label={t('photo.front')}
                existing={idFront}
                file={fileFront}
                onFile={setFileFront}
                onClear={() => { setFileFront(null); setIdFront(''); }}
              />
              <PhotoField
                label={t('photo.back')}
                existing={idBack}
                file={fileBack}
                onFile={setFileBack}
                onClear={() => { setFileBack(null); setIdBack(''); }}
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          {!locked && (
            <>
              <h2>{t('billing.step3')}</h2>
              <div className="row">
                <div style={{ flex: '2 1 230px' }}>
                  <label>{t('billing.startAt')}</label>
                  <input type="datetime-local" required value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                </div>
                <div>
                  <label>{t('billing.period')}</label>
                  <select value={halfDay ? 'half' : 'days'} onChange={(e) => setHalfDay(e.target.value === 'half')}>
                    <option value="days">{t('billing.periodDays')}</option>
                    <option value="half">{t('billing.periodHalf')}</option>
                  </select>
                </div>
                {!halfDay && (
                  <div>
                    <label>{t('billing.numDays')}</label>
                    <input type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} />
                  </div>
                )}
                <div>
                  <label>{t('billing.returnBy')}</label>
                  <input value={returnAt ? fmtDT(returnAt) : ''} readOnly />
                </div>
              </div>
              <div className="row">
                <div>
                  <label>{t('billing.discType')}</label>
                  <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                    <option value="amount">{t('billing.amountRs')}</option>
                    <option value="percent">{t('billing.percent')}</option>
                  </select>
                </div>
                <div>
                  <label>{t('billing.discount')}</label>
                  <input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                </div>
                <div>
                  <label>{t('billing.advanceRs')}</label>
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)} />
                </div>
                <div>
                  <label>{t('pm.advance')}</label>
                  <select value={advanceMethod} onChange={(e) => setAdvanceMethod(e.target.value)}>
                    {PAY_METHODS.map((m) => (
                      <option key={m} value={m}>{t('pm.' + m)}</option>
                    ))}
                  </select>
                </div>
              </div>
              {halfDay && lines.length > 0 && !hasHalfRate(lines) && (
                <div className="warnbox">{t('billing.noHalfRate')}</div>
              )}
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>{t('billing.discountHint')}</p>
            </>
          )}

          <label>{t('billing.notes')}</label>
          <textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} />

          {!locked && (
            <>
              <div className="totals">
                <div><span>{halfDay ? t('billing.subtotalHalf') : t('billing.subtotalDays', { d: bk.days })}</span><span>{money(bk.subtotal)}</span></div>
                <div><span>{t('common.discount')}</span><span>- {money(bk.discountAmount)}</span></div>
                <div className="grand"><span>{t('billing.estimated')}</span><span>{money(bk.total)}</span></div>
                <div><span>{t('common.advance')}</span><span>{money(adv)}</span></div>
                <div><span>{t('common.balance')}</span><span>{money(Math.max(0, bk.total - adv))}</span></div>
              </div>
              <p className="muted" style={{ fontSize: 13 }}>{t('billing.estimateNote')}</p>
            </>
          )}

          {error && <div className="error">{error}</div>}
          <button className="btn" style={{ marginTop: 14, width: '100%', padding: 14, fontSize: 16 }} disabled={saving}>
            {saving ? t('billing.saving') : editId ? t('billing.save') : t('billing.create')}
          </button>
        </div>
      </form>
    </>
  );
}
