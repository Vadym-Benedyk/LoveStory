import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { PublicLayout } from '@/features/public/PublicLayout';
import { HomePage } from '@/features/public/home/HomePage';
import { BookingPage } from '@/features/public/booking/BookingPage';

// Admin is a separate code-split bundle — never shipped to public visitors.
const AdminApp = lazy(() => import('@/features/admin/AdminApp'));

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
        <Route path="/booking" element={<BookingPage />} />
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
