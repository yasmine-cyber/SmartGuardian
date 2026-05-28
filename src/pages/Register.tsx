import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Mail, Lock, User, ArrowRight, ArrowLeft,
  Check, AlertCircle, Loader, CreditCard, Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  primary:     "#4a9d87",
  primaryDark: "#3d8c7a",
  secondary:   "#5b8fa0",
  text:        "#1a2e28",
  textSoft:    "rgba(30,60,50,0.62)",
  gold:        "#d4a843",
  muted:       "#c0504a",
};

const PATIENT_STEPS = ["Compte", "Détails", "Email"];
const PROCHE_STEPS  = ["Compte", "Détails", "Confirmé"];

const maladiesRef = [
  { id: "1",  nom: "Hypertension artérielle",  categorie: "Cardiovasculaire" },
  { id: "2",  nom: "Insuffisance cardiaque",    categorie: "Cardiovasculaire" },
  { id: "3",  nom: "Arythmie cardiaque",        categorie: "Cardiovasculaire" },
  { id: "4",  nom: "Fibrillation auriculaire",  categorie: "Cardiovasculaire" },
  { id: "5",  nom: "Angine de poitrine",        categorie: "Cardiovasculaire" },
  { id: "6",  nom: "Diabète de type 1",         categorie: "Métabolique" },
  { id: "7",  nom: "Diabète de type 2",         categorie: "Métabolique" },
  { id: "8",  nom: "Obésité",                   categorie: "Métabolique" },
  { id: "9",  nom: "Insuffisance respiratoire", categorie: "Respiratoire" },
  { id: "10", nom: "Apnée du sommeil",          categorie: "Respiratoire" },
  { id: "11", nom: "Épilepsie",                 categorie: "Neurologique" },
  { id: "12", nom: "Maladie de Parkinson",      categorie: "Neurologique" },
  { id: "13", nom: "Alzheimer",                 categorie: "Neurologique" },
  { id: "14", nom: "Insuffisance rénale",       categorie: "Rénale" },
  { id: "15", nom: "Autre",                     categorie: "Autre" },
];

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

interface FieldErrors {
  prenom?: string; nom?: string; email?: string; password?: string;
  telephone?: string; dateNaissance?: string; maladies?: string;
}

