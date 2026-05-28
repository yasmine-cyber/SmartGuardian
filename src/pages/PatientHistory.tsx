import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, Loader, Calendar } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface VitalSign {
  bpm: number | null;
  spo2: number | null;
  temperature: number | null;
  recorded_at: string;
}

type Period = "1h" | "24h" | "7j" | "30j";

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

const PatientHistory = () => {
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("24h");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patient } = await supabase
        .from("patients").select("id").eq("user_id", user.id).single();
      if (!patient) { setLoading(false); return; }

      const { data: device } = await supabase
        .from("devices").select("id")
        .eq("patient_id", patient.id).eq("actif", true).single();
      if (!device) { setLoading(false); return; }

      setDeviceId(device.id);
      await fetchHistory(device.id, period);
      setLoading(false);
    };
    init();
  }, []);

  const fetchHistory = async (devId: string, p: Period) => {
    setLoading(true);
    const now = new Date();
    const from = new Date(now);

    if (p === "1h") from.setHours(now.getHours() - 1);
    else if (p === "24h") from.setDate(now.getDate() - 1);
    else if (p === "7j") from.setDate(now.getDate() - 7);
    else from.setDate(now.getDate() - 30);

    const { data } = await supabase
      .from("vital_signs")
      .select("bpm, spo2, temperature, recorded_at")
      .eq("device_id", devId)
      .gte("recorded_at", from.toISOString())
      .order("recorded_at", { ascending: true });

    if (data) setVitals(data);
    setLoading(false);
  };

  const handlePeriod = async (p: Period) => {
    setPeriod(p);
    if (deviceId) await fetchHistory(deviceId, p);
  };

  const chartData = vitals.map(v => ({
    time: new Date(v.recorded_at).toLocaleTimeString("fr-FR", {
      hour: "2-digit", minute: "2-digit",
      ...(period === "7j" || period === "30j" ? { day: "2-digit", month: "2-digit" } : {})
    }),
    BPM: v.bpm,
    SpO2: v.spo2,
    Temp: v.temperature,
  }));

  const bpms  = vitals.map(v => v.bpm).filter(Boolean) as number[];
  const spo2s = vitals.map(v => v.spo2).filter(Boolean) as number[];

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const min = (arr: number[]) => arr.length ? Math.min(...arr) : null;
  const max = (arr: number[]) => arr.length ? Math.max(...arr) : null;

  const STATS = [
    { label: "BPM moyen",   value: avg(bpms),                         unit: "BPM", color: C.primary,    accent: "rgba(74,157,135,0.10)",  border: "rgba(74,157,135,0.22)" },
    { label: "BPM min/max", value: `${min(bpms) ?? "—"}/${max(bpms) ?? "—"}`, unit: "BPM", color: C.textSoft, accent: "rgba(74,157,135,0.06)",  border: "rgba(74,157,135,0.14)" },
    { label: "SpO2 moyen",  value: avg(spo2s),                        unit: "%",   color: C.secondary,  accent: "rgba(91,143,160,0.10)",  border: "rgba(91,143,160,0.22)" },
    {
      label: "SpO2 min",
      value: min(spo2s),
      unit: "%",
      color: min(spo2s) != null && min(spo2s)! < 95 ? C.muted : C.primary,
      accent: min(spo2s) != null && min(spo2s)! < 95 ? "rgba(192,80,74,0.08)" : "rgba(74,157,135,0.10)",
      border: min(spo2s) != null && min(spo2s)! < 95 ? "rgba(192,80,74,0.22)" : "rgba(74,157,135,0.22)",
    },
  ];

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
        <div className="sg-aurora-a" style={{ background: "rgba(91,143,160,0.11)", top: 340, left: -120, animation: "sgAurora 18s ease-in-out infinite reverse" }} />

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
                  <History className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight sg-sora" style={{ color: C.text }}>
                    Mon <span className="sg-gradient-text">Historique</span>
                  </h1>
                  <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                    {vitals.length} mesure{vitals.length !== 1 ? "s" : ""} sur la période sélectionnée
                  </p>
                </div>
              </div>

              {/* ── Period chips ── */}
              <div className="flex gap-2 flex-wrap">
                {(["1h", "24h", "7j", "30j"] as Period[]).map(p => (
                  <button key={p} onClick={() => handlePeriod(p)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={
                      period === p
                        ? {
                            background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                            color: "#fff",
                            border: `1px solid ${C.primary}`,
                            boxShadow: `0 6px 18px rgba(74,157,135,0.35)`,
                          }
                        : {
                            background: "rgba(255,255,255,0.65)",
                            color: C.textSoft,
                            border: "1px solid rgba(74,157,135,0.18)",
                          }
                    }>
                    <Calendar className="w-3 h-3" /> {p}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
            </div>
          ) : vitals.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-3" style={glass}>
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 12px 28px rgba(74,157,135,0.30)",
                }}>
                <History className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold sg-sora" style={{ color: C.text }}>Aucune donnée</p>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>Aucune mesure sur cette période</p>
              </div>
            </motion.div>
          ) : (
            <>
              {/* ── Stats ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {STATS.map((s, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="sg-card p-5"
                    style={{ ...glass, borderLeft: `3px solid ${s.color}` }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.textSoft }}>
                      {s.label}
                    </p>
                    <p className="text-2xl font-bold sg-sora" style={{ color: s.color }}>
                      {s.value ?? "—"}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>{s.unit}</p>
                  </motion.div>
                ))}
              </div>

              {/* ── BPM Chart ── */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="sg-card p-6" style={glass}>
                <div className="mb-5">
                  <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>
                    Fréquence Cardiaque
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>Évolution sur la période</p>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,157,135,0.12)" />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: C.textSoft }} stroke="transparent" interval="preserveStartEnd" />
                    <YAxis domain={[40, 160]} tick={{ fontSize: 10, fill: C.textSoft }} stroke="transparent" />
                    <Tooltip contentStyle={{
                      background: "rgba(255,255,255,0.92)",
                      border: "1px solid rgba(74,157,135,0.20)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      boxShadow: "0 8px 24px rgba(30,60,50,0.08)",
                    }} />
                    <ReferenceLine y={100} stroke={C.gold} strokeDasharray="4 4"
                      label={{ value: "Max normal", fontSize: 9, fill: C.gold }} />
                    <ReferenceLine y={60} stroke={C.gold} strokeDasharray="4 4"
                      label={{ value: "Min normal", fontSize: 9, fill: C.gold }} />
                    <Line type="monotone" dataKey="BPM" stroke={C.primary}
                      strokeWidth={2.5} dot={false} activeDot={{ r: 3, fill: C.primary }} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>

              {/* ── SpO2 Chart ── */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="sg-card p-6" style={glass}>
                <div className="mb-5">
                  <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>SpO2</h3>
                  <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>Évolution sur la période</p>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,157,135,0.12)" />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: C.textSoft }} stroke="transparent" interval="preserveStartEnd" />
                    <YAxis domain={[80, 100]} tick={{ fontSize: 10, fill: C.textSoft }} stroke="transparent" />
                    <Tooltip contentStyle={{
                      background: "rgba(255,255,255,0.92)",
                      border: "1px solid rgba(91,143,160,0.20)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      boxShadow: "0 8px 24px rgba(30,60,50,0.08)",
                    }} />
                    <ReferenceLine y={95} stroke={C.gold} strokeDasharray="4 4"
                      label={{ value: "Seuil alerte", fontSize: 9, fill: C.gold }} />
                    <Line type="monotone" dataKey="SpO2" stroke={C.secondary}
                      strokeWidth={2.5} dot={false} activeDot={{ r: 3, fill: C.secondary }} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientHistory;