import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader, Save, CheckCircle, Users, UserPlus, XCircle, MessageCircle } from "lucide-react";
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
    utilisateurs: { nom: string; prenom: string; telephone: string | null } | null;
  } | null;
}

const filterTabs = ["Tous", "Stable", "Surveillance", "Critique"];

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
    const { data: patientsData } = await supabase
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
        utilisateurs!patients_user_id_fkey (nom, prenom, telephone)
      `)
      .eq("medecin_id", user.id);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: demandesRaw } = await supabase
      .from("demandes")
      .select("id, patient_id, statut, created_at")
      .eq("medecin_id", user.id)
      .eq("statut", "en_attente");
    if (demandesRaw?.length) {
      const pIds = demandesRaw.map((d: any) => d.patient_id);
      const { data: patientsInfo } = await supabase
        .from("patients")
        .select("id, date_naissance, maladies, utilisateurs!patients_user_id_fkey(nom, prenom, telephone)")
        .in("id", pIds);
      const merged = demandesRaw.map((d: any) => ({
        ...d,
        patients: patientsInfo?.find((p: any) => p.id === d.patient_id) || null,
      }));
      setDemandes(merged as Demande[]);
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

  const handleDemande = async (demandeId: string, patientRowId: string, action: "approuvee" | "refusee") => {
    const { error: errDemande } = await supabase
      .from("demandes")
      .update({ statut: action, updated_at: new Date().toISOString() })
      .eq("id", demandeId);
    if (errDemande) {
      toast.error("Impossible de mettre à jour la demande.");
      return;
    }
    if (action === "approuvee") {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: errPatient } = await supabase
        .from("patients")
        .update({ medecin_id: user?.id, updated_at: new Date().toISOString() })
        .eq("id", patientRowId);
      if (errPatient) {
        toast.error("Demande acceptée mais le lien médecin n'a pas été enregistré.");
      } else {
        toast.success("Patient ajouté à votre liste.");
        await loadPatients();
      }
    } else {
      toast.success("Demande refusée.");
    }
    setDemandes((prev) => prev.filter((d) => d.id !== demandeId));
  };

  const age = (dob: string) => {
    if (!dob) return "—";
    return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  };

  return (
    <DashboardLayout role="doctor">
      <div className="space-y-6 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Mes patients</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {section === "patients"
              ? `${patients.length} patient(s) suivi(s)`
              : `${demandes.length} demande(s) en attente`}
          </p>
        </motion.div>

        {/* Section: Mes patients | Demandes */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setSection("patients")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              section === "patients"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-4 h-4" />
            Mes patients
          </button>
          <button
            onClick={() => setSection("demandes")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              section === "demandes"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Demandes{demandes.length > 0 ? ` (${demandes.length})` : ""}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {section === "patients" && (
            <motion.div
              key="patients"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
          {/* List column */}
          <div className={`${selectedPatient ? "lg:col-span-1" : "lg:col-span-3"} space-y-4`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher un patient..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {filterTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeFilter === tab
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Aucun patient trouvé
              </div>
            ) : (
              <div
                className={`${
                  selectedPatient
                    ? "space-y-2"
                    : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                }`}
              >
                {filtered.map((p) => {
                  const initials =
                    `${p.prenom?.[0] || ""}${p.nom?.[0] || ""}`.toUpperCase() || "?";
                  return (
                    <motion.button
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setSelectedPatient(p)}
                      className={`w-full bg-card border rounded-2xl p-4 flex items-center gap-4 text-left transition-all hover:shadow-md ${
                        selectedPatient?.id === p.id
                          ? "border-primary ring-1 ring-primary/20"
                          : "border-border"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground">
                          {[p.prenom, p.nom].filter(Boolean).join(" ") || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {age(p.date_naissance)} ans • {p.maladies?.[0] || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleStartConversation(p.id, e)}
                          className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                          title="Envoyer un message"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <StatusBadge status={p.status as any} size="sm" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Patient detail panel */}
          {selectedPatient && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-2 space-y-4"
            >
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {`${selectedPatient.prenom?.[0] || ""}${selectedPatient.nom?.[0] || ""}`.toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-card-foreground">
                        {[selectedPatient.prenom, selectedPatient.nom]
                          .filter(Boolean)
                          .join(" ")}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {age(selectedPatient.date_naissance)} ans •{" "}
                        {selectedPatient.maladies?.[0] || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartConversation(selectedPatient.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" /> Envoyer un message
                    </button>
                    <StatusBadge status={selectedPatient.status as any} size="md" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Téléphone</p>
                    <p className="font-medium text-foreground">
                      {selectedPatient.telephone || "—"}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Adresse</p>
                    <p className="font-medium text-foreground truncate">
                      {selectedPatient.adresse || "—"}
                    </p>
                  </div>
                  {selectedPatient.maladies?.length > 0 && (
                    <div className="bg-muted/50 rounded-xl p-3 col-span-2">
                      <p className="text-xs text-muted-foreground mb-2">Maladies</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedPatient.maladies.map((m, i) => (
                          <span
                            key={i}
                            className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedPatient.antecedents && (
                    <div className="bg-muted/50 rounded-xl p-3 col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Antécédents</p>
                      <p className="text-sm text-foreground">
                        {selectedPatient.antecedents}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <LiveECGChart />

              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-card-foreground">
                    Notes Cliniques
                  </h3>
                  {notesSaved && (
                    <span className="flex items-center gap-1 text-xs text-green-500">
                      <CheckCircle className="w-3.5 h-3.5" /> Sauvegardé
                    </span>
                  )}
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ajouter des notes cliniques..."
                  className="w-full bg-muted rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-none"
                />
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="mt-3 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {savingNotes ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Sauvegarder
                </button>
              </div>

              <button
                onClick={() => setSelectedPatient(null)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Retour à la liste
              </button>
            </motion.div>
          )}
            </motion.div>
          )}

          {section === "demandes" && (
            <motion.div
              key="demandes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {loadingDemandes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : demandes.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-12 text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">Aucune demande en attente</p>
                  <p className="text-xs text-muted-foreground mt-1">Aucun patient ne vous a sollicité</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {demandes.map((d) => {
                    const u = d.patients?.utilisateurs;
                    const fullName = [u?.prenom, u?.nom].filter(Boolean).join(" ").trim() || "—";
                    const ageVal = d.patients?.date_naissance
                      ? Math.floor((Date.now() - new Date(d.patients.date_naissance).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                      : null;
                    const maladies = d.patients?.maladies ?? [];
                    return (
                      <motion.div
                        key={d.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-start gap-4"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0 text-sm">
                          {fullName !== "—" ? fullName.charAt(0) : "?"}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p className="text-sm font-semibold text-foreground">{fullName}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {ageVal != null && <span>🎂 {ageVal} ans</span>}
                            <span>📞 {u?.telephone || "—"}</span>
                            <span>🗓 {new Date(d.created_at).toLocaleDateString("fr-FR")}</span>
                          </div>
                          {maladies.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {maladies.map((m, i) => (
                                <span
                                  key={i}
                                  className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleDemande(d.id, d.patients?.id!, "approuvee")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 rounded-xl text-xs font-medium hover:bg-green-500/20 transition-all"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Accepter
                          </button>
                          <button
                            onClick={() => handleDemande(d.id, d.patients?.id!, "refusee")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-xl text-xs font-medium hover:bg-destructive/20 transition-all"
                          >
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
