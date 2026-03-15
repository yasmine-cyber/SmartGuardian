import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Mail, Lock, User, ArrowRight, ArrowLeft, Check, AlertCircle, Loader } from "lucide-react";
import { supabase } from "@/lib/supabase";

const steps = ["Compte", "Détails", "Confirmé"];

const maladiesRef = [
  { id: "1", nom: "Hypertension artérielle", categorie: "Cardiovasculaire" },
  { id: "2", nom: "Insuffisance cardiaque", categorie: "Cardiovasculaire" },
  { id: "3", nom: "Arythmie cardiaque", categorie: "Cardiovasculaire" },
  { id: "4", nom: "Fibrillation auriculaire", categorie: "Cardiovasculaire" },
  { id: "5", nom: "Angine de poitrine", categorie: "Cardiovasculaire" },
  { id: "6", nom: "Diabète de type 1", categorie: "Métabolique" },
  { id: "7", nom: "Diabète de type 2", categorie: "Métabolique" },
  { id: "8", nom: "Obésité", categorie: "Métabolique" },
  { id: "9", nom: "Insuffisance respiratoire", categorie: "Respiratoire" },
  { id: "10", nom: "Apnée du sommeil", categorie: "Respiratoire" },
  { id: "11", nom: "Épilepsie", categorie: "Neurologique" },
  { id: "12", nom: "Maladie de Parkinson", categorie: "Neurologique" },
  { id: "13", nom: "Alzheimer", categorie: "Neurologique" },
  { id: "14", nom: "Insuffisance rénale", categorie: "Rénale" },
  { id: "15", nom: "Autre", categorie: "Autre" },
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
  prenom?: string;
  nom?: string;
  email?: string;
  password?: string;
  telephone?: string;
  dateNaissance?: string;
  maladies?: string;
}

