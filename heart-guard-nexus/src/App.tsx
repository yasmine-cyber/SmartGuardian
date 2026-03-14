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
import DoctorPatients from "./pages/DoctorPatients";
import DoctorAlerts from "./pages/DoctorAlerts";
import DoctorAnalytics from "./pages/DoctorAnalytics";
import DoctorMessages from "./pages/DoctorMessages";
import DoctorSettings from "./pages/DoctorSettings";
import FamilyDashboard from "./pages/FamilyDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import PatientProfile from "@/pages/PatientProfile";
import ProtectedRoute from "@/components/ProtectedRoute";
import Unauthorized from "@/pages/Unauthorized";
import SetPassword from "@/pages/SetPassword";
import AuthCallback from "@/pages/AuthCallback";
import CompleteProfile from "@/pages/CompleteProfile";
import MesMedecins from "@/pages/MesMedecins";
<<<<<<< Updated upstream
import PatientMessages from "@/pages/PatientMessages";
=======
import PatientVitals   from "@/pages/PatientVitals";
import PatientAlerts   from "@/pages/PatientAlerts";
import PatientHistory  from "@/pages/PatientHistory";
import PatientMedecins from "@/pages/PatientMedecins";
import PatientEmergency from "@/pages/PatientEmergency";
import PatientSettings  from "@/pages/PatientSettings";

>>>>>>> Stashed changes



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
          {/* pour medecin - invite only, protected via initialHash check in SetPassword.tsx */}
          <Route path="/set-password" element={<SetPassword />} /> 
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected routes */}
          <Route path="/patient" element={<ProtectedRoute allowedRoles={["patient"]}><PatientDashboard /></ProtectedRoute>} />
          <Route path="/patient/profile" element={<ProtectedRoute allowedRoles={["patient"]}><PatientProfile /></ProtectedRoute>} />
          <Route path="/patient/medecins" element={<ProtectedRoute allowedRoles={["patient"]}><MesMedecins /></ProtectedRoute>} />
          <Route path="/patient/messages" element={<ProtectedRoute allowedRoles={["patient"]}><PatientMessages /></ProtectedRoute>} />
          <Route path="/patient/*" element={<ProtectedRoute allowedRoles={["patient"]}><PatientDashboard /></ProtectedRoute>} />
          <Route path="/doctor" element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorDashboard /></ProtectedRoute>} />
          <Route path="/doctor/patients" element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorPatients /></ProtectedRoute>} />
          <Route path="/doctor/alerts" element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorAlerts /></ProtectedRoute>} />
          <Route path="/doctor/analytics" element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorAnalytics /></ProtectedRoute>} />
          <Route path="/doctor/messages" element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorMessages /></ProtectedRoute>} />
          <Route path="/doctor/settings" element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorSettings /></ProtectedRoute>} />
          <Route path="/doctor/*" element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorDashboard /></ProtectedRoute>} />
          <Route path="/family/*" element={<ProtectedRoute allowedRoles={["proche"]}><FamilyDashboard /></ProtectedRoute>} />
          <Route path="/admin/*" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/patient/vitals"   element={<PatientVitals />} />
          <Route path="/patient/alerts"   element={<PatientAlerts />} />
          <Route path="/patient/history"  element={<PatientHistory />} />
          <Route path="/patient/medecins" element={<PatientMedecins />} />
          <Route path="/patient/emergency" element={<PatientEmergency />} />
          <Route path="/patient/settings"  element={<PatientSettings />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;