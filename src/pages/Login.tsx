import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Mail, Lock, Eye, EyeOff, AlertCircle, Loader } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  primary:   "#4a9d87",
  secondary: "#5b8fa0",
  text:      "#1a2e28",
  textSoft:  "rgba(30,60,50,0.62)",
  muted:     "#c0504a",
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const Login = () => {
  const [showPassword, setShowPassword]   = useState(false);
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [loading, setLoading]             = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]                 = useState("");
  const [emailHint, setEmailHint]         = useState("");
  const [passwordHint, setPasswordHint]   = useState("");
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
  };

  const redirectPatient = async (userId: string) => {
    const { data: patientRow } = await supabase
      .from("patients").select("id").eq("user_id", userId).maybeSingle();
    if (!patientRow) { navigate("/checkout"); return; }
    const { data: paidRequest } = await supabase
      .from("device_requests").select("id, status")
      .eq("patient_id", patientRow.id).eq("payment_status", "paid").maybeSingle();
    if (!paidRequest) { navigate("/checkout"); return; }
    navigate("/patient");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setEmailHint(""); setPasswordHint("");
    const trimmedEmail    = email.trim();
    const trimmedPassword = password.trim();
    let hasError = false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!trimmedEmail) { setEmailHint("L'adresse e-mail est obligatoire."); hasError = true; }
    else if (!emailRegex.test(trimmedEmail)) { setEmailHint("Adresse e-mail invalide."); hasError = true; }
    if (!trimmedPassword) { setPasswordHint("Le mot de passe est obligatoire."); hasError = true; }
    if (hasError) return;

    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail, password: trimmedPassword,
      });
      if (signInError) {
        setError(signInError.code === "email_not_confirmed"
          ? "Veuillez d'abord confirmer votre adresse e-mail en cliquant sur le lien reçu."
          : signInError.message);
        setLoading(false);
        return;
      }
      if (!data.user) { setError("Erreur lors de la connexion"); setLoading(false); return; }
      const { data: userProfile, error: roleError } = await supabase
        .from("utilisateurs").select("role").eq("id", data.user.id).single();
      if (roleError || !userProfile) { setError("Impossible de récupérer votre profil."); setLoading(false); return; }
      if (userProfile.role === "patient") {
        await redirectPatient(data.user.id);
      } else {
        const dashboardMap: Record<string, string> = { medecin: "/doctor", proche: "/family", admin: "/admin" };
        navigate(dashboardMap[userProfile.role] || "/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la connexion");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = email && password && !loading;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .sg-login * { font-family: 'DM Sans', sans-serif; }
        .sg-login h1, .sg-login h2, .sg-sora { font-family: 'Sora', sans-serif !important; }
        .sg-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes sgAurora { 0%,100%{transform:translate(0,0) scale(1);opacity:.6} 50%{transform:translate(40px,-30px) scale(1.08);opacity:.9} }
        @keyframes sgHeartbeat { 0%,100%{transform:scale(1)} 14%{transform:scale(1.15)} 28%{transform:scale(1)} 42%{transform:scale(1.10)} 56%{transform:scale(1)} }
        .sg-heartbeat { animation: sgHeartbeat 2.4s ease-in-out infinite; }
        .sg-input {
          width:100%; background:rgba(255,255,255,0.70); border:1px solid rgba(74,157,135,0.22);
          border-radius:14px; padding:12px 14px 12px 40px; font-size:14px; color:#1a2e28;
          outline:none; transition:border .2s, box-shadow .2s; font-family:'DM Sans',sans-serif;
        }
        .sg-input::placeholder { color:rgba(30,60,50,0.38); }
        .sg-input:focus { border-color:rgba(74,157,135,0.55); box-shadow:0 0 0 3px rgba(74,157,135,0.12); }
        .sg-input:disabled { opacity:.50; cursor:not-allowed; }
        .sg-divider { display:flex; align-items:center; gap:12px; }
        .sg-divider::before,.sg-divider::after { content:''; flex:1; height:1px; background:rgba(74,157,135,0.18); }
      `}</style>

      <div className="sg-login min-h-screen flex" style={{ background: "linear-gradient(135deg, #f0faf7 0%, #e8f4f8 100%)" }}>

        {/* ── Left panel ── */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden"
          style={{ background: "linear-gradient(160deg, rgba(74,157,135,0.12) 0%, rgba(91,143,160,0.10) 100%)" }}>
          {/* Aurora orbs */}
          <div style={{ position:"absolute", width:380, height:380, borderRadius:"50%", background:"rgba(74,157,135,0.18)", filter:"blur(90px)", top:-60, left:-60, animation:"sgAurora 20s ease-in-out infinite", pointerEvents:"none" }} />
          <div style={{ position:"absolute", width:300, height:300, borderRadius:"50%", background:"rgba(91,143,160,0.16)", filter:"blur(80px)", bottom:40, right:-40, animation:"sgAurora 16s ease-in-out infinite reverse", pointerEvents:"none" }} />

          <div className="relative z-10 text-center">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
              style={{
                background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                boxShadow: "0 16px 48px rgba(74,157,135,0.35)",
              }}>
              <Heart className="w-10 h-10 text-white sg-heartbeat" />
            </div>
            <h2 className="text-3xl font-bold sg-sora mb-3" style={{ color: C.text }}>
              Smart<span className="sg-gradient-text">Guardian</span>
            </h2>
            <p className="text-base max-w-xs mx-auto" style={{ color: C.textSoft }}>
              Votre système de télémédecine autonome par intelligence artificielle
            </p>

            {/* Stats */}
            <div className="mt-10 flex gap-8 justify-center">
              {[["2 400+", "Patients"], ["18", "Cliniques"], ["99.9%", "Disponibilité"]].map(([val, lbl]) => (
                <div key={lbl}>
                  <p className="text-xl font-bold sg-sora" style={{ color: C.primary }}>{val}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>{lbl}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-md"
          >
            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8">
              <Link to="/" className="inline-flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})` }}>
                  <Heart className="w-5 h-5 text-white sg-heartbeat" />
                </div>
                <span className="text-xl font-bold sg-sora" style={{ color: C.text }}>
                  Smart<span className="sg-gradient-text">Guardian</span>
                </span>
              </Link>
            </div>

            {/* Card */}
            <div className="p-8" style={{
              background: "rgba(255,255,255,0.80)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(74,157,135,0.18)",
              borderRadius: "28px",
              boxShadow: "0 20px 60px rgba(30,60,50,0.08)",
            }}>
              <h1 className="text-2xl font-bold sg-sora mb-1" style={{ color: C.text }}>Bienvenue</h1>
              <p className="text-sm mb-6" style={{ color: C.textSoft }}>Connectez-vous à votre compte</p>

              {/* Error banner */}
              {error && (
                <div className="mb-4 p-3 rounded-2xl flex items-start gap-2"
                  style={{ background: "rgba(192,80,74,0.08)", border: "1px solid rgba(192,80,74,0.28)" }}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.muted }} />
                  <p className="text-sm" style={{ color: C.muted }}>{error}</p>
                </div>
              )}

              {/* Google */}
              <button onClick={handleGoogleLogin} disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                style={{
                  background: "rgba(255,255,255,0.90)",
                  border: "1px solid rgba(74,157,135,0.20)",
                  color: C.text,
                  boxShadow: "0 4px 14px rgba(30,60,50,0.06)",
                }}>
                {googleLoading ? <Loader className="w-4 h-4 animate-spin" style={{ color: C.primary }} /> : <GoogleIcon />}
                Continuer avec Google
              </button>

              {/* Divider */}
              <div className="sg-divider mb-4">
                <span className="text-xs" style={{ color: C.textSoft }}>ou</span>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(74,157,135,0.55)" }} />
                    <input type="email" placeholder="Adresse e-mail" value={email}
                      onChange={e => setEmail(e.target.value)} disabled={loading}
                      className="sg-input" />
                  </div>
                  {emailHint && <p className="text-xs mt-1" style={{ color: C.muted }}>{emailHint}</p>}
                </div>

                {/* Password */}
                <div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(74,157,135,0.55)" }} />
                    <input type={showPassword ? "text" : "password"} placeholder="Mot de passe" value={password}
                      onChange={e => setPassword(e.target.value)} disabled={loading}
                      className="sg-input" style={{ paddingRight: "40px" }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={loading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                      style={{ color: "rgba(74,157,135,0.55)" }}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordHint && <p className="text-xs mt-1" style={{ color: C.muted }}>{passwordHint}</p>}
                </div>

                {/* Remember / forgot */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: C.textSoft }}>
                    <input type="checkbox" className="rounded" style={{ accentColor: C.primary }} disabled={loading} />
                    Se souvenir de moi
                  </label>
                  <Link to="/forgot-password" className="text-xs font-medium hover:underline" style={{ color: C.primary }}>
                    Mot de passe oublié ?
                  </Link>
                </div>

                {/* Submit */}
                <button type="submit" disabled={!canSubmit}
                  className="w-full py-3 rounded-2xl text-sm font-bold sg-sora transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                    color: "#fff",
                    boxShadow: canSubmit ? "0 8px 28px rgba(74,157,135,0.35)" : "none",
                  }}>
                  {loading
                    ? <><Loader className="w-4 h-4 animate-spin" /> Connexion...</>
                    : "Continuer"
                  }
                </button>
              </form>

              {/* Social proof */}
              <p className="text-center text-xs mt-5" style={{ color: C.textSoft }}>
                Confiance de <span className="font-semibold" style={{ color: C.text }}>2 400+</span> patients dans{" "}
                <span className="font-semibold" style={{ color: C.text }}>18</span> cliniques
              </p>

              {/* Register link */}
              <p className="text-center text-xs mt-3" style={{ color: C.textSoft }}>
                Pas encore de compte ?{" "}
                <Link to="/register" className="font-semibold hover:underline" style={{ color: C.primary }}>
                  Créer un compte
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Login;