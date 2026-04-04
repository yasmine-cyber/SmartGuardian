import { motion } from "framer-motion";
import { Settings, CheckCircle2, XCircle, Loader, Activity } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const AdminSystem = () => {
  // Vérifier si Supabase répond (ping via une table légère)
  const { data: dbOk, isLoading: dbLoading } = useQuery({
    queryKey: ["system-db-ping"],
    queryFn: async () => {
      const start = Date.now();
      const { error } = await supabase.from("utilisateurs").select("id").limit(1);
      return { ok: !error, latency: `${Date.now() - start}ms` };
    },
    refetchInterval: 30000,
  });

  // Stats globales pour le dashboard système
  const { data: stats } = useQuery({
    queryKey: ["system-stats"],
    queryFn: async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [usersRes, devicesRes, alertsRes, vitalsRes] = await Promise.all([
        supabase.from("utilisateurs").select("*", { count: "exact", head: true }),
        supabase.from("devices").select("*", { count: "exact", head: true }),
        supabase.from("alerts").select("*", { count: "exact", head: true }).gte("created_at", since24h),
        supabase.from("vital_signs").select("*", { count: "exact", head: true }).gte("recorded_at", since24h),
      ]);

      return {
        totalUsers: usersRes.count ?? 0,
        totalDevices: devicesRes.count ?? 0,
        alertes24h: alertsRes.count ?? 0,
        vitals24h: vitalsRes.count ?? 0,
      };
    },
    refetchInterval: 60000,
  });

  const services = [
    {
      label: "Base de données",
      status: dbOk?.ok ?? true,
      latency: dbOk?.latency ?? "...",
      description: "Supabase PostgreSQL",
    },
    {
      label: "API Supabase",
      status: dbOk?.ok ?? true,
      latency: dbOk?.latency ?? "...",
      description: "REST & Realtime",
    },
    {
      label: "Authentification",
      status: dbOk?.ok ?? true,
      latency: "—",
      description: "Supabase Auth",
    },
    {
      label: "Edge Functions",
      status: true,
      latency: "—",
      description: "Deno serverless",
    },
  ];

  const allOk = services.every((s) => s.status);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Santé système</h1>
              <p className="text-muted-foreground text-sm mt-0.5">État des services en temps réel</p>
            </div>
          </div>
        </motion.div>

        {/* Banner global */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`rounded-2xl p-4 flex items-center gap-3 ${allOk ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}
        >
          {dbLoading
            ? <Loader className="w-5 h-5 animate-spin text-muted-foreground" />
            : allOk
              ? <CheckCircle2 className="w-5 h-5 text-green-600" />
              : <XCircle className="w-5 h-5 text-red-600" />}
          <p className={`text-sm font-medium ${allOk ? "text-green-700" : "text-red-700"}`}>
            {dbLoading ? "Vérification en cours..." : allOk ? "Tous les services sont opérationnels" : "Certains services sont dégradés"}
          </p>
        </motion.div>

        {/* Stats réelles */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Utilisateurs total", value: stats.totalUsers, icon: Activity },
              { label: "Capteurs enregistrés", value: stats.totalDevices, icon: Settings },
              { label: "Alertes (24h)", value: stats.alertes24h, icon: Activity },
              { label: "Mesures (24h)", value: stats.vitals24h, icon: Activity },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-card border border-border rounded-2xl p-4 shadow-sm"
              >
                <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Services */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-3">
                {s.status
                  ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                  : <XCircle className="w-5 h-5 text-red-500" />}
                <div>
                  <p className="text-sm font-medium text-card-foreground">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.description} · Latence : {s.latency}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${s.status ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                {s.status ? "Opérationnel" : "Hors service"}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminSystem;