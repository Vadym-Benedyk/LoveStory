import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import type { Booking, BookingStatus } from '@/shared/types';
import { usePrice } from '@/shared/usePrice';
import { useLanguage } from '@/i18n/LanguageContext';
import { useBookings, useBookingActions } from '../api';
import { OverCapacityChip } from '../OverCapacityChip';

const STATUS_FILTERS: { value: string; key: string }[] = [
  { value: 'ALL', key: 'admin.bookings.filter.all' },
  { value: 'PENDING', key: 'admin.bookings.filter.pending' },
  { value: 'CONFIRMED', key: 'admin.bookings.filter.confirmed' },
  { value: 'DECLINED', key: 'admin.bookings.filter.declined' },
  { value: 'CANCELLED', key: 'admin.bookings.filter.cancelled' },
  { value: 'EXPIRED', key: 'admin.bookings.filter.expired' },
];

const statusChip: Record<BookingStatus, 'default' | 'success' | 'warning' | 'error'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  DECLINED: 'error',
  CANCELLED: 'default',
  EXPIRED: 'default',
};

export function BookingsPage() {
  const { t } = useLanguage();
  const price = usePrice();
  const [filter, setFilter] = useState('ALL');
  const { data, isLoading } = useBookings(filter === 'ALL' ? undefined : filter);
  const { confirm, setStatus } = useBookingActions();

  const busy = confirm.isPending || setStatus.isPending;

  const renderActions = (b: Booking) => {
    if (b.status === 'PENDING') {
      return (
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button
            size="small"
            color="error"
            disabled={busy}
            onClick={() => setStatus.mutate({ id: b.id, status: 'DECLINED' })}
          >
            {t('admin.bookings.decline')}
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={busy}
            onClick={() => confirm.mutate(b.id)}
          >
            {t('admin.bookings.confirm')}
          </Button>
        </Stack>
      );
    }
    if (b.status === 'CONFIRMED') {
      return (
        <Button
          size="small"
          color="error"
          disabled={busy}
          onClick={() => setStatus.mutate({ id: b.id, status: 'CANCELLED' })}
        >
          {t('admin.bookings.cancel')}
        </Button>
      );
    }
    return null;
  };

  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={2}
        mb={3}
      >
        <Typography variant="h4">{t('admin.bookings.title')}</Typography>
        <TextField
          select
          size="small"
          label={t('admin.bookings.status')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          {STATUS_FILTERS.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {t(s.key)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {isLoading ? (
        <Typography>{t('admin.common.loading')}</Typography>
      ) : (data?.length ?? 0) === 0 ? (
        <Typography color="text.secondary">{t('admin.bookings.empty')}</Typography>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.bookings.col.ref')}</TableCell>
                <TableCell>{t('admin.bookings.col.guest')}</TableCell>
                <TableCell>{t('admin.bookings.col.dates')}</TableCell>
                <TableCell>{t('admin.bookings.col.guests')}</TableCell>
                <TableCell>{t('admin.bookings.col.quote')}</TableCell>
                <TableCell>{t('admin.bookings.col.status')}</TableCell>
                <TableCell align="right">{t('admin.bookings.col.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.map((b) => (
                <TableRow key={b.id} hover>
                  <TableCell>{b.reference}</TableCell>
                  <TableCell>
                    <Box>{b.guestName}</Box>
                    <Button
                      size="small"
                      startIcon={<PhoneIcon fontSize="small" />}
                      href={`tel:${b.guestPhone}`}
                      sx={{ px: 0, minWidth: 0, textTransform: 'none' }}
                    >
                      {b.guestPhone}
                    </Button>
                  </TableCell>
                  <TableCell>
                    {b.checkIn.slice(0, 10)} → {b.checkOut.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    {b.guestsCount}
                    <OverCapacityChip guests={b.guestsCount} />
                  </TableCell>
                  <TableCell>{price.format(b.priceQuoteMinor)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={b.status} color={statusChip[b.status]} />
                  </TableCell>
                  <TableCell align="right">{renderActions(b)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
