import createEdgeSdk, { type EdgeSdk } from '@ratio1/edge-sdk-ts';
import crossFetch from 'cross-fetch';
import FormData from 'form-data';
import { getServerEnv } from './env';

let cachedSdk: EdgeSdk | null = null;

export function getEdgeSdk(): EdgeSdk {
  if (cachedSdk) {
    return cachedSdk;
  }

  const env = getServerEnv();
  cachedSdk = createEdgeSdk({
    cstoreUrl: env.chainstoreUrl,
    r1fsUrl: env.r1fsUrl,
    debug: process.env.DEBUG === 'true',
    httpAdapter: {
      // cross-fetch handles Node.js FormData streams correctly; undici + form-data can break multipart parsing.
      fetch: (url: RequestInfo, options?: RequestInit) => crossFetch(url, options)
    },
    formDataCtor: FormData as unknown as typeof globalThis.FormData
  });
  return cachedSdk;
}

export function getCStore() {
  return getEdgeSdk().cstore;
}

export function getR1FS() {
  return getEdgeSdk().r1fs;
}
