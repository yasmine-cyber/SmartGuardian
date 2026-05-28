import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, Loader, Search, CheckCircle, Clock,
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

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  primary:     "#4a9d87",
  primaryDark: "#3d8c7a",
  secondary:   "#5b8fa0",
  text:        "#1a2e28",
  textSoft:    "rgba(30,60,50,0.62)",
  gold:        "#d4a843",
  muted:       "#c0504a",
};

const glass = {
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.16)",
  borderRadius: "22px",
  boxShadow: "0 12px 36px rgba(30,60,50,0.06)",
} as React.CSSProperties;

// ─── Consultation status config ───────────────────────────────────────────────
const CONSULT_STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  planifiee: { label: "Planifiée",  color: C.secondary,  bg: "rgba(91,143,160,0.12)",  border: "rgba(91,143,160,0.28)" },
  terminee:  { label: "Terminée",   color: C.primary,    bg: "rgba(74,157,135,0.10)",  border: "rgba(74,157,135,0.25)" },
  annulee:   { label: "Annulée",    color: C.muted,      bg: "rgba(192,80,74,0.10)",   border: "rgba(192,80,74,0.28)" },
};

const PatientMedecins = () => {
  const [medecinActuel, setMedecinActuel] = useState<Medecin | null>(null);
  const [medecins, setMedecins]           = useState<Medecin[]>([]);
  const [demandes, setDemandes]           = useState<Demande[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patientId, setPatientId]         = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [sending, setSending]             = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Medecin | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patient } = await supabase
        .from("patients").select("id, medecin_id").eq("user_id", user.id).single();
      if (!patient) { setLoading(false); return; }
      setPatientId(patient.id);

      if (patient.medecin_id) {
        const { data: med } = await supabase
          .from("utilisateurs").select("id, nom, prenom, email, telephone")
          .eq("id", patient.medecin_id).single();
        const { data: medInfo } = await supabase
          .from("medecins").select("specialite").eq("id", patient.medecin_id).single();
        if (med) setMedecinActuel({ ...med, specialite: medInfo?.specialite || "—" });
      }

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

      const { data: demandesData } = await supabase
        .from("demandes").select("id, medecin_id, statut, created_at")
        .eq("patient_id", patient.id)
        .neq("statut", "refusee")
        .order("created_at", { ascending: false });
      if (demandesData) setDemandes(demandesData);

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

  const hasPendingRequest = demandes.some(d => d.statut === "en_attente");

  const envoyerDemande = async (medecin: Medecin) => {
    if (!patientId) return;
    if (hasPendingRequest) {
      toast.error("Vous avez déjà une demande en attente. Attendez sa réponse avant d'en envoyer une autre.");
      return;
    }
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

  return (
    <DashboardLayout role="patient">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .sg-page * { font-family: 'DM Sans', sans-serif; }
        .sg-page h1, .sg-page h2, .sg-page h3, .sg-sora { font-family: 'Sora', sans-serif !important; }
        .sg-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes sgAurora { 0%,100%{transform:translate(0,0) scale(1);opacity:.55} 50%{transform:translate(30px,-20px) scale(1.06);opacity:.85} }
        .sg-aurora-a { position:absolute; width:420px; height:420px; border-radius:50%; filter:blur(80px); pointer-events:none; }
        .sg-card { transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s; }
        .sg-card:hover { transform: translateY(-2px); box-shadow: 0 18px 44px rgba(30,60,50,0.08); }
        .sg-input:focus { outline: none; box-shadow: 0 0 0 3px rgba(74,157,135,0.18); }
      `}</style>

      <div className="sg-page relative">
        {/* Aurora blobs */}
        <div className="sg-aurora-a" style={{ background: "rgba(74,157,135,0.13)", top: -100, right: -80, animation: "sgAurora 22s ease-in-out infinite" }} />
        <div className="sg-aurora-a" style={{ background: "rgba(91,143,160,0.11)", top: 340, left: -120, animation: "sgAurora 18s ease-in-out infinite reverse" }} />

        <div className="relative space-y-5 max-w-4xl">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl" style={glass}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                }}>
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight sg-sora" style={{ color: C.text }}>
                  Mes <span className="sg-gradient-text">Médecins</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>Gérez votre suivi médical</p>
              </div>
            </div>
          </motion.div>

          {/* ── Confirm dialog ── */}
          {confirmTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: "rgba(26,46,40,0.45)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-sm w-full mx-4 p-6 space-y-4 overflow-hidden"
                style={{ ...glass, borderRadius: "28px" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(212,168,67,0.15)" }}>
                    <AlertTriangle className="w-5 h-5" style={{ color: C.gold }} />
                  </div>
                  <h3 className="font-bold sg-sora" style={{ color: C.text }}>Changer de médecin ?</h3>
                </div>

                <p className="text-sm leading-relaxed" style={{ color: C.textSoft }}>
                  Vous êtes actuellement suivi par{" "}
                  <span className="font-semibold" style={{ color: C.text }}>
                    Dr. {[medecinActuel?.prenom, medecinActuel?.nom].filter(Boolean).join(" ")}
                  </span>
                  . En envoyant cette demande à{" "}
                  <span className="font-semibold" style={{ color: C.text }}>
                    Dr. {[confirmTarget.prenom, confirmTarget.nom].filter(Boolean).join(" ")}
                  </span>
                  , votre médecin actuel sera notifié et détaché{" "}
                  <strong>uniquement si la demande est acceptée</strong>.
                </p>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setConfirmTarget(null)}
                    className="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:scale-105"
                    style={{
                      background: "rgba(74,157,135,0.07)",
                      color: C.textSoft,
                      border: "1px solid rgba(74,157,135,0.18)",
                    }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => doEnvoyerDemande(confirmTarget.id)}
                    disabled={sending === confirmTarget.id}
                    className="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      color: "#fff",
                      boxShadow: "0 6px 18px rgba(74,157,135,0.30)",
                    }}
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
            <div className="flex items-center justify-center py-24">
              <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
            </div>
          ) : (
            <>
              {/* ── Médecin actuel ── */}
              {medecinActuel && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="sg-card p-6" style={{ ...glass, borderLeft: `3px solid ${C.primary}` }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2"
                    style={{ color: C.textSoft }}>
                    <CheckCircle className="w-4 h-4" style={{ color: C.primary }} />
                    Votre médecin actuel
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                        boxShadow: "0 8px 20px rgba(74,157,135,0.30)",
                      }}>
                      {getInitials(medecinActuel.nom, medecinActuel.prenom)}
                    </div>
                    <div>
                      <p className="font-bold sg-sora" style={{ color: C.text }}>
                        Dr. {[medecinActuel.prenom, medecinActuel.nom].filter(Boolean).join(" ")}
                      </p>
                      <p className="text-sm" style={{ color: C.textSoft }}>{medecinActuel.specialite}</p>
                      <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>{medecinActuel.email}</p>
                      {medecinActuel.telephone && (
                        <p className="text-xs" style={{ color: C.textSoft }}>{medecinActuel.telephone}</p>
                      )}
                    </div>
                  </div>

                  {hasPendingRequest && (
                    <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium"
                      style={{
                        background: "rgba(212,168,67,0.10)",
                        color: C.gold,
                        border: "1px solid rgba(212,168,67,0.25)",
                      }}>
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      Une demande de changement de médecin est en attente de réponse.
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Consultations ── */}
              {consultations.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <Calendar className="w-4 h-4" style={{ color: C.primary }} />
                    <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>
                      Mes consultations vidéo
                    </h3>
                  </div>
                  {consultations.map((c) => {
                    const cfg = CONSULT_STATUS[c.status];
                    return (
                      <div key={c.id} className="sg-card p-5 space-y-3" style={glass}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" style={{ color: C.primary }} />
                            <span className="text-sm font-semibold sg-sora" style={{ color: C.text }}>
                              {format(new Date(c.scheduled_at), "dd MMMM yyyy · HH:mm", { locale: fr })}
                            </span>
                          </div>
                          {cfg && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                              {cfg.label}
                            </span>
                          )}
                        </div>
                        {c.notes && (
                          <p className="text-xs" style={{ color: C.textSoft }}>📋 {c.notes}</p>
                        )}
                        {c.zoom_link && c.status !== "annulee" && (
                          <a href={c.zoom_link} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                            style={{
                              background: "rgba(91,143,160,0.12)",
                              color: C.secondary,
                              border: "1px solid rgba(91,143,160,0.25)",
                            }}>
                            <Video className="w-3.5 h-3.5" /> Rejoindre la consultation
                          </a>
                        )}
                      </div>
                    );
                  })}
                </motion.div>
              )}

              {/* ── Liste des médecins ── */}
              <div className="space-y-4">
                <div className="px-1">
                  <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>
                    {medecinActuel ? "Changer de médecin" : "Trouver un médecin"}
                  </h3>
                  {medecinActuel && (
                    <p className="text-xs mt-1" style={{ color: C.textSoft }}>
                      Votre médecin actuel reste assigné jusqu'à ce que le nouveau accepte votre demande.
                    </p>
                  )}
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.textSoft }} />
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou spécialité..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="sg-input w-full pl-11 pr-4 py-3 text-sm transition-all"
                    style={{
                      ...glass,
                      borderRadius: "14px",
                      color: C.text,
                      background: "rgba(255,255,255,0.85)",
                    }}
                  />
                </div>

                <div className="space-y-3">
                  {filtered.map((m, i) => {
                    const statut = getDemandeStatut(m.id);
                    const isActuel = medecinActuel?.id === m.id;

                    const renderAction = () => {
                      if (isActuel) {
                        return (
                          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full"
                            style={{ background: "rgba(74,157,135,0.10)", color: C.primary, border: "1px solid rgba(74,157,135,0.25)" }}>
                            <CheckCircle className="w-3.5 h-3.5" /> Actuel
                          </span>
                        );
                      }
                      if (statut === "en_attente") {
                        return (
                          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full"
                            style={{ background: "rgba(212,168,67,0.12)", color: C.gold, border: "1px solid rgba(212,168,67,0.28)" }}>
                            <Clock className="w-3.5 h-3.5" /> En attente
                          </span>
                        );
                      }
                      if (statut === "approuvee") {
                        return (
                          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full"
                            style={{ background: "rgba(74,157,135,0.10)", color: C.primary, border: "1px solid rgba(74,157,135,0.25)" }}>
                            <CheckCircle className="w-3.5 h-3.5" /> Accepté
                          </span>
                        );
                      }
                      return (
                        <button
                          onClick={() => envoyerDemande(m)}
                          disabled={sending === m.id || hasPendingRequest}
                          title={hasPendingRequest ? "Une demande est déjà en attente" : undefined}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                            color: "#fff",
                            boxShadow: "0 4px 14px rgba(74,157,135,0.28)",
                          }}
                        >
                          {sending === m.id
                            ? <Loader className="w-3 h-3 animate-spin" />
                            : medecinActuel ? "Changer" : "Demander"}
                        </button>
                      );
                    };

                    return (
                      <motion.div key={m.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.04, 0.3) }}
                        className="sg-card flex items-center gap-4 p-4"
                        style={{
                          ...glass,
                          borderLeft: isActuel ? `3px solid ${C.primary}` : "3px solid transparent",
                        }}>
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold shrink-0"
                          style={{
                            background: isActuel
                              ? `linear-gradient(135deg, ${C.primary}, ${C.secondary})`
                              : "rgba(74,157,135,0.12)",
                            color: isActuel ? "#fff" : C.primary,
                            boxShadow: isActuel ? "0 6px 16px rgba(74,157,135,0.25)" : "none",
                          }}>
                          {getInitials(m.nom, m.prenom)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold sg-sora" style={{ color: C.text }}>
                            Dr. {[m.prenom, m.nom].filter(Boolean).join(" ")}
                            {isActuel && (
                              <span className="ml-2 text-xs font-medium sg-gradient-text">• Votre médecin</span>
                            )}
                          </p>
                          <p className="text-xs" style={{ color: C.textSoft }}>{m.specialite}</p>
                          <p className="text-xs" style={{ color: C.textSoft }}>{m.email}</p>
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
      </div>
    </DashboardLayout>
  );
};

export default PatientMedecins;