'use client';
import { useEffect, useRef, useState } from 'react';
import { useApp } from './Providers';

// One ID photo (front or back). `existing` = file name already stored on the server.
export default function PhotoField({ label, existing, file, onFile, onClear }) {
  const { t } = useApp();
  const inputRef = useRef(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setUrl('');
      return undefined;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const src = url || (existing ? '/api/uploads/' + existing : '');

  return (
    <div className="photofield">
      <label>{label}</label>
      {src && <img className="idphoto" src={src} alt={label} />}
      <div className="photobtns">
        <button type="button" className="btn sec small" onClick={() => inputRef.current && inputRef.current.click()}>
          {src ? t('photo.replace') : t('photo.choose')}
        </button>
        {src && (
          <button type="button" className="btn danger small" onClick={onClear}>
            {t('photo.remove')}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
