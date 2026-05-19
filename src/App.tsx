import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorPatients from "./pages/DoctorPatients";
import DoctorPatientFiche from "./pages/DoctorPatientFiche";
import DoctorAlerts from "./pages/DoctorAlerts";
import DoctorAnalytics from "./pages/DoctorAnalytics";
import DoctorMessages from "./pages/DoctorMessages";
import DoctorSettings from "./pages/DoctorSettings";
import FamilyDashboard from "./pages/FamilyDashboard";
import FamilyProches from "./pages/FamilyProches";
import FamilyAlerts from "./pages/FamilyAlerts";
import FamilyParametres from "./pages/FamilyParametres";
import FamilyMessages from "./pages/FamilyMessages";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminDevices from "./pages/AdminDevices";
import AdminRoles from "./pages/AdminRoles";
import AdminThresholds from "./pages/AdminThresholds";
import AdminLogs from "./pages/AdminLogs";
import AdminSystem from "./pages/AdminSystem";
import NotFound from "./pages/NotFound";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import PatientProfile from "@/pages/PatientProfile";
import ProtectedRoute from "@/components/ProtectedRoute";
import Unauthorized from "@/pages/Unauthorized";
import SetPassword from "@/pages/SetPassword";
import AuthCallback from "@/pages/AuthCallback";
import CompleteProfile from "@/pages/CompleteProfile";
import PatientMessages  from "@/pages/PatientMessages";
import PatientVitals    from "@/pages/PatientVitals";
import PatientAlerts    from "@/pages/PatientAlerts";
import PatientHistory   from "@/pages/PatientHistory";
import PatientMedecins  from "@/pages/PatientMedecins";
import PatientEmergency from "@/pages/PatientEmergency";
import PatientSettings  from "@/pages/PatientSettings";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel  from "@/pages/PaymentCancel";
import PendingActivation from "@/pages/PendingActivation";
import PatientAnalyses from "./pages/PatientAnalyses";
import PatientProches from "./pages/PatientProche";
import Checkout from "@/pages/Checkout";

const queryClient = new QueryClient();

const SupabaseHashHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash === "#") return;

    const params = new URLSearchParams(hash.substring(1));
    const type = params.get("type");
    const accessToken = params.get("access_token");

    if (!accessToken) return;

    if (type === "recovery") {
      // Réinitialisation de mot de passe
      navigate(`/reset-password${hash}`, { replace: true });
    } else if (type === "invite") {
      // Invitation médecin
      navigate(`/set-password${hash}`, { replace: true });
    } else if (type === "signup") {
      // ✅ Confirmation email après inscription
      // Supabase a déjà connecté l'utilisateur via le token dans le hash
      // On redirige vers /auth/callback qui gère la redirection selon le rôle
      navigate(`/auth/callback`, { replace: true });
    }
  }, [navigate]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SupabaseHashHandler />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/complete-profile" element={<CompleteProfile />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-cancel"  element={<PaymentCancel />} />
          <Route path="/pending" element={<PendingActivation />} />

          {/* Patient */}
          <Route path="/patient"           element={<ProtectedRoute allowedRoles={["patient"]}><PatientDashboard /></ProtectedRoute>} />
          <Route path="/patient/profile"   element={<ProtectedRoute allowedRoles={["patient"]}><PatientProfile /></ProtectedRoute>} />
          <Route path="/patient/medecins"  element={<ProtectedRoute allowedRoles={["patient"]}><PatientMedecins /></ProtectedRoute>} />
          <Route path="/patient/messages"  element={<ProtectedRoute allowedRoles={["patient"]}><PatientMessages /></ProtectedRoute>} />
          <Route path="/patient/vitals"    element={<ProtectedRoute allowedRoles={["patient"]}><PatientVitals /></ProtectedRoute>} />
          <Route path="/patient/alerts"    element={<ProtectedRoute allowedRoles={["patient"]}><PatientAlerts /></ProtectedRoute>} />
          <Route path="/patient/history"   element={<ProtectedRoute allowedRoles={["patient"]}><PatientHistory /></ProtectedRoute>} />
          <Route path="/patient/emergency" element={<ProtectedRoute allowedRoles={["patient"]}><PatientEmergency /></ProtectedRoute>} />
          <Route path="/patient/settings"  element={<ProtectedRoute allowedRoles={["patient"]}><PatientSettings /></ProtectedRoute>} />
          <Route path="/patient/analyses"  element={<ProtectedRoute allowedRoles={["patient"]}><PatientAnalyses /></ProtectedRoute>} />
          <Route path="/patient/proches"   element={<ProtectedRoute allowedRoles={["patient"]}><PatientProches /></ProtectedRoute>} />

          <Route path="/patient/*"         element={<ProtectedRoute allowedRoles={["patient"]}><PatientDashboard /></ProtectedRoute>} />

          {/* Doctor */}
          <Route path="/doctor"            element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorDashboard /></ProtectedRoute>} />
          <Route path="/doctor/patients"   element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorPatients /></ProtectedRoute>} />
          <Route path="/doctor/alerts"     element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorAlerts /></ProtectedRoute>} />
          <Route path="/doctor/analytics"  element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorAnalytics /></ProtectedRoute>} />
          <Route path="/doctor/messages"   element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorMessages /></ProtectedRoute>} />
          <Route path="/doctor/settings"   element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorSettings /></ProtectedRoute>} />
          <Route path="/doctor/*"          element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorDashboard /></ProtectedRoute>} />
          <Route path="/doctor/patients/:patientId" element={<ProtectedRoute allowedRoles={["medecin"]}><DoctorPatientFiche /></ProtectedRoute>} />

          {/* Family */}
          <Route path="/family"            element={<ProtectedRoute allowedRoles={["proche"]}><FamilyDashboard /></ProtectedRoute>} />
          <Route path="/family/proches" element={<FamilyProches />} />
          <Route path="/family/messages"   element={<ProtectedRoute allowedRoles={["proche"]}><FamilyMessages /></ProtectedRoute>} />
          <Route path="/family/alerts"     element={<ProtectedRoute allowedRoles={["proche"]}><FamilyAlerts /></ProtectedRoute>} />
          <Route path="/family/parametres" element={<ProtectedRoute allowedRoles={["proche"]}><FamilyParametres /></ProtectedRoute>} />
          <Route path="/family/*"          element={<ProtectedRoute allowedRoles={["proche"]}><FamilyDashboard /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin"             element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users"       element={<ProtectedRoute allowedRoles={["admin"]}><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/devices"     element={<ProtectedRoute allowedRoles={["admin"]}><AdminDevices /></ProtectedRoute>} />
          <Route path="/admin/roles"       element={<ProtectedRoute allowedRoles={["admin"]}><AdminRoles /></ProtectedRoute>} />
          <Route path="/admin/thresholds"  element={<ProtectedRoute allowedRoles={["admin"]}><AdminThresholds /></ProtectedRoute>} />
          <Route path="/admin/logs"        element={<ProtectedRoute allowedRoles={["admin"]}><AdminLogs /></ProtectedRoute>} />
          <Route path="/admin/system"      element={<ProtectedRoute allowedRoles={["admin"]}><AdminSystem /></ProtectedRoute>} />
          <Route path="/admin/*"           element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard /></ProtectedRoute>} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;