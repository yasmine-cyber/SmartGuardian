import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Package, Smartphone, QrCode, CheckCircle2,
  Clock, Truck, Wifi, ArrowRight, RefreshCw, ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type RequestStatus = "pending" | "approved" | "rejected" | "completed" | null;

const STEPS = [
  {
    icon: CheckCircle2,
    label: "Paiement confirmé",
    description: "Votre commande a bien été reçue",
    doneColor: "text-green-500",
    doneBg: "bg-green-500/10 border-green-500/20",
  },
  {
    icon: Package,
    label: "Validation & préparation",
    description: "L'équipe SmartGuardian prépare votre bracelet (24–48h)",
    doneColor: "text-primary",
    doneBg: "bg-primary/10 border-primary/20",
  },
  {
    icon: Truck,
    label: "Livraison en cours",
    description: "Votre bracelet est en route",
    doneColor: "text-blue-500",
    doneBg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: QrCode,
    label: "Activation via QR Code",
    description: "Scannez le QR code depuis l'app mobile SmartGuardian",
    doneColor: "text-purple-500",
    doneBg: "bg-purple-500/10 border-purple-500/20",
  },
];

const PendingActivation = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<RequestStatus>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [patientName, setPatientName] = useState("");

  // Determine which step we're on based on status
  const currentStep =
    status === null ? 0 :
    status === "pending" ? 1 :
    status === "approved" ? 2 :
    status === "completed" ? 4 : 1;

  const fetchStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

      // Get patient row
      const { data: patientRow } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!patientRow) { navigate("/checkout"); return; }

      // Get name
      const { data: userRow } = await supabase
        .from("utilisateurs")
        .select("nom, prenom")
        .eq("id", user.id)
        .single();

      if (userRow) {
        setPatientName([userRow.prenom, userRow.nom].filter(Boolean).join(" "));
      }

      // Get device request
      const { data: req } = await supabase
        .from("device_requests")
        .select("status, payment_status, device_id")
        .eq("patient_id", patientRow.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!req || req.payment_status !== "paid") {
        navigate("/checkout");
        return;
      }

      setStatus(req.status as RequestStatus);
      setLastChecked(new Date());

      // If approved and device assigned → check if device is now active (QR scanned on mobile)
      if (req.status === "approved" && req.device_id) {
        const { data: device } = await supabase
          .from("devices")
          .select("actif")
          .eq("id", req.device_id)
          .single();

        if (device?.actif) {
          // Device activated via mobile QR scan → unlock dashboard
          navigate("/patient");
          return;
        }
      }

      // If completed → go to dashboard
      if (req.status === "completed") {
        navigate("/patient");
        return;
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch + polling every 10s
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Heart className="w-10 h-10 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Vérification de votre commande...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Subtle background pulse */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            className="inline-flex items-center gap-2 mb-2"
          >
            <Heart className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold text-foreground">SmartGuardian</span>
          </motion.div>
          {patientName && (
            <p className="text-sm text-muted-foreground">Bonjour, {patientName} 👋</p>
          )}
        </div>

        {/* Main card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">

          {/* Header */}
          <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-card-foreground">
                  Votre bracelet est en préparation
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Vous recevrez votre dispositif dans <span className="font-semibold text-foreground">24 à 48 heures</span>.
                  En attendant, téléchargez l'application mobile.
                </p>
              </div>
            </div>
          </div>

          {/* Progress steps */}
          <div className="p-6 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Progression de votre commande
            </p>
            {STEPS.map((step, i) => {
              const isDone = i < currentStep;
              const isActive = i === currentStep - 1 || (i === 1 && currentStep <= 1);
              const Icon = step.icon;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isDone
                      ? `${step.doneBg} border`
                      : isActive
                      ? "bg-primary/5 border-primary/20"
                      : "bg-muted/30 border-transparent"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isDone ? "bg-card" : isActive ? "bg-primary/10" : "bg-muted"
                  }`}>
                    {isDone ? (
                      <CheckCircle2 className={`w-4 h-4 ${step.doneColor}`} />
                    ) : isActive ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                      >
                        <Icon className="w-4 h-4 text-primary" />
                      </motion.div>
                    ) : (
                      <Icon className="w-4 h-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${
                      isDone ? "text-card-foreground" : isActive ? "text-card-foreground" : "text-muted-foreground"
                    }`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {step.description}
                    </p>
                  </div>
                  {isDone && (
                    <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${step.doneColor}`} />
                  )}
                  {isActive && (
                    <span className="flex-shrink-0 text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                      En cours
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* App download section */}
          <div className="mx-6 mb-6 p-4 bg-gradient-to-br from-primary/5 to-blue-500/5 border border-primary/20 rounded-2xl">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-card-foreground">
                  Téléchargez SmartGuardian App
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Indispensable pour activer votre bracelet via QR Code
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {[
                { icon: QrCode, text: "Scannez le QR code imprimé sur votre bracelet" },
                { icon: Wifi, text: "Activez la surveillance en temps réel" },
                { icon: CheckCircle2, text: "Accédez au tableau de bord web & mobile" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <item.icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://apps.apple.com/app/smartguardian"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border hover:border-primary/40 transition-all text-xs font-medium text-card-foreground group"
              >
                {/* Apple icon */}
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <span>App Store</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <a
                href="https://play.google.com/store/apps/smartguardian"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border hover:border-primary/40 transition-all text-xs font-medium text-card-foreground group"
              >
                {/* Play Store icon */}
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 20.5v-17c0-.83.94-1.3 1.6-.8l14 8.5c.6.37.6 1.23 0 1.6l-14 8.5c-.66.5-1.6.03-1.6-.8z"/>
                </svg>
                <span>Google Play</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 space-y-3">
            {/* Auto-check indicator */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-1.5 h-1.5 rounded-full bg-green-500"
                />
                <span>Vérification automatique toutes les 10 secondes</span>
              </div>
              <button
                onClick={fetchStatus}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{lastChecked.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              </button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Une fois votre bracelet livré et activé, vous serez automatiquement
              redirigé vers votre tableau de bord.
            </p>

            {/* Manual dashboard link (accessible but limited) */}
            <button
              onClick={() => navigate("/patient")}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/30 transition-all text-sm text-muted-foreground hover:text-foreground"
            >
              Accéder au tableau de bord (limité)
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Help text */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Un problème ? Contactez-nous à{" "}
          <a href="mailto:support@smartguardian.app" className="text-primary hover:underline">
            support@smartguardian.app
          </a>
        </p>
      </motion.div>
    </div>
  );
};

export default PendingActivation;