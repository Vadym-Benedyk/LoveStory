import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickersDay, type PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import dayjs, { type Dayjs } from 'dayjs';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { useAvailability, useSiteContent } from '@/shared/api/queries';
import type { Quote } from '@/shared/types';
import { usePrice } from '@/shared/usePrice';
import { useLanguage } from '@/i18n/LanguageContext';
import styles from './BookingPage.module.scss';

const fmt = (d: Dayjs) => d.format('YYYY-MM-DD');
const GUEST_OPTIONS = 6;

// Calendar day that also paints the selected stay as a range (check-in → check-out).
type RangeDayProps = PickersDayProps<Dayjs> & { rangeStart?: Dayjs | null; rangeEnd?: Dayjs | null };
function RangeDay({ rangeStart, rangeEnd, day, ...other }: RangeDayProps) {
  const isEdge = [rangeStart, rangeEnd].some((d) => d && day.isSame(d, 'day'));
  const inside =
    rangeStart && rangeEnd && day.isAfter(rangeStart, 'day') && day.isBefore(rangeEnd, 'day');
  return (
    <PickersDay
      {...other}
      day={day}
      selected={isEdge}
      sx={
        inside
          ? { bgcolor: (th) => alpha(th.palette.primary.main, 0.15) }
          : isEdge
            ? {
                // Keep the selected day readable in every state (default hover/focus turn it pale).
                '&.Mui-selected, &.Mui-selected:focus': { bgcolor: 'primary.main', color: 'primary.contrastText' },
                '&.Mui-selected:hover': { bgcolor: 'primary.dark' },
              }
            : undefined
      }
    />
  );
}

