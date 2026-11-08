import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { AdminSettings, Booking, Review, ReviewStatus } from '@/shared/types';

export interface CalendarBlock {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  createdAt: string;
}

export interface AdminCalendar {
  confirmed: Pick<Booking, 'id' | 'reference' | 'guestName' | 'guestPhone' | 'status' | 'checkIn' | 'checkOut'>[];
  pending: Pick<Booking, 'id' | 'reference' | 'guestName' | 'guestPhone' | 'status' | 'checkIn' | 'checkOut'>[];
  blocks: CalendarBlock[];
}

// ---- Bookings ----
export type BookingPeriod = 'day' | 'week' | 'month' | 'year';

// status / period are optional filters (period = check-in within the current week / month / year).
// The server returns the list sorted by check-in date.
export const useBookings = (status?: string, period?: BookingPeriod) =>
  useQuery({
    queryKey: ['admin', 'bookings', status ?? 'ALL', period ?? 'ALL'],
    queryFn: async () =>
      (await api.get<Booking[]>('/admin/bookings', { params: { status, period } })).data,
  });

// Number of new (unprocessed) requests, for the sidebar badge. Same query key as the Requests page,
// so both share one cache entry; polled so a request that arrives while the admin is open shows up.
export const usePendingCount = () =>
  useQuery({
    queryKey: ['admin', 'bookings', 'PENDING'],
    queryFn: async () => (await api.get<Booking[]>('/admin/bookings', { params: { status: 'PENDING' } })).data,
    refetchInterval: 60_000,
    select: (rows) => rows.length,
  });

export function useBookingActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'bookings'] });
    qc.invalidateQueries({ queryKey: ['admin', 'calendar'] });
  };

  const confirm = useMutation({
    mutationFn: async (id: string) => (await api.post(`/admin/bookings/${id}/confirm`)).data,
    onSuccess: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: async (vars: {
      id: string;
      status: 'CONFIRMED' | 'DECLINED' | 'CANCELLED';
      internalNotes?: string;
    }) => (await api.patch(`/admin/bookings/${vars.id}/status`, vars)).data,
    onSuccess: invalidate,
  });

  return { confirm, setStatus };
}

// Manager's private note on a booking.
export function useUpdateBookingNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; internalNotes: string | null }) =>
      (await api.patch<Booking>(`/admin/bookings/${vars.id}`, { internalNotes: vars.internalNotes })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'bookings'] }),
  });
}

// Manual booking (phone / walk-in guest). Confirmed by default; priceMinor overrides the quote.
export interface NewBookingInput {
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  guestsCount: number;
  checkIn: string;
  checkOut: string;
  status: 'CONFIRMED' | 'PENDING';
  priceMinor?: number;
  internalNotes?: string;
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewBookingInput) =>
      (
        await api.post<{ booking: Booking; quotedMinor: number; conflictingPendingIds: string[] }>(
          '/admin/bookings',
          input,
        )
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'bookings'] });
      qc.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      qc.invalidateQueries({ queryKey: ['availability'] });
    },
  });
}

// ---- Calendar ----
export const useAdminCalendar = (from: string, to: string) =>
  useQuery({
    queryKey: ['admin', 'calendar', from, to],
    queryFn: async () =>
      (await api.get<AdminCalendar>('/admin/calendar', { params: { from, to } })).data,
  });

