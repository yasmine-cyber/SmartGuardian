import { motion } from "framer-motion";
import { FileText, Loader, AlertTriangle, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type AlertLog = {
  id: string;
  severity: string;
  type: string;
  message: string;
  resolved: boolean;
  created_at: string;
  patient_nom: string;
};

const severityColor: Record<string, string> = {
  CRITIQUE: "text-red-600 bg-red-500/10",
  URGENT: "text-orange-600 bg-orange-500/10",
  MODERE: "text-amber-600 bg-amber-500/10",
  INFO: "text-blue-600 bg-blue-500/10",
};

const AdminLogs = () => {
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

      return alertsRaw.map((a: { id: string; severity: string; type: string; message: string; resolved: boolean; created_at: string; patient_id: string }) => ({
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

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Journaux d'alertes</h1>
              <p className="text-muted-foreground text-sm mt-0.5">50 dernières alertes système</p>
            </div>
          </div>
        </motion.div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader className="w-5 h-5 animate-spin" />
            <span className="text-sm">Chargement des journaux...</span>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 text-sm text-destructive">
            Impossible de charger les journaux.
          </div>
        )}

        {!isLoading && logs?.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-sm text-muted-foreground">
            Aucune alerte enregistrée.
          </div>
        )}

        {(logs?.length ?? 0) > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Patient", "Type", "Message", "Sévérité", "Statut", "Date"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(logs || []).map((l, i) => (
                  <motion.tr
                    key={l.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-card-foreground whitespace-nowrap">{l.patient_nom}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{l.type}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[260px] truncate">{l.message}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${severityColor[l.severity] ?? "bg-muted text-muted-foreground"}`}>
                        <AlertTriangle className="w-3 h-3" />
                        {l.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {l.resolved ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="w-3 h-3" /> Résolu
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="w-3 h-3" /> En cours
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminLogs;