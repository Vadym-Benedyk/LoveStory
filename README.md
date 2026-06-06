# LoveStory Riverside Retreat

Boutique riverside guest house — a conversion-focused public website plus a protected admin
panel with a **request → manual phone confirmation → calendar block** booking flow.

> Single property, low traffic, cheap to run. Architecture is a TypeScript modular monolith.

## Stack

- **Frontend:** React + Vite + TypeScript, MUI + SCSS Modules (`client/`)
- **Backend:** Node.js + Express + TypeScript, Prisma + PostgreSQL (`server/`)
- **Storage:** S3-compatible (Cloudflare R2 / AWS S3 / MinIO locally)
- **Deploy:** single Docker image → any cheap Docker host (Railway / Render / VPS)

## Docs (read these first)

- [`docs/business-model.md`](docs/business-model.md) — concept, segments, revenue, requirements
- [`docs/product-design.md`](docs/product-design.md) — sitemap, UX, UI, booking flow, admin workflow, data model
- [`docs/project-development-plan.md`](docs/project-development-plan.md) — architecture, phases, backlog, estimates, risks, MVP

## Quickstart

```bash
# 1. install (npm workspaces)
npm install

# 2. start local Postgres (+ MinIO)
npm run db:up

# 3. configure env
cp server/.env.example server/.env
cp client/.env.example client/.env

# 4. migrate + seed
npm run migrate
npm run seed

# 5. run both apps
npm run dev
# client → http://localhost:5173   api → http://localhost:4000
# admin  → http://localhost:5173/admin
```

## Repo layout

```
client/   React + Vite + MUI + SCSS (public site + code-split admin bundle)
server/   Express + Prisma API (domain modules)
docs/     planning & design documentation
docker-compose.yml   local Postgres + MinIO
```

## Booking model (the one rule to remember)

Pending requests **never** block the calendar. Only an **admin-confirmed** booking (or a manual
calendar block) removes dates from public availability. See `docs/product-design.md` §4.
