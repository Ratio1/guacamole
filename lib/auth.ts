import { CStoreAuth, type PublicUser, InvalidCredentialsError } from '@ratio1/cstore-auth-ts';
import { getServerEnv } from './env';
import { getCStore } from './sdk';

let authClient: CStoreAuth | null = null;
let initPromise: Promise<void> | null = null;

function createAuthClient(): CStoreAuth {
  if (authClient) return authClient;

  const env = getServerEnv();
  const cstore = getCStore();

  const client = {
    hget: (hkey: string, key: string) => cstore.hget({ hkey, key }),
    hset: async (hkey: string, key: string, value: string) => {
      await cstore.hset({ hkey, key, value });
    },
    hgetAll: (hkey: string) => cstore.hgetall({ hkey })
  };

  authClient = new CStoreAuth({
    hkey: env.authHKey,
    secret: env.authSecret,
    client
  });

  return authClient;
}

export function getAuth(): CStoreAuth {
  return createAuthClient();
}

export async function ensureAuthInitialized() {
  if (initPromise) {
    return initPromise;
  }
  const env = getServerEnv();
  const auth = getAuth();
  initPromise = (async () => {
    await auth.simple.init();
    // The library itself bootstraps admin if missing with the env password.
    if (!env.bootstrapAdminPassword) {
      console.warn('EE_CSTORE_AUTH_BOOTSTRAP_ADMIN_PW is not set; admin bootstrap may fail.');
    }
  })();
  return initPromise;
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<PublicUser<Record<string, unknown>>> {
  await ensureAuthInitialized();
  const auth = getAuth();
  const user = await auth.simple.authenticate(username, password);
  const metadata = (user.metadata || {}) as Record<string, unknown>;
  if (metadata.deleted) {
    throw new InvalidCredentialsError();
  }
  return user;
}

export async function getUser(username: string): Promise<PublicUser<Record<string, unknown>> | null> {
  await ensureAuthInitialized();
  const auth = getAuth();
  const user = await auth.simple.getUser(username);
  if (!user) return null;
  const metadata = (user.metadata || {}) as Record<string, unknown>;
  if (metadata.deleted) return null;
  return user;
}

export async function listUsers(): Promise<PublicUser<Record<string, unknown>>[]> {
  await ensureAuthInitialized();
  const auth = getAuth();
  const users = await auth.simple.getAllUsers();
  return users.map((user) => {
    const metadata = (user.metadata || {}) as Record<string, unknown>;
    return {
      ...user,
      metadata
    };
  });
}
