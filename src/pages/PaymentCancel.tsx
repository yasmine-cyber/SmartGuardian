import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { XCircle, Heart, RotateCcw } from "lucide-react";

const PaymentCancel = () => {
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
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-amber-600" />
          </div>

          <h1 className="text-2xl font-bold text-card-foreground mb-2">
            Paiement annulé
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            Votre compte a bien été créé, mais le paiement n'a pas abouti. Vous pouvez réessayer en vous connectant.
          </p>

          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-6">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Votre demande de bracelet restera en attente de paiement. Connectez-vous et rendez-vous dans vos paramètres pour finaliser la commande.
            </p>
          </div>

          <button
            onClick={() => navigate("/login")}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:brightness-110 transition-all glow-sage"
          >
            <RotateCcw className="w-4 h-4" />
            Se connecter pour réessayer
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentCancel;