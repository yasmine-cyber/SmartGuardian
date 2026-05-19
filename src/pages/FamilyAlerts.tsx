import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, AlertCircle, Info, Loader, Clock, Filter, ChevronDown, Heart, Zap } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alerte {
  id: string;
  patient_id: string;  // patients.id
  severity: string;
  type: string;
  message: string;
  created_at: string;
  patient_nom: string;
}

type FilterSeverity = "toutes" | "critical" | "medium" | "low";
type SortOrder      = "desc" | "asc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Handle all possible Supabase enum values
function normalizeSeverity(s: string): "critical" | "medium" | "low" {
  const v = (s || "").toUpperCase().trim();
  if (["CRITICAL", "CRITIQUE"].includes(v))              return "critical";
  if (["MEDIUM", "MOYEN", "HIGH", "ELEVE"].includes(v)) return "medium";
  return "low";
}

const SEV_CFG = {
  critical: { label: "Critique",  border: "border-l-red-500",   icon: "critical", badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",    dot: "bg-red-500"   },
  medium:   { label: "Moyen",     border: "border-l-amber-400", icon: "warning",  badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", dot: "bg-amber-400" },
  low:      { label: "Faible",    border: "border-l-primary",   icon: "info",     badge: "bg-primary/10 text-primary",                                        dot: "bg-primary"   },
} as const;

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return `il y a ${diff}s`;
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const FamilyAlerts = () => {
  const [alertes,         setAlertes]         = useState<Alerte[]>([]);
  const [patientIds,      setPatientIds]      = useState<string[]>([]);  // patients.id
  const [nameByPatientId, setNameByPatientId] = useState<Record<string, string>>({});
  const [loading,         setLoading]         = useState(true);

  const [filterSev,   setFilterSev]   = useState<FilterSeverity>("toutes");
  const [sortOrder,   setSortOrder]   = useState<SortOrder>("desc");
  const [showFilters, setShowFilters] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // proche_patient.patient_id → utilisateurs.id
      const { data: links } = await supabase
        .from("proche_patient").select("patient_id").eq("proche_id", user.id);
      if (!links?.length) { setLoading(false); return; }

      const patientUserIds = links.map((l) => l.patient_id);

      // patients rows — patients.id is what alerts use
      const { data: patientRows } = await supabase
        .from("patients").select("id, user_id").in("user_id", patientUserIds);
      if (!patientRows?.length) { setLoading(false); return; }

      const pids = patientRows.map((p) => p.id);
      setPatientIds(pids);

      const { data: utilisateurs } = await supabase
        .from("utilisateurs").select("id, nom, prenom").in("id", patientUserIds);

      const nameMap: Record<string, string> = {};
      patientRows.forEach((p) => {
        const u = (utilisateurs || []).find((x) => x.id === p.user_id);
        nameMap[p.id] = u ? [u.prenom, u.nom].filter(Boolean).join(" ").trim() || "Proche" : "Proche";
      });
      setNameByPatientId(nameMap);

      const { data: alertData } = await supabase
        .from("alerts").select("id, message, severity, type, created_at, patient_id")
        .in("patient_id", pids).order("created_at", { ascending: false });

      if (alertData) {
        setAlertes(alertData.map((a) => ({
          ...a,
          patient_nom: nameMap[a.patient_id] || "Proche",
        })));
      }
      setLoading(false);
    };
    load();
  }, []);

  // ── Realtime ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!patientIds.length) return;
    const channel = supabase.channel("family-alerts-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, (payload) => {
        const row = payload.new as { id: string; patient_id: string; message?: string; severity?: string; type?: string; created_at?: string };
        if (!patientIds.includes(row.patient_id)) return;
        const patientNom = nameByPatientId[row.patient_id] || "Un proche";
        setAlertes((prev) => [{
          id: row.id, patient_id: row.patient_id,
          message: row.message ?? "", severity: row.severity ?? "",
          type: row.type ?? "", created_at: row.created_at ?? new Date().toISOString(),
          patient_nom: patientNom,
        }, ...prev]);
        toast.info(`Nouvelle alerte pour ${patientNom}`);
      }).subscribe();
    channelRef.current = channel;
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [patientIds, nameByPatientId]);

  // ── Filtering ────────────────────────────────────────────────────────────────
  const filtered = alertes
    .filter((a) => {
      if (filterSev === "toutes") return true;
      return normalizeSeverity(a.severity) === filterSev;
    })
    .sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortOrder === "desc" ? tb - ta : ta - tb;
    });

  const counts = {
    total:    alertes.length,
    critical: alertes.filter((a) => normalizeSeverity(a.severity) === "critical").length,
    medium:   alertes.filter((a) => normalizeSeverity(a.severity) === "medium").length,
    low:      alertes.filter((a) => normalizeSeverity(a.severity) === "low").length,
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout role="family">
      <div className="space-y-6 max-w-3xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Bell className="w-6 h-6 text-primary" /> Alertes
              </h1>
              <p className="text-muted-foreground text-sm mt-1">Historique en temps réel</p>
            </div>
            {counts.critical > 0 && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2">
                <Zap className="w-4 h-4 text-red-500 animate-pulse" />
                <span className="text-sm font-semibold text-red-600 dark:text-red-400">{counts.critical} critique{counts.critical > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Stats */}
        {!loading && alertes.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total",     value: counts.total,    cls: "text-foreground" },
              { label: "Critiques", value: counts.critical, cls: counts.critical > 0 ? "text-red-500" : "text-foreground" },
              { label: "Moyennes",  value: counts.medium,   cls: counts.medium > 0  ? "text-amber-500" : "text-foreground" },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-2xl p-4 text-center shadow-sm">
                <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter bar */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            {([
              { id: "toutes",   label: `Toutes${counts.total ? ` (${counts.total})` : ""}` },
              { id: "critical", label: `Critiques${counts.critical ? ` (${counts.critical})` : ""}` },
              { id: "medium",   label: `Moyennes${counts.medium ? ` (${counts.medium})` : ""}` },
              { id: "low",      label: `Faibles${counts.low ? ` (${counts.low})` : ""}` },
            ] as { id: FilterSeverity; label: string }[]).map((f) => (
              <button key={f.id} onClick={() => setFilterSev(f.id)}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  filterSev === f.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}>
                {f.label}
              </button>
            ))}

            <button onClick={() => setShowFilters((v) => !v)}
              className={`ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${showFilters ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <Filter className="w-3.5 h-3.5" />
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="bg-card border border-border rounded-2xl p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Trier par date</p>
                  <div className="flex gap-2">
                    {([
                      { id: "desc", label: "Plus récentes en premier" },
                      { id: "asc",  label: "Plus anciennes en premier" },
                    ] as { id: SortOrder; label: string }[]).map((s) => (
                      <button key={s.id} onClick={() => setSortOrder(s.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortOrder === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl border border-border bg-card animate-pulse" />)}
          </div>
        )}

        {/* No alerts at all */}
        {!loading && alertes.length === 0 && (
          <div className="text-center py-20 bg-card border border-border rounded-2xl">
            <Heart className="w-12 h-12 text-primary/30 mx-auto mb-4" />
            <p className="text-sm font-semibold text-foreground">Aucune alerte pour vos proches</p>
            <p className="text-xs text-muted-foreground mt-1">Tout va bien ✓</p>
          </div>
        )}

        {/* Filter returns nothing */}
        {!loading && alertes.length > 0 && filtered.length === 0 && (
          <div className="text-center py-14 bg-card border border-border rounded-2xl">
            <Filter className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucune alerte dans cette catégorie</p>
          </div>
        )}

        {/* Alert list */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {filtered.map((a, i) => {
                const sev = normalizeSeverity(a.severity);
                const cfg = SEV_CFG[sev];
                return (
                  <motion.div key={a.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: Math.min(i * 0.025, 0.25) }}
                    className={`bg-card border border-border border-l-4 ${cfg.border} rounded-2xl overflow-hidden shadow-sm`}>
                    <div className="p-4 flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5 relative">
                        {cfg.icon === "critical" && <AlertCircle className="w-5 h-5 text-red-500" />}
                        {cfg.icon === "warning"  && <AlertCircle className="w-5 h-5 text-amber-500" />}
                        {cfg.icon === "info"     && <Info className="w-5 h-5 text-primary" />}
                        {/* Pulse dot for critical */}
                        {sev === "critical" && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-xs font-semibold text-primary">{a.patient_nom}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${cfg.badge}`}>{cfg.label}</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{a.message}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {a.type && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{a.type}</span>}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{timeAgo(a.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default FamilyAlerts;