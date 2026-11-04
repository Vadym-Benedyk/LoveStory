import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from './AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/admin');
    } catch {
      setError(t('admin.login.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh', p: 2 }}>
      <Paper elevation={0} sx={{ p: 4, width: 'min(420px, 100%)', borderRadius: 4 }}>
        <Stack direction="row" justifyContent="flex-end" mb={1}>
          <LanguageSwitcher />
        </Stack>
        <Typography variant="h4" gutterBottom>
          {t('admin.login.title')}
        </Typography>
        <form onSubmit={submit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label={t('admin.login.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              label={t('admin.login.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" variant="contained" size="large" disabled={busy}>
              {busy ? t('admin.login.signingIn') : t('admin.login.signIn')}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
