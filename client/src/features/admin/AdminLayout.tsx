import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from './auth/AuthContext';
import { BurgerIcon } from '@/shared/ui/BurgerIcon';

const DRAWER = 240;
const nav = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/statistics', label: 'Statistics' },
  { to: '/admin/requests', label: 'Requests' },
  { to: '/admin/calendar', label: 'Calendar' },
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/content', label: 'Content' },
  { to: '/admin/gallery', label: 'Gallery' },
  { to: '/admin/promotions', label: 'Promotions' },
  { to: '/admin/pricing', label: 'Pricing' },
  { to: '/admin/reviews', label: 'Reviews' },
  { to: '/admin/settings', label: 'Settings' },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawerContent = (
    <>
      <Toolbar>
        <Typography variant="h6" sx={{ fontFamily: "'Cormorant Garamond', serif" }}>
          LoveStory · Admin
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {nav.map((n) => (
          <ListItemButton
            key={n.to}
            component={NavLink}
            to={n.to}
            end={n.end}
            onClick={() => setMobileOpen(false)}
            sx={{ '&.active': { bgcolor: 'action.selected' } }}
          >
            <ListItemText primary={n.label} />
          </ListItemButton>
        ))}
      </List>
    </>
  );

  return (
    <Box sx={{ display: 'flex', bgcolor: 'background.default', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="primary"
        sx={{
          // reserve space for the permanent sidebar on desktop only
          width: { md: `calc(100% - ${DRAWER}px)` },
          ml: { md: `${DRAWER}px` },
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            color="inherit"
            edge="start"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
            sx={{ display: { md: 'none' } }}
          >
            <BurgerIcon open={mobileOpen} />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1, fontFamily: "'Cormorant Garamond', serif" }}>
            {/* brand sits in the AppBar on mobile, in the drawer on desktop */}
            <Box component="span" sx={{ display: { md: 'none' } }}>
              LoveStory · Admin
            </Box>
          </Typography>
          <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
            {user?.name}
          </Typography>
          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={async () => {
              await logout();
              navigate('/admin/login');
            }}
            sx={{ minWidth: 'auto' }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Log out
            </Box>
          </Button>
        </Toolbar>
      </AppBar>

      {/* Mobile: full-screen hamburger menu */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          [`& .MuiDrawer-paper`]: {
            width: '100vw',
            maxWidth: '100%',
            boxSizing: 'border-box',
            bgcolor: '#2b2620', // "bark" — deep charcoal overlay
            color: '#fbf8f1',
          },
        }}
      >
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            // clear the fixed AppBar so the animated X stays tappable to close
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
              justifyContent: 'space-between', // even vertical spacing
              py: 2,
            }}
          >
            {nav.map((n) => (
              <ListItemButton
                key={n.to}
                component={NavLink}
                to={n.to}
                end={n.end}
                onClick={() => setMobileOpen(false)}
                sx={{
                  justifyContent: 'center',
                  borderRadius: 2,
                  '&.active': { bgcolor: 'rgba(255,255,255,0.16)' },
                }}
              >
                <ListItemText
                  primary={n.label}
                  slotProps={{
                    primary: {
                      sx: {
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: '1.6rem',
                        textAlign: 'center',
                      },
                    },
                  }}
                />
              </ListItemButton>
            ))}
          </List>
          <Button
            color="inherit"
            variant="outlined"
            size="large"
            startIcon={<LogoutIcon />}
            onClick={async () => {
              setMobileOpen(false);
              await logout();
              navigate('/admin/login');
            }}
            sx={{ borderColor: 'rgba(255,255,255,0.5)' }}
          >
            Log out
          </Button>
        </Box>
      </Drawer>

      {/* Desktop: permanent sidebar */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          width: DRAWER,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER, boxSizing: 'border-box' },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER}px)` },
          p: { xs: 2, sm: 3 },
          mt: 8,
          minWidth: 0, // allow content to shrink instead of overflowing on mobile
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
