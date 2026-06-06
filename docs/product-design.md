# Product & Design — Riverside Guest House

Covers: **sitemap · UX structure · UI concept · booking flow · admin workflow · data/entity model**.
Read [`business-model.md`](./business-model.md) first for the "why". Implementation phasing and
estimates live in [`project-development-plan.md`](./project-development-plan.md).

---

## 1. Sitemap

### Public site (single-page scroll + a few standalone routes)

The landing experience is a **long-scroll single page** (hotel/retreat convention) with anchor
navigation, plus dedicated routes for the heavy interactions.

```
/                       Home (long-scroll: Hero → About → Gallery → Amenities →
                        Promotions → Reviews → Pricing → Location → Booking CTA → Contact/Footer)
/booking                Booking page (full calendar + request form)  ← can also be an in-page section
/gallery                Full gallery (lightbox grid + optional video)  ← in-page section expands here
/#about /#amenities ... Anchor links into the home scroll
/privacy /terms         Legal/content pages (CMS-managed)
```

Rationale: retreat sites convert best as one emotional scroll; but the **calendar + form**
deserve their own focused route (`/booking`) so a "Book now" CTA from anywhere lands on a clean,
distraction-free task surface. The home page still embeds an availability teaser that deep-links
into `/booking` with dates pre-selected.

### Admin (protected, separate route tree, separate bundle)

```
/admin/login            Login
/admin                  Dashboard (today, pending requests count, upcoming arrivals)
/admin/requests         Booking requests inbox (pending) — the daily driver
/admin/calendar         Calendar management (view/block/unblock, confirmed vs pending overlay)
/admin/bookings         All bookings (filter by status)
/admin/content          Page text / section copy editor
/admin/gallery          Media library (upload, reorder, delete; mark video)
/admin/promotions       Promotions CRUD
/admin/pricing          Base / weekday-weekend / seasonal rates + add-ons
/admin/reviews          Review moderation (approve / hide / reply)
/admin/settings         Property details, contact info, account
```

**Architecture decision — protected area inside the same project, separate bundle.**
One repo, one backend API, but the admin SPA is a **separately code-split bundle** under
`/admin/*`, guarded by auth. This is the right call here (not a wholly separate app) because:
the admin and public site share the same data and domain types, deployment stays single-pipeline,
and a one-property owner doesn't need the operational overhead of two apps. The split keeps the
public bundle lean (admin code never ships to guests) and lets us add role-based routing cleanly.

---

## 2. UX structure

### Public — section-by-section intent

| Section | Job to be done | Key UX notes |
|---|---|---|
| **Hero** | Emotional hook + instant "what is this" + CTA | Full-bleed river image/video, one headline line, sub-line, two CTAs: *Check availability* (primary) and *View gallery* (secondary). Sticky-nav appears on scroll. |
| **About** | Build the dream; establish privacy/size/location | Short story copy + 3–4 benefit chips (60 m², direct river access, total privacy, nature). No walls of text. |
| **Gallery** | Prove it's real and beautiful | Masonry/grid, lightbox, lazy-loaded, categories (House / River / BBQ / Tub / Nature). Optional hero video. |
| **Amenities** | Communicate the experiences | Icon cards: Fishing, Open-fire BBQ, Heated bathing tub, Riverside access, Privacy, + comfort features. |
| **Promotions** | Create urgency, raise booking value | Card carousel of active offers; each has title, image, terms, validity window, CTA → booking with promo context. CMS-driven. |
| **Reviews** | Trust = conversion for a remote property | Rating summary + approved review cards (name, rating, date, text). "Leave a review" entry point (moderated). |
| **Pricing** | Remove uncertainty before the form | Clear table: base/weekday/weekend, seasonal note, add-ons. "Prices from X / night." |
| **Location** | Reassure on access; sell the setting | Google Map embed + access/driving notes + nearest-town distance. |
| **Booking** | Convert intent into a request | Availability calendar + date selection + request form. (Detail in §4.) |
| **Contact/Footer** | Fallback channel + trust | Phone, messaging, social, hours, address, legal links. |

### Mobile-first rules (this is a phone-discovery business)

- Single-column by default; multi-column only at `md+`.
- Sticky bottom **"Check availability"** bar on mobile so the CTA is always one tap away.
- Tap targets ≥ 44px; calendar designed for thumb use (large day cells, swipe months).
- Images served responsive (`srcset` / `<picture>`), AVIF/WebP, lazy below the fold.
- Hero video: muted, autoplay only on `md+`/good connection; static poster on mobile.

