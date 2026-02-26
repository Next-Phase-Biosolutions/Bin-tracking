import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { SolutionsPage } from './pages/SolutionsPage';
import { ProcessPage } from './pages/ProcessPage';
import TabletPage from './features/tablet/TabletPage';
import DriverPage from './features/driver/DriverPage';
import DashboardPage from './features/dashboard/DashboardPage';

export function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/solutions" element={<SolutionsPage />} />
            <Route path="/process" element={<ProcessPage />} />
            <Route path="/app/tablet/:stationId" element={<TabletPage />} />
            <Route path="/app/driver" element={<DriverPage />} />
            <Route path="/app/dashboard" element={<DashboardPage />} />
        </Routes>
    );
}