export function BookingPage() {
  const { t, tp } = useLanguage();
  const price = usePrice();
  // The guest picks NIGHTS: one click = one night; a second, later click = last night of the
  // stay. Check-out is the morning after the last night.
  const [firstNight, setFirstNight] = useState<Dayjs | null>(null);
  const [lastNight, setLastNight] = useState<Dayjs | null>(null);
  const checkIn = firstNight;
  const checkOut = lastNight ? lastNight.add(1, 'day') : null;
  const [form, setForm] = useState({ guestName: '', guestPhone: '', guestEmail: '', comments: '', website: '' });
  // Guests: a plain 1…6 list (or up to the capacity if the house sleeps more). Picking more
  // than the capacity from admin Settings is allowed and flagged for the owner's call.
  const { data: content } = useSiteContent();
  const capacity = Math.max(1, content?.settings?.capacity ?? 4);
  const guestOptions = Math.max(GUEST_OPTIONS, capacity);
  const [guestsCount, setGuestsCount] = useState(2);
  const [consent, setConsent] = useState(false);
  // Validation messages appear after the first submit attempt (not while the guest is typing).
  const [showErrors, setShowErrors] = useState(false);

  const rangeStart = dayjs().startOf('month');
  const rangeEnd = dayjs().add(12, 'month').endOf('month');
  const { data: avail } = useAvailability(fmt(rangeStart), fmt(rangeEnd));

  // Nights that are taken (confirmed bookings + manual blocks), as YYYY-MM-DD.
  const blocked = useMemo(() => {
    const set = new Set<string>();
    for (const r of avail?.unavailable ?? []) {
      let cur = dayjs(r.start);
      const end = dayjs(r.end);
      while (cur.isBefore(end)) {
        set.add(cur.format('YYYY-MM-DD'));
        cur = cur.add(1, 'day');
      }
    }
    return set;
  }, [avail]);

  // Every night from `from` to `to` (inclusive) is free. Check-out day itself is not a night, so
  // a stay may end the morning another guest arrives (back-to-back stays).
  const nightsFree = (from: Dayjs, to: Dayjs) => {
    for (let cur = from; !cur.isAfter(to, 'day'); cur = cur.add(1, 'day')) {
      if (blocked.has(fmt(cur))) return false;
    }
    return true;
  };

  // A day in the calendar = that night. Past and taken nights can't be picked.
  const isDisabled = (d: Dayjs) => d.isBefore(dayjs(), 'day') || blocked.has(fmt(d));

  const quoteMut = useMutation({
    mutationFn: async (range: { checkIn: Dayjs; checkOut: Dayjs }) =>
      (
        await api.post<Quote>('/quote', {
          checkIn: fmt(range.checkIn),
          checkOut: fmt(range.checkOut),
          addons: [],
        })
      ).data,
  });

  const bookingMut = useMutation({
    mutationFn: async () =>
      (
        await api.post('/bookings', {
          guestName: form.guestName.trim(),
          guestPhone: form.guestPhone.trim(),
          guestsCount,
          guestEmail: form.guestEmail.trim() || undefined,
          checkIn: fmt(checkIn!),
          checkOut: fmt(checkOut!),
          comments: form.comments || undefined,
          addons: [],
          consent,
          website: form.website,
        })
      ).data as { reference: string; message: string },
  });

  const select = (first: Dayjs, last: Dayjs) => {
    setFirstNight(first);
    setLastNight(last);
    quoteMut.mutate({ checkIn: first, checkOut: last.add(1, 'day') });
  };

  const handleDay = (d: Dayjs) => {
    if (isDisabled(d)) return;
    const singleNight = firstNight && lastNight && firstNight.isSame(lastNight, 'day');
    if (singleNight && d.isSame(firstNight, 'day')) return; // same date again: nothing to change
    if (singleNight && d.isAfter(firstNight, 'day') && nightsFree(firstNight, d)) {
      select(firstNight, d); // second click extends the stay up to this night
    } else {
      // First click, a click after a multi-night range, an earlier date, or a range that would
      // cross a taken night → start over with this one night.
      select(d, d);
    }
  };

  const errors = {
    dates: !checkIn || !checkOut,
    name: form.guestName.trim().length < 2,
    phone: form.guestPhone.trim().length < 5,
    consent: !consent,
    minStay: quoteMut.data ? !quoteMut.data.meetsMinNights : false,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const show = (key: keyof typeof errors) => showErrors && errors[key];

  const onSubmit = () => {
    setShowErrors(true);
    if (!hasErrors) bookingMut.mutate();
  };

  // Start at the top when the form opens (fresh mount) and when the short confirmation screen
  // replaces the long form — otherwise the heading sits hidden under the sticky header.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [bookingMut.isSuccess]);

  if (bookingMut.isSuccess) {
    return (
      <Container className={styles.page}>
        <Paper className={styles.confirm} elevation={0}>
          <Typography variant="h3" gutterBottom>
            {t('booking.success.title')}
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            {t('booking.success.note')}
          </Alert>
        </Paper>
      </Container>
    );
  }

  return (
    <Container className={styles.page}>
      <Typography variant="h2" gutterBottom>
        {t('booking.title')}
      </Typography>
      <Typography className={styles.intro}>{t('booking.intro')}</Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={7}>
          <Paper elevation={0} className={styles.calendarCard}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DateCalendar
                disablePast
                shouldDisableDate={isDisabled}
                onChange={(d) => d && handleDay(d)}
                // Selection is drawn by RangeDay; keeping the picker's own value empty makes
                // every click (even on an already highlighted day) reach handleDay.
                value={null}
                slots={{ day: RangeDay }}
                slotProps={{ day: { rangeStart: firstNight, rangeEnd: lastNight } as Partial<RangeDayProps> }}
              />
            </LocalizationProvider>
            <Stack direction="row" spacing={2} className={styles.legend}>
              <span><i className={styles.dotAvailable} /> {t('booking.legend.available')}</span>
              <span><i className={styles.dotBlocked} /> {t('booking.legend.unavailable')}</span>
            </Stack>
            {checkIn && checkOut ? (
              <>
                <Typography variant="body2" fontWeight={600}>
                  {t('booking.checkin')}: {checkIn.format('DD.MM.YYYY')} · {t('booking.checkout')}:{' '}
                  {checkOut.format('DD.MM.YYYY')} · {tp('booking.nightsCount', checkOut.diff(checkIn, 'day'))}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(checkOut.diff(checkIn, 'day') === 1 ? 'booking.hintExtend' : 'booking.hintRestart')}
                </Typography>
              </>
            ) : (
              <Typography variant="body2">{t('booking.hintSelect')}</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper elevation={0} className={styles.formCard}>
            {quoteMut.data && (
              <Box className={styles.quote}>
                <Typography variant="h6">{tp('booking.nightsCount', quoteMut.data.nights)}</Typography>
                <Typography variant="h4">
                  {price.format(quoteMut.data.totalMinor, quoteMut.data.currency)}
                </Typography>
                {price.rateNote(quoteMut.data.currency) && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {price.rateNote(quoteMut.data.currency)}
                  </Typography>
                )}
                {!quoteMut.data.meetsMinNights && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    {t('booking.minStay', {
                      nights: tp('booking.nightsCount', quoteMut.data.minNights ?? 0),
                    })}
                  </Alert>
                )}
                <Divider sx={{ my: 2 }} />
              </Box>
            )}

            <Stack spacing={2}>
              <TextField
                label={t('booking.form.name')}
                required
                autoComplete="name"
                value={form.guestName}
                onChange={(e) => setForm({ ...form, guestName: e.target.value })}
                error={show('name')}
              />
              <TextField
                label={t('booking.form.phone')}
                required
                type="tel"
                autoComplete="tel"
                value={form.guestPhone}
                onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
                error={show('phone')}
              />
              <TextField
                label={t('booking.form.email')}
                type="email"
                autoComplete="email"
                value={form.guestEmail}
                onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
              />
              <TextField
                select
                label={t('booking.form.guests')}
                value={guestsCount}
                onChange={(e) => setGuestsCount(Number(e.target.value))}
                // Not an error: just sets expectations; the owner discusses it on the phone.
                helperText={guestsCount > capacity ? t('booking.form.guestsOverCapacity', { capacity }) : undefined}
              >
                {Array.from({ length: guestOptions }, (_, i) => i + 1).map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t('booking.form.comments')}
                multiline
                minRows={2}
                value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
              />
              {/* honeypot */}
              <input
                type="text"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                tabIndex={-1}
                autoComplete="off"
                style={{ display: 'none' }}
              />
              {/* The consent message is shown once, in the summary alert below. */}
              <label className={styles.consent}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>{t('booking.form.consent')}</span>
              </label>

              {/* All validation messages live here once; fields only get a red outline. */}
              {showErrors && hasErrors && (
                <Alert severity="warning">
                  {[
                    errors.dates && t('booking.validation.dates'),
                    errors.minStay && t('booking.validation.minStay'),
                    errors.name && t('booking.validation.name'),
                    errors.phone && t('booking.validation.phone'),
                    errors.consent && t('booking.validation.consent'),
                  ]
                    .filter(Boolean)
                    .map((m) => (
                      <div key={m as string}>{m}</div>
                    ))}
                </Alert>
              )}

              {bookingMut.isError && (
                <Alert severity="error">
                  {(bookingMut.error as any)?.response?.data?.error?.message ?? t('booking.error')}
                </Alert>
              )}

              {/* Always clickable: a disabled button gives no clue what's missing. */}
              <Button size="large" variant="contained" disabled={bookingMut.isPending} onClick={onSubmit}>
                {bookingMut.isPending ? t('booking.sending') : t('booking.submit')}
              </Button>
              <Typography variant="caption" color="text.secondary">
                {t('booking.noPayment')}
              </Typography>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
