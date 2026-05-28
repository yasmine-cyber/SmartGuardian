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
  types: string[];
  message: string;
  resolved: boolean;
  created_at: string;
  patient_nom?: string;
}

interface PatientOption { id: string; nom: string; }

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

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SEVERITY_LABEL: Record<string, string>  = { CRITICAL: "Critique", HIGH: "Élevé", MEDIUM: "Moyen", LOW: "Faible" };

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; accentColor: string }> = {
  CRITICAL: { color: C.muted,     bg: "rgba(192,80,74,0.10)",  border: "rgba(192,80,74,0.28)",  accentColor: C.muted },
  HIGH:     { color: "#d4843a",   bg: "rgba(212,132,58,0.10)", border: "rgba(212,132,58,0.28)", accentColor: "#d4843a" },
  MEDIUM:   { color: C.gold,      bg: "rgba(212,168,67,0.12)", border: "rgba(212,168,67,0.28)", accentColor: C.gold },
  LOW:      { color: C.primary,   bg: "rgba(74,157,135,0.10)", border: "rgba(74,157,135,0.25)", accentColor: C.primary },
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

const deriveTypes = (rawType: string, message: string): string[] => {
  const t = (rawType  || "").toUpperCase().replace(/[_\s-]/g, "");
  const m = (message  || "").toUpperCase();
  const types = new Set<string>();

  if (t.includes("TACHY") || t.includes("BRADY") || t.includes("CARDIAQUE") || t.includes("HEART") || t.includes("PULSE") || t.includes("RYTHME") || m.includes("BPM") || m.includes("TACHYCARDIE") || m.includes("BRADYCARDIE") || m.includes("CARDIAQUE") || m.includes("FREQ") || m.includes("SEPSIS")) types.add("BPM");
  if (t.includes("HYPOX") || t.includes("SPO2") || t.includes("SATURATION") || m.includes("SPO2") || m.includes("SP02") || m.includes("HYPOX") || m.includes("SATURATION") || m.includes("OXYGÈNE") || m.includes("OXYGENE")) types.add("SPO2");
  if (t.includes("TEMP") || t.includes("FIEV") || t.includes("THERM") || m.includes("°C") || m.includes("HYPOTHERMIE") || m.includes("HYPERTHERMIE") || m.includes("FIÈVRE") || m.includes("FIEVRE") || m.includes("TEMPÉRATURE") || m.includes("TEMPERATURE")) types.add("TEMPERATURE");
  if (t.includes("CHUTE") || t.includes("FALL") || t.includes("IMPACT") || m.includes("CHUTE") || m.includes("FALL") || m.includes("DÉTRESSE RESPIRATOIRE")) types.add("CHUTE");
  if (types.size === 0) types.add("AUTRE");
  return Array.from(types);
};

const normalizeType = (rawType: string, message: string): string =>
  deriveTypes(rawType, message)[0] || "AUTRE";

const heatColor = (count: number): { bg: string; text: string } => {
  if (count === 0) return { bg: "rgba(74,157,135,0.07)", text: "rgba(30,60,50,0.30)" };
  if (count <= 2)  return { bg: "rgba(212,168,67,0.20)", text: "#b8912a" };
  if (count <= 5)  return { bg: "rgba(212,132,58,0.28)", text: "#b86d20" };
  return               { bg: "rgba(192,80,74,0.35)",    text: "#a04040" };
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
    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
    style={
      active
        ? {
            background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
            color: "#fff",
            border: `1px solid ${C.primary}`,
            boxShadow: `0 4px 12px rgba(74,157,135,0.30)`,
          }
        : {
            background: "rgba(255,255,255,0.65)",
            color: C.textSoft,
            border: "1px solid rgba(74,157,135,0.18)",
          }
    }>
    {children}
  </button>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

const DoctorAlerts = () => {
  const navigate = useNavigate();

  const [alertes, setAlertes]   = useState<Alerte[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading]   = useState(true);

  const [timeframe, setTimeframe]           = useState<Timeframe>("all");
  const [selectedDay, setSelectedDay]       = useState<Date | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [typeFilter, setTypeFilter]         = useState<TypeFilter>("all");
  const [patientFilter, setPatientFilter]   = useState<string>("all");
  const [heatmapMonth, setHeatmapMonth]     = useState<Date>(startOfMonth(new Date()));
  const [collapsedDays, setCollapsedDays]   = useState<Set<string>>(new Set());

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
          type: normalizeType(a.type, a.message),
          types: deriveTypes(a.type, a.message),
          patient_nom: patientList.find(p => p.id === a.patient_id)?.nom || "Inconnu",
        })));
      }
      setLoading(false);
    };
    load();
  }, []);

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

  const daysInHeatmapMonth = getDaysInMonth(heatmapMonth);
  const firstDayOffset     = (getDay(startOfMonth(heatmapMonth)) + 6) % 7;
  const isCurrentMonth     = isSameDay(startOfMonth(heatmapMonth), startOfMonth(new Date()));

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

  const filtered = useMemo(() => {
    const interval = getTimeframeInterval(timeframe, selectedDay);
    return alertes.filter(a => {
      const date = parseISO(a.created_at);
      if (!isWithinInterval(date, interval)) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
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

  const toggleDay = (key: string) =>
    setCollapsedDays(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const handleDayClick = (day: number) => {
    const date = new Date(heatmapMonth.getFullYear(), heatmapMonth.getMonth(), day);
    if (isFuture(date) && !dateFnsIsToday(date)) return;
    setSelectedDay(date);
    setTimeframe("day");
  };

  const clearDayFilter = () => { setSelectedDay(null); setTimeframe("all"); };

  const STAT_CARDS = [
    { label: format(heatmapMonth, "MMM yyyy", { locale: fr }), value: selectedMonthAlertes.length, icon: <Bell className="w-4 h-4" />, color: C.text },
    { label: "Critiques",           value: critiquesCount,    icon: <AlertTriangle className="w-4 h-4" />, color: critiquesCount > 0 ? C.muted : C.text },
    { label: "Patients concernés",  value: patientsThisMonth, icon: <Users className="w-4 h-4" />,         color: C.text },
    { label: `Pic · ${peakDate}`,   value: peakCount,         icon: <TrendingUp className="w-4 h-4" />,    color: peakCount > 5 ? "#d4843a" : C.text },
  ];

  return (
    <DashboardLayout role="doctor">
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
        .sg-select { appearance: none; }
        .sg-select:focus { outline: none; box-shadow: 0 0 0 3px rgba(74,157,135,0.18); }
      `}</style>

      <div className="sg-page relative">
        {/* Aurora blobs */}
        <div className="sg-aurora-a" style={{ background: "rgba(192,80,74,0.10)", top: -100, right: -80, animation: "sgAurora 22s ease-in-out infinite" }} />
        <div className="sg-aurora-a" style={{ background: "rgba(74,157,135,0.12)", top: 340, left: -120, animation: "sgAurora 18s ease-in-out infinite reverse" }} />

        <div className="relative space-y-5">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl" style={glass}>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                    boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                  }}>
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight sg-sora" style={{ color: C.text }}>
                    Alertes <span className="sg-gradient-text">patients</span>
                  </h1>
                  <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                    Historique complet · groupé par jour · filtrable
                  </p>
                </div>
              </div>
              <select
                value={patientFilter}
                onChange={e => setPatientFilter(e.target.value)}
                className="sg-select px-4 py-2.5 text-sm rounded-2xl transition-all"
                style={{
                  background: "rgba(255,255,255,0.85)",
                  border: "1px solid rgba(74,157,135,0.22)",
                  color: C.text,
                  boxShadow: "0 2px 8px rgba(30,60,50,0.06)",
                }}
              >
                <option value="all">Tous les patients</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </div>
          </motion.div>

          {/* ── Two-column layout ── */}
          <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5 items-start">

            {/* ── LEFT panel ── */}
            <div className="space-y-4">

              {/* Stat cards */}
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
                <div className="grid grid-cols-2 gap-3">
                  {STAT_CARDS.map((s, i) => (
                    <motion.div key={s.label}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.07 + i * 0.04 }}
                      className="sg-card p-4"
                      style={glass}>
                      <div className="flex items-center gap-1.5 mb-2 text-xs" style={{ color: C.textSoft }}>
                        {s.icon} {s.label}
                      </div>
                      <p className="text-3xl font-bold sg-sora" style={{ color: s.color }}>{s.value}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Heatmap */}
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                <div className="p-5" style={glass}>
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setHeatmapMonth(prev => subMonths(prev, 1))}
                      className="p-1.5 rounded-xl transition-all hover:scale-110"
                      style={{ background: "rgba(74,157,135,0.08)", color: C.textSoft }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" style={{ color: C.primary }} />
                      <h3 className="text-sm font-semibold sg-sora capitalize" style={{ color: C.text }}>
                        {format(heatmapMonth, "MMMM yyyy", { locale: fr })}
                      </h3>
                    </div>
                    <button
                      onClick={() => setHeatmapMonth(prev => addMonths(prev, 1))}
                      disabled={isCurrentMonth}
                      className="p-1.5 rounded-xl transition-all hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: "rgba(74,157,135,0.08)", color: C.textSoft }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Day labels */}
                  <div className="grid grid-cols-7 gap-1 mb-1.5">
                    {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                      <div key={i} className="text-center text-[10px] font-semibold" style={{ color: C.textSoft }}>{d}</div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: daysInHeatmapMonth }, (_, i) => i + 1).map(day => {
                      const cellDate    = new Date(heatmapMonth.getFullYear(), heatmapMonth.getMonth(), day);
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
                          className="aspect-square rounded-lg flex items-center justify-center text-[11px] font-medium transition-all"
                          style={
                            isFutureDay
                              ? { opacity: 0.2, cursor: "not-allowed", color: C.textSoft, background: "rgba(74,157,135,0.05)" }
                              : isSelected
                                ? { background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, color: "#fff", boxShadow: `0 4px 12px rgba(74,157,135,0.35)` }
                                : {
                                    background: bg,
                                    color: text,
                                    cursor: "pointer",
                                    outline: isTodayCell ? `2px solid ${C.primary}` : "none",
                                    outlineOffset: "1px",
                                  }
                          }
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-3 mt-3 text-[10px] flex-wrap" style={{ color: C.textSoft }}>
                    <span>Intensité :</span>
                    {[
                      { bg: "rgba(74,157,135,0.07)",  label: "0" },
                      { bg: "rgba(212,168,67,0.20)",  label: "1–2" },
                      { bg: "rgba(212,132,58,0.28)",  label: "3–5" },
                      { bg: "rgba(192,80,74,0.35)",   label: "6+" },
                    ].map(l => (
                      <span key={l.label} className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded inline-block" style={{ background: l.bg }} />
                        {l.label}
                      </span>
                    ))}
                  </div>

                  {/* Selected day indicator */}
                  {selectedDay && timeframe === "day" && (
                    <div className="mt-3 pt-3 flex items-center justify-between"
                      style={{ borderTop: "1px solid rgba(74,157,135,0.14)" }}>
                      <p className="text-xs font-medium" style={{ color: C.text }}>
                        📅 {format(selectedDay, "EEEE d MMMM", { locale: fr })}
                      </p>
                      <button onClick={clearDayFilter}
                        className="text-xs font-semibold hover:underline" style={{ color: C.primary }}>
                        Effacer
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Filters */}
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.13 }}>
                <div className="p-5 space-y-4" style={glass}>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" style={{ color: C.primary }} />
                    <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>Filtres</h3>
                  </div>

                  <div>
                    <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: C.textSoft }}>Période</p>
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
                        <span className="px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, color: "#fff" }}>
                          {format(selectedDay, "d MMM", { locale: fr })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ height: "1px", background: "rgba(74,157,135,0.15)" }} />

                  <div>
                    <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: C.textSoft }}>Sévérité</p>
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

                  <div style={{ height: "1px", background: "rgba(74,157,135,0.15)" }} />

                  <div>
                    <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: C.textSoft }}>Type</p>
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
                    <div className="pt-2" style={{ borderTop: "1px solid rgba(74,157,135,0.14)" }}>
                      <p className="text-xs" style={{ color: C.textSoft }}>
                        <span className="font-semibold sg-gradient-text">{filtered.length}</span>{" "}
                        alerte{filtered.length !== 1 ? "s" : ""} affichée{filtered.length !== 1 ? "s" : ""} sur {alertes.length}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* ── RIGHT: Timeline ── */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              {loading ? (
                <div className="flex items-center justify-center py-32" style={glass}>
                  <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 gap-3" style={glass}>
                  <div className="w-14 h-14 rounded-3xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      boxShadow: "0 12px 28px rgba(74,157,135,0.30)",
                    }}>
                    <CheckCircle className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold sg-sora" style={{ color: C.text }}>Aucune alerte</p>
                    <p className="text-xs mt-1" style={{ color: C.textSoft }}>
                      {timeframe === "day" && selectedDay
                        ? `Aucune alerte le ${format(selectedDay, "d MMMM yyyy", { locale: fr })}`
                        : "Aucun résultat pour les filtres sélectionnés"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedByDay.map(([dayKey, dayAlertes], gi) => {
                    const isCollapsed = collapsedDays.has(dayKey);
                    const dayDate     = parseISO(dayKey + "T00:00:00");
                    const isToday     = dayKey === format(new Date(), "yyyy-MM-dd");
                    const isYesterday = dayKey === format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
                    const hasCritical = dayAlertes.some(a => a.severity === "CRITICAL");
                    const critCount   = dayAlertes.filter(a => a.severity === "CRITICAL").length;

                    const dayLabel = isToday ? "Aujourd'hui"
                      : isYesterday ? "Hier"
                      : format(dayDate, "EEEE d MMMM yyyy", { locale: fr });

                    return (
                      <motion.div key={dayKey}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(gi * 0.04, 0.3) }}
                        className="sg-card overflow-hidden"
                        style={glass}>

                        <button
                          onClick={() => toggleDay(dayKey)}
                          className="w-full flex items-center justify-between px-5 py-3.5 transition-colors text-left"
                          style={{ background: hasCritical ? "rgba(192,80,74,0.04)" : "transparent" }}
                        >
                          <div className="flex items-center gap-3 flex-wrap">
                            {hasCritical && (
                              <span className="w-2.5 h-2.5 rounded-full animate-pulse shrink-0"
                                style={{ background: C.muted }} />
                            )}
                            <span className="text-sm font-semibold capitalize sg-sora" style={{ color: C.text }}>
                              {dayLabel}
                            </span>
                            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                              style={{ background: "rgba(74,157,135,0.10)", color: C.primaryDark }}>
                              {dayAlertes.length} alerte{dayAlertes.length > 1 ? "s" : ""}
                            </span>
                            {hasCritical && (
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                                style={{ background: "rgba(192,80,74,0.12)", color: C.muted, border: "1px solid rgba(192,80,74,0.25)" }}>
                                {critCount} critique{critCount > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          {isCollapsed
                            ? <ChevronRight className="w-4 h-4 shrink-0" style={{ color: C.textSoft }} />
                            : <ChevronDown  className="w-4 h-4 shrink-0" style={{ color: C.textSoft }} />}
                        </button>

                        <AnimatePresence>
                          {!isCollapsed && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.18 }}
                              className="overflow-hidden"
                              style={{ borderTop: "1px solid rgba(74,157,135,0.12)" }}
                            >
                              {dayAlertes.map((a, idx) => {
                                const cfg  = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG.LOW;
                                const time = format(parseISO(a.created_at), "HH:mm");
                                const ago  = formatDistanceToNow(parseISO(a.created_at), { addSuffix: true, locale: fr });

                                return (
                                  <div key={a.id}
                                    className="flex items-start gap-4 px-5 py-4 transition-colors"
                                    style={{
                                      borderLeft: `3px solid ${cfg.accentColor}`,
                                      borderTop: idx === 0 ? "none" : "1px solid rgba(74,157,135,0.08)",
                                    }}>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                                          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                          {SEVERITY_LABEL[a.severity] || a.severity}
                                        </span>
                                        {(a.types ?? [a.type])
                                          .filter(tp => TYPE_ICONS[tp])
                                          .map(tp => (
                                            <span key={tp}
                                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                                              style={{ background: "rgba(74,157,135,0.08)", color: C.textSoft }}>
                                              {TYPE_ICONS[tp]} {TYPE_LABELS[tp]}
                                            </span>
                                          ))}
                                      </div>
                                      <p className="text-sm font-medium leading-snug sg-sora" style={{ color: C.text }}>
                                        {a.message}
                                      </p>
                                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: C.textSoft }}>
                                          <User className="w-3 h-3 shrink-0" /> {a.patient_nom}
                                        </span>
                                        <span className="text-[11px]" style={{ color: "rgba(30,60,50,0.30)" }}>·</span>
                                        <span className="text-[11px] font-medium" style={{ color: C.textSoft }}>{time}</span>
                                        <span className="text-[11px]" style={{ color: "rgba(30,60,50,0.30)" }}>·</span>
                                        <span className="text-[11px]" style={{ color: C.textSoft }}>{ago}</span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => navigate(`/doctor/patients/${a.patient_id}`)}
                                      className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:scale-105 mt-0.5"
                                      style={{
                                        background: "rgba(74,157,135,0.10)",
                                        color: C.primaryDark,
                                        border: "1px solid rgba(74,157,135,0.22)",
                                      }}
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
      </div>
    </DashboardLayout>
  );
};

export default DoctorAlerts;