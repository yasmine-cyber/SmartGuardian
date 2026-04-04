import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Lock, Eye, EyeOff, AlertCircle, Loader, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordHint, setPasswordHint] = useState("");
  const [confirmHint, setConfirmHint] = useState("");
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // ✅ FIX: Lire le token directement depuis le hash de l'URL
    // Supabase envoie: /reset-password#access_token=xxx&type=recovery
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const type = hashParams.get("type");

    if (accessToken && type === "recovery") {
      // ✅ Token de reset présent dans l'URL → définir la session
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || "",
      }).then(({ error: sessionError }) => {
        if (sessionError) {
          console.error("Erreur session:", sessionError.message);
          navigate("/login");
        } else {
          setSessionReady(true);
        }
      });
    } else {
      // Pas de token dans l'URL → écouter PASSWORD_RECOVERY
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) {
          setSessionReady(true);
        }
      });

      // ✅ Timeout 15 secondes — lien invalide → login
      const timeout = setTimeout(() => {
        navigate("/login");
      }, 15000);

      return () => {
        listener.subscription.unsubscribe();
        clearTimeout(timeout);
      };
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPasswordHint("");
    setConfirmHint("");

    let hasError = false;

    if (!password) {
      setPasswordHint("Le mot de passe est obligatoire.");
      hasError = true;
    } else if (password.length < 8) {
      setPasswordHint("Le mot de passe doit contenir au moins 8 caractères.");
      hasError = true;
    }

    if (!confirm) {
      setConfirmHint("Veuillez confirmer votre mot de passe.");
      hasError = true;
    } else if (password !== confirm) {
      setConfirmHint("Les mots de passe ne correspondent pas.");
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const getStrength = (pwd: string) => {
    if (!pwd) return { label: "", color: "", width: "0%" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: "Très faible", color: "bg-destructive", width: "20%" };
    if (score === 2) return { label: "Faible", color: "bg-orange-400", width: "40%" };
    if (score === 3) return { label: "Moyen", color: "bg-yellow-400", width: "60%" };
    if (score === 4) return { label: "Fort", color: "bg-primary", width: "80%" };
    return { label: "Très fort", color: "bg-green-500", width: "100%" };
  };

  const strength = getStrength(password);

  return (
    <div className="min-h-screen flex">
      {/* Left — aurora */}
      <div className="hidden lg:flex lg:w-1/2 bg-secondary aurora-bg items-center justify-center p-12 relative">
        <div className="absolute top-1/4 left-1/3 w-[300px] h-[300px] rounded-full bg-primary/8 blur-[100px] animate-aurora" />
        <div className="relative z-10 text-center">
          <Heart className="w-16 h-16 text-primary mx-auto mb-6 animate-heartbeat" />
          <h2 className="text-3xl font-bold text-foreground mb-3">SmartGuardian</h2>
          <p className="text-muted-foreground text-lg max-w-sm">
            Votre système de télémédecine autonome par intelligence artificielle
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <Heart className="w-8 h-8 text-primary animate-heartbeat" />
              <span className="text-xl font-bold text-foreground">SmartGuardian</span>
            </Link>
          </div>

          <AnimatePresence mode="wait">
            {!sessionReady ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-12"
              >
                <Loader className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground text-sm">Vérification du lien...</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Redirection automatique dans 15s si le lien est invalide
                </p>
              </motion.div>
            ) : !done ? (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h1 className="text-2xl font-bold text-foreground mb-1">
                  Nouveau mot de passe
                </h1>
                <p className="text-muted-foreground text-sm mb-8">
                  Choisissez un mot de passe sécurisé pour votre compte.
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/50 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Nouveau mot de passe"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={loading}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-50"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {password && (
                      <div className="mt-2">
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${strength.color}`}
                            initial={{ width: "0%" }}
                            animate={{ width: strength.width }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{strength.label}</p>
                      </div>
                    )}
                    {passwordHint && <p className="text-xs text-destructive mt-1">{passwordHint}</p>}
                  </div>

                  <div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input
                        type={showConfirm ? "text" : "password"}
                        placeholder="Confirmer le mot de passe"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        disabled={loading}
                        className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        disabled={loading}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-50"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmHint && <p className="text-xs text-destructive mt-1">{confirmHint}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={!password || !confirm || loading}
                    className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:brightness-110 transition-all glow-sage flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <><Loader className="w-4 h-4 animate-spin" /> Mise à jour...</>
                    ) : (
                      "Réinitialiser le mot de passe"
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Mot de passe mis à jour !
                </h1>
                <p className="text-muted-foreground text-sm mb-6">
                  Votre mot de passe a été réinitialisé avec succès. Vous allez être redirigé...
                </p>
                <Link to="/login" className="text-sm text-primary hover:underline font-medium">
                  Se connecter maintenant
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPassword;