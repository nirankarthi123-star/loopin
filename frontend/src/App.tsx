import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout.tsx";
import { LandingPage } from "@/pages/LandingPage.tsx";
import { DashboardPage } from "@/pages/DashboardPage.tsx";
import { ExplorePage } from "@/pages/ExplorePage.tsx";
import { ItemDetailPage } from "@/pages/ItemDetailPage.tsx";
import { ListItemPage } from "@/pages/ListItemPage.tsx";
import { MyItemsPage } from "@/pages/MyItemsPage.tsx";
import { MyLoopPage } from "@/pages/MyLoopPage.tsx";
import { CommunityImpactPage } from "@/pages/CommunityImpactPage.tsx";
import { ProfilePage } from "@/pages/ProfilePage.tsx";
import { LoginPage } from "@/pages/LoginPage.tsx";
import { RegisterPage } from "@/pages/RegisterPage.tsx";
import { AuthProvider } from "@/lib/authContext.tsx";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute.tsx";

/**
 * Root application router.
 *
 * Configured with Cognito AuthProvider and ProtectedRoute guards.
 * Supports dual modes:
 *   - "demo"  → local mock Cognito session & data
 *   - "aws"   → real Amazon Cognito User Pool & API Gateway HTTP API
 */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Pre-Auth Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Authenticated Application Routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/items/new" element={<ListItemPage />} />
            <Route path="/items/:itemId" element={<ItemDetailPage />} />
            <Route path="/my-items" element={<MyItemsPage />} />
            <Route path="/my-loop" element={<MyLoopPage />} />
            <Route path="/community" element={<CommunityImpactPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* Legacy route redirects */}
            <Route path="/catalogue" element={<Navigate to="/explore" replace />} />
            <Route path="/my-loans" element={<Navigate to="/my-loop" replace />} />
          </Route>

          {/* Catch-all redirect to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
