# Running the API on a Lightsail instance

What is here: `docker-compose.yml` (Caddy + API + a `tools` service for one-off jobs), `Caddyfile`,
`.env.example` and `backup.sh`. Why it is built this way, and the cost: [`docs/deployment-decision.md`](../docs/deployment-decision.md).
The site itself (S3 + CloudFront) is not part of this; only `api.<domain>` runs here.

## One-time setup

1. Create the instance (Frankfurt, Linux, the 2 GB bundle with a public IPv4) and attach a **static IP**;
   [`infra/`](../infra/README.md) does this, and the rest of the AWS side, with CloudFormation. Firewall:
   80 and 443 open to everyone, SSH (22) key-only (restrict it to your IP if you can).
2. DNS: an A record `api.<domain>` pointing at the static IP.
3. On the server install Docker Engine with the Compose plugin (Docker's official instructions for your
   distribution), `git` and `sqlite3` (for backups); skip this if the server came from `infra/`, its
   launch script installs Docker, git and sqlite3. The AWS CLI is only needed to upload backups to S3.
4. `git clone <repo> /opt/lovestory && cd /opt/lovestory/deploy`
5. `cp .env.example .env` and fill it in (the comments say how). Keep a copy of `.env` in a password
   manager: it is not in git and not in the backups.

## First run

```bash
docker compose build
docker compose run --rm tools npm run prisma:push   # create the schema
docker compose run --rm tools npm run prisma:seed   # owner account + default content, once
docker compose up -d
curl https://api.<domain>/api/health
```

Then delete `OWNER_PASSWORD` from `.env` and run `docker compose up -d --force-recreate api`.

## Release

```bash
cd /opt/lovestory && git pull && cd deploy
docker compose build
docker compose run --rm tools npm run prisma:push
docker compose up -d
```

The API is unavailable for a few seconds while its container is replaced; the site stays up. If
`prisma:push` refuses a change because it would lose data, stop there: take a backup (below) and decide
by hand, do not force it. To build elsewhere, set `API_IMAGE` in `.env` and use `docker compose pull api`
on the server instead of `build`. The `tools` image is always built on the server from the checkout.

## Backups and restore

The database is the only thing that needs a backup (photos are in S3). Two layers: Lightsail automatic
snapshots (enable them on the instance: daily, the last 7 are kept) and a nightly dump with `backup.sh`:

```bash
crontab -e
15 3 * * * /opt/lovestory/deploy/backup.sh >> ~/lovestory-backup.log 2>&1
```

It keeps the last 7 dumps in `deploy/backups/`. Set `BACKUP_S3_URI=s3://<bucket>/<prefix>` in the
crontab line to upload each dump too (and add an S3 lifecycle rule to expire old ones).

Restore:

```bash
cd /opt/lovestory/deploy
docker compose stop api
mv data/lovestory.db data/lovestory.db.broken && rm -f data/lovestory.db-*
gunzip -c backups/lovestory-<timestamp>.db.gz > data/lovestory.db
docker compose start api
```

Try a restore on a spare machine once, before you need it.

## Everyday

- Status and logs: `docker compose ps`, `docker compose logs -f api` (rotated, 3 x 10 MB).
- Photos uploaded before the lighter copies existed: `docker compose run --rm tools npm run media:thumbnails`.
- Reset the owner password: `docker compose run --rm tools npm run admin:reset -- <email> '<newPassword>'`.
- Free disk after releases: `docker image prune`.
- Never run `docker compose down -v` here: it deletes the `caddy_data` volume with the certificates.
