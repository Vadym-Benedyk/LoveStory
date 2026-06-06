-- Last line of defense against double-booking: no two CONFIRMED bookings may overlap.
-- Uses a btree_gist exclusion constraint over the half-open date range [checkIn, checkOut).
-- Run AFTER the Prisma-generated migration that creates the Booking table.
-- (Prisma cannot express this, so it lives as a manual migration — see product-design.md §6.)

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT booking_no_overlap_confirmed
  EXCLUDE USING gist (
    daterange("checkIn", "checkOut", '[)') WITH &&
  )
  WHERE (status = 'CONFIRMED');
