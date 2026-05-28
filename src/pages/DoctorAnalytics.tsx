import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Activity, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, Cell } from "recharts";
import { supabase } from "@/lib/supabase";

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  primary:     "#4a9d87",
  primaryDark: "#3d8c7a",
  secondary:   "#5b8fa0",
  text:        "#1a2e28",
  textSoft:    "rgba(30,60,50,0.62)",
  gold:        "#d4a843",
  muted:       "#c0504a",
};

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.18)",
  borderRadius: "22px",
  boxShadow: "0 8px 32px rgba(30,60,50,0.08), 0 1px 0 rgba(255,255,255,0.9) inset",
};

const chartConfig = {
  count: { label: "Nombre", color: C.primary },
  month: { label: "Statut" },
};

// Bar colors per category
const BAR_COLORS = [C.primary, C.gold, C.muted];

const STAT_CONFIG = [
  { icon: Users,     label: "Total patients",     key: "total",     color: C.primary,   bg: "rgba(74,157,135,0.10)",  border: "rgba(74,157,135,0.22)"  },
  { icon: TrendingUp,label: "Stables",            key: "stable",    color: "#5aaa6e",   bg: "rgba(90,170,110,0.10)",  border: "rgba(90,170,110,0.22)"  },
  { icon: Activity,  label: "Sous surveillance",  key: "attention", color: C.gold,      bg: "rgba(212,168,67,0.12)",  border: "rgba(212,168,67,0.28)"  },
  { icon: BarChart3, label: "Critiques",          key: "critical",  color: C.muted,     bg: "rgba(192,80,74,0.10)",   border: "rgba(192,80,74,0.25)"   },
] as const;

const DoctorAnalytics = () => {
  const [stats, setStats] = useState<{
    total: number;
    stable: number;
    attention: number;
    critical: number;
  }>({ total: 0, stable: 0, attention: 0, critical: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("patients")
        .select("id, status")
        .eq("medecin_id", user.id);

      console.log("user.id:", user.id);
      console.log("data:", data);
      console.log("error:", error);

      if (error) {
        console.error("DoctorAnalytics: failed to fetch patients", error);
        setLoading(false);
        return;
      }

      const list = data ?? [];
      setStats({
        total:     list.length,
        stable:    list.filter((p: { status?: string }) => p.status === "stable").length,
        attention: list.filter((p: { status?: string }) => p.status === "attention").length,
        critical:  list.filter((p: { status?: string }) => p.status === "critical").length,
      });
      setLoading(false);
    };
    load();
  }, []);

  const chartData = [
    { month: "Stable",       count: stats.stable    },
    { month: "Surveillance", count: stats.attention },
    { month: "Critique",     count: stats.critical  },
  ];

  return (
    <DashboardLayout role="doctor">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        .dr-root {
          font-family: 'DM Sans', sans-serif;
          position: relative;
          min-height: 100vh;
          background: linear-gradient(135deg, #edf7f4 0%, #e6f2f7 50%, #f0f7f5 100%);
          margin: -24px;
          padding: 24px;
        }
        .dr-root h1, .dr-root h2, .dr-sora { font-family: 'Sora', sans-serif !important; }
        .dr-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes drAurora {
          0%,100% { transform: translate(0,0) scale(1); opacity:.55; }
          50%      { transform: translate(28px,-18px) scale(1.06); opacity:.85; }
        }
        .dr-aurora {
          position: fixed; border-radius: 50%;
          filter: blur(90px); pointer-events: none; z-index: 0;
        }
        .dr-content { position: relative; z-index: 1; }
        .dr-stat-card { transition: transform .28s cubic-bezier(.22,1,.36,1), box-shadow .28s; }
        .dr-stat-card:hover { transform: translateY(-3px); box-shadow: 0 20px 48px rgba(30,60,50,0.10) !important; }
      `}</style>

      <div className="dr-root">
        {/* Aurora orbs */}
        <div className="dr-aurora" style={{ width: 480, height: 480, background: "rgba(74,157,135,0.16)", top: "2%", right: "3%", animation: "drAurora 22s ease-in-out infinite" }} />
        <div className="dr-aurora" style={{ width: 380, height: 380, background: "rgba(91,143,160,0.13)", top: "50%", left: "0%", animation: "drAurora 18s ease-in-out infinite reverse" }} />
        <div className="dr-aurora" style={{ width: 300, height: 300, background: "rgba(212,168,67,0.08)",  bottom: "8%", right: "15%", animation: "drAurora 26s ease-in-out infinite 3s" }} />

        <div className="dr-content space-y-5 max-w-5xl">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 dr-stat-card" style={glass}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 8px 24px rgba(74,157,135,0.35)",
                }}>
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight dr-sora" style={{ color: C.text }}>
                  Mes <span className="dr-gradient-text">Analyses</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                  Vue d'ensemble de l'état de vos patients
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── KPI cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {STAT_CONFIG.map((s, i) => (
              <motion.div key={s.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="dr-stat-card p-5"
                style={glass}>
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                  <s.icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                {/* Value */}
                <p className="text-3xl font-bold dr-sora" style={{ color: loading ? C.textSoft : s.color }}>
                  {loading ? "—" : stats[s.key]}
                </p>
                {/* Label */}
                <p className="text-xs mt-1 font-medium" style={{ color: C.textSoft }}>{s.label}</p>
                {/* Bottom accent bar */}
                <div className="mt-3 h-1 rounded-full" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      background: s.color,
                      width: loading || stats.total === 0
                        ? "0%"
                        : s.key === "total"
                          ? "100%"
                          : `${Math.round((stats[s.key] / stats.total) * 100)}%`,
                    }} />
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Bar chart ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            className="dr-stat-card p-6"
            style={glass}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, boxShadow: "0 4px 12px rgba(74,157,135,0.25)" }}>
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-sm font-semibold dr-sora" style={{ color: C.text }}>Répartition par statut</h2>
            </div>

            <div className="h-[280px]">
              <ChartContainer config={chartConfig} className="w-full h-full">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: C.textSoft, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tick={{ fill: C.textSoft, fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    cursor={{ fill: "rgba(74,157,135,0.06)", radius: 8 }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={BAR_COLORS[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4" style={{ borderTop: "1px solid rgba(74,157,135,0.12)" }}>
              {chartData.map((d, i) => (
                <div key={d.month} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: BAR_COLORS[i] }} />
                  <span className="text-xs font-medium" style={{ color: C.textSoft }}>
                    {d.month} <span className="font-bold" style={{ color: C.text }}>{loading ? "—" : d.count}</span>
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoctorAnalytics;