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

interface FieldErrors {
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
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const navigate = useNavigate();

  // Step 0: Email, password, nom, role
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState("patient");

  // Step 1: Additional details
  const [telephone, setTelephone] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [maladies, setMaladies] = useState<string[]>([]);
  const [autreMaladie, setAutreMaladie] = useState("");

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
        ? maladies.length === 0
          ? []
          : maladies.map((m) =>
              m === "Autre" && autreMaladie.trim()
                ? `Autre: ${autreMaladie.trim()}`
                : m
            )
        : null;

    setLoading(true);

    try {
      // Sign up with Supabase Auth
      console.log("Attempting signup with:", { email, role, nom, maladies, autreMaladie });

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            nom,
            telephone,
            // On stocke aussi ces infos en metadata pour les traiter côté base
            date_naissance: role === "patient" ? dateNaissance || null : null,
            maladies: maladiesToSave,
          },
        },
      });

      if (signUpError) {
        console.error("SignUp Error:", signUpError);
        if (signUpError.code === "over_email_send_rate_limit") {
          setError("Trop de tentatives d'envoi d'email. Veuillez réessayer dans une heure.");
        } else {
          setError(`Erreur: ${signUpError.message} (Code: ${signUpError.code || "N/A"})`);
        }
        setLoading(false);
        return;
      }

      console.log("Signup successful:", data);

      const user = data.user;
      if (!user) {
        setError("Inscription réussie, mais impossible de récupérer l'utilisateur.");
        setLoading(false);
        return;
      }

      // If the user is a patient, create an entry in public.patients
      // Attention : si la confirmation d'email est activée, il n'y a pas de session
      // immédiatement après le signup, donc on ne peut pas écrire dans les tables protégées.
      if (role === "patient" && data.session) {
        const { error: patientInsertError } = await supabase.from("patients").insert({
          user_id: user.id,
          date_naissance: dateNaissance || null,
          maladies: maladiesToSave || [],
        });

        if (patientInsertError) {
          console.error("Error inserting into patients:", patientInsertError);
          setError("Profil créé, mais impossible d'enregistrer les informations du patient.");
          setLoading(false);
          return;
        }
      }

      // If signup successful, move to final step
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => navigate("/login");

  const canProceedStep0 = email && password && nom && password.length >= 6;
  const canProceedStep1 =
    telephone &&
    dateNaissance &&
    (role !== "patient" ||
      (maladies.length > 0 &&
        (!maladies.includes("Autre") || autreMaladie.trim().length > 0)));

  return (
    <div className="min-h-screen flex">
      {/* Left — aurora */}
      <div className="hidden lg:flex lg:w-1/2 bg-secondary aurora-bg items-center justify-center p-12 relative">
        <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full bg-primary/8 blur-[100px] animate-aurora" />
        <div className="relative z-10 text-center">
          <Heart className="w-16 h-16 text-primary mx-auto mb-6 animate-heartbeat" />
          <h2 className="text-3xl font-bold text-foreground mb-3">SmartGuardian</h2>
          <p className="text-muted-foreground text-lg max-w-sm">Créez votre compte pour commencer le suivi intelligent de votre santé</p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <Heart className="w-8 h-8 text-primary animate-heartbeat" />
              <span className="text-xl font-bold text-foreground">SmartGuardian</span>
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">Créer un compte</h1>
          <p className="text-muted-foreground text-sm mb-8">Inscription {step === 2 ? "terminée" : "en " + (step + 1) + " étapes"}</p>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
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

          {/* Error message */}
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

                  const nomParts = nom.trim().split(/\s+/).filter(Boolean);
                  if (!nom.trim()) {
                    newErrors.nom = "Le nom complet est obligatoire.";
                  } else if (nomParts.length < 2) {
                    newErrors.nom = "Indiquez au moins deux parties (ex. : Prénom Nom).";
                  }

                  const trimmedEmail = email.trim();
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
                  if (!trimmedEmail) {
                    newErrors.email = "L'adresse e-mail est obligatoire.";
                  } else if (!emailRegex.test(trimmedEmail)) {
                    newErrors.email = "Adresse e-mail invalide. Exemple : nom@domaine.com";
                  }

                  if (!password.trim()) {
                    newErrors.password = "Le mot de passe est obligatoire.";
                  } else if (password.length < 6) {
                    newErrors.password = "Le mot de passe doit contenir au moins 6 caractères.";
                  }

                  setFieldErrors(newErrors);

                  if (Object.keys(newErrors).length === 0) {
                    setStep(1);
                  }
                }}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold text-card-foreground mb-4">Choisissez votre rôle</h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { id: "patient", label: "Patient", icon: "👤" },
                    // Backend enum value is "proche" but we display "Aidant"
                    { id: "proche", label: "Aidant", icon: "👨‍👩‍👧" },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                        role === r.id
                          ? "border-primary/50 bg-primary/5 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/20"
                      }`}
                    >
                      <span className="text-2xl">{r.icon}</span>
                      <span className="text-sm font-medium">{r.label}</span>
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <input
                    type="text"
                    placeholder="Nom complet"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>
                {fieldErrors.nom && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.nom}</p>
                )}
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <input
                    type="email"
                    placeholder="Adresse e-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>
                )}
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <input
                    type="password"
                    placeholder="Mot de passe (min. 6 caractères)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>
                {fieldErrors.password && (
                  <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>
                )}
                <button
                  type="submit"
                  disabled={!canProceedStep0}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:brightness-110 transition-all glow-sage disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuer <ArrowRight className="w-4 h-4" />
                </button>
              </motion.form>
            )}

            {step === 1 && (
              <motion.form onSubmit={(e) => {
                e.preventDefault();
                handleSignUp(e);
              }} className="space-y-4">
                <h3 className="text-lg font-semibold text-card-foreground mb-4">
                  Informations Personnelles
                </h3>
                <div className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <input
                      type="tel"
                      placeholder="Numéro de téléphone"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all"
                    />
                  </div>
                  {fieldErrors.telephone && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.telephone}</p>
                  )}
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <input
                      type="date"
                      placeholder="Date de naissance"
                      value={dateNaissance}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setDateNaissance(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all"
                    />
                  </div>
                  {fieldErrors.dateNaissance && (
                    <p className="text-xs text-destructive mt-1">{fieldErrors.dateNaissance}</p>
                  )}

                  {role === "patient" && (
                    <div>
                      <p className="text-base font-semibold text-card-foreground mb-3">
                        Maladies suivies
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto bg-muted/40 rounded-2xl p-4 border border-border/60">
                        {maladiesRef.map((m) => {
                          const checked = maladies.includes(m.nom);
                          return (
                            <label
                              key={m.id}
                              className="flex items-start gap-3 text-sm text-foreground cursor-pointer rounded-xl p-2 hover:bg-muted/40 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setMaladies((prev) =>
                                    checked
                                      ? prev.filter((x) => x !== m.nom)
                                      : [...prev, m.nom]
                                  );
                                }}
                                className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                              />
                              <span className="leading-snug">{m.nom}</span>
                            </label>
                          );
                        })}
                      </div>

                      {maladies.includes("Autre") && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs text-card-foreground font-medium">
                            Précisez l'autre maladie
                          </p>
                          <input
                            type="text"
                            placeholder="Exemple : Maladie auto-immune rare"
                            value={autreMaladie}
                            onChange={(e) => setAutreMaladie(e.target.value)}
                            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all"
                          />
                        </div>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Sélectionnez au moins une maladie principale liée à votre suivi.
                      </p>
                      {fieldErrors.maladies && (
                        <p className="mt-1 text-xs text-destructive">{fieldErrors.maladies}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground border border-border hover:border-primary/20 transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" /> Retour
                  </button>
                  <button
                    type="submit"
                    disabled={!canProceedStep1 || loading}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:brightness-110 transition-all glow-sage disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" /> Création...
                      </>
                    ) : (
                      <>
                        S'inscrire <ArrowRight className="w-4 h-4" />
                      </>
                    )}
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
                <button
                  onClick={handleComplete}
                  className="bg-primary text-primary-foreground px-8 py-3 rounded-xl text-sm font-semibold hover:brightness-110 transition-all glow-sage"
                >
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
