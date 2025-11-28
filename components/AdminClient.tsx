'use client';

import { FormEvent, useState } from 'react';
import type { Quota } from '@/lib/types';

export type AdminUser = {
  username: string;
  role: 'admin' | 'user';
  metadata: Record<string, unknown>;
  createdAt: string;
  quota: Quota;
};

type Props = {
  initialUsers: AdminUser[];
};

export default function AdminClient({ initialUsers }: Props) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [maxImages, setMaxImages] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function createUser(event: FormEvent) {
    event.preventDefault();
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, maxImages })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to create user');
      }
      const payload = await res.json();
      const newUser: AdminUser = {
        username: payload.user.username,
        role: payload.user.role,
        metadata: payload.user.metadata ?? {},
        createdAt: payload.user.createdAt,
        quota: payload.quota
      };
      setUsers((list) => [...list, newUser]);
      setUsername('');
      setPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create user';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(usernameToDelete: string) {
    if (!confirm(`Delete user ${usernameToDelete}? This removes metadata and attempts to delete files.`)) {
      return;
    }
    const res = await fetch(`/api/users/${encodeURIComponent(usernameToDelete)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      alert(payload.error || 'Failed to delete user');
      return;
    }
    setUsers((list) => list.filter((u) => u.username !== usernameToDelete));
  }

  return (
    <div className="stack">
      <section className="card stack">
        <h2 className="section-title" style={{ margin: 0 }}>
          Admin
        </h2>
        <p className="muted">Create and delete users. Default image quota is 10 unless specified.</p>
        <form className="grid two" onSubmit={createUser}>
          <div className="stack">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alice"
              autoComplete="off"
            />
          </div>
          <div className="stack">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="stack">
            <label htmlFor="maxImages">Max images</label>
            <input
              id="maxImages"
              type="number"
              min={1}
              value={maxImages}
              onChange={(e) => setMaxImages(Number(e.target.value))}
            />
          </div>
          <div className="stack" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" disabled={busy}>
              {busy ? 'Creating...' : 'Create user'}
            </button>
          </div>
        </form>
        {error && <div className="error">{error}</div>}
      </section>

      <section className="card stack">
        <h3 className="section-title" style={{ margin: 0 }}>
          Users ({users.length})
        </h3>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Quota</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.username}>
                  <td>{user.username}</td>
                  <td>{user.role}</td>
                  <td>
                    {user.quota.used} / {user.quota.max}
                  </td>
                  <td>{new Date(user.createdAt).toLocaleString()}</td>
                  <td>
                    <button onClick={() => deleteUser(user.username)} disabled={user.username === 'admin'}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
