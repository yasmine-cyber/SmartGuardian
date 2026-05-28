import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader, Save, CheckCircle, Users, UserPlus, XCircle, MessageCircle, FileText } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import StatusBadge from "@/components/StatusBadge";
import LiveECGChart from "@/components/LiveECGChart";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Section = "patients" | "demandes";

interface Patient {
  id: string;
  user_id: string;
  nom: string;
  prenom: string;
  telephone: string;
  maladies: string[];
  date_naissance: string;
  adresse: string;
  antecedents: string;
  notes_medecin: string;
  status: string;
}

interface Demande {
  id: string;
  patient_id: string;
  statut: string;
  created_at: string;
  patients: {
    id: string;
    date_naissance: string | null;
    maladies: string[];
    medecin_id: string | null;
    utilisateurs: { nom: string; prenom: string; telephone: string | null } | null;
  } | null;
}

const filterTabs = ["Tous", "Stable", "Surveillance", "Critique"];

/* ── Palette ─────────────────────────────────────────────── */
const C = {
  primary:     "#4a9d87",
  primaryDark: "#3d8c7a",
  secondary:   "#5b8fa0",
  text:        "#1a2e28",
  textSoft:    "rgba(30,60,50,0.62)",
  gold:        "#d4a843",
  muted:       "#c0504a",
};

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.16)",
  borderRadius: "22px",
  boxShadow: "0 12px 36px rgba(30,60,50,0.06)",
};

