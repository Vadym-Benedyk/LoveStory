// Side panel with everything about one booking: guest contacts, dates, price, source, who
// confirmed it, the guest's comment and the manager's editable private note.
import { useEffect, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PhoneIcon from '@mui/icons-material/Phone';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Link as RouterLink } from 'react-router-dom';
import type { Booking } from '@/shared/types';
import { usePrice } from '@/shared/usePrice';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/shared/ui/ToastProvider';
import { useFormatDate } from '@/i18n/DateLocaleProvider';
import { useSendReviewInvite, useUpdateBookingNotes } from '../api';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {children}
      </Typography>
    </Box>
  );
}

export function BookingDetailsDrawer({
  booking,
  statusLabel,
  statusColor,
  renderActions,
  onClose,
}: {
  booking: Booking | null;
  statusLabel: (b: Booking) => string;
  statusColor: (b: Booking) => 'default' | 'success' | 'warning' | 'error';
  /** Confirm / decline / cancel buttons for the booking's current status (null when none). */
  renderActions: (b: Booking) => ReactNode;
  onClose: () => void;
}) {
  const { t, tp } = useLanguage();
  const toast = useToast();
  const price = usePrice();
  const fmtDate = useFormatDate();
  const save = useUpdateBookingNotes();
  const invite = useSendReviewInvite();
  const [notes, setNotes] = useState('');

  // Load the note of the booking being shown (and reset when switching bookings).
  useEffect(() => {
    setNotes(booking?.internalNotes ?? '');
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

  const dirty = (booking?.internalNotes ?? '') !== notes.trim();
  const nights = booking
    ? Math.round((Date.parse(booking.checkOut.slice(0, 10)) - Date.parse(booking.checkIn.slice(0, 10))) / 86_400_000)
    : 0;

  return (
    <Drawer
      anchor="right"
      open={booking !== null}
      onClose={onClose}
      // Above the admin AppBar (which itself sits at drawer + 1), so the header row is visible.
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 2 }}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
    >
      {booking && (
        <Stack spacing={2} sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {booking.reference}
            </Typography>
            <Chip size="small" label={statusLabel(booking)} color={statusColor(booking)} />
            <IconButton aria-label={t('admin.details.close')} onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Stack>

          {renderActions(booking)}

          <Row label={t('admin.bookings.col.guest')}>
            {booking.guestName}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mt={0.5}>
              <Button size="small" variant="outlined" startIcon={<PhoneIcon />} href={`tel:${booking.guestPhone}`}>
                {booking.guestPhone}
              </Button>
              {booking.guestEmail && (
                <Button size="small" variant="text" href={`mailto:${booking.guestEmail}`} sx={{ textTransform: 'none' }}>
                  {booking.guestEmail}
                </Button>
              )}
            </Stack>
          </Row>

          <Stack direction="row" spacing={3}>
            <Row label={t('admin.bookings.col.dates')}>
              {fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)}
              <Typography variant="caption" color="text.secondary" display="block">
                {tp('booking.nightsCount', nights)}
              </Typography>
            </Row>
            <Row label={t('admin.bookings.col.guests')}>{booking.guestsCount}</Row>
            <Row label={t('admin.bookings.col.quote')}>{price.format(booking.priceQuoteMinor)}</Row>
          </Stack>

          <Stack direction="row" spacing={3}>
            <Row label={t('admin.details.source')}>
              {booking.source === 'MANUAL' ? t('admin.bookings.manual') : t('admin.details.website')}
            </Row>
            <Row label={t('admin.details.created')}>{fmtDate(booking.createdAt)}</Row>
            {booking.confirmedAt && (
              <Row label={t('admin.details.confirmed')}>
                {fmtDate(booking.confirmedAt)}
                {booking.confirmedBy && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {booking.confirmedBy.name}
                  </Typography>
                )}
              </Row>
            )}
          </Stack>

          {booking.status === 'CONFIRMED' && (
            <>
              <Divider />
              <ReviewSection
                booking={booking}
                busy={invite.isPending}
                onSend={() =>
                  invite.mutate(booking.id, {
                    onSuccess: () => toast.success(t('admin.details.inviteSent')),
                    onError: () => toast.error(t('admin.details.inviteError')),
                  })
                }
              />
            </>
          )}

          <Divider />

          <Row label={t('admin.details.guestComment')}>
            {booking.comments ? (
              <Box sx={{ whiteSpace: 'pre-wrap', bgcolor: 'background.default', p: 1.5, borderRadius: 2, mt: 0.5 }}>
                {booking.comments}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('admin.details.noComment')}
              </Typography>
            )}
          </Row>

          <TextField
            label={t('admin.details.notes')}
            helperText={t('admin.details.notesHelp')}
            multiline
            minRows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            inputProps={{ maxLength: 2000 }}
          />
          <Box>
            <Button
              variant="contained"
              disabled={!dirty || save.isPending}
              onClick={() =>
                save.mutate(
                  { id: booking.id, internalNotes: notes.trim() || null },
                  {
                    onSuccess: () => toast.success(t('admin.details.notesSaved')),
                    onError: () => toast.error(t('admin.details.notesError')),
                  },
                )
              }
            >
              {save.isPending ? t('admin.settings.saving') : t('admin.details.saveNotes')}
            </Button>
          </Box>
        </Stack>
      )}
    </Drawer>
  );
}

// Review invitation of a confirmed stay: sent by itself after check-out (the hourly server job),
// or from here earlier / again. Shows the link to forward and, once it came, the review.
function ReviewSection({ booking, busy, onSend }: { booking: Booking; busy: boolean; onSend: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const fmtDate = useFormatDate();
  const link = booking.reviewInviteToken ? `${window.location.origin}/review/${booking.reviewInviteToken}` : null;
  const checkedOut = Date.parse(booking.checkOut.slice(0, 10)) <= Date.now();

  if (booking.review) {
    return (
      <Row label={t('admin.details.review')}>
        {t('admin.details.reviewReceived', { rating: String(booking.review.rating) })}
        {' · '}
        {t(`admin.reviews.status.${booking.review.status}`)}
        <Box mt={1}>
          <Button size="small" variant="outlined" component={RouterLink} to="/admin/reviews">
            {t('admin.details.openReviews')}
          </Button>
        </Box>
      </Row>
    );
  }

  return (
    <Row label={t('admin.details.review')}>
      {link && booking.reviewInvitedAt ? (
        <>
          {t('admin.details.reviewInvited', { date: fmtDate(booking.reviewInvitedAt) })}
          {booking.reviewInviteChannel && ` · ${t(`admin.details.reviewChannel.${booking.reviewInviteChannel}`)}`}
          <Typography variant="caption" color="text.secondary" display="block" mt={1}>
            {t('admin.details.reviewLink')}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
              {link}
            </Typography>
            <IconButton
              size="small"
              aria-label={t('admin.details.copyLink')}
              onClick={() => navigator.clipboard.writeText(link).then(() => toast.success(t('admin.details.linkCopied')))}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Stack>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t('admin.details.reviewNotYet')}
        </Typography>
      )}
      <Box mt={1}>
        <Button size="small" variant="outlined" disabled={busy || !checkedOut} onClick={onSend}>
          {link ? t('admin.details.resendInvite') : t('admin.details.sendInvite')}
        </Button>
      </Box>
    </Row>
  );
}
