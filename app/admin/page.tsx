import { redirect } from 'next/navigation';
import { listUsers } from '@/lib/auth';
import { getQuota } from '@/lib/store';
import { getSessionFromCookies } from '@/lib/session';
import AdminClient, { type AdminUser } from '@/components/AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSessionFromCookies();
  if (!session) {
    redirect('/login?redirect=/admin');
  }
  if (session.role !== 'admin') {
    redirect('/');
  }

  const usersRaw = await listUsers();
  const users: AdminUser[] = [];
  for (const user of usersRaw) {
    const metadata = (user.metadata || {}) as Record<string, unknown>;
    if (metadata.deleted) continue;
    const quota = await getQuota(user.username);
    users.push({
      username: user.username,
      role: user.role,
      metadata,
      createdAt: user.createdAt,
      quota
    });
  }

  return <AdminClient initialUsers={users} />;
}
