import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Users, AlertTriangle, Activity, TrendingUp } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import StatusBadge from "@/components/StatusBadge";
import LiveECGChart from "@/components/LiveECGChart";
import { supabase } from "@/lib/supabase";

const patients = [
  { id: 1, name: "Karim Messaoudi", age: 58, diagnosis: "Hypertension artérielle", bpm: 74, risk: "normal" as const, avatar: "K", device: "online" },
  { id: 2, name: "Fatima Chérif", age: 45, diagnosis: "Diabète Type 2", bpm: 92, risk: "elevated" as const, avatar: "F", device: "online" },
  { id: 3, name: "Mohamed Brahimi", age: 67, diagnosis: "Insuffisance rénale chronique", bpm: 108, risk: "critical" as const, avatar: "M", device: "online" },
  { id: 4, name: "Nadia Belkacem", age: 52, diagnosis: "Asthme sévère", bpm: 68, risk: "normal" as const, avatar: "N", device: "offline" },
  { id: 5, name: "Omar Zidane", age: 71, diagnosis: "Fibrillation auriculaire", bpm: 85, risk: "elevated" as const, avatar: "O", device: "online" },
  { id: 6, name: "Isabelle Laurent", age: 63, diagnosis: "Maladie coronarienne", bpm: 76, risk: "normal" as const, avatar: "I", device: "online" },
];

const filterTabs = ["Tous", "Stable", "Surveillance", "Critique", "Hors ligne"];

const DoctorDashboard = () => {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Tous");
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);
  const [doctorName, setDoctorName] = useState<string | null>(null);

  useEffect(() => {
    const loadDoctor = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("utilisateurs")
        .select("nom, prenom")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        const fullName =
          [data.prenom, data.nom].filter(Boolean).join(" ") || data.nom || null;
        setDoctorName(fullName);
      }
    };

    loadDoctor();
  }, []);

  const filtered = patients.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    if (activeFilter === "Tous") return matchSearch;
    if (activeFilter === "Stable") return matchSearch && p.risk === "normal";
    if (activeFilter === "Surveillance") return matchSearch && p.risk === "elevated";
    if (activeFilter === "Critique") return matchSearch && p.risk === "critical";
    if (activeFilter === "Hors ligne") return matchSearch && p.device === "offline";
    return matchSearch;
  });

  const selected = selectedPatient !== null ? patients.find((p) => p.id === selectedPatient) : null;

  return (
    <DashboardLayout role="doctor">
      <div className="space-y-6 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">
            Bonjour{doctorName ? `, ${doctorName}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{patients.filter((p) => p.risk === "critical").length} patient(s) critique(s) nécessitant votre attention</p>
        </motion.div>

        {/* KPI chips */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "Patients suivis", value: "24", color: "text-primary" },
            { icon: AlertTriangle, label: "Alertes aujourd'hui", value: "3", color: "text-critical" },
            { icon: Activity, label: "Capteurs actifs", value: "21", color: "text-safe" },
            { icon: TrendingUp, label: "En attente", value: "2", color: "text-warning" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
              <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient list */}
          <div className={`${selected ? "lg:col-span-1" : "lg:col-span-3"} space-y-4`}>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="text" placeholder="Rechercher un patient..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30" />
              </div>
            </div>

            {/* Filter chips */}
            <div className="flex gap-2 flex-wrap">
              {filterTabs.map((tab) => (
                <button key={tab} onClick={() => setActiveFilter(tab)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeFilter === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  {tab}
                </button>
              ))}
            </div>

            <div className={`${selected ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}`}>
              {filtered.map((p) => (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setSelectedPatient(p.id)}
                  className={`w-full bg-card border rounded-2xl p-4 flex items-center gap-4 text-left transition-all hover:shadow-md ${
                    selectedPatient === p.id ? "border-primary ring-1 ring-primary/20" : "border-border"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                    {p.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-card-foreground">{p.name}</p>
                      <span className={`w-2 h-2 rounded-full ${p.device === "online" ? "bg-safe" : "bg-muted-foreground/30"}`} />
                    </div>
                    <p className="text-xs text-muted-foreground">{p.age} ans • {p.diagnosis}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-card-foreground">{p.bpm}</p>
                    <p className="text-xs text-muted-foreground">BPM</p>
                  </div>
                  <StatusBadge status={p.risk} size="sm" />
                </motion.button>
              ))}
            </div>
          </div>

          {/* Patient detail */}
          {selected && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2 space-y-4">
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {selected.avatar}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-card-foreground">{selected.name}</h2>
                      <p className="text-sm text-muted-foreground">{selected.age} ans • {selected.diagnosis}</p>
                    </div>
                  </div>
                  <StatusBadge status={selected.risk} size="md" />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "FC", value: `${selected.bpm} BPM` },
                    { label: "SpO2", value: "97%" },
                    { label: "Temp", value: "36.8°C" },
                    { label: "VFC", value: "38ms" },
                  ].map((v) => (
                    <div key={v.label} className="bg-muted rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{v.value}</p>
                      <p className="text-xs text-muted-foreground">{v.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <LiveECGChart />

              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-card-foreground mb-3">Prédiction IA</h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`px-4 py-2 rounded-xl text-sm font-bold ${
                    selected.risk === "critical" ? "bg-critical/10 text-critical" :
                    selected.risk === "elevated" ? "bg-warning/10 text-warning" : "bg-safe/10 text-safe"
                  }`}>
                    {selected.risk === "critical" ? "RISQUE ÉLEVÉ" : selected.risk === "elevated" ? "RISQUE MODÉRÉ" : "RISQUE FAIBLE"}
                  </div>
                  <span className="text-xs text-muted-foreground">Probabilité d'événement dans les 24h : 8%</span>
                </div>
                <p className="text-sm text-muted-foreground">Le modèle recommande une surveillance accrue. L'analyse des patterns montre de potentiels épisodes de bradycardie pendant le sommeil.</p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-card-foreground mb-3">Notes Cliniques</h3>
                <textarea
                  placeholder="Ajouter des notes cliniques..."
                  className="w-full bg-muted rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px] resize-none"
                />
              </div>

              <button onClick={() => setSelectedPatient(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                ← Retour à la liste
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
