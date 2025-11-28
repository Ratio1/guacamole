import { NextResponse } from 'next/server';
import { ensureAuthInitialized, getAuth, listUsers } from '@/lib/auth';
import { getServerEnv } from '@/lib/env';
import { requireAdmin } from '@/lib/session';
import { getQuota, resetQuota } from '@/lib/store';
import type { Quota } from '@/lib/types';

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureAuthInitialized();
  const users = await listUsers();
  const payload = await Promise.all(
    users
      .map((user) => {
        const metadata = (user.metadata || {}) as Record<string, unknown>;
        if (metadata.deleted) return null;
        return { user: { ...user, metadata }, quotaPromise: getQuota(user.username) as Promise<Quota> };
      })
      .filter(
        (item): item is { user: (typeof users)[number]; quotaPromise: Promise<Quota> } =>
          Boolean(item)
      )
      .map(async ({ user, quotaPromise }) => ({
        user,
        quota: await quotaPromise
      }))
  );
  return NextResponse.json({ users: payload });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const env = getServerEnv();
  const { username, password, maxImages } = await request.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }
  const quotaMax = Number.isFinite(maxImages) ? Number(maxImages) : env.defaultMaxImages;

  try {
    await ensureAuthInitialized();
    const auth = getAuth();
    const user = await auth.simple.createUser(username, password, {
      role: 'user',
      metadata: { maxImages: quotaMax }
    });
    await resetQuota(user.username, quotaMax);
    return NextResponse.json({ user, quota: { max: quotaMax, used: 0 } }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.message ? error.message : 'Failed to create user';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
export const runtime = 'nodejs';
