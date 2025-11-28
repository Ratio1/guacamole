import { redirect } from 'next/navigation';
import { getServerEnv } from '@/lib/env';
import { listEvents, listFiles, getQuota } from '@/lib/store';
import { getSessionFromCookies } from '@/lib/session';
import HomeClient from '@/components/HomeClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect('/login');
  }

  const env = getServerEnv();
  const [files, events, quota] = await Promise.all([
    listFiles(),
    listEvents(50),
    getQuota(session.username)
  ]);

  return (
    <HomeClient
      initialFiles={files}
      initialEvents={events}
      initialQuota={quota}
      eeId={env.eeId}
      username={session.username}
    />
  );
}
