# Implementation Plan for guacamole (Ratio1 minimalistic image sharing app)

## 1) Goals and guardrails
- Deliver a minimal Next.js app that lets authenticated users upload PNG/JPEG/TIFF images (max 10 MB), list them with thumbnails, and view/stream by link.
- Keep state cross-node via CStore; files in R1FS; notifications as CStore hash events. Avoid r1fs-demo bloat.
- Fixed admin username `admin`; admin can create/delete users and set max-images (default 10). Deleting a user removes their metadata, quota entries, events, and (if API supports) R1FS objects.
- UI stays simple; CSS scaling for thumbnails (no server-side generation). Footer shows `EE_HOST_ID` (fallback `EE_ID`) to indicate serving edge node.

## 2) Dependencies and tooling
- Node runtime: match Ratio1 guidance (Node 18+; Next.js App Router). Use npm unless told otherwise.
- Packages: `next`, `react`, `@ratio1/edge-sdk-ts`, `@ratio1/cstore-auth-ts`, `typescript`, `eslint`, minimal UI deps (Tailwind optional but keep lean).
- Dev helpers: optional `next/image` for optimized display; no image processing libs (per CSS scaling choice).

## 3) Environment variables (server-injected, SSR-friendly)
- Required SDK endpoints: `EE_CHAINSTORE_API_URL`, `EE_R1FS_API_URL`.
- Auth and secrets: `EE_CSTORE_AUTH_HKEY`, `EE_CSTORE_AUTH_SECRET`, `EE_CSTORE_AUTH_BOOTSTRAP_ADMIN_PW` (bootstrap admin password).
- Quota defaults: `DEFAULT_MAX_IMAGES` (fallback 10).
- Node identity: `EE_HOST_ID` (footer and metadata; fallback `EE_ID` if present).
- Optional: `NEXT_PUBLIC_MAX_FILE_MB` (UI limit hint), `NODE_ENV`, `DEBUG`.

## 4) State model in CStore
- Users and credentials: handled by `@ratio1/cstore-auth-ts` using `EE_CSTORE_AUTH_HKEY` and secret/pepper.
- Quotas: hash key `users:{username}:quota` -> `{ max: number, used: number }`.
- Files metadata: hash key `files` -> field = CID, value = `{ owner, filename, mime, size, createdAt, nodeId }`.
- Events (VI messages): hash key `events` -> field = timestamp or CID, value = `{ type: "upload", user, filename, cid, nodeId, createdAt }`.
- Sessions: HttpOnly cookie (e.g., `r1-session`) set by auth routes.

## 5) Core flows
- Bootstrap auth: on startup or first admin action, run `auth.simple.init()` with bootstrap admin password (username fixed to `admin`).
- Login/logout: `POST /api/auth/login` (uses `cstore-auth-ts`), sets cookie; `POST /api/auth/logout` clears.
- Admin user CRUD:
  - Create: `POST /api/users` (admin-only) with username/password/maxImages (default 10). Initialize quota hash.
  - Delete: `DELETE /api/users/:username` (admin-only) removes credentials, quota hash, file metadata entries for that user, events for that user, and (if supported) deletes their R1FS CIDs.
  - List: `GET /api/users` (admin-only) to show quotas/usage.
- Upload:
  - UI enforces allowed MIME (png/jpeg/tiff) and max 10 MB.
  - API `POST /api/files`: validate auth; check quota via CStore; upload to R1FS using `edge-sdk-ts`; store metadata in `files`; increment quota used; write event to `events`; return CID and link.
- Listing:
  - `GET /api/files`: returns sorted file metadata list.
  - Page SSR fetches list; renders names and thumbnails (CSS-scaled with either `<img>` or `next/image` using streaming URL).
- Streaming/view:
  - `GET /api/files/:cid`: proxy stream from R1FS or return presigned URL (depending on `edge-sdk-ts` capabilities). Provide download/view link from list.
- Notifications:
  - Client polls `events` hash or a lightweight `GET /api/events` that returns recent events to render “user XYZ uploaded ABC image” feed.

## 6) API surface (App Router)
- `/api/auth/login` POST
- `/api/auth/logout` POST
- `/api/auth/me` GET
- `/api/users` GET/POST (admin)
- `/api/users/[username]` DELETE (admin)
- `/api/files` GET/POST
- `/api/files/[cid]` GET (stream/presign)
- `/api/events` GET (recent events)
- Middleware: protect pages/API; allow public `/login` and static assets.

## 7) UI scope
- Pages: `/login`, `/` (list + upload), `/admin` (user management).
- Components: upload form, files table/grid with thumbnails and view links, events feed, quota meter, footer showing `EE_HOST_ID`.
- Styling: minimal CSS/Tailwind; responsive layout; no heavy dependencies.

## 8) Multi-node and consistency
- All mutable state in CStore; avoid in-memory caches.
- Use optimistic/concurrency-safe writes where available; ensure quota increments are atomic (read-modify-write guarded by CStore semantics).
- Include `nodeId` (EE_HOST_ID, fallback EE_ID) in metadata/events for observability across nodes.

## 9) Error handling and limits
- Enforce server-side file size (10 MB) and MIME check.
- Return clear errors for quota exceeded, auth failures, and missing env vars (fail fast at boot for required envs).
- Graceful degradation if R1FS delete is unavailable: mark metadata deleted and warn (document behavior).

## 10) Testing and verification
- Unit/integration stubs for:
  - Auth init and login flow (mock `cstore-auth-ts`).
  - Quota enforcement logic.
  - File metadata persistence and event writing (mock `edge-sdk-ts` + CStore).
- Manual checklist:
  - Admin bootstrap and login.
  - User create/delete; quota set to default 10.
  - Upload <=10 MB PNG/JPEG/TIFF; verify list, thumbnail shows, link streams.
  - Quota exceeded rejection at 11th upload.
  - Events feed shows uploads across page reloads.
- Footer displays `EE_HOST_ID` (fallback `EE_ID`).

## 11) Assumptions to validate during implementation
- `@ratio1/edge-sdk-ts` supports file upload/download and (if exposed) delete; if delete isn’t available, we’ll keep metadata in sync and document blobs as orphaned.
- R1FS URLs are reachable from browser; if not, server proxy will stream.
- npm registry hosts `@ratio1/*` packages (confirmed).
