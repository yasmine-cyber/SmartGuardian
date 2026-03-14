import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCircle, Loader, Filter } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import StatusBadge from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase";

interface Alerte {
  id: string;
  severity: string;
  type: string;
  message: string;
  resolved: boolean;
  created_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITIQUE: "bg-red-500/10 text-red-500 border-red-500/20",
  MOYEN: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  FAIBLE: "bg-green-500/10 text-green-500 border-green-500/20",
};

const PatientAlerts = () => {
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"toutes" | "actives" | "resolues">("toutes");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!patient) { setLoading(false); return; }

      setPatientId(patient.id);

      const { data } = await supabase
        .from("alerts")
        .select("id, severity, type, message, resolved, created_at")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false });

      if (data) setAlertes(data);
      setLoading(false);
    };

    init();
  }, []);

  // Realtime
  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel("patient_alerts_realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "alerts",
        filter: `patient_id=eq.${patientId}`,
      }, (payload) => {
        setAlertes(prev => [payload.new as Alerte, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`;
    return date.toLocaleDateString("fr-FR");
  };

  const filtered = alertes.filter(a => {
    if (filter === "actives") return !a.resolved;
    if (filter === "resolues") return a.resolved;
    return true;
  });

  const actives = alertes.filter(a => !a.resolved).length;

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 max-w-4xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" /> Mes Alertes
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {actives > 0
                ? `${actives} alerte(s) active(s)`
                : "Aucune alerte active"}
            </p>
          </div>
        </motion.div>

        {/* Filtres */}
        <div className="flex gap-2">
          {(["toutes", "actives", "resolues"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}>
              {f === "toutes" ? "Toutes" : f === "actives" ? "Actives" : "Résolues"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-2xl">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Aucune alerte</p>
            <p className="text-xs text-muted-foreground mt-1">Tout va bien !</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a, i) => (
              <motion.div key={a.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-card border border-border rounded-2xl p-4 flex items-start gap-4 ${
                  a.resolved ? "opacity-60" : ""
                }`}>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${
                  SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.FAIBLE
                }`}>
                  {a.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{a.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTime(a.created_at)} • {a.type}
                  </p>
                </div>
                {a.resolved && (
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientAlerts;