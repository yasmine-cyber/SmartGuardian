import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Loader, AlertTriangle, CheckCircle2,
  ShieldAlert, Flame, AlertCircle, Info, Filter, X,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type AlertLog = {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  type: string;
  message: string;
  resolved: boolean;
  created_at: string;
  patient_nom: string;
};

type SeverityFilter = "all" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type StatusFilter   = "all" | "resolved" | "pending";

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

const SEVERITY_CONFIG: Record<string, {
  label: string; color: string; bg: string; border: string; icon: React.ElementType;
}> = {
  CRITICAL: { label: "Critical", color: C.muted,     bg: "rgba(192,80,74,0.10)",  border: "rgba(192,80,74,0.28)",  icon: ShieldAlert },
  HIGH:     { label: "High",     color: "#d4843a",   bg: "rgba(212,132,58,0.10)", border: "rgba(212,132,58,0.28)", icon: Flame },
  MEDIUM:   { label: "Medium",   color: C.gold,      bg: "rgba(212,168,67,0.12)", border: "rgba(212,168,67,0.28)", icon: AlertCircle },
  LOW:      { label: "Low",      color: C.secondary, bg: "rgba(91,143,160,0.12)", border: "rgba(91,143,160,0.25)", icon: Info },
};

const AdminLogs = () => {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>("all");

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      const { data: alertsRaw, error: alertErr } = await supabase
        .from("alerts")
        .select("id, severity, type, message, resolved, created_at, patient_id")
        .order("created_at", { ascending: false })
        .limit(50);

      if (alertErr) throw alertErr;
      if (!alertsRaw?.length) return [] as AlertLog[];

      const patientIds = [...new Set(alertsRaw.map((a: { patient_id: string }) => a.patient_id))];

      const { data: patientsRows } = await supabase
        .from("patients").select("id, user_id").in("id", patientIds);

      const userIds = (patientsRows || []).map((p: { user_id: string }) => p.user_id);

      const { data: utilisateurs } = await supabase
        .from("utilisateurs").select("id, nom, prenom").in("id", userIds);

      const patientMap: Record<string, string> = {};
      (patientsRows || []).forEach((p: { id: string; user_id: string }) => {
        const u = (utilisateurs || []).find((u: { id: string }) => u.id === p.user_id);
        if (u) patientMap[p.id] = [u.prenom, u.nom].filter(Boolean).join(" ");
      });

      return alertsRaw.map((a: {
        id: string; severity: string; type: string; message: string;
        resolved: boolean; created_at: string; patient_id: string;
      }) => ({
        id: a.id,
        severity: a.severity,
        type: a.type,
        message: a.message,
        resolved: a.resolved,
        created_at: a.created_at,
        patient_nom: patientMap[a.patient_id] ?? "Patient inconnu",
      })) as AlertLog[];
    },
    refetchInterval: 60000,
  });

  const allLogs = logs || [];

  const severityCounts = allLogs.reduce((acc, l) => {
    acc[l.severity] = (acc[l.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const resolvedCount = allLogs.filter(l => l.resolved).length;
  const pendingCount  = allLogs.filter(l => !l.resolved).length;

  const filteredLogs = allLogs.filter((l) => {
    const matchSeverity = severityFilter === "all" || l.severity === severityFilter;
    const matchStatus   = statusFilter === "all" ||
      (statusFilter === "resolved" && l.resolved) ||
      (statusFilter === "pending"  && !l.resolved);
    return matchSeverity && matchStatus;
  });

  const hasActiveFilter = severityFilter !== "all" || statusFilter !== "all";

  return (
    <DashboardLayout role="admin">
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
        .sg-tr { transition: background .15s; }
        .sg-tr:hover { background: rgba(74,157,135,0.04) !important; }
      `}</style>

      <div className="sg-page relative">
        {/* Aurora blobs */}
        <div className="sg-aurora-a" style={{ background: "rgba(192,80,74,0.10)", top: -100, right: -80, animation: "sgAurora 22s ease-in-out infinite" }} />
        <div className="sg-aurora-a" style={{ background: "rgba(74,157,135,0.12)", top: 340, left: -120, animation: "sgAurora 18s ease-in-out infinite reverse" }} />

        <div className="relative space-y-5 max-w-7xl">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl" style={glass}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                }}>
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight sg-sora" style={{ color: C.text }}>
                  Journaux <span className="sg-gradient-text">d'alertes</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                  {allLogs.length} alertes · 50 dernières
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Severity filter cards ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => {
              const cfg    = SEVERITY_CONFIG[sev];
              const Icon   = cfg.icon;
              const count  = severityCounts[sev] ?? 0;
              const active = severityFilter === sev;
              return (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(active ? "all" : sev)}
                  className="sg-card flex items-center gap-3 p-4 text-left"
                  style={{
                    ...glass,
                    borderLeft: `3px solid ${active ? cfg.color : "transparent"}`,
                    background: active ? cfg.bg : "rgba(255,255,255,0.78)",
                  }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                  </div>
                  <div>
                    <p className="text-lg font-bold leading-none sg-sora"
                      style={{ color: active ? cfg.color : C.text }}>
                      {count}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>{cfg.label}</p>
                  </div>
                </button>
              );
            })}
          </motion.div>

          {/* ── Status toggle + filter info ── */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="flex items-center justify-between flex-wrap gap-3">

            {/* Status pill strip */}
            <div className="flex items-center gap-1 p-1 rounded-xl"
              style={{ background: "rgba(74,157,135,0.07)", border: "1px solid rgba(74,157,135,0.14)" }}>
              {([
                { key: "all"      as StatusFilter, label: `Tous (${allLogs.length})` },
                { key: "pending"  as StatusFilter, label: `En cours (${pendingCount})` },
                { key: "resolved" as StatusFilter, label: `Résolus (${resolvedCount})` },
              ]).map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => setStatusFilter(btn.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
                  style={
                    statusFilter === btn.key
                      ? { background: "rgba(255,255,255,0.90)", color: C.text, boxShadow: "0 2px 8px rgba(30,60,50,0.08)" }
                      : { color: C.textSoft }
                  }
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Active filter clear */}
            {hasActiveFilter && (
              <div className="flex items-center gap-2 text-xs" style={{ color: C.textSoft }}>
                <Filter className="w-3.5 h-3.5" />
                <span>
                  <span className="font-semibold" style={{ color: C.text }}>{filteredLogs.length}</span>{" "}
                  résultat{filteredLogs.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => { setSeverityFilter("all"); setStatusFilter("all"); }}
                  className="flex items-center gap-1 font-semibold hover:underline transition-all"
                  style={{ color: C.primary }}
                >
                  <X className="w-3 h-3" /> Effacer les filtres
                </button>
              </div>
            )}
          </motion.div>

          {/* ── Loading ── */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-24">
              <Loader className="w-5 h-5 animate-spin" style={{ color: C.primary }} />
              <span className="text-sm" style={{ color: C.textSoft }}>Chargement des journaux...</span>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="rounded-2xl p-4 text-sm"
              style={{ background: "rgba(192,80,74,0.08)", border: "1px solid rgba(192,80,74,0.22)", color: C.muted }}>
              Impossible de charger les journaux.
            </div>
          )}

          {/* ── Empty state ── */}
          {!isLoading && allLogs.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-3" style={glass}>
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 12px 28px rgba(74,157,135,0.30)",
                }}>
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold sg-sora" style={{ color: C.text }}>Aucune alerte enregistrée</p>
              </div>
            </motion.div>
          )}

          {/* ── Table ── */}
          {filteredLogs.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
              className="overflow-hidden" style={glass}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(74,157,135,0.12)", background: "rgba(74,157,135,0.03)" }}>
                      {["Patient", "Type", "Message", "Sévérité", "Statut", "Date"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                          style={{ color: C.textSoft }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredLogs.map((l, i) => {
                        const cfg  = SEVERITY_CONFIG[l.severity];
                        const Icon = cfg?.icon ?? AlertTriangle;
                        const isCriticalPending = !l.resolved && l.severity === "CRITICAL";
                        return (
                          <motion.tr
                            key={l.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: Math.min(i * 0.02, 0.3) }}
                            className="sg-tr"
                            style={{
                              borderBottom: "1px solid rgba(74,157,135,0.07)",
                              background: isCriticalPending ? "rgba(192,80,74,0.03)" : "transparent",
                            }}
                          >
                            <td className="px-5 py-3.5 text-sm font-semibold whitespace-nowrap" style={{ color: C.text }}>
                              {l.patient_nom}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-xs font-mono px-2 py-1 rounded-lg whitespace-nowrap"
                                style={{ background: "rgba(74,157,135,0.08)", color: C.textSoft, border: "1px solid rgba(74,157,135,0.14)" }}>
                                {l.type}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-sm max-w-[220px] truncate" style={{ color: C.textSoft }} title={l.message}>
                              {l.message}
                            </td>
                            <td className="px-5 py-3.5">
                              {cfg ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                                  style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                  <Icon className="w-3 h-3" />
                                  {cfg.label}
                                </span>
                              ) : (
                                <span className="text-xs" style={{ color: C.textSoft }}>{l.severity}</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              {l.resolved ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                                  style={{ background: "rgba(74,157,135,0.10)", color: C.primary, border: "1px solid rgba(74,157,135,0.25)" }}>
                                  <CheckCircle2 className="w-3 h-3" /> Résolu
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                                  style={{ background: "rgba(212,168,67,0.12)", color: C.gold, border: "1px solid rgba(212,168,67,0.28)" }}>
                                  <AlertTriangle className="w-3 h-3" /> En cours
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-xs whitespace-nowrap" style={{ color: C.textSoft }}>
                              {new Date(l.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* No results for current filter */}
              {filteredLogs.length === 0 && allLogs.length > 0 && (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm" style={{ color: C.textSoft }}>Aucune alerte pour ces filtres.</p>
                  <button
                    onClick={() => { setSeverityFilter("all"); setStatusFilter("all"); }}
                    className="text-xs font-semibold hover:underline mt-1"
                    style={{ color: C.primary }}
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminLogs;