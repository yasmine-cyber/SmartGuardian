import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Loader, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import VitalCard from "@/components/VitalCard";
import { supabase } from "@/lib/supabase";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

interface VitalSign {
  id: string;
  bpm: number | null;
  spo2: number | null;
  temperature: number | null;
  chute: boolean | null;
  recorded_at: string;
}

// ─── Palette (matches PatientAlerts / landing page) ──────────────────────────
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

  const statusColor = (s: string) => {
    if (s === "critical") return C.muted;
    if (s === "elevated") return C.gold;
    return C.primary;
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
        <div className="sg-aurora-a" style={{ background: "rgba(91,143,160,0.12)", top: 320, left: -120, animation: "sgAurora 18s ease-in-out infinite reverse" }} />

        <div className="relative space-y-5 max-w-6xl">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl" style={glass}>
            <div className="flex items-center justify-between flex-wrap gap-4">
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
                    Mes <span className="sg-gradient-text">Constantes</span>
                  </h1>
                  <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                    {lastUpdate
                      ? `Dernière mise à jour : ${formatTime(lastUpdate)}`
                      : "En attente de données..."}
                  </p>
                </div>
              </div>
              {lastUpdate && (
                <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(74,157,135,0.10)", color: C.primary, border: "1px solid rgba(74,157,135,0.25)" }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.primary }} />
                  Temps réel actif
                </div>
              )}
            </div>
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
            </div>
          ) : !deviceId ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-3" style={glass}>
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 12px 28px rgba(74,157,135,0.30)",
                }}>
                <Activity className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold sg-sora" style={{ color: C.text }}>Aucun capteur associé</p>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                  Contactez votre médecin pour associer un capteur
                </p>
              </div>
            </motion.div>
          ) : (
            <>
              {/* ── Vital Cards ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <VitalCard icon="❤️" label="Fréquence Cardiaque"
                  value={latest?.bpm?.toString() ?? "—"} unit="BPM"
                  status={getBpmStatus(latest?.bpm ?? null) as any}
                  delay={0.1} borderColor="border-l-primary">
                  <div className="mt-3 h-1 rounded-full" style={{ background: "rgba(74,157,135,0.12)" }}>
                    <div className="h-full rounded-full animate-pulse"
                      style={{
                        width: `${Math.min(((latest?.bpm ?? 0) / 200) * 100, 100)}%`,
                        background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
                      }} />
                  </div>
                  <p className="text-xs mt-1" style={{ color: C.textSoft }}>Normal : 60-100 BPM</p>
                </VitalCard>

                <VitalCard icon="🩸" label="SpO2"
                  value={latest?.spo2?.toString() ?? "—"} unit="%"
                  status={getSpo2Status(latest?.spo2 ?? null) as any}
                  delay={0.2} borderColor="border-l-safe">
                  <div className="mt-3">
                    <svg viewBox="0 0 36 36" className="w-10 h-10">
                      <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none" stroke={C.secondary} strokeWidth="3"
                        strokeDasharray={`${latest?.spo2 ?? 0}, 100`} strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-xs" style={{ color: C.textSoft }}>Normal : 95-100%</p>
                </VitalCard>

                <VitalCard icon="🌡️" label="Température"
                  value={latest?.temperature?.toFixed(1) ?? "—"} unit="°C"
                  status={getTempStatus(latest?.temperature ?? null) as any}
                  delay={0.3} borderColor="border-l-accent">
                  <p className="text-xs mt-2" style={{ color: C.textSoft }}>Normal : 36.1-37.2°C</p>
                </VitalCard>

                <VitalCard
                  icon={latest?.chute ? "🚨" : "✅"}
                  label="Détection Chute"
                  value={latest?.chute ? "ALERTE" : "Normal"}
                  unit=""
                  status={latest?.chute ? "critical" : "safe" as any}
                  delay={0.4}
                  borderColor={latest?.chute ? "border-l-destructive" : "border-l-safe"}>
                  <p className="text-xs mt-2" style={{ color: C.textSoft }}>
                    {latest?.chute ? "⚠️ Chute détectée !" : "Aucune chute détectée"}
                  </p>
                </VitalCard>
              </div>

              {/* ── BPM Chart ── */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="sg-card p-6" style={glass}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>
                      Fréquence Cardiaque
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>20 dernières mesures</p>
                  </div>
                  <RefreshCw className="w-4 h-4 animate-spin" style={{ color: C.textSoft, animationDuration: "3s" }} />
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,157,135,0.12)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: C.textSoft }} stroke="transparent" />
                    <YAxis domain={[40, 160]} tick={{ fontSize: 10, fill: C.textSoft }} stroke="transparent" />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255,255,255,0.92)",
                        border: "1px solid rgba(74,157,135,0.20)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        boxShadow: "0 8px 24px rgba(30,60,50,0.08)",
                      }}
                    />
                    <Line type="monotone" dataKey="BPM" stroke={C.primary}
                      strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: C.primary }} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>

              {/* ── SpO2 Chart ── */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="sg-card p-6" style={glass}>
                <div className="mb-5">
                  <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>SpO2</h3>
                  <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>20 dernières mesures</p>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,157,135,0.12)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: C.textSoft }} stroke="transparent" />
                    <YAxis domain={[80, 100]} tick={{ fontSize: 10, fill: C.textSoft }} stroke="transparent" />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255,255,255,0.92)",
                        border: "1px solid rgba(91,143,160,0.20)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        boxShadow: "0 8px 24px rgba(30,60,50,0.08)",
                      }}
                    />
                    <Line type="monotone" dataKey="SpO2" stroke={C.secondary}
                      strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: C.secondary }} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>

              {/* ── Table ── */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="sg-card overflow-hidden" style={glass}>
                <div className="px-6 pt-5 pb-3">
                  <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>Dernières mesures</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(74,157,135,0.14)" }}>
                        {["Heure", "BPM", "SpO2", "Température", "Chute"].map(h => (
                          <th key={h} className="text-left px-6 pb-3 text-xs font-semibold uppercase tracking-wider"
                            style={{ color: C.textSoft }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...vitals].reverse().slice(0, 10).map((v) => (
                        <tr key={v.id}
                          className="transition-colors"
                          style={{ borderBottom: "1px solid rgba(74,157,135,0.07)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(74,157,135,0.04)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td className="px-6 py-3 text-xs" style={{ color: C.textSoft }}>
                            {new Date(v.recorded_at).toLocaleTimeString("fr-FR")}
                          </td>
                          <td className="px-6 py-3 font-semibold text-xs"
                            style={{ color: statusColor(getBpmStatus(v.bpm)) }}>
                            {v.bpm ?? "—"}
                          </td>
                          <td className="px-6 py-3 font-semibold text-xs"
                            style={{ color: statusColor(getSpo2Status(v.spo2)) }}>
                            {v.spo2 ?? "—"}%
                          </td>
                          <td className="px-6 py-3 font-semibold text-xs"
                            style={{ color: statusColor(getTempStatus(v.temperature)) }}>
                            {v.temperature?.toFixed(1) ?? "—"}°C
                          </td>
                          <td className="px-6 py-3">
                            {v.chute
                              ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: "rgba(192,80,74,0.12)", color: C.muted, border: "1px solid rgba(192,80,74,0.25)" }}>
                                  ⚠️ Oui
                                </span>
                              : <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: "rgba(74,157,135,0.10)", color: C.primary, border: "1px solid rgba(74,157,135,0.22)" }}>
                                  Non
                                </span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="h-4" />
              </motion.div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientVitals;