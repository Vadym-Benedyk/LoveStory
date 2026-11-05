import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import type { AdminSettings } from '@/shared/types';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/shared/ui/ToastProvider';
import { PhoneMaskInput, formatUaPhone, isCompleteUaPhone, isEmptyPhone, phoneToDigits } from '@/shared/ui/PhoneMaskInput';
import { useAuth } from '../auth/AuthContext';
import { useAdminSettings, useChangePassword, useSaveSettings } from '../api';

// Shape of our API errors: { error: { code, message, details: zod.flatten() } }.
function apiError(err: unknown): { code?: string; fieldErrors: Record<string, string[]> } {
  const e = (err as { response?: { data?: { error?: { code?: string; details?: { fieldErrors?: Record<string, string[]> } } } } })
    ?.response?.data?.error;
  return { code: e?.code, fieldErrors: e?.details?.fieldErrors ?? {} };
}

type Form = Omit<AdminSettings, 'capacity' | 'socialLinks' | 'mapEmbedValid'> & {
  capacity: string;
  instagram: string;
  tiktok: string;
};

const toForm = (s: AdminSettings): Form => ({
  capacity: String(s.capacity),
  phone: phoneToDigits(s.phone), // unmasked digits while editing
  email: s.email,
  address: s.address,
  mapEmbed: s.mapEmbed,
  notificationEmail: s.notificationEmail,
  notifyToSiteEmail: s.notifyToSiteEmail,
  instagram: s.socialLinks.instagram ?? '',
  tiktok: s.socialLinks.tiktok ?? '',
});

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Typography variant="h6">{title}</Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          {hint}
        </Typography>
      )}
      <Stack spacing={2} mt={2}>
        {children}
      </Stack>
    </Paper>
  );
}

function SiteSettingsForm() {
  const { t } = useLanguage();
  const toast = useToast();
  const { data, isLoading } = useAdminSettings();
  const save = useSaveSettings();
  const [form, setForm] = useState<Form | null>(null);

  // (Re)seed the form whenever the server copy changes (initial load and after save,
  // so the normalized map URL replaces a pasted <iframe> snippet).
  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  if (isLoading || !form) return <Typography>{t('admin.common.loading')}</Typography>;

  const { fieldErrors } = apiError(save.error);
  const fieldError = (name: string) => fieldErrors[name]?.[0];
  const field = (name: keyof Form) => ({
    value: form[name],
    onChange: (e: { target: { value: string } }) => {
      setForm({ ...form, [name]: e.target.value });
    },
    fullWidth: true,
    error: Boolean(fieldError(name)),
  });

  const phoneUntouched = form.phone === phoneToDigits(data?.phone ?? '');
  const phoneInvalid = !phoneUntouched && !isEmptyPhone(form.phone) && !isCompleteUaPhone(form.phone);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (phoneInvalid) return;
    save.mutate({
      capacity: Number(form.capacity),
      // Untouched: keep what is stored (may be an older free-text number the mask can't hold).
      phone: phoneUntouched ? (data?.phone ?? '') : isEmptyPhone(form.phone) ? '' : formatUaPhone(form.phone),
      email: form.email,
      address: form.address,
      mapEmbed: form.mapEmbed,
      notificationEmail: form.notificationEmail,
      notifyToSiteEmail: form.notifyToSiteEmail,
      socialLinks: { instagram: form.instagram, tiktok: form.tiktok },
    },
      {
        onSuccess: () => toast.success(t('admin.settings.saved')),
        onError: () => toast.error(t('admin.settings.saveError')),
      },
    );
  };

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Stack spacing={3}>
        <Section title={t('admin.settings.contacts.title')} hint={t('admin.settings.contacts.hint')}>
          <TextField
            label={t('admin.settings.phone')}
            type="tel"
            {...field('phone')}
            InputProps={{ inputComponent: PhoneMaskInput as never }}
            InputLabelProps={{ shrink: true }}
            error={phoneInvalid}
            helperText={phoneInvalid ? t('admin.settings.phoneInvalid') : undefined}
          />
          <TextField
            label={t('admin.settings.email')}
            type="email"
            {...field('email')}
            helperText={fieldError('email') && t('admin.settings.invalidEmail')}
          />
          <TextField label={t('admin.settings.address')} multiline minRows={2} {...field('address')} />
        </Section>

        <Section title={t('admin.settings.map.title')} hint={t('admin.settings.map.hint')}>
          <TextField
            label={t('admin.settings.map.label')}
            multiline
            minRows={3}
            placeholder='<iframe src="https://www.google.com/maps/embed?pb=..." ...></iframe>'
            {...field('mapEmbed')}
            helperText={fieldError('mapEmbed') ? t('admin.settings.map.invalid') : t('admin.settings.map.help')}
          />
          {data?.mapEmbedValid && (
            <Box
              component="iframe"
              src={data.mapEmbed}
              title={t('admin.settings.map.preview')}
              loading="lazy"
              sx={{ width: '100%', height: 240, border: 0, borderRadius: 2 }}
            />
          )}
        </Section>

        <Section title={t('admin.settings.social.title')} hint={t('admin.settings.social.hint')}>
          <TextField
            label="Instagram"
            placeholder="https://instagram.com/…"
            {...field('instagram')}
            helperText={fieldError('socialLinks') && t('admin.settings.social.invalid')}
          />
          <TextField label="TikTok" placeholder="https://tiktok.com/@…" {...field('tiktok')} />
        </Section>

        <Section title={t('admin.settings.house.title')}>
          <TextField
            label={t('admin.settings.capacity')}
            type="number"
            inputProps={{ min: 1, max: 50 }}
            {...field('capacity')}
            fullWidth={false}
            sx={{ maxWidth: 220 }}
            helperText={fieldError('capacity') ? t('admin.settings.capacityInvalid') : t('admin.settings.capacityHelp')}
          />
        </Section>

        <Section title={t('admin.settings.notify.title')} hint={t('admin.settings.notify.hint')}>
          <FormControlLabel
            control={
              <Checkbox
                checked={form.notifyToSiteEmail}
                onChange={(e) => setForm({ ...form, notifyToSiteEmail: e.target.checked })}
              />
            }
            label={t('admin.settings.notifySame')}
          />
          {form.notifyToSiteEmail ? (
            <Typography variant="body2" color="text.secondary">
              {form.email
                ? t('admin.settings.notifySameTo', { email: form.email })
                : t('admin.settings.notifySameEmpty')}
            </Typography>
          ) : (
            <TextField
              label={t('admin.settings.notificationEmail')}
              type="email"
              {...field('notificationEmail')}
              helperText={
                fieldError('notificationEmail')
                  ? t('admin.settings.invalidEmail')
                  : t('admin.settings.notificationEmailHelp')
              }
            />
          )}
        </Section>

        <Box>
          <Button type="submit" variant="contained" size="large" disabled={save.isPending}>
            {save.isPending ? t('admin.settings.saving') : t('admin.settings.save')}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

