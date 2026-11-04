import { useFormatDate } from '@/i18n/DateLocaleProvider';
import { useState } from 'react';
import {
  Alert,
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
import NotesIcon from '@mui/icons-material/StickyNote2Outlined';
import type { Booking, BookingStatus } from '@/shared/types';
import { usePrice } from '@/shared/usePrice';
import { useLanguage } from '@/i18n/LanguageContext';
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
  { value: 'ALL', key: 'admin.bookings.period.all' },
  { value: 'week', key: 'admin.bookings.period.week' },
  { value: 'month', key: 'admin.bookings.period.month' },
  { value: 'year', key: 'admin.bookings.period.year' },
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
  const price = usePrice();
  const fmtDate = useFormatDate();
  const [filter, setFilter] = useState('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const [period, setPeriod] = useState<BookingPeriod | 'ALL'>('ALL');
  const { data, isLoading } = useBookings(
    filter === 'ALL' ? undefined : filter,
    period === 'ALL' ? undefined : period,
  );
  const { confirm, setStatus } = useBookingActions();

  const busy = confirm.isPending || setStatus.isPending;
  // Last failed action (e.g. confirming dates that another stay already took → 409).
  const actionError = (confirm.error ?? setStatus.error) as { response?: { status?: number } } | null;
  const actionErrorText = actionError
    ? t(actionError.response?.status === 409 ? 'admin.bookings.actionConflict' : 'admin.bookings.actionError')
    : null;

  // Clear the previous action's error before a new one, so a stale message never lingers.
  const run = (action: () => void) => {
    confirm.reset();
    setStatus.reset();
    action();
  };

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
            onClick={() => run(() => setStatus.mutate({ id: b.id, status: 'DECLINED' }))}
          >
            {t('admin.bookings.decline')}
          </Button>
          <Button
            size={size}
            variant="contained"
            disabled={busy}
            onClick={() => run(() => confirm.mutate(b.id))}
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
            onClick={() => run(() => setStatus.mutate({ id: b.id, status: 'CANCELLED' }))}
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
          <Button variant="contained" size={size} disabled={busy} onClick={() => run(() => confirm.mutate(b.id))}>
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

      {actionErrorText && openId === null && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => (confirm.reset(), setStatus.reset())}>
          {actionErrorText}
        </Alert>
      )}

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
                <TableCell>{t('admin.bookings.col.dates')}</TableCell>
                <TableCell>{t('admin.bookings.col.guests')}</TableCell>
                <TableCell>{t('admin.bookings.col.quote')}</TableCell>
                <TableCell>{t('admin.bookings.col.status')}</TableCell>
                <TableCell align="right">{t('admin.bookings.col.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.map((b) => (
                <TableRow key={b.id} hover onClick={() => (confirm.reset(), setStatus.reset(), setOpenId(b.id))} sx={{ cursor: 'pointer' }}>
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
        renderActions={(b) => (
          <>
            {renderActions(b, 'panel')}
            {actionErrorText && <Alert severity="error">{actionErrorText}</Alert>}
          </>
        )}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
