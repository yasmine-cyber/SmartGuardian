import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Bell, AlertCircle, Info, Loader, CheckCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Alerte {
  id: string;
  patient_id: string;
  severity: string;
  type: string;
  message: string;
  resolved: boolean;
  created_at: string;
  patient_nom: string;
}

type FilterType = "toutes" | "critiques" | "non_resolues" | "resolues";

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

const BORDER_BY_SEVERITY: Record<string, string> = {
  CRITIQUE: "border-l-critical",
  MOYEN: "border-l-warning",
  FAIBLE: "border-l-primary",
};
const ICON_BY_SEVERITY: Record<string, "critical" | "warning" | "info"> = {
  CRITIQUE: "critical",
  MOYEN: "warning",
  FAIBLE: "info",
};

const FamilyAlerts = () => {
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [patientIds, setPatientIds] = useState<string[]>([]);
  const [nameByPatientId, setNameByPatientId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("toutes");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 1. Get linked patients (patient_id = patients.id)
  // 2. Get patient rows for ids + user_id
  // 3. Get utilisateurs for names
  // 4. Get alerts for those patient_ids
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: links } = await supabase
        .from("proche_patient")
        .select("patient_id")
        .eq("proche_id", user.id);

      if (!links?.length) {
        setLoading(false);
        return;
      }

      const pids = links.map((l) => l.patient_id);
      setPatientIds(pids);

      const { data: patientRows } = await supabase
        .from("patients")
        .select("id, user_id")
        .in("id", pids);

      if (!patientRows?.length) {
        setLoading(false);
        return;
      }

      const userIds = patientRows.map((p) => p.user_id);
      const { data: utilisateurs } = await supabase
        .from("utilisateurs")
        .select("id, nom, prenom")
        .in("id", userIds);

      const nameMap: Record<string, string> = {};
      patientRows.forEach((p) => {
        const u = (utilisateurs || []).find((x) => x.id === p.user_id);
        nameMap[p.id] = u ? [u.prenom, u.nom].filter(Boolean).join(" ").trim() || "Proche" : "Proche";
      });
      setNameByPatientId(nameMap);

      const { data: alertData } = await supabase
        .from("alerts")
        .select("id, message, severity, type, created_at, resolved, patient_id")
        .in("patient_id", patientRows.map((p) => p.id))
        .order("created_at", { ascending: false });

      if (alertData) {
        setAlertes(
          alertData.map((a) => ({
            ...a,
            patient_nom: nameMap[a.patient_id] || "Proche",
          }))
        );
      }
      setLoading(false);
    };

    load();
  }, []);

  // Realtime: new alerts for linked patients → prepend + toast
  useEffect(() => {
    if (patientIds.length === 0) return;

    const channel = supabase
      .channel("family-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload) => {
          const row = payload.new as { id: string; patient_id: string; message?: string; severity?: string; type?: string; resolved?: boolean; created_at?: string };
          if (!patientIds.includes(row.patient_id)) return;
          const patientNom = nameByPatientId[row.patient_id] || "Un proche";
          const newAlerte: Alerte = {
            id: row.id,
            patient_id: row.patient_id,
            message: row.message ?? "",
            severity: row.severity ?? "FAIBLE",
            type: row.type ?? "",
            resolved: row.resolved ?? false,
            created_at: row.created_at ?? new Date().toISOString(),
            patient_nom: patientNom,
          };
          setAlertes((prev) => [newAlerte, ...prev]);
          toast.info(`Nouvelle alerte pour ${patientNom}`);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [patientIds, nameByPatientId]);

  const filtered = alertes.filter((a) => {
    if (filter === "toutes") return true;
    if (filter === "critiques") return (a.severity || "").toUpperCase() === "CRITIQUE";
    if (filter === "non_resolues") return !a.resolved;
    if (filter === "resolues") return a.resolved;
    return true;
  });

  const filters: { id: FilterType; label: string }[] = [
    { id: "toutes", label: "Toutes" },
    { id: "critiques", label: "Critiques" },
    { id: "non_resolues", label: "Non résolues" },
    { id: "resolues", label: "Résolues" },
  ];

  return (
    <DashboardLayout role="family">
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> Alertes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Historique des alertes de vos proches
          </p>
        </motion.div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Loading: 3 skeleton cards */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl border border-border bg-card animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty: no alerts at all */}
        {!loading && alertes.length === 0 && (
          <div className="text-center py-20 bg-card border border-border rounded-2xl">
            <Bell className="w-12 h-12 text-primary/40 mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground">Aucune alerte pour vos proches ✓</p>
          </div>
        )}

        {/* Empty: filter returns nothing */}
        {!loading && alertes.length > 0 && filtered.length === 0 && (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <p className="text-sm text-muted-foreground">Aucune alerte dans cette catégorie</p>
          </div>
        )}

        {/* Alert feed */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((a, i) => {
              const sev = (a.severity || "").toUpperCase();
              const borderClass = BORDER_BY_SEVERITY[a.severity] ?? BORDER_BY_SEVERITY[sev] ?? "border-l-primary";
              const iconKind = ICON_BY_SEVERITY[a.severity] ?? ICON_BY_SEVERITY[sev] ?? "info";
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`bg-card border border-border rounded-2xl overflow-hidden border-l-4 ${borderClass} shadow-sm`}
                >
                  <div className="p-4 flex items-start gap-4">
                    <div className="flex-shrink-0 mt-0.5">
                      {iconKind === "critical" || iconKind === "warning" ? (
                        <AlertCircle
                          className={`w-5 h-5 ${
                            iconKind === "critical" ? "text-critical" : "text-warning"
                          }`}
                        />
                      ) : (
                        <Info className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-primary mb-0.5">{a.patient_nom}</p>
                      <p className="text-sm text-foreground">{a.message}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {a.type || "Alerte"}
                        </span>
                        <span className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                      </div>
                      <div className="mt-2">
                        {a.resolved ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-safe">
                            <CheckCircle className="w-3.5 h-3.5" /> Résolue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                            En cours
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default FamilyAlerts;
