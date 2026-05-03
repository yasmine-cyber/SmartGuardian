import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, CreditCard, Clock, Check, Loader, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

const Checkout = () => {
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Vérifier la session au montage — rediriger si non connecté
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      // Vérifier que c'est bien un patient
      const role = session.user.user_metadata?.role;
      if (role && role !== "patient") {
        navigate("/");
        return;
      }
      setPageLoading(false);
    };
    checkSession();
  }, [navigate]);

  const handlePay = async () => {
    setLoading(true);
    setError("");

    try {
      // ✅ Session garantie ici (utilisateur vient de se connecter après confirmation email)
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError("Session expirée. Veuillez vous reconnecter.");
        navigate("/login");
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        "create-stripe-session",
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      if (fnError || data?.error) {
        setError(data?.error || fnError?.message || "Erreur lors de la création du paiement.");
        setLoading(false);
        return;
      }

      // Redirection Stripe dans le même onglet
      window.location.href = data.url;
    } catch (err) {
      setError("Erreur inattendue. Veuillez réessayer.");
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Panel gauche */}
      <div className="hidden lg:flex lg:w-1/2 bg-secondary aurora-bg items-center justify-center p-12 relative">
        <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full bg-primary/8 blur-[100px] animate-aurora" />
        <div className="relative z-10 text-center">
          <Heart className="w-16 h-16 text-primary mx-auto mb-6 animate-heartbeat" />
          <h2 className="text-3xl font-bold text-foreground mb-3">SmartGuardian</h2>
          <p className="text-muted-foreground text-lg max-w-sm">
            Une dernière étape pour activer votre suivi médical intelligent
          </p>
        </div>
      </div>

      {/* Panel droit */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden text-center mb-8">
            <Heart className="w-8 h-8 text-primary animate-heartbeat mx-auto" />
            <span className="text-xl font-bold text-foreground block mt-2">SmartGuardian</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">Commande du bracelet</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Finalisez votre inscription en commandant votre bracelet IoT.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/50 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm space-y-6">

            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-1">
                Bracelet SmartGuardian
              </h3>
              <p className="text-sm text-muted-foreground">
                Votre bracelet IoT de télésurveillance médicale
              </p>
            </div>

            {/* Récap commande */}
            <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Bracelet SmartGuardian</span>
                <span className="font-semibold text-card-foreground">49,00 €</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Livraison</span>
                <span className="text-green-600 font-medium">Incluse</span>
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <span className="font-semibold text-card-foreground">Total</span>
                <span className="font-bold text-lg text-card-foreground">49,00 €</span>
              </div>
            </div>

            {/* Ce qui se passe ensuite */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Après le paiement
              </p>
              {[
                { icon: Clock,       text: "L'admin valide votre commande (24-48h)" },
                { icon: Check,       text: "Le bracelet est préparé avec son QR code" },
                { icon: Heart,       text: "Livraison → scan QR → dashboard actif" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <item.icon className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handlePay}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl text-sm font-semibold hover:brightness-110 transition-all glow-sage disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? <><Loader className="w-4 h-4 animate-spin" /> Redirection vers Stripe...</>
                : <><CreditCard className="w-4 h-4" /> Payer 49 € et commander</>
              }
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Paiement sécurisé via Stripe · Vous serez redirigé hors du site
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Checkout;