### Accessibility / quality bars

- WCAG AA contrast (warm palette must still pass on text).
- Full keyboard nav incl. calendar; focus-visible states.
- Semantic landmarks, alt text on all CMS images (alt is a required field on upload).
- Respect `prefers-reduced-motion` for the hero/parallax.

---

## 3. UI concept

**Direction:** premium countryside retreat — warm, natural, elegant, trustworthy. The UI should
feel like linen and warm wood, not a SaaS dashboard.

### Palette (tokens; finalize in MUI theme)

| Token | Value (start) | Use |
|---|---|---|
| `forest` (primary) | `#3E5641` deep green | primary actions, nav accents |
| `clay` / `terracotta` (secondary) | `#B5651D` warm | secondary CTAs, highlights |
| `sand` (background) | `#F5F0E6` | page background, cards |
| `cream` (surface) | `#FBF8F1` | elevated surfaces |
| `bark` (text) | `#2B2620` | body text |
| `river` (accent) | `#5B7E8C` muted blue | links, info, "available" |
| status-available | green-tint | calendar |
| status-pending | amber/clay | calendar |
| status-confirmed | neutral grey-out | calendar (blocked) |

### Type

- **Display/headings:** an elegant serif (e.g., *Cormorant Garamond* / *Playfair Display*) for
  the boutique feel.
- **Body/UI:** a clean humanist sans (e.g., *Inter* / *Work Sans*) for readability.
- Generous line-height and whitespace; large hero type; restrained weight contrast.

### Component language

- Soft, large radii (12–16px), gentle shadows, lots of breathing room.
- Photography is the hero — UI chrome stays quiet. Full-bleed imagery, image-led cards.
- Buttons: filled `forest` primary, outline secondary; never more than one primary per view.
- Micro-interactions subtle (fade/slide on scroll-in), motion-reduced friendly.

### MUI + SCSS modules split (per tech brief)

- **MUI** provides the component system, theming, breakpoints, a11y primitives, and the admin
  data components (tables, forms, dialogs). Theme holds the palette/type/tokens above.
- **SCSS modules** handle page/section-level layout, bespoke marketing visuals (hero, gallery
  masonry, parallax), and anything where MUI's API fights us. Shared design tokens are exported
  from one SCSS `_tokens.scss` *and* the MUI theme, kept in sync via a single source values file.

---

## 4. Booking flow

### Guest happy path

```
1. Guest taps "Check availability" (any CTA / sticky bar)
2. /booking loads → calendar shows months with day states:
      available · unavailable(confirmed) · (pending requests do NOT block the guest view)
3. Guest selects check-in → check-out (range). Client validates:
      - no past dates
      - check-out > check-in
      - range contains no confirmed/blocked day
      - meets min-stay (if rule active)
4. Live price summary appears (nights × applicable rates + chosen add-ons + promo if any)
5. Guest fills request form: name*, phone*, email(opt), guests, comments(opt), consent*
6. Submit → POST creates Booking(status = PENDING)
7. Confirmation screen: "Request received. The owner will call you to confirm. Nothing is
   booked yet." + summary + reference number
8. System notifies admin (email/SMS/Telegram) of the new request
```

### Why a pending request must NOT block the calendar (key logic)

If pending requests blocked dates, a few abandoned/never-answered requests would falsely show
the house as full and kill conversion. So:

- **Public availability = confirmed bookings + admin manual blocks only.**
- **Pending requests are advisory**: multiple guests may request overlapping dates; the admin
  resolves it by phone (first good guest wins) and confirms one. On confirmation, the system
  blocks the dates and the remaining overlapping pending requests are flagged "conflict" for the
  admin to decline.
- A pending request older than N days (configurable, e.g., 7) auto-expires to keep the inbox clean.

### State machine (Booking.status)

```
            submit                admin confirm
 (none) ─────────────▶ PENDING ───────────────▶ CONFIRMED ──┐
                          │                                  │ blocks calendar
                          │ admin decline / expire           │
                          ▼                                  ▼
                       DECLINED / EXPIRED              CANCELLED (admin)
```

- Only `CONFIRMED` (and admin `BLOCK` entries) remove dates from public availability.
- `CANCELLED` re-opens the dates.
- Every transition is timestamped and attributed (audit trail) — matters for disputes.

### Conflict & concurrency rules

