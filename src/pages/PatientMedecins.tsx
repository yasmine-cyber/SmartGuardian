import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Loader, Search, CheckCircle, XCircle, Clock } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";

interface Medecin {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  specialite: string;
}

interface Demande {
  id: string;
  medecin_id: string;
  statut: string;
  created_at: string;
}

const PatientMedecins = () => {
  const [medecinActuel, setMedecinActuel] = useState<Medecin | null>(null);
  const [medecins, setMedecins] = useState<Medecin[]>([]);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

      setPatientId(patient.id);

      // Médecin actuel
      if (patient.medecin_id) {
        const { data: med } = await supabase
          .from("utilisateurs")
          .select("id, nom, prenom, email, telephone")
          .eq("id", patient.medecin_id)
          .single();

        const { data: medInfo } = await supabase
          .from("medecins")
          .select("specialite")
          .eq("id", patient.medecin_id)
          .single();

        if (med) setMedecinActuel({ ...med, specialite: medInfo?.specialite || "—" });
      }

      // Liste des médecins disponibles
      const { data: allMeds } = await supabase
        .from("utilisateurs")
        .select("id, nom, prenom, email, telephone")
        .eq("role", "medecin");

      if (allMeds) {
        const medecinIds = allMeds.map(m => m.id);
        const { data: medecinInfos } = await supabase
          .from("medecins")
          .select("id, specialite")
          .in("id", medecinIds);

        const merged = allMeds.map(m => ({
          ...m,
          specialite: medecinInfos?.find(mi => mi.id === m.id)?.specialite || "—",
        }));
        setMedecins(merged);
      }

      // Demandes en cours
      const { data: demandesData } = await supabase
        .from("demandes")
        .select("id, medecin_id, statut, created_at")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false });

      if (demandesData) setDemandes(demandesData);

      setLoading(false);
    };

    init();
  }, []);

  const envoyerDemande = async (medecinId: string) => {
    if (!patientId) return;
    setSending(medecinId);

    const { error } = await supabase
      .from("demandes")
      .insert({
        patient_id: patientId,
        medecin_id: medecinId,
        statut: "en_attente",
      });

    if (!error) {
      setSuccess(medecinId);
      const { data } = await supabase
        .from("demandes")
        .select("id, medecin_id, statut, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (data) setDemandes(data);
      setTimeout(() => setSuccess(null), 3000);
    }

    setSending(null);
  };

  const getDemandeStatut = (medecinId: string) => {
    return demandes.find(d => d.medecin_id === medecinId)?.statut || null;
  };

  const filtered = medecins.filter(m => {
    const fullName = `${m.prenom} ${m.nom} ${m.specialite}`.toLowerCase();
    return fullName.includes(search.toLowerCase());
  });

  const getInitials = (nom: string, prenom: string) =>
    `${prenom?.[0] || ""}${nom?.[0] || ""}`.toUpperCase() || "?";

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 max-w-4xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Mes Médecins
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gérez votre suivi médical
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <>
            {/* Médecin actuel */}
            {medecinActuel && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-primary/30 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" /> Votre médecin actuel
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                    {getInitials(medecinActuel.nom, medecinActuel.prenom)}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      Dr. {[medecinActuel.prenom, medecinActuel.nom].filter(Boolean).join(" ")}
                    </p>
                    <p className="text-sm text-muted-foreground">{medecinActuel.specialite}</p>
                    <p className="text-xs text-muted-foreground">{medecinActuel.email}</p>
                    {medecinActuel.telephone && (
                      <p className="text-xs text-muted-foreground">{medecinActuel.telephone}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Recherche médecin */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {medecinActuel ? "Changer de médecin" : "Trouver un médecin"}
              </h3>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Rechercher par nom ou spécialité..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>

              <div className="space-y-3">
                {filtered.map((m, i) => {
                  const statut = getDemandeStatut(m.id);
                  const isActuel = medecinActuel?.id === m.id;

                  return (
                    <motion.div key={m.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`bg-card border rounded-2xl p-4 flex items-center gap-4 ${
                        isActuel ? "border-primary/30" : "border-border"
                      }`}>
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                        {getInitials(m.nom, m.prenom)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          Dr. {[m.prenom, m.nom].filter(Boolean).join(" ")}
                          {isActuel && <span className="ml-2 text-xs text-green-500">• Votre médecin</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.specialite}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>

                      {/* Action */}
                      {isActuel ? (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Actuel
                        </span>
                      ) : statut === "en_attente" ? (
                        <span className="text-xs text-yellow-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> En attente
                        </span>
                      ) : statut === "approuvee" ? (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Accepté
                        </span>
                      ) : statut === "refusee" ? (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Refusé
                        </span>
                      ) : (
                        <button
                          onClick={() => envoyerDemande(m.id)}
                          disabled={sending === m.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-medium hover:bg-primary/20 transition-all disabled:opacity-50">
                          {sending === m.id ? (
                            <Loader className="w-3 h-3 animate-spin" />
                          ) : success === m.id ? (
                            <><CheckCircle className="w-3.5 h-3.5" /> Envoyé !</>
                          ) : (
                            "Demander"
                          )}
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientMedecins;