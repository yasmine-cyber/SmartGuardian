import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Phone, MapPin, Loader, User, Heart } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";

interface Proche {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  lien_parente: string | null;
  contact_prioritaire: boolean;
}

interface Medecin {
  nom: string;
  prenom: string;
  telephone: string | null;
  specialite: string;
}

const PatientEmergency = () => {
  const [proches, setProches] = useState<Proche[]>([]);
  const [medecin, setMedecin] = useState<Medecin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patient } = await supabase
        .from("patients")
        .select("id, medecin_id")
        .eq("user_id", user.id)
        .single();
      if (!patient) { setLoading(false); return; }

      // Médecin
      if (patient.medecin_id) {
        const { data: med } = await supabase
          .from("utilisateurs")
          .select("nom, prenom, telephone")
          .eq("id", patient.medecin_id)
          .single();

        const { data: medInfo } = await supabase
          .from("medecins")
          .select("specialite")
          .eq("id", patient.medecin_id)
          .single();

        if (med) setMedecin({ ...med, specialite: medInfo?.specialite || "—" });
      }

      // Proches
      const { data: prochesData } = await supabase
        .from("proche_patient")
        .select(`
          lien_parente,
          contact_prioritaire,
          proche_id,
          utilisateurs!proche_patient_proche_id_fkey(id, nom, prenom, telephone)
        `)
        .eq("patient_id", patient.id);

      if (prochesData) {
        const mapped = prochesData.map((p: any) => ({
          id: p.proche_id,
          nom: p.utilisateurs?.nom || "",
          prenom: p.utilisateurs?.prenom || "",
          telephone: p.utilisateurs?.telephone || null,
          lien_parente: p.lien_parente,
          contact_prioritaire: p.contact_prioritaire,
        }));
        setProches(mapped.sort((a, b) => (b.contact_prioritaire ? 1 : 0) - (a.contact_prioritaire ? 1 : 0)));
      }

      setLoading(false);
    };

    init();
  }, []);

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 max-w-4xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" /> Urgence
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Contacts d'urgence et localisation GPS
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Médecin */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
                <Heart className="w-4 h-4 text-primary" /> Médecin traitant
              </h3>
              {medecin ? (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {`${medecin.prenom?.[0] || ""}${medecin.nom?.[0] || ""}`.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      Dr. {[medecin.prenom, medecin.nom].filter(Boolean).join(" ")}
                    </p>
                    <p className="text-xs text-muted-foreground">{medecin.specialite}</p>
                    {medecin.telephone && (
                      <p className="text-xs text-muted-foreground">{medecin.telephone}</p>
                    )}
                  </div>
                  {medecin.telephone && (
                    <a href={`tel:${medecin.telephone}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-medium hover:bg-primary/20 transition-all">
                      <Phone className="w-3.5 h-3.5" /> Appeler
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun médecin associé
                </p>
              )}
            </motion.div>

            {/* Proches */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> Contacts d'urgence
              </h3>
              {proches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun proche configuré
                </p>
              ) : (
                <div className="space-y-3">
                  {proches.map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                        {`${p.prenom?.[0] || ""}${p.nom?.[0] || ""}`.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground flex items-center gap-1">
                          {[p.prenom, p.nom].filter(Boolean).join(" ")}
                          {p.contact_prioritaire && (
                            <span className="text-xs text-yellow-500">⭐</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.lien_parente || "Proche"} • {p.telephone || "Pas de téléphone"}
                        </p>
                      </div>
                      {p.telephone && (
                        <a href={`tel:${p.telephone}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-muted text-muted-foreground rounded-xl text-xs hover:text-foreground transition-all">
                          <Phone className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Localisation */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Localisation GPS
              </h3>
              <div className="bg-muted rounded-2xl h-40 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Localisation GPS Active</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Disponible avec le module LilyGo 4G
                  </p>
                </div>
              </div>
            </motion.div>

          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientEmergency;