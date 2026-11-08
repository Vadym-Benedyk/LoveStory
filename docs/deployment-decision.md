# Deployment decision: AWS Lightsail (API) + S3 / CloudFront (site and photos)

Date: 2026-11-08 · Status: accepted

## Context

The backend is Express + Prisma + a **SQLite file**, with an hourly in-process cron job
(`server/src/jobs/expiry.job.ts`) and `sharp` for photo processing. The site is a Vite/React SPA
(`createBrowserRouter`, so it needs an `index.html` fallback). One property, low traffic.

What the app needs from a host: a **persistent local disk** (SQLite), one long-running process, enough
RAM for `sharp` (2 GB assumed, not measured), outbound SMTP/Telegram.

Not usable without a bigger change (no persistent disk → the database would have to move to Postgres,
and the overlap guard in `booking.service.ts` would need a real exclusion constraint again): App
Runner, ECS Fargate, Lambda, serverless functions of Vercel/Netlify.

## Decision

| Part | Where | Notes |
|---|---|---|
| SPA | S3 (private, CloudFront OAC) behind CloudFront on `<domain>` | Error responses 403/404 → `/index.html` (200); safe because the API is **not** behind this distribution. `assets/*`: cache 1 year, immutable (Vite hashes names). `index.html`: `no-cache`, invalidate `/index.html` after each deploy. |
| Photos | Separate private S3 bucket behind CloudFront on `cdn.<domain>` | API runs with `STORAGE_DRIVER=s3`, `S3_PUBLIC_URL=https://cdn.<domain>`. Uploads go through the API (validated); each photo is stored with its `-thumb.webp`. |
| API + database | One **AWS Lightsail** instance, Frankfurt (`eu-central-1`) | Linux, 2 GB RAM / 2 vCPU / 60 GB SSD / 3 TB transfer / public IPv4 bundle (**$12/mo**). Static IP, DNS `api.<domain>`. Docker Compose: Caddy (auto TLS) → Express `:4000`. SQLite at `/data/lovestory.db`, mounted from the instance disk. Firewall: 80/443 open, SSH key-only. |

Wiring:

- `<domain>` and `api.<domain>` are the same *site*, so the refresh cookie (`SameSite=Lax`, path
  `/api/admin/auth`) is sent; CORS with credentials is already in `app.ts`.
- `CLIENT_ORIGIN=https://<domain>[,https://www.<domain>]`: the **first** entry is the canonical origin
  (used for links in notifications, `lib/notify.ts`).
- Build the client with `VITE_API_BASE=https://api.<domain>/api` (inlined at build time).
- `TRUST_PROXY=1` (Caddy is the only proxy; the default `0` would make rate limiting see Caddy's IP).
- Backups: Lightsail automatic daily snapshots (7 kept) **plus** a nightly `sqlite3 .backup` to S3.
  Test a restore on a clean machine once.
- S3 access: an IAM user limited to the media bucket, keys in the server's `.env`. Lightsail instance
  IAM roles are reported as unavailable (community answer, not confirmed in the official docs).
- Release: build a multi-arch image (`linux/amd64` + `linux/arm64`), `docker compose pull && up -d`.
  The API is down for a few seconds during a redeploy (single SQLite writer); the static site stays up.

## Photo processing: on the API with `sharp`, not Lambda

Uploads already pass through the API (byte validation), so processing happens there; no S3 events or
Lambda. State of the working tree on 2026-11-08 (uncommitted): `server/src/lib/thumbnail.ts` makes an
800 px WebP thumbnail per upload (EXIF-rotated, no metadata), the original is stored unchanged, and
`npm run media:thumbnails` backfills older photos.

Not done yet / still to decide:

- Originals keep their EXIF (including GPS) and are public. Option: store a downscaled master
  (about 2400 px WebP, metadata stripped) instead of the raw upload.
- More sizes for `srcset` (for example 640 / 1280 px) in addition to the 800 px thumbnail.
- Manual crop (for example for the hero photo): the client sends `crop=x,y,w,h`, the server extracts
  from the original with `sharp`.

## Cost (prices checked 2026-11-08, USD, without taxes)

About **$12–13 per month**: Lightsail $12, S3 a few cents, CloudFront inside the always-free tier
(1 TB transfer, 10 M requests, 2 M function invocations per month). Not included: domain/DNS,
snapshot storage (price not checked), traffic above the 3 TB bundle.

Compared with (Frankfurt where it matters): EC2 `t4g.small` + EBS + IPv4 about $20 (Frankfurt prices
from a third-party aggregator); Hetzner Cloud from €5.99 excl. VAT (availability of the cheapest plans
reported as unstable); Fly.io about $7.5 (1 GB) to $14 (2 GB); Railway about $7–10 (estimate, usage
based); Render about $26 (third-party prices). Fly.io, Railway and Render also run a single instance
with one volume and have short downtime on deploy.

## Exit path

- Lightsail → EC2: documented. Export a manual snapshot (creates an AMI + EBS snapshot); the IP changes.
- EC2 → Lightsail: no import found in the docs; it would be a manual move (new instance, restore the
  SQLite backup, copy `.env`, switch DNS), which is cheap for this app.
- Anywhere else: Docker image + SQLite backup + env vars. Keep the image multi-arch and the restore
  procedure tested.

## Known gaps before the first deploy

- `server/Dockerfile` copies `server/node_modules/.prisma`, but in this npm workspace the generated
  client lives in the root `node_modules/.prisma`, so the image build most likely fails (not built).
- Nothing creates or updates the schema inside the container: `prisma` is a devDependency and the
  runtime image installs without dev dependencies. `prisma:deploy` runs `db push --accept-data-loss`,
  never run it on production data.
- No `.dockerignore`: `server/prisma/dev.db` is copied into the image, `.env` and `uploads/` into the
  build context.
- `media:thumbnails` runs through `tsx` (devDependency), which is not in the runtime image.
- `storage.ts` requires `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (fits the IAM-user decision above).
- Double-booking is prevented only by a SQLite transaction (`booking.service.ts`): keep a single
  instance, and re-add an exclusion constraint if the database ever moves to Postgres.

## Open points

- CPU architecture of the Lightsail bundle not verified (hence the multi-arch image).
- Confirm the plan, region and price in the Lightsail console before ordering.
