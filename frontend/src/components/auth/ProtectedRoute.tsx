/**
 * Protected Route Wrapper — LoopIn Frontend
 *
 * Redirects unauthenticated users to /login while preserving destination path.
 * Renders full page loader during session restoration.
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/authContext.tsx";
import { PageLoader } from "@/components/ui/shared.tsx";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader />;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
