// App-wide toasts for the RESULT of an action ("Saved", "Could not change the status").
// Use inline messages instead for form validation (next to the field) and for persistent states.
//
//   const toast = useToast();
//   toast.success('Saved');  toast.error('Could not save');  toast.warning('…');  toast.info('…');
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Box, Stack } from '@mui/material';

type Severity = 'success' | 'error' | 'warning' | 'info';
interface Toast {
  id: number;
  severity: Severity;
  message: string;
}

// Errors stay longer: they are easy to miss and often need to be read twice.
const DURATION: Record<Severity, number> = { success: 4000, info: 5000, warning: 7000, error: 9000 };
const MAX_VISIBLE = 4;

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (severity: Severity, message: string) => {
      const id = ++nextId.current;
      setToasts((all) => {
        // The same message twice in a row (e.g. a repeated failed click) replaces the old one.
        const rest = all.filter((t) => !(t.severity === severity && t.message === message));
        return [...rest, { id, severity, message }].slice(-MAX_VISIBLE);
      });
      timers.current.set(id, window.setTimeout(() => dismiss(id), DURATION[severity]));
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      warning: (m) => push('warning', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Box
        aria-live="polite"
        sx={{
          position: 'fixed',
          zIndex: (theme) => theme.zIndex.snackbar,
          // Bottom-right corner; on phones the 16px gutters make it span the screen width.
          right: 16,
          bottom: 16,
          width: 'min(420px, calc(100vw - 32px))',
          pointerEvents: 'none', // only the toasts themselves are clickable
        }}
      >
        <Stack spacing={1}>
          {toasts.map((t) => (
            <Alert
              key={t.id}
              severity={t.severity}
              onClose={() => dismiss(t.id)}
              sx={{ pointerEvents: 'auto', boxShadow: '0 8px 24px rgba(43, 38, 32, 0.18)' }}
            >
              {t.message}
            </Alert>
          ))}
        </Stack>
      </Box>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
