import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Booking } from '@/shared/types';

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
export const useBookings = (status?: string) =>
  useQuery({
    queryKey: ['admin', 'bookings', status ?? 'ALL'],
    queryFn: async () =>
      (await api.get<Booking[]>('/admin/bookings', { params: status ? { status } : {} })).data,
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

async function uploadMediaFile(file: File, category: MediaCategory): Promise<MediaItem> {
  const { data: presigned } = await api.post<{ key: string; uploadUrl: string; publicUrl: string }>(
    '/admin/media/presign',
    { filename: file.name, contentType: file.type, category },
  );
  // Direct browser → S3 upload. Plain fetch (not the `api` axios instance): the presigned URL
  // is a different origin and must not carry our auth cookie/header.
  const put = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!put.ok) throw new Error(`Upload to storage failed (${put.status})`);

  const dims = await imageDimensions(file).catch(() => null);
  const { data: created } = await api.post<MediaItem>('/admin/media', {
    storageKey: presigned.key,
    url: presigned.publicUrl,
    type: 'IMAGE',
    altText: file.name.replace(/\.[^./]+$/, ''),
    category,
    width: dims?.width,
    height: dims?.height,
  });
  return created;
}

export function useMediaActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'media'] });

  const upload = useMutation({
    mutationFn: (vars: { file: File; category: MediaCategory }) =>
      uploadMediaFile(vars.file, vars.category),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<MediaItem> }) =>
      (await api.patch<MediaItem>(`/admin/media/${vars.id}`, vars.patch)).data,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/media/${id}`)).data,
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: async (items: { id: string; sortOrder: number }[]) =>
      (await api.post('/admin/media/reorder', { items })).data,
    onSuccess: invalidate,
  });

  return { upload, update, remove, reorder };
}

// ---- Pricing (rules + add-ons) ----
export type PriceRuleKind = 'BASE' | 'WEEKEND' | 'SEASONAL';
export type AddonUnit = 'PER_STAY' | 'PER_NIGHT' | 'PER_PERSON';

export interface PriceRule {
  id: string;
  name: string;
  kind: PriceRuleKind;
  nightlyRateMinor: number;
  currency: string;
  appliesFrom?: string | null;
  appliesTo?: string | null;
  daysOfWeek: string;
  minNights?: number | null;
  priority: number;
  isActive: boolean;
}

export interface PricingAddon {
  id: string;
  name: string;
  description?: string | null;
  priceMinor: number;
  currency: string;
  unit: AddonUnit;
  isActive: boolean;
  sortOrder: number;
}

export const usePricing = () =>
  useQuery({
    queryKey: ['admin', 'pricing'],
    queryFn: async () =>
      (await api.get<{ rules: PriceRule[]; addons: PricingAddon[] }>('/admin/pricing')).data,
  });

export function usePricingActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'pricing'] });

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

  return { createRule, updateRule, removeRule, createAddon, updateAddon, removeAddon };
}
