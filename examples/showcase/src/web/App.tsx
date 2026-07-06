import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { DashboardPage } from "./DashboardPage.js";
import { LoginPage } from "./LoginPage.js";
import { loadAuth } from "./utils.js";

function RequireAuth({ children }: { children: ReactNode }) {
  if (!loadAuth()) return <Navigate to="/login" replace />;
  return children;
}

function GuestOnly({ children }: { children: ReactNode }) {
  if (loadAuth()) return <Navigate to="/dashboard" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
