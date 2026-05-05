import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Loader, Search, CheckCircle, XCircle, Clock,
  Video, Calendar, MessageCircle, X, Send,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
  demande_patient: boolean; message_patient: string | null;
}

const PatientMedecins = () => {
  const [medecinActuel, setMedecinActuel]   = useState<Medecin | null>(null);
  const [medecins, setMedecins]             = useState<Medecin[]>([]);
  const [demandes, setDemandes]             = useState<Demande[]>([]);
  const [consultations, setConsultations]   = useState<Consultation[]>([]);
  const [patientId, setPatientId]           = useState<string | null>(null);
  const [userId, setUserId]                 = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [sending, setSending]               = useState<string | null>(null);
  const [success, setSuccess]               = useState<string | null>(null);

  // ── États modal demande consultation ──
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [consultMessage, setConsultMessage]     = useState("");
  const [consultDate, setConsultDate]           = useState("");
  const [consultSending, setConsultSending]     = useState(false);
  const [consultSuccess, setConsultSuccess]     = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

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

      // Demandes en cours
      const { data: demandesData } = await supabase
        .from("demandes").select("id, medecin_id, statut, created_at")
        .eq("patient_id", patient.id).order("created_at", { ascending: false });
      if (demandesData) setDemandes(demandesData);

      // Consultations (reçues du médecin + demandées par le patient)
      const { data: consultData } = await supabase
        .from("consultations")
        .select("id, zoom_link, scheduled_at, status, notes, demande_patient, message_patient")
        .eq("patient_id", patient.id)
        .order("scheduled_at", { ascending: false });
      if (consultData) setConsultations(consultData as Consultation[]);

      setLoading(false);
    };
    init();
  }, []);

  // ── Envoyer demande médecin ──
  const envoyerDemande = async (medecinId: string) => {
    if (!patientId) return;
    setSending(medecinId);
    const { error } = await supabase.from("demandes").insert({
      patient_id: patientId, medecin_id: medecinId, statut: "en_attente",
    });
    if (!error) {
      setSuccess(medecinId);
      const { data } = await supabase.from("demandes")
        .select("id, medecin_id, statut, created_at")
        .eq("patient_id", patientId).order("created_at", { ascending: false });
      if (data) setDemandes(data);
      setTimeout(() => setSuccess(null), 3000);
    }
    setSending(null);
  };

  // ── Demander une consultation au médecin actuel ──
  const demanderConsultation = async () => {
    if (!patientId || !medecinActuel) return;
    if (!consultDate) { alert("Veuillez choisir une date souhaitée."); return; }

    setConsultSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Insérer la consultation comme demande patient (sans zoom_link pour l'instant)
      const { error } = await supabase.from("consultations").insert({
        patient_id:      patientId,
        medecin_id:      medecinActuel.id,
        zoom_link:       "en_attente",       // sera mis à jour par le médecin
        scheduled_at:    new Date(consultDate).toISOString(),
        status:          "planifiee",
        demande_patient: true,
        message_patient: consultMessage.trim() || null,
      });

      if (error) throw error;

      // Notifier le médecin
      await supabase.from("notifications").insert({
        user_id: medecinActuel.id,
        title:   "Demande de consultation",
        message: `Un patient demande une consultation vidéo pour le ${format(
          new Date(consultDate), "dd MMMM yyyy à HH:mm", { locale: fr }
        )}.`,
        read: false,
      });

      // Recharger les consultations
      const { data: updated } = await supabase
        .from("consultations")
        .select("id, zoom_link, scheduled_at, status, notes, demande_patient, message_patient")
        .eq("patient_id", patientId)
        .order("scheduled_at", { ascending: false });
      if (updated) setConsultations(updated as Consultation[]);

      setConsultSuccess(true);
      setConsultMessage("");
      setConsultDate("");
      setTimeout(() => {
        setConsultSuccess(false);
        setShowConsultModal(false);
      }, 2000);
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setConsultSending(false);
    }
  };

  const getDemandeStatut = (medecinId: string) =>
    demandes.find(d => d.medecin_id === medecinId)?.statut || null;

  const filtered = medecins.filter(m => {
    const fullName = `${m.prenom} ${m.nom} ${m.specialite}`.toLowerCase();
    return fullName.includes(search.toLowerCase());
  });

  const getInitials = (nom: string, prenom: string) =>
    `${prenom?.[0] || ""}${nom?.[0] || ""}`.toUpperCase() || "?";

  const consultationStatusBadge = (c: Consultation) => {
    if (c.demande_patient && c.zoom_link === "en_attente")
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-600">En attente du médecin</span>;
    if (c.status === "planifiee")
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">Confirmée</span>;
    if (c.status === "terminee")
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">Terminée</span>;
    if (c.status === "annulee")
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600">Annulée</span>;
    return null;
  };

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 max-w-4xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Mes Médecins
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez votre suivi médical</p>
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
                <div className="flex flex-wrap items-center justify-between gap-4">
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

                  {/* ✅ Bouton demander consultation */}
                  <button
                    onClick={() => setShowConsultModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all"
                  >
                    <Video className="w-4 h-4" /> Demander une consultation
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Consultations ── */}
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
                        {consultationStatusBadge(c)}
                      </div>

                      {/* Message du patient si demande */}
                      {c.demande_patient && c.message_patient && (
                        <div className="flex items-start gap-2 p-2.5 bg-muted/40 rounded-xl">
                          <MessageCircle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground italic">{c.message_patient}</p>
                        </div>
                      )}

                      {/* Notes du médecin */}
                      {c.notes && (
                        <p className="text-xs text-muted-foreground">📋 {c.notes}</p>
                      )}

                      {/* Lien Zoom — seulement si confirmé par le médecin */}
                      {c.zoom_link && c.zoom_link !== "en_attente" && c.status !== "annulee" && (
                        <a
                          href={c.zoom_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-600 rounded-xl text-xs font-medium hover:bg-blue-500/20 transition-all"
                        >
                          <Video className="w-3.5 h-3.5" /> Rejoindre la consultation
                        </a>
                      )}

                      {/* Si en attente du médecin */}
                      {c.demande_patient && c.zoom_link === "en_attente" && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          En attente de confirmation et du lien Zoom par votre médecin
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Recherche médecin ── */}
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
                        <button onClick={() => envoyerDemande(m.id)} disabled={sending === m.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-medium hover:bg-primary/20 transition-all disabled:opacity-50">
                          {sending === m.id ? <Loader className="w-3 h-3 animate-spin" />
                            : success === m.id ? <><CheckCircle className="w-3.5 h-3.5" /> Envoyé !</>
                            : "Demander"}
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

      {/* ── Modal demande consultation ── */}
      <AnimatePresence>
        {showConsultModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowConsultModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              {/* Header modal */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-semibold text-card-foreground">
                    Demander une consultation
                  </h3>
                </div>
                <button onClick={() => setShowConsultModal(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {consultSuccess ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-7 h-7 text-green-500" />
                  </div>
                  <p className="font-semibold text-foreground">Demande envoyée !</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Votre médecin va confirmer et vous envoyer le lien Zoom.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Médecin ciblé */}
                  <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {getInitials(medecinActuel?.nom || "", medecinActuel?.prenom || "")}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Dr. {[medecinActuel?.prenom, medecinActuel?.nom].filter(Boolean).join(" ")}
                      </p>
                      <p className="text-xs text-muted-foreground">{medecinActuel?.specialite}</p>
                    </div>
                  </div>

                  {/* Date souhaitée */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Date et heure souhaitées *
                    </label>
                    <input
                      type="datetime-local"
                      value={consultDate}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(e) => setConsultDate(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-all"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Message pour votre médecin (optionnel)
                    </label>
                    <textarea
                      placeholder="Ex: J'ai des douleurs thoraciques depuis 3 jours..."
                      value={consultMessage}
                      onChange={(e) => setConsultMessage(e.target.value)}
                      rows={3}
                      className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-all resize-none"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <Clock className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Votre médecin recevra une notification et confirmera la date avec le lien Zoom.
                    </p>
                  </div>

                  <button
                    onClick={demanderConsultation}
                    disabled={consultSending || !consultDate}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {consultSending
                      ? <><Loader className="w-4 h-4 animate-spin" /> Envoi...</>
                      : <><Send className="w-4 h-4" /> Envoyer la demande</>
                    }
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default PatientMedecins;