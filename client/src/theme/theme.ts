import { createTheme } from '@mui/material/styles';

// Mirrors src/styles/_tokens.scss — keep both in sync.
const tokens = {
  forest: '#3e5641',
  clay: '#b5651d',
  sand: '#f5f0e6',
  cream: '#fbf8f1',
  bark: '#2b2620',
  river: '#5b7e8c',
};

export const theme = createTheme({
  palette: {
    primary: { main: tokens.forest },
    secondary: { main: tokens.clay },
    info: { main: tokens.river },
    background: { default: tokens.sand, paper: tokens.cream },
    text: { primary: tokens.bark },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
    // Fluid sizes: MUI defaults (6 / 3.75 / 3rem) on desktop, smaller on phones so long
    // Ukrainian words ("проживання", "приватний") never push the page wider than the screen.
    h1: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: 'clamp(2.5rem, 9vw, 6rem)' },
    h2: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: 'clamp(2.25rem, 7vw, 3.75rem)' },
    h3: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontSize: 'clamp(1.875rem, 6vw, 3rem)' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 999, paddingInline: 22 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
});

export const statusColors = {
  available: '#4f7a52',
  pending: '#c8841f',
  confirmed: '#9a958c',
} as const;
