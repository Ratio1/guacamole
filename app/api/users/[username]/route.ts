import { NextResponse } from 'next/server';
import { ensureAuthInitialized, getAuth, getUser } from '@/lib/auth';
import { requireAdmin } from '@/lib/session';
import { removeEventsForUser, resetQuota, listFilesByOwner, removeFileRecord } from '@/lib/store';
import { getR1FS } from '@/lib/sdk';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { username } = await params;
  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }
  if (username === 'admin') {
    return NextResponse.json({ error: 'Cannot delete admin user' }, { status: 400 });
  }

  await ensureAuthInitialized();
  const existing = await getUser(username);
  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Remove files + attempt to delete from R1FS.
  const files = await listFilesByOwner(username);
  const r1fs = getR1FS();
  await Promise.all(
    files.map(async (file) => {
      try {
        await r1fs.deleteFile({ cid: file.cid, cleanup_local_files: true, run_gc: false });
      } catch {
        // Ignore failures; we still remove metadata.
      }
      await removeFileRecord(file.cid);
    })
  );

  await removeEventsForUser(username);
  await resetQuota(username, 0);

  // Soft-delete user by marking metadata.
  const auth = getAuth();
  await auth.simple.updateUser(username, {
    metadata: { ...(existing.metadata || {}), deleted: true, deletedAt: new Date().toISOString() }
  });

  return NextResponse.json({ ok: true, removed: files.map((f) => f.cid) });
}
export const runtime = 'nodejs';
