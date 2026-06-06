# Project Development Plan — Riverside Guest House

> **This file is the developer-facing implementation plan and lives inside the project at
> `docs/project-development-plan.md`.** It extends the client brief; it does not replace it.
> Companion docs: [`business-model.md`](./business-model.md), [`product-design.md`](./product-design.md).

Audience: the development team. It assumes the architecture decisions below are settled and tells
you what to build, in what order, with rough effort and dependencies.

Estimates are in **engineering hours** for one mid/senior full-stack developer, and are
deliberately rough (±30%). Convert to story points at your team's velocity if you prefer.

---

## A. Architecture

### Stack (locked)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **React + Vite + TypeScript** | Per brief. SPA, code-split public vs admin bundles. |
| UI system | **MUI v5** + **SCSS Modules** | MUI = component system/theme/a11y/admin tables. SCSS modules = layout + bespoke marketing visuals. |
| Backend | **Node.js + Express + TypeScript** | Modular monolith (domain modules), not microservices. |
| ORM/DB | **Prisma + PostgreSQL** | Postgres for transactional date-range integrity (`btree_gist` exclusion constraint). |
| Auth | **JWT (access) + httpOnly refresh cookie**, bcrypt | Role-based, server-enforced. |
| Validation | **Zod** | Shared schemas, every endpoint + forms. |
| Media | **S3-compatible object storage** | AWS S3 **or** Cloudflare R2 / Backblaze B2 / MinIO — presigned uploads. |
| Email/notify | Transactional email (Resend/Postmark/SES) + optional Telegram/SMS | Admin new-request alerts. |

### Why a modular monolith (not serverless, not microservices)

For a single-property booking site the booking-conflict logic needs transactional integrity and
row/range locking against Postgres — clean in a long-lived process, awkward with serverless
connection churn. Microservices add ops cost with zero benefit at this scale. One deployable
Express app with clear internal **domain modules** (`booking`, `pricing`, `media`, `content`,
`reviews`, `promotions`, `auth`) gives separation without distribution pain. If a module ever
needs to scale out, the seams are already there.

### Deployment (cheap & portable — not tied to any cloud)

The whole backend is a single **Docker image**, so deploy to whatever is cheapest:

| Option | When | Rough cost |
|---|---|---|
| **Railway / Render / Fly.io** (PaaS) | Fastest to ship MVP; managed Postgres add-on; zero infra work | ~$5–20/mo |
| **Single VPS** (Hetzner / DigitalOcean) + Docker Compose | Cheapest at steady state; you run Postgres in a container or managed | ~$5–12/mo |
| **AWS App Runner + RDS** | If the client later wants AWS specifically | higher |

Recommended MVP path: **Railway or a Hetzner VPS** with managed/containerized Postgres, object
storage on **Cloudflare R2** (no egress fees), static frontend on the same host or Cloudflare
Pages + CDN. Everything is env-var driven so moving hosts is a config change, not a rewrite.

### Runtime topology

```
Browser ── HTTPS ──▶ [ Reverse proxy (Caddy/Traefik, auto-TLS) ]
                         ├─▶ Static React build (public + admin bundles, CDN-cacheable)
                         └─▶ Express API (Docker) ──▶ PostgreSQL
                                                  └──▶ S3/R2 (media, presigned)
                                                  └──▶ Email/Telegram (notifications)
```

---

## B. Implementation phases

Each phase: **objective · deliverables · dependencies · exit criteria**.

### Phase 1 — Discovery & technical planning
- **Objective:** lock scope, stack, and these docs; set up repo + tooling.
- **Deliverables:** this plan, monorepo skeleton, lint/format/CI, env strategy, decision log.
- **Dependencies:** none.
- **Exit:** repo builds empty client+server; CI green; team agrees on MVP scope (§E).

### Phase 2 — Architecture & database design
- **Objective:** finalize Prisma schema, migrations, seed, domain module boundaries.
- **Deliverables:** `schema.prisma`, first migration, seed script (settings, base price, sample
  content), exclusion constraint for confirmed-booking overlap, domain folder structure.
- **Dependencies:** P1.
- **Exit:** `prisma migrate` runs clean; seed populates a working dataset; overlap constraint
  proven with a test that rejects double-confirm.

### Phase 3 — UI/UX & component planning
- **Objective:** MUI theme (palette/type/tokens), SCSS token bridge, shared layout/components,
  responsive grid, base storybook-ish component shells.
- **Deliverables:** theme, design tokens (single source → MUI + SCSS), `<Section>`, `<Button>`
  usage, nav/footer, mobile sticky CTA, image component.
- **Dependencies:** P1 (P2 in parallel).
- **Exit:** themed shell renders on mobile + desktop; tokens consistent; a11y baseline passes.

### Phase 4 — Public website implementation
- **Objective:** all public sections wired to API (read paths).
- **Deliverables:** Hero, About, Gallery+lightbox, Amenities, Promotions, Reviews, Pricing,
  Location (map), Contact/Footer; content from API; SEO/meta; performance budget met.
- **Dependencies:** P2 (data), P3 (components).
- **Exit:** Lighthouse mobile ≥ 90 perf/SEO/a11y; all sections data-driven; no hard-coded copy.

### Phase 5 — Admin panel implementation
- **Objective:** protected admin shell + auth + CRUD scaffolding.
- **Deliverables:** login, JWT/refresh, route guards, admin layout/nav, dashboard, generic
  CRUD patterns (tables, forms, dialogs) for the content modules.
- **Dependencies:** P2.
- **Exit:** owner can log in; protected routes enforced server+client; CRUD works for at least
  promotions + content as the pattern.

### Phase 6 — Booking & calendar logic (core)
- **Objective:** the heart — availability, request, manual confirmation, conflict handling.
- **Deliverables:** availability service, public calendar + range select, quote engine, request
  form + POST, admin requests inbox, confirm/decline transitions, manual block/unblock,
  status state machine, overlap/expiry rules, audit log.
- **Dependencies:** P2, P4 (public shell), P5 (admin shell).
- **Exit:** end-to-end: guest requests → admin confirms → dates block publicly; double-confirm
  rejected; pending never blocks; expiry job runs. Covered by integration tests.

### Phase 7 — CMS / content management
- **Objective:** make everything owner-editable.
- **Deliverables:** content editor, media library (presigned upload, reorder, alt text, delete,
  hero/video), promotions CRUD, pricing editor (base/weekend/seasonal/add-ons/min-stay),
  review moderation, settings.
- **Dependencies:** P5, P6 (shares admin patterns + media used by promotions/gallery).
- **Exit:** a non-technical user can change every public-facing piece without a deploy.

### Phase 8 — Integrations & notifications
- **Objective:** close the loop with the owner and the map.
- **Deliverables:** new-request notification (email + optional Telegram/SMS), confirmation
  email to guest (optional), Google Maps embed, rate-limiting/anti-spam, analytics hook.
- **Dependencies:** P6.
- **Exit:** owner reliably alerted on new request; map renders; spam controls verified.

### Phase 9 — QA & bug fixing
- **Objective:** harden.
- **Deliverables:** unit tests (pricing, availability state machine), integration tests
  (booking lifecycle), E2E happy paths (Playwright), cross-device/browser pass, a11y audit,
  security pass (authz, input validation, file-upload safety).
- **Dependencies:** P4–P8.
- **Exit:** test suite green in CI; no P0/P1 bugs; security checklist signed off.

### Phase 10 — Deployment & release prep
- **Objective:** ship.
- **Deliverables:** Dockerfiles, compose/CI deploy pipeline, prod env + secrets, DB backups,
  domain + TLS, monitoring/error tracking (Sentry), runbook + owner admin guide, seed prod data.
- **Dependencies:** P9.
- **Exit:** production live on chosen host; backups + monitoring on; owner trained; rollback path.

### Phase dependency graph

```
P1 ─▶ P2 ─▶ P4 ─┐
   └─▶ P3 ─▶ P4  ├─▶ P6 ─▶ P7 ─▶ P8 ─▶ P9 ─▶ P10
        P2 ─▶ P5 ┘        ▲
                          └ P6 also depends on P5
```

---

## C. Development backlog (epics → tasks → subtasks → estimates)

> Convention: every task lists **subtasks** and a **rough estimate (hours)** and **deps**.
> IDs (E#/T#) are for cross-reference.

### Epic E1 — Project foundation & tooling
**T1.1 Initialize monorepo & tooling** — *deps: none* — **6–8h**
- init root workspace (npm workspaces), `/client` `/server` `/docs`
- ESLint + Prettier + EditorConfig + commit hooks (husky/lint-staged)
- shared TS config base, path aliases
- `.env.example` files + env loading strategy
- basic GitHub Actions CI (install, lint, typecheck, build)

**T1.2 Docker & local dev** — *deps: T1.1* — **5–7h**
- `docker-compose` for Postgres (+ optional MinIO for local S3)
- server Dockerfile (multi-stage), client build Dockerfile
- Makefile/npm scripts: `dev`, `db:up`, `migrate`, `seed`
- README quickstart

### Epic E2 — Database & domain core
**T2.1 Prisma schema & migrations** — *deps: T1.2* — **8–12h**
- model all entities (User, Booking, CalendarBlock, BookingAddon, PriceRule, Addon,
  Promotion, Review, Media, ContentBlock, SiteSettings, AuditLog)
- enums + indexes; money as integer minor units
- enable `btree_gist`; exclusion constraint on CONFIRMED booking date ranges
- first migration; verify up/down

**T2.2 Seed & fixtures** — *deps: T2.1* — **4–6h**
- seed SiteSettings, base PriceRule, default ContentBlocks, owner user, sample
  promotions/reviews/media placeholders
- factory helpers for tests

**T2.3 Domain module skeleton + shared libs** — *deps: T2.1* — **6–8h**
- module folders (`auth`, `booking`, `pricing`, `media`, `content`, `promotions`, `reviews`)
- Zod schema layer, error types, result/response helpers
- request validation + central error handler middleware
- logger, config module

### Epic E3 — Authentication & admin security
**T3.1 Auth backend** — *deps: T2.3* — **8–10h**
- bcrypt password hashing; login endpoint
- JWT access + httpOnly refresh cookie; refresh/rotate; logout
- auth middleware + RBAC guard (role per route)
- rate-limit login; lockout/backoff
- tests for authz matrix

**T3.2 Admin auth frontend** — *deps: T3.1, T5.1* — **5–7h**
- login page (MUI form + Zod)
- auth context, token refresh, route guards
- 401/expiry handling + redirect
- "me" bootstrap

### Epic E4 — Public website
**T4.1 Theme & design tokens** — *deps: T1.1* — **8–10h**
- MUI theme (palette, typography, breakpoints, component overrides)
- SCSS `_tokens.scss` generated from single source; verify parity
- global styles, fonts, motion/reduced-motion baseline

**T4.2 Layout, nav, footer, mobile CTA** — *deps: T4.1* — **6–8h**
- responsive AppShell, sticky nav on scroll, anchor nav
- footer (contact, social, legal links)
- mobile sticky "Check availability" bar
- reusable `<Section>`, container, scroll-reveal

**T4.3 Hero + About** — *deps: T4.2, T2.2* — **6–8h**
- full-bleed hero (image/video, poster, CTAs), content from API
- About section + benefit chips
- responsive image component (srcset/webp/avif, lazy)

**T4.4 Gallery + lightbox (+ optional video)** — *deps: T4.2, T6media or T7.2* — **8–10h**
- masonry/grid, category filter, lazy load
- accessible lightbox (keyboard, focus trap)
- optional promo video embed
- consumes Media API

**T4.5 Amenities + Promotions + Reviews** — *deps: T4.2, T2.2* — **8–10h**
- amenity icon cards (fishing, BBQ, tub, river, privacy…)
- promotions carousel from API (validity-aware)
- reviews: rating summary + approved cards from API

**T4.6 Pricing + Location** — *deps: T4.2, T2.2, T8.x map* — **6–8h**
- pricing table (base/weekday/weekend/seasonal note, add-ons) from API
- Google Maps embed + access notes from settings

**T4.7 SEO, meta, performance pass** — *deps: T4.3–T4.6* — **5–7h**
- meta/OG tags, sitemap.xml, robots, favicons
- image optimization, code-split, Lighthouse ≥ 90 mobile

### Epic E5 — Admin shell & generic CRUD
**T5.1 Admin app shell** — *deps: T1.1* — **6–8h**
- code-split `/admin/*` bundle, admin layout/nav, dashboard skeleton
- protected routing wiring (with T3.2)

**T5.2 Reusable admin CRUD kit** — *deps: T5.1* — **8–10h**
- data table (sort/filter/paginate), form builder (MUI + Zod), confirm dialogs,
  toast/snackbar, optimistic update + error states
- API client with auth + error normalization

**T5.3 Dashboard** — *deps: T5.2, T6.5* — **5–7h**
- today's arrivals, pending-requests count + quick links, recent activity (audit)

### Epic E6 — Booking & calendar (core)
**T6.1 Availability service (backend)** — *deps: T2.1* — **8–10h**
- compute booked/blocked ranges (CONFIRMED + CalendarBlock), exclude pending
- `GET /availability?from&to`; efficient range query
- helpers shared with confirm/quote
- unit tests incl. edge ranges (adjacent, half-open)

**T6.2 Quote/pricing engine (backend)** — *deps: T2.1* — **8–12h**
- per-night rate resolution (base/weekend/seasonal by priority)
- add-ons (per stay/night/person), promo application, min-stay validation
- `POST /quote` → breakdown; pure, fully unit-tested

**T6.3 Booking request submission** — *deps: T6.1, T6.2* — **8–12h**
- `POST /bookings`: validate dates, re-check availability server-side, snapshot price,
  create PENDING, generate reference, fire notification (→ E8)
- rate-limit/anti-spam; error/success contract

**T6.4 Public calendar + request form (frontend)** — *deps: T6.1, T6.2, T6.3, T4.2* — **12–16h**
- calendar UI: month nav, day states (available/unavailable), range select, mobile thumb-friendly
- live quote summary, add-on selection, promo context
- request form (name/phone/email/guests/comments/consent) + Zod validation
- submit → confirmation screen ("nothing booked yet") + reference
- error/conflict handling (range taken on submit)

**T6.5 Admin requests inbox + confirmation** — *deps: T6.3, T5.2* — **12–16h**
- pending requests list (guest, phone tel:, dates, overlap warning)
- confirm (transactional, blocks dates, flags overlapping pendings as conflict),
  decline (+reason), notes
- status state machine enforcement + audit log entries
- explicit confirm dialog

**T6.6 Admin calendar management** — *deps: T6.1, T6.5, T5.2* — **8–10h**
- calendar view: confirmed (blocked) + pending overlay
- manual block/unblock (range select), reasons
- cancel booking → reopen dates

**T6.7 Booking lifecycle jobs & rules** — *deps: T6.3, T6.5* — **5–7h**
- pending auto-expiry (configurable N days)
- overlap-conflict detection on confirm
- scheduled job runner (node-cron) + idempotency

### Epic E7 — CMS / content management
**T7.1 Content editor** — *deps: T5.2* — **8–10h**
- list/edit ContentBlocks (hero, about, amenities copy, contact), rich-text where needed
- `GET/PUT /admin/content`; cache invalidation on save

**T7.2 Media library** — *deps: T5.2, S3 config* — **12–16h**
- presigned S3/R2 upload (direct from browser), thumbnail generation
- grid manage: category, alt text (required for images), reorder (drag), hero flag, video flag, delete
- `CRUD /admin/media`; safe file-type/size validation

**T7.3 Promotions management** — *deps: T5.2, T7.2* — **6–8h**
- CRUD: title/body/image/discount/validity/active/sort; image picker from Media

**T7.4 Pricing management** — *deps: T5.2, T6.2* — **8–10h**
- edit base/weekend rates; add seasonal overrides (date ranges, priority); min-stay
- add-ons CRUD; live preview of resolved nightly price

**T7.5 Review moderation** — *deps: T5.2* — **6–8h**
- queue (PENDING/APPROVED/HIDDEN), approve/hide/delete, owner reply
- public submit endpoint feeds the queue

**T7.6 Settings** — *deps: T5.2* — **5–7h**
- property details, capacity, contact channels, map coords/embed, notification targets,
  account/password change

### Epic E8 — Integrations & notifications
**T8.1 Admin new-request notifications** — *deps: T6.3* — **6–8h**
- transactional email provider integration; template
- optional Telegram bot / SMS channel; configurable targets
- retry/failure logging

**T8.2 Guest-facing emails (optional)** — *deps: T6.3, T6.5* — **4–6h**
- "request received" + "confirmed" templates (opt-in)

**T8.3 Maps + analytics + anti-spam** — *deps: T4.6* — **4–6h**
- Google Maps embed config; privacy-friendly analytics (Plausible/GA)
- captcha/honeypot + rate-limit on public POSTs

### Epic E9 — QA & hardening
**T9.1 Automated tests** — *deps: E6, E7* — **14–20h**
- unit: pricing engine, availability, state machine
- integration: booking lifecycle (request→confirm→block, double-confirm reject, expiry)
- E2E (Playwright): guest happy path + admin confirm path

**T9.2 Cross-device, a11y, security pass** — *deps: E4–E8* — **10–14h**
- responsive/browser matrix; Lighthouse + axe a11y; authz/input/file-upload security review

**T9.3 Bug-fix buffer** — *deps: T9.1, T9.2* — **12–16h**

### Epic E10 — Deployment & release
**T10.1 Production infra & pipeline** — *deps: E9* — **8–12h**
- prod Dockerfiles, host setup (Railway/VPS), reverse proxy + TLS, env/secrets
- CI/CD deploy, DB migrations on release, object-storage bucket + CORS

**T10.2 Backups, monitoring, error tracking** — *deps: T10.1* — **5–7h**
- automated Postgres backups + restore test; Sentry; uptime check; log aggregation

**T10.3 Launch docs & owner training** — *deps: T10.1* — **5–7h**
- admin user guide (non-technical), runbook, rollback procedure, seed prod content

**Rough total:** ~**330–430 h** full build; **MVP subset ~170–220 h** (see §E).

---

## D. Recommended delivery order

1. **E1 foundation** → **E2 DB/domain** (everything depends on these).
2. **E4.1–E4.2 theme/shell** in parallel with E2.
3. **E3 auth** + **E5 admin shell** (unlocks all admin work).
4. **E6 booking core** — the highest-risk, highest-value epic; do it early once shells exist,
   not last. (Real-world: teams that leave booking logic for the end always slip.)
5. **E4.3–E4.7 public sections** (can overlap E6; they're lower-risk).
6. **E7 CMS** (depends on admin patterns + media).
7. **E8 integrations**.
8. **E9 QA** continuous, intensifying at the end.
9. **E10 deploy**.

Critical path: **E1 → E2 → E6 → E9 → E10.** Protect E6; it gates launch.

---

## E. MVP scope

### Must-have (launch)
- Public site: Hero, About, Gallery (images), Amenities, Pricing, Location (map), Contact.
- Booking: availability calendar (confirmed/blocked vs available), date select, quote display,
  request form, PENDING creation, confirmation screen.
- Admin: secure login, requests inbox, **manual confirm/decline**, calendar block/unblock,
  basic content editing, media upload/delete, pricing (base + weekend), review moderation,
  settings.
- New-request notification to owner (email).
- Core integrity: pending never blocks; only confirmed blocks; double-confirm prevented.

### Should-have (fast follow)
- Promotions module on site + admin.
- Seasonal pricing + add-ons + min-stay rules.
- Gallery video; promo video on home.
- Guest confirmation emails; Telegram/SMS notifications.
- Pending auto-expiry job; audit log UI.
- Public review-submission form.

### Future enhancements
- Online deposit/payment + deposit-on-confirm.
- Social-login review collection / external review import.
- Multi-property support (`Property` table + scoping).
- Multi-language (i18n) site.
- Channel-manager sync (iCal import/export with Airbnb/Booking.com).
- Manager/Editor roles in UI; finer RBAC.

---

## F. File / project structure

```
LoveStory/
├─ docs/
│  ├─ business-model.md
│  ├─ product-design.md
│  └─ project-development-plan.md      ← this file
├─ client/                            # React + Vite + MUI + SCSS
│  ├─ src/
│  │  ├─ app/                         # router, providers, theme bootstrap
│  │  ├─ theme/                       # MUI theme + design tokens (source of truth)
│  │  ├─ styles/                      # global SCSS, _tokens.scss, mixins
│  │  ├─ shared/                      # ui components, hooks, api client, utils, types
│  │  ├─ features/
│  │  │  ├─ public/                   # marketing site
│  │  │  │  ├─ home/ hero/ about/ gallery/ amenities/
│  │  │  │  ├─ promotions/ reviews/ pricing/ location/ contact/
│  │  │  │  └─ booking/               # calendar + request form
│  │  │  └─ admin/                    # code-split admin bundle
│  │  │     ├─ auth/ dashboard/ requests/ calendar/ bookings/
│  │  │     ├─ content/ gallery/ promotions/ pricing/ reviews/ settings/
│  │  └─ main.tsx
│  ├─ index.html  vite.config.ts  tsconfig.json
├─ server/                            # Node + Express + TS + Prisma
│  ├─ prisma/
│  │  ├─ schema.prisma  migrations/  seed.ts
│  ├─ src/
│  │  ├─ config/  lib/ (logger, errors, zod, mailer, storage)
│  │  ├─ middleware/ (auth, rbac, validate, error-handler, rate-limit)
│  │  ├─ modules/                     # domain modules (route+controller+service+schema)
│  │  │  ├─ auth/ booking/ availability/ pricing/ media/
│  │  │  ├─ content/ promotions/ reviews/ settings/ audit/
│  │  ├─ jobs/                        # cron (expiry)
│  │  ├─ app.ts  server.ts  routes.ts
│  ├─ tests/ (unit, integration, e2e helpers)
│  ├─ Dockerfile  tsconfig.json
├─ docker-compose.yml                 # Postgres (+ MinIO for local S3)
├─ .github/workflows/ci.yml
├─ package.json (workspaces)  .editorconfig  .gitignore  README.md
```

Public/admin separation: same backend API, two URL trees (`/api/*` vs `/api/admin/*`,
`/` vs `/admin/*`), admin code-split so it never ships in the public bundle, RBAC enforced
server-side. Domain/API separation: each backend module owns its routes, validation, and
business logic; controllers stay thin, services hold the rules, Prisma is the only data layer.

---

## G. Risks & assumptions

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| **Date-conflict / double-confirm logic** | double-booking the only unit = worst outcome | Postgres `btree_gist` exclusion constraint + transactional confirm + integration tests. Treat as the #1 correctness target. |
| **Pending-vs-confirmed semantics misunderstood** | calendar shows wrong availability | Documented state machine (product-design §4); pending never blocks; explicit tests. |
| **Pricing rule ambiguity** (overlaps, holidays, min-stay) | wrong quotes, owner distrust | Priority-based resolution, pure engine, snapshot price on booking; confirm rules with owner before P6. |
| **Review moderation/trust** | fake/abusive reviews published | Default PENDING, owner-only approval; rate-limit + honeypot on submit. |
| **Media requirements drift** (video, formats, volume) | rework | Abstract storage behind one interface; presigned uploads; Media table already supports image+video. |
| **Admin usability for non-technical owner** | owner won't use it → defeats purpose | Inbox-first dashboard, plain language, explicit confirms, training + guide in P10. |
| **Notification deliverability** (owner misses a request) | lost bookings | Multi-channel (email + Telegram), retry+log, dashboard fallback so requests never depend solely on email. |
| **Scope creep to multi-property/payments** | timeline blowout | Designed-for but explicitly out of MVP (§E); data model leaves room. |
| **SEO/perf on image-heavy site** | poor discovery/conversion | Performance budget, responsive images, CDN, Lighthouse gate in P4. |

### Assumptions
- Single property, single owner-admin at launch.
- Confirmation is **always** manual by phone (permanent business rule, not interim).
- No online payment in MVP; money handled offline.
- Owner provides real photos/video, copy, exact map location, pricing, and legal text.
- One currency, one timezone, one primary language at launch (i18n later).
- Hosting is the team's choice optimized for cost (any Docker host); no cloud mandate.
- Capacity (guest count) and house rules to be confirmed with owner during P1.

---

## H. Final developer summary

- **Architecture:** TypeScript modular monolith — Express + Prisma + PostgreSQL backend, React +
  Vite + MUI + SCSS frontend with code-split public/admin bundles, single Docker image deployable
  to the cheapest available host (Railway/VPS), S3-compatible object storage, JWT+RBAC auth.
- **Main modules:** `booking` + `availability` + `pricing` (core), `auth`, `media`, `content`,
  `promotions`, `reviews`, `settings`, `audit`.
- **Development order:** foundation → DB/domain → auth + admin shell + theme → **booking core**
  → public sections → CMS → integrations → QA → deploy. Build booking early, not last.
- **MVP delivery path (~170–220h):** runnable site that informs and converts + a request→manual-
  confirm→calendar-block loop the owner can operate, with owner-editable content/pricing/media
  and email alerts. Promotions, seasonal pricing, video, extra notification channels follow fast.
- **Critical dependencies:** P2 schema (esp. the overlap exclusion constraint) and P3/P5 shells
  gate the booking epic; the booking epic gates launch (E1→E2→E6→E9→E10).
- **Expected complexity hotspots:** (1) availability + transactional confirmation under
  concurrency, (2) pricing resolution across base/weekend/seasonal/add-ons/min-stay,
  (3) presigned media uploads + thumbnails, (4) keeping the admin genuinely simple for a
  non-technical owner. Budget extra QA time on (1) and (2).

> **Reminder:** this plan is stored in the project at `docs/project-development-plan.md` and is
> the living source of truth for implementation. Update it as scope evolves.
