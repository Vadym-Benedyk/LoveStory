import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { PublicLayout } from '@/features/public/PublicLayout';
import { HomePage } from '@/features/public/home/HomePage';
import { BookingPage } from '@/features/public/booking/BookingPage';
import { TermsPage } from '@/features/public/terms/TermsPage';

// Admin is a separate code-split bundle — never shipped to public visitors.
const AdminApp = lazy(() => import('@/features/admin/AdminApp'));

// Every navigation to /booking (incl. the header "Book" button while already on /booking, e.g.
// on the "request received" screen) gets a new location.key → fresh form instead of a no-op.
function BookingRoute() {
  const { key } = useLocation();
  return <BookingPage key={key} />;
}

const Loader = () => (
  <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
    <CircularProgress />
  </Box>
);

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/booking" element={<BookingRoute />} />
        <Route path="/terms" element={<TermsPage />} />
      </Route>
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<Loader />}>
            <AdminApp />
          </Suspense>
        }
      />
    </Routes>
  );
}
