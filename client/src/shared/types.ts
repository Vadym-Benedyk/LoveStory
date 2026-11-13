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
  // Review invitation (sent after check-out) and the review it produced, if any.
  reviewInviteToken?: string | null;
  reviewInvitedAt?: string | null;
  reviewInviteChannel?: 'EMAIL' | 'TELEGRAM' | 'MANUAL' | null;
  review?: { id: string; status: ReviewStatus; rating: number } | null;
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

// GET /gallery. The home-page splash and the gallery photos are kept apart: `hero` is the single
// splash photo (null → built-in default image) and is never part of `photos`.
// `heroOverlay` (0–100, 80 = standard) is how dark the layer over the splash is (see shared/hero.ts).
export interface GalleryResponse {
  hero: GalleryMedia | null;
  photos: GalleryMedia[];
  heroOverlay: number;
}

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'HIDDEN';

// Public shape (GET /reviews): approved only, no moderation fields.
export interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  title?: string | null;
  body: string;
  stayMonth?: string | null; // "YYYY-MM" for invited reviews, free text for imported ones
  ownerReply?: string | null;
  createdAt: string;
  verified?: boolean; // came through the invitation link of a real stay
}

// Admin shape (GET /admin/reviews).
export interface Review extends PublicReview {
  status: ReviewStatus;
  source: string;
  approvedAt?: string | null;
  bookingId?: string | null;
  booking?: { reference: string; checkIn: string; checkOut: string } | null;
}

// Public shape of a review invitation (GET /reviews/invite/:token).
export interface ReviewInvite {
  state: 'OPEN' | 'USED' | 'EXPIRED';
  propertyName: string;
  guestFirstName: string;
  checkIn: string;
  checkOut: string;
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
  notifyToSiteEmail: boolean;
  socialLinks: SocialLinks;
}


