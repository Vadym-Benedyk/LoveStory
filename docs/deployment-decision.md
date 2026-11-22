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
- Release: a push to `main` runs GitHub Actions (checks, then `deploy/release.sh` on the server over SSH
  with a forced-command key; set up 2026-11-13). By hand: `git pull`, `docker compose build`, `prisma:push` through the `tools` service, `docker
  compose up -d` (or build elsewhere and pull, with `API_IMAGE`). Runbook:
  [`deploy/README.md`](../deploy/README.md). The image builds for both `linux/amd64` and
  `linux/arm64`. The API is down for a few seconds during a redeploy (single SQLite writer); the
  static site stays up.

## Interim: the whole site on the instance (decided 2026-11-22)

AWS Support refused the CloudFront verification of the new account for now (it wants a history of usage
and paid bills; ask again after a billing cycle or two). S3 alone cannot serve the site: its website
endpoint has no HTTPS on a custom domain, and an ACM certificate only attaches to CloudFront or a load
balancer. So until then the Lightsail instance serves everything, with the Caddy that already gets
Let's Encrypt certificates for `api.`:

- The client is built into the Caddy image (`client/Dockerfile`) on every release; `<domain>` serves it
  (`assets/*` cached a year, everything else `no-cache`, SPA fallback to `index.html`), `www.` redirects
  to it. The hashed files of earlier releases stay two weeks in the `site` volume, so open pages can still
  load their lazy chunks.
- `/api` and `/uploads` on `<domain>` go to the API: same origin, so no CORS, and the client's default
  `VITE_API_BASE=/api` works as is. `api.<domain>` stays (release health check, the later CloudFront setup,
  photo links from before).
- Photos: `STORAGE_DRIVER=local` in `DATA_DIR/uploads`, set in `docker-compose.yml`. `backup.sh` syncs them
  to `uploads/` in the backup bucket, which never expires (only `lovestory/` dumps do).
- DNS: `server.yml` (`SiteOnServer=true`) points `<domain>` and `www.` at the static IP.

Costs nothing extra. Lost compared with the decision above: no CDN (slower far from Frankfurt), one
machine for everything (if it is down, so is the site), photos on its 40 GB disk. Back to the plan: ask
AWS again, `SiteOnServer=false`, deploy `app.yml`, copy `DATA_DIR/uploads` into the photo bucket as it is,
switch `STORAGE_DRIVER=s3` and rewrite the stored photo URLs.

## Photo processing: on the API with `sharp`, not Lambda

Uploads already pass through the API (byte validation), so processing happens there; no S3 events or
Lambda. State of the working tree on 2026-11-08 (uncommitted): `server/src/lib/image-variants.ts` makes
two WebP copies per upload: an 800 px thumbnail (grids) and, for big originals, a 2400 px "large" copy
(full-screen viewer and splash; it becomes the photo's `url`). Both are EXIF-rotated and carry no
metadata. The original is kept (`Media.storageKey`). Its address is public (the gallery API returns the key,
and a small photo's original is its `url`), so since 2026-11-22 uploads store it without EXIF/XMP/IPTC
(`server/src/lib/strip-metadata.ts`: JPEG losslessly, keeping only the orientation and the colour profile;
other formats re-encoded). `npm run media:thumbnails` backfills older copies, `npm run media:strip-metadata`
cleans older originals.

Not done yet / still to decide:

- Whether to keep the original at all: it holds GPS and costs storage, but allows remaking the copies.
- Manual crop (for example for the hero photo): the client sends `crop=x,y,w,h`, the server extracts
  from the original with `sharp`.

## AWS resources as code: `infra/`

The AWS side is described in three CloudFormation templates (runbook in
[`infra/README.md`](../infra/README.md)): `certificate.yml` (us-east-1: the ACM certificate, which
CloudFront only reads from there), `server.yml` (eu-central-1: the Lightsail instance with its firewall,
daily snapshots and a launch script that installs Docker, the static IP, the `api.` record, the backup
bucket and its IAM user) and `app.yml` (eu-central-1: the site and photo buckets, both CloudFront
distributions with origin access control, their DNS records and the IAM user for photos). The server is a
separate stack so that the CloudFront side cannot roll it back. The DNS zone, IAM access keys and the app
setup on the server stay outside the templates.

Status on 2026-11-11, account 488571556295: the certificate is issued and the server stack is deployed.
The new account was refused the 2 GB bundle (Support: an account maturity rule, ask again after 2-3 billing
cycles), so the instance is **`micro_3_0`: 1 GB RAM / 2 vCPU / 40 GB / 2 TB, $7 a month** (x86-64).
Measured on it: building both images takes 155 s and peaks at about 810 MB of RAM plus 625 MB of the 2 GB
swap, with no out-of-memory kill; idle, the API uses about 70 MB and Caddy 14 MB. A 24-megapixel test
photo (6000x4000 JPEG, synthetic, 4 MB) uploaded through the live API in 1.2 s; the API container was
sampled at up to about 150 MB during it (coarse: three samples), with no swap growth. A real 15 MB camera
photo and several uploads at once are not measured. Moving to 2 GB later means a new instance
(from a snapshot, or a restore from backup); the fallback if 1 GB is too small before that is EC2
`t4g.small` (about $20 a month). `app.yml` is not deployed: CloudFront refuses new resources until AWS
Support verifies the account. Until then there is no site and no photo bucket.

The API is live at `https://api.lovestory.vin` since 2026-11-11 (checked from outside: Let's Encrypt
certificate, HTTP to HTTPS redirect, `/api/health`, CORS for `https://lovestory.vin`). Temporary settings
in the server's `deploy/.env`: photos on the local disk (`STORAGE_DRIVER=local`, `UPLOADS_DIR=/data/uploads`,
`UPLOADS_PUBLIC_URL=https://api.lovestory.vin/uploads`); photos uploaded now have to be moved and their URLs
updated when S3 arrives. `ACME_EMAIL` is a placeholder (`admin@lovestory.vin`). Since 2026-11-13 the
owner account exists (seeded; its generated password is in `~/owner-password.txt` on the server until the
owner changes it), and `backup.sh` runs nightly at 03:15 UTC from the `ubuntu` crontab, keeping 7 dumps in
`deploy/backups/` on the server (a restore of the first dump passed the integrity check). Each dump is also
uploaded to the backup bucket (checked: the file arrived; the backup user's key, stored in
`~/.aws/credentials` on the server, can write there but cannot list or read). The AWS CLI on the server is
the `aws-cli` snap, so the crontab line sets `PATH` to include `/snap/bin`. The seed also inserted its
sample review ("Anna & Mark"), which should be removed in the admin before the site opens.

The launch script (`UserData`) failed on the first boot: Lightsail appends it to its own `/bin/sh` script,
where `set -o pipefail` is an error. Fixed in `server.yml` (POSIX sh, no shebang); the fixed script was run
by hand on this instance and completed. It has not yet run by itself on a fresh instance. A replaced Lightsail instance starts with an empty disk, so every stack change that replaces
it needs a restore from backup.

## DNS: Route 53 (decided 2026-11-10)

The domain is `lovestory.vin`. The registrar's free DNS showed no ALIAS/ANAME record type (seen: A, CNAME,
MX, TXT, AAAA, SRV, CAA; the end of the list was not checked), which the apex needs to point at CloudFront. The zone is hosted in Route 53
($0.50 a month; zone `Z02752833BHZ9SWEOTA2R`, created with the CLI, not by a stack); the domain stays at
the registrar, only its name servers change. Both templates take an optional `HostedZoneId` and then create
the certificate validation records and the site, `www`, `cdn` and `api` records themselves.

