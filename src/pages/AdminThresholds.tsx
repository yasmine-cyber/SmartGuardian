import { motion } from "framer-motion";
import { Activity, Loader, Heart, Thermometer, Wind, CheckCircle2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const channels = [
  { name: "Application", icon: "📱", color: "text-violet-600", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  { name: "E-mail", icon: "✉️", color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/20" },
];

const thresholdConfig = [
  {
    label: "Fréquence Cardiaque",
    unit: "BPM",
    min: 20,
    max: 300,
    alertMin: 50,
    alertMax: 120,
    icon: Heart,
    field: "bpm",
    color: "text-red-600",
    trackColor: "bg-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    gradient: "from-red-500/20 via-red-500/40 to-red-500/20",
  },
  {
    label: "SpO2",
    unit: "%",
    min: 0,
    max: 100,
    alertMin: 90,
    alertMax: 100,
    icon: Wind,
    field: "spo2",
    color: "text-sky-600",
    trackColor: "bg-sky-500",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    gradient: "from-sky-500/20 via-sky-500/40 to-sky-500/20",
  },
  {
    label: "Température",
    unit: "°C",
    min: 30,
    max: 45,
    alertMin: 36,
    alertMax: 38,
    icon: Thermometer,
    field: "temperature",
    color: "text-orange-600",
    trackColor: "bg-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    gradient: "from-orange-500/20 via-orange-500/40 to-orange-500/20",
  },
];

const statFields = [
  { label: "Fréquence Cardiaque", dataKey: "bpm", unit: "BPM", icon: Heart, color: "text-red-600", bg: "bg-red-500/10", border: "border-red-500/20", ring: "ring-red-500/30" },
  { label: "SpO2", dataKey: "spo2", unit: "%", icon: Wind, color: "text-sky-600", bg: "bg-sky-500/10", border: "border-sky-500/20", ring: "ring-sky-500/30" },
  { label: "Température", dataKey: "temperature", unit: "°C", icon: Thermometer, color: "text-orange-600", bg: "bg-orange-500/10", border: "border-orange-500/20", ring: "ring-orange-500/30" },
];

const TrendIcon = ({ value, min, max }: { value: number | null; min: number | null; max: number | null }) => {
  if (!value || !min || !max) return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  const mid = (min + max) / 2;
  if (value > mid * 1.05) return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
  if (value < mid * 0.95) return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
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
      <div className="space-y-6 max-w-7xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Seuils d'alerte</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Configuration et statistiques des 24 dernières heures</p>
            </div>
          </div>
        </motion.div>

        {/* Threshold cards */}
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
                className={`bg-card border ${t.border} rounded-2xl p-5 shadow-sm relative overflow-hidden`}
              >
                {/* Background accent */}
                <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient} opacity-30 pointer-events-none`} />

                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl ${t.bg} flex items-center justify-center`}>
                        <t.icon className={`w-4.5 h-4.5 ${t.color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-card-foreground">{t.label}</p>
                        <p className={`text-xs font-bold ${t.color}`}>{t.alertMin} – {t.alertMax} {t.unit}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${t.bg} ${t.color} ${t.border}`}>
                      Normal
                    </span>
                  </div>

                  {/* Range bar */}
                  <div className="space-y-2">
                    <div className="h-2.5 bg-muted rounded-full relative overflow-hidden">
                      {/* Danger zones */}
                      <div className="absolute left-0 top-0 h-full bg-red-500/20 rounded-l-full" style={{ width: `${leftPct}%` }} />
                      <div className="absolute right-0 top-0 h-full bg-red-500/20 rounded-r-full" style={{ width: `${rightPct}%` }} />
                      {/* Normal zone */}
                      <div
                        className={`absolute h-full ${t.trackColor} rounded-full opacity-70`}
                        style={{ left: `${leftPct}%`, right: `${rightPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{t.min} {t.unit}</span>
                      <span className="text-muted-foreground/60">plage normale</span>
                      <span>{t.max} {t.unit}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* 24h Stats */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-2xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-card-foreground">Statistiques réelles — 24 dernières heures</h3>
            {!isLoading && stats && (
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
                Mise à jour automatique
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Chargement...</span>
            </div>
          ) : !stats ? (
            <p className="text-sm text-muted-foreground py-4">Aucune donnée disponible.</p>
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
                    className={`rounded-xl border ${s.border} ${s.bg} p-4`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                      <p className="text-xs font-semibold text-card-foreground">{s.label}</p>
                    </div>

                    {/* Big avg */}
                    <div className="flex items-end gap-1.5 mb-3">
                      <span className={`text-3xl font-bold ${s.color}`}>{d.avg ?? "—"}</span>
                      <span className="text-sm text-muted-foreground mb-1">{s.unit}</span>
                      <span className="mb-1 ml-auto">
                        <TrendIcon value={d.avg} min={d.min} max={d.max} />
                      </span>
                    </div>

                    {/* Min / Max */}
                    <div className="flex gap-2 mb-3">
                      <div className="flex-1 bg-card/60 rounded-lg px-2.5 py-1.5 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Min</p>
                        <p className="text-sm font-semibold text-card-foreground">{d.min ?? "—"}</p>
                      </div>
                      <div className="flex-1 bg-card/60 rounded-lg px-2.5 py-1.5 text-center">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Max</p>
                        <p className="text-sm font-semibold text-card-foreground">{d.max ?? "—"}</p>
                      </div>
                    </div>

                    {/* Measure count */}
                    <div className={`flex items-center justify-between border-t ${s.border} pt-2.5`}>
                      <span className="text-xs text-muted-foreground">Mesures collectées</span>
                      <span className={`text-xs font-bold ${s.color}`}>{d.count}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        

      </div>
    </DashboardLayout>
  );
};

export default AdminThresholds;