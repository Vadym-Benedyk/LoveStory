# LoveStory Riverside Retreat

Boutique riverside guest house — a conversion-focused public website plus a protected admin
panel with a **request → manual phone confirmation → calendar block** booking flow.

> Single property, low traffic, cheap to run. Architecture is a TypeScript modular monolith.

## Stack

- **Frontend:** React + Vite + TypeScript, MUI + SCSS Modules (`client/`)
- **Backend:** Node.js + Express + TypeScript, Prisma + **SQLite** (`server/`)
- **Photos:** uploaded from the admin (Gallery) to local disk by default (`server/uploads`); switch to S3-compatible storage (AWS S3 / Cloudflare R2 / MinIO) with `STORAGE_DRIVER=s3` — see `server/.env.example`. Every upload is also resized with `sharp`: an 800 px WebP thumbnail for the grids and a 2400 px WebP for the full-screen viewer and the splash (the original is kept); `npm run media:thumbnails` does the same for photos uploaded earlier
- **Deploy:** single Docker image on an AWS Lightsail instance (persistent disk for the SQLite file); the site and photos on S3 + CloudFront — see [`docs/deployment-decision.md`](docs/deployment-decision.md); compose files, backup script and runbook in [`deploy/`](deploy/README.md); the AWS resources as CloudFormation in [`infra/`](infra/README.md)

## Docs (read these first)

- [`docs/business-model.md`](docs/business-model.md) — concept, segments, revenue, requirements
- [`docs/product-design.md`](docs/product-design.md) — sitemap, UX, UI, booking flow, admin workflow, data model
- [`docs/project-development-plan.md`](docs/project-development-plan.md) — architecture, phases, backlog, estimates, risks, MVP
- [`docs/deployment-decision.md`](docs/deployment-decision.md) — where it runs (Lightsail + S3/CloudFront), why, cost, exit path, known gaps before the first deploy

## Quickstart

```bash
# 1. install (npm workspaces)
npm install

# 2. configure env
cp server/.env.example server/.env
cp client/.env.example client/.env

# 3. create the SQLite DB from the schema, then seed it
npm run migrate   # prisma db push — creates server/prisma/dev.db
npm run seed

# 4. run both apps
npm run dev
# client → http://localhost:5173   api → http://localhost:4000
# admin  → http://localhost:5173/admin

# Gallery uploads work out of the box (saved to server/uploads).
# (optional) local S3 (MinIO) to try STORAGE_DRIVER=s3:
# npm run storage:up
```

> No database server to start — SQLite is just a file (`server/prisma/dev.db`).
> Schema changes are applied with `npm run db:sync` (Prisma `db push`).

## Repo layout

```
client/   React + Vite + MUI + SCSS (public site + code-split admin bundle)
server/   Express + Prisma API (domain modules); SQLite db at prisma/dev.db
docs/     planning & design documentation
docker-compose.yml   optional local MinIO (S3) for trying STORAGE_DRIVER=s3
```

## Booking model (the one rule to remember)

Pending requests **never** block the calendar. Only an **admin-confirmed** booking (or a manual
calendar block) removes dates from public availability. See `docs/product-design.md` §4.
