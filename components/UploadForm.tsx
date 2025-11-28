'use client';

import { FormEvent, useRef, useState } from 'react';
import type { FileRecord, Quota } from '@/lib/types';

type Props = {
  quota: Quota;
  onUploaded: (record: FileRecord, quota: Quota) => void | Promise<void>;
};

const ALLOWED = ['image/png', 'image/jpeg', 'image/tiff'];
const MAX_MB = 10;

export default function UploadForm({ quota, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file first');
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      setError('Only PNG, JPEG or TIFF are allowed');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError('File too large (max 10 MB)');
      return;
    }
    if (quota.used >= quota.max) {
      setError('Quota exceeded');
      return;
    }

    setBusy(true);
    setError('');
    setStatus('Uploading...');
    const formData = new FormData();
    formData.set('file', file);

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Upload failed');
      }
      const payload = await res.json();
      await onUploaded(payload.record, payload.quota);
      setStatus('Uploaded successfully');
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      setStatus('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={handleSubmit} style={{ height: '100%' }}>
      <h3 className="section-title" style={{ margin: 0 }}>
        Upload
      </h3>
      <label htmlFor="file">Select an image</label>
      <input id="file" type="file" ref={inputRef} accept={ALLOWED.join(',')} />
      <p className="muted">
        Allowed: PNG, JPEG, TIFF. Max {MAX_MB} MB. Remaining quota: {Math.max(0, quota.max - quota.used)}.
      </p>
      <button type="submit" disabled={busy}>
        {busy ? 'Uploading...' : 'Upload'}
      </button>
      {status && <div className="success">{status}</div>}
      {error && <div className="error">{error}</div>}
    </form>
  );
}
