import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, CheckCircle, Loader, AlertTriangle,
  ChevronDown, ChevronRight, MessageCircle, Phone,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import {
  format, formatDistanceToNow, startOfDay, startOfWeek,
  endOfWeek, isWithinInterval, parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alerte {
  id: string;
  severity: string;
  type: string;
  message: string;
  resolved: boolean;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const SEVERITY_CONFIG: Record<string, {
  label: string; emoji: string;
  badge: string; accent: string; dot: string;
}> = {
  CRITICAL: {
    label: "Urgente",    emoji: "🔴",
    badge:  "bg-red-500/10 text-red-600 border-red-500/20",
    accent: "border-l-red-500",
    dot:    "bg-red-500",
  },
  HIGH: {
    label: "Importante", emoji: "🟠",
    badge:  "bg-orange-500/10 text-orange-600 border-orange-500/20",
    accent: "border-l-orange-500",
    dot:    "bg-orange-500",
  },
  MEDIUM: {
    label: "Modérée",    emoji: "🟡",
    badge:  "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    accent: "border-l-yellow-400",
    dot:    "bg-yellow-400",
  },
  LOW: {
    label: "Faible",     emoji: "🟢",
    badge:  "bg-green-500/10 text-green-600 border-green-500/20",
    accent: "border-l-green-500",
    dot:    "bg-green-500",
  },
};

type Timeframe      = "today" | "week" | "all";
type SeverityFilter = "all" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTimeframeInterval = (tf: Timeframe): { start: Date; end: Date } => {
  const now = new Date();
  if (tf === "today") return { start: startOfDay(now), end: now };
  if (tf === "week")  return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
  return { start: new Date(0), end: now };
};

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

const PatientAlerts = () => {
  const navigate = useNavigate();

  const [alertes, setAlertes]     = useState<Alerte[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [medecinId, setMedecinId] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  const [timeframe, setTimeframe]           = useState<Timeframe>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [collapsedDays, setCollapsedDays]   = useState<Set<string>>(new Set());

  // ── Fetch ──────────────────────────────────────────────────────────────────

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

  // Realtime
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

  // ── Contact doctor ─────────────────────────────────────────────────────────

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

  // ── Derived ────────────────────────────────────────────────────────────────

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

  // Banner: critical alerts in last 24h
  const recentCriticals = useMemo(() =>
    alertes.filter(a =>
      a.severity === "CRITICAL" &&
      Date.now() - parseISO(a.created_at).getTime() < 24 * 60 * 60 * 1000
    ), [alertes]);

  const toggleDay = (key: string) =>
    setCollapsedDays(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="patient">
      <div className="space-y-5">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
                <Bell className="w-6 h-6 text-primary" /> Mes Alertes
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {alertes.length === 0
                  ? "Aucune alerte enregistrée"
                  : `${alertes.length} alerte${alertes.length > 1 ? "s" : ""} au total`}
              </p>
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
              className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-600">
                  {recentCriticals.length} alerte{recentCriticals.length > 1 ? "s" : ""} urgente{recentCriticals.length > 1 ? "s" : ""} dans les dernières 24h
                </p>
                <p className="text-xs text-red-500/80 mt-0.5">
                  Consultez votre médecin dès que possible.
                </p>
              </div>
              {medecinId && (
                <button
                  onClick={handleContactMedecin}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-xl text-xs font-medium hover:bg-red-600 transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Contacter
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filters ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Période</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={timeframe === "today"} onClick={() => setTimeframe("today")}>Aujourd'hui</Chip>
                <Chip active={timeframe === "week"}  onClick={() => setTimeframe("week")}>Cette semaine</Chip>
                <Chip active={timeframe === "all"}   onClick={() => setTimeframe("all")}>Tout voir</Chip>
              </div>
            </div>
            <div className="h-px bg-border" />
            <div>
              <p className="text-xs text-muted-foreground mb-2">Sévérité</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={severityFilter === "all"}      onClick={() => setSeverityFilter("all")}>Toutes</Chip>
                <Chip active={severityFilter === "CRITICAL"} onClick={() => setSeverityFilter("CRITICAL")}>🔴 Urgentes</Chip>
                <Chip active={severityFilter === "HIGH"}     onClick={() => setSeverityFilter("HIGH")}>🟠 Importantes</Chip>
                <Chip active={severityFilter === "MEDIUM"}   onClick={() => setSeverityFilter("MEDIUM")}>🟡 Modérées</Chip>
                <Chip active={severityFilter === "LOW"}      onClick={() => setSeverityFilter("LOW")}>🟢 Faibles</Chip>
              </div>
            </div>
            {filtered.length !== alertes.length && (
              <>
                <div className="h-px bg-border" />
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{filtered.length}</span> alerte{filtered.length !== 1 ? "s" : ""} affichée{filtered.length !== 1 ? "s" : ""} sur {alertes.length}
                </p>
              </>
            )}
          </div>
        </motion.div>

        {/* ── Timeline ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 bg-card border border-border rounded-2xl gap-3">
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-green-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Tout va bien !</p>
              <p className="text-xs text-muted-foreground mt-1">Aucune alerte pour cette période</p>
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
                  className="bg-card border border-border rounded-2xl overflow-hidden">

                  {/* Day header */}
                  <button
                    onClick={() => toggleDay(dayKey)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      {hasUrgent && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
                      <span className="text-sm font-semibold text-foreground capitalize">{dayLabel}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {dayAlertes.length} alerte{dayAlertes.length > 1 ? "s" : ""}
                      </span>
                      {hasUrgent && (
                        <span className="text-xs font-medium text-red-600 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                          {urgentCount} urgente{urgentCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {isCollapsed
                      ? <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>

                  {/* Alert rows */}
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
                          const cfg  = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG.LOW;
                          const time = format(parseISO(a.created_at), "HH:mm");
                          const ago  = formatDistanceToNow(parseISO(a.created_at), { addSuffix: true, locale: fr });

                          return (
                            <div key={a.id}
                              className={`flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors border-l-2 ${cfg.accent}`}>

                              <div className="flex-1 min-w-0">
                                {/* Badge */}
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${cfg.badge}`}>
                                    {cfg.emoji} {cfg.label}
                                  </span>
                                </div>

                                {/* Message */}
                                <p className="text-sm text-foreground font-medium leading-snug">{a.message}</p>

                                {/* Meta */}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span className="text-[11px] text-muted-foreground font-medium">{time}</span>
                                  <span className="text-muted-foreground/40 text-[11px]">·</span>
                                  <span className="text-[11px] text-muted-foreground">{ago}</span>
                                </div>
                              </div>

                              {/* CTA on urgent only */}
                              {a.severity === "CRITICAL" && medecinId && (
                                <button
                                  onClick={handleContactMedecin}
                                  className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-xl transition-all mt-0.5"
                                >
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
    </DashboardLayout>
  );
};

export default PatientAlerts;