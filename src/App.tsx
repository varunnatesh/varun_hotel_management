import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore, ROLE_HOME } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import type { UserRole } from './types';

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
const Login           = lazy(() => import('./pages/auth/Login'));
const OwnerDashboard  = lazy(() => import('./pages/owner/Dashboard'));
const StoreDashboard  = lazy(() => import('./pages/store/Dashboard'));
const KitchenDisplay  = lazy(() => import('./pages/kitchen/Display'));
const CashierNewOrder = lazy(() => import('./pages/cashier/NewOrder'));
const MenuManagement  = lazy(() => import('./pages/owner/Menu'));
const StaffManagement = lazy(() => import('./pages/owner/Staff'));
const ExpensesPage    = lazy(() => import('./pages/owner/Expenses'));
const AlertsPage      = lazy(() => import('./pages/owner/Alerts'));
const ApprovalsPage   = lazy(() => import('./pages/owner/Approvals'));
const AuditLog        = lazy(() => import('./pages/owner/AuditLog'));
const SupervisorDash  = lazy(() => import('./pages/supervisor/Dashboard'));
const ReportsPage     = lazy(() => import('./pages/owner/Reports'));
const LiveOrders      = lazy(() => import('./pages/owner/LiveOrders'));
const HealthScore     = lazy(() => import('./pages/owner/HealthScore'));
const SettingsPage    = lazy(() => import('./pages/owner/Settings'));
const CashierPayments = lazy(() => import('./pages/cashier/Payments'));
const KitchenWaste    = lazy(() => import('./pages/kitchen/WasteLog'));
const RequestStock    = lazy(() => import('./pages/kitchen/RequestStock'));
const CaptainTables   = lazy(() => import('./pages/captain/Tables'));
const TableOrder      = lazy(() => import('./pages/captain/TableOrder'));
const QRTablesPage    = lazy(() => import('./pages/cashier/QRTables'));
const CashierBilling  = lazy(() => import('./pages/cashier/Billing'));

// Placeholder pages (will be built in Phases 2–6)
const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950">
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-500/12 flex items-center justify-center">
        <span className="text-2xl">🏗️</span>
      </div>
      <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100 mb-2">{title}</h2>
      <p className="text-surface-500 text-sm">This page is being built — coming in Phase {getPhase(title)}</p>
    </div>
  </div>
);
function getPhase(title: string) {
  if (title.includes('Store'))  return '3';
  if (title.includes('Kitchen')) return '4';
  if (title.includes('Cashier') || title.includes('Supervisor')) return '5';
  if (title.includes('Report') || title.includes('Audit')) return '6';
  return '2';
}

// ─── Loading Fallback ─────────────────────────────────────────────────────────
const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-brand animate-pulse-soft">
        <span className="text-white font-bold text-lg">V</span>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ─── Protected Route ──────────────────────────────────────────────────────────
interface ProtectedRouteProps {
  children:     React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isInitialized } = useAuthStore();

  if (!isInitialized) return <PageLoader />;
  if (!user)          return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }
  return <>{children}</>;
};

// ─── Root Redirect ────────────────────────────────────────────────────────────
const RootRedirect: React.FC = () => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[user.role]} replace />;
};

// ─── App ──────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const { initialize } = useAuthStore();
  const { isDark }     = useThemeStore();

  // Initialize auth session on app load
  useEffect(() => { initialize(); }, [initialize]);

  // Apply theme class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* ── Owner Routes ── */}
          <Route path="/owner/dashboard" element={
            <ProtectedRoute allowedRoles={['owner']}>
              <OwnerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/owner/orders"    element={<ProtectedRoute allowedRoles={['owner']}><LiveOrders /></ProtectedRoute>} />
          <Route path="/owner/alerts"    element={<ProtectedRoute allowedRoles={['owner']}><AlertsPage /></ProtectedRoute>} />
          <Route path="/owner/approvals" element={<ProtectedRoute allowedRoles={['owner']}><ApprovalsPage /></ProtectedRoute>} />
          <Route path="/owner/menu"      element={<ProtectedRoute allowedRoles={['owner']}><MenuManagement /></ProtectedRoute>} />
          <Route path="/owner/inventory" element={<ProtectedRoute allowedRoles={['owner']}><StoreDashboard /></ProtectedRoute>} />
          <Route path="/owner/staff"     element={<ProtectedRoute allowedRoles={['owner']}><StaffManagement /></ProtectedRoute>} />
          <Route path="/owner/expenses"  element={<ProtectedRoute allowedRoles={['owner']}><ExpensesPage /></ProtectedRoute>} />
          <Route path="/owner/revenue"   element={<ProtectedRoute allowedRoles={['owner']}><ReportsPage /></ProtectedRoute>} />
          <Route path="/owner/reports"   element={<ProtectedRoute allowedRoles={['owner']}><ReportsPage /></ProtectedRoute>} />
          <Route path="/owner/audit"     element={<ProtectedRoute allowedRoles={['owner']}><AuditLog /></ProtectedRoute>} />
          <Route path="/owner/health"    element={<ProtectedRoute allowedRoles={['owner']}><HealthScore /></ProtectedRoute>} />
          <Route path="/owner/settings"  element={<ProtectedRoute allowedRoles={['owner']}><SettingsPage /></ProtectedRoute>} />

          {/* ── Store Manager Routes ── */}
          <Route path="/store/dashboard" element={<ProtectedRoute allowedRoles={['store_manager','owner']}><StoreDashboard /></ProtectedRoute>} />
          <Route path="/store/stock"     element={<ProtectedRoute allowedRoles={['store_manager','owner']}><StoreDashboard /></ProtectedRoute>} />
          <Route path="/store/issue"     element={<ProtectedRoute allowedRoles={['store_manager','owner']}><StoreDashboard /></ProtectedRoute>} />
          <Route path="/store/purchases" element={<ProtectedRoute allowedRoles={['store_manager','owner']}><StoreDashboard /></ProtectedRoute>} />
          <Route path="/store/returns"   element={<ProtectedRoute allowedRoles={['store_manager','owner']}><StoreDashboard /></ProtectedRoute>} />

          {/* ── Kitchen Routes ── */}
          <Route path="/kitchen/display" element={<ProtectedRoute allowedRoles={['kitchen','supervisor','owner']}><KitchenDisplay /></ProtectedRoute>} />
          <Route path="/kitchen/waste"   element={<ProtectedRoute allowedRoles={['kitchen','supervisor','owner']}><KitchenWaste /></ProtectedRoute>} />
          <Route path="/kitchen/request" element={<ProtectedRoute allowedRoles={['kitchen','supervisor','owner']}><RequestStock /></ProtectedRoute>} />

          {/* ── Supervisor / Kitchen Supervisor Routes ── */}
          <Route path="/supervisor/dashboard"  element={<ProtectedRoute allowedRoles={['supervisor','owner']}><SupervisorDash /></ProtectedRoute>} />
          <Route path="/supervisor/orders"     element={<ProtectedRoute allowedRoles={['supervisor','owner']}><KitchenDisplay /></ProtectedRoute>} />
          <Route path="/supervisor/approvals"  element={<ProtectedRoute allowedRoles={['supervisor','owner']}><ApprovalsPage /></ProtectedRoute>} />
          <Route path="/supervisor/complaints" element={<ProtectedRoute allowedRoles={['supervisor','owner']}><KitchenWaste /></ProtectedRoute>} />

          {/* ── Cashier Routes ── */}
          <Route path="/cashier/new-order"   element={<ProtectedRoute allowedRoles={['cashier','supervisor','owner']}><CashierNewOrder /></ProtectedRoute>} />
          <Route path="/cashier/billing"     element={<ProtectedRoute allowedRoles={['cashier','supervisor','owner']}><CashierBilling /></ProtectedRoute>} />
          <Route path="/cashier/table-order" element={<ProtectedRoute allowedRoles={['cashier','supervisor','owner']}><TableOrder /></ProtectedRoute>} />
          <Route path="/cashier/orders"      element={<ProtectedRoute allowedRoles={['cashier','supervisor','owner']}><LiveOrders /></ProtectedRoute>} />
          <Route path="/cashier/payments"    element={<ProtectedRoute allowedRoles={['cashier','supervisor','owner']}><CashierPayments /></ProtectedRoute>} />
          <Route path="/cashier/qr"          element={<ProtectedRoute allowedRoles={['cashier','supervisor','owner']}><QRTablesPage /></ProtectedRoute>} />

          {/* ── Captain Routes ── */}
          <Route path="/captain/tables"      element={<ProtectedRoute allowedRoles={['captain','supervisor','owner']}><CaptainTables /></ProtectedRoute>} />
          <Route path="/captain/table-order" element={<ProtectedRoute allowedRoles={['captain','cashier','supervisor','owner']}><TableOrder /></ProtectedRoute>} />
          <Route path="/captain/new-order"   element={<ProtectedRoute allowedRoles={['captain','supervisor','owner']}><CashierNewOrder /></ProtectedRoute>} />
          <Route path="/captain/orders"      element={<ProtectedRoute allowedRoles={['captain','supervisor','owner']}><LiveOrders /></ProtectedRoute>} />

          {/* ── Public QR Menu ── */}
          <Route path="/menu"     element={<Placeholder title="QR Menu" />} />
          <Route path="/my-order" element={<Placeholder title="My Order Status" />} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background:  isDark ? '#1e293b' : '#ffffff',
            color:       isDark ? '#f1f5f9' : '#0f172a',
            border:      `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            borderRadius: '12px',
            fontSize:    '13px',
            fontFamily:  'Inter, sans-serif',
            boxShadow:   '0 4px 20px rgba(0,0,0,0.15)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  );
};

export default App;
