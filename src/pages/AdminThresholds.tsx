import { motion } from "framer-motion";
import { Activity, Loader, Heart, Thermometer, Wind, TrendingUp, TrendingDown, Minus } from "lucide-react";
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

// ─── Threshold config using C palette ─────────────────────────────────────────
const thresholdConfig = [
  {
    label: "Fréquence Cardiaque", unit: "BPM", min: 20, max: 300, alertMin: 50, alertMax: 120,
    icon: Heart, field: "bpm",
    color: C.muted,
    track: C.muted,
    bg: "rgba(192,80,74,0.10)",
    border: "rgba(192,80,74,0.25)",
    glow: "rgba(192,80,74,0.08)",
  },
  {
    label: "SpO2", unit: "%", min: 0, max: 100, alertMin: 90, alertMax: 100,
    icon: Wind, field: "spo2",
    color: C.secondary,
    track: C.secondary,
    bg: "rgba(91,143,160,0.12)",
    border: "rgba(91,143,160,0.28)",
    glow: "rgba(91,143,160,0.08)",
  },
  {
    label: "Température", unit: "°C", min: 30, max: 45, alertMin: 36, alertMax: 38,
    icon: Thermometer, field: "temperature",
    color: C.gold,
    track: C.gold,
    bg: "rgba(212,168,67,0.12)",
    border: "rgba(212,168,67,0.28)",
    glow: "rgba(212,168,67,0.07)",
  },
];

const statFields = [
  { label: "Fréquence Cardiaque", dataKey: "bpm",         unit: "BPM", icon: Heart,       color: C.muted,     bg: "rgba(192,80,74,0.10)",  border: "rgba(192,80,74,0.22)" },
  { label: "SpO2",                dataKey: "spo2",        unit: "%",   icon: Wind,        color: C.secondary, bg: "rgba(91,143,160,0.12)", border: "rgba(91,143,160,0.25)" },
  { label: "Température",         dataKey: "temperature", unit: "°C",  icon: Thermometer, color: C.gold,      bg: "rgba(212,168,67,0.12)", border: "rgba(212,168,67,0.25)" },
];

const TrendIcon = ({ value, min, max }: { value: number | null; min: number | null; max: number | null }) => {
  if (!value || !min || !max) return <Minus className="w-3.5 h-3.5" style={{ color: C.textSoft }} />;
  const mid = (min + max) / 2;
  if (value > mid * 1.05) return <TrendingUp  className="w-3.5 h-3.5" style={{ color: C.primary }} />;
  if (value < mid * 0.95) return <TrendingDown className="w-3.5 h-3.5" style={{ color: C.muted }} />;
  return <Minus className="w-3.5 h-3.5" style={{ color: C.textSoft }} />;
};

const AdminThresholds = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-vitals-stats"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("vital_signs")
        .select("bpm, spo2, temperature")
        .gte("recorded_at", since)
        .not("bpm", "is", null);

      if (error) throw error;
      if (!data?.length) return null;

      const bpms  = data.map((d: { bpm: number }) => d.bpm).filter(Boolean);
      const spo2s = data.map((d: { spo2: number }) => d.spo2).filter(Boolean);
      const temps = data.map((d: { temperature: number }) => d.temperature).filter(Boolean);

      const avg  = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
      const minV = (arr: number[]) => arr.length ? Math.round(Math.min(...arr)) : null;
      const maxV = (arr: number[]) => arr.length ? Math.round(Math.max(...arr)) : null;

      return {
        bpm:         { avg: avg(bpms),  min: minV(bpms),  max: maxV(bpms),  count: bpms.length },
        spo2:        { avg: avg(spo2s), min: minV(spo2s), max: maxV(spo2s), count: spo2s.length },
        temperature: { avg: avg(temps), min: minV(temps), max: maxV(temps), count: temps.length },
      };
    },
    refetchInterval: 60000,
  });

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
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight sg-sora" style={{ color: C.text }}>
                  Seuils <span className="sg-gradient-text">d'alerte</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                  Configuration et statistiques des 24 dernières heures
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Threshold cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {thresholdConfig.map((t, i) => {
              const leftPct  = ((t.alertMin - t.min) / (t.max - t.min)) * 100;
              const rightPct = 100 - ((t.alertMax - t.min) / (t.max - t.min)) * 100;
              return (
                <motion.div
                  key={t.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="sg-card overflow-hidden relative"
                  style={{ ...glass, borderLeft: `3px solid ${t.color}` }}
                >
                  {/* Subtle background glow */}
                  <div className="absolute inset-0 pointer-events-none rounded-[22px]"
                    style={{ background: t.glow }} />

                  <div className="relative p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: t.bg, border: `1px solid ${t.border}` }}>
                          <t.icon className="w-4 h-4" style={{ color: t.color }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold sg-sora" style={{ color: C.text }}>{t.label}</p>
                          <p className="text-xs font-bold" style={{ color: t.color }}>
                            {t.alertMin} – {t.alertMax} {t.unit}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>
                        Normal
                      </span>
                    </div>

                    {/* Range bar */}
                    <div className="space-y-2">
                      <div className="h-2.5 rounded-full relative overflow-hidden"
                        style={{ background: "rgba(74,157,135,0.10)" }}>
                        {/* Danger zones */}
                        <div className="absolute left-0 top-0 h-full rounded-l-full"
                          style={{ width: `${leftPct}%`, background: "rgba(192,80,74,0.22)" }} />
                        <div className="absolute right-0 top-0 h-full rounded-r-full"
                          style={{ width: `${rightPct}%`, background: "rgba(192,80,74,0.22)" }} />
                        {/* Normal zone */}
                        <div className="absolute h-full rounded-full"
                          style={{ left: `${leftPct}%`, right: `${rightPct}%`, background: t.track, opacity: 0.75 }} />
                      </div>
                      <div className="flex justify-between text-[11px]" style={{ color: C.textSoft }}>
                        <span>{t.min} {t.unit}</span>
                        <span style={{ color: "rgba(30,60,50,0.35)" }}>plage normale</span>
                        <span>{t.max} {t.unit}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* ── 24h Stats ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="sg-card p-6" style={glass}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>
                Statistiques réelles — 24 dernières heures
              </h3>
              {!isLoading && stats && (
                <span className="text-xs px-2.5 py-1 rounded-lg"
                  style={{ background: "rgba(74,157,135,0.08)", color: C.textSoft, border: "1px solid rgba(74,157,135,0.16)" }}>
                  Mise à jour automatique
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 py-6" style={{ color: C.textSoft }}>
                <Loader className="w-4 h-4 animate-spin" style={{ color: C.primary }} />
                <span className="text-sm">Chargement...</span>
              </div>
            ) : !stats ? (
              <p className="text-sm py-4" style={{ color: C.textSoft }}>Aucune donnée disponible.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {statFields.map((s, i) => {
                  const d = stats[s.dataKey as keyof typeof stats];
                  return (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.07 }}
                      className="rounded-2xl p-4"
                      style={{
                        background: s.bg,
                        border: `1px solid ${s.border}`,
                      }}
                    >
                      {/* Icon + label */}
                      <div className="flex items-center gap-2 mb-3">
                        <s.icon className="w-4 h-4" style={{ color: s.color }} />
                        <p className="text-xs font-semibold sg-sora" style={{ color: C.text }}>{s.label}</p>
                      </div>

                      {/* Big avg */}
                      <div className="flex items-end gap-1.5 mb-3">
                        <span className="text-3xl font-bold sg-sora" style={{ color: s.color }}>
                          {d.avg ?? "—"}
                        </span>
                        <span className="text-sm mb-1" style={{ color: C.textSoft }}>{s.unit}</span>
                        <span className="mb-1 ml-auto">
                          <TrendIcon value={d.avg} min={d.min} max={d.max} />
                        </span>
                      </div>

                      {/* Min / Max */}
                      <div className="flex gap-2 mb-3">
                        {[{ label: "Min", val: d.min }, { label: "Max", val: d.max }].map(({ label, val }) => (
                          <div key={label} className="flex-1 rounded-xl px-2.5 py-1.5 text-center"
                            style={{ background: "rgba(255,255,255,0.55)" }}>
                            <p className="text-[10px] uppercase tracking-wide" style={{ color: C.textSoft }}>{label}</p>
                            <p className="text-sm font-semibold" style={{ color: C.text }}>{val ?? "—"}</p>
                          </div>
                        ))}
                      </div>

                      {/* Measure count */}
                      <div className="flex items-center justify-between pt-2.5"
                        style={{ borderTop: `1px solid ${s.border}` }}>
                        <span className="text-xs" style={{ color: C.textSoft }}>Mesures collectées</span>
                        <span className="text-xs font-bold" style={{ color: s.color }}>{d.count}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminThresholds;