-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'EDITOR');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('WEBSITE', 'MANUAL');

-- CreateEnum
CREATE TYPE "PriceKind" AS ENUM ('BASE', 'WEEKEND', 'SEASONAL');

-- CreateEnum
CREATE TYPE "AddonUnit" AS ENUM ('PER_STAY', 'PER_NIGHT', 'PER_PERSON');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED', 'PACKAGE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('WEBSITE', 'IMPORTED', 'SOCIAL');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaCategory" AS ENUM ('HOUSE', 'RIVER', 'BBQ', 'TUB', 'NATURE', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "guestEmail" TEXT,
    "guestsCount" INTEGER NOT NULL DEFAULT 2,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "source" "BookingSource" NOT NULL DEFAULT 'WEBSITE',
    "priceQuoteMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "comments" TEXT,
    "internalNotes" TEXT,
    "appliedPromotionId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarBlock" (
    "id" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PriceKind" NOT NULL,
    "nightlyRateMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "appliesFrom" DATE,
    "appliesTo" DATE,
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "minNights" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Addon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "unit" "AddonUnit" NOT NULL DEFAULT 'PER_STAY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Addon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAddon" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceMinor" INTEGER NOT NULL,

    CONSTRAINT "BookingAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageMediaId" TEXT,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENT',
    "discountValue" INTEGER,
    "validFrom" DATE,
    "validTo" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "stayMonth" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "source" "ReviewSource" NOT NULL DEFAULT 'WEBSITE',
    "ownerReply" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "title" TEXT,
    "altText" TEXT NOT NULL DEFAULT '',
    "category" "MediaCategory" NOT NULL DEFAULT 'OTHER',
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHero" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBlock" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "value" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "propertyName" TEXT NOT NULL DEFAULT 'LoveStory Riverside Retreat',
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "areaSqm" INTEGER NOT NULL DEFAULT 60,
    "phone" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT,
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "mapEmbed" TEXT,
    "notificationEmail" TEXT NOT NULL DEFAULT '',
    "notificationChannels" JSONB NOT NULL DEFAULT '{}',
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE INDEX "Booking_status_checkIn_checkOut_idx" ON "Booking"("status", "checkIn", "checkOut");

-- CreateIndex
CREATE INDEX "Booking_createdAt_idx" ON "Booking"("createdAt");

-- CreateIndex
CREATE INDEX "CalendarBlock_startDate_endDate_idx" ON "CalendarBlock"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "BookingAddon_bookingId_idx" ON "BookingAddon"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_slug_key" ON "Promotion"("slug");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Media_category_isActive_sortOrder_idx" ON "Media"("category", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ContentBlock_key_locale_key" ON "ContentBlock"("key", "locale");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_appliedPromotionId_fkey" FOREIGN KEY ("appliedPromotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAddon" ADD CONSTRAINT "BookingAddon_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAddon" ADD CONSTRAINT "BookingAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_imageMediaId_fkey" FOREIGN KEY ("imageMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
