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
| SPA | S3 (private, CloudFront OAC) behind CloudFront on `<domain>` | Error responses 403/404 → `/index.html` (200); safe because the API is **not** behind this distribution. `assets/*`: cache 1 year, immutable (Vite hashes names). `index.html`: `no-cache`. `infra/deploy-client.sh` uploads it last and invalidates `/` and `/index.html`. |
| Photos | Separate private S3 bucket behind CloudFront on `cdn.<domain>` | API runs with `STORAGE_DRIVER=s3`, `S3_PUBLIC_URL=https://cdn.<domain>`. Uploads go through the API (validated); each photo is stored with its `-thumb.webp`. |
| API + database | One **AWS Lightsail** instance, Frankfurt (`eu-central-1`) | Linux, 2 GB RAM / 2 vCPU / 60 GB SSD / 3 TB transfer / public IPv4 bundle (**$12/mo**). Static IP, DNS `api.<domain>`. Docker Compose: Caddy (auto TLS) → Express `:4000`. SQLite at `/data/lovestory.db`, mounted from the instance disk. Firewall: 80/443 open, SSH key-only. |

Wiring:

- `<domain>` and `api.<domain>` are the same *site*, so the refresh cookie (`SameSite=Lax`, path
  `/api/admin/auth`) is sent; CORS with credentials is already in `app.ts`.
- `CLIENT_ORIGIN=https://<domain>[,https://www.<domain>]`: the **first** entry is the canonical origin
  (used for links in notifications, `lib/notify.ts`).
