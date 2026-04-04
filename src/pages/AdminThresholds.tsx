import { motion } from "framer-motion";
import { Activity, Loader, Heart, Thermometer, Wind } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const channels = ["Application", "SMS", "Appel vocal", "E-mail"];

const thresholdConfig = [
  { label: "Fréquence Cardiaque", unit: "BPM", min: 20, max: 300, alertMin: 50, alertMax: 120, icon: Heart, field: "bpm" },
  { label: "SpO2", unit: "%", min: 0, max: 100, alertMin: 90, alertMax: 100, icon: Wind, field: "spo2" },
  { label: "Température", unit: "°C", min: 30, max: 45, alertMin: 36, alertMax: 38, icon: Thermometer, field: "temperature" },
];

const AdminThresholds = () => {
  // Stats réelles des 24 dernières heures
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

      const bpms = data.map((d: { bpm: number }) => d.bpm).filter(Boolean);
      const spo2s = data.map((d: { spo2: number }) => d.spo2).filter(Boolean);
      const temps = data.map((d: { temperature: number }) => d.temperature).filter(Boolean);

      const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
      const minV = (arr: number[]) => arr.length ? Math.round(Math.min(...arr)) : null;
      const maxV = (arr: number[]) => arr.length ? Math.round(Math.max(...arr)) : null;

      return {
        bpm: { avg: avg(bpms), min: minV(bpms), max: maxV(bpms), count: bpms.length },
        spo2: { avg: avg(spo2s), min: minV(spo2s), max: maxV(spo2s), count: spo2s.length },
        temperature: { avg: avg(temps), min: minV(temps), max: maxV(temps), count: temps.length },
      };
    },
    refetchInterval: 60000,
  });

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Seuils d'alerte</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Configuration et statistiques des 24 dernières heures</p>
            </div>
          </div>
        </motion.div>

        {/* Seuils configurés */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-card-foreground mb-6">Plages d'alerte configurées</h3>
          <div className="space-y-6">
            {thresholdConfig.map((t, i) => (
              <motion.div key={t.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <t.icon className="w-4 h-4 text-primary" />
                    <p className="text-sm font-medium text-card-foreground">{t.label}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{t.alertMin} – {t.alertMax} {t.unit}</span>
                </div>
                <div className="h-3 bg-muted rounded-full relative">
                  <div
                    className="absolute h-full bg-primary/40 rounded-full border border-primary/60"
                    style={{
                      left: `${((t.alertMin - t.min) / (t.max - t.min)) * 100}%`,
                      right: `${100 - ((t.alertMax - t.min) / (t.max - t.min)) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{t.min} {t.unit}</span>
                  <span>{t.max} {t.unit}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Stats réelles 24h */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">
            Statistiques réelles — 24 dernières heures
          </h3>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Chargement...</span>
            </div>
          ) : !stats ? (
            <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: "Fréquence Cardiaque", data: stats.bpm, unit: "BPM", icon: Heart },
                { label: "SpO2", data: stats.spo2, unit: "%", icon: Wind },
                { label: "Température", data: stats.temperature, unit: "°C", icon: Thermometer },
              ].map((s) => (
                <div key={s.label} className="bg-muted/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <s.icon className="w-4 h-4 text-primary" />
                    <p className="text-sm font-medium text-card-foreground">{s.label}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Moyenne</span>
                      <span className="font-medium text-card-foreground">{s.data.avg ?? "—"} {s.unit}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Min</span>
                      <span className="text-card-foreground">{s.data.min ?? "—"} {s.unit}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Max</span>
                      <span className="text-card-foreground">{s.data.max ?? "—"} {s.unit}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-border">
                      <span className="text-muted-foreground">Mesures</span>
                      <span className="text-primary font-medium">{s.data.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Canaux d'alerte */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Canaux d'alerte</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {channels.map((channel) => (
              <div key={channel} className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
                <span className="text-sm text-card-foreground">{channel}</span>
                <div className="w-8 h-5 bg-green-500 rounded-full relative">
                  <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-card rounded-full shadow-sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminThresholds;