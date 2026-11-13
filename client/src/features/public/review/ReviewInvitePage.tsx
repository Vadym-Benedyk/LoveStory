// /review/:token — the page a guest opens from the invitation they got after their stay.
// The token comes from the booking (server: reviews/review-invite.service.ts); it is one-off and
// expires after 60 days. No account, no contacts: a rating, a few words and the name to show.
import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Button, CircularProgress, Container, Paper, Rating, Stack, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { useReviewInvite } from '@/shared/api/queries';
import { useLanguage } from '@/i18n/LanguageContext';
import { useFormatDate } from '@/i18n/DateLocaleProvider';
import styles from './ReviewInvitePage.module.scss';

const MAX_BODY = 2000;

function Notice({ title, note }: { title: string; note: string }) {
  const { t } = useLanguage();
  return (
    <Paper className={styles.card} elevation={0}>
      <Typography variant="h3" gutterBottom>
        {title}
      </Typography>
      <Typography>{note}</Typography>
      <Button component={RouterLink} to="/" variant="contained" size="large" sx={{ mt: 3 }}>
        {t('review.backHome')}
      </Button>
    </Paper>
  );
}

export function ReviewInvitePage() {
  const { token = '' } = useParams();
  const { t } = useLanguage();
  const fmtDate = useFormatDate();
  const invite = useReviewInvite(token);

  const [rating, setRating] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  // The guest's first name is the default author name (editable).
  useEffect(() => {
    if (invite.data) setName(invite.data.guestFirstName);
  }, [invite.data]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.title = `${t('review.title')} — LoveStory`;
  }, [t]);

  const submit = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/reviews/invite/${token}`, {
          authorName: name.trim(),
          rating,
          title: title.trim() || undefined,
          body: body.trim(),
        })
      ).data,
  });

  const errors = {
    rating: rating === null,
    name: name.trim().length < 2,
    body: body.trim().length < 5,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const content = (() => {
    if (invite.isPending) return <CircularProgress sx={{ display: 'block', mx: 'auto', my: 8 }} />;
    if (invite.isError || !invite.data) {
      return <Notice title={t('review.notFound.title')} note={t('review.notFound.note')} />;
    }
    if (submit.isSuccess) return <Notice title={t('review.done.title')} note={t('review.done.note')} />;
    if (invite.data.state === 'USED') return <Notice title={t('review.used.title')} note={t('review.used.note')} />;
    if (invite.data.state === 'EXPIRED') {
      return <Notice title={t('review.expired.title')} note={t('review.expired.note')} />;
    }

    const { propertyName, guestFirstName, checkIn, checkOut } = invite.data;
    return (
      <Paper className={styles.card} elevation={0}>
        <Typography variant="h3" gutterBottom>
          {t('review.greeting', { name: guestFirstName })}
        </Typography>
        <Typography sx={{ mb: 3 }}>
          {t('review.intro', { property: propertyName, dates: `${fmtDate(checkIn)} – ${fmtDate(checkOut)}` })}
        </Typography>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setShowErrors(true);
            if (!hasErrors && !submit.isPending) submit.mutate();
          }}
        >
          <Stack spacing={2.5}>
            <div>
              <Typography component="label" htmlFor="review-rating" variant="subtitle1" display="block">
                {t('review.rating')}
              </Typography>
              <Rating
                id="review-rating"
                name="rating"
                size="large"
                value={rating}
                onChange={(_e, v) => setRating(v)}
              />
            </div>
            <TextField
              label={t('review.name')}
              helperText={t('review.nameHelp')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              inputProps={{ maxLength: 60 }}
              error={showErrors && errors.name}
              required
            />
            <TextField
              label={t('review.heading')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              inputProps={{ maxLength: 160 }}
            />
            <TextField
              label={t('review.body')}
              multiline
              minRows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              inputProps={{ maxLength: MAX_BODY }}
              error={showErrors && errors.body}
              required
            />

            {showErrors && hasErrors && (
              <Alert severity="warning">
                {[
                  errors.rating && t('review.validation.rating'),
                  errors.name && t('review.validation.name'),
                  errors.body && t('review.validation.body'),
                ]
                  .filter(Boolean)
                  .join(' ')}
              </Alert>
            )}
            {submit.isError && <Alert severity="error">{t('review.error')}</Alert>}

            <Typography variant="body2" color="text.secondary">
              {t('review.moderated')}
            </Typography>
            <Button type="submit" variant="contained" size="large" disabled={submit.isPending}>
              {t('review.submit')}
            </Button>
          </Stack>
        </form>
      </Paper>
    );
  })();

  return (
    <Container maxWidth="sm" className={styles.page}>
      {content}
    </Container>
  );
}
