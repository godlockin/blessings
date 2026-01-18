import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import InvitePage from "@/pages/InvitePage";
import MainPage from "@/pages/MainPage";
import { useAuthStore } from "@/store/useAuthStore";

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<InvitePage />} />
        <Route 
          path="/app" 
          element={
            <ProtectedRoute>
              <MainPage />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
