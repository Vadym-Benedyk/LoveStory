# Business Model — Riverside Guest House

> Working brand name: **LoveStory Riverside Retreat** (placeholder, configurable in CMS).
> This document describes the business concept, who it serves, how it makes money, and the
> functional requirements that the software must satisfy. It is the "why" behind the build.

---

## 1. Concept in one sentence

A single, private 60 m² guest house on an isolated riverbank, rented by the day to couples,
families, and small groups who want nature, privacy, fishing, fire-cooking, and a heated
outdoor bathing tub — booked online, confirmed personally by the owner over the phone.

## 2. Product

| Attribute | Detail |
|---|---|
| Unit | One standalone house, 60 m² |
| Capacity | Couples → small group (working assumption: up to 4–6 guests; confirm in CMS) |
| Rental model | Whole-house, per-night daily rent (not per-room) |
| Location | Quiet, isolated riverside; direct river access |
| Signature amenities | Fishing spot, BBQ/open-fire grill area, heated outdoor bathing tub |
| Positioning | Boutique countryside retreat — premium but natural, not a budget cabin |

The differentiator is **exclusivity + the three "experience" amenities**. Anyone can rent a
room; few can offer "your own stretch of river, a fire to cook on, and a hot tub under the sky."
The marketing and the pricing both lean on that.

## 3. Target segments

1. **Couples / romantic escapes** — the highest-margin segment. They book weekends, value
   privacy and the hot tub, respond to "romantic package" promotions. The folder name
   (*LoveStory*) suggests this is the primary brand angle.
2. **Families** — book longer stays (school holidays), value safety, space, and outdoor
   activities (fishing, fire-cooking) for kids.
3. **Small friend groups / anglers** — fishing-led trips, mid-week availability, repeat
   bookings in season.

Each segment maps to a promotion type (romantic package, family stay, fishing weekend) so the
Promotions module is a direct revenue lever, not decoration.

## 4. Value proposition

- **For the guest:** total privacy, immersion in nature, and three experiences that turn a
  stay into an event — without the logistics of owning a riverside property.
- **For the owner:** a direct-booking channel that avoids OTA commissions (Booking.com /
  Airbnb take 15–20%), keeps the guest relationship personal, and lets the owner vet guests
  by phone before committing dates.

## 5. Revenue model

| Stream | Description |
|---|---|
| Core accommodation | Per-night rate. Supports **seasonal** and **weekday/weekend** pricing. |
| Extra services (upsell) | Firewood bundles, fishing gear, late checkout, welcome basket, etc. — modeled as add-ons in pricing. |
| Packages / promotions | Bundled discounts (romantic weekend, fishing 3-night, holiday) that raise average booking value and fill low-demand dates. |
| Direct-booking margin | By owning the booking flow, ~15–20% otherwise lost to OTAs is retained. |

**Pricing rules the system must support**
- Base nightly rate.
- Weekday vs weekend rate.
- Seasonal rate overrides (date-range based).
- Minimum-stay rules (e.g., 2 nights on weekends/holidays) — *should-have*, flag in plan.
- Add-on line items with their own prices.

## 6. The booking philosophy (critical business rule)

This is **not** an instant-booking business. The owner deliberately confirms every reservation
by phone. Reasons, and why the software is built around it:

1. **Guest vetting** — a private isolated property; the owner wants a human conversation first.
2. **Operational reality** — turnover cleaning, firewood, heating the tub all need lead time.
3. **Trust** — for a high-value private stay, guests *expect* a personal call; it reinforces
   the boutique positioning rather than feeling like a limitation.

Therefore the lifecycle is: **available → pending (request submitted) → confirmed (after call) →
dates blocked**. Dates are only removed from public availability once the owner confirms. A
pending request never blocks the calendar for other visitors — but the admin sees overlapping
pending requests so they can resolve conflicts on the phone. (Edge cases are detailed in the
product-design and development-plan docs.)

## 7. Success metrics (what "working" means for the business)

| Metric | Why it matters |
|---|---|
| Request-to-confirmation rate | Measures lead quality; low rate = pricing or expectations mismatch |
| Direct bookings vs OTA | The whole point — track shift away from commissioned channels |
| Average booking value | Promotions/add-ons should raise this over time |
| Occupancy by season | Drives where promotions are aimed |
| Review volume & rating | Trust is the conversion engine for a remote private property |

## 8. Functional requirements derived from the business model

These requirements flow directly from the model above and bind the technical build:

1. **Conversion-first public site** — emotional storytelling, gallery, trust signals
   (reviews), clear pricing, friction-light request flow. Mobile-first (most discovery is
   on a phone).
2. **Request-not-book flow** — capture name + phone + dates + comments; never auto-confirm.
3. **Manual confirmation workflow** — admin reviews requests, calls guest, confirms/declines;
   only confirmation blocks the calendar.
4. **Owner-editable content** — text, gallery, promotions, pricing, reviews, optional video
   must all be editable by a non-technical owner, with no developer involvement.
5. **Trustworthy reviews** — moderated; only owner-approved reviews are published.
6. **Seasonal/weekend pricing + add-ons** — pricing must be data-driven, not hard-coded.
7. **Location clarity** — map widget + access notes (the property is remote; guests need this).
8. **Single property today, extensible tomorrow** — model data so a second property could be
   added later without a rewrite (see "future enhancements" in the dev plan). Not built now.

## 9. Constraints & assumptions

- **Single property** for the MVP. Multi-property is a future enhancement, not in scope.
- **One owner/admin** initially; role-based access is designed for but only "owner" role ships
  in MVP.
- **Phone-based confirmation** is intentional and permanent — not a temporary stopgap.
- **No online payment** in MVP. Payment is handled offline at/after confirmation. (Online
  deposits are a clearly-scoped future enhancement.)
- **Legal/operational items** (cancellation policy, deposit terms, house rules) are content the
  owner manages; the software surfaces them but does not enforce them in MVP.

---

*Related docs:* [`product-design.md`](./product-design.md) (sitemap, UX, UI, booking flow,
admin workflow, data model) and [`project-development-plan.md`](./project-development-plan.md)
(architecture, phases, backlog, estimates, risks, MVP).
