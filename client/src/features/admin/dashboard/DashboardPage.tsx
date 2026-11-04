import { Grid, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Booking } from '@/shared/types';
import { useLanguage } from '@/i18n/LanguageContext';

export function DashboardPage() {
  const { t } = useLanguage();
  const { data: bookings } = useQuery({
    queryKey: ['admin', 'bookings'],
    queryFn: async () => (await api.get<Booking[]>('/admin/bookings')).data,
  });

  const pending = bookings?.filter((b) => b.status === 'PENDING').length ?? 0;
  const confirmed = bookings?.filter((b) => b.status === 'CONFIRMED').length ?? 0;
  const upcoming =
    bookings?.filter((b) => b.status === 'CONFIRMED' && new Date(b.checkIn) >= new Date()).length ?? 0;

  const cards = [
    { label: t('admin.dashboard.pendingRequests'), value: pending, hint: t('admin.dashboard.pendingHint') },
    { label: t('admin.dashboard.confirmedBookings'), value: confirmed, hint: t('admin.dashboard.confirmedHint') },
    { label: t('admin.dashboard.upcomingArrivals'), value: upcoming, hint: t('admin.dashboard.upcomingHint') },
  ];

  return (
    <>
      <Typography variant="h4" gutterBottom>
        {t('admin.dashboard.title')}
      </Typography>
      <Grid container spacing={3}>
        {cards.map((c) => (
          <Grid key={c.label} item xs={12} sm={4}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="overline" color="text.secondary">
                {c.label}
              </Typography>
              <Typography variant="h3">{c.value}</Typography>
              <Typography variant="body2" color="text.secondary">
                {c.hint}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
