import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Button,
  Box,
  Container,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import { BurgerIcon } from '@/shared/ui/BurgerIcon';
import styles from './PublicLayout.module.scss';

const navLinks = [
  { label: 'About', href: '/#about' },
  { label: 'Gallery', href: '/#gallery' },
  { label: 'Amenities', href: '/#amenities' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Location', href: '/#location' },
  { label: 'Contact', href: '/#contact' },
];

export function PublicLayout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleBrandClick = () => {
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={styles.shell}>
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        className={styles.nav}
        // keep the AppBar (and the animated X) above the full-screen menu
        sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <Typography variant="h6" component="button" onClick={handleBrandClick} className={styles.brand} sx={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            LoveStory
          </Typography>

          {/* desktop inline links */}
          <Box className={styles.links}>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </Box>

          {/* desktop CTA */}
          <Button
            variant="contained"
            onClick={() => navigate('/booking')}
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          >
            Book now
          </Button>

          {/* mobile spacer to push burger to the right */}
          <Box sx={{ flex: 1, display: { xs: 'block', md: 'none' } }} />

          {/* mobile: navigation menu burger (replaces the CTA button) */}
          <IconButton
            color="inherit"
            edge="end"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'text.primary', mr: '15px' }}
          >
            <BurgerIcon open={menuOpen} />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Mobile full-screen navigation menu */}
      <Drawer
        variant="temporary"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          [`& .MuiDrawer-paper`]: {
            width: '100vw',
            maxWidth: '100%',
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
          },
        }}
      >
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            pt: 8,
            pb: 'calc(2rem + env(safe-area-inset-bottom))',
            px: 3,
          }}
        >
          <List
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              py: 2,
            }}
          >
            {navLinks.map((l) => (
              <ListItemButton
                key={l.href}
                component="a"
                href={l.href}
                onClick={() => setMenuOpen(false)}
                sx={{ justifyContent: 'center', borderRadius: 2 }}
              >
                <ListItemText
                  primary={l.label}
                  slotProps={{
                    primary: {
                      sx: {
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: '1.8rem',
                        textAlign: 'center',
                      },
                    },
                  }}
                />
              </ListItemButton>
            ))}
          </List>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => {
              setMenuOpen(false);
              navigate('/booking');
            }}
          >
            Book now
          </Button>
        </Box>
      </Drawer>

      <main>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <Container>
          <Typography variant="h5" gutterBottom>
            LoveStory Riverside Retreat
          </Typography>
          <p>A private riverside escape. Bookings confirmed personally by phone.</p>
        </Container>
      </footer>

      {/* Mobile sticky CTA — the conversion anchor on phones */}
      <div className={styles.mobileCta}>
        <Button fullWidth variant="contained" size="large" onClick={() => navigate('/booking')}>
          Book now
        </Button>
      </div>
    </div>
  );
}
