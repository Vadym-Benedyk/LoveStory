// "New booking" for guests who called or wrote directly: button + dialog + result message.
// Used on the Bookings page and in the Calendar (prefilled with the dates picked there).
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
  type ButtonProps,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { useAvailability, useSiteContent } from '@/shared/api/queries';
import type { Quote } from '@/shared/types';
import { usePrice } from '@/shared/usePrice';
import { PhoneMaskInput, isCompleteUaPhone } from '@/shared/ui/PhoneMaskInput';
import { isConflictError } from '../errors';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/shared/ui/ToastProvider';
import { useCreateBooking } from '../api';

const fmt = (d: Dayjs) => d.format('YYYY-MM-DD');
const NAME_RE = /\p{L}/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Props {
  checkIn?: Dayjs | null;
  checkOut?: Dayjs | null;
  buttonProps?: ButtonProps;
}

export function NewBookingButton({ checkIn: initialIn, checkOut: initialOut, buttonProps }: Props) {
  const { t } = useLanguage();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} {...buttonProps}>
        {t('admin.newBooking.open')}
      </Button>
      {open && (
        <NewBookingDialog
          initialIn={initialIn ?? null}
          initialOut={initialOut ?? null}
          onClose={() => setOpen(false)}
          onCreated={(conflicts) => {
            setOpen(false);
            if (conflicts > 0) toast.warning(t('admin.newBooking.createdWithConflicts', { count: conflicts }));
            else toast.success(t('admin.newBooking.created'));
          }}
        />
      )}
    </>
  );
}

