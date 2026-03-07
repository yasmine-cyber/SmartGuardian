import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Mail, Lock, Eye, EyeOff, AlertCircle, Loader } from "lucide-react";
import { supabase } from "@/lib/supabase";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [passwordHint, setPasswordHint] = useState("");
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEmailHint("");
    setPasswordHint("");

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    let hasError = false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!trimmedEmail) {
      setEmailHint("L'adresse e-mail est obligatoire.");
      hasError = true;
    } else if (!emailRegex.test(trimmedEmail)) {
      setEmailHint("Adresse e-mail invalide. Exemple : nom@domaine.com");
      hasError = true;
    }

    if (!trimmedPassword) {
      setPasswordHint("Le mot de passe est obligatoire.");
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (signInError) {
        if (signInError.code === "email_not_confirmed") {
          setError("Veuillez d'abord confirmer votre adresse e-mail en cliquant sur le lien reçu.");
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError("Erreur lors de la connexion");
        setLoading(false);
        return;
      }

      const { data: userRole, error: roleError } = await supabase
        .from("utilisateurs")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (roleError) {
        setError("Impossible de récupérer votre rôle");
        setLoading(false);
        return;
      }

      const dashboardMap: { [key: string]: string } = {
        patient: "/patient",
        medecin: "/doctor",
        proche: "/family",
        admin: "/admin",
      };

      navigate(dashboardMap[userRole?.role] || "/patient");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la connexion");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = email && password && !loading;

  return (
    <div className="min-h-screen flex">
      {/* Left — aurora */}
      <div className="hidden lg:flex lg:w-1/2 bg-secondary aurora-bg items-center justify-center p-12 relative">
        <div className="absolute top-1/4 left-1/3 w-[300px] h-[300px] rounded-full bg-primary/8 blur-[100px] animate-aurora" />
        <div className="relative z-10 text-center">
          <Heart className="w-16 h-16 text-primary mx-auto mb-6 animate-heartbeat" />
          <h2 className="text-3xl font-bold text-foreground mb-3">SmartGuardian</h2>
          <p className="text-muted-foreground text-lg max-w-sm">Votre système de télémédecine autonome par intelligence artificielle</p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <Heart className="w-8 h-8 text-primary animate-heartbeat" />
              <span className="text-xl font-bold text-foreground">SmartGuardian</span>
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">Bienvenue</h1>
          <p className="text-muted-foreground text-sm mb-8">Connectez-vous à votre compte</p>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/50 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-background border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {googleLoading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continuer avec Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <input
                type="email"
                placeholder="Adresse e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            {emailHint && <p className="text-xs text-destructive mt-1">{emailHint}</p>}

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mot de passe"
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
            {passwordHint && <p className="text-xs text-destructive mt-1">{passwordHint}</p>}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" className="rounded border-border accent-primary" disabled={loading} />
                Se souvenir de moi
              </label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:brightness-110 transition-all glow-sage flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <><Loader className="w-4 h-4 animate-spin" /> Connexion...</> : "Continuer"}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Confiance de <span className="font-semibold text-foreground">2 400+</span> patients dans <span className="font-semibold text-foreground">18</span> cliniques
          </p>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Pas encore de compte ?{" "}
            <Link to="/register" className="text-primary hover:underline font-medium">Créer un compte</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;