import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
// Load screens on demand. In particular, this keeps the charting library out
// of the initial login bundle for quicker first-page delivery.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Employees = lazy(() => import("./pages/Employees"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Visitors = lazy(() => import("./pages/Visitors"));
const Approvals = lazy(() => import("./pages/Approvals"));
const ActivityHistory = lazy(() => import("./pages/ActivityHistory"));
const UserAccounts = lazy(() => import("./pages/UserAccounts"));
const Reports = lazy(() => import("./pages/Reports"));

function App() {
  return (
    <Suspense fallback={<main className="page-content"><p>Loading…</p></main>}>
      <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* All roles have a dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin", "receptionist", "employee"]}>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Admin: "Manage Employees" */}
      <Route
        path="/employees"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Employees />
          </ProtectedRoute>
        }
      />

      {/* Receptionist: Separate routes for distinct views */}
      <Route
        path="/visitors"
        element={
          <ProtectedRoute allowedRoles={["receptionist"]}>
            <Visitors viewMode="all" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/register-visitor"
        element={
          <ProtectedRoute allowedRoles={["receptionist"]}>
            <Visitors viewMode="register" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/check-in-out"
        element={
          <ProtectedRoute allowedRoles={["receptionist"]}>
            <Visitors viewMode="checkin" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/visitor-history"
        element={
          <ProtectedRoute allowedRoles={["receptionist"]}>
            <Visitors viewMode="history" />
          </ProtectedRoute>
        }
      />

      {/* Employee: view / approve / reject visitor requests */}
      <Route
        path="/approvals"
        element={
          <ProtectedRoute allowedRoles={["employee"]}>
            <Approvals />
          </ProtectedRoute>
        }
      />

      {/* Admin: "Manage User Accounts" */}
      <Route
        path="/user-accounts"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <UserAccounts />
          </ProtectedRoute>
        }
      />

      {/* Admin: "View Visitor Reports" */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Reports />
          </ProtectedRoute>
        }
      />

      {/* Admin & Employee: Activity History */}
      <Route
        path="/activity-history"
        element={
          <ProtectedRoute allowedRoles={["admin", "employee"]}>
            <ActivityHistory />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