export function useBlockActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'calendar'] });

  const create = useMutation({
    mutationFn: async (vars: { startDate: string; endDate: string; reason?: string }) =>
      (await api.post<CalendarBlock>('/admin/calendar/blocks', vars)).data,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/calendar/blocks/${id}`)).data,
    onSuccess: invalidate,
  });

  return { create, remove };
}

// ---- Content (page copy, per locale) ----
export interface ContentBlockRow {
  key: string;
  value: string;
}

export const useContent = (locale: string) =>
  useQuery({
    queryKey: ['admin', 'content', locale],
    queryFn: async () =>
      (
        await api.get<{ locale: string; blocks: ContentBlockRow[] }>('/admin/content', {
          params: { locale },
        })
      ).data,
  });

export function useContentActions() {
  const qc = useQueryClient();
  const invalidate = (locale: string) =>
    qc.invalidateQueries({ queryKey: ['admin', 'content', locale] });

  const save = useMutation({
    mutationFn: async (vars: { locale: string; blocks: { key: string; value: string }[] }) =>
      (await api.put('/admin/content', vars)).data,
    onSuccess: (_data, vars) => invalidate(vars.locale),
  });

  const remove = useMutation({
    mutationFn: async (vars: { key: string; locale: string }) =>
      (
        await api.delete(`/admin/content/${encodeURIComponent(vars.key)}`, {
          params: { locale: vars.locale },
        })
      ).data,
    onSuccess: (_data, vars) => invalidate(vars.locale),
  });

  return { save, remove };
}

// ---- Media (gallery) ----
export type MediaCategory = 'HOUSE' | 'RIVER' | 'BBQ' | 'TUB' | 'NATURE' | 'OTHER';

export interface MediaItem {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  storageKey: string;
  url: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  altText: string;
  category: MediaCategory;
  width?: number | null;
  height?: number | null;
  sortOrder: number;
  isHero: boolean;
  isActive: boolean;
}

export const useMedia = () =>
  useQuery({
    queryKey: ['admin', 'media'],
    queryFn: async () => (await api.get<MediaItem[]>('/admin/media')).data,
  });

// Reads natural width/height client-side so the gallery grid can reserve the right aspect
// ratio before the image loads (avoids layout shift).
function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// Thrown (as `error.code`) when a HEIC file can't be converted; the gallery shows a specific message.
export const HEIC_CONVERT_FAILED = 'HEIC_CONVERT_FAILED';

// Largest photo the server accepts (it answers 413 above this).
// Keep in sync with MAX_UPLOAD_BYTES in server/src/modules/media/media.routes.ts.
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

// Cheap check (no need to load the converter): HEIC/HEIF by MIME type or extension. Windows often
// reports an empty type for .heic. A mislabelled file is still caught by the server's byte check.
const isHeicFile = (f: File) => /^image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);

// Most browsers (everything but Safari) can't display HEIC, so it is converted before upload:
// to WebP (smaller than JPEG), or to JPEG where the browser can't encode WebP (Safari silently
// hands back a PNG then). The converter is a ~3 MB wasm bundle, loaded only when needed.
async function convertHeic(file: File): Promise<File> {
  try {
    const { heicTo } = await import('heic-to');
    let blob = await heicTo({ blob: file, type: 'image/webp', quality: 0.85 });
    if (blob.type !== 'image/webp') blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `${file.name.replace(/\.[^./]+$/, '')}.${ext}`, { type: blob.type });
  } catch (cause) {
    throw Object.assign(new Error('HEIC conversion failed', { cause }), { code: HEIC_CONVERT_FAILED });
  }
}

// Gets a picked file ready to be sent: HEIC/HEIF is converted, anything else is used as it is (the
// server checks the real type). Done when the file is picked, so the page can preview it and report
// a bad file at once; the upload itself only happens on Save.
export const prepareImageFile = (file: File): Promise<File> => (isHeicFile(file) ? convertHeic(file) : Promise.resolve(file));

// The alt text the server gives a new photo: its file name without the extension (same rule as in
// server/src/modules/media/media.routes.ts). A photo whose alt text is edited before saving needs a
// follow-up update only when it differs from this.
export const defaultAltText = (filename: string) =>
  filename.replace(/\.[^./]+$/, '').trim().slice(0, 300) || 'Photo';

// The photo is the raw request body; the API checks it, stores it (local disk or S3, whichever the
// server is configured for) and creates the Media row. `isHero` makes it the home-page splash.
async function uploadMediaFile(file: File, category: MediaCategory, isHero = false): Promise<MediaItem> {
  const dims = await imageDimensions(file).catch(() => null);
  const { data } = await api.post<MediaItem>('/admin/media/upload', file, {
    headers: { 'Content-Type': file.type },
    params: {
      filename: file.name,
      category,
      isHero: isHero || undefined,
      width: dims?.width,
      height: dims?.height,
    },
  });
  return data;
}

// How dark the layer over the home-page splash photo is: 0–100 slider, 80 = the standard darkening.
// One value for all languages.
export const useHeroOverlay = () =>
  useQuery({
    queryKey: ['admin', 'hero-overlay'],
    queryFn: async () => (await api.get<{ value: number }>('/admin/media/hero-overlay')).data.value,
  });

// ---- Saving the gallery page ----
// The gallery page collects every change locally and sends them all when "Save" is pressed: this
// plan says what to send, and runGallerySave does it, step by step.
export interface GallerySavePlan {
  deleteIds: string[];
  // The splash photo: leave it, delete it (back to the default image) or replace it with a new file.
  hero: { kind: 'keep' } | { kind: 'remove'; id: string } | { kind: 'replace'; file: File };
  // New gallery photos. `key` is a page-local id, used by `order`.
  uploads: { key: string; file: File; category: MediaCategory; altText: string; isActive: boolean }[];
  patches: { id: string; patch: Partial<Pick<MediaItem, 'category' | 'altText' | 'isActive'>> }[];
  // Wanted order of the gallery photos that will exist afterwards (server ids and upload keys); null = untouched.
  order: string[] | null;
  overlay: number | null; // null = untouched
}

export interface GallerySaveFailure {
  kind: 'delete' | 'hero' | 'upload' | 'patch' | 'order' | 'overlay';
  name?: string; // file name, for uploads
  error: unknown;
}

// What actually got saved, so the page can drop exactly that from its draft and keep the rest.
export interface GallerySaveReport {
  deleted: string[];
  patched: string[];
  uploaded: string[]; // upload keys
  keyToId: Record<string, string>; // upload key → id of the new photo
  heroDone: boolean;
  orderDone: boolean;
  overlayDone: boolean;
  failures: GallerySaveFailure[];
}

async function runGallerySave(
  plan: GallerySavePlan,
  onProgress?: (done: number, total: number) => void,
): Promise<GallerySaveReport> {
  const report: GallerySaveReport = {
    deleted: [],
    patched: [],
    uploaded: [],
    keyToId: {},
    heroDone: plan.hero.kind === 'keep',
    orderDone: plan.order === null,
    overlayDone: plan.overlay === null,
    failures: [],
  };
  // A new photo with edited details needs one extra request after its upload.
  const needsFollowUp = (u: GallerySavePlan['uploads'][number]) =>
    u.altText !== defaultAltText(u.file.name) || !u.isActive;
  const total =
    plan.deleteIds.length +
    (plan.hero.kind === 'keep' ? 0 : 1) +
    plan.uploads.length +
    plan.uploads.filter(needsFollowUp).length +
    plan.patches.length +
    (plan.order ? 1 : 0) +
    (plan.overlay === null ? 0 : 1);
  let done = 0;
  // One step: a failure is recorded and the rest still runs, so one bad file doesn't lose the other changes.
  const step = async (kind: GallerySaveFailure['kind'], run: () => Promise<void>, name?: string) => {
    try {
      await run();
    } catch (error) {
      report.failures.push({ kind, name, error });
    }
    onProgress?.(++done, total);
  };

  for (const id of plan.deleteIds) {
    await step('delete', async () => {
      await api.delete(`/admin/media/${id}`);
      report.deleted.push(id);
    });
  }

  if (plan.hero.kind === 'remove') {
    const { id } = plan.hero;
    await step('hero', async () => {
      await api.delete(`/admin/media/${id}`);
      report.heroDone = true;
    });
  } else if (plan.hero.kind === 'replace') {
    const { file } = plan.hero; // the server deletes the old splash when the new one arrives
    await step(
      'hero',
      async () => {
        await uploadMediaFile(file, 'OTHER', true);
        report.heroDone = true;
      },
      file.name,
    );
  }

  for (const u of plan.uploads) {
    let created: MediaItem | null = null;
    await step(
      'upload',
      async () => {
        created = await uploadMediaFile(u.file, u.category);
        report.uploaded.push(u.key);
        report.keyToId[u.key] = created.id;
      },
      u.file.name,
    );
    if (created && needsFollowUp(u)) {
      const { id } = created as MediaItem;
      await step(
        'patch',
        async () => {
          await api.patch(`/admin/media/${id}`, { altText: u.altText, ...(u.isActive ? {} : { isActive: false }) });
        },
        u.file.name,
      );
    }
  }

  for (const p of plan.patches) {
    await step('patch', async () => {
      await api.patch(`/admin/media/${p.id}`, p.patch);
      report.patched.push(p.id);
    });
  }

  if (plan.order) {
    const uploadKeys = new Set(plan.uploads.map((u) => u.key));
    // Upload keys become the new photos' ids; a photo whose upload failed has none and is left out.
    const ids = plan.order.flatMap((k) => (uploadKeys.has(k) ? (report.keyToId[k] ? [report.keyToId[k]!] : []) : [k]));
    await step('order', async () => {
      if (ids.length) await api.post('/admin/media/reorder', { items: ids.map((id, i) => ({ id, sortOrder: i })) });
      report.orderDone = true;
    });
  }

  if (plan.overlay !== null) {
    const value = plan.overlay;
    await step('overlay', async () => {
      await api.put('/admin/media/hero-overlay', { value });
      report.overlayDone = true;
    });
  }

  return report;
}

export function useSaveGallery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { plan: GallerySavePlan; onProgress?: (done: number, total: number) => void }) =>
      runGallerySave(vars.plan, vars.onProgress),
    // Refetched before the mutation settles, so the page clears its draft only once the fresh data
    // is in and never flashes the old state.
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['admin', 'media'] }),
        qc.invalidateQueries({ queryKey: ['admin', 'hero-overlay'] }),
        qc.invalidateQueries({ queryKey: ['gallery'] }), // public gallery + splash (if cached in this tab)
      ]),
  });
}

// ---- Pricing (rules + add-ons) ----
export type PriceRuleKind = 'BASE' | 'WEEKEND' | 'SEASONAL' | 'DATES';
export type AddonUnit = 'PER_STAY' | 'PER_NIGHT' | 'PER_PERSON';

export interface PriceRule {
  id: string;
  name: string; // Ukrainian
  nameEn: string; // English
  kind: PriceRuleKind;
  nightlyRateMinor: number;
  currency: string;
  appliesFrom?: string | null;
  appliesTo?: string | null;
  daysOfWeek: string;
  dates?: string; // DATES: CSV of YYYY-MM-DD
  minNights?: number | null;
  priority: number;
  isActive: boolean;
}

export interface PricingAddon {
  id: string;
  name: string; // Ukrainian
  nameEn: string; // English
  description?: string | null;
  descriptionEn?: string | null;
  priceMinor: number;
  currency: string;
  unit: AddonUnit;
  isActive: boolean;
  sortOrder: number;
}

// "What's included in the price" item (shown on the public Prices section).
export interface IncludedItem {
  id: string;
  name: string; // Ukrainian
  nameEn: string; // English
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

export const usePricing = () =>
  useQuery({
    queryKey: ['admin', 'pricing'],
    queryFn: async () =>
      (
        await api.get<{ rules: PriceRule[]; addons: PricingAddon[]; included: IncludedItem[] }>(
          '/admin/pricing',
        )
      ).data,
  });

export function usePricingActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'pricing'] });
    qc.invalidateQueries({ queryKey: ['pricing'] }); // public section
  };

  const createRule = useMutation({
    mutationFn: async (vars: Partial<PriceRule>) =>
      (await api.post<PriceRule>('/admin/pricing/rules', vars)).data,
    onSuccess: invalidate,
  });
  const updateRule = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<PriceRule> }) =>
      (await api.patch<PriceRule>(`/admin/pricing/rules/${vars.id}`, vars.patch)).data,
    onSuccess: invalidate,
  });
  const removeRule = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/pricing/rules/${id}`)).data,
    onSuccess: invalidate,
  });

  const createAddon = useMutation({
    mutationFn: async (vars: Partial<PricingAddon>) =>
      (await api.post<PricingAddon>('/admin/pricing/addons', vars)).data,
    onSuccess: invalidate,
  });
  const updateAddon = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<PricingAddon> }) =>
      (await api.patch<PricingAddon>(`/admin/pricing/addons/${vars.id}`, vars.patch)).data,
    onSuccess: invalidate,
  });
  const removeAddon = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/pricing/addons/${id}`)).data,
    onSuccess: invalidate,
  });

  const createIncluded = useMutation({
    mutationFn: async (vars: Partial<IncludedItem>) =>
      (await api.post<IncludedItem>('/admin/pricing/included', vars)).data,
    onSuccess: invalidate,
  });
  const updateIncluded = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<IncludedItem> }) =>
      (await api.patch<IncludedItem>(`/admin/pricing/included/${vars.id}`, vars.patch)).data,
    onSuccess: invalidate,
  });
  const removeIncluded = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/pricing/included/${id}`)).data,
    onSuccess: invalidate,
  });

  return {
    createRule,
    updateRule,
    removeRule,
    createAddon,
    updateAddon,
    removeAddon,
    createIncluded,
    updateIncluded,
    removeIncluded,
  };
}

