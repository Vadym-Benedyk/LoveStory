import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { AdminLayout } from './AdminLayout';
import { DashboardPage } from './dashboard/DashboardPage';
import { StatisticsPage } from './statistics/StatisticsPage';
import { RequestsPage } from './requests/RequestsPage';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  if (!user) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
          element={
            <Protected>
              <AdminLayout />
            </Protected>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="statistics" element={<StatisticsPage />} />
          <Route path="requests" element={<RequestsPage />} />
          {/* calendar, bookings, content, gallery, promotions, pricing, reviews, settings
              follow the same pattern — see docs/product-design.md §1 */}
        </Route>
      </Routes>
    </AuthProvider>
  );
}