## Email on the domain (decided 2026-11-10)

The owner's mailbox on the site's domain is hosted by **iCloud+ Custom Email Domain** (the owner uses an
iPhone; mail arrives in the built-in Mail app; from $0.99/month in the US, price varies by country; up to
5 domains with 10 addresses each). It is tied to the owner's personal Apple Account. Apple lists the DNS
records to add (MX, SPF, DKIM) during setup; they do not clash with the CloudFront and `api.` records.

### What the site sends its mail through: Amazon SES (set up 2026-11-13)

The site sends through **Amazon SES in eu-central-1** ($0.10 per 1,000 emails), not through the owner's
iCloud mailbox (an application sending to guests needs signed, separately authenticated mail, and iCloud
SMTP is not meant for it). Stack `lovestory-mail` (`infra/mail.yml`): the verified domain `lovestory.vin`
(Easy DKIM, custom MAIL FROM `mail.lovestory.vin`, DMARC in monitoring mode `p=none`; all three checks
show SUCCESS) and an IAM user that may only send as `*@lovestory.vin`. Its key, converted by
`infra/ses-smtp-url.py`, is the `SMTP_URL` in the server's `deploy/.env`, with
`NOTIFY_FROM="LoveStory <info@lovestory.vin>"` and `NOTIFY_EMAIL` = the owner's address. Checked on 2026-11-13
from the API container: messages to the SES mailbox simulator and to the owner's verified address were
accepted (`250 Ok`), and a message with a sender outside the domain was refused (`554 Access denied`). In
the sandbox SES also checks the permission on the recipient's identity, so the user's policy allows any
identity of the account as the resource and limits the sender with `ses:FromAddress`.

The SES SPF record sits on `mail.lovestory.vin`, so the root of the domain stays free for the SPF record
that iCloud asks for; the three DKIM selectors do not clash with iCloud's either.

**The account is in the SES sandbox**: 200 emails a day, 1 a second, and only to verified addresses
(the owner's address is verified since 2026-11-13). So owner notifications work, letters to
guests (review invitations) do not until AWS grants production access. The request is made with
`aws sesv2 put-account-details` (type TRANSACTIONAL, the site address, a contact address; AWS answers
within 96 hours and the details cannot be edited while it is under review), **after the site is
reachable**: `lovestory.vin` itself does not open yet (CloudFront is waiting for AWS to verify the
account), and the request asks for the site address. Guest replies go to the contact email shown on the
site, then to the owner's notification address (`resolveGuestReplyTo`), because `info@lovestory.vin` has no
mailbox until the iCloud domain is set up. Telegram notifications work without any of this.

## Cost (prices checked 2026-11-08, USD, without taxes)

About **$8 per month** on the 1 GB instance ($13 with the planned 2 GB one): Lightsail $7 ($12), Route 53 zone $0.50, S3 a few cents, CloudFront inside the always-free tier
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
