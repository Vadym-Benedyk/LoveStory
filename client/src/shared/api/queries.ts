import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import { useLanguage } from '@/i18n/LanguageContext';
import type { GalleryResponse, PublicReview, SiteContent, UnavailableRange } from '@/shared/types';

// Editable site copy comes in the current site language (ContentBlock per locale).
export const useSiteContent = () => {
  const { lang } = useLanguage();
  return useQuery({
    queryKey: ['content', lang],
    queryFn: async () => (await api.get<SiteContent>('/content', { params: { locale: lang } })).data,
  });
};

// Public price list: tariffs, paid extras and the "what's included" list (names in both languages).
export interface PublicRule {
  id: string;
  name: string;
  nameEn: string;
  kind: 'BASE' | 'WEEKEND' | 'SEASONAL' | 'DATES';
  nightlyRateMinor: number;
  currency: string;
  appliesFrom?: string | null;
  appliesTo?: string | null;
  daysOfWeek: string;
  dates?: string;
  minNights?: number | null;
  priority: number;
}
export interface PublicAddon {
  id: string;
  name: string;
  nameEn: string;
  description?: string | null;
  descriptionEn?: string | null;
  priceMinor: number;
  currency: string;
  unit: 'PER_STAY' | 'PER_NIGHT' | 'PER_PERSON';
}
export interface PublicIncluded {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
}

export const usePricing = () =>
  useQuery({
    queryKey: ['pricing'],
    queryFn: async () =>
      (await api.get<{ rules: PublicRule[]; addons: PublicAddon[]; included: PublicIncluded[] }>('/pricing')).data,
  });

export const useReviews = () =>
  useQuery({
    queryKey: ['reviews'],
    queryFn: async () =>
      (await api.get('/reviews')).data as {
        reviews: PublicReview[];
        summary: { count: number; average: number | null };
      },
  });

export const useGallery = () =>
  useQuery({
    queryKey: ['gallery'],
    queryFn: async () => (await api.get<GalleryResponse>('/gallery')).data,
  });

export const useAvailability = (from: string, to: string) =>
  useQuery({
    queryKey: ['availability', from, to],
    queryFn: async () =>
      (await api.get('/availability', { params: { from, to } })).data as {
        unavailable: UnavailableRange[];
      },
  });
