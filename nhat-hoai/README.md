# LCLN Wedding — Next.js migration (hardening build)

This project uses Next.js 16 Pages Router as the application/deployment layer while preserving the current wedding invitation HTML/CSS/JS, Admin DOM editor, Supabase JSONB snapshots, RSVP/wishes, and album workflows. This is an intentionally low-risk migration: the live invitation design and its DOM structure are not rewritten wholesale.

## Requirements
- Node.js 20.9+ (Node 22 LTS recommended)
- Supabase project with the existing `wedding_wall`, `wedding_site_content`, and access-control tables
- Cloudinary lưu ảnh (upload ký số từ server; Supabase chỉ lưu nội dung/metadata JSONB)
- Vercel project configured with the Next.js framework preset

## Local setup
1. Copy `.env.example` to `.env`.
2. Fill in `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `ACCESS_SESSION_SECRET`, `SUPABASE_URL`, and a server-only Supabase secret/service-role key in `SUPABASE_SECRET_KEY`.
3. Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Routes retained
- `/`, `/index-nam`, `/nha-trai` — Nhà trai
- `/index-gai`, `/nha-gai` — Nhà gái
- `/admin`, `/admin-nam`, `/admin-gai`, `/admin-album`
- `/album`, `/access`
- `/api/*` endpoints are dispatched through `pages/api/[...route].js`.

## Supabase migration — required before using hardened APIs
The file `supabase/migration-nextjs-hardening.sql` adds:
- Transaction-safe per-name 3-message limit and duplicate check for `wedding_wall`
- Persistent per-client request limiting for public wall submissions
- Persistent Admin login throttling

Run this SQL once in Supabase SQL Editor after making a database backup. It does **not** drop or rewrite the existing RSVP/wishes tables or wedding content. It expects the existing `public.wedding_wall` table to have the columns already used by the current application: `name`, `side`, `status`, `guests`, `message`, and default-generated ID/time fields. Verify that table shape before running the migration.

Do not rerun old setup SQL that would overwrite or recreate live data. Keep the existing `wedding_site_content` records. Existing Supabase Storage files remain untouched and old URLs continue to display; new uploads use Cloudinary.

## Admin security changes
- Admin login now exchanges the password once for a signed, 8-hour HttpOnly, SameSite=Strict cookie.
- The password is no longer stored in `sessionStorage` or sent in every Admin API request.
- Admin API writes validate the request Origin when present.
- Admin login attempts are throttled in Supabase; this requires the hardening SQL above.
- Admin has an explicit logout action.
- Client access-preview cookie remains separate from the Admin session.

Required secrets:
- `ADMIN_PASSWORD`: strong Admin password
- `ADMIN_SESSION_SECRET`: random secret, minimum 32 characters
- `ACCESS_SESSION_SECRET`: random secret, minimum 32 characters
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`: server-only Supabase Secret Key; never expose it in browser code
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Never commit `.env`. Do not use a publishable/anon key as `SUPABASE_SECRET_KEY` for these server-only operations.

## Data safety and concurrent editing
- Saving the full invitation HTML uses optimistic concurrency based on `updated_at`. If another Admin session saves first, the later save receives HTTP 409 rather than silently overwriting newer content.
- Album save also checks the content version and refuses stale writes.
- Other JSONB editing endpoints (for example component-library metadata and access settings) still use their existing read/modify/write flow and should be upgraded to the same version check in a later pass.

## Upload flow
- Browser still converts images to WebP without resizing pixel dimensions. Audio uploads use Cloudinary video resource type (Cloudinary stores audio assets through its video resource API).
- Browser requests a short-lived signed upload authorization from the authenticated Next.js server, then uploads WebP directly to Cloudinary. API Secret không bao giờ gửi xuống trình duyệt.
- This avoids sending large Base64 image/audio bodies through a Vercel Function. Upload signatures are generated server-side and expire after one hour.
- Cloudinary trả secure_url; website lưu URL trong nội dung JSONB. Album cũ dùng URL Supabase Storage vẫn hiển thị, nhưng ảnh cũ chưa tự chuyển sang Cloudinary.

## Deploy to Vercel
1. Push this project to a Git repository and import it into Vercel.
2. Select Next.js as the framework.
3. Add all required environment variables in Vercel Project Settings → Environment Variables for Preview and Production.
4. Run `supabase/migration-nextjs-hardening.sql` once in the correct Supabase project after backup.
5. Deploy to a Preview URL first. Test every flow in the checklist below before promoting to Production.

## Validation commands
```bash
npm run check:source
npm run check:assets
npm run build
```

The source syntax and asset-reference checks have been run for this build. A full Next.js production build still needs `npm install` to complete in an environment with npm registry access; do not treat syntax checks as a substitute for `next build`.

## Staging checklist
- [ ] `npm run build` succeeds with the locked dependencies.
- [ ] Home, Nhà trai, Nhà gái, Admin, Admin album, Client album, and access-gate routes load.
- [ ] Admin login sets an HttpOnly cookie; password is not stored in sessionStorage or sent in later requests.
- [ ] Logout expires the Admin cookie.
- [ ] Wrong Admin login attempts are throttled after the SQL migration.
- [ ] Save HTML, reload Client, undo, reset original, and simultaneous-edit conflict (HTTP 409).
- [ ] Upload WebP to Cloudinary; verify replacement, deletion, and album JSONB persistence. Audio migration is not included in Cloudinary image integration.
- [ ] Album add/replace/delete/reorder and save conflict handling.
- [ ] RSVP and guestbook read/write, 3-message-per-name limit, duplicate check, and 12-request/minute rate limit.
- [ ] Client password: 3 failures, 15-second lock, then exponential lock duration.
- [ ] Telegram notifications if configured.
- [ ] iPhone Safari and Android Chrome layout, touch, album swipe, modal, and audio behavior.

## Migration scope
This build hardens the current Next.js compatibility layer; it does not yet rewrite the entire invitation page into React components. That is deliberate: the current Admin editor stores and publishes HTML snapshots, so a full React rewrite would require redesigning the editor/data model and would create avoidable risk. The next React phase should begin with isolated pages/components (Admin dashboard, album viewer, access page), then move invitation sections one by one while keeping the HTML snapshot rollback available.
