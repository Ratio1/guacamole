'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { FileRecord, Quota, UploadEvent } from '@/lib/types';
import UploadForm from './UploadForm';

type Props = {
  initialFiles: FileRecord[];
  initialEvents: UploadEvent[];
  initialQuota: Quota;
  eeId: string;
  username: string;
};

export default function HomeClient({
  initialFiles,
  initialEvents,
  initialQuota,
  eeId,
  username
}: Props) {
  const [files, setFiles] = useState<FileRecord[]>(initialFiles);
  const [events, setEvents] = useState<UploadEvent[]>(initialEvents);
  const [quota, setQuota] = useState<Quota>(initialQuota);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const quotaFraction = useMemo(() => {
    const pct = Math.min(100, Math.round((quota.used / Math.max(1, quota.max)) * 100));
    return isFinite(pct) ? pct : 0;
  }, [quota]);

  async function refreshFiles() {
    setLoadingFiles(true);
    try {
      const res = await fetch('/api/files', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files ?? []);
      }
    } finally {
      setLoadingFiles(false);
    }
  }

  async function refreshEvents() {
    setLoadingEvents(true);
    try {
      const res = await fetch('/api/events', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
      }
    } finally {
      setLoadingEvents(false);
    }
  }

  useEffect(() => {
    const id = setInterval(refreshEvents, 8000);
    return () => clearInterval(id);
  }, []);

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="pill">Logged in as {username}</div>
            <h2 className="section-title" style={{ marginTop: 10 }}>
              Minimalistic image sharing
            </h2>
            <p className="muted">
              Upload PNG/JPEG/TIFF (max 10 MB). Files go to R1FS, metadata to CStore, and everyone
              sees the updates instantly.
            </p>
          </div>
          <div className="stack" style={{ alignItems: 'flex-end' }}>
            <QuotaBadge quota={quota} fraction={quotaFraction} />
            <button onClick={logout} disabled={loggingOut} style={{ marginTop: 8 }}>
              {loggingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>

        <div className="grid two">
          <UploadForm
            quota={quota}
            onUploaded={async (record, nextQuota) => {
              setQuota(nextQuota);
              setFiles((current) => [record, ...current].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
              await refreshEvents();
            }}
          />

          <EventsPanel events={events} onRefresh={refreshEvents} loading={loadingEvents} />
        </div>
      </section>

      <section className="card stack">
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <h3 className="section-title" style={{ margin: 0 }}>
            Files ({files.length})
          </h3>
          <div className="flex">
            <button onClick={refreshFiles} disabled={loadingFiles}>
              {loadingFiles ? 'Refreshing...' : 'Refresh'}
            </button>
            <Link href="/admin" className="muted" style={{ textDecoration: 'none' }}>
              Admin
            </Link>
          </div>
        </div>
        {files.length === 0 ? (
          <p className="muted">No files yet. Upload one to get started.</p>
        ) : (
          <div className="grid two">
            {files.map((file) => (
              <article key={file.cid} className="card" style={{ background: 'rgba(148,163,184,0.05)' }}>
                <div className="flex" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{file.filename}</div>
                    <div className="muted">
                      {file.owner} • {new Date(file.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="pill">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: '1px solid rgba(148,163,184,0.2)',
                    background: 'rgba(15,23,42,0.6)',
                    textAlign: 'center'
                  }}
                >
                  <img
                    src={`/api/files/${file.cid}`}
                    alt={file.filename}
                    style={{ width: '100%', maxHeight: 240, objectFit: 'contain', display: 'block' }}
                  />
                </div>
                <div className="flex" style={{ justifyContent: 'space-between', marginTop: 10 }}>
                  <a href={`/api/files/${file.cid}`} className="muted">
                    View / Download
                  </a>
                  <span className="muted">Served by {file.nodeId}</span>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="footer">Ratio1 Edge Node proudly serving this page: {eeId}</div>
      </section>
    </div>
  );
}

function QuotaBadge({ quota, fraction }: { quota: Quota; fraction: number }) {
  return (
    <div
      className="card"
      style={{
        minWidth: 240,
        background: 'rgba(148,163,184,0.08)',
        borderColor: 'rgba(148,163,184,0.3)'
      }}
    >
      <div className="muted">Quota</div>
      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2, color: '#e2e8f0' }}>
        {quota.used} / {quota.max}
      </div>
      <div
        style={{
          marginTop: 8,
          height: 8,
          borderRadius: 999,
          background: 'rgba(148,163,184,0.2)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${fraction}%`,
            height: '100%',
            background: 'linear-gradient(90deg,#06b6d4,#22c55e)'
          }}
        />
      </div>
    </div>
  );
}

function EventsPanel({
  events,
  onRefresh,
  loading
}: {
  events: UploadEvent[];
  onRefresh: () => Promise<void>;
  loading: boolean;
}) {
  return (
    <div className="card stack" style={{ height: '100%' }}>
      <div className="flex" style={{ justifyContent: 'space-between' }}>
        <h3 className="section-title" style={{ margin: 0 }}>
          Latest uploads
        </h3>
        <button onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      {events.length === 0 ? (
        <p className="muted">No events yet.</p>
      ) : (
        <div className="stack">
          {events.map((evt) => (
            <div key={`${evt.createdAt}-${evt.cid}`} className="card" style={{ background: 'rgba(15,23,42,0.6)' }}>
              <div style={{ fontWeight: 700 }}>{evt.user}</div>
              <div className="muted">
                uploaded <strong style={{ color: '#e2e8f0' }}>{evt.filename}</strong> ({evt.cid.slice(0, 8)}…)
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {new Date(evt.createdAt).toLocaleString()} • node {evt.nodeId}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
