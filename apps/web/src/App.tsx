import { Routes, Route, Navigate } from 'react-router-dom';
import TabletPage from './features/tablet/TabletPage';
import DriverPage from './features/driver/DriverPage';
import DashboardPage from './features/dashboard/DashboardPage';
import FarmerRegistrationPage from './features/farmer-registration/FarmerRegistrationPage';
import FormListPage from './features/forms/FormListPage';
import FormBuilderPage from './features/forms/FormBuilderPage';
import FormImportPage from './features/forms/import/FormImportPage';
import EmployeeRegisterPage from './features/employees/EmployeeRegisterPage';
import GuardScannerPage from './features/guard/GuardScannerPage';
import TimesheetDashboardPage from './features/timesheet/TimesheetDashboardPage';
import ShipmentRegisterPage from './features/shipments/ShipmentRegisterPage';
import ShipmentsDashboardPage from './features/shipments/ShipmentsDashboardPage';
import ShipmentDetailPage from './features/shipments/ShipmentDetailPage';
import OrgModulesPage from './features/admin/OrgModulesPage';
import BillingSettingsPage from './features/billing/BillingSettingsPage';
import SettingsPage from './features/settings/SettingsPage';
import OnboardingWizard from './features/onboarding/OnboardingWizard';
import AcceptInvitePage from './features/onboarding/AcceptInvitePage';
import AuthCallbackPage from './features/auth/AuthCallbackPage';
import { AppShellLayout } from './components/layout/AppShellLayout';
import { useAuth } from './context/AuthContext';
import { MARKETING_URL } from './lib/marketingUrl';

/**
 * Login and signup live on the marketing site now — this app is post-auth
 * only. The root route sends an authenticated visitor to their dashboard;
 * an unauthenticated one is bounced out to the marketing site's real login,
 * not an in-app form (there isn't one anymore).
 */
function RootRedirect() {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) {
        window.location.href = `${MARKETING_URL}/login`;
        return null;
    }
    return <Navigate to="/app/dashboard" replace />;
}

export function App() {
    return (
        <Routes>
            {/* Both "/" (local standalone dev, port 3000 root) and "/app"
                (production, this bundle is served from /app/* under the
                marketing domain) land on the same auth-based redirect. */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/app" element={<RootRedirect />} />
            <Route path="/app/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/app/onboarding" element={<OnboardingWizard />} />
            <Route path="/app/invite/:token" element={<AcceptInvitePage />} />

            {/* Station-token kiosk routes: unattended facility-floor devices
                authenticate via STATION_TOKEN, not a user session, so they
                stay outside the shell's login-redirect gate. */}
            <Route path="/app/bin" element={<TabletPage />} />
            <Route path="/app/guard" element={<GuardScannerPage />} />
            <Route path="/app/forms" element={<FormListPage />} />
            <Route path="/app/animalregistration" element={<FarmerRegistrationPage />} />
            <Route path="/app/shipments/new" element={<ShipmentRegisterPage />} />

            <Route element={<AppShellLayout />}>
                <Route path="/app/driver" element={<DriverPage />} />
                <Route path="/app/dashboard" element={<DashboardPage />} />
                <Route path="/app/employees/register" element={<EmployeeRegisterPage />} />
                <Route path="/app/timesheet" element={<TimesheetDashboardPage />} />
                <Route path="/app/shipments" element={<ShipmentsDashboardPage />} />
                <Route path="/app/shipments/:id" element={<ShipmentDetailPage />} />
                <Route path="/app/forms/new" element={<FormBuilderPage />} />
                <Route path="/app/forms/import" element={<FormImportPage />} />
                <Route path="/app/admin/orgs" element={<OrgModulesPage />} />
                <Route path="/app/settings" element={<SettingsPage />} />
                <Route path="/app/settings/billing" element={<BillingSettingsPage />} />
            </Route>
        </Routes>
    );
}
