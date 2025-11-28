const REQUIRED_ENV = [
  'EE_CHAINSTORE_API_URL',
  'EE_R1FS_API_URL',
  'EE_CSTORE_AUTH_HKEY',
  'EE_CSTORE_AUTH_SECRET'
] as const;

const DEFAULT_MAX_IMAGES = 10;
const TEN_MB = 10 * 1024 * 1024;

export type ServerEnv = {
  chainstoreUrl: string;
  r1fsUrl: string;
  authHKey: string;
  authSecret: string;
  bootstrapAdminPassword: string | null;
  defaultMaxImages: number;
  sessionCookieName: string;
  sessionTtlSeconds: number;
  eeId: string;
  maxUploadBytes: number;
  allowedMimeTypes: string[];
};

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function getServerEnv(env: ProcessEnv = process.env): ServerEnv {
  const missing = REQUIRED_ENV.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    chainstoreUrl: env.EE_CHAINSTORE_API_URL as string,
    r1fsUrl: env.EE_R1FS_API_URL as string,
    authHKey: env.EE_CSTORE_AUTH_HKEY as string,
    authSecret: env.EE_CSTORE_AUTH_SECRET as string,
    bootstrapAdminPassword: env.EE_CSTORE_AUTH_BOOTSTRAP_ADMIN_PW ?? null,
    defaultMaxImages: parseIntEnv(env.DEFAULT_MAX_IMAGES, DEFAULT_MAX_IMAGES),
    sessionCookieName: env.AUTH_SESSION_COOKIE || 'r1-session',
    sessionTtlSeconds: parseIntEnv(env.AUTH_SESSION_TTL_SECONDS, 86400),
    eeId: env.EE_HOST_ID || env.EE_ID || 'unknown-node',
    maxUploadBytes: TEN_MB,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/tiff']
  };
}
import type { ProcessEnv } from 'node:process';
