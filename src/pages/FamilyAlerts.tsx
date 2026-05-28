import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, AlertCircle, Info, Loader, Clock, Filter, ChevronDown, Heart, Zap } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alerte {
  id: string;
  patient_id: string;
  severity: string;
  type: string;
  message: string;
  created_at: string;
  patient_nom: string;
}

type FilterSeverity = "toutes" | "critical" | "medium" | "low";
type SortOrder      = "desc" | "asc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeSeverity(s: string): "critical" | "medium" | "low" {
  const v = (s || "").toUpperCase().trim();
  if (["CRITICAL", "CRITIQUE"].includes(v))              return "critical";
  if (["MEDIUM", "MOYEN", "HIGH", "ELEVE"].includes(v)) return "medium";
  return "low";
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return `il y a ${diff}s`;
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
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

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.16)",
  borderRadius: "22px",
  boxShadow: "0 12px 36px rgba(30,60,50,0.06)",
};

const SEV_CFG = {
  critical: {
    label:  "Critique",
    color:  C.muted,
    bg:     "rgba(192,80,74,0.10)",
    border: "rgba(192,80,74,0.30)",
    left:   C.muted,
    icon:   "critical",
  },
  medium: {
    label:  "Moyen",
    color:  C.gold,
    bg:     "rgba(212,168,67,0.12)",
    border: "rgba(212,168,67,0.30)",
    left:   C.gold,
    icon:   "warning",
  },
  low: {
    label:  "Faible",
    color:  C.primary,
    bg:     "rgba(74,157,135,0.10)",
    border: "rgba(74,157,135,0.28)",
    left:   C.primary,
    icon:   "info",
  },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

const FamilyAlerts = () => {
  const [alertes,         setAlertes]         = useState<Alerte[]>([]);
  const [patientIds,      setPatientIds]      = useState<string[]>([]);
  const [nameByPatientId, setNameByPatientId] = useState<Record<string, string>>({});
  const [loading,         setLoading]         = useState(true);

  const [filterSev,   setFilterSev]   = useState<FilterSeverity>("toutes");
  const [sortOrder,   setSortOrder]   = useState<SortOrder>("desc");
  const [showFilters, setShowFilters] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: links } = await supabase
        .from("proche_patient").select("patient_id").eq("proche_id", user.id);
      if (!links?.length) { setLoading(false); return; }

      const patientUserIds = links.map((l) => l.patient_id);

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

  // ── Realtime ──────────────────────────────────────────────────────────────
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

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = alertes
    .filter((a) => filterSev === "toutes" || normalizeSeverity(a.severity) === filterSev)
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout role="family">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .fa-page * { font-family: 'DM Sans', sans-serif; }
        .fa-page h1, .fa-sora { font-family: 'Sora', sans-serif !important; }
        .fa-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes faAurora {
          0%,100% { transform: translate(0,0) scale(1); opacity: .48; }
          50%      { transform: translate(26px,-16px) scale(1.05); opacity: .75; }
        }
        .fa-aurora { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; }
        .fa-card { transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s; }
        .fa-card:hover { transform: translateY(-2px); box-shadow: 0 18px 44px rgba(30,60,50,0.09); }
      `}</style>

      <div className="fa-page relative space-y-5 max-w-3xl">

        {/* Aurora blobs */}
        <div className="fa-aurora" style={{ width: 380, height: 380, background: "rgba(192,80,74,0.09)", top: -80, right: -60, animation: "faAurora 22s ease-in-out infinite" }} />
        <div className="fa-aurora" style={{ width: 300, height: 300, background: "rgba(74,157,135,0.11)", top: 320, left: -100, animation: "faAurora 18s ease-in-out infinite reverse" }} />

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-3xl relative overflow-hidden" style={glass}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                }}>
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight fa-sora" style={{ color: C.text }}>
                  Mes <span className="fa-gradient-text">Alertes</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>Historique en temps réel</p>
              </div>
            </div>

            {counts.critical > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl"
                style={{
                  background: "rgba(192,80,74,0.10)",
                  border: "1px solid rgba(192,80,74,0.28)",
                  boxShadow: "0 6px 18px rgba(192,80,74,0.12)",
                }}>
                <Zap className="w-4 h-4 animate-pulse" style={{ color: C.muted }} />
                <span className="text-sm font-semibold fa-sora" style={{ color: C.muted }}>
                  {counts.critical} critique{counts.critical > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Stats ── */}
        {!loading && alertes.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total",     value: counts.total,    color: C.text,      bg: "rgba(74,157,135,0.06)",  border: "rgba(74,157,135,0.14)" },
              { label: "Critiques", value: counts.critical, color: counts.critical > 0 ? C.muted    : C.text, bg: counts.critical > 0 ? "rgba(192,80,74,0.07)"  : "rgba(74,157,135,0.06)",  border: counts.critical > 0 ? "rgba(192,80,74,0.20)"  : "rgba(74,157,135,0.14)" },
              { label: "Moyennes",  value: counts.medium,   color: counts.medium  > 0 ? C.gold      : C.text, bg: counts.medium  > 0 ? "rgba(212,168,67,0.08)" : "rgba(74,157,135,0.06)",  border: counts.medium  > 0 ? "rgba(212,168,67,0.22)" : "rgba(74,157,135,0.14)" },
            ].map((s) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="fa-card text-center p-4 rounded-[18px]"
                style={{ background: s.bg, border: `1px solid ${s.border}`, backdropFilter: "blur(8px)" }}>
                <p className="text-2xl font-bold fa-sora" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs mt-0.5 font-medium" style={{ color: C.textSoft }}>{s.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Filter chips ── */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            {([
              { id: "toutes",   label: `Toutes${counts.total    ? ` (${counts.total})`    : ""}` },
              { id: "critical", label: `Critiques${counts.critical ? ` (${counts.critical})` : ""}` },
              { id: "medium",   label: `Moyennes${counts.medium   ? ` (${counts.medium})`   : ""}` },
              { id: "low",      label: `Faibles${counts.low      ? ` (${counts.low})`      : ""}` },
            ] as { id: FilterSeverity; label: string }[]).map((f) => (
              <button key={f.id} onClick={() => setFilterSev(f.id)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all fa-sora"
                style={
                  filterSev === f.id
                    ? {
                        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                        color: "#fff",
                        border: `1px solid ${C.primary}`,
                        boxShadow: "0 4px 14px rgba(74,157,135,0.28)",
                      }
                    : {
                        background: "rgba(255,255,255,0.65)",
                        color: C.textSoft,
                        border: "1px solid rgba(74,157,135,0.18)",
                      }
                }>
                {f.label}
              </button>
            ))}

            <button
              onClick={() => setShowFilters((v) => !v)}
              className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all fa-sora"
              style={
                showFilters
                  ? { background: "rgba(74,157,135,0.12)", color: C.primaryDark, border: "1px solid rgba(74,157,135,0.28)" }
                  : { background: "rgba(255,255,255,0.65)", color: C.textSoft, border: "1px solid rgba(74,157,135,0.18)" }
              }>
              <Filter className="w-3.5 h-3.5" />
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* Sort panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden">
                <div className="p-4 rounded-[18px]" style={glass}>
                  <p className="text-xs font-semibold mb-2.5 fa-sora uppercase tracking-wider" style={{ color: C.textSoft }}>Trier par date</p>
                  <div className="flex gap-2">
                    {([
                      { id: "desc", label: "Plus récentes en premier" },
                      { id: "asc",  label: "Plus anciennes en premier" },
                    ] as { id: SortOrder; label: string }[]).map((s) => (
                      <button key={s.id} onClick={() => setSortOrder(s.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all fa-sora"
                        style={
                          sortOrder === s.id
                            ? {
                                background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                                color: "#fff",
                                boxShadow: "0 4px 12px rgba(74,157,135,0.25)",
                              }
                            : {
                                background: "rgba(74,157,135,0.07)",
                                color: C.textSoft,
                                border: "1px solid rgba(74,157,135,0.16)",
                              }
                        }>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Loading skeletons ── */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-[18px] animate-pulse"
                style={{ background: "rgba(74,157,135,0.07)", border: "1px solid rgba(74,157,135,0.12)" }} />
            ))}
          </div>
        )}

        {/* ── No alerts at all ── */}
        {!loading && alertes.length === 0 && (
          <div className="py-20 text-center rounded-[22px]" style={glass}>
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                boxShadow: "0 12px 28px rgba(74,157,135,0.28)",
              }}>
              <Heart className="w-8 h-8 text-white" />
            </div>
            <p className="text-sm font-semibold fa-sora" style={{ color: C.text }}>Aucune alerte pour vos proches</p>
            <p className="text-xs mt-1" style={{ color: C.textSoft }}>Tout va bien ✓</p>
          </div>
        )}

        {/* ── Filter returns nothing ── */}
        {!loading && alertes.length > 0 && filtered.length === 0 && (
          <div className="py-14 text-center rounded-[22px]" style={glass}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "rgba(74,157,135,0.10)" }}>
              <Filter className="w-6 h-6" style={{ color: C.primary }} />
            </div>
            <p className="text-sm fa-sora" style={{ color: C.textSoft }}>Aucune alerte dans cette catégorie</p>
          </div>
        )}

        {/* ── Alert list ── */}
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
                    className="fa-card overflow-hidden"
                    style={{
                      ...glass,
                      borderLeft: `3px solid ${cfg.left}`,
                    }}>
                    <div className="p-4 flex items-start gap-3">
                      <div className="shrink-0 mt-0.5 relative">
                        {cfg.icon === "critical" && <AlertCircle className="w-5 h-5" style={{ color: C.muted }} />}
                        {cfg.icon === "warning"  && <AlertCircle className="w-5 h-5" style={{ color: C.gold }} />}
                        {cfg.icon === "info"     && <Info        className="w-5 h-5" style={{ color: C.primary }} />}
                        {sev === "critical" && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse"
                            style={{ background: C.muted }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-xs font-semibold fa-sora" style={{ color: C.primaryDark }}>{a.patient_nom}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 fa-sora"
                            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: C.text }}>{a.message}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {a.type && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{ background: "rgba(74,157,135,0.08)", color: C.textSoft }}>
                              {a.type}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs" style={{ color: C.textSoft }}>
                            <Clock className="w-3 h-3" />{timeAgo(a.created_at)}
                          </span>
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