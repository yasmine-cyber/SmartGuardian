import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, CheckCircle, Loader, AlertTriangle, Heart,
  Activity, Thermometer, Users, TrendingUp, Zap,
  ChevronDown, ChevronRight, ChevronLeft, User, Calendar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import {
  format, formatDistanceToNow, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, startOfDay, endOfDay, isWithinInterval,
  getDaysInMonth, getDay, parseISO, addMonths, subMonths,
  isSameDay, isFuture, isToday as dateFnsIsToday,
} from "date-fns";
import { fr } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alerte {
  id: string;
  patient_id: string;
  severity: string;
  type: string;
  types: string[];   // all matched canonical types (for filtering)
  message: string;
  resolved: boolean;
  created_at: string;
  patient_nom?: string;
}

interface PatientOption { id: string; nom: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const SEVERITY_LABEL: Record<string, string> = {
  CRITICAL: "Critique", HIGH: "Élevé", MEDIUM: "Moyen", LOW: "Faible",
};

const SEVERITY_STYLE: Record<string, { badge: string; accent: string }> = {
  CRITICAL: { badge: "bg-red-500/10 text-red-600 border-red-500/20",         accent: "border-l-red-500" },
  HIGH:     { badge: "bg-orange-500/10 text-orange-600 border-orange-500/20", accent: "border-l-orange-500" },
  MEDIUM:   { badge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", accent: "border-l-yellow-400" },
  LOW:      { badge: "bg-green-500/10 text-green-600 border-green-500/20",    accent: "border-l-green-500" },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  BPM:         <Heart className="w-3 h-3" />,
  SPO2:        <Activity className="w-3 h-3" />,
  TEMPERATURE: <Thermometer className="w-3 h-3" />,
  CHUTE:       <AlertTriangle className="w-3 h-3" />,
};

const TYPE_LABELS: Record<string, string> = {
  BPM: "BPM", SPO2: "SpO2", TEMPERATURE: "Temp.", CHUTE: "Chute",
};

type Timeframe      = "day" | "today" | "week" | "month" | "all";
type SeverityFilter = "all" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type TypeFilter     = "all" | "BPM" | "SPO2" | "TEMPERATURE" | "CHUTE";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Broad normalizer — catches any casing/wording your DB uses.
 * Also stores the RAW type so we can debug what's coming in.
 */
/**
 * Derive a canonical type from BOTH the raw type string AND the alert message.
 * Priority: message content wins for anomalies since it contains the real signal.
 * An alert can match multiple types — we return an array so the filter can check any.
 */
const deriveTypes = (rawType: string, message: string): string[] => {
  const t = (rawType  || "").toUpperCase().replace(/[_\s-]/g, "");
  const m = (message  || "").toUpperCase();
  const types = new Set<string>();

  // ── BPM signals ──
  if (
    t.includes("TACHY") || t.includes("BRADY") || t.includes("CARDIAQUE") ||
    t.includes("HEART") || t.includes("PULSE") || t.includes("RYTHME") ||
    m.includes("BPM") || m.includes("TACHYCARDIE") || m.includes("BRADYCARDIE") ||
    m.includes("CARDIAQUE") || m.includes("FREQ") || m.includes("SEPSIS")
  ) types.add("BPM");

  // ── SPO2 signals ──
  if (
    t.includes("HYPOX") || t.includes("SPO2") || t.includes("SATURATION") ||
    m.includes("SPO2") || m.includes("SP02") || m.includes("HYPOX") ||
    m.includes("SATURATION") || m.includes("OXYGÈNE") || m.includes("OXYGENE")
  ) types.add("SPO2");

  // ── Temperature signals ──
  if (
    t.includes("TEMP") || t.includes("FIEV") || t.includes("THERM") ||
    m.includes("°C") || m.includes("HYPOTHERMIE") || m.includes("HYPERTHERMIE") ||
    m.includes("FIÈVRE") || m.includes("FIEVRE") || m.includes("TEMPÉRATURE") ||
    m.includes("TEMPERATURE")
  ) types.add("TEMPERATURE");

  // ── Chute signals ──
  if (
    t.includes("CHUTE") || t.includes("FALL") || t.includes("IMPACT") ||
    m.includes("CHUTE") || m.includes("FALL") || m.includes("DÉTRESSE RESPIRATOIRE")
  ) types.add("CHUTE");

  // If nothing matched, mark as OTHER so it still shows under "Tous"
  if (types.size === 0) types.add("AUTRE");

  return Array.from(types);
};

// Keep a simple single-type normalizer for display badge (pick first)
const normalizeType = (rawType: string, message: string): string =>
  deriveTypes(rawType, message)[0] || "AUTRE";

const heatColor = (count: number) => {
  if (count === 0) return { bg: "bg-muted/50",      text: "text-muted-foreground/40" };
  if (count <= 2)  return { bg: "bg-yellow-500/20", text: "text-yellow-700" };
  if (count <= 5)  return { bg: "bg-orange-500/30", text: "text-orange-700" };
  return               { bg: "bg-red-500/50",       text: "text-red-700" };
};

const getTimeframeInterval = (tf: Timeframe, selectedDay?: Date | null): { start: Date; end: Date } => {
  const now = new Date();
  if (tf === "day" && selectedDay) return { start: startOfDay(selectedDay), end: endOfDay(selectedDay) };
  if (tf === "today")  return { start: startOfDay(now), end: now };
  if (tf === "week")   return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
  if (tf === "month")  return { start: startOfMonth(now), end: endOfMonth(now) };
  return { start: new Date(0), end: now };
};

// ─── Chip ─────────────────────────────────────────────────────────────────────

const Chip = ({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) => (
  <button onClick={onClick}
    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
    }`}>
    {children}
  </button>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

const DoctorAlerts = () => {
  const navigate = useNavigate();

  const [alertes, setAlertes]   = useState<Alerte[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading]   = useState(true);

  // Filters
  const [timeframe, setTimeframe]           = useState<Timeframe>("all");
  const [selectedDay, setSelectedDay]       = useState<Date | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [typeFilter, setTypeFilter]         = useState<TypeFilter>("all");
  const [patientFilter, setPatientFilter]   = useState<string>("all");

  // Heatmap month navigation
  const [heatmapMonth, setHeatmapMonth] = useState<Date>(startOfMonth(new Date()));

  // UI
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patientsData } = await supabase
        .from("patients")
        .select("id, utilisateurs!patients_user_id_fkey(nom, prenom)")
        .eq("medecin_id", user.id);

      if (!patientsData?.length) { setLoading(false); return; }

      const patientList: PatientOption[] = patientsData.map((p: any) => {
        const u = Array.isArray(p.utilisateurs) ? p.utilisateurs[0] : p.utilisateurs;
        return { id: p.id, nom: [u?.prenom, u?.nom].filter(Boolean).join(" ") || "Inconnu" };
      });
      setPatients(patientList);

      const patientIds = patientsData.map((p: any) => p.id);
      const { data: alertesData } = await supabase
        .from("alerts")
        .select("id, patient_id, severity, type, message, resolved, created_at")
        .in("patient_id", patientIds)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (alertesData) {
        setAlertes(alertesData.map((a: any) => ({
          ...a,
          type: normalizeType(a.type, a.message),       // primary type for display badge
          types: deriveTypes(a.type, a.message),        // all matched types for filtering
          patient_nom: patientList.find(p => p.id === a.patient_id)?.nom || "Inconnu",
        })));
      }
      setLoading(false);
    };
    load();
  }, []);

  // ── Heatmap derived ────────────────────────────────────────────────────────

  // counts for the currently displayed heatmap month
  const heatmapCounts = useMemo(() => {
    const interval = { start: startOfMonth(heatmapMonth), end: endOfMonth(heatmapMonth) };
    const map: Record<number, number> = {};
    alertes
      .filter(a => {
        if (patientFilter !== "all" && a.patient_id !== patientFilter) return false;
        return isWithinInterval(parseISO(a.created_at), interval);
      })
      .forEach(a => {
        const d = parseISO(a.created_at).getDate();
        map[d] = (map[d] || 0) + 1;
      });
    return map;
  }, [alertes, heatmapMonth, patientFilter]);

  const daysInHeatmapMonth  = getDaysInMonth(heatmapMonth);
  const firstDayOffset      = (getDay(startOfMonth(heatmapMonth)) + 6) % 7; // Mon=0
  const isCurrentMonth      = isSameDay(startOfMonth(heatmapMonth), startOfMonth(new Date()));
  const isFutureMonth       = heatmapMonth > startOfMonth(new Date());

  // ── Stats (always this calendar month) ────────────────────────────────────

  // Stats follow the heatmap month
  const selectedMonthAlertes = useMemo(() => {
    const interval = { start: startOfMonth(heatmapMonth), end: endOfMonth(heatmapMonth) };
    return alertes.filter(a => {
      if (patientFilter !== "all" && a.patient_id !== patientFilter) return false;
      return isWithinInterval(parseISO(a.created_at), interval);
    });
  }, [alertes, heatmapMonth, patientFilter]);

  const critiquesCount    = selectedMonthAlertes.filter(a => a.severity === "CRITICAL").length;
  const patientsThisMonth = new Set(selectedMonthAlertes.map(a => a.patient_id)).size;
  const dailyCountsThisMonth = useMemo(() => {
    const map: Record<number, number> = {};
    selectedMonthAlertes.forEach(a => {
      const d = parseISO(a.created_at).getDate();
      map[d] = (map[d] || 0) + 1;
    });
    return map;
  }, [selectedMonthAlertes]);
  const peakEntry = Object.entries(dailyCountsThisMonth).sort((a, b) => b[1] - a[1])[0];
  const peakCount = peakEntry ? peakEntry[1] : 0;
  const peakDate  = peakEntry
    ? format(new Date(heatmapMonth.getFullYear(), heatmapMonth.getMonth(), Number(peakEntry[0])), "d MMM", { locale: fr })
    : "—";

  // ── Timeline filtered ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const interval = getTimeframeInterval(timeframe, selectedDay);
    return alertes.filter(a => {
      const date = parseISO(a.created_at);
      if (!isWithinInterval(date, interval)) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      // Type filter: check against all derived types for this alert
      if (typeFilter !== "all" && !(a.types ?? [a.type]).includes(typeFilter)) return false;
      if (patientFilter !== "all" && a.patient_id !== patientFilter) return false;
      return true;
    });
  }, [alertes, timeframe, selectedDay, severityFilter, typeFilter, patientFilter]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, Alerte[]>();
    for (const a of filtered) {
      const key = format(parseISO(a.created_at), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    for (const [key, list] of map) {
      map.set(key, list.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)));
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleDay = (key: string) =>
    setCollapsedDays(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const handleDayClick = (day: number) => {
    const date = new Date(heatmapMonth.getFullYear(), heatmapMonth.getMonth(), day);
    if (isFuture(date) && !dateFnsIsToday(date)) return; // no future days
    setSelectedDay(date);
    setTimeframe("day");
  };

  const clearDayFilter = () => {
    setSelectedDay(null);
    setTimeframe("all");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="doctor">
      <div className="space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
                <Bell className="w-6 h-6 text-primary" /> Alertes patients
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Historique complet · groupé par jour · filtrable
              </p>
            </div>
            <select
              value={patientFilter}
              onChange={e => setPatientFilter(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-all"
            >
              <option value="all">Tous les patients</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5 items-start">

          {/* ── LEFT panel ── */}
          <div className="space-y-4">

            {/* Stat cards */}
            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: format(heatmapMonth, "MMM yyyy", { locale: fr }),           value: selectedMonthAlertes.length, icon: <Bell className="w-4 h-4" />,          color: "text-foreground" },
                  { label: "Critiques",          value: critiquesCount,           icon: <AlertTriangle className="w-4 h-4" />, color: critiquesCount > 0 ? "text-red-500" : "text-foreground" },
                  { label: "Patients concernés", value: patientsThisMonth,        icon: <Users className="w-4 h-4" />,         color: "text-foreground" },
                  { label: `Pic · ${peakDate}`,  value: peakCount,                icon: <TrendingUp className="w-4 h-4" />,    color: peakCount > 5 ? "text-orange-500" : "text-foreground" },
                ].map((s, i) => (
                  <motion.div key={s.label}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.07 + i * 0.04 }}
                    className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-2 text-xs">
                      {s.icon} {s.label}
                    </div>
                    <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Heatmap with month nav */}
            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <div className="bg-card border border-border rounded-2xl p-5">

                {/* Month nav header */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setHeatmapMonth(prev => subMonths(prev, 1))}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground capitalize">
                      {format(heatmapMonth, "MMMM yyyy", { locale: fr })}
                    </h3>
                  </div>
                  <button
                    onClick={() => setHeatmapMonth(prev => addMonths(prev, 1))}
                    disabled={isCurrentMonth}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Day labels */}
                <div className="grid grid-cols-7 gap-1 mb-1.5">
                  {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                    <div key={i} className="text-center text-[10px] text-muted-foreground font-medium">{d}</div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e${i}`} />)}
                  {Array.from({ length: daysInHeatmapMonth }, (_, i) => i + 1).map(day => {
                    const cellDate   = new Date(heatmapMonth.getFullYear(), heatmapMonth.getMonth(), day);
                    const isFutureDay = isFuture(cellDate) && !dateFnsIsToday(cellDate);
                    const isTodayCell = dateFnsIsToday(cellDate);
                    const isSelected  = selectedDay && isSameDay(cellDate, selectedDay);
                    const count       = heatmapCounts[day] || 0;
                    const { bg, text } = heatColor(count);

                    return (
                      <button
                        key={day}
                        disabled={isFutureDay}
                        onClick={() => handleDayClick(day)}
                        title={isFutureDay ? undefined : `${format(cellDate, "d MMM", { locale: fr })} — ${count} alerte(s)`}
                        className={`
                          aspect-square rounded-lg flex items-center justify-center text-[11px] font-medium transition-all
                          ${isFutureDay
                            ? "opacity-20 cursor-not-allowed text-muted-foreground bg-muted/20"
                            : isSelected
                              ? "ring-2 ring-primary bg-primary text-primary-foreground cursor-pointer"
                              : `${bg} ${text} cursor-pointer hover:ring-2 hover:ring-primary/40 hover:brightness-110`
                          }
                          ${isTodayCell && !isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""}
                        `}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground flex-wrap">
                  <span>Intensité :</span>
                  {[
                    { bg: "bg-muted/50",      label: "0" },
                    { bg: "bg-yellow-500/20", label: "1–2" },
                    { bg: "bg-orange-500/30", label: "3–5" },
                    { bg: "bg-red-500/50",    label: "6+" },
                  ].map(l => (
                    <span key={l.label} className="flex items-center gap-1">
                      <span className={`w-3 h-3 rounded ${l.bg} inline-block`} /> {l.label}
                    </span>
                  ))}
                </div>

                {/* Selected day indicator */}
                {selectedDay && timeframe === "day" && (
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                    <p className="text-xs text-foreground font-medium">
                      📅 {format(selectedDay, "EEEE d MMMM", { locale: fr })}
                    </p>
                    <button onClick={clearDayFilter} className="text-xs text-primary hover:underline">
                      Effacer
                    </button>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Filters */}
            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.13 }}>
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Filtres</h3>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Période</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { v: "today", l: "Aujourd'hui" },
                      { v: "week",  l: "Semaine" },
                      { v: "month", l: "Ce mois" },
                      { v: "all",   l: "Tout" },
                    ] as { v: Timeframe; l: string }[]).map(o => (
                      <Chip key={o.v} active={timeframe === o.v} onClick={() => { setTimeframe(o.v); setSelectedDay(null); }}>{o.l}</Chip>
                    ))}
                    {timeframe === "day" && selectedDay && (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-medium border bg-primary text-primary-foreground border-primary">
                        {format(selectedDay, "d MMM", { locale: fr })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border" />

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Sévérité</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { v: "all",      l: "Toutes" },
                      { v: "CRITICAL", l: "Critique" },
                      { v: "HIGH",     l: "Élevé" },
                      { v: "MEDIUM",   l: "Moyen" },
                      { v: "LOW",      l: "Faible" },
                    ] as { v: SeverityFilter; l: string }[]).map(o => (
                      <Chip key={o.v} active={severityFilter === o.v} onClick={() => setSeverityFilter(o.v)}>{o.l}</Chip>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-border" />

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Type</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { v: "all",         l: "Tous" },
                      { v: "BPM",         l: "BPM" },
                      { v: "SPO2",        l: "SpO2" },
                      { v: "TEMPERATURE", l: "Température" },
                      { v: "CHUTE",       l: "Chute" },
                    ] as { v: TypeFilter; l: string }[]).map(o => (
                      <Chip key={o.v} active={typeFilter === o.v} onClick={() => setTypeFilter(o.v)}>{o.l}</Chip>
                    ))}
                  </div>
                </div>

                {filtered.length !== alertes.length && (
                  <div className="pt-1 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      <span className="text-foreground font-medium">{filtered.length}</span> alerte{filtered.length !== 1 ? "s" : ""} affichée{filtered.length !== 1 ? "s" : ""} sur {alertes.length}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* ── RIGHT: Timeline ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {loading ? (
              <div className="flex items-center justify-center py-32 bg-card border border-border rounded-2xl">
                <Loader className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 bg-card border border-border rounded-2xl gap-3">
                <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Aucune alerte</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {timeframe === "day" && selectedDay
                      ? `Aucune alerte le ${format(selectedDay, "d MMMM yyyy", { locale: fr })}`
                      : "Aucun résultat pour les filtres sélectionnés"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {groupedByDay.map(([dayKey, dayAlertes], gi) => {
                  const isCollapsed  = collapsedDays.has(dayKey);
                  const dayDate      = parseISO(dayKey + "T00:00:00");
                  const isToday      = dayKey === format(new Date(), "yyyy-MM-dd");
                  const isYesterday  = dayKey === format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
                  const hasCritical  = dayAlertes.some(a => a.severity === "CRITICAL");
                  const critCount    = dayAlertes.filter(a => a.severity === "CRITICAL").length;

                  const dayLabel = isToday ? "Aujourd'hui"
                    : isYesterday ? "Hier"
                    : format(dayDate, "EEEE d MMMM yyyy", { locale: fr });

                  return (
                    <motion.div key={dayKey}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(gi * 0.04, 0.3) }}
                      className="bg-card border border-border rounded-2xl overflow-hidden">

                      <button
                        onClick={() => toggleDay(dayKey)}
                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          {hasCritical && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
                          <span className="text-sm font-semibold text-foreground capitalize">{dayLabel}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {dayAlertes.length} alerte{dayAlertes.length > 1 ? "s" : ""}
                          </span>
                          {hasCritical && (
                            <span className="text-xs font-medium text-red-600 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                              {critCount} critique{critCount > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {isCollapsed
                          ? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                      </button>

                      <AnimatePresence>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="border-t border-border divide-y divide-border/60 overflow-hidden"
                          >
                            {dayAlertes.map((a) => {
                              const style = SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.LOW;
                              const time  = format(parseISO(a.created_at), "HH:mm");
                              const ago   = formatDistanceToNow(parseISO(a.created_at), { addSuffix: true, locale: fr });

                              return (
                                <div key={a.id}
                                  className={`flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors border-l-2 ${style.accent}`}>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${style.badge}`}>
                                        {SEVERITY_LABEL[a.severity] || a.severity}
                                      </span>
                                      {(a.types ?? [a.type])
                                        .filter(tp => TYPE_ICONS[tp])
                                        .map(tp => (
                                          <span key={tp} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-full">
                                            {TYPE_ICONS[tp]} {TYPE_LABELS[tp]}
                                          </span>
                                        ))
                                      }
                                    </div>
                                    <p className="text-sm text-foreground leading-snug font-medium">{a.message}</p>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <User className="w-3 h-3 shrink-0" /> {a.patient_nom}
                                      </span>
                                      <span className="text-muted-foreground/40 text-[11px]">·</span>
                                      <span className="text-[11px] text-muted-foreground font-medium">{time}</span>
                                      <span className="text-muted-foreground/40 text-[11px]">·</span>
                                      <span className="text-[11px] text-muted-foreground">{ago}</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => navigate(`/doctor/patients/${a.patient_id}`)}
                                    className="shrink-0 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-xl transition-all mt-0.5"
                                  >
                                    Voir fiche
                                  </button>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoctorAlerts;