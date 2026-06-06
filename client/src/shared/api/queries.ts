import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { SiteContent, UnavailableRange } from '@/shared/types';

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
        reviews: any[];
        summary: { count: number; average: number | null };
      },
  });

export const useGallery = () =>
  useQuery({
    queryKey: ['gallery'],
    queryFn: async () => (await api.get('/gallery')).data as any[],
  });

export const useAvailability = (from: string, to: string) =>
  useQuery({
    queryKey: ['availability', from, to],
    queryFn: async () =>
      (await api.get('/availability', { params: { from, to } })).data as {
        unavailable: UnavailableRange[];
      },
  });
