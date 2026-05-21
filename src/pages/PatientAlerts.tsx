import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, CheckCircle, Loader, AlertTriangle,
  ChevronDown, ChevronRight, MessageCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import {
  format, formatDistanceToNow, startOfDay, startOfWeek,
  endOfWeek, isWithinInterval, parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";

interface Alerte {
  id: string;
  severity: string;
  type: string;
  message: string;
  resolved: boolean;
  created_at: string;
}

// ─── Palette (matches landing page) ─────────────────────────────────────────
const C = {
  primary:     "#4a9d87",
  primaryDark: "#3d8c7a",
  secondary:   "#5b8fa0",
  text:        "#1a2e28",
  textSoft:    "rgba(30,60,50,0.62)",
  gold:        "#d4a843",
  muted:       "#c0504a",
};

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const SEVERITY_CONFIG: Record<string, {
  label: string; emoji: string; color: string; bg: string; border: string;
}> = {
  CRITICAL: { label: "Urgente",    emoji: "🔴", color: C.muted,   bg: "rgba(192,80,74,0.10)",  border: "rgba(192,80,74,0.30)" },
  HIGH:     { label: "Importante", emoji: "🟠", color: "#d4843a", bg: "rgba(212,132,58,0.10)", border: "rgba(212,132,58,0.30)" },
  MEDIUM:   { label: "Modérée",    emoji: "🟡", color: C.gold,    bg: "rgba(212,168,67,0.12)", border: "rgba(212,168,67,0.30)" },
  LOW:      { label: "Faible",     emoji: "🟢", color: C.primary, bg: "rgba(74,157,135,0.10)", border: "rgba(74,157,135,0.28)" },
};

const glass = {
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.16)",
  borderRadius: "22px",
  boxShadow: "0 12px 36px rgba(30,60,50,0.06)",
} as React.CSSProperties;

type Timeframe      = "today" | "week" | "all";
type SeverityFilter = "all" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

const getTimeframeInterval = (tf: Timeframe): { start: Date; end: Date } => {
  const now = new Date();
  if (tf === "today") return { start: startOfDay(now), end: now };
  if (tf === "week")  return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
  return { start: new Date(0), end: now };
};