function ChangePasswordForm() {
  const { t } = useLanguage();
  const toast = useToast();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const tooShort = next.length > 0 && next.length < 10;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = current && next.length >= 10 && confirm === next && !change.isPending;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          setCurrent('');
          setNext('');
          setConfirm('');
          toast.success(t('admin.settings.password.changed'));
        },
        onError: (err) => {
          const code = apiError(err).code;
          toast.error(
            code === 'WRONG_PASSWORD'
              ? t('admin.settings.password.wrongCurrent')
              : code === 'RATE_LIMITED'
                ? t('admin.settings.password.rateLimited')
                : t('admin.settings.password.error'),
          );
        },
      },
    );
  };

  const { code } = apiError(change.error); // red outline on the field only; the message is a toast

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <Section title={t('admin.settings.password.title')} hint={t('admin.settings.password.hint')}>
        <TextField
          label={t('admin.settings.password.current')}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={code === 'WRONG_PASSWORD'}
        />
        <TextField
          label={t('admin.settings.password.new')}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={tooShort}
          helperText={t('admin.settings.password.minLength')}
        />
        <TextField
          label={t('admin.settings.password.confirm')}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch}
          helperText={mismatch ? t('admin.settings.password.mismatch') : ' '}
        />
        <Box>
          <Button type="submit" variant="outlined" disabled={!canSubmit}>
            {t('admin.settings.password.submit')}
          </Button>
        </Box>
      </Section>
    </Box>
  );
}

export function SettingsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('admin.settings.title')}
      </Typography>
      <Stack spacing={3}>
        {isOwner ? (
          <SiteSettingsForm />
        ) : (
          <Alert severity="info">{t('admin.settings.ownerOnly')}</Alert>
        )}
        <ChangePasswordForm />
      </Stack>
    </Box>
  );
}
