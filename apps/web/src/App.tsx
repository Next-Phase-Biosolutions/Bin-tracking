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
import SignupPage from './features/onboarding/SignupPage';
import OnboardingWizard from './features/onboarding/OnboardingWizard';
import AcceptInvitePage from './features/onboarding/AcceptInvitePage';
import LoginPage from './features/auth/LoginPage';
import AuthCallbackPage from './features/auth/AuthCallbackPage';
import { AppShellLayout } from './components/layout/AppShellLayout';
import { useAuth } from './context/AuthContext';

/**
 * The marketing pages (home, about, solutions, process) now live in the
 * separate apps/marketing site. The app's root route just routes an
 * unauthenticated visitor to /login and an authenticated one to their
 * dashboard.
 */
function RootRedirect() {
    const { user, loading } = useAuth();
    if (loading) return null;
    return <Navigate to={user ? '/app/dashboard' : '/login'} replace />;
}

export function App() {
    return (
        <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/onboarding" element={<OnboardingWizard />} />
            <Route path="/invite/:token" element={<AcceptInvitePage />} />

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
                <Route path="/admin/orgs" element={<OrgModulesPage />} />
                <Route path="/settings/billing" element={<BillingSettingsPage />} />
            </Route>
        </Routes>
    );
}
