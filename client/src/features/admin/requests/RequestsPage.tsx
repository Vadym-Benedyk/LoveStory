import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { formatMoney, type Booking } from '@/shared/types';
import { useLanguage } from '@/i18n/LanguageContext';
import { OverCapacityChip } from '../OverCapacityChip';

export function RequestsPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'bookings', 'PENDING'],
    queryFn: async () =>
      (await api.get<Booking[]>('/admin/bookings', { params: { status: 'PENDING' } })).data,
  });

  const act = useMutation({
    mutationFn: async (vars: { id: string; status: 'CONFIRMED' | 'DECLINED' }) => {
      if (vars.status === 'CONFIRMED') return (await api.post(`/admin/bookings/${vars.id}/confirm`)).data;
      return (await api.patch(`/admin/bookings/${vars.id}/status`, { status: 'DECLINED' })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'bookings'] });
    },
  });

  if (isLoading) return <Typography>{t('admin.common.loading')}</Typography>;

  return (
    <>
      <Typography variant="h4" gutterBottom>
        {t('admin.requests.title')}
      </Typography>
      {data?.length === 0 && (
        <Typography color="text.secondary">{t('admin.requests.empty')}</Typography>
      )}
      <Grid container spacing={3}>
        {data?.map((b) => (
          <Grid key={b.id} item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="h6">{b.guestName}</Typography>
                <Chip label={b.reference} size="small" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {t('admin.requests.datesGuests', {
                  checkIn: b.checkIn.slice(0, 10),
                  checkOut: b.checkOut.slice(0, 10),
                  count: b.guestsCount,
                })}
                <OverCapacityChip guests={b.guestsCount} />
              </Typography>
              <Typography variant="body2" sx={{ my: 1 }}>
                {t('admin.requests.quote', { amount: formatMoney(b.priceQuoteMinor, b.currency) })}
              </Typography>
              {b.comments && (
                <Box sx={{ bgcolor: 'background.default', p: 1.5, borderRadius: 2, mb: 1 }}>
                  <Typography variant="body2">{b.comments}</Typography>
                </Box>
              )}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                mt={2}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                useFlexGap
                flexWrap="wrap"
              >
                <Button
                  startIcon={<PhoneIcon />}
                  href={`tel:${b.guestPhone}`}
                  variant="outlined"
                  fullWidth
                  sx={{ width: { sm: 'auto' } }}
                >
                  {b.guestPhone}
                </Button>
                <Box sx={{ flex: { sm: 1 } }} />
                <Button
                  color="error"
                  disabled={act.isPending}
                  onClick={() => act.mutate({ id: b.id, status: 'DECLINED' })}
                  fullWidth
                  sx={{ width: { sm: 'auto' } }}
                >
                  {t('admin.requests.decline')}
                </Button>
                <Button
                  variant="contained"
                  disabled={act.isPending}
                  onClick={() => act.mutate({ id: b.id, status: 'CONFIRMED' })}
                  fullWidth
                  sx={{ width: { sm: 'auto' } }}
                >
                  {t('admin.requests.confirmAndBlock')}
                </Button>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
