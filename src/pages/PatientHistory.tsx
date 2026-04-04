import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, Loader, Calendar } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

interface VitalSign {
  bpm: number | null;
  spo2: number | null;
  temperature: number | null;
  recorded_at: string;
}

type Period = "1h" | "24h" | "7j" | "30j";

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

  // Stats
  const bpms = vitals.map(v => v.bpm).filter(Boolean) as number[];
  const spo2s = vitals.map(v => v.spo2).filter(Boolean) as number[];

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const min = (arr: number[]) => arr.length ? Math.min(...arr) : null;
  const max = (arr: number[]) => arr.length ? Math.max(...arr) : null;

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 max-w-6xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="w-6 h-6 text-primary" /> Historique
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {vitals.length} mesures sur la période sélectionnée
          </p>
        </motion.div>

        {/* Période */}
        <div className="flex gap-2 flex-wrap">
          {(["1h", "24h", "7j", "30j"] as Period[]).map(p => (
            <button key={p} onClick={() => handlePeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1 ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}>
              <Calendar className="w-3 h-3" /> {p}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : vitals.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-2xl">
            <History className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Aucune donnée sur cette période</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "BPM moyen", value: avg(bpms), unit: "BPM", color: "text-primary" },
                { label: "BPM min/max", value: `${min(bpms)}/${max(bpms)}`, unit: "BPM", color: "text-muted-foreground" },
                { label: "SpO2 moyen", value: avg(spo2s), unit: "%", color: "text-green-500" },
                { label: "SpO2 min", value: min(spo2s), unit: "%", color: min(spo2s) && min(spo2s)! < 95 ? "text-red-500" : "text-green-500" },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-2xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{s.unit}</p>
                </motion.div>
              ))}
            </div>

            {/* BPM Chart */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-card-foreground mb-4">
                Fréquence Cardiaque
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))"
                    interval="preserveStartEnd" />
                  <YAxis domain={[40, 160]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <ReferenceLine y={100} stroke="orange" strokeDasharray="4 4" label={{ value: "Max normal", fontSize: 9 }} />
                  <ReferenceLine y={60} stroke="orange" strokeDasharray="4 4" label={{ value: "Min normal", fontSize: 9 }} />
                  <Line type="monotone" dataKey="BPM" stroke="hsl(var(--primary))"
                    strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            {/* SpO2 Chart */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-card-foreground mb-4">SpO2</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))"
                    interval="preserveStartEnd" />
                  <YAxis domain={[80, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <ReferenceLine y={95} stroke="orange" strokeDasharray="4 4" label={{ value: "Seuil alerte", fontSize: 9 }} />
                  <Line type="monotone" dataKey="SpO2" stroke="hsl(var(--safe))"
                    strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientHistory;