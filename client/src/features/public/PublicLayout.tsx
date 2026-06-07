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
import InstagramIcon from '@mui/icons-material/Instagram';
import { BurgerIcon } from '@/shared/ui/BurgerIcon';
import { TikTokIcon } from '@/shared/ui/TikTokIcon';
import { useLanguage } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import styles from './PublicLayout.module.scss';

const navLinks = [
  { key: 'nav.about', href: '/#about' },
  { key: 'nav.gallery', href: '/#gallery' },
  { key: 'nav.amenities', href: '/#amenities' },
  { key: 'nav.pricing', href: '/#pricing' },
  { key: 'nav.location', href: '/#location' },
  { key: 'nav.contact', href: '/#contact' },
];

// Owner can swap these for real handles (or wire to SiteSettings.socialLinks later).
const socialLinks = [
  { label: 'Instagram', href: 'https://instagram.com/', icon: <InstagramIcon /> },
  { label: 'TikTok', href: 'https://tiktok.com/', icon: <TikTokIcon /> },
];

const currentYear = new Date().getFullYear();

export function PublicLayout() {
  const navigate = useNavigate();
  const { t } = useLanguage();
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
          <Typography
            variant="h6"
            component="button"
            onClick={handleBrandClick}
            className={styles.brand}
            sx={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            LoveStory
          </Typography>

          {/* desktop inline links */}
          <Box className={styles.links}>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href}>
                {t(l.key)}
              </a>
            ))}
          </Box>

          {/* desktop language switcher + CTA */}
          <Box sx={{ display: { xs: 'none', md: 'inline-flex' }, alignItems: 'center', gap: 1.5 }}>
            <LanguageSwitcher />
            <Button variant="contained" onClick={() => navigate('/booking')}>
              {t('cta.bookNow')}
            </Button>
          </Box>

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
                  primary={t(l.key)}
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

          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <LanguageSwitcher size="medium" />
          </Box>

          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => {
              setMenuOpen(false);
              navigate('/booking');
            }}
          >
            {t('cta.bookNow')}
          </Button>
        </Box>
      </Drawer>

      <main>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <Container>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <Typography variant="h5" className={styles.footerLogo}>
                LoveStory Riverside Retreat
              </Typography>
              <p>{t('footer.tagline')}</p>
            </div>

            <div className={styles.footerSocial}>
              <span className={styles.footerSocialLabel}>{t('footer.follow')}</span>
              <div className={styles.footerSocialIcons}>
                {socialLinks.map((s) => (
                  <IconButton
                    key={s.label}
                    component="a"
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className={styles.footerSocialBtn}
                  >
                    {s.icon}
                  </IconButton>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <span>© {currentYear} LoveStory Riverside Retreat. {t('footer.rights')}</span>
            <span>
             Produced by{' '}
              <a href="https://benedyk.pro" target="_blank" rel="noopener noreferrer">
                benedyk.pro
              </a>
            </span>
          </div>
        </Container>
      </footer>

      {/* Mobile sticky CTA — the conversion anchor on phones */}
      <div className={styles.mobileCta}>
        <Button fullWidth variant="contained" size="large" onClick={() => navigate('/booking')}>
          {t('cta.bookNow')}
        </Button>
      </div>
    </div>
  );
}
