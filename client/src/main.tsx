import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import { theme } from '@/theme/theme';
import { App } from '@/app/App';
import '@/styles/global.scss';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
