import { getServerEnv } from './env';
import { getCStore } from './sdk';
import type { FileRecord, UploadEvent, Quota } from './types';

const FILES_KEY = 'files';
const EVENTS_KEY = 'events';

const quotaKey = (username: string) => `users:${username}:quota`;

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getQuota(username: string): Promise<Quota> {
  const env = getServerEnv();
  const cstore = getCStore();
  const raw = await cstore.hget({ hkey: quotaKey(username), key: 'quota' });
  const parsed = safeParse<Quota>(raw);
  return parsed ?? { max: env.defaultMaxImages, used: 0 };
}

export async function setQuota(username: string, quota: Quota) {
  const cstore = getCStore();
  await cstore.hset({ hkey: quotaKey(username), key: 'quota', value: JSON.stringify(quota) });
}

export async function incrementQuotaUsage(username: string, delta: number): Promise<Quota> {
  const quota = await getQuota(username);
  const nextUsed = quota.used + delta;
  if (nextUsed < 0) quota.used = 0;
  else quota.used = nextUsed;
  await setQuota(username, quota);
  return quota;
}

export async function resetQuota(username: string, maxImages: number) {
  await setQuota(username, { max: maxImages, used: 0 });
}

export async function listFiles(): Promise<FileRecord[]> {
  const cstore = getCStore();
  const entries = await cstore.hgetall({ hkey: FILES_KEY });
  return Object.entries(entries || {})
    .map(([cid, value]) => ({ cid, value }))
    .map(({ cid, value }) => {
      const parsed = safeParse<Omit<FileRecord, 'cid'>>(value);
      if (!parsed) return null;
      return { cid, ...parsed };
    })
    .filter((item): item is FileRecord => Boolean(item))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getFileRecord(cid: string): Promise<FileRecord | null> {
  const cstore = getCStore();
  const raw = await cstore.hget({ hkey: FILES_KEY, key: cid });
  const parsed = safeParse<Omit<FileRecord, 'cid'>>(raw);
  if (!parsed) return null;
  return { cid, ...parsed };
}

export async function listFilesByOwner(owner: string): Promise<FileRecord[]> {
  const files = await listFiles();
  return files.filter((f) => f.owner === owner);
}

export async function saveFileRecord(record: FileRecord) {
  const cstore = getCStore();
  const { cid, ...rest } = record;
  await cstore.hset({ hkey: FILES_KEY, key: cid, value: JSON.stringify(rest) });
}

export async function removeFileRecord(cid: string) {
  const cstore = getCStore();
  await cstore.hset({ hkey: FILES_KEY, key: cid, value: '' });
}

export async function removeFilesForOwner(owner: string): Promise<string[]> {
  const files = await listFilesByOwner(owner);
  await Promise.all(files.map((file) => removeFileRecord(file.cid)));
  return files.map((f) => f.cid);
}

export async function addUploadEvent(event: UploadEvent) {
  const cstore = getCStore();
  const key = `${Date.now()}:${event.cid}`;
  await cstore.hset({ hkey: EVENTS_KEY, key, value: JSON.stringify(event) });
}

export async function listEvents(limit = 20): Promise<UploadEvent[]> {
  const cstore = getCStore();
  const entries = await cstore.hgetall({ hkey: EVENTS_KEY });
  const events = Object.entries(entries || {})
    .map(([, value]) => safeParse<UploadEvent>(value))
    .filter((item): item is UploadEvent => Boolean(item))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return events.slice(0, limit);
}

export async function removeEventsForUser(username: string) {
  const cstore = getCStore();
  const events = await cstore.hgetall({ hkey: EVENTS_KEY });
  const entries = Object.entries(events || {});
  await Promise.all(
    entries
      .filter(([, raw]) => {
        const parsed = safeParse<UploadEvent>(raw);
        return parsed?.user === username;
      })
      .map(([key]) => cstore.hset({ hkey: EVENTS_KEY, key, value: '' }))
  );
}
