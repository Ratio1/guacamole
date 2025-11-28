import type { PublicUser, UserRole } from '@ratio1/cstore-auth-ts';
import { cookies as nextCookies, type RequestCookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getServerEnv } from './env';

export type SessionPayload = {
  username: string;
  role: UserRole;
  issuedAt: number;
  expiresAt: number;
};

async function hmacSha256Base64Url(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return bytesToBase64Url(new Uint8Array(signature));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary =
    typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function encode(payload: SessionPayload): Promise<string> {
  const env = getServerEnv();
  const body = JSON.stringify(payload);
  const data = bytesToBase64Url(new TextEncoder().encode(body));
  const sig = await hmacSha256Base64Url(env.authSecret, data);
  return `${data}.${sig}`;
}

async function decode(token: string): Promise<SessionPayload | null> {
  const env = getServerEnv();
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = await hmacSha256Base64Url(env.authSecret, data);
  if (expected !== sig) return null;
  try {
    const decoded = new TextDecoder().decode(base64UrlToBytes(data));
    const parsed = JSON.parse(decoded) as SessionPayload;
    if (parsed.expiresAt * 1000 < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function createSession(user: PublicUser): Promise<string> {
  const env = getServerEnv();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    username: user.username,
    role: user.role,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + env.sessionTtlSeconds
  };
  return encode(payload);
}

export async function getSessionFromCookies(jar?: RequestCookies): Promise<SessionPayload | null> {
  const env = getServerEnv();
  const store = jar ?? (await nextCookies());
  const cookie = store.get(env.sessionCookieName);
  if (!cookie?.value) return null;
  return decode(cookie.value);
}

export function setSessionCookie(res: NextResponse, token: string) {
  const env = getServerEnv();
  res.cookies.set({
    name: env.sessionCookieName,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: env.sessionTtlSeconds
  });
}

export function clearSessionCookie(res: NextResponse) {
  const env = getServerEnv();
  res.cookies.set({
    name: env.sessionCookieName,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  });
}

export async function requireSession(jar?: RequestCookies): Promise<SessionPayload> {
  const session = await getSessionFromCookies(jar);
  if (!session) {
    throw new Error('UNAUTHENTICATED');
  }
  return session;
}

export async function requireAdmin(jar?: RequestCookies): Promise<SessionPayload> {
  const session = await requireSession(jar);
  if (session.role !== 'admin') {
    throw new Error('FORBIDDEN');
  }
  return session;
}