// ---- Reviews (moderation) ----
export interface AdminReviews {
  reviews: Review[];
  counts: Record<ReviewStatus, number>;
}

export const useAdminReviews = (status?: ReviewStatus) =>
  useQuery({
    queryKey: ['admin', 'reviews', status ?? 'ALL'],
    queryFn: async () =>
      (await api.get<AdminReviews>('/admin/reviews', { params: status ? { status } : {} })).data,
  });

export function useReviewActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    qc.invalidateQueries({ queryKey: ['reviews'] }); // public list (if cached in this tab)
  };

  const update = useMutation({
    mutationFn: async (vars: { id: string; status?: ReviewStatus; ownerReply?: string | null }) => {
      const { id, ...patch } = vars;
      return (await api.patch<Review>(`/admin/reviews/${id}`, patch)).data;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/reviews/${id}`)).data,
    onSuccess: invalidate,
  });

  return { update, remove };
}

// ---- Settings (owner-only) ----
export const useAdminSettings = () =>
  useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => (await api.get<AdminSettings>('/admin/settings')).data,
  });

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AdminSettings>) =>
      (await api.put<AdminSettings>('/admin/settings', patch)).data,
    onSuccess: (data) => {
      qc.setQueryData(['admin', 'settings'], data);
      qc.invalidateQueries({ queryKey: ['content'] }); // public contacts/map/social links
    },
  });
}

export const useChangePassword = () =>
  useMutation({
    mutationFn: async (vars: { currentPassword: string; newPassword: string }) =>
      (await api.post('/admin/auth/password', vars)).data,
  });