const Register = () => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState("patient");
  const [telephone, setTelephone] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [maladies, setMaladies] = useState<string[]>([]);
  const [autreMaladie, setAutreMaladie] = useState("");

  const handleGoogleRegister = async () => {
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const newErrors: FieldErrors = {};

    const phoneDigits = telephone.replace(/\D/g, "");
    if (!telephone.trim()) {
      newErrors.telephone = "Le numéro de téléphone est obligatoire.";
    } else if (phoneDigits.length !== 8) {
      newErrors.telephone = "Le numéro doit contenir exactement 8 chiffres.";
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const minDate = new Date(today.getFullYear() - 120, 0, 1);
    if (!dateNaissance) {
      newErrors.dateNaissance = "La date de naissance est obligatoire.";
    } else {
      const birth = new Date(dateNaissance);
      if (birth > today) {
        newErrors.dateNaissance = "La date ne peut pas être dans le futur.";
      } else if (birth < minDate) {
        newErrors.dateNaissance = "Date invalide.";
      }
    }

    if (role === "patient") {
      if (maladies.length === 0) {
        newErrors.maladies = "Sélectionnez au moins une maladie.";
      } else if (maladies.includes("Autre") && !autreMaladie.trim()) {
        newErrors.maladies = "Précisez la maladie pour le choix \"Autre\".";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    const maladiesToSave =
      role === "patient"
        ? maladies.map((m) =>
            m === "Autre" && autreMaladie.trim() ? `Autre: ${autreMaladie.trim()}` : m
          )
        : null;

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            prenom: prenom.trim(),
            nom: nom.trim(),
            telephone,
            date_naissance: role === "patient" ? dateNaissance || null : null,
            maladies: maladiesToSave,
          },
        },
      });

      if (signUpError) {
        if (signUpError.code === "over_email_send_rate_limit") {
          setError("Trop de tentatives. Veuillez réessayer dans une heure.");
        } else {
          setError(`Erreur: ${signUpError.message}`);
        }
        setLoading(false);
        return;
      }

      const user = data.user;
      if (!user) {
        setError("Inscription réussie, mais impossible de récupérer l'utilisateur.");
        setLoading(false);
        return;
      }

      await supabase.from("utilisateurs").insert({
        id: user.id,
        email: user.email ?? email,
        nom: nom.trim(),
        prenom: prenom.trim(),
        role: role === "proche" ? "proche" : role === "patient" ? "patient" : "patient",
        telephone: telephone.trim() || null,
      });

      if (role === "patient") {
        await supabase.from("patients").insert({
          user_id: user.id,
          date_naissance: dateNaissance || null,
          maladies: maladiesToSave || [],
        });
      }

      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => navigate("/login");

  const canProceedStep0 = email && password && prenom.trim() && nom.trim() && password.length >= 6;
  const canProceedStep1 =
    telephone &&
    dateNaissance &&
    (role !== "patient" ||
      (maladies.length > 0 && (!maladies.includes("Autre") || autreMaladie.trim().length > 0)));

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-secondary aurora-bg items-center justify-center p-12 relative">
        <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full bg-primary/8 blur-[100px] animate-aurora" />
        <div className="relative z-10 text-center">
          <Heart className="w-16 h-16 text-primary mx-auto mb-6 animate-heartbeat" />
          <h2 className="text-3xl font-bold text-foreground mb-3">SmartGuardian</h2>
          <p className="text-muted-foreground text-lg max-w-sm">Créez votre compte pour commencer le suivi intelligent de votre santé</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <Heart className="w-8 h-8 text-primary animate-heartbeat" />
              <span className="text-xl font-bold text-foreground">SmartGuardian</span>
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">Créer un compte</h1>
          <p className="text-muted-foreground text-sm mb-6">Inscription {step === 2 ? "terminée" : "en " + (step + 1) + " étapes"}</p>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:inline ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
                {i < 2 && <div className={`w-6 h-0.5 ${i < step ? "bg-primary" : "bg-border"}`} />}
              </div>
            ))}
          </div>

          {/* Google button — only on step 0 */}
          {step === 0 && (
            <>
              <button
                onClick={handleGoogleRegister}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-background border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {googleLoading ? <Loader className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                S'inscrire avec Google
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">ou</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/50 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            {step === 0 && (
              <motion.form
                onSubmit={(e) => {
                  e.preventDefault();
                  const newErrors: FieldErrors = {};
                  if (!prenom.trim()) newErrors.prenom = "Le prénom est obligatoire.";
                  if (!nom.trim()) newErrors.nom = "Le nom est obligatoire.";
                  const trimmedEmail = email.trim();
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
                  if (!trimmedEmail) newErrors.email = "L'adresse e-mail est obligatoire.";
                  else if (!emailRegex.test(trimmedEmail)) newErrors.email = "Adresse e-mail invalide.";
                  if (!password.trim()) newErrors.password = "Le mot de passe est obligatoire.";
                  else if (password.length < 6) newErrors.password = "Minimum 6 caractères.";
                  setFieldErrors(newErrors);
                  if (Object.keys(newErrors).length === 0) setStep(1);
                }}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold text-card-foreground mb-4">Choisissez votre rôle</h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { id: "patient", label: "Patient", icon: "👤" },
                    { id: "proche", label: "Aidant", icon: "👨‍👩‍👧" },
                  ].map((r) => (
                    <button key={r.id} type="button" onClick={() => setRole(r.id)}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                        role === r.id ? "border-primary/50 bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/20"
                      }`}>
                      <span className="text-2xl">{r.icon}</span>
                      <span className="text-sm font-medium">{r.label}</span>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input type="text" placeholder="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)}
                        className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all" />
                    </div>
                    {fieldErrors.prenom && <p className="text-xs text-destructive mt-1">{fieldErrors.prenom}</p>}
                  </div>
                  <div>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input type="text" placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)}
                        className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all" />
                    </div>
                    {fieldErrors.nom && <p className="text-xs text-destructive mt-1">{fieldErrors.nom}</p>}
                  </div>
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <input type="email" placeholder="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all" />
                </div>
                {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <input type="password" placeholder="Mot de passe (min. 6 caractères)" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all" />
                </div>
                {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
                <button type="submit" disabled={!canProceedStep0}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:brightness-110 transition-all glow-sage disabled:opacity-50 disabled:cursor-not-allowed">
                  Continuer <ArrowRight className="w-4 h-4" />
                </button>
              </motion.form>
            )}

            {step === 1 && (
              <motion.form onSubmit={handleSignUp} className="space-y-4">
                <h3 className="text-lg font-semibold text-card-foreground mb-4">Informations Personnelles</h3>
                <div className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <input type="tel" placeholder="Numéro de téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all" />
                  </div>
                  {fieldErrors.telephone && <p className="text-xs text-destructive">{fieldErrors.telephone}</p>}
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <input type="date" value={dateNaissance} max={new Date().toISOString().split("T")[0]} onChange={(e) => setDateNaissance(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all" />
                  </div>
                  {fieldErrors.dateNaissance && <p className="text-xs text-destructive">{fieldErrors.dateNaissance}</p>}

                  {role === "patient" && (
                    <div>
                      <p className="text-base font-semibold text-card-foreground mb-3">Maladies suivies</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto bg-muted/40 rounded-2xl p-4 border border-border/60">
                        {maladiesRef.map((m) => {
                          const checked = maladies.includes(m.nom);
                          return (
                            <label key={m.id} className="flex items-start gap-3 text-sm text-foreground cursor-pointer rounded-xl p-2 hover:bg-muted/40 transition-colors">
                              <input type="checkbox" checked={checked}
                                onChange={() => setMaladies((prev) => checked ? prev.filter((x) => x !== m.nom) : [...prev, m.nom])}
                                className="mt-0.5 h-4 w-4 rounded border-border accent-primary" />
                              <span className="leading-snug">{m.nom}</span>
                            </label>
                          );
                        })}
                      </div>
                      {maladies.includes("Autre") && (
                        <div className="mt-3">
                          <input type="text" placeholder="Exemple : Maladie auto-immune rare" value={autreMaladie} onChange={(e) => setAutreMaladie(e.target.value)}
                            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all" />
                        </div>
                      )}
                      {fieldErrors.maladies && <p className="mt-1 text-xs text-destructive">{fieldErrors.maladies}</p>}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setStep(0)}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground border border-border hover:border-primary/20 transition-all">
                    <ArrowLeft className="w-4 h-4" /> Retour
                  </button>
                  <button type="submit" disabled={!canProceedStep1 || loading}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:brightness-110 transition-all glow-sage disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? <><Loader className="w-4 h-4 animate-spin" /> Création...</> : <>S'inscrire <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </motion.form>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-safe/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-safe" />
                </div>
                <h3 className="text-xl font-bold text-card-foreground mb-2">Inscription Réussie !</h3>
                <p className="text-muted-foreground text-sm mb-6">Vérifiez votre email pour confirmer votre compte, puis connectez-vous.</p>
                <button onClick={handleComplete}
                  className="bg-primary text-primary-foreground px-8 py-3 rounded-xl text-sm font-semibold hover:brightness-110 transition-all glow-sage">
                  Aller à la Connexion
                </button>
              </motion.div>
            )}
          </div>

          {step !== 2 && (
            <p className="text-center text-xs text-muted-foreground mt-6">
              Déjà un compte ?{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">Se connecter</Link>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Register;