function NewBookingDialog({
  initialIn,
  initialOut,
  onClose,
  onCreated,
}: {
  initialIn: Dayjs | null;
  initialOut: Dayjs | null;
  onClose: () => void;
  onCreated: (conflictingPending: number) => void;
}) {
  const { t } = useLanguage();
  const toast = useToast();
  const price = usePrice();
  const create = useCreateBooking();
  const { data: content } = useSiteContent();
  const capacity = content?.settings?.capacity ?? 4;
  const guestOptions = Math.max(6, capacity);

  const [checkIn, setCheckIn] = useState<Dayjs | null>(initialIn);
  const [checkOut, setCheckOut] = useState<Dayjs | null>(initialOut);
  const [form, setForm] = useState({ guestName: '', guestPhone: '', guestEmail: '', internalNotes: '' });
  const [guestsCount, setGuestsCount] = useState(Math.min(2, guestOptions));
  const [status, setStatus] = useState<'CONFIRMED' | 'PENDING'>('CONFIRMED');
  // The total is pre-filled from the price rules (Standard nightly × nights, Weekend rate on
  // Fri/Sat) and follows the dates until the manager types their own amount.
  const [priceEdit, setPriceEdit] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // Keep check-out after check-in when the check-in moves past it.
  useEffect(() => {
    if (checkIn && checkOut && !checkOut.isAfter(checkIn, 'day')) setCheckOut(null);
  }, [checkIn, checkOut]);

  // Taken nights (confirmed bookings + manual blocks; pending requests don't block — same rule as
  // the server). Used to grey out impossible dates in both pickers.
  const { data: avail } = useAvailability(
    fmt(dayjs().startOf('month')),
    fmt(dayjs().add(18, 'month').endOf('month')),
  );
  const taken = useMemo(() => {
    const set = new Set<string>();
    for (const r of avail?.unavailable ?? []) {
      for (let d = dayjs(r.start); d.isBefore(dayjs(r.end), 'day'); d = d.add(1, 'day')) set.add(fmt(d));
    }
    return set;
  }, [avail]);
  // Check-in: the night itself must be free.
  const isCheckInDisabled = (d: Dayjs) => taken.has(fmt(d));
  // Check-out: every night between check-in and it must be free; the check-out day itself may be
  // another guest's arrival day (back-to-back). Without a check-in, only the night before counts.
  const isCheckOutDisabled = (d: Dayjs) => {
    if (!checkIn || !d.isAfter(checkIn, 'day')) return taken.has(fmt(d.subtract(1, 'day')));
    for (let n = checkIn; n.isBefore(d, 'day'); n = n.add(1, 'day')) if (taken.has(fmt(n))) return true;
    return false;
  };

  const datesValid = Boolean(checkIn && checkOut && checkOut.isAfter(checkIn, 'day') && !checkIn.isBefore(dayjs(), 'day'));
  const quote = useQuery({
    queryKey: ['admin', 'quote', checkIn && fmt(checkIn), checkOut && fmt(checkOut)],
    enabled: datesValid,
    queryFn: async () =>
      (await api.post<Quote>('/quote', { checkIn: fmt(checkIn!), checkOut: fmt(checkOut!), addons: [] })).data,
  });

  const quotedUah = quote.data ? Math.round(quote.data.totalMinor) / 100 : null;
  const priceInput = priceEdit ?? (quotedUah === null ? '' : String(quotedUah));
  // Only a manager-typed amount overrides the quote; empty / untouched → server uses the rules.
  const priceNumber = priceEdit === null || priceEdit.trim() === '' ? null : Number(priceEdit.replace(',', '.'));
  const errors = {
    dates: !datesValid,
    name: form.guestName.trim().length < 2 || !NAME_RE.test(form.guestName),
    phone: !isCompleteUaPhone(form.guestPhone),
    email: form.guestEmail.trim() !== '' && !EMAIL_RE.test(form.guestEmail.trim()),
    price: priceNumber !== null && (!Number.isFinite(priceNumber) || priceNumber < 0),
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => showErrors && errors[k];

  const submit = () => {
    setShowErrors(true);
    if (hasErrors) return;
    create.mutate(
      {
        guestName: form.guestName.trim(),
        guestPhone: `+${form.guestPhone}`,
        guestEmail: form.guestEmail.trim() || undefined,
        guestsCount,
        checkIn: fmt(checkIn!),
        checkOut: fmt(checkOut!),
        status,
        priceMinor: priceNumber === null ? undefined : Math.round(priceNumber * 100),
        internalNotes: form.internalNotes.trim() || undefined,
      },
      {
        onSuccess: (res) => onCreated(res.conflictingPendingIds.length),
        onError: (err) =>
          toast.error(
            t(
              isConflictError(err)
                ? 'admin.newBooking.errTaken'
                : 'admin.newBooking.errGeneric',
            ),
          ),
      },
    );
  };

  const nights = datesValid ? checkOut!.diff(checkIn!, 'day') : 0;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('admin.newBooking.title')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {t('admin.newBooking.hint')}
        </Typography>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <DatePicker
                label={t('admin.newBooking.checkIn')}
                value={checkIn}
                disablePast
                shouldDisableDate={isCheckInDisabled}
                onChange={setCheckIn}
                slotProps={{ textField: { fullWidth: true, error: show('dates') } }}
              />
              <DatePicker
                label={t('admin.newBooking.checkOut')}
                value={checkOut}
                minDate={checkIn ? checkIn.add(1, 'day') : undefined}
                disablePast
                shouldDisableDate={isCheckOutDisabled}
                onChange={setCheckOut}
                slotProps={{ textField: { fullWidth: true, error: show('dates') } }}
              />
            </Stack>

            <TextField
              label={t('booking.form.name')}
              required
              value={form.guestName}
              onChange={(e) => setForm({ ...form, guestName: e.target.value })}
              error={show('name')}
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              label={t('booking.form.phone')}
              required
              type="tel"
              value={form.guestPhone}
              onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
              error={show('phone')}
              InputProps={{ inputComponent: PhoneMaskInput as never }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('booking.form.email')}
              type="email"
              value={form.guestEmail}
              onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
              error={show('email')}
              inputProps={{ maxLength: 200 }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                fullWidth
                label={t('booking.form.guests')}
                value={guestsCount}
                onChange={(e) => setGuestsCount(Number(e.target.value))}
                helperText={guestsCount > capacity ? t('admin.guests.overCapacity', { capacity }) : undefined}
              >
                {Array.from({ length: guestOptions }, (_, i) => i + 1).map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                label={t('admin.newBooking.status')}
                value={status}
                onChange={(e) => setStatus(e.target.value as 'CONFIRMED' | 'PENDING')}
              >
                <MenuItem value="CONFIRMED">{t('admin.bookings.filter.confirmed')}</MenuItem>
                <MenuItem value="PENDING">{t('admin.bookings.filter.pending')}</MenuItem>
              </TextField>
            </Stack>

            <TextField
              label={`${t('admin.newBooking.price')} (${price.currencyLabel})`}
              type="number"
              inputProps={{ min: 0, step: 1, inputMode: 'decimal' }}
              value={priceInput}
              onChange={(e) => setPriceEdit(e.target.value)}
              error={show('price')}
              InputLabelProps={{ shrink: true }}
              helperText={
                quote.data
                  ? t('admin.newBooking.quoteHint', {
                      nights,
                      amount: price.format(quote.data.totalMinor),
                    })
                  : t('admin.newBooking.quoteNeedsDates')
              }
            />
            <TextField
              label={t('admin.newBooking.notes')}
              multiline
              minRows={2}
              value={form.internalNotes}
              onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
              inputProps={{ maxLength: 2000 }}
            />

            {showErrors && hasErrors && (
              <Alert severity="warning">
                {[
                  errors.dates && t('admin.newBooking.errDates'),
                  errors.name && t('booking.validation.name'),
                  errors.phone && t('booking.validation.phone'),
                  errors.email && t('booking.validation.email'),
                  errors.price && t('admin.newBooking.errPrice'),
                ]
                  .filter(Boolean)
                  .map((m) => (
                    <div key={m as string}>{m}</div>
                  ))}
              </Alert>
            )}
          </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('admin.reviews.cancel')}</Button>
        <Button variant="contained" onClick={submit} disabled={create.isPending}>
          {create.isPending ? t('admin.newBooking.saving') : t('admin.newBooking.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
