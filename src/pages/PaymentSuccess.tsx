import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle2, Heart, ArrowRight, Smartphone, QrCode,
  Package, Clock, ExternalLink,
} from "lucide-react";

const PaymentSuccess = () => {
  const navigate = useNavigate();

  // Auto-redirect to /pending after 6 seconds
  useEffect(() => {
    const timer = setTimeout(() => navigate("/pending"), 6000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-green-500/5 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-6">
          <Heart className="w-8 h-8 text-primary mx-auto mb-1 animate-pulse" />
          <span className="text-lg font-bold text-foreground">SmartGuardian</span>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">

          {/* Success header */}
          <div className="p-8 text-center border-b border-border">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </motion.div>
            <h1 className="text-2xl font-bold text-card-foreground mb-2">
              Paiement confirmé !
            </h1>
            <p className="text-sm text-muted-foreground">
              Votre commande a bien été reçue. L'équipe SmartGuardian prépare votre bracelet.
            </p>
          </div>

          {/* Steps */}
          <div className="p-6 space-y-3 border-b border-border">
            {[
              { icon: CheckCircle2, label: "Paiement reçu et confirmé",       done: true,  color: "text-green-600 bg-green-500/10" },
              { icon: Package,      label: "Validation admin (24–48h)",        done: false, color: "text-amber-600 bg-amber-500/10" },
              { icon: Clock,        label: "Expédition de votre bracelet",     done: false, color: "text-muted-foreground bg-muted" },
              { icon: QrCode,       label: "Scan QR via l'app mobile",         done: false, color: "text-muted-foreground bg-muted" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.color}`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <p className={`text-sm ${item.done ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
                  {item.label}
                </p>
              </motion.div>
            ))}
          </div>

          {/* App download CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="p-6 space-y-4"
          >
            <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <Smartphone className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-card-foreground mb-1">
                  Téléchargez l'application maintenant
                </p>
                <p className="text-xs text-muted-foreground">
                  Pour activer votre bracelet, vous devrez scanner le QR code
                  imprimé dessus via l'app <strong className="text-foreground">SmartGuardian App</strong>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href="https://apps.apple.com/app/smartguardian"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-muted border border-border hover:border-primary/40 transition-all text-xs font-medium text-card-foreground"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                App Store
                <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
              <a
                href="https://play.google.com/store/apps/smartguardian"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-muted border border-border hover:border-primary/40 transition-all text-xs font-medium text-card-foreground"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 20.5v-17c0-.83.94-1.3 1.6-.8l14 8.5c.6.37.6 1.23 0 1.6l-14 8.5c-.66.5-1.6.03-1.6-.8z"/>
                </svg>
                Google Play
                <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Redirection automatique dans quelques secondes...
            </p>

            <button
              onClick={() => navigate("/pending")}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:brightness-110 transition-all"
            >
              Suivre ma commande <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentSuccess;