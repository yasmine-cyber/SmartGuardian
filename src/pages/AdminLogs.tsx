import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Loader, AlertTriangle, CheckCircle2,
  ShieldAlert, Flame, AlertCircle, Info, Filter, X
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
type StatusFilter = "all" | "resolved" | "pending";

const severityConfig: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ElementType;
}> = {
  CRITICAL: { label: "Critical", color: "text-red-600",    bg: "bg-red-500/10",    border: "border-red-500/20",    icon: ShieldAlert },
  HIGH:   { label: "High",   color: "text-orange-600", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: Flame },
  MEDIUM:   { label: "Medium",   color: "text-amber-600",  bg: "bg-amber-500/10",  border: "border-amber-500/20",  icon: AlertCircle },
  LOW:     { label: "Low",     color: "text-blue-600",   bg: "bg-blue-500/10",   border: "border-blue-500/20",   icon: Info },
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
        .from("patients")
        .select("id, user_id")
        .in("id", patientIds);

      const userIds = (patientsRows || []).map((p: { user_id: string }) => p.user_id);

      const { data: utilisateurs } = await supabase
        .from("utilisateurs")
        .select("id, nom, prenom")
        .in("id", userIds);

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

  // Count per severity
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
      <div className="space-y-6 max-w-7xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Journaux d'alertes</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {allLogs.length} alertes · 50 dernières
              </p>
            </div>
          </div>
        </motion.div>

        {/* Severity filter cards */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => {
            const cfg = severityConfig[sev];
            const Icon = cfg.icon;
            const count = severityCounts[sev] ?? 0;
            const isActive = severityFilter === sev;
            return (
              <button
                key={sev}
                onClick={() => setSeverityFilter(isActive ? "all" : sev)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  isActive
                    ? `${cfg.bg} ${cfg.border} ring-1 ring-inset ring-current/10`
                    : "bg-card border-border hover:bg-muted/40"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div>
                  <p className={`text-lg font-bold leading-none ${isActive ? cfg.color : "text-foreground"}`}>{count}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cfg.label}</p>
                </div>
              </button>
            );
          })}
        </motion.div>

        {/* Status toggle + active filter info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-between flex-wrap gap-3"
        >
          {/* Status toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
            {([
              { key: "all"      as StatusFilter, label: `Tous (${allLogs.length})` },
              { key: "pending"  as StatusFilter, label: `En cours (${pendingCount})` },
              { key: "resolved" as StatusFilter, label: `Résolus (${resolvedCount})` },
            ]).map((btn) => (
              <button
                key={btn.key}
                onClick={() => setStatusFilter(btn.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === btn.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Active filter + clear */}
          {hasActiveFilter && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter className="w-3.5 h-3.5" />
              <span>
                <span className="text-foreground font-medium">{filteredLogs.length}</span> résultat{filteredLogs.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={() => { setSeverityFilter("all"); setStatusFilter("all"); }}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <X className="w-3 h-3" /> Effacer les filtres
              </button>
            </div>
          )}
        </motion.div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader className="w-5 h-5 animate-spin" />
            <span className="text-sm">Chargement des journaux...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 text-sm text-destructive">
            Impossible de charger les journaux.
          </div>
        )}

        {/* Empty state */}
        {!isLoading && allLogs.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucune alerte enregistrée.</p>
          </div>
        )}

        {/* Table */}
        {filteredLogs.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {["Patient", "Type", "Message", "Sévérité", "Statut", "Date"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredLogs.map((l, i) => {
                      const cfg = severityConfig[l.severity];
                      const Icon = cfg?.icon ?? AlertTriangle;
                      return (
                        <motion.tr
                          key={l.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${
                            !l.resolved && l.severity === "CRITICAL" ? "bg-red-500/3" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-sm font-semibold text-card-foreground whitespace-nowrap">{l.patient_nom}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded-lg whitespace-nowrap">{l.type}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground max-w-[220px] truncate" title={l.message}>{l.message}</td>
                          <td className="px-4 py-3">
                            {cfg ? (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                                <Icon className="w-3 h-3" />
                                {cfg.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">{l.severity}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {l.resolved ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Résolu
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                                <AlertTriangle className="w-3 h-3" /> En cours
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(l.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* No results for filter */}
            {filteredLogs.length === 0 && allLogs.length > 0 && (
              <div className="px-4 py-12 text-center">
                <p className="text-sm text-muted-foreground">Aucune alerte pour ces filtres.</p>
                <button
                  onClick={() => { setSeverityFilter("all"); setStatusFilter("all"); }}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminLogs;