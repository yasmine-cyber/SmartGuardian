import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Users, AlertTriangle, Activity, TrendingUp, Bell, CheckCircle, Loader, Save } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import StatusBadge from "@/components/StatusBadge";
import LiveECGChart from "@/components/LiveECGChart";
import { supabase } from "@/lib/supabase";

type Tab = "patients" | "alertes";

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

interface Alerte {
  id: string;
  patient_id: string;
  severity: string;
  type: string;
  message: string;
  resolved: boolean;
  created_at: string;
  patient_nom?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
  elevated: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  normal: "bg-green-500/10 text-green-500 border-green-500/20",
  faible: "bg-green-500/10 text-green-500 border-green-500/20",
  modere: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  severe: "bg-red-500/10 text-red-500 border-red-500/20",
};

const filterTabs = ["Tous", "Stable", "Surveillance", "Critique"];

const DoctorDashboard = () => {
  const [activeTab, setActiveTab] = useState<Tab>("patients");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [medecinId, setMedecinId] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingAlertes, setLoadingAlertes] = useState(true);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Load doctor info + patients + alertes
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get doctor info
      const { data: util } = await supabase
        .from("utilisateurs")
        .select("nom, prenom")
        .eq("id", user.id)
        .single();

      if (util) {
        setDoctorName([util.prenom, util.nom].filter(Boolean).join(" ") || util.nom);
      }

      // Get medecin id
      const { data: med } = await supabase
        .from("medecins")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!med) return;
      setMedecinId(med.id);

      // Load patients assigned to this doctor
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
        .eq("medecin_id", med.id);

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
          status: p.status || "normal",
        }));
        setPatients(mapped);
      }
      setLoadingPatients(false);

      // Load alertes for doctor's patients
      if (patientsData && patientsData.length > 0) {
        const patientIds = patientsData.map((p: any) => p.id);
        const { data: alertesData } = await supabase
          .from("alertes")
          .select("*")
          .in("patient_id", patientIds)
          .order("created_at", { ascending: false });

        if (alertesData) {
          // Attach patient names to alerts
          const alertesMapped = alertesData.map((a: any) => {
            const patient = patientsData.find((p: any) => p.id === a.patient_id) as any;
            return {
              ...a,
              patient_nom: patient
                ? [patient.utilisateurs?.prenom, patient.utilisateurs?.nom].filter(Boolean).join(" ")
                : "Inconnu",
            };
          });
          setAlertes(alertesMapped);
        }
      }
      setLoadingAlertes(false);
    };

    init();
  }, []);

  // Sync notes when patient changes
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
        prev.map((p) => p.id === selectedPatient.id ? { ...p, notes_medecin: notes } : p)
      );
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 3000);
    }
    setSavingNotes(false);
  };

  const handleResolveAlerte = async (alerteId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("alertes")
      .update({ resolved: true, resolved_by: user?.id, resolved_at: new Date().toISOString() })
      .eq("id", alerteId);
    setAlertes((prev) => prev.map((a) => a.id === alerteId ? { ...a, resolved: true } : a));
  };

  const filtered = patients.filter((p) => {
    const fullName = `${p.prenom} ${p.nom}`.toLowerCase();
    const matchSearch = fullName.includes(search.toLowerCase());
    if (activeFilter === "Tous") return matchSearch;
    if (activeFilter === "Stable") return matchSearch && p.status === "normal";
    if (activeFilter === "Surveillance") return matchSearch && p.status === "elevated";
    if (activeFilter === "Critique") return matchSearch && p.status === "critical";
    return matchSearch;
  });

  const unresolvedAlertes = alertes.filter((a) => !a.resolved);
  const age = (dob: string) => {
    if (!dob) return "—";
    return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  };

  return (
    <DashboardLayout role="doctor">
      <div className="space-y-6 max-w-7xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">
            Bonjour{doctorName ? `, Dr. ${doctorName}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {unresolvedAlertes.length} alerte(s) non résolue(s) • {patients.length} patient(s) suivi(s)
          </p>
        </motion.div>

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "Patients suivis", value: patients.length.toString(), color: "text-primary" },
            { icon: AlertTriangle, label: "Alertes actives", value: unresolvedAlertes.length.toString(), color: "text-red-500" },
            { icon: Activity, label: "État critique", value: patients.filter(p => p.status === "critical").length.toString(), color: "text-safe" },
            { icon: TrendingUp, label: "Sous surveillance", value: patients.filter(p => p.status === "elevated").length.toString(), color: "text-yellow-500" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
              <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
          {[
            { id: "patients", label: "Patients", icon: Users },
            { id: "alertes", label: `Alertes${unresolvedAlertes.length > 0 ? ` (${unresolvedAlertes.length})` : ""}`, icon: Bell },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">

          {/* PATIENTS TAB */}
          {activeTab === "patients" && (
            <motion.div key="patients" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              <div className={`${selectedPatient ? "lg:col-span-1" : "lg:col-span-3"} space-y-4`}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" placeholder="Rechercher un patient..." value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>

                <div className="flex gap-2 flex-wrap">
                  {filterTabs.map((tab) => (
                    <button key={tab} onClick={() => setActiveFilter(tab)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        activeFilter === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}>
                      {tab}
                    </button>
                  ))}
                </div>

                {loadingPatients ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader className="w-6 h-6 text-primary animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Aucun patient trouvé
                  </div>
                ) : (
                  <div className={`${selectedPatient ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}`}>
                    {filtered.map((p) => {
                      const initials = `${p.prenom?.[0] || ""}${p.nom?.[0] || ""}`.toUpperCase() || "?";
                      return (
                        <motion.button key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          onClick={() => setSelectedPatient(p)}
                          className={`w-full bg-card border rounded-2xl p-4 flex items-center gap-4 text-left transition-all hover:shadow-md ${
                            selectedPatient?.id === p.id ? "border-primary ring-1 ring-primary/20" : "border-border"
                          }`}>
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
                          <StatusBadge status={p.status as any} size="sm" />
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Patient detail panel */}
              {selectedPatient && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  className="lg:col-span-2 space-y-4">

                  <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                          {`${selectedPatient.prenom?.[0] || ""}${selectedPatient.nom?.[0] || ""}`.toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-card-foreground">
                            {[selectedPatient.prenom, selectedPatient.nom].filter(Boolean).join(" ")}
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            {age(selectedPatient.date_naissance)} ans • {selectedPatient.maladies?.[0] || "—"}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={selectedPatient.status as any} size="md" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-muted/50 rounded-xl p-3">
                        <p className="text-xs text-muted-foreground mb-1">Téléphone</p>
                        <p className="font-medium text-foreground">{selectedPatient.telephone || "—"}</p>
                      </div>
                      <div className="bg-muted/50 rounded-xl p-3">
                        <p className="text-xs text-muted-foreground mb-1">Adresse</p>
                        <p className="font-medium text-foreground truncate">{selectedPatient.adresse || "—"}</p>
                      </div>
                      {selectedPatient.maladies?.length > 0 && (
                        <div className="bg-muted/50 rounded-xl p-3 col-span-2">
                          <p className="text-xs text-muted-foreground mb-2">Maladies</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedPatient.maladies.map((m, i) => (
                              <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{m}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedPatient.antecedents && (
                        <div className="bg-muted/50 rounded-xl p-3 col-span-2">
                          <p className="text-xs text-muted-foreground mb-1">Antécédents</p>
                          <p className="text-sm text-foreground">{selectedPatient.antecedents}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <LiveECGChart />

                  {/* Notes cliniques */}
                  <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-card-foreground">Notes Cliniques</h3>
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
                    <button onClick={handleSaveNotes} disabled={savingNotes}
                      className="mt-3 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50">
                      {savingNotes ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Sauvegarder
                    </button>
                  </div>

                  <button onClick={() => setSelectedPatient(null)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    ← Retour à la liste
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ALERTES TAB */}
          {activeTab === "alertes" && (
            <motion.div key="alertes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-3">

              {loadingAlertes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : alertes.length === 0 ? (
                <div className="text-center py-16 bg-card border border-border rounded-2xl">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">Aucune alerte</p>
                  <p className="text-xs text-muted-foreground mt-1">Tous vos patients sont stables</p>
                </div>
              ) : (
                <>
                  {/* Unresolved first */}
                  {unresolvedAlertes.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Non résolues ({unresolvedAlertes.length})
                      </p>
                      <div className="space-y-2">
                        {unresolvedAlertes.map((a) => (
                          <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-card border border-border rounded-2xl p-4 flex items-start gap-4">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.normal}`}>
                              {a.severity?.toUpperCase()}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{a.patient_nom}</p>
                              <p className="text-sm text-muted-foreground mt-0.5">{a.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(a.created_at).toLocaleString("fr-FR")} • {a.type}
                              </p>
                            </div>
                            <button onClick={() => handleResolveAlerte(a.id)}
                              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-xl text-xs font-medium hover:bg-green-500/20 transition-all">
                              <CheckCircle className="w-3.5 h-3.5" /> Résoudre
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resolved */}
                  {alertes.filter(a => a.resolved).length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Résolues
                      </p>
                      <div className="space-y-2">
                        {alertes.filter(a => a.resolved).map((a) => (
                          <div key={a.id} className="bg-muted/30 border border-border/50 rounded-2xl p-4 flex items-start gap-4 opacity-60">
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-muted text-muted-foreground flex-shrink-0">
                              {a.severity?.toUpperCase()}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{a.patient_nom}</p>
                              <p className="text-sm text-muted-foreground">{a.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(a.created_at).toLocaleString("fr-FR")}
                              </p>
                            </div>
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;