- Build the client with `VITE_API_BASE=https://api.<domain>/api` (inlined at build time).
- `TRUST_PROXY=1` (Caddy is the only proxy; the default `0` would make rate limiting see Caddy's IP).
- Backups: Lightsail automatic daily snapshots (7 kept) **plus** a nightly dump with
  `deploy/backup.sh` (SQLite online backup, integrity check, last 7 kept on the server, optional upload
  to S3). Test a restore on a clean machine once.
- S3 access: an IAM user limited to the media bucket, keys in the server's `.env`. Lightsail instance
  IAM roles are reported as unavailable (community answer, not confirmed in the official docs).
- Release: `git pull`, `docker compose build`, `prisma:push` through the `tools` service, `docker
  compose up -d` (or build elsewhere and pull, with `API_IMAGE`). Runbook:
  [`deploy/README.md`](../deploy/README.md). The image builds for both `linux/amd64` and
  `linux/arm64`. The API is down for a few seconds during a redeploy (single SQLite writer); the
  static site stays up.

## Photo processing: on the API with `sharp`, not Lambda

Uploads already pass through the API (byte validation), so processing happens there; no S3 events or
Lambda. State of the working tree on 2026-11-08 (uncommitted): `server/src/lib/image-variants.ts` makes
two WebP copies per upload: an 800 px thumbnail (grids) and, for big originals, a 2400 px "large" copy
(full-screen viewer and splash; it becomes the photo's `url`). Both are EXIF-rotated and carry no
metadata. The original is kept (`Media.storageKey`) but no public page links to it; it still has its
EXIF, including GPS. `npm run media:thumbnails` backfills older photos.

Not done yet / still to decide:

- Whether to keep the original at all: it holds GPS and costs storage, but allows remaking the copies.
- Manual crop (for example for the hero photo): the client sends `crop=x,y,w,h`, the server extracts
  from the original with `sharp`.

## AWS resources as code: `infra/`

The AWS side is described in two CloudFormation templates (runbook in
[`infra/README.md`](../infra/README.md)): `certificate.yml` (us-east-1: the ACM certificate, which
CloudFront only reads from there) and `app.yml` (eu-central-1: the site, photo and backup buckets, both
CloudFront distributions with origin access control, the two IAM users, the Lightsail instance with its
firewall, daily snapshots and a launch script that installs Docker, and the static IP). DNS records, IAM
access keys and the app setup on the server stay outside the templates.

Status: both pass `cfn-lint`; neither has been deployed. Not confirmed in the docs: that CloudFront
distributions can be created from a eu-central-1 stack (the certificate is passed in by ARN because stack
outputs cannot be referenced across regions), and the exact Lightsail blueprint ID (`ubuntu_24_04` is the
default; the README shows how to check it). A replaced Lightsail instance starts with an empty disk, so
every stack change that replaces it needs a restore from backup.

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

## Deploy fixes (2026-11-08)

Done, and checked by building the images and running them (details under "Checked" below):

- `server/Dockerfile` did not build at all: `npm ci` failed because better-sqlite3 has no ready-made
  binary for Alpine (musl) on arm64, and compiling it needs python/make/g++. It is now Debian slim
  (`node:26-bookworm-slim`: Node 20 reached end of life on 2026-04-30, Node 26 became LTS on
  2026-10-28, and the dev machine runs Node 26). The `.prisma` copy path is fixed (the generated client
  is in the root `node_modules`). `prisma generate` gets a placeholder `DATABASE_URL` because
  `prisma.config.ts` requires one (the old build only got past this by copying a local `server/.env`
  into the image).
- New `tools` stage (`--target tools`): the build stage as a maintenance image for `prisma:push`,
  `prisma:seed` and `media:thumbnails` against the production volume (the runtime image has no `tsx`
  and no `prisma.config.ts`). The commands are in the header of `server/Dockerfile`.
- `.dockerignore` in the repo root: no `.env` files, SQLite files or `uploads/` in the build context,
  so `dev.db` no longer ends up in the image.
- `prisma:deploy` (`db push --accept-data-loss`) removed from `server/package.json`; nothing used it.
  `prisma db push` without that flag refuses changes that would lose data.
- `server/.env.example`: a production block (`TRUST_PROXY=1`, canonical `CLIENT_ORIGIN`,
  `DATABASE_URL`), and `s3:GetObject` added to the IAM list because `media:thumbnails` reads the
  originals back.

Checked (arm64 build on Apple Silicon, run in Docker): schema push on an empty volume and seed with
the `tools` image; the API image starts and `/api/health` answers; owner login works; a 3000×2000 PNG
upload produced the thumbnail and large WebP copies (sharp works in the runtime image) and both are
served; `SIGTERM` shuts the server down cleanly; the data is still there after a container restart.
The amd64 image builds too and its native modules (better-sqlite3, sharp) load, but amd64 was only run
under emulation and not through the full test above.

Production stack, in `deploy/` (runbook in `deploy/README.md`): `docker-compose.yml` (Caddy, the API,
and a `tools` service for one-off jobs), `Caddyfile` (HTTPS for `api.<domain>`), `.env.example` and
`backup.sh`. Checked locally with `DOMAIN=localhost` (Caddy's internal CA instead of Let's Encrypt):
schema push and seed through `tools`, `up --wait` (the API reports healthy within seconds, then Caddy
starts), HTTPS and the HTTP redirect, owner login through Caddy (the refresh cookie is
`HttpOnly; Secure; SameSite=Lax`), a photo upload through Caddy, and `backup.sh` on the live database
(plus pruning, the upload command with a stand-in `aws`, and a restore).

Not tested: a real Let's Encrypt certificate (needs the public DNS record), the S3 driver in this
stack (the test used local storage), Lightsail itself, and `TRUST_PROXY=1` behind Caddy (configuration
only).

Still open:

- The runtime image is about 1.2 GB (`docker images`). `@prisma/client` 7.8 pulls the `prisma` CLI,
  with its Studio and TypeScript dependencies, into `node_modules` (407 MB in total). It works; trim
  it later if pulls feel slow.
- `storage.ts` requires `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (fits the IAM-user decision above).
- Double-booking is prevented only by a SQLite transaction (`booking.service.ts`): keep a single
  instance, and re-add an exclusion constraint if the database ever moves to Postgres.

## Open points

- CPU architecture of the Lightsail bundle not verified; the image builds for both x86-64 and arm64,
  so it does not block anything.
- Confirm the plan, region and price in the Lightsail console before ordering.
