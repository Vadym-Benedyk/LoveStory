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
  source?: 'WEBSITE' | 'MANUAL';
  priceQuoteMinor: number;
  currency: string;
  comments?: string | null;
  internalNotes?: string | null;
  confirmedAt?: string | null;
  confirmedBy?: { name: string; email: string } | null;
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

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'HIDDEN';

// Public shape (GET /reviews): approved only, no moderation fields.
export interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  title?: string | null;
  body: string;
  stayMonth?: string | null;
  ownerReply?: string | null;
  createdAt: string;
}

// Admin shape (GET /admin/reviews).
export interface Review extends PublicReview {
  status: ReviewStatus;
  source: string;
  approvedAt?: string | null;
}

export interface SiteContent {
  copy: Record<string, string>;
  settings: {
    propertyName: string;
    areaSqm: number;
    capacity: number;
    phone: string;
    whatsapp?: string | null;
    email: string;
    address: string;
    mapEmbedUrl: string | null; // validated Google Maps embed URL (never raw HTML)
    socialLinks: SocialLinks;
  } | null;
}

export type SocialNetwork = 'instagram' | 'tiktok';
export type SocialLinks = Partial<Record<SocialNetwork, string>>;

// Admin Settings form (GET/PUT /admin/settings).
export interface AdminSettings {
  capacity: number;
  phone: string;
  email: string;
  address: string;
  mapEmbed: string;
  mapEmbedValid?: boolean; // server-computed; read-only
  notificationEmail: string;
  socialLinks: SocialLinks;
}


