// Phone and "new booking" notification email shown in Content → Contacts.
// They are NOT content: they live in Settings (SiteSettings) and share its query cache, so editing
// here or in Settings is the same data — a save in one place shows up in the other immediately.
import { useEffect, useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, Link, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { useToast } from '@/shared/ui/ToastProvider';
import { PhoneMaskInput, formatUaPhone, isCompleteUaPhone, isEmptyPhone, phoneToDigits } from '@/shared/ui/PhoneMaskInput';
import { useAuth } from '../auth/AuthContext';
import { useAdminSettings, useSaveSettings } from '../api';

function Inner() {
  const { t } = useLanguage();
  const toast = useToast();
  const { data } = useAdminSettings();
  const save = useSaveSettings();
  const [phone, setPhone] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [sameEmail, setSameEmail] = useState(false);

  // Reseed whenever the shared settings change (initial load, or a save made on the Settings page).
  useEffect(() => {
    if (!data) return;
    setPhone(phoneToDigits(data.phone));
    setNotificationEmail(data.notificationEmail);
    setSameEmail(data.notifyToSiteEmail);
  }, [data]);

  if (!data) return null;
  const phoneUntouched = phone === phoneToDigits(data.phone);
  const phoneInvalid = !phoneUntouched && !isEmptyPhone(phone) && !isCompleteUaPhone(phone);
  const dirty =
    !phoneUntouched || notificationEmail !== data.notificationEmail || sameEmail !== data.notifyToSiteEmail;
  const emailInvalid = Boolean(
    (save.error as { response?: { data?: { error?: { details?: { fieldErrors?: Record<string, string[]> } } } } } | null)
      ?.response?.data?.error?.details?.fieldErrors?.notificationEmail,
  );

  const onSave = () =>
    !phoneInvalid &&
    save.mutate(
      {
        phone: phoneUntouched ? data.phone : isEmptyPhone(phone) ? '' : formatUaPhone(phone),
        notificationEmail,
        notifyToSiteEmail: sameEmail,
      },
      {
        onSuccess: () => toast.success(t('admin.settings.saved')),
        onError: () => toast.error(t('admin.settings.saveError')),
      },
    );

  return (
    <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle1" fontWeight={600}>
        {t('admin.content.contactSettings.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" mt={0.5}>
        {t('admin.content.contactSettings.hint')}{' '}
        <Link component={RouterLink} to="/admin/settings">
          {t('admin.nav.settings')}
        </Link>
      </Typography>
      <Stack spacing={2} mt={2}>
        <TextField
          label={t('admin.settings.phone')}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          InputProps={{ inputComponent: PhoneMaskInput as never }}
          InputLabelProps={{ shrink: true }}
          error={phoneInvalid}
          helperText={phoneInvalid ? t('admin.settings.phoneInvalid') : t('admin.content.contactSettings.phoneHelp')}
          fullWidth
        />
        <FormControlLabel
          control={<Checkbox checked={sameEmail} onChange={(e) => setSameEmail(e.target.checked)} />}
          label={t('admin.settings.notifySame')}
        />
        {sameEmail ? (
          <Typography variant="body2" color="text.secondary">
            {data.email
              ? t('admin.settings.notifySameTo', { email: data.email })
              : t('admin.settings.notifySameEmpty')}
          </Typography>
        ) : (
          <TextField
            label={t('admin.settings.notify.title')}
            type="email"
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            error={emailInvalid}
            helperText={emailInvalid ? t('admin.settings.invalidEmail') : t('admin.content.contactSettings.notifyHelp')}
            fullWidth
          />
        )}
        <Box>
          <Button variant="outlined" disabled={!dirty || phoneInvalid || save.isPending} onClick={onSave}>
            {save.isPending ? t('admin.settings.saving') : t('admin.content.contactSettings.save')}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

export function ContactSettingsBlock() {
  const { user } = useAuth();
  const { t } = useLanguage();
  // Settings are owner-only on the server, so other roles only get a pointer.
  if (user?.role !== 'OWNER') {
    return (
      <Typography variant="body2" color="text.secondary" mt={2}>
        {t('admin.content.contactSettings.ownerOnly')}
      </Typography>
    );
  }
  return <Inner />;
}
