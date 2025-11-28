import { NextResponse } from 'next/server';
import { authenticateUser, ensureAuthInitialized } from '@/lib/auth';
import { createSession, setSessionCookie } from '@/lib/session';
import { getQuota } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    await ensureAuthInitialized();
    const user = await authenticateUser(username, password);
    const token = await createSession(user);
    const response = NextResponse.json({ user, quota: await getQuota(user.username) });
    setSessionCookie(response, token);

    return response;
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
}
export const runtime = 'nodejs';
