import { Routes, Route, Navigate } from "react-router-dom";
import { FacilityLayout } from "@/features/_layout/FacilityLayout";
import LoginPage from "@/features/auth/LoginPage";
import DashboardPage from "@/features/dashboard/DashboardPage";
import BinScannerPage from "@/features/bin-scanner/BinScannerPage";
import EmployeeScannerPage from "@/features/employee-scanner/EmployeeScannerPage";
import TimesheetPage from "@/features/timesheet/TimesheetPage";
import FormsPage from "@/features/forms/FormsPage";
import FormFillPage from "@/features/forms/FormFillPage";
import FormImportPage from "@/features/forms/FormImportPage";
import ShipmentsPage from "@/features/shipments/ShipmentsPage";
import NewShipmentPage from "@/features/shipments/NewShipmentPage";
import EmployeeRegisterPage from "@/features/employees/EmployeeRegisterPage";
import AnimalRegistrationPage from "@/features/animal-registration/AnimalRegistrationPage";
import ZonePage from "@/features/zones/ZonePage";
import DriverPage from "@/features/driver/DriverPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<FacilityLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/bin-scanner" element={<BinScannerPage />} />
        <Route path="/employee-scanner" element={<EmployeeScannerPage />} />
        <Route path="/timesheet" element={<TimesheetPage />} />
        <Route path="/forms" element={<FormsPage />} />
        <Route path="/forms/import" element={<FormImportPage />} />
        <Route path="/forms/:id" element={<FormFillPage />} />
        <Route path="/shipments" element={<ShipmentsPage />} />
        <Route path="/shipments/new" element={<NewShipmentPage />} />
        <Route path="/employees/register" element={<EmployeeRegisterPage />} />
        <Route path="/animal-registration" element={<AnimalRegistrationPage />} />
        <Route path="/zones/:zone" element={<ZonePage />} />
        <Route path="/driver" element={<DriverPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