const Register = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]     = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [registeredEmail, setRegisteredEmail] = useState("");
  const navigate = useNavigate();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [prenom, setPrenom]             = useState("");
  const [nom, setNom]                   = useState("");
  const [role, setRole]                 = useState("patient");
  const [telephone, setTelephone]       = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [maladies, setMaladies]         = useState<string[]>([]);
  const [autreMaladie, setAutreMaladie] = useState("");

  useEffect(() => {
    if (searchParams.get("payment") === "cancelled")
      setError("Paiement annulé. Connectez-vous pour réessayer.");
  }, [searchParams]);

  const steps = role === "patient" ? PATIENT_STEPS : PROCHE_STEPS;
  const isEmailConfirmStep = role === "patient" && step === 2;
  const isConfirmedStep    = role === "proche"  && step === 2;

  const handleGoogleRegister = async () => {
    setGoogleLoading(true); setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setFieldErrors({});
    const newErrors: FieldErrors = {};
    const phoneDigits = telephone.replace(/\D/g, "");
    if (!telephone.trim()) newErrors.telephone = "Le numéro de téléphone est obligatoire.";
    else if (phoneDigits.length !== 8) newErrors.telephone = "Le numéro doit contenir exactement 8 chiffres.";
    if (role === "patient") {
      const today = new Date(); today.setHours(23, 59, 59, 999);
      const minDate = new Date(today.getFullYear() - 120, 0, 1);
      if (!dateNaissance) newErrors.dateNaissance = "La date de naissance est obligatoire.";
      else {
        const birth = new Date(dateNaissance);
        if (birth > today) newErrors.dateNaissance = "La date ne peut pas être dans le futur.";
        else if (birth < minDate) newErrors.dateNaissance = "Date invalide.";
      }
      if (maladies.length === 0) newErrors.maladies = "Sélectionnez au moins une maladie.";
      else if (maladies.includes("Autre") && !autreMaladie.trim())
        newErrors.maladies = "Précisez la maladie pour le choix \"Autre\".";
    }
    if (Object.keys(newErrors).length > 0) { setFieldErrors(newErrors); return; }

    const maladiesToSave = role === "patient"
      ? maladies.map((m) => m === "Autre" && autreMaladie.trim() ? `Autre: ${autreMaladie.trim()}` : m)
      : null;

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email, password,
        options: {
          data: {
            role,
            nom: `${prenom.trim()} ${nom.trim()}`,
            telephone: telephone.trim(),
            date_naissance: role === "patient" ? dateNaissance || null : null,
            maladies: maladiesToSave,
          },
        },
      });
      if (signUpError) {
        setError(signUpError.code === "over_email_send_rate_limit"
          ? "Trop de tentatives. Veuillez réessayer dans une heure."
          : `Erreur: ${signUpError.message}`);
        return;
      }
      if (!data.user) { setError("Inscription réussie, mais impossible de récupérer l'utilisateur."); return; }
      setRegisteredEmail(email);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep0 = email && password && prenom.trim() && nom.trim() && password.length >= 6;
  const canProceedStep1 =
    telephone &&
    (role === "proche"
      ? true
      : dateNaissance && maladies.length > 0 &&
        (!maladies.includes("Autre") || autreMaladie.trim().length > 0));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .sg-reg * { font-family: 'DM Sans', sans-serif; }
        .sg-reg h1, .sg-reg h2, .sg-reg h3, .sg-sora { font-family: 'Sora', sans-serif !important; }
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
        .sg-input-bare {
          width:100%; background:rgba(255,255,255,0.70); border:1px solid rgba(74,157,135,0.22);
          border-radius:14px; padding:12px 14px; font-size:14px; color:#1a2e28;
          outline:none; transition:border .2s, box-shadow .2s; font-family:'DM Sans',sans-serif;
        }
        .sg-input::placeholder, .sg-input-bare::placeholder { color:rgba(30,60,50,0.38); }
        .sg-input:focus, .sg-input-bare:focus { border-color:rgba(74,157,135,0.55); box-shadow:0 0 0 3px rgba(74,157,135,0.12); }
        .sg-input:disabled, .sg-input-bare:disabled { opacity:.50; cursor:not-allowed; }
        .sg-divider { display:flex; align-items:center; gap:12px; }
        .sg-divider::before,.sg-divider::after { content:''; flex:1; height:1px; background:rgba(74,157,135,0.18); }
        .sg-checkbox { accent-color:#4a9d87; width:15px; height:15px; cursor:pointer; margin-top:2px; }
        .sg-scrollbox::-webkit-scrollbar { width:4px; }
        .sg-scrollbox::-webkit-scrollbar-track { background:transparent; }
        .sg-scrollbox::-webkit-scrollbar-thumb { background:rgba(74,157,135,0.30); border-radius:8px; }
      `}</style>

      <div className="sg-reg min-h-screen flex" style={{ background: "linear-gradient(135deg, #f0faf7 0%, #e8f4f8 100%)" }}>

        {/* ── Left panel ── */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden"
          style={{ background: "linear-gradient(160deg, rgba(74,157,135,0.12) 0%, rgba(91,143,160,0.10) 100%)" }}>
          <div style={{ position:"absolute", width:380, height:380, borderRadius:"50%", background:"rgba(74,157,135,0.18)", filter:"blur(90px)", top:-60, right:-40, animation:"sgAurora 20s ease-in-out infinite", pointerEvents:"none" }} />
          <div style={{ position:"absolute", width:300, height:300, borderRadius:"50%", background:"rgba(91,143,160,0.16)", filter:"blur(80px)", bottom:40, left:-40, animation:"sgAurora 16s ease-in-out infinite reverse", pointerEvents:"none" }} />

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
              Créez votre compte pour commencer le suivi intelligent de votre santé
            </p>

            {/* Feature pills */}
            <div className="mt-10 space-y-3 text-left max-w-xs mx-auto">
              {[
                ["🫀", "Surveillance cardiaque en temps réel"],
                ["🤖", "Alertes intelligentes par IA"],
                ["👨‍⚕️", "Lien direct avec votre médecin"],
              ].map(([icon, label]) => (
                <div key={label} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(74,157,135,0.18)" }}>
                  <span className="text-lg">{icon}</span>
                  <span className="text-sm font-medium" style={{ color: C.text }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }} className="w-full max-w-md py-8">

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

            {/* Title */}
            <h1 className="text-2xl font-bold sg-sora mb-1" style={{ color: C.text }}>Créer un compte</h1>
            <p className="text-sm mb-5" style={{ color: C.textSoft }}>Étape {step + 1} sur {steps.length}</p>

            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2 mb-5">
              {steps.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold sg-sora transition-all"
                    style={i <= step ? {
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      color: "#fff",
                      boxShadow: "0 4px 12px rgba(74,157,135,0.30)",
                    } : {
                      background: "rgba(74,157,135,0.08)",
                      color: C.textSoft,
                      border: "1px solid rgba(74,157,135,0.18)",
                    }}>
                    {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className="text-xs hidden sm:inline sg-sora font-medium"
                    style={{ color: i <= step ? C.primary : C.textSoft }}>{s}</span>
                  {i < steps.length - 1 && (
                    <div className="w-6 h-0.5 rounded-full"
                      style={{ background: i < step ? `linear-gradient(90deg,${C.primary},${C.secondary})` : "rgba(74,157,135,0.18)" }} />
                  )}
                </div>
              ))}
            </div>

            {/* Error banner */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mb-4 p-3 rounded-2xl flex items-start gap-2"
                  style={{ background: "rgba(192,80,74,0.08)", border: "1px solid rgba(192,80,74,0.28)" }}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.muted }} />
                  <p className="text-sm" style={{ color: C.muted }}>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Card */}
            <div style={{
              background: "rgba(255,255,255,0.80)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(74,157,135,0.18)",
              borderRadius: "28px",
              boxShadow: "0 20px 60px rgba(30,60,50,0.08)",
              padding: "32px",
            }}>

              {/* ── STEP 0 — Compte ── */}
              {step === 0 && (
                <>
                  {/* Google */}
                  <button onClick={handleGoogleRegister} disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed mb-4"
                    style={{
                      background: "rgba(255,255,255,0.90)",
                      border: "1px solid rgba(74,157,135,0.20)",
                      color: C.text,
                      boxShadow: "0 4px 14px rgba(30,60,50,0.06)",
                    }}>
                    {googleLoading ? <Loader className="w-4 h-4 animate-spin" style={{ color: C.primary }} /> : <GoogleIcon />}
                    S'inscrire avec Google
                  </button>
                  <div className="sg-divider mb-4">
                    <span className="text-xs" style={{ color: C.textSoft }}>ou</span>
                  </div>

                  <motion.form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const newErrors: FieldErrors = {};
                      if (!prenom.trim()) newErrors.prenom = "Le prénom est obligatoire.";
                      if (!nom.trim()) newErrors.nom = "Le nom est obligatoire.";
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
                      if (!email.trim()) newErrors.email = "L'adresse e-mail est obligatoire.";
                      else if (!emailRegex.test(email.trim())) newErrors.email = "Adresse e-mail invalide.";
                      if (!password.trim()) newErrors.password = "Le mot de passe est obligatoire.";
                      else if (password.length < 6) newErrors.password = "Minimum 6 caractères.";
                      setFieldErrors(newErrors);
                      if (Object.keys(newErrors).length === 0) setStep(1);
                    }}
                    className="space-y-4"
                  >
                    {/* Role selector */}
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: C.textSoft }}>Votre rôle</p>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      {[{ id: "patient", label: "Patient", icon: "👤" }, { id: "proche", label: "Aidant", icon: "👨‍👩‍👧" }].map((r) => (
                        <button key={r.id} type="button" onClick={() => setRole(r.id)}
                          className="flex items-center gap-3 p-3.5 rounded-2xl transition-all hover:scale-[1.02]"
                          style={role === r.id ? {
                            background: "rgba(74,157,135,0.10)",
                            border: `1.5px solid rgba(74,157,135,0.45)`,
                            color: C.primary,
                            boxShadow: "0 4px 14px rgba(74,157,135,0.15)",
                          } : {
                            background: "rgba(74,157,135,0.03)",
                            border: "1px solid rgba(74,157,135,0.16)",
                            color: C.textSoft,
                          }}>
                          <span className="text-xl">{r.icon}</span>
                          <span className="text-sm font-semibold sg-sora">{r.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Name row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(74,157,135,0.55)" }} />
                          <input type="text" placeholder="Prénom" value={prenom}
                            onChange={e => setPrenom(e.target.value)} className="sg-input" />
                        </div>
                        {fieldErrors.prenom && <p className="text-xs mt-1" style={{ color: C.muted }}>{fieldErrors.prenom}</p>}
                      </div>
                      <div>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(74,157,135,0.55)" }} />
                          <input type="text" placeholder="Nom" value={nom}
                            onChange={e => setNom(e.target.value)} className="sg-input" />
                        </div>
                        {fieldErrors.nom && <p className="text-xs mt-1" style={{ color: C.muted }}>{fieldErrors.nom}</p>}
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(74,157,135,0.55)" }} />
                        <input type="email" placeholder="Adresse e-mail" value={email}
                          onChange={e => setEmail(e.target.value)} className="sg-input" />
                      </div>
                      {fieldErrors.email && <p className="text-xs mt-1" style={{ color: C.muted }}>{fieldErrors.email}</p>}
                    </div>

                    {/* Password */}
                    <div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(74,157,135,0.55)" }} />
                        <input type="password" placeholder="Mot de passe (min. 6 caractères)" value={password}
                          onChange={e => setPassword(e.target.value)} className="sg-input" />
                      </div>
                      {fieldErrors.password && <p className="text-xs mt-1" style={{ color: C.muted }}>{fieldErrors.password}</p>}
                    </div>

                    <button type="submit" disabled={!canProceedStep0}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold sg-sora transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                        color: "#fff",
                        boxShadow: canProceedStep0 ? "0 8px 28px rgba(74,157,135,0.35)" : "none",
                      }}>
                      Continuer <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.form>
                </>
              )}

              {/* ── STEP 1 — Détails ── */}
              {step === 1 && (
                <motion.form onSubmit={handleSignUp} className="space-y-4">
                  <p className="text-base font-bold sg-sora mb-4" style={{ color: C.text }}>
                    {role === "proche" ? "Informations Aidant" : "Informations Patient"}
                  </p>

                  {/* Phone */}
                  <div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(74,157,135,0.55)" }} />
                      <input type="tel" placeholder="Numéro de téléphone" value={telephone}
                        onChange={e => setTelephone(e.target.value)} className="sg-input" />
                    </div>
                    {fieldErrors.telephone && <p className="text-xs mt-1" style={{ color: C.muted }}>{fieldErrors.telephone}</p>}
                  </div>

                  {role === "patient" && (
                    <>
                      {/* Date naissance */}
                      <div>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(74,157,135,0.55)" }} />
                          <input type="date" value={dateNaissance} max={new Date().toISOString().split("T")[0]}
                            onChange={e => setDateNaissance(e.target.value)} className="sg-input" />
                        </div>
                        {fieldErrors.dateNaissance && <p className="text-xs mt-1" style={{ color: C.muted }}>{fieldErrors.dateNaissance}</p>}
                      </div>

                      {/* Maladies */}
                      <div>
                        <p className="text-sm font-bold sg-sora mb-2" style={{ color: C.text }}>Maladies suivies</p>
                        <div className="sg-scrollbox grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-4 rounded-2xl"
                          style={{ background: "rgba(74,157,135,0.04)", border: "1px solid rgba(74,157,135,0.14)" }}>
                          {maladiesRef.map((m) => {
                            const checked = maladies.includes(m.nom);
                            return (
                              <label key={m.id} className="flex items-start gap-2.5 text-sm cursor-pointer rounded-xl p-2 transition-colors"
                                style={{ color: C.text }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(74,157,135,0.08)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                <input type="checkbox" checked={checked} className="sg-checkbox"
                                  onChange={() => setMaladies(prev => checked ? prev.filter(x => x !== m.nom) : [...prev, m.nom])} />
                                <span className="leading-snug">{m.nom}</span>
                              </label>
                            );
                          })}
                        </div>
                        {maladies.includes("Autre") && (
                          <input type="text" placeholder="Exemple : Maladie auto-immune rare"
                            value={autreMaladie} onChange={e => setAutreMaladie(e.target.value)}
                            className="sg-input-bare mt-3" />
                        )}
                        {fieldErrors.maladies && <p className="text-xs mt-1" style={{ color: C.muted }}>{fieldErrors.maladies}</p>}
                      </div>
                    </>
                  )}

                  {role === "proche" && (
                    <div className="p-4 rounded-2xl"
                      style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.18)" }}>
                      <p className="text-sm font-semibold sg-sora mb-1" style={{ color: C.text }}>👨‍👩‍👧 Compte Aidant</p>
                      <p className="text-xs" style={{ color: C.textSoft }}>
                        Vous pourrez être associé à un patient depuis vos paramètres après la connexion.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setStep(0)}
                      className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.02]"
                      style={{
                        background: "rgba(74,157,135,0.06)",
                        color: C.textSoft,
                        border: "1px solid rgba(74,157,135,0.18)",
                      }}>
                      <ArrowLeft className="w-4 h-4" /> Retour
                    </button>
                    <button type="submit" disabled={!canProceedStep1 || loading}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold sg-sora transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                        color: "#fff",
                        boxShadow: "0 8px 28px rgba(74,157,135,0.35)",
                      }}>
                      {loading
                        ? <><Loader className="w-4 h-4 animate-spin" /> Création du compte...</>
                        : <>Créer mon compte <ArrowRight className="w-4 h-4" /></>
                      }
                    </button>
                  </div>
                </motion.form>
              )}

              {/* ── STEP 2 patient — Email confirm ── */}
              {isEmailConfirmStep && (
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6 space-y-5">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto"
                    style={{
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      boxShadow: "0 12px 32px rgba(74,157,135,0.30)",
                    }}>
                    <Mail className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold sg-sora mb-2" style={{ color: C.text }}>Vérifiez votre email</h3>
                    <p className="text-sm" style={{ color: C.textSoft }}>
                      Un lien de confirmation a été envoyé à{" "}
                      <span className="font-semibold" style={{ color: C.text }}>{registeredEmail}</span>.
                    </p>
                  </div>

                  {/* Next steps */}
                  <div className="p-4 rounded-2xl text-left space-y-3"
                    style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.18)" }}>
                    <p className="text-xs font-bold sg-sora uppercase tracking-wide" style={{ color: C.primary }}>Prochaines étapes</p>
                    {[
                      { icon: Mail,       text: "Cliquez sur le lien dans votre email" },
                      { icon: Check,      text: "Votre compte est activé automatiquement" },
                      { icon: CreditCard, text: "Connectez-vous → commandez votre bracelet" },
                      { icon: Clock,      text: "L'admin valide et prépare la livraison" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs" style={{ color: C.textSoft }}>
                        <item.icon className="w-3.5 h-3.5 shrink-0" style={{ color: C.primary }} />
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => navigate("/login")}
                    className="w-full py-3 rounded-2xl text-sm font-bold sg-sora transition-all hover:scale-[1.02]"
                    style={{
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      color: "#fff",
                      boxShadow: "0 8px 28px rgba(74,157,135,0.35)",
                    }}>
                    Aller à la Connexion
                  </button>
                  <p className="text-xs" style={{ color: C.textSoft }}>
                    Pas reçu ?{" "}
                    <button
                      onClick={async () => {
                        const { error } = await supabase.auth.resend({ type: "signup", email: registeredEmail });
                        if (error) setError("Impossible de renvoyer. Attendez quelques minutes.");
                      }}
                      className="font-semibold hover:underline" style={{ color: C.primary }}>
                      Renvoyer l'email
                    </button>
                  </p>
                </motion.div>
              )}

              {/* ── STEP 2 proche — Confirmé ── */}
              {isConfirmedStep && (
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6 space-y-5">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto"
                    style={{
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      boxShadow: "0 12px 32px rgba(74,157,135,0.30)",
                    }}>
                    <Check className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold sg-sora mb-2" style={{ color: C.text }}>Inscription Réussie !</h3>
                    <p className="text-sm" style={{ color: C.textSoft }}>
                      Vérifiez votre email pour confirmer votre compte, puis connectez-vous.
                    </p>
                  </div>
                  <button onClick={() => navigate("/login")}
                    className="w-full py-3 rounded-2xl text-sm font-bold sg-sora transition-all hover:scale-[1.02]"
                    style={{
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      color: "#fff",
                      boxShadow: "0 8px 28px rgba(74,157,135,0.30)",
                    }}>
                    Aller à la Connexion
                  </button>
                </motion.div>
              )}

            </div>

            {step < 2 && (
              <p className="text-center text-xs mt-5" style={{ color: C.textSoft }}>
                Déjà un compte ?{" "}
                <Link to="/login" className="font-semibold hover:underline" style={{ color: C.primary }}>
                  Se connecter
                </Link>
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Register;