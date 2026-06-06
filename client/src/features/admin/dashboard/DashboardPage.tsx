import { Grid, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Booking } from '@/shared/types';

export function DashboardPage() {
  const { data: bookings } = useQuery({
    queryKey: ['admin', 'bookings'],
    queryFn: async () => (await api.get<Booking[]>('/admin/bookings')).data,
  });

  const pending = bookings?.filter((b) => b.status === 'PENDING').length ?? 0;
  const confirmed = bookings?.filter((b) => b.status === 'CONFIRMED').length ?? 0;
  const upcoming =
    bookings?.filter((b) => b.status === 'CONFIRMED' && new Date(b.checkIn) >= new Date()).length ?? 0;

  const cards = [
    { label: 'Pending requests', value: pending, hint: 'Call to confirm' },
    { label: 'Confirmed bookings', value: confirmed, hint: 'Total' },
    { label: 'Upcoming arrivals', value: upcoming, hint: 'From today' },
  ];

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Today
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
