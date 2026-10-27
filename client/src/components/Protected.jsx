import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Spinner from "./Spinner.jsx";

export default function Protected({ children, roles }) {
  const { user, role, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(role)) {
    return (
      <div className="card p-8">
        <h2 className="text-lg font-semibold">Access denied</h2>
        <p className="text-sm text-slate-600 mt-2">Your workspace role cannot open this page.</p>
      </div>
    );
  }
  return children;
}
