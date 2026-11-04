import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { GalleryMedia, PublicReview, SiteContent, UnavailableRange } from '@/shared/types';

export const useSiteContent = () =>
  useQuery({
    queryKey: ['content'],
    queryFn: async () => (await api.get<SiteContent>('/content')).data,
  });

export const usePricing = () =>
  useQuery({
    queryKey: ['pricing'],
    queryFn: async () => (await api.get('/pricing')).data as { rules: any[]; addons: any[] },
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

export interface ExchangeRates {
  base: string;
  source: 'NBU';
  date: string; // YYYY-MM-DD
  uahPer: Record<string, number>; // UAH per 1 unit of each currency
}

// Official NBU rates via our API (cached server-side). Display-only; a failure just means
// prices are shown in the base currency.
export const useExchangeRates = () =>
  useQuery({
    queryKey: ['exchange-rates'],
    queryFn: async () => (await api.get<ExchangeRates>('/exchange-rates')).data,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

export const useGallery = () =>
  useQuery({
    queryKey: ['gallery'],
    queryFn: async () => (await api.get<GalleryMedia[]>('/gallery')).data,
  });

export const useAvailability = (from: string, to: string) =>
  useQuery({
    queryKey: ['availability', from, to],
    queryFn: async () =>
      (await api.get('/availability', { params: { from, to } })).data as {
        unavailable: UnavailableRange[];
      },
  });
