import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, Loader, Search, CheckCircle, XCircle, Clock,
  Video, Calendar, AlertTriangle,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface Medecin {
  id: string; nom: string; prenom: string;
  email: string; telephone: string | null; specialite: string;
}

interface Demande {
  id: string; medecin_id: string; statut: string; created_at: string;
}

interface Consultation {
  id: string; zoom_link: string; scheduled_at: string;
  status: string; notes: string | null;
}

const PatientMedecins = () => {
  const [medecinActuel, setMedecinActuel] = useState<Medecin | null>(null);
  const [medecins, setMedecins]           = useState<Medecin[]>([]);
  const [demandes, setDemandes]           = useState<Demande[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patientId, setPatientId]         = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [sending, setSending]             = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmTarget, setConfirmTarget] = useState<Medecin | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patient } = await supabase
        .from("patients").select("id, medecin_id").eq("user_id", user.id).single();
      if (!patient) { setLoading(false); return; }
      setPatientId(patient.id);

      // Médecin actuel
      if (patient.medecin_id) {
        const { data: med } = await supabase
          .from("utilisateurs").select("id, nom, prenom, email, telephone")
          .eq("id", patient.medecin_id).single();
        const { data: medInfo } = await supabase
          .from("medecins").select("specialite").eq("id", patient.medecin_id).single();
        if (med) setMedecinActuel({ ...med, specialite: medInfo?.specialite || "—" });
      }

      // Tous les médecins
      const { data: allMeds } = await supabase
        .from("utilisateurs").select("id, nom, prenom, email, telephone").eq("role", "medecin");
      if (allMeds) {
        const { data: medecinInfos } = await supabase
          .from("medecins").select("id, specialite").in("id", allMeds.map(m => m.id));
        setMedecins(allMeds.map(m => ({
          ...m,
          specialite: medecinInfos?.find(mi => mi.id === m.id)?.specialite || "—",
        })));
      }

      // Demandes — on ne prend que la plus récente non-refusée
      const { data: demandesData } = await supabase
        .from("demandes").select("id, medecin_id, statut, created_at")
        .eq("patient_id", patient.id)
        .neq("statut", "refusee")
        .order("created_at", { ascending: false });
      if (demandesData) setDemandes(demandesData);

      // Consultations
      const { data: consultData } = await supabase
        .from("consultations")
        .select("id, zoom_link, scheduled_at, status, notes")
        .eq("patient_id", patient.id)
        .order("scheduled_at", { ascending: false });
      if (consultData) setConsultations(consultData as Consultation[]);

      setLoading(false);
    };
    init();
  }, []);

  // Vérifie si une demande en_attente existe déjà (peu importe le médecin)
  const hasPendingRequest = demandes.some(d => d.statut === "en_attente");

  const envoyerDemande = async (medecin: Medecin) => {
    if (!patientId) return;

    // Bloquer si demande déjà en attente
    if (hasPendingRequest) {
      toast.error("Vous avez déjà une demande en attente. Attendez sa réponse avant d'en envoyer une autre.");
      return;
    }

    // Si le patient a déjà un médecin → demander confirmation
    if (medecinActuel && medecinActuel.id !== medecin.id) {
      setConfirmTarget(medecin);
      return;
    }

    await doEnvoyerDemande(medecin.id);
  };

  const doEnvoyerDemande = async (medecinId: string) => {
    if (!patientId) return;
    setSending(medecinId);
    setConfirmTarget(null);

    const { error } = await supabase.from("demandes").insert({
      patient_id: patientId,
      medecin_id: medecinId,
      statut: "en_attente",
    });

    if (error) {
      toast.error("Erreur lors de l'envoi de la demande.");
    } else {
      toast.success("Demande envoyée. Votre médecin actuel reste assigné jusqu'à acceptation.");
      const { data } = await supabase.from("demandes")
        .select("id, medecin_id, statut, created_at")
        .eq("patient_id", patientId)
        .neq("statut", "refusee")
        .order("created_at", { ascending: false });
      if (data) setDemandes(data);
    }
    setSending(null);
  };

  const getDemandeStatut = (medecinId: string) =>
    demandes.find(d => d.medecin_id === medecinId)?.statut || null;

  const filtered = medecins.filter(m => {
    const fullName = `${m.prenom} ${m.nom} ${m.specialite}`.toLowerCase();
    return fullName.includes(search.toLowerCase());
  });

  const getInitials = (nom: string, prenom: string) =>
    `${prenom?.[0] || ""}${nom?.[0] || ""}`.toUpperCase() || "?";

  const statusBadge = (status: string) => {
    if (status === "planifiee") return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">Planifiée</span>;
    if (status === "terminee")  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">Terminée</span>;
    if (status === "annulee")   return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600">Annulée</span>;
    return null;
  };

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 max-w-4xl">

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Mes Médecins
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez votre suivi médical</p>
        </motion.div>

        {/* ── Confirmation dialog ── */}
        {confirmTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                </div>
                <h3 className="font-semibold text-foreground">Changer de médecin ?</h3>
              </div>

              <p className="text-sm text-muted-foreground">
                Vous êtes actuellement suivi par{" "}
                <span className="font-medium text-foreground">
                  Dr. {[medecinActuel?.prenom, medecinActuel?.nom].filter(Boolean).join(" ")}
                </span>
                . En envoyant cette demande à{" "}
                <span className="font-medium text-foreground">
                  Dr. {[confirmTarget.prenom, confirmTarget.nom].filter(Boolean).join(" ")}
                </span>
                , votre médecin actuel sera notifié par email et détaché{" "}
                <strong>uniquement si la demande est acceptée</strong>.
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setConfirmTarget(null)}
                  className="flex-1 px-4 py-2 rounded-xl text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => doEnvoyerDemande(confirmTarget.id)}
                  disabled={sending === confirmTarget.id}
                  className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {sending === confirmTarget.id
                    ? <Loader className="w-3.5 h-3.5 animate-spin mx-auto" />
                    : "Confirmer"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

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
                    {medecinActuel.telephone && <p className="text-xs text-muted-foreground">{medecinActuel.telephone}</p>}
                  </div>
                </div>

                {/* Demande de changement en cours */}
                {hasPendingRequest && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-yellow-600 bg-yellow-500/10 rounded-xl px-3 py-2">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    Une demande de changement de médecin est en attente de réponse.
                  </div>
                )}
              </motion.div>
            )}

            {/* Consultations */}
            {consultations.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" /> Mes consultations vidéo
                </h3>
                <div className="space-y-3">
                  {consultations.map((c) => (
                    <div key={c.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">
                            {format(new Date(c.scheduled_at), "dd MMMM yyyy · HH:mm", { locale: fr })}
                          </span>
                        </div>
                        {statusBadge(c.status)}
                      </div>
                      {c.notes && <p className="text-xs text-muted-foreground">📋 {c.notes}</p>}
                      {c.zoom_link && c.status !== "annulee" && (
                        <a href={c.zoom_link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-600 rounded-xl text-xs font-medium hover:bg-blue-500/20 transition-all">
                          <Video className="w-3.5 h-3.5" /> Rejoindre la consultation
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Liste des médecins */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {medecinActuel ? "Changer de médecin" : "Trouver un médecin"}
              </h3>
              {medecinActuel && (
                <p className="text-xs text-muted-foreground mb-3">
                  Votre médecin actuel reste assigné jusqu'à ce que le nouveau accepte votre demande.
                </p>
              )}

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

                  const renderAction = () => {
                    if (isActuel) {
                      return (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Actuel
                        </span>
                      );
                    }
                    if (statut === "en_attente") {
                      return (
                        <span className="text-xs text-yellow-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> En attente
                        </span>
                      );
                    }
                    if (statut === "approuvee") {
                      return (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Accepté
                        </span>
                      );
                    }
                    // Pas de demande active → afficher bouton
                    // Désactivé si une demande est déjà en attente chez un autre médecin
                    return (
                      <button
                        onClick={() => envoyerDemande(m)}
                        disabled={sending === m.id || hasPendingRequest}
                        title={hasPendingRequest ? "Une demande est déjà en attente" : undefined}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-medium hover:bg-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {sending === m.id
                          ? <Loader className="w-3 h-3 animate-spin" />
                          : medecinActuel ? "Changer" : "Demander"}
                      </button>
                    );
                  };

                  return (
                    <motion.div key={m.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`bg-card border rounded-2xl p-4 flex items-center gap-4 ${isActuel ? "border-primary/30" : "border-border"}`}>
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
                      {renderAction()}
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