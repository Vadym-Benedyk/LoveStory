import { Grid, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Booking } from '@/shared/types';
import { usePrice } from '@/shared/usePrice';
import { useLanguage } from '@/i18n/LanguageContext';

const nights = (a: string, b: string) =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));

export function StatisticsPage() {
  const { t } = useLanguage();
  const price = usePrice();
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['admin', 'bookings'],
    queryFn: async () => (await api.get<Booking[]>('/admin/bookings')).data,
  });

  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED');
  const pending = bookings.filter((b) => b.status === 'PENDING');
  const decided = bookings.filter((b) => b.status !== 'PENDING' && b.status !== 'EXPIRED');

  const revenueMinor = confirmed.reduce((s, b) => s + b.priceQuoteMinor, 0);
  const nightsBooked = confirmed.reduce((s, b) => s + nights(b.checkIn, b.checkOut), 0);
  const avgStay = confirmed.length ? nightsBooked / confirmed.length : 0;
  const conversion = decided.length
    ? Math.round((confirmed.length / decided.length) * 100)
    : 0;

  const stats = [
    { label: t('admin.statistics.confirmedRevenue'), value: price.format(revenueMinor) },
    { label: t('admin.statistics.confirmedBookings'), value: confirmed.length },
    { label: t('admin.statistics.pendingRequests'), value: pending.length },
    { label: t('admin.statistics.nightsBooked'), value: nightsBooked },
    { label: t('admin.statistics.avgStay'), value: avgStay ? avgStay.toFixed(1) : '—' },
    { label: t('admin.statistics.conversion'), value: `${conversion}%` },
  ];

  if (isLoading) return <Typography>{t('admin.common.loading')}</Typography>;

  return (
    <>
      <Typography variant="h4" gutterBottom>
        {t('admin.statistics.title')}
      </Typography>
      <Grid container spacing={3}>
        {stats.map((s) => (
          <Grid key={s.label} item xs={12} sm={6} md={4}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, height: '100%' }}>
              <Typography variant="overline" color="text.secondary">
                {s.label}
              </Typography>
              <Typography variant="h3">{s.value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        {t('admin.statistics.footnote')}
      </Typography>
    </>
  );
}
