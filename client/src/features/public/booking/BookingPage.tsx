import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import dayjs, { type Dayjs } from 'dayjs';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { useAvailability } from '@/shared/api/queries';
import { formatMoney, type Quote } from '@/shared/types';
import styles from './BookingPage.module.scss';

const fmt = (d: Dayjs) => d.format('YYYY-MM-DD');

export function BookingPage() {
  const [checkIn, setCheckIn] = useState<Dayjs | null>(null);
  const [checkOut, setCheckOut] = useState<Dayjs | null>(null);
  const [form, setForm] = useState({ guestName: '', guestPhone: '', guestEmail: '', comments: '', website: '' });
  const [consent, setConsent] = useState(false);

  const rangeStart = dayjs().startOf('month');
  const rangeEnd = dayjs().add(12, 'month').endOf('month');
  const { data: avail } = useAvailability(fmt(rangeStart), fmt(rangeEnd));

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

  const isBlocked = (d: Dayjs) => d.isBefore(dayjs(), 'day') || blocked.has(d.format('YYYY-MM-DD'));

  const quoteMut = useMutation({
    mutationFn: async () =>
      (
        await api.post<Quote>('/quote', { checkIn: fmt(checkIn!), checkOut: fmt(checkOut!), addons: [] })
      ).data,
  });

  const bookingMut = useMutation({
    mutationFn: async () =>
      (
        await api.post('/bookings', {
          guestName: form.guestName,
          guestPhone: form.guestPhone,
          guestEmail: form.guestEmail || undefined,
          checkIn: fmt(checkIn!),
          checkOut: fmt(checkOut!),
          comments: form.comments || undefined,
          addons: [],
          consent,
          website: form.website,
        })
      ).data as { reference: string; message: string },
  });

  const handleDay = (d: Dayjs) => {
    if (isBlocked(d)) return;
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(d);
      setCheckOut(null);
      quoteMut.reset();
    } else if (d.isAfter(checkIn)) {
      // reject if any blocked day inside the range
      let cur = checkIn.add(1, 'day');
      while (cur.isBefore(d) || cur.isSame(d, 'day')) {
        if (blocked.has(cur.format('YYYY-MM-DD'))) return;
        cur = cur.add(1, 'day');
      }
      setCheckOut(d);
      setTimeout(() => quoteMut.mutate(), 0);
    } else {
      setCheckIn(d);
      setCheckOut(null);
    }
  };

  const canSubmit =
    checkIn && checkOut && form.guestName.length >= 2 && form.guestPhone.length >= 5 && consent;

  if (bookingMut.isSuccess) {
    return (
      <Container className={styles.page}>
        <Paper className={styles.confirm} elevation={0}>
          <Typography variant="h3" gutterBottom>
            Request received
          </Typography>
          <Typography>
            {bookingMut.data.message} Your reference is{' '}
            <strong>{bookingMut.data.reference}</strong>.
          </Typography>
          <Alert severity="info" sx={{ mt: 3 }}>
            Nothing is booked yet — the owner will call you to confirm these dates.
          </Alert>
        </Paper>
      </Container>
    );
  }

  return (
    <Container className={styles.page}>
      <Typography variant="h2" gutterBottom>
        Request your stay
      </Typography>
      <Typography className={styles.intro}>
        Pick your dates, then send a request. We confirm every reservation personally by phone —
        your dates are only held once we&apos;ve spoken.
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={7}>
          <Paper elevation={0} className={styles.calendarCard}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DateCalendar
                disablePast
                shouldDisableDate={isBlocked}
                onChange={(d) => d && handleDay(d)}
                value={checkOut ?? checkIn}
              />
            </LocalizationProvider>
            <Stack direction="row" spacing={2} className={styles.legend}>
              <span><i className={styles.dotAvailable} /> Available</span>
              <span><i className={styles.dotBlocked} /> Unavailable</span>
            </Stack>
            <Typography variant="body2">
              {checkIn ? `Check-in: ${fmt(checkIn)}` : 'Select your check-in date'}
              {checkOut ? ` · Check-out: ${fmt(checkOut)}` : checkIn ? ' · now select check-out' : ''}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper elevation={0} className={styles.formCard}>
            {quoteMut.data && (
              <Box className={styles.quote}>
                <Typography variant="h6">
                  {quoteMut.data.nights} night{quoteMut.data.nights > 1 ? 's' : ''}
                </Typography>
                <Typography variant="h4">
                  {formatMoney(quoteMut.data.totalMinor, quoteMut.data.currency)}
                </Typography>
                {!quoteMut.data.meetsMinNights && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    Minimum stay is {quoteMut.data.minNights} nights for these dates.
                  </Alert>
                )}
                <Divider sx={{ my: 2 }} />
              </Box>
            )}

            <Stack spacing={2}>
              <TextField
                label="Your name"
                required
                value={form.guestName}
                onChange={(e) => setForm({ ...form, guestName: e.target.value })}
              />
              <TextField
                label="Phone number"
                required
                value={form.guestPhone}
                onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
              />
              <TextField
                label="Email (optional)"
                value={form.guestEmail}
                onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
              />
              <TextField
                label="Anything we should know? (optional)"
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
              <label className={styles.consent}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I agree to be contacted by phone to confirm this request.</span>
              </label>

              {bookingMut.isError && (
                <Alert severity="error">
                  {(bookingMut.error as any)?.response?.data?.error?.message ??
                    'Could not submit. Please try again.'}
                </Alert>
              )}

              <Button
                size="large"
                variant="contained"
                disabled={!canSubmit || bookingMut.isPending}
                onClick={() => bookingMut.mutate()}
              >
                {bookingMut.isPending ? 'Sending…' : 'Send booking request'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                This sends a request only. No payment is taken now.
              </Typography>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
