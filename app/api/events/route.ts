import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { listEvents } from '@/lib/store';

export async function GET() {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const events = await listEvents(50);
  return NextResponse.json({ events });
}
export const runtime = 'nodejs';
