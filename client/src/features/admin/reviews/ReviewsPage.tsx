import { useFormatDate } from '@/i18n/DateLocaleProvider';
import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Rating,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import type { Review, ReviewStatus } from '@/shared/types';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/shared/ui/ToastProvider';
import { useAdminReviews, useReviewActions } from '../api';

type Filter = ReviewStatus | 'ALL';

const FILTERS: { value: Filter; key: string }[] = [
  { value: 'PENDING', key: 'admin.reviews.filter.pending' },
  { value: 'APPROVED', key: 'admin.reviews.filter.approved' },
  { value: 'HIDDEN', key: 'admin.reviews.filter.hidden' },
  { value: 'ALL', key: 'admin.reviews.filter.all' },
];

const statusChip: Record<ReviewStatus, 'warning' | 'success' | 'default'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  HIDDEN: 'default',
};

export function ReviewsPage() {
  const { t } = useLanguage();
  const toast = useToast();
  const fmtDate = useFormatDate();
  // Moderation queue first: that's what the owner comes here for.
  const [filter, setFilter] = useState<Filter>('PENDING');
  const { data, isLoading } = useAdminReviews(filter === 'ALL' ? undefined : filter);
  const { update, remove } = useReviewActions();
  const [replyFor, setReplyFor] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');

  const busy = update.isPending || remove.isPending;
  const counts = data?.counts;

  const fail = () => toast.error(t('admin.reviews.error'));
  const setStatus = (r: Review, status: ReviewStatus) =>
    update.mutate({ id: r.id, status }, { onError: fail });

  const openReply = (r: Review) => {
    setReplyFor(r);
    setReplyText(r.ownerReply ?? '');
  };
  const closeReply = () => setReplyFor(null);
  const saveReply = (text: string | null) => {
    if (!replyFor) return;
    update.mutate({ id: replyFor.id, ownerReply: text }, { onSuccess: closeReply, onError: fail });
  };

  const onDelete = (r: Review) => {
    if (window.confirm(t('admin.reviews.deleteConfirm', { name: r.authorName }))) remove.mutate(r.id, { onError: fail });
  };

  const tabLabel = (f: (typeof FILTERS)[number]) =>
    f.value !== 'ALL' && counts ? `${t(f.key)} (${counts[f.value]})` : t(f.key);

  return (
    <>
      <Typography variant="h4" gutterBottom>
        {t('admin.reviews.title')}
      </Typography>
      <Typography color="text.secondary" mb={2}>
        {t('admin.reviews.hint')}
      </Typography>

      <Tabs
        value={filter}
        onChange={(_e, v: Filter) => setFilter(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {FILTERS.map((f) => (
          <Tab key={f.value} value={f.value} label={tabLabel(f)} />
        ))}
      </Tabs>

      {isLoading ? (
        <Typography>{t('admin.common.loading')}</Typography>
      ) : !data?.reviews.length ? (
        <Typography color="text.secondary">
          {t(filter === 'PENDING' ? 'admin.reviews.emptyPending' : 'admin.reviews.empty')}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {data.reviews.map((r) => (
            <Paper key={r.id} elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Rating value={r.rating} readOnly size="small" />
                {r.title && (
                  <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1 }}>
                    {r.title}
                  </Typography>
                )}
                <Chip
                  size="small"
                  label={t(`admin.reviews.status.${r.status}`)}
                  color={statusChip[r.status]}
                  sx={{ ml: 'auto' }}
                />
              </Stack>

              <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                {r.body}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                {[r.authorName, r.stayMonth, t('admin.reviews.submitted', { date: fmtDate(r.createdAt) })]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>

              {r.ownerReply && (
                <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('admin.reviews.yourReply')}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {r.ownerReply}
                  </Typography>
                </Box>
              )}

              <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
                {r.status !== 'APPROVED' && (
                  <Button
                    size="small"
                    variant="contained"
                    disabled={busy}
                    onClick={() => setStatus(r, 'APPROVED')}
                  >
                    {t('admin.reviews.approve')}
                  </Button>
                )}
                {r.status !== 'HIDDEN' && (
                  <Button size="small" disabled={busy} onClick={() => setStatus(r, 'HIDDEN')}>
                    {t('admin.reviews.hide')}
                  </Button>
                )}
                <Button size="small" disabled={busy} onClick={() => openReply(r)}>
                  {t(r.ownerReply ? 'admin.reviews.editReply' : 'admin.reviews.reply')}
                </Button>
                <Button size="small" color="error" disabled={busy} onClick={() => onDelete(r)}>
                  {t('admin.reviews.delete')}
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={replyFor !== null} onClose={closeReply} fullWidth maxWidth="sm">
        <DialogTitle>{t('admin.reviews.replyTitle', { name: replyFor?.authorName ?? '' })}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
            {replyFor?.body}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label={t('admin.reviews.replyLabel')}
            helperText={t('admin.reviews.replyHelp')}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            inputProps={{ maxLength: 2000 }}
          />
        </DialogContent>
        <DialogActions>
          {replyFor?.ownerReply && (
            <Button color="error" disabled={busy} onClick={() => saveReply(null)} sx={{ mr: 'auto' }}>
              {t('admin.reviews.removeReply')}
            </Button>
          )}
          <Button onClick={closeReply}>{t('admin.reviews.cancel')}</Button>
          <Button
            variant="contained"
            disabled={busy || !replyText.trim()}
            onClick={() => saveReply(replyText.trim())}
          >
            {t('admin.reviews.saveReply')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
