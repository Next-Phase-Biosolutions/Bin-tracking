import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { SolutionsPage } from './pages/SolutionsPage';
import { ProcessPage } from './pages/ProcessPage';
import TabletPage from './features/tablet/TabletPage';
import DriverPage from './features/driver/DriverPage';
import DashboardPage from './features/dashboard/DashboardPage';
import { AboutPage } from './pages/AboutPage';
import FarmerRegistrationPage from './features/farmer-registration/FarmerRegistrationPage';
import FormListPage from './features/forms/FormListPage';
import FormBuilderPage from './features/forms/FormBuilderPage';
import FacilityLayout from './features/dashboard/FacilityLayout';
import FacilityDashboardPage from './features/dashboard/FacilityDashboardPage';
import ReceivingZonePage from './features/dashboard/ReceivingZonePage';
import KillFloorPage from './features/dashboard/KillFloorPage';
import WetAgingPage from './features/dashboard/WetAgingPage';
import ValueAddPage from './features/dashboard/ValueAddPage';

export function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/solutions" element={<SolutionsPage />} />
            <Route path="/process" element={<ProcessPage />} />
            <Route path="/app/bin" element={<TabletPage />} />
            <Route path="/app/driver" element={<DriverPage />} />
            <Route path="/app/dashboard" element={<DashboardPage />} />
            <Route path="/app/animalregistration" element={<FarmerRegistrationPage />} />
            <Route path="/app/forms" element={<FormListPage />} />
            <Route path="/app/forms/new" element={<FormBuilderPage />} />
            <Route path="/app/facility" element={<FacilityLayout />}>
                <Route index element={<FacilityDashboardPage />} />
                <Route path="receiving" element={<ReceivingZonePage />} />
                <Route path="killfloor" element={<KillFloorPage />} />
                <Route path="wetaging" element={<WetAgingPage />} />
                <Route path="valueadd" element={<ValueAddPage />} />
            </Route>
        </Routes>
    );
}
