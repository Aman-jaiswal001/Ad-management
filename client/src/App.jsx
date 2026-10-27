import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import Protected from "./components/Protected.jsx";
import AppLayout from "./layouts/AppLayout.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Overview from "./pages/Overview.jsx";
import NewReview from "./pages/NewReview.jsx";
import Drafts from "./pages/Drafts.jsx";
import DraftDetail from "./pages/DraftDetail.jsx";
import ReviewQueue from "./pages/ReviewQueue.jsx";
import KnowledgeBase from "./pages/KnowledgeBase.jsx";
import { AssetsPage, ClaimsPage, GuidelinesPage, TerminologyPage } from "./pages/CrudPages.jsx";
import Analytics from "./pages/Analytics.jsx";
import AuditLogs from "./pages/AuditLogs.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <Protected>
                <AppLayout />
              </Protected>
            }
          >
            <Route index element={<Overview />} />
            <Route path="reviews/new" element={<NewReview />} />
            <Route path="drafts" element={<Drafts />} />
            <Route path="drafts/:id" element={<DraftDetail />} />
            <Route
              path="queue"
              element={
                <Protected roles={["ADMIN", "MANAGER", "REVIEWER"]}>
                  <ReviewQueue />
                </Protected>
              }
            />
            <Route path="knowledge" element={<KnowledgeBase />} />
            <Route path="guidelines" element={<GuidelinesPage />} />
            <Route path="claims" element={<ClaimsPage />} />
            <Route path="terminology" element={<TerminologyPage />} />
            <Route path="assets" element={<AssetsPage />} />
            <Route
              path="analytics"
              element={
                <Protected roles={["ADMIN", "MANAGER"]}>
                  <Analytics />
                </Protected>
              }
            />
            <Route
              path="audit"
              element={
                <Protected roles={["ADMIN"]}>
                  <AuditLogs />
                </Protected>
              }
            />
            <Route
              path="settings"
              element={
                <Protected roles={["ADMIN"]}>
                  <Settings />
                </Protected>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
