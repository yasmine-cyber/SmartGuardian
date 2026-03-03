import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Mail, Lock, User, ArrowRight, ArrowLeft, Check, AlertCircle, Loader } from "lucide-react";
import { supabase } from "@/lib/supabase";

const steps = ["Compte", "Détails", "Confirmé"];

const Register = () => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Step 0: Email, password, nom, role
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState("patient");

  // Step 1: Additional details
  const [telephone, setTelephone] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Sign up with Supabase Auth
      console.log("Attempting signup with:", { email, role, nom });

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            nom,
            telephone,
          },
        },
      });

      if (signUpError) {
        console.error("SignUp Error:", signUpError);
        setError(`Erreur: ${signUpError.message} (Code: ${signUpError.code || "N/A"})`);
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
      if (role === "patient") {
        const { error: patientInsertError } = await supabase.from("patients").insert({
          user_id: user.id,
          date_naissance: dateNaissance || null,
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
  const canProceedStep1 = telephone && dateNaissance;

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
              <motion.form onSubmit={(e) => {
                e.preventDefault();
                setStep(1);
              }} className="space-y-4">
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
                <>
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
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <input
                      type="date"
                      placeholder="Date de naissance"
                      value={dateNaissance}
                      onChange={(e) => setDateNaissance(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl px-10 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all"
                    />
                  </div>
                </>
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
