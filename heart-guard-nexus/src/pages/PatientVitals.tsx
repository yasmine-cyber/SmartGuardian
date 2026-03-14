import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Loader, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import VitalCard from "@/components/VitalCard";
import { supabase } from "@/lib/supabase";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

interface VitalSign {
  id: string;
  bpm: number | null;
  spo2: number | null;
  temperature: number | null;
  chute: boolean | null;
  recorded_at: string;
}

const PatientVitals = () => {
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [latest, setLatest] = useState<VitalSign | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // Init
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!patient) return;

      const { data: device } = await supabase
        .from("devices")
        .select("id")
        .eq("patient_id", patient.id)
        .eq("actif", true)
        .single();
      if (!device) { setLoading(false); return; }

      setDeviceId(device.id);

      // Dernières 20 mesures
      const { data } = await supabase
        .from("vital_signs")
        .select("id, bpm, spo2, temperature, chute, recorded_at")
        .eq("device_id", device.id)
        .order("recorded_at", { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        setVitals(data.reverse());
        setLatest(data[data.length - 1]);
        setLastUpdate(new Date());
      }

      setLoading(false);
    };

    init();
  }, []);

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // Realtime
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    if (!deviceId) return;

    const channel = supabase
      .channel("vitals_page_realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "vital_signs",
        filter: `device_id=eq.${deviceId}`,
      }, (payload) => {
        const newVital = payload.new as VitalSign;
        setLatest(newVital);
        setLastUpdate(new Date());
        setVitals(prev => [...prev.slice(-19), newVital]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [deviceId]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // Helpers
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  const getBpmStatus = (v: number | null) => {
    if (!v) return "safe";
    if (v > 120 || v < 40) return "critical";
    if (v > 100 || v < 50) return "elevated";
    return "safe";
  };

  const getSpo2Status = (v: number | null) => {
    if (!v) return "safe";
    if (v < 90) return "critical";
    if (v < 95) return "elevated";
    return "safe";
  };

  const getTempStatus = (v: number | null) => {
    if (!v) return "safe";
    if (v > 39.5 || v < 35) return "critical";
    if (v > 37.5) return "elevated";
    return "safe";
  };

  const chartData = vitals.map(v => ({
    time: new Date(v.recorded_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    BPM: v.bpm,
    SpO2: v.spo2,
    Température: v.temperature,
  }));

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 max-w-6xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" /> Mes Constantes
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {lastUpdate
                ? `Dernière mise à jour : ${formatTime(lastUpdate)}`
                : "En attente de données..."}
            </p>
          </div>
          {lastUpdate && (
            <div className="flex items-center gap-2 text-xs text-green-500">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Temps réel actif
            </div>
          )}
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : !deviceId ? (
          <div className="text-center py-20 bg-card border border-border rounded-2xl">
            <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Aucun capteur associé</p>
            <p className="text-xs text-muted-foreground mt-1">Contactez votre médecin pour associer un capteur</p>
          </div>
        ) : (
          <>
            {/* Vital Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <VitalCard icon="❤️" label="Fréquence Cardiaque"
                value={latest?.bpm?.toString() ?? "—"} unit="BPM"
                status={getBpmStatus(latest?.bpm ?? null) as any}
                delay={0.1} borderColor="border-l-primary">
                <div className="mt-3 h-1 rounded-full bg-primary/10">
                  <div className="h-full rounded-full bg-primary animate-pulse"
                    style={{ width: `${Math.min(((latest?.bpm ?? 0) / 200) * 100, 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Normal : 60-100 BPM
                </p>
              </VitalCard>

              <VitalCard icon="🩸" label="SpO2"
                value={latest?.spo2?.toString() ?? "—"} unit="%"
                status={getSpo2Status(latest?.spo2 ?? null) as any}
                delay={0.2} borderColor="border-l-safe">
                <div className="mt-3">
                  <svg viewBox="0 0 36 36" className="w-10 h-10">
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="hsl(var(--safe))" strokeWidth="3"
                      strokeDasharray={`${latest?.spo2 ?? 0}, 100`} strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-xs text-muted-foreground">Normal : 95-100%</p>
              </VitalCard>

              <VitalCard icon="🌡️" label="Température"
                value={latest?.temperature?.toFixed(1) ?? "—"} unit="°C"
                status={getTempStatus(latest?.temperature ?? null) as any}
                delay={0.3} borderColor="border-l-accent">
                <p className="text-xs text-muted-foreground mt-2">Normal : 36.1-37.2°C</p>
              </VitalCard>

              <VitalCard
                icon={latest?.chute ? "🚨" : "✅"}
                label="Détection Chute"
                value={latest?.chute ? "ALERTE" : "Normal"}
                unit=""
                status={latest?.chute ? "critical" : "safe" as any}
                delay={0.4}
                borderColor={latest?.chute ? "border-l-destructive" : "border-l-safe"}>
                <p className="text-xs text-muted-foreground mt-2">
                  {latest?.chute ? "⚠️ Chute détectée !" : "Aucune chute détectée"}
                </p>
              </VitalCard>
            </div>

            {/* BPM Chart */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-card-foreground">
                  Fréquence Cardiaque — 20 dernières mesures
                </h3>
                <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" style={{ animationDuration: "3s" }} />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[40, 160]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Line type="monotone" dataKey="BPM" stroke="hsl(var(--primary))"
                    strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            {/* SpO2 Chart */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-card-foreground mb-4">
                SpO2 — 20 dernières mesures
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[80, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Line type="monotone" dataKey="SpO2" stroke="hsl(var(--safe))"
                    strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Tableau des dernières mesures */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-card-foreground mb-4">
                Dernières mesures
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left pb-2">Heure</th>
                      <th className="text-left pb-2">BPM</th>
                      <th className="text-left pb-2">SpO2</th>
                      <th className="text-left pb-2">Température</th>
                      <th className="text-left pb-2">Chute</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...vitals].reverse().slice(0, 10).map((v) => (
                      <tr key={v.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2 text-muted-foreground text-xs">
                          {new Date(v.recorded_at).toLocaleTimeString("fr-FR")}
                        </td>
                        <td className={`py-2 font-medium ${getBpmStatus(v.bpm) === "safe" ? "text-green-500" : getBpmStatus(v.bpm) === "critical" ? "text-red-500" : "text-yellow-500"}`}>
                          {v.bpm ?? "—"}
                        </td>
                        <td className={`py-2 font-medium ${getSpo2Status(v.spo2) === "safe" ? "text-green-500" : getSpo2Status(v.spo2) === "critical" ? "text-red-500" : "text-yellow-500"}`}>
                          {v.spo2 ?? "—"}%
                        </td>
                        <td className={`py-2 font-medium ${getTempStatus(v.temperature) === "safe" ? "text-green-500" : "text-red-500"}`}>
                          {v.temperature?.toFixed(1) ?? "—"}°C
                        </td>
                        <td className="py-2">
                          {v.chute ? <span className="text-red-500 text-xs font-medium">⚠️ Oui</span> : <span className="text-green-500 text-xs">Non</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientVitals;