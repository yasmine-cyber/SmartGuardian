import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import FamilyDashboard from "./pages/FamilyDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import PatientProfile from "@/pages/PatientProfile";
import ProtectedRoute from "@/components/ProtectedRoute";
import Unauthorized from "@/pages/Unauthorized";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected routes */}
          <Route path="/patient" element={<ProtectedRoute allowedRoles={["patient"]}><PatientDashboard /></ProtectedRoute>} />
          <Route path="/patient/profile" element={<ProtectedRoute allowedRoles={["patient"]}><PatientProfile /></ProtectedRoute>} />
          <Route path="/patient/*" element={<ProtectedRoute allowedRoles={["patient"]}><PatientDashboard /></ProtectedRoute>} />
          <Route path="/doctor/*" element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorDashboard /></ProtectedRoute>} />
          <Route path="/family/*" element={<ProtectedRoute allowedRoles={["proche"]}><FamilyDashboard /></ProtectedRoute>} />
          <Route path="/admin/*" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;