import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Heart, ArrowRight } from "lucide-react";

const PaymentSuccess = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        <Heart className="w-10 h-10 text-primary mx-auto mb-6 animate-heartbeat" />

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold text-card-foreground mb-2">
            Paiement confirmé !
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            Votre demande de bracelet a bien été reçue. L'équipe SmartGuardian va traiter votre commande sous 24 à 48h.
          </p>

          {/* Étapes suivantes */}
          <div className="text-left space-y-3 mb-6 p-4 bg-muted/40 rounded-xl">
            {[
              { label: "Paiement reçu", done: true },
              { label: "Validation admin (24-48h)", done: false },
              { label: "Expédition du bracelet", done: false },
              { label: "Scan QR depuis l'app mobile", done: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.done ? "bg-green-500/20" : "bg-muted"
                }`}>
                  {item.done
                    ? <CheckCircle2 className="w-3 h-3 text-green-600" />
                    : <span className="text-xs text-muted-foreground font-medium">{i + 1}</span>
                  }
                </div>
                <p className={`text-sm ${item.done ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            Vous pouvez vous connecter dès maintenant. Le bracelet sera activé après validation.
          </p>

          <button
            onClick={() => navigate("/login")}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:brightness-110 transition-all glow-sage"
          >
            Se connecter <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentSuccess;