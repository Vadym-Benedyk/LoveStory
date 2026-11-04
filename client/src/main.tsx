import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, CssBaseline, StyledEngineProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import { theme } from '@/theme/theme';
import { App } from '@/app/App';
import { LanguageProvider } from '@/i18n/LanguageContext';
import '@/styles/global.scss';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* MUI's (emotion) styles go first in <head>, so our SCSS modules — loaded earlier by Vite —
        can override component styles at equal specificity. Without this, MUI silently won and
        e.g. the hero title kept 96px on phones (clamp() in HomePage.module.scss was ignored),
        causing horizontal scroll. */}
    <StyledEngineProvider injectFirst>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <LanguageProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StyledEngineProvider>
  </React.StrictMode>,
);
