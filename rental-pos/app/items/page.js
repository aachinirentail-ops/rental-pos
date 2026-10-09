'use client';
import { useEffect, useState } from 'react';
import { money } from '@/lib/util';
import { compressImage } from '@/lib/image';
import { useApp } from '@/components/Providers';
import PhotoField from '@/components/PhotoField';

const EMPTY = { code: '', name: '', category: '', rate: '', halfRate: '', stock: '' };

export default function ItemsPage() {
  const { t } = useApp();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState(''); // file name already stored on the server
  const [photoFile, setPhotoFile] = useState(null); // newly chosen file, uploaded on save
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState('__all');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/items');
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load');
      setItems(d);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const categories = [...new Set(items.map((i) => i.category))].sort();

  function reset() {
    setForm(EMPTY);
    setPhoto('');
    setPhotoFile(null);
    setEditId(null);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      let photoName = photo;
      if (photoFile) {
        const small = await compressImage(photoFile, 1000, 0.8);
        const fd = new FormData();
        fd.append('file', small);
        fd.append('kind', 'item');
        const up = await fetch('/api/upload', { method: 'POST', body: fd });
        const upData = await up.json();
        if (!up.ok) throw new Error(upData.error || t('billing.errPhoto'));
        photoName = upData.name;
      }
      const body = { ...form, photo: photoName };
      const res = await fetch('/api/items', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editId ? { ...body, id: editId } : body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('items.failedSave'));
      reset();
      load();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  function edit(it) {
    setEditId(it.id);
    setForm({ code: it.code || '', name: it.name, category: it.category, rate: it.rate, halfRate: it.halfRate ? it.halfRate : '', stock: it.stock });
    setPhoto(it.photo || '');
    setPhotoFile(null);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(it) {
    if (!confirm(t('items.confirmDelete', { name: it.name }))) return;
    const res = await fetch('/api/items?id=' + it.id, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    load();
  }

  const s = q.trim().toLowerCase();
  const shown = items.filter(
    (i) =>
      (filter === '__all' || i.category === filter) &&
      (!s || i.name.toLowerCase().includes(s) || String(i.code || '').toLowerCase().includes(s))
  );

  return (
    <>
      <h1>{t('items.title')}</h1>

      <form className="card" onSubmit={save} style={{ marginBottom: 20 }}>
        <h2>{editId ? t('items.editItem') : t('items.addItem')}</h2>
        <div className="grid two">
          <div>
            <div className="row">
              <div>
                <label>{t('items.code')}</label>
                <input value={form.code} maxLength={30} placeholder="M-001" onChange={(e) => setForm({ ...form, code: e.target.value })} />
                <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>{t('items.codeHint')}</p>
              </div>
              <div style={{ flex: 2 }}>
                <label>{t('items.name')}</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div className="row">
              <div>
                <label>{t('common.category')}</label>
                <input required list="cats" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label>{t('items.ratePerDay')}</label>
                <input required type="number" min="0" step="0.01" inputMode="decimal" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
              </div>
              <div>
                <label>{t('items.halfRate')}</label>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={form.halfRate} onChange={(e) => setForm({ ...form, halfRate: e.target.value })} />
                <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>{t('items.halfHint')}</p>
              </div>
              <div>
                <label>{t('items.stock')}</label>
                <input required type="number" min="0" inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
            </div>
          </div>
          <div>
            <PhotoField
              label={t('items.photo')}
              existing={photo}
              file={photoFile}
              onFile={setPhotoFile}
              onClear={() => { setPhotoFile(null); setPhoto(''); }}
            />
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <button className="btn" type="submit" disabled={saving}>{saving ? t('billing.saving') : editId ? t('items.update') : t('items.addItem')}</button>
          {editId && (
            <button type="button" className="btn sec" onClick={reset}>
              {t('common.cancel')}
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('items.search')}
          aria-label={t('items.search')}
          style={{ marginBottom: 10 }}
        />
        <div className="chips">
          <button className={'chip' + (filter === '__all' ? ' on' : '')} onClick={() => setFilter('__all')}>
            {t('common.all')}
          </button>
          {categories.map((c) => (
            <button key={c} className={'chip' + (filter === c ? ' on' : '')} onClick={() => setFilter(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table className="rtable">
            <thead>
              <tr>
                <th></th>
                <th>{t('items.numberCol')}</th>
                <th>{t('common.item')}</th>
                <th>{t('common.category')}</th>
                <th>{t('items.rateCol')}</th>
                <th>{t('items.halfCol')}</th>
                <th>{t('items.stockCol')}</th>
                <th>{t('items.rented')}</th>
                <th>{t('items.available')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr className="empty"><td colSpan="10" className="muted">{t('items.empty')}</td></tr>
              )}
              {shown.map((it) => (
                <tr key={it.id}>
                  <td className="thumbcell">
                    {it.photo ? (
                      <a href={'/api/uploads/' + it.photo} target="_blank" rel="noreferrer">
                        <img className="thumb" src={'/api/uploads/' + it.photo} alt={it.name} loading="lazy" />
                      </a>
                    ) : (
                      <span className="thumb ph" aria-hidden="true">🛠️</span>
                    )}
                  </td>
                  <td data-label={t('items.numberCol')} className="nw">{it.code || '-'}</td>
                  <td data-label={t('common.item')}><b>{it.name}</b></td>
                  <td data-label={t('common.category')}>{it.category}</td>
                  <td data-label={t('items.rateCol')}>{money(it.rate)}</td>
                  <td data-label={t('items.halfCol')}>{it.halfRate > 0 ? money(it.halfRate) : '-'}</td>
                  <td data-label={t('items.stockCol')}>{it.stock}</td>
                  <td data-label={t('items.rented')}>{it.rented}</td>
                  <td data-label={t('items.available')} style={{ color: it.available === 0 ? 'var(--danger)' : 'inherit', fontWeight: 600 }}>{it.available}</td>
                  <td className="right actcell">
                    <button className="btn sec small" onClick={() => edit(it)}>{t('common.edit')}</button>
                    <button className="btn danger small" onClick={() => remove(it)}>{t('common.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
