import { useFormatDate } from '@/i18n/DateLocaleProvider';
import { useMemo, useState } from 'react';
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
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import NotesIcon from '@mui/icons-material/StickyNote2Outlined';
import type { Booking, BookingStatus } from '@/shared/types';
import { usePrice } from '@/shared/usePrice';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/shared/ui/ToastProvider';
import { useBookings, useBookingActions, type BookingPeriod } from '../api';
import { NewBookingButton } from './NewBookingButton';
import { BookingDetailsDrawer } from './BookingDetailsDrawer';

const STATUS_FILTERS: { value: string; key: string }[] = [
  { value: 'ALL', key: 'admin.bookings.filter.all' },
  { value: 'PENDING', key: 'admin.bookings.filter.pending' },
  { value: 'CONFIRMED', key: 'admin.bookings.filter.confirmed' },
  { value: 'DECLINED', key: 'admin.bookings.filter.declined' },
  { value: 'CANCELLED', key: 'admin.bookings.filter.cancelled' },
  { value: 'EXPIRED', key: 'admin.bookings.filter.archived' },
];

const PERIOD_FILTERS: { value: BookingPeriod | 'ALL'; key: string }[] = [
  { value: 'day', key: 'admin.bookings.period.day' },
  { value: 'week', key: 'admin.bookings.period.week' },
  { value: 'month', key: 'admin.bookings.period.month' },
  { value: 'year', key: 'admin.bookings.period.year' },
  { value: 'ALL', key: 'admin.bookings.period.all' },
];

const statusChip: Record<BookingStatus, 'default' | 'success' | 'warning' | 'error'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  DECLINED: 'error',
  CANCELLED: 'default',
  EXPIRED: 'default',
};

const statusLabel: Record<BookingStatus, string> = {
  PENDING: 'admin.bookings.filter.pending',
  CONFIRMED: 'admin.bookings.filter.confirmed',
  DECLINED: 'admin.bookings.filter.declined',
  CANCELLED: 'admin.bookings.filter.cancelled',
  EXPIRED: 'admin.bookings.filter.archived',
};