const DoctorPatients = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sectionParam = searchParams.get("section");
  const [section, setSection] = useState<Section>(
    sectionParam === "demandes" ? "demandes" : "patients"
  );
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDemandes, setLoadingDemandes] = useState(true);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const loadPatients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: patientsData, error } = await supabase
      .from("patients")
      .select(`
        id,
        user_id,
        maladies,
        date_naissance,
        adresse,
        antecedents,
        notes_medecin,
        status,
        utilisateurs:user_id (nom, prenom, telephone)
      `)
      .eq("medecin_id", user.id);

    if (error) console.error("loadPatients error:", error);

    if (patientsData) {
      const mapped = patientsData.map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        nom: p.utilisateurs?.nom || "",
        prenom: p.utilisateurs?.prenom || "",
        telephone: p.utilisateurs?.telephone || "",
        maladies: p.maladies || [],
        date_naissance: p.date_naissance || "",
        adresse: p.adresse || "",
        antecedents: p.antecedents || "",
        notes_medecin: p.notes_medecin || "",
        status: p.status || "offline",
      }));
      setPatients(mapped);
    }
    setLoading(false);
  };

  const loadDemandes = async () => {
    const { data, error } = await supabase.rpc("get_demandes_for_medecin");

    if (error) {
      console.error("Erreur loadDemandes:", error);
      setLoadingDemandes(false);
      return;
    }

    if (data?.length) {
      const mapped: Demande[] = data.map((row: any) => ({
        id: row.demande_id,
        patient_id: row.patient_id,
        statut: row.statut,
        created_at: row.created_at,
        patients: {
          id: row.patient_id,
          date_naissance: row.date_naissance,
          maladies: row.maladies || [],
          medecin_id: row.medecin_id,
          utilisateurs: {
            nom: row.nom || "",
            prenom: row.prenom || "",
            telephone: row.telephone || null,
          },
        },
      }));
      setDemandes(mapped);
    } else {
      setDemandes([]);
    }

    setLoadingDemandes(false);
  };

  useEffect(() => {
    loadPatients();
    loadDemandes();
  }, []);

  const patientIdFromUrl = searchParams.get("patient");
  useEffect(() => {
    if (patientIdFromUrl && patients.length > 0) {
      const p = patients.find((x) => x.id === patientIdFromUrl);
      if (p) setSelectedPatient(p);
    }
  }, [patientIdFromUrl, patients]);

  useEffect(() => {
    if (selectedPatient) {
      setNotes(selectedPatient.notes_medecin || "");
      setNotesSaved(false);
    }
  }, [selectedPatient]);

  const handleSaveNotes = async () => {
    if (!selectedPatient) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from("patients")
      .update({ notes_medecin: notes, updated_at: new Date().toISOString() })
      .eq("id", selectedPatient.id);
    if (!error) {
      setPatients((prev) =>
        prev.map((p) => (p.id === selectedPatient.id ? { ...p, notes_medecin: notes } : p))
      );
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 3000);
    }
    setSavingNotes(false);
  };

  const filtered = patients.filter((p) => {
    const fullName = `${p.prenom} ${p.nom}`.toLowerCase();
    const matchSearch = fullName.includes(search.toLowerCase());
    if (activeFilter === "Tous") return matchSearch;
    if (activeFilter === "Stable") return matchSearch && p.status === "stable";
    if (activeFilter === "Surveillance") return matchSearch && p.status === "attention";
    if (activeFilter === "Critique") return matchSearch && p.status === "critical";
    return matchSearch;
  });

  const handleStartConversation = async (patientId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("patient_id", patientId)
      .eq("medecin_id", user.id)
      .maybeSingle();
    let convId = (existing as any)?.id;
    if (!convId) {
      const { data: inserted } = await supabase
        .from("conversations")
        .insert({ patient_id: patientId, medecin_id: user.id })
        .select("id")
        .single();
      convId = (inserted as any)?.id;
    }
    if (convId) navigate(`/doctor/messages?conversation=${convId}`);
  };

  const handleDemande = async (
    demandeId: string,
    patientRow: Demande["patients"],
    action: "approuvee" | "refusee"
  ) => {
    if (!patientRow) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (action === "approuvee") {
      const { error: errAccept, data: dataAccept } = await supabase.rpc("accept_demande", {
        p_demande_id: demandeId,
        p_medecin_id: user.id,
      });

      console.log("accept_demande result:", { dataAccept, errAccept });

      if (errAccept) {
        console.error("Erreur accept_demande:", errAccept);
        toast.error("Impossible d'accepter la demande.");
        return;
      }

      const ancienMedecinId = patientRow.medecin_id;
      if (ancienMedecinId) {
        const { data: ancienMed } = await supabase
          .from("utilisateurs")
          .select("email, nom, prenom")
          .eq("id", ancienMedecinId)
          .single();
        if (ancienMed) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-doctor-detached`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({
                  ancienMedecinEmail: ancienMed.email,
                  ancienMedecinNom: `${ancienMed.prenom || ""} ${ancienMed.nom || ""}`.trim(),
                  patientNom: [patientRow.utilisateurs?.prenom, patientRow.utilisateurs?.nom]
                    .filter(Boolean)
                    .join(" ") || "—",
                }),
              }
            );
          } catch (e) {
            console.error("Erreur envoi email détachement :", e);
          }
        }
      }

      toast.success("Patient ajouté à votre liste.");
      await loadPatients();
    } else {
      const { error: errDemande } = await supabase
        .from("demandes")
        .update({ statut: "refusee", updated_at: new Date().toISOString() })
        .eq("id", demandeId);

      if (errDemande) {
        toast.error("Impossible de refuser la demande.");
        return;
      }

      toast.success("Demande refusée. Le patient conserve son médecin actuel.");
    }

    setDemandes((prev) => prev.filter((d) => d.id !== demandeId));
  };

  const age = (dob: string) => {
    if (!dob) return "—";
    return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  };

  /* ── Render ── */
  return (
    <DashboardLayout role="doctor">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .dp-page * { font-family: 'DM Sans', sans-serif; }
        .dp-page h1, .dp-page h2, .dp-page h3, .dp-sora { font-family: 'Sora', sans-serif !important; }
        .dp-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes dpAurora {
          0%,100% { transform: translate(0,0) scale(1); opacity: .50; }
          50%      { transform: translate(28px,-18px) scale(1.06); opacity: .78; }
        }
        .dp-aurora { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; }
        .dp-card { transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s; }
        .dp-card:hover { transform: translateY(-2px); box-shadow: 0 18px 44px rgba(30,60,50,0.09); }
        .dp-patient-card { transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s, border-color .15s; }
        .dp-patient-card:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(74,157,135,0.10); }
        .dp-input:focus { outline: none; box-shadow: 0 0 0 3px rgba(74,157,135,0.18); }
        .dp-tab-active { font-family: 'Sora', sans-serif; }
      `}</style>

      <div className="dp-page relative space-y-5 max-w-7xl">

        {/* Aurora blobs */}
        <div className="dp-aurora" style={{ width: 400, height: 400, background: "rgba(74,157,135,0.12)", top: -80, right: -60, animation: "dpAurora 22s ease-in-out infinite" }} />
        <div className="dp-aurora" style={{ width: 320, height: 320, background: "rgba(91,143,160,0.09)", top: 320, left: -100, animation: "dpAurora 18s ease-in-out infinite reverse" }} />

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-3xl relative overflow-hidden" style={glass}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
              }}>
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight dp-sora" style={{ color: C.text }}>
                Mes <span className="dp-gradient-text">Patients</span>
              </h1>
              <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                {section === "patients"
                  ? `${patients.length} patient(s) suivi(s)`
                  : `${demandes.length} demande(s) en attente`}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Section tabs ── */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="flex gap-1 p-1 rounded-2xl w-fit"
            style={{ background: "rgba(74,157,135,0.08)", border: "1px solid rgba(74,157,135,0.14)" }}>
            <button
              onClick={() => setSection("patients")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all dp-sora"
              style={
                section === "patients"
                  ? {
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      color: "#fff",
                      boxShadow: "0 4px 14px rgba(74,157,135,0.30)",
                    }
                  : { color: C.textSoft }
              }>
              <Users className="w-4 h-4" />
              Mes patients
            </button>
            <button
              onClick={() => setSection("demandes")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all dp-sora"
              style={
                section === "demandes"
                  ? {
                      background: `linear-gradient(135deg, ${C.secondary}, ${C.primary})`,
                      color: "#fff",
                      boxShadow: "0 4px 14px rgba(91,143,160,0.30)",
                    }
                  : { color: C.textSoft }
              }>
              <UserPlus className="w-4 h-4" />
              Demandes{demandes.length > 0 ? ` (${demandes.length})` : ""}
            </button>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ══════════════ PATIENTS SECTION ══════════════ */}
          {section === "patients" && (
            <motion.div
              key="patients"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Left column — list */}
              <div className={`${selectedPatient ? "lg:col-span-1" : "lg:col-span-3"} space-y-4`}>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.textSoft }} />
                  <input
                    type="text"
                    placeholder="Rechercher un patient..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="dp-input w-full pl-10 pr-4 py-2.5 text-sm rounded-xl transition-all"
                    style={{
                      background: "rgba(255,255,255,0.80)",
                      border: "1px solid rgba(74,157,135,0.18)",
                      color: C.text,
                      backdropFilter: "blur(8px)",
                    }}
                  />
                </div>

                {/* Filter chips */}
                <div className="flex gap-2 flex-wrap">
                  {filterTabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveFilter(tab)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all dp-sora"
                      style={
                        activeFilter === tab
                          ? {
                              background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                              color: "#fff",
                              boxShadow: `0 4px 14px rgba(74,157,135,0.30)`,
                              border: `1px solid ${C.primary}`,
                            }
                          : {
                              background: "rgba(255,255,255,0.65)",
                              color: C.textSoft,
                              border: "1px solid rgba(74,157,135,0.18)",
                            }
                      }>
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Patient list */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-14 text-center rounded-[22px]" style={glass}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                      style={{ background: "rgba(74,157,135,0.10)" }}>
                      <Users className="w-6 h-6" style={{ color: C.primary }} />
                    </div>
                    <p className="text-sm dp-sora" style={{ color: C.text }}>Aucun patient trouvé</p>
                  </div>
                ) : (
                  <div className={`${selectedPatient ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}`}>
                    {filtered.map((p) => {
                      const initials = `${p.prenom?.[0] || ""}${p.nom?.[0] || ""}`.toUpperCase() || "?";
                      const isSelected = selectedPatient?.id === p.id;
                      return (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={() => setSelectedPatient(p)}
                          className="dp-patient-card w-full p-4 flex items-center gap-3 text-left cursor-pointer rounded-[18px]"
                          style={{
                            ...glass,
                            borderColor: isSelected ? C.primary : "rgba(74,157,135,0.16)",
                            boxShadow: isSelected
                              ? `0 0 0 2px rgba(74,157,135,0.25), 0 12px 32px rgba(74,157,135,0.10)`
                              : glass.boxShadow,
                          }}>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
                            style={{
                              background: `linear-gradient(135deg, rgba(74,157,135,0.18), rgba(91,143,160,0.15))`,
                              color: C.primaryDark,
                            }}>
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold dp-sora truncate" style={{ color: C.text }}>
                              {[p.prenom, p.nom].filter(Boolean).join(" ") || "—"}
                            </p>
                            <p className="text-xs truncate" style={{ color: C.textSoft }}>
                              {age(p.date_naissance)} ans • {p.maladies?.[0] || "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleStartConversation(p.id, e)}
                              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                              style={{ background: "rgba(74,157,135,0.10)", color: C.primary }}
                              title="Envoyer un message">
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); navigate(`/doctor/patients/${p.id}`); }}
                              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                              style={{ background: "rgba(91,143,160,0.10)", color: C.secondary }}
                              title="Voir la fiche complète">
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <StatusBadge status={p.status as any} size="sm" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right column — patient detail */}
              {selectedPatient && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2 space-y-4">

                  {/* Patient info card */}
                  <div className="p-6 rounded-[22px]" style={glass}>
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
                          style={{
                            background: `linear-gradient(135deg, rgba(74,157,135,0.20), rgba(91,143,160,0.16))`,
                            color: C.primaryDark,
                          }}>
                          {`${selectedPatient.prenom?.[0] || ""}${selectedPatient.nom?.[0] || ""}`.toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-lg font-bold dp-sora" style={{ color: C.text }}>
                            {[selectedPatient.prenom, selectedPatient.nom].filter(Boolean).join(" ")}
                          </h2>
                          <p className="text-sm" style={{ color: C.textSoft }}>
                            {age(selectedPatient.date_naissance)} ans • {selectedPatient.maladies?.[0] || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => navigate(`/doctor/patients/${selectedPatient.id}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                          style={{ background: "rgba(91,143,160,0.10)", color: C.secondary, border: "1px solid rgba(91,143,160,0.20)" }}>
                          <FileText className="w-3.5 h-3.5" /> Fiche complète
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartConversation(selectedPatient.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                          style={{ background: "rgba(74,157,135,0.10)", color: C.primaryDark, border: "1px solid rgba(74,157,135,0.22)" }}>
                          <MessageCircle className="w-3.5 h-3.5" /> Message
                        </button>
                        <StatusBadge status={selectedPatient.status as any} size="md" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl p-3"
                        style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.12)" }}>
                        <p className="text-xs mb-1 font-medium" style={{ color: C.textSoft }}>Téléphone</p>
                        <p className="font-semibold dp-sora" style={{ color: C.text }}>{selectedPatient.telephone || "—"}</p>
                      </div>
                      <div className="rounded-xl p-3"
                        style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.12)" }}>
                        <p className="text-xs mb-1 font-medium" style={{ color: C.textSoft }}>Adresse</p>
                        <p className="font-semibold dp-sora truncate" style={{ color: C.text }}>{selectedPatient.adresse || "—"}</p>
                      </div>
                      {selectedPatient.maladies?.length > 0 && (
                        <div className="rounded-xl p-3 col-span-2"
                          style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.12)" }}>
                          <p className="text-xs mb-2 font-medium" style={{ color: C.textSoft }}>Maladies</p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedPatient.maladies.map((m, i) => (
                              <span key={i} className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                                style={{ background: "rgba(74,157,135,0.12)", color: C.primaryDark }}>
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedPatient.antecedents && (
                        <div className="rounded-xl p-3 col-span-2"
                          style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.12)" }}>
                          <p className="text-xs mb-1 font-medium" style={{ color: C.textSoft }}>Antécédents</p>
                          <p className="text-sm" style={{ color: C.text }}>{selectedPatient.antecedents}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <LiveECGChart />

                  {/* Notes card */}
                  <div className="p-6 rounded-[22px]" style={glass}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold dp-sora" style={{ color: C.text }}>Notes Cliniques</h3>
                      {notesSaved && (
                        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.primary }}>
                          <CheckCircle className="w-3.5 h-3.5" /> Sauvegardé
                        </span>
                      )}
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ajouter des notes cliniques..."
                      className="dp-input w-full p-3 text-sm min-h-[100px] resize-none rounded-xl transition-all"
                      style={{
                        background: "rgba(74,157,135,0.05)",
                        border: "1px solid rgba(74,157,135,0.16)",
                        color: C.text,
                      }}
                    />
                    <button
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
                      style={{
                        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                        color: "#fff",
                        boxShadow: "0 6px 18px rgba(74,157,135,0.28)",
                      }}>
                      {savingNotes ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Sauvegarder
                    </button>
                  </div>

                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="text-sm font-medium transition-colors hover:underline"
                    style={{ color: C.textSoft }}>
                    ← Retour à la liste
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ══════════════ DEMANDES SECTION ══════════════ */}
          {section === "demandes" && (
            <motion.div key="demandes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {loadingDemandes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
                </div>
              ) : demandes.length === 0 ? (
                <div className="py-14 text-center rounded-[22px]" style={glass}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                    style={{
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      boxShadow: "0 10px 24px rgba(74,157,135,0.28)",
                    }}>
                    <CheckCircle className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-sm font-semibold dp-sora" style={{ color: C.text }}>Aucune demande en attente</p>
                  <p className="text-xs mt-1" style={{ color: C.textSoft }}>Aucun patient ne vous a sollicité</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {demandes.map((d, i) => {
                    const u = d.patients?.utilisateurs;
                    const fullName = [u?.prenom, u?.nom].filter(Boolean).join(" ").trim() || "—";
                    const ageVal = d.patients?.date_naissance
                      ? Math.floor((Date.now() - new Date(d.patients.date_naissance).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                      : null;
                    const maladies = d.patients?.maladies ?? [];
                    const isChangement = !!d.patients?.medecin_id;

                    return (
                      <motion.div
                        key={d.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="p-4 flex flex-wrap items-start gap-4 rounded-[18px]"
                        style={glass}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
                          style={{
                            background: `linear-gradient(135deg, rgba(74,157,135,0.18), rgba(91,143,160,0.14))`,
                            color: C.primaryDark,
                          }}>
                          {fullName !== "—" ? fullName.charAt(0).toUpperCase() : "?"}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold dp-sora" style={{ color: C.text }}>{fullName}</p>
                            {isChangement ? (
                              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                                style={{ background: "rgba(212,168,67,0.12)", color: C.gold, border: "1px solid rgba(212,168,67,0.28)" }}>
                                Changement de médecin
                              </span>
                            ) : (
                              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                                style={{ background: "rgba(91,143,160,0.10)", color: C.secondary, border: "1px solid rgba(91,143,160,0.25)" }}>
                                Nouveau patient
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" style={{ color: C.textSoft }}>
                            {ageVal != null && <span>🎂 {ageVal} ans</span>}
                            <span>📞 {u?.telephone || "—"}</span>
                            <span>🗓 {new Date(d.created_at).toLocaleDateString("fr-FR")}</span>
                          </div>
                          {maladies.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {maladies.map((m, idx) => (
                                <span key={idx} className="text-xs px-2 py-0.5 rounded-full font-medium"
                                  style={{ background: "rgba(74,157,135,0.10)", color: C.primaryDark }}>
                                  {m}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleDemande(d.id, d.patients, "approuvee")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                            style={{ background: "rgba(74,157,135,0.10)", color: C.primaryDark, border: "1px solid rgba(74,157,135,0.22)" }}>
                            <CheckCircle className="w-3.5 h-3.5" /> Accepter
                          </button>
                          <button
                            onClick={() => handleDemande(d.id, d.patients, "refusee")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                            style={{ background: "rgba(192,80,74,0.08)", color: C.muted, border: "1px solid rgba(192,80,74,0.22)" }}>
                            <XCircle className="w-3.5 h-3.5" /> Refuser
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
};

export default DoctorPatients;