- Availability is computed server-side at submit time; the client view is a hint, not the
  source of truth. The POST re-checks against confirmed/blocked ranges and rejects if the range
  is no longer free (race between page-load and submit).
- Confirmation runs inside a DB transaction with a range-overlap check (Postgres `daterange` +
  exclusion constraint, or explicit overlap query + row lock) so two admins/sessions can't
  double-confirm overlapping dates. (Postgres `btree_gist` exclusion constraint is the clean way;
  see data model note.)

---

## 5. Admin workflow

### Daily driver: the Requests inbox

```
New request arrives → admin notified
  → Requests inbox shows PENDING cards: guest, phone, dates, guests, comment, submitted-at,
    + overlap warning if dates clash with another pending/confirmed
  → Admin clicks "Call" (tel: link) → speaks to guest
  → Outcome:
      ✓ Confirm  → status CONFIRMED, dates blocked, guest can be sent confirmation,
                   overlapping pendings auto-flagged "conflict"
      ✗ Decline  → status DECLINED (+ optional reason)
      ⏳ Leave pending / add internal note
```

### Other admin jobs (all by a non-technical owner)

| Area | Actions |
|---|---|
| Calendar | See confirmed (blocked) + pending overlay; manually **block/unblock** dates (maintenance, personal use); drag to multi-select. |
| Bookings | Filter by status; view detail; change status; cancel (reopens dates); add notes. |
| Content | Edit section copy (hero headline, about text, amenity descriptions, contact info) via simple forms / rich-text — no code. |
| Gallery | Upload (drag-drop), set category + alt text, reorder, set hero image, delete; mark a video. |
| Promotions | Create/edit/delete offers: title, body, image, discount, validity window, active toggle. |
| Pricing | Edit base/weekday/weekend rates, add seasonal overrides (date ranges), manage add-ons, min-stay rules. |
| Reviews | Moderate: approve / hide / delete, optional owner reply. Nothing publishes unapproved. |
| Settings | Property details, capacity, contact channels, notification targets, account/password. |

### Admin UX principles

- **Inbox-first**: the dashboard opens on what needs action today (pending requests, today's
  arrivals). The owner shouldn't hunt.
- **Confirm in two clicks** with an explicit, irreversible-feeling confirm dialog (it blocks a
  calendar — make it deliberate).
- Plain language, not jargon ("Block these dates" not "create unavailability record").
- Optimistic UI with clear undo where safe; hard confirms where money/dates are at stake.
- Everything autosaves or has obvious Save; no silent data loss.

### Roles (designed now, one ships in MVP)

- `OWNER` — full access (ships in MVP).
- `MANAGER` — bookings + calendar + reviews, no pricing/settings (future).
- `EDITOR` — content/gallery/promotions only (future).
RBAC is enforced server-side per route; the UI hides what a role can't do.

---

## 6. Data / entity model

Postgres via Prisma. Below is the conceptual model; the authoritative schema lives in
`server/prisma/schema.prisma`. Money stored as integer **minor units** (cents) to avoid float
errors. All tables get `id`, `createdAt`, `updatedAt`.

### Core entities

**User (admin)**
`id, email (unique), passwordHash, name, role (OWNER|MANAGER|EDITOR), isActive, lastLoginAt`

**Booking** — the heart of the system
```
id, reference (human code, unique)
guestName, guestPhone, guestEmail?, guestsCount
checkIn (date), checkOut (date)          // [checkIn, checkOut) half-open
status (PENDING|CONFIRMED|DECLINED|EXPIRED|CANCELLED)
priceQuoteMinor, currency
comments?, internalNotes?
appliedPromotionId? → Promotion
source (WEBSITE|MANUAL)                   // admin can add a booking directly
confirmedAt?, confirmedBy? → User
createdAt, updatedAt
```
*Constraint:* a Postgres exclusion constraint (`btree_gist`) prevents two **CONFIRMED** bookings
from overlapping date ranges. Pending rows are exempt (they don't block).

**CalendarBlock** — admin manual unavailability (maintenance, personal use)
`id, startDate, endDate, reason?, createdBy → User`
Treated like a confirmed booking for availability math.

**BookingAddon** (join) — add-ons chosen on a booking
`id, bookingId → Booking, addonId → Addon, quantity, unitPriceMinor (snapshot)`

### Pricing

**PriceRule** — base + weekday/weekend + seasonal overrides
```
id, name, kind (BASE|WEEKEND|SEASONAL)
nightlyRateMinor, currency
appliesFrom?, appliesTo?        // null for BASE; set for SEASONAL
daysOfWeek?                     // for WEEKEND rule (e.g. [5,6])
minNights?
priority                        // higher wins when ranges overlap
isActive
```
Resolution: for each night, pick the highest-priority active rule whose date/day matches; fall
back to BASE. (Engine lives in a `pricing` domain module — testable in isolation.)

**Addon** — upsell line items
`id, name, description?, priceMinor, currency, unit (PER_STAY|PER_NIGHT|PER_PERSON), isActive, sortOrder`

### Marketing / content

**Promotion**
`id, title, slug, body, imageMediaId? → Media, discountType (PERCENT|FIXED|PACKAGE), discountValue?, validFrom?, validTo?, isActive, sortOrder`

**Review**
`id, authorName, rating (1–5), title?, body, stayMonth?, status (PENDING|APPROVED|HIDDEN), ownerReply?, source (WEBSITE|IMPORTED|SOCIAL), approvedAt?, approvedBy? → User`
*Trust:* only `APPROVED` is public. Social-login collection is a future source; MVP collects via
form + manual moderation.

**Media** — gallery photos + optional video
```
id, type (IMAGE|VIDEO)
storageKey (S3 key), url, thumbnailUrl?
title?, altText (required for IMAGE), category (HOUSE|RIVER|BBQ|TUB|NATURE|OTHER)
width?, height?, durationSec? (video), sortOrder, isHero, isActive
```

**ContentBlock** — editable site copy, key/value with rich text
`id, key (unique, e.g. "hero.headline"), locale, value (text/rich), updatedBy → User`
Keeps marketing copy in DB so the owner edits it; defaults seeded at install.

**SiteSettings** (singleton) — property + contact + integrations
`propertyName, capacity, areaSqm, phone, whatsapp?, email, address, lat, lng, mapEmbed?, notificationEmail, notificationChannels (json), socialLinks (json), currency, timezone`

**AuditLog** (lightweight) — `id, actorId → User, action, entity, entityId, meta(json), createdAt`
For booking-status changes and content edits; cheap insurance for a dispute-prone domain.

### Relationship summary

```
User 1───* Booking (confirmedBy)        Booking *───1 Promotion (applied)
User 1───* CalendarBlock                 Booking 1───* BookingAddon *───1 Addon
User 1───* AuditLog                      Promotion *───1 Media (image)
Media 1───* (referenced by Promotion/ContentBlock)
PriceRule, Addon, Review, ContentBlock, SiteSettings — standalone, admin-managed
```

### Future-proofing for multi-property (designed, not built)

A `Property` table can be introduced later; `Booking`, `CalendarBlock`, `PriceRule`, `Media`,
`Promotion`, `Review`, `ContentBlock` would gain a nullable `propertyId` defaulting to the single
seeded property. Keeping these as first-class tables now (vs hard-coding) is what makes that a
migration, not a rewrite.

---

## 7. API surface (high level)

```
Public (read + create-request only)
  GET  /api/content                       resolved site copy + settings
  GET  /api/gallery                       active media
  GET  /api/amenities                     (static/content-driven)
  GET  /api/promotions                    active promotions
  GET  /api/reviews                       approved reviews + summary
  GET  /api/pricing                       rate rules + add-ons (for quote display)
  GET  /api/availability?from&to          confirmed/blocked ranges (NOT pending)
  POST /api/quote                         {dates, addons, promo} → price breakdown
  POST /api/bookings                      create PENDING request
  POST /api/reviews                       submit review (→ PENDING moderation)

Admin (JWT, role-guarded)
  POST /api/admin/auth/login | logout | me
  GET/PATCH /api/admin/bookings ...       list/filter, change status, confirm, cancel, notes
  GET/POST/DELETE /api/admin/calendar/blocks
  CRUD /api/admin/pricing (rules, addons)
  CRUD /api/admin/promotions
  CRUD /api/admin/reviews (moderate)
  CRUD /api/admin/media (upload via presigned S3, reorder, delete)
  GET/PUT /api/admin/content
  GET/PUT /api/admin/settings
```

Auth: short-lived JWT access token + httpOnly refresh cookie; bcrypt password hashing; rate-limit
on login and on public `POST /bookings` (anti-spam). Validation with Zod on every endpoint.

---

*Next:* [`project-development-plan.md`](./project-development-plan.md) turns this into phases,
a backlog with estimates, risks, MVP scope, and the file structure.*
