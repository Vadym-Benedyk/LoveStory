import { Grid, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { formatMoney, type Booking } from '@/shared/types';

const nights = (a: string, b: string) =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));

export function StatisticsPage() {
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
  const currency = bookings[0]?.currency ?? 'USD';

  const stats = [
    { label: 'Confirmed revenue', value: formatMoney(revenueMinor, currency) },
    { label: 'Confirmed bookings', value: confirmed.length },
    { label: 'Pending requests', value: pending.length },
    { label: 'Nights booked', value: nightsBooked },
    { label: 'Avg. stay (nights)', value: avgStay ? avgStay.toFixed(1) : '—' },
    { label: 'Request → confirm rate', value: `${conversion}%` },
  ];

  if (isLoading) return <Typography>Loading…</Typography>;

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Statistics
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
        Computed from current booking data. Add date-range filters and charts (e.g. occupancy by
        month) as a fast follow — see docs/project-development-plan.md.
      </Typography>
    </>
  );
}