export function BookingsPage() {
  const { t } = useLanguage();
  const toast = useToast();
  const price = usePrice();
  const fmtDate = useFormatDate();
  const [filter, setFilter] = useState('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  // Sort by check-in date; the server already returns earliest first (ties: newest request first).
  const [dateDir, setDateDir] = useState<'asc' | 'desc'>('asc');
  const [period, setPeriod] = useState<BookingPeriod | 'ALL'>('week');
  const { data, isLoading } = useBookings(
    filter === 'ALL' ? undefined : filter,
    period === 'ALL' ? undefined : period,
  );
  const { confirm, setStatus } = useBookingActions();

  // Stable sort: bookings with the same check-in keep the server's order in both directions.
  const rows = useMemo(() => {
    const list = [...(data ?? [])];
    const sign = dateDir === 'asc' ? 1 : -1;
    return list.sort((a, b) => sign * a.checkIn.slice(0, 10).localeCompare(b.checkIn.slice(0, 10)));
  }, [data, dateDir]);

  const busy = confirm.isPending || setStatus.isPending;
  // Failed actions (e.g. confirming dates that another stay already took → 409) show as a toast.
  const onActionError = (err: unknown) =>
    toast.error(
      t(
        (err as { response?: { status?: number } })?.response?.status === 409
          ? 'admin.bookings.actionConflict'
          : 'admin.bookings.actionError',
      ),
    );

  // Same actions in the table row (compact, right-aligned) and the details panel.
  const renderActions = (b: Booking, place: 'row' | 'panel' = 'row') => {
    const size = place === 'panel' ? 'medium' : 'small';
    if (b.status === 'PENDING') {
      return (
        <Stack direction="row" spacing={1} justifyContent={place === 'panel' ? 'flex-start' : 'flex-end'}>
          <Button
            size={size}
            color="error"
            disabled={busy}
            onClick={() => setStatus.mutate({ id: b.id, status: 'DECLINED' }, { onError: onActionError })}
          >
            {t('admin.bookings.decline')}
          </Button>
          <Button
            size={size}
            variant="contained"
            disabled={busy}
            onClick={() => confirm.mutate(b.id, { onError: onActionError })}
          >
            {t('admin.bookings.confirm')}
          </Button>
        </Stack>
      );
    }
    if (b.status === 'CONFIRMED') {
      return (
        // Box wrapper: in the panel's column layout a bare Button would stretch to full width.
        <Box>
          <Button
            size={size}
            color="error"
            disabled={busy}
            onClick={() => setStatus.mutate({ id: b.id, status: 'CANCELLED' }, { onError: onActionError })}
          >
            {t('admin.bookings.cancel')}
          </Button>
        </Box>
      );
    }
    // Re-accept a declined request (circumstances changed). Panel only, to keep rows compact.
    if (b.status === 'DECLINED' && place === 'panel') {
      return (
        <Box>
          <Button variant="contained" size={size} disabled={busy} onClick={() => confirm.mutate(b.id, { onError: onActionError })}>
            {t('admin.bookings.accept')}
          </Button>
        </Box>
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
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
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
          <TextField
            select
            size="small"
            label={t('admin.bookings.period')}
            value={period}
            onChange={(e) => setPeriod(e.target.value as BookingPeriod | 'ALL')}
            sx={{ minWidth: 190 }}
          >
            {PERIOD_FILTERS.map((f) => (
              <MenuItem key={f.value} value={f.value}>
                {t(f.key)}
              </MenuItem>
            ))}
          </TextField>
          <NewBookingButton />
        </Stack>
      </Stack>

      {isLoading ? (
        <Typography>{t('admin.common.loading')}</Typography>
      ) : (data?.length ?? 0) === 0 ? (
        <Typography color="text.secondary">{t('admin.bookings.empty')}</Typography>
      ) : (
        <TableContainer component={Paper} elevation={0}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.bookings.col.ref')}</TableCell>
                <TableCell>{t('admin.bookings.col.guest')}</TableCell>
                <TableCell sortDirection={dateDir}>
                  <TableSortLabel
                    active
                    direction={dateDir}
                    onClick={() => setDateDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    title={t(dateDir === 'asc' ? 'admin.bookings.sortDesc' : 'admin.bookings.sortAsc')}
                  >
                    {t('admin.bookings.col.dates')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>{t('admin.bookings.col.guests')}</TableCell>
                <TableCell>{t('admin.bookings.col.quote')}</TableCell>
                <TableCell>{t('admin.bookings.col.status')}</TableCell>
                <TableCell align="right">{t('admin.bookings.col.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id} hover onClick={() => setOpenId(b.id)} sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    {b.reference}
                    {b.source === 'MANUAL' && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('admin.bookings.manual')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {b.guestName}
                      {(b.comments || b.internalNotes) && (
                        <NotesIcon fontSize="inherit" color="action" titleAccess={t('admin.details.hasNotes')} />
                      )}
                    </Box>
                    <Button
                      size="small"
                      startIcon={<PhoneIcon fontSize="small" />}
                      href={`tel:${b.guestPhone}`}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ px: 0, minWidth: 0, textTransform: 'none' }}
                    >
                      {b.guestPhone}
                    </Button>
                  </TableCell>
                  <TableCell>
                    {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}
                  </TableCell>
                  <TableCell>{b.guestsCount}</TableCell>
                  <TableCell>{price.format(b.priceQuoteMinor)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={t(statusLabel[b.status])}color={statusChip[b.status]} />
                  </TableCell>
                  {/* Action buttons must not also open the details panel. */}
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    {renderActions(b)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <BookingDetailsDrawer
        booking={data?.find((b) => b.id === openId) ?? null}
        statusLabel={(b) => t(statusLabel[b.status])}
        statusColor={(b) => statusChip[b.status]}
        renderActions={(b) => renderActions(b, 'panel')}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
