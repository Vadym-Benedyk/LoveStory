# Running the site on a Lightsail instance

What is here: `docker-compose.yml` (Caddy with the built client + API + a `tools` service for one-off
jobs), `Caddyfile`, `.env.example` and `backup.sh`. Why it is built this way, and the cost:
[`docs/deployment-decision.md`](../docs/deployment-decision.md).

Everything runs here for now: the site at `<domain>` (`www.<domain>` redirects to it), the API at
`<domain>/api` and `api.<domain>`, the photos on the server's disk at `<domain>/uploads`. The planned
S3 + CloudFront setup (`infra/app.yml`) waits until AWS lets the account create CloudFront distributions.

## One-time setup

1. Create the instance (Frankfurt, Linux, the 2 GB bundle with a public IPv4; 1 GB works too, see the
   measurements in the decision record) and attach a **static IP**;
   [`infra/`](../infra/README.md) does this, and the rest of the AWS side, with CloudFormation. Firewall:
   80 and 443 open to everyone, SSH (22) key-only (restrict it to your IP if you can).
2. DNS: A records for `<domain>`, `www.<domain>` and `api.<domain>` pointing at the static IP
   (`infra/server.yml` creates them when given the Route 53 zone). Caddy can only get the certificates
   once they resolve, and a release checks the site at `https://<domain>/`.
3. On the server install Docker Engine with the Compose plugin (Docker's official instructions for your
   distribution), `git` and `sqlite3` (for backups); skip this if the server came from `infra/`, its
   launch script installs Docker, git and sqlite3. The AWS CLI is only needed to upload backups to S3.
4. `git clone <repo> /opt/lovestory && cd /opt/lovestory/deploy`
5. `cp .env.example .env` and fill it in (the comments say how). Keep a copy of `.env` in a password
   manager: it is not in git and not in the backups.

## First run

```bash
docker compose build api && docker compose --profile tools build tools && docker compose build caddy   # one at a time: 1 GB of RAM
docker compose run --rm tools npm run prisma:push   # create the schema
docker compose run --rm tools npm run prisma:seed   # owner account + default content, once
docker compose up -d
curl https://<domain>/api/health
curl -I https://<domain>/
```

Then delete `OWNER_PASSWORD` from `.env` and run `docker compose up -d --force-recreate api`.

## Release

**Automatic (normal way):** merge `dev` into `main` and push. GitHub Actions
([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)) runs the checks (types, tests,
client build) and then connects to the server with a deploy key that can only run
[`release.sh`](release.sh): backup, checkout of that commit, build, `prisma:push`, container swap, health
check of the API and the site. A failed step leaves the running containers as they were; the log of each release is in
`~/lovestory-release.log` and in the Actions run. The key, the server address and its host key are secrets
of the `production` environment of the repository, which only `main` may use.

The deploy key's line in `~/.ssh/authorized_keys` (the public half; the private half is only in the
GitHub secret):

```
command="/opt/lovestory/deploy/release.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA... github-actions-lovestory
```

To replace the key: generate a new pair, swap that line, `gh secret set DEPLOY_SSH_KEY --env production`.
`release.sh check` (or `ssh -i <key> ubuntu@<server> check`) tests the connection without deploying.

**By hand** (the same steps, for example when `prisma:push` stopped a release):

```bash
cd /opt/lovestory && git pull && cd deploy
docker compose build api && docker compose --profile tools build tools && docker compose build caddy   # one at a time: 1 GB of RAM
docker compose run --rm tools npm run prisma:push
docker compose up -d
```

The site and the API are unavailable for a few seconds while their containers are replaced. Pages already
open keep working: the client files of earlier releases stay for two weeks (`client/Dockerfile`). If
`prisma:push` refuses a change because it would lose data, stop there: take a backup (below) and decide
by hand, do not force it. One known false alarm: adding a nullable unique column (for example
`Booking.reviewInviteToken`, release of 2026-11-13) makes `prisma:push` warn about a unique constraint;
with the column new and empty nothing can be lost, so `prisma db push --accept-data-loss` is right there. To build elsewhere, set `API_IMAGE` in `.env` and use `docker compose pull api`
on the server instead of `build`. The `tools` and Caddy (client) images are always built on the server
from the checkout.

## Backups and restore

The database and the photos (`data/uploads/`) need a backup. Two layers: Lightsail automatic snapshots
(enable them on the instance: daily, the last 7 are kept: the whole disk, photos included) and a nightly
run of `backup.sh` (a dump of the database, and the new photos copied to S3):

```bash
crontab -e
15 3 * * * /opt/lovestory/deploy/backup.sh >> ~/lovestory-backup.log 2>&1
```

It keeps the last 7 dumps in `deploy/backups/`. To upload each dump and the photos too, install the AWS CLI
(`sudo snap install aws-cli --classic`), put the backup user's key in `~/.aws/credentials`, and set the
bucket in the crontab line (cron does not have `/snap/bin` on its `PATH`):

```bash
15 3 * * * PATH=/usr/bin:/bin:/snap/bin BACKUP_S3_URI=s3://<bucket>/lovestory UPLOADS_S3_URI=s3://<bucket>/uploads /opt/lovestory/deploy/backup.sh >> ~/lovestory-backup.log 2>&1
```

Keep these two prefixes: the bucket from `infra/server.yml` expires old dumps under `lovestory/` (30 days
by default), keeps the photos under `uploads/` (a photo deleted on the site stays there), and lets the
backup user list only `uploads/`.

Restore:

```bash
cd /opt/lovestory/deploy
docker compose stop api
mv data/lovestory.db data/lovestory.db.broken && rm -f data/lovestory.db-*
gunzip -c backups/lovestory-<timestamp>.db.gz > data/lovestory.db
docker compose start api
```

Photos, if the disk is gone and no snapshot will do: `aws s3 sync s3://<bucket>/uploads data/uploads` (it
may hold photos deleted since; they are not shown, as the database no longer lists them).

Try a restore on a spare machine once, before you need it.

## Everyday

- Status and logs: `docker compose ps`, `docker compose logs -f api` (rotated, 3 x 10 MB).
- Photos uploaded before the lighter copies existed: `docker compose run --rm tools npm run media:thumbnails`.
- Originals uploaded before uploads dropped their EXIF/GPS: `docker compose run --rm tools npm run media:strip-metadata` (once is enough; safe to repeat).
- Reset the owner password: `docker compose run --rm tools npm run admin:reset -- <email> '<newPassword>'`.
- Free disk after releases: `docker image prune`.
- Never run `docker compose down -v` here: it deletes the `caddy_data` volume with the certificates.
