import { Navigate } from "react-router-dom";
import { getCurrentUser } from "../utils/auth";

function ProtectedRoute({ children, allowedRoles }) {
  const user = getCurrentUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;