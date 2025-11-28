import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { getQuota } from '@/lib/store';
import { getSessionFromCookies } from '@/lib/session';

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUser(session.username);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const quota = await getQuota(user.username);
  return NextResponse.json({ user, quota });
}
export const runtime = 'nodejs';
