import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, User, Phone, Calendar, ArrowRight, AlertCircle, Loader, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

const maladiesRef = [
  { id: "1", nom: "Hypertension artérielle" },
  { id: "2", nom: "Insuffisance cardiaque" },
  { id: "3", nom: "Arythmie cardiaque" },
  { id: "4", nom: "Fibrillation auriculaire" },
  { id: "5", nom: "Angine de poitrine" },
  { id: "6", nom: "Diabète de type 1" },
  { id: "7", nom: "Diabète de type 2" },
  { id: "8", nom: "Obésité" },
  { id: "9", nom: "Insuffisance respiratoire" },
  { id: "10", nom: "Apnée du sommeil" },
  { id: "11", nom: "Épilepsie" },
  { id: "12", nom: "Maladie de Parkinson" },
  { id: "13", nom: "Alzheimer" },
  { id: "14", nom: "Insuffisance rénale" },
  { id: "15", nom: "Autre" },
];

const CompleteProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [role, setRole] = useState("patient");
  const [maladies, setMaladies] = useState<string[]>([]);
  const [autreMaladie, setAutreMaladie] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

      const { data } = await supabase
        .from("utilisateurs")
        .select("nom, prenom, role, telephone")
        .eq("id", user.id)
        .single();

      if (data) {
        setNom(data.nom || "");
        setPrenom(data.prenom || "");
        setRole(data.role || "patient");
        setTelephone(data.telephone || "");
      }
      setInitialLoading(false);
    };
    load();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!prenom.trim()) { setError("Le prénom est obligatoire."); return; }
    if (!nom.trim()) { setError("Le nom est obligatoire."); return; }
    const phoneDigits = telephone.replace(/\D/g, "");
    if (!telephone.trim() || phoneDigits.length !== 8) {
      setError("Le numéro doit contenir exactement 8 chiffres."); return;
    }
    if (!dateNaissance) { setError("La date de naissance est obligatoire."); return; }
    if (role === "patient" && maladies.length === 0) {
      setError("Sélectionnez au moins une maladie."); return;
    }
    if (maladies.includes("Autre") && !autreMaladie.trim()) {
      setError("Précisez la maladie pour le choix \"Autre\"."); return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const maladiesToSave = maladies.map((m) =>
        m === "Autre" && autreMaladie.trim() ? `Autre: ${autreMaladie.trim()}` : m
      );

      // Update utilisateurs
      const { error: e1 } = await supabase
        .from("utilisateurs")
        .update({
          nom: nom.trim(),
          prenom: prenom.trim(),
          telephone: telephone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (e1) throw e1;

      // If patient, upsert into patients table
      if (role === "patient") {
        const { data: existingPatient } = await supabase
          .from("patients")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (existingPatient) {
          await supabase.from("patients").update({
            date_naissance: dateNaissance,
            maladies: maladiesToSave,
            updated_at: new Date().toISOString(),
          }).eq("user_id", user.id);
        } else {
          await supabase.from("patients").insert({
            user_id: user.id,
            date_naissance: dateNaissance,
            maladies: maladiesToSave,
          });
        }
      }

      // Redirect to dashboard
      const dashboardMap: Record<string, string> = {
        patient: "/patient",
        medecin: "/doctor",
        proche: "/family",
        admin: "/admin",
      };
      navigate(dashboardMap[role] || "/patient");

    } catch (err: any) {
      setError(err?.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Heart className="w-10 h-10 text-primary mx-auto mb-3 animate-heartbeat" />
          <h1 className="text-2xl font-bold text-foreground">Compléter votre profil</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quelques informations supplémentaires pour personnaliser votre expérience
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/50 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">

          {/* Prénom + Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                <User className="w-3.5 h-3.5" /> Prénom
              </label>
              <input type="text" value={prenom} onChange={(e) => setPrenom(e.target.value)}
                placeholder="Votre prénom"
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                <User className="w-3.5 h-3.5" /> Nom
              </label>
              <input type="text" value={nom} onChange={(e) => setNom(e.target.value)}
                placeholder="Votre nom"
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all" />
            </div>
          </div>

          {/* Téléphone */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
              <Phone className="w-3.5 h-3.5" /> Téléphone
            </label>
            <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)}
              placeholder="8 chiffres"
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all" />
          </div>

          {/* Date de naissance */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date de naissance
            </label>
            <input type="date" value={dateNaissance}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => setDateNaissance(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all" />
          </div>

          {/* Maladies — patient only */}
          {role === "patient" && (
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Maladies suivies</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto bg-muted/40 rounded-xl p-3 border border-border/60">
                {maladiesRef.map((m) => {
                  const checked = maladies.includes(m.nom);
                  return (
                    <label key={m.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer rounded-lg p-1.5 hover:bg-muted/40 transition-colors">
                      <input type="checkbox" checked={checked}
                        onChange={() => setMaladies((prev) => checked ? prev.filter((x) => x !== m.nom) : [...prev, m.nom])}
                        className="h-4 w-4 rounded border-border accent-primary" />
                      {m.nom}
                    </label>
                  );
                })}
              </div>
              {maladies.includes("Autre") && (
                <input type="text" value={autreMaladie} onChange={(e) => setAutreMaladie(e.target.value)}
                  placeholder="Précisez la maladie"
                  className="mt-2 w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-all" />
              )}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-sage mt-2">
            {loading
              ? <><Loader className="w-4 h-4 animate-spin" /> Enregistrement...</>
              : <>Accéder à mon espace <ArrowRight className="w-4 h-4" /></>
            }
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default CompleteProfile;