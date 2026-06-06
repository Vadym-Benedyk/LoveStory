import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
      setError('Invalid email or password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh', p: 2 }}>
      <Paper elevation={0} sx={{ p: 4, width: 'min(420px, 100%)', borderRadius: 4 }}>
        <Typography variant="h4" gutterBottom>
          Owner login
        </Typography>
        <form onSubmit={submit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" variant="contained" size="large" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
