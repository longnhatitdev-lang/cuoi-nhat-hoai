# LCLN Wedding — Audit & implementation report

Date: 2026-11-20
Source archive: `wedding-invitation(2).zip`
Target: `wedding-invitation-nextjs/`

## 1. Preserved behavior

- Kept the two invitation baselines (`nam` and `gai`) and current section/DOM structure.
- Kept the existing HTML/CSS/JS invitation runtime and Admin direct-edit workflow.
- Kept Supabase JSONB content snapshots, RSVP/wishes endpoints, Telegram endpoint, album data, and client access gate.
- Kept existing public asset tree and did not fabricate assets intentionally omitted from the ZIP.
- Kept the current WebP conversion behavior: browser canvas uses original decoded pixel width/height; no resize or crop is applied.

## 2. Implemented in this pass

### Admin authentication
- Added `/api/admin-login`.
- Password is submitted once during login; successful login creates a signed 8-hour HttpOnly, SameSite=Strict cookie.
- Removed `sessionStorage` password storage and `x-admin-password` from the new Next.js Admin pages.
- Added explicit Admin logout.
- Admin API requests check the signed session and validate same-origin `Origin` on mutating requests when the browser sends it.
- Added persistent login throttling through Supabase RPC; the migration must be applied before this login flow can be used.

### Concurrent edits
- Invitation HTML save/undo/reset now sends an `If-Match` version from `wedding_site_content.updated_at`.
- A stale Admin save returns HTTP 409 instead of overwriting a newer version.
- Album list save uses the same optimistic concurrency check.

### Guestbook/RSVP wall
- Replaced process-memory per-name enforcement with a Supabase RPC design that performs the 3-per-name limit, duplicate check, and 12-per-minute per-client limit inside a transaction.
- This works across Vercel instances after the supplied SQL migration is applied.
- The existing `wedding_wall` table is not dropped or recreated.

### Uploads
- Admin image/audio uploads now request a server-signed Cloudinary upload and send the binary directly from the browser to Cloudinary.
- This removes large Base64 upload bodies from Vercel Functions for the updated Admin and Album Manager pages.
- Images remain WebP and retain decoded pixel dimensions.
- Delete requests now validate the Storage origin and object path.

### Mobile and accessibility
- Added safe-area/viewport handling for mobile browsers.
- Added reduced-motion fallback for animation-heavy sections and page transitions.
- Kept the existing mobile gallery, touch targets, modal, and invitation layout rules.

## 3. Database migration required

`supabase/migration-nextjs-hardening.sql` adds only supporting rate-limit tables and RPC functions. It does not replace the current content or RSVP/wishes tables.

Important: the original ZIP does not include a `CREATE TABLE` definition for `public.wedding_wall`. The migration therefore assumes the existing table has `name`, `side`, `status`, `guests`, `message`, and default-generated ID/time fields, matching the API's current insert. Inspect the actual table columns and make a backup before running the SQL. Do not run it if the real table schema differs; adjust the RPC insert to the actual schema first.

## 4. Checks run in this environment

- `npm run check:source`: PASS (Node syntax checks across API, source, Client and Admin scripts).
- `npm run check:assets`: PASS (4 interface HTML files and 20 referenced asset paths; no missing referenced assets found in the archive).
- Admin cookie signing/verification smoke test: PASS.
- `npm install`: BLOCKED by DNS/network error `EAI_AGAIN registry.npmjs.org`.
- `npm run build`: NOT RUN because dependencies could not be installed. This is not a successful production-build verification.
- Supabase RPC/migration execution: NOT RUN; requires access to the user's Supabase project and inspection of the live `wedding_wall` schema.
- Vercel Preview deployment and real iPhone/Android testing: NOT RUN; requires the user's Vercel project and devices.

## 5. Remaining items before production

1. Verify `public.wedding_wall` schema, then run the hardening migration once in the correct Supabase project.
2. Configure `ADMIN_SESSION_SECRET` (32+ random characters), `ACCESS_SESSION_SECRET` (32+ random characters), `ADMIN_PASSWORD`, and the server-only Supabase secret/service-role key in local `.env` and Vercel environment variables.
3. Install dependencies in an environment with npm registry access and run `npm run build`. The Vercel runtime is pinned to Node.js 22.x.
4. Test Cloudinary signed upload, image/audio delivery, and deletion against the actual Cloudinary account.
5. Test Admin login/logout, save conflicts, undo/reset, album CRUD, guestbook/RSVP, client lockout and Telegram on Vercel Preview.
6. Extend optimistic concurrency to component-library and access-settings JSONB writes; those endpoints still use the earlier read/modify/write pattern.
7. Run visual and interaction tests on iPhone Safari and Android Chrome.
8. Only promote to Production after the Preview checklist passes.

## 6. React migration status

This deliverable is still the compatibility-first Next.js Pages Router build. The legacy invitation remains HTML/CSS/JS because Admin publishes full HTML snapshots to Supabase. A full React rewrite would require replacing that editing/data model, not merely wrapping the current page in React. The recommended safe next step is to migrate isolated screens (Admin dashboard, Album Manager, access screen) to React first, then convert invitation sections incrementally while retaining a tested HTML rollback path.


## 7. Vercel tracing adjustment (2026-11-21)

- `src/config.js` now uses `process.cwd()` for the project root and no longer reads `.env` through `fs` at module load. Next.js/Vercel environment variables are the production source of truth; local Next.js loads `.env.local` automatically.
- This removes the `path.join(__dirname, "..")` dynamic-filesystem tracing warning reported by Turbopack.
- Node.js engine is pinned to `22.x` to avoid automatic major-version upgrades.
- Cloudinary deletion now uses the matching `image/destroy` or `video/destroy` endpoint for image/audio assets.
- A production build and live Vercel deployment still require dependency installation and testing in the user's Vercel project; they cannot be certified from static checks alone.
