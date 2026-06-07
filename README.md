# LoveStory Riverside Retreat

Boutique riverside guest house — a conversion-focused public website plus a protected admin
panel with a **request → manual phone confirmation → calendar block** booking flow.

> Single property, low traffic, cheap to run. Architecture is a TypeScript modular monolith.

## Stack

- **Frontend:** React + Vite + TypeScript, MUI + SCSS Modules (`client/`)
- **Backend:** Node.js + Express + TypeScript, Prisma + **SQLite** (`server/`)
- **Storage:** S3-compatible (Cloudflare R2 / AWS S3 / MinIO locally) — optional, for gallery
- **Deploy:** single Docker image → any cheap Docker host (Railway / Render / VPS) with a persistent disk for the SQLite file

## Docs (read these first)

- [`docs/business-model.md`](docs/business-model.md) — concept, segments, revenue, requirements
- [`docs/product-design.md`](docs/product-design.md) — sitemap, UX, UI, booking flow, admin workflow, data model
- [`docs/project-development-plan.md`](docs/project-development-plan.md) — architecture, phases, backlog, estimates, risks, MVP

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

# (optional) local S3 for gallery uploads:
# npm run storage:up
```

> No database server to start — SQLite is just a file (`server/prisma/dev.db`).
> Schema changes are applied with `npm run db:sync` (Prisma `db push`).

## Repo layout

```
client/   React + Vite + MUI + SCSS (public site + code-split admin bundle)
server/   Express + Prisma API (domain modules); SQLite db at prisma/dev.db
docs/     planning & design documentation
docker-compose.yml   optional local MinIO (S3) for gallery uploads
```

## Booking model (the one rule to remember)

Pending requests **never** block the calendar. Only an **admin-confirmed** booking (or a manual
calendar block) removes dates from public availability. See `docs/product-design.md` §4.