const Chip = ({ active, onClick, children, color = C.primary }: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: string;
}) => (
  <button onClick={onClick}
    className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
    style={
      active
        ? {
            background: `linear-gradient(135deg, ${color}, ${C.secondary})`,
            color: "#fff",
            border: `1px solid ${color}`,
            boxShadow: `0 6px 18px ${color}40`,
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

const PatientAlerts = () => {
  const navigate = useNavigate();

  const [alertes, setAlertes]     = useState<Alerte[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [medecinId, setMedecinId] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  const [timeframe, setTimeframe]           = useState<Timeframe>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [collapsedDays, setCollapsedDays]   = useState<Set<string>>(new Set());

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patient } = await supabase
        .from("patients")
        .select("id, medecin_id")
        .eq("user_id", user.id)
        .single();

      if (!patient) { setLoading(false); return; }

      setPatientId(patient.id);
      setMedecinId(patient.medecin_id || null);

      const { data } = await supabase
        .from("alerts")
        .select("id, severity, type, message, resolved, created_at")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(300);

      if (data) setAlertes(data);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`patient_alerts_rt_${patientId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "alerts",
        filter: `patient_id=eq.${patientId}`,
      }, (payload) => {
        setAlertes(prev => [payload.new as Alerte, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId]);

  const handleContactMedecin = async () => {
    if (!patientId || !medecinId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: existing } = await supabase
      .from("conversations").select("id")
      .eq("patient_id", patientId).eq("medecin_id", medecinId).maybeSingle();
    let convId = (existing as any)?.id;
    if (!convId) {
      const { data: ins } = await supabase
        .from("conversations").insert({ patient_id: patientId, medecin_id: medecinId })
        .select("id").single();
      convId = (ins as any)?.id;
    }
    if (convId) navigate(`/patient/messages?conversation=${convId}`);
  };

  const filtered = useMemo(() => {
    const interval = getTimeframeInterval(timeframe);
    return alertes.filter(a => {
      const date = parseISO(a.created_at);
      if (!isWithinInterval(date, interval)) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      return true;
    });
  }, [alertes, timeframe, severityFilter]);

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

  const recentCriticals = useMemo(() =>
    alertes.filter(a =>
      a.severity === "CRITICAL" &&
      Date.now() - parseISO(a.created_at).getTime() < 24 * 60 * 60 * 1000
    ), [alertes]);

  const toggleDay = (key: string) =>
    setCollapsedDays(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

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
        .sg-day-card { transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s; }
        .sg-day-card:hover { transform: translateY(-2px); box-shadow: 0 18px 44px rgba(30,60,50,0.08); }
      `}</style>

      <div className="sg-page relative">
        <div className="sg-aurora-a" style={{ background: "rgba(192,80,74,0.12)", top: -100, right: -80, animation: "sgAurora 22s ease-in-out infinite" }} />
        <div className="sg-aurora-a" style={{ background: "rgba(74,157,135,0.14)", top: 280, left: -120, animation: "sgAurora 18s ease-in-out infinite reverse" }} />

        <div className="relative space-y-5">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl" style={glass}>
            <div className="flex items-start justify-between flex-wrap gap-3">
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
                    Mes <span className="sg-gradient-text">Alertes</span>
                  </h1>
                  <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                    {alertes.length === 0
                      ? "Aucune alerte enregistrée"
                      : `${alertes.length} alerte${alertes.length > 1 ? "s" : ""} au total`}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Critical banner ── */}
          <AnimatePresence>
            {recentCriticals.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-2xl p-5 flex items-start gap-4 relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, rgba(192,80,74,0.10) 0%, rgba(212,132,58,0.06) 100%)",
                  border: "1px solid rgba(192,80,74,0.30)",
                  boxShadow: "0 12px 32px rgba(192,80,74,0.15)",
                }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(192,80,74,0.18)" }}>
                  <AlertTriangle className="w-5 h-5" style={{ color: C.muted }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold sg-sora" style={{ color: C.muted }}>
                    {recentCriticals.length} alerte{recentCriticals.length > 1 ? "s" : ""} urgente{recentCriticals.length > 1 ? "s" : ""} dans les dernières 24h
                  </p>
                  <p className="text-sm mt-1" style={{ color: "rgba(192,80,74,0.85)" }}>
                    Consultez votre médecin dès que possible.
                  </p>
                </div>
                {medecinId && (
                  <button
                    onClick={handleContactMedecin}
                    className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold transition-all hover:scale-105"
                    style={{
                      background: `linear-gradient(135deg, ${C.muted}, #d4843a)`,
                      color: "#fff",
                      boxShadow: "0 6px 22px rgba(192,80,74,0.35)",
                    }}>
                    <MessageCircle className="w-3.5 h-3.5" /> Contacter
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Filters ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="p-5 space-y-4" style={glass}>
              <div>
                <p className="text-xs font-semibold mb-2.5 uppercase tracking-wider" style={{ color: C.textSoft }}>Période</p>
                <div className="flex flex-wrap gap-2">
                  <Chip active={timeframe === "today"} onClick={() => setTimeframe("today")}>Aujourd'hui</Chip>
                  <Chip active={timeframe === "week"}  onClick={() => setTimeframe("week")}>Cette semaine</Chip>
                  <Chip active={timeframe === "all"}   onClick={() => setTimeframe("all")}>Tout voir</Chip>
                </div>
              </div>
              <div className="h-px" style={{ background: "rgba(74,157,135,0.15)" }} />
              <div>
                <p className="text-xs font-semibold mb-2.5 uppercase tracking-wider" style={{ color: C.textSoft }}>Sévérité</p>
                <div className="flex flex-wrap gap-2">
                  <Chip active={severityFilter === "all"}      onClick={() => setSeverityFilter("all")}>Toutes</Chip>
                  <Chip active={severityFilter === "CRITICAL"} onClick={() => setSeverityFilter("CRITICAL")} color={C.muted}>🔴 Urgentes</Chip>
                  <Chip active={severityFilter === "HIGH"}     onClick={() => setSeverityFilter("HIGH")} color="#d4843a">🟠 Importantes</Chip>
                  <Chip active={severityFilter === "MEDIUM"}   onClick={() => setSeverityFilter("MEDIUM")} color={C.gold}>🟡 Modérées</Chip>
                  <Chip active={severityFilter === "LOW"}      onClick={() => setSeverityFilter("LOW")} color={C.primary}>🟢 Faibles</Chip>
                </div>
              </div>
              {filtered.length !== alertes.length && (
                <>
                  <div className="h-px" style={{ background: "rgba(74,157,135,0.15)" }} />
                  <p className="text-xs" style={{ color: C.textSoft }}>
                    <span className="font-semibold sg-gradient-text">{filtered.length}</span> alerte{filtered.length !== 1 ? "s" : ""} affichée{filtered.length !== 1 ? "s" : ""} sur {alertes.length}
                  </p>
                </>
              )}
            </div>
          </motion.div>

          {/* ── Timeline ── */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
            </div>
          ) : filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-3" style={glass}>
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 12px 28px rgba(74,157,135,0.30)",
                }}>
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold sg-sora" style={{ color: C.text }}>Tout va bien !</p>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>Aucune alerte pour cette période</p>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {groupedByDay.map(([dayKey, dayAlertes], gi) => {
                const isCollapsed  = collapsedDays.has(dayKey);
                const dayDate      = parseISO(dayKey + "T00:00:00");
                const isToday      = dayKey === format(new Date(), "yyyy-MM-dd");
                const isYesterday  = dayKey === format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
                const hasUrgent    = dayAlertes.some(a => a.severity === "CRITICAL");
                const urgentCount  = dayAlertes.filter(a => a.severity === "CRITICAL").length;

                const dayLabel = isToday ? "Aujourd'hui"
                  : isYesterday ? "Hier"
                  : format(dayDate, "EEEE d MMMM yyyy", { locale: fr });

                return (
                  <motion.div key={dayKey}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(gi * 0.04, 0.3) }}
                    className="sg-day-card overflow-hidden"
                    style={glass}>

                    <button
                      onClick={() => toggleDay(dayKey)}
                      className="w-full flex items-center justify-between px-5 py-4 transition-colors text-left"
                      style={{ background: hasUrgent ? "rgba(192,80,74,0.04)" : "transparent" }}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        {hasUrgent && <span className="w-2.5 h-2.5 rounded-full animate-pulse shrink-0" style={{ background: C.muted }} />}
                        <span className="text-sm font-semibold capitalize sg-sora" style={{ color: C.text }}>{dayLabel}</span>
                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                          style={{ background: "rgba(74,157,135,0.10)", color: C.primaryDark }}>
                          {dayAlertes.length} alerte{dayAlertes.length > 1 ? "s" : ""}
                        </span>
                        {hasUrgent && (
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                            style={{ background: "rgba(192,80,74,0.12)", color: C.muted, border: "1px solid rgba(192,80,74,0.25)" }}>
                            {urgentCount} urgente{urgentCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      {isCollapsed
                        ? <ChevronRight className="w-4 h-4 shrink-0" style={{ color: C.textSoft }} />
                        : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: C.textSoft }} />}
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
                                  borderLeft: `3px solid ${cfg.color}`,
                                  borderTop: idx === 0 ? "none" : "1px solid rgba(74,157,135,0.08)",
                                }}>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-2">
                                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                                      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                      {cfg.emoji} {cfg.label}
                                    </span>
                                  </div>

                                  <p className="text-sm font-medium leading-snug sg-sora" style={{ color: C.text }}>{a.message}</p>

                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <span className="text-[11px] font-medium" style={{ color: C.textSoft }}>{time}</span>
                                    <span className="text-[11px]" style={{ color: "rgba(30,60,50,0.30)" }}>·</span>
                                    <span className="text-[11px]" style={{ color: C.textSoft }}>{ago}</span>
                                  </div>
                                </div>

                                {a.severity === "CRITICAL" && medecinId && (
                                  <button
                                    onClick={handleContactMedecin}
                                    className="shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full transition-all hover:scale-105"
                                    style={{
                                      background: cfg.bg,
                                      color: cfg.color,
                                      border: `1px solid ${cfg.border}`,
                                    }}>
                                    <MessageCircle className="w-3 h-3" /> Contacter
                                  </button>
                                )}
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
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientAlerts;
