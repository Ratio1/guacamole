# guacamole

Minimal Ratio1 image sharing app built with Next.js, `@ratio1/edge-sdk-ts`, and `@ratio1/cstore-auth-ts`.

It follows the TypeScript SDK guide: https://ratio1.ai/blog/ratio1-sdk-for-typescript-your-bridge-to-edge-nodes and keeps the UX lean (no r1fs-demo bloat).

## What it does
- Auth: `@ratio1/cstore-auth-ts` bootstraps a fixed `admin` user (password via `EE_CSTORE_AUTH_BOOTSTRAP_ADMIN_PW`). Sessions are signed HttpOnly cookies.
- Admin: create/delete users, set a max image count per user (default 10).
- Uploads: authenticated users upload PNG/JPEG/TIFF up to 10 MB. Files stream to R1FS via `@ratio1/edge-sdk-ts`; metadata and quotas live in CStore.
- Events: every upload writes a CStore HSET event (`events` hash) like “user X uploaded Y”.
- Listing/preview: all files show as names + thumbnails; links stream via `/api/files/[cid]`.
- Multi-node: footer shows `EE_HOST_ID` (fallback to `EE_ID`) — “Ratio1 Edge Node proudly serving this page: ...”. All state is in CStore so nodes stay consistent.

## Quick start
1) Install dependencies
```bash
npm install
```

2) Configure environment (copy and edit as needed)
```bash
cp .env.example .env.local
```
Required:
- `EE_CHAINSTORE_API_URL`
- `EE_R1FS_API_URL`
- `EE_CSTORE_AUTH_HKEY`
- `EE_CSTORE_AUTH_SECRET`
- `EE_CSTORE_AUTH_BOOTSTRAP_ADMIN_PW`

Optional:
- `EE_HOST_ID` (footer/metadata; falls back to `EE_ID` if present)
- `DEFAULT_MAX_IMAGES` (default quota, 10)
- `AUTH_SESSION_COOKIE` / `AUTH_SESSION_TTL_SECONDS`

For local dev you can point the URLs at `r1-plugins-sandbox` (see the Ratio1 TS SDK blog) or live nodes.

3) Run the app
```bash
npm run dev
```
Visit http://localhost:3000 and log in as `admin` with the bootstrap password.

## Local development options

### Option 1: Real R1EN devnet/testnet node (Docker)
Run a local Ratio1 edge node container and expose the HTTP plugins to localhost:
```bash
docker run --rm -it \
  -p 30000:30000 \  # CStore HTTP
  -p 30001:30001 \  # R1FS HTTP
  ratio1/edge-node:devnet
```
(Swap `:devnet` with `:testnet` if you prefer that flavor.)

Then point the app at the node:
```bash
export EE_CHAINSTORE_API_URL=http://127.0.0.1:30000
export EE_R1FS_API_URL=http://127.0.0.1:30001
export EE_CSTORE_AUTH_HKEY=auth
export EE_CSTORE_AUTH_SECRET=super-secret-pepper
export EE_CSTORE_AUTH_BOOTSTRAP_ADMIN_PW=changeme-admin
npm run dev
```
Ports 30000/30001 are mapped to 127.0.0.1 so the SDK behaves as if it’s co-located with the node. If your node image requires additional allowlisting for clients, add your host IP to the node’s config (none is needed for the default devnet/testnet image).

### Option 2: r1-plugins-sandbox (local twin for R1FS + CStore)
Use the bundled helper to fetch and run the sandbox:
```bash
npm run sandbox   # Terminal 1: downloads binary if missing, starts CStore at :8787 and R1FS at :8788
npm run dev       # Terminal 2: start the Next.js dev server
```
The script prints the env you need; defaults are:
```
EE_CHAINSTORE_API_URL=http://127.0.0.1:8787
EE_R1FS_API_URL=http://127.0.0.1:8788
```
Advanced sandbox flags (latency/failure injection, deterministic seeds) are supported by r1-plugins-sandbox but kept out of the default flow; pass them manually after `npm run sandbox` once the binary is present.

## Data model (CStore)
- Users: managed by `@ratio1/cstore-auth-ts` under `EE_CSTORE_AUTH_HKEY`.
- Quotas: `hkey=users:{username}:quota`, field `quota` -> `{ "max": number, "used": number }`.
- Files: `hkey=files`, field = `cid`, value -> `{ owner, filename, mime, size, createdAt, nodeId }`.
- Events: `hkey=events`, field = `${timestamp}:${cid}`, value -> `{ type:"upload", user, filename, cid, nodeId, createdAt }`.

## API surface (App Router)
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/POST /api/users` (admin)
- `DELETE /api/users/[username]` (admin; soft-deletes user, clears metadata/quota/events, attempts R1FS delete)
- `GET/POST /api/files` (list/upload)
- `GET /api/files/[cid]` (stream/download proxy)
- `GET /api/events` (recent events feed)

## Behavior notes
- File limit: 10 MB and PNG/JPEG/TIFF enforced on both client and server.
- Quota: uploads increment `used`; if an upload would exceed `max`, it is rolled back and the file is deleted from R1FS when possible.
- User deletion: marks the auth record as deleted (cstore-auth has no hard delete), removes metadata entries, events, and attempts to delete R1FS blobs.
- Thumbnails: CSS-scaled previews; no server-side thumbnail generation.

## Scripts
- `npm run dev` — start Next.js dev server
- `npm run build` — production build
- `npm run start` — start production server
- `npm run lint` — lint with `eslint-config-next`

## Links
- TypeScript SDK announcement: https://ratio1.ai/blog/ratio1-sdk-for-typescript-your-bridge-to-edge-nodes
- Ratio1 org: https://github.com/Ratio1
- R1FS reference demo (heavier): https://github.com/Ratio1/r1fs-demo
