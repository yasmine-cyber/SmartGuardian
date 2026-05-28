import { motion } from "framer-motion";
import { Settings, CheckCircle2, XCircle, Loader, Activity } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

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

const AdminSystem = () => {
  const { data: dbOk, isLoading: dbLoading } = useQuery({
    queryKey: ["system-db-ping"],
    queryFn: async () => {
      const start = Date.now();
      const { error } = await supabase.from("utilisateurs").select("id").limit(1);
      return { ok: !error, latency: `${Date.now() - start}ms` };
    },
    refetchInterval: 30000,
  });

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
        totalUsers:    usersRes.count ?? 0,
        totalDevices:  devicesRes.count ?? 0,
        alertes24h:    alertsRes.count ?? 0,
        vitals24h:     vitalsRes.count ?? 0,
      };
    },
    refetchInterval: 60000,
  });

  const services = [
    { label: "Base de données",   status: dbOk?.ok ?? true, latency: dbOk?.latency ?? "...", description: "Supabase PostgreSQL" },
    { label: "API Supabase",      status: dbOk?.ok ?? true, latency: dbOk?.latency ?? "...", description: "REST & Realtime" },
    { label: "Authentification",  status: dbOk?.ok ?? true, latency: "—",                   description: "Supabase Auth" },
    { label: "Edge Functions",    status: true,             latency: "—",                   description: "Deno serverless" },
  ];

  const allOk = services.every((s) => s.status);

  const STAT_CARDS = [
    { label: "Utilisateurs total",   value: stats?.totalUsers,   color: C.primary,   bg: "rgba(74,157,135,0.10)",  border: "rgba(74,157,135,0.22)" },
    { label: "Capteurs enregistrés", value: stats?.totalDevices, color: C.secondary, bg: "rgba(91,143,160,0.12)",  border: "rgba(91,143,160,0.25)" },
    { label: "Alertes (24h)",        value: stats?.alertes24h,   color: C.muted,     bg: "rgba(192,80,74,0.10)",   border: "rgba(192,80,74,0.22)" },
    { label: "Mesures (24h)",        value: stats?.vitals24h,    color: C.gold,      bg: "rgba(212,168,67,0.12)",  border: "rgba(212,168,67,0.25)" },
  ];

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
      `}</style>

      <div className="sg-page relative">
        {/* Aurora blobs */}
        <div className="sg-aurora-a" style={{ background: "rgba(74,157,135,0.13)", top: -100, right: -80, animation: "sgAurora 22s ease-in-out infinite" }} />
        <div className="sg-aurora-a" style={{ background: "rgba(91,143,160,0.11)", top: 320, left: -120, animation: "sgAurora 18s ease-in-out infinite reverse" }} />

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
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight sg-sora" style={{ color: C.text }}>
                  Santé <span className="sg-gradient-text">système</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>État des services en temps réel</p>
              </div>
            </div>
          </motion.div>

          {/* ── Global status banner ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex items-center gap-3 px-5 py-4 rounded-2xl"
            style={{
              background: allOk ? "rgba(74,157,135,0.10)" : "rgba(192,80,74,0.10)",
              border: `1px solid ${allOk ? "rgba(74,157,135,0.28)" : "rgba(192,80,74,0.28)"}`,
              boxShadow: allOk ? "0 6px 20px rgba(74,157,135,0.10)" : "0 6px 20px rgba(192,80,74,0.10)",
            }}>
            {dbLoading
              ? <Loader className="w-5 h-5 animate-spin" style={{ color: C.textSoft }} />
              : allOk
                ? <CheckCircle2 className="w-5 h-5" style={{ color: C.primary }} />
                : <XCircle className="w-5 h-5" style={{ color: C.muted }} />}
            <p className="text-sm font-semibold sg-sora"
              style={{ color: allOk ? C.primaryDark : C.muted }}>
              {dbLoading
                ? "Vérification en cours..."
                : allOk
                  ? "Tous les services sont opérationnels"
                  : "Certains services sont dégradés"}
            </p>
          </motion.div>

          {/* ── Stats grid ── */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {STAT_CARDS.map((s, i) => (
                <motion.div key={s.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="sg-card p-5"
                  style={{ ...glass, borderLeft: `3px solid ${s.color}` }}>
                  <p className="text-2xl font-bold sg-sora" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs mt-1" style={{ color: C.textSoft }}>{s.label}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* ── Services grid ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="sg-card flex items-center justify-between p-5"
                style={{
                  ...glass,
                  borderLeft: `3px solid ${s.status ? C.primary : C.muted}`,
                }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: s.status ? "rgba(74,157,135,0.10)" : "rgba(192,80,74,0.10)",
                      border: `1px solid ${s.status ? "rgba(74,157,135,0.25)" : "rgba(192,80,74,0.25)"}`,
                    }}>
                    {s.status
                      ? <CheckCircle2 className="w-4 h-4" style={{ color: C.primary }} />
                      : <XCircle className="w-4 h-4" style={{ color: C.muted }} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold sg-sora" style={{ color: C.text }}>{s.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>
                      {s.description} · Latence : {s.latency}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold shrink-0 ml-3"
                  style={{
                    background: s.status ? "rgba(74,157,135,0.10)" : "rgba(192,80,74,0.10)",
                    color: s.status ? C.primary : C.muted,
                    border: `1px solid ${s.status ? "rgba(74,157,135,0.25)" : "rgba(192,80,74,0.25)"}`,
                  }}>
                  {s.status ? "Opérationnel" : "Hors service"}
                </span>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminSystem;