// Shared frontend types. Mirror the server contracts; tighten as the API stabilizes.

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';

export interface UnavailableRange {
  start: string;
  end: string;
  kind: 'BOOKING' | 'BLOCK';
}

export interface QuoteNight {
  date: string;
  rateMinor: number;
  ruleName: string;
}

export interface Quote {
  nights: number;
  nightly: QuoteNight[];
  accommodationMinor: number;
  addonsMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  minNights: number | null;
  meetsMinNights: boolean;
}

export interface Booking {
  id: string;
  reference: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string | null;
  guestsCount: number;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  priceQuoteMinor: number;
  currency: string;
  comments?: string | null;
  internalNotes?: string | null;
  createdAt: string;
}

export type MediaCategory = 'HOUSE' | 'RIVER' | 'BBQ' | 'TUB' | 'NATURE' | 'OTHER';

export interface GalleryMedia {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  altText: string;
  category: MediaCategory;
  isHero: boolean;
  sortOrder: number;
}

export interface SiteContent {
  copy: Record<string, string>;
  settings: {
    propertyName: string;
    areaSqm: number;
    capacity: number;
    phone: string;
    email: string;
    address: string;
    mapEmbed?: string | null;
  } | null;
}

export const formatMoney = (minor: number, currency = 'USD') =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).format(minor / 100);
