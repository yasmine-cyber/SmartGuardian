import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Phone, AlertTriangle, Loader } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import VitalCard from "@/components/VitalCard";
import LiveECGChart from "@/components/LiveECGChart";
import StatusBadge from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase";

interface VitalSigns {
  bpm: number | null;
  spo2: number | null;
  temperature: number | null;
  chute: boolean | null;
  recorded_at: string;
}

interface Alerte {
  id: string;
  severity: string;
  message: string;
  created_at: string;
  resolved: boolean;
}

const PatientDashboard = () => {
  const [userName, setUserName] = useState<string | null>(null);
  const [vitals, setVitals] = useState<VitalSigns | null>(null);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [loadingVitals, setLoadingVitals] = useState(true);

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // Déterminer status selon valeurs
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  const getBpmStatus = (bpm: number | null) => {
    if (!bpm) return "safe";
    if (bpm > 120 || bpm < 40) return "critical";
    if (bpm > 100 || bpm < 50) return "elevated";
    return "safe";
  };

  const getSpo2Status = (spo2: number | null) => {
    if (!spo2) return "safe";
    if (spo2 < 90) return "critical";
    if (spo2 < 95) return "elevated";
    return "safe";
  };

  const getTempStatus = (temp: number | null) => {
    if (!temp) return "safe";
    if (temp > 39.5 || temp < 35) return "critical";
    if (temp > 37.5) return "elevated";
    return "safe";
  };

  const getOverallStatus = () => {
    if (!vitals) return "offline";
    const bpmS = getBpmStatus(vitals.bpm);
    const spo2S = getSpo2Status(vitals.spo2);
    const tempS = getTempStatus(vitals.temperature);
    if (bpmS === "critical" || spo2S === "critical" || tempS === "critical" || vitals.chute) return "critical";
    if (bpmS === "elevated" || spo2S === "elevated" || tempS === "elevated") return "attention";
    return "stable";
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // Init : charger user + patient + device
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Nom utilisateur
      const { data: util } = await supabase
        .from("utilisateurs")
        .select("nom, prenom")
        .eq("id", user.id)
        .single();
      if (util) setUserName([util.prenom, util.nom].filter(Boolean).join(" ").trim() || util.nom || "");

      // Patient ID
      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!patient) return;
      setPatientId(patient.id);

      // Device ID lié au patient
      const { data: device } = await supabase
        .from("devices")
        .select("id")
        .eq("patient_id", patient.id)
        .eq("actif", true)
        .single();
      if (device) setDeviceId(device.id);

      // Dernières vitals
      await fetchLatestVitals(device?.id);

      // Alertes récentes
      const { data: alertesData } = await supabase
        .from("alerts")
        .select("id, severity, message, created_at, resolved")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (alertesData) setAlertes(alertesData);

      setLoadingVitals(false);
    };

    init();
  }, []);

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // Fetch dernières vitals
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  const fetchLatestVitals = async (devId?: string) => {
    if (!devId) return;
    const { data } = await supabase
      .from("vital_signs")
      .select("bpm, spo2, temperature, chute, recorded_at")
      .eq("device_id", devId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();
    if (data) setVitals(data);
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // Realtime subscription
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    if (!deviceId) return;

    const channel = supabase
      .channel("vital_signs_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vital_signs",
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          console.log("Nouvelle mesure reçue :", payload.new);
          setVitals(payload.new as VitalSigns);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deviceId]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // Realtime alertes
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    if (!patientId) return;

    const channel = supabase
      .channel("alertes_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          setAlertes((prev) => [payload.new as Alerte, ...prev].slice(0, 5));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━
  // Helpers affichage
  // ━━━━━━━━━━━━━━━━━━━━━━━━
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`;
    return "Hier";
  };

  const SEVERITY_LABELS: Record<string, string> = {
    CRITIQUE: "critical",
    MOYEN: "elevated",
    FAIBLE: "normal",
  };

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 max-w-6xl">

        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Bonjour{userName ? `, ${userName}` : ""}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {vitals
                ? `Dernière mesure : ${formatTime(vitals.recorded_at)}`
                : "En attente de données du capteur..."}
            </p>
          </div>
          <StatusBadge status={getOverallStatus() as any} size="lg" />
        </motion.div>

        {/* Vital cards */}
        {loadingVitals ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* BPM */}
            <VitalCard
              icon="❤️"
              label="Fréquence Cardiaque"
              value={vitals?.bpm?.toString() ?? "—"}
              unit="BPM"
              status={getBpmStatus(vitals?.bpm ?? null) as any}
              delay={0.1}
              borderColor="border-l-primary">
              <div className="mt-3 h-1 rounded-full bg-primary/10">
                <div className="h-full rounded-full bg-primary animate-pulse"
                  style={{ width: `${Math.min(((vitals?.bpm ?? 0) / 200) * 100, 100)}%` }} />
              </div>
            </VitalCard>

            {/* SpO2 */}
            <VitalCard
              icon="🩸"
              label="SpO2"
              value={vitals?.spo2?.toString() ?? "—"}
              unit="%"
              status={getSpo2Status(vitals?.spo2 ?? null) as any}
              delay={0.2}
              borderColor="border-l-safe">
              <div className="mt-3">
                <svg viewBox="0 0 36 36" className="w-10 h-10">
                  <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="hsl(var(--safe))" strokeWidth="3"
                    strokeDasharray={`${vitals?.spo2 ?? 0}, 100`} strokeLinecap="round" />
                </svg>
              </div>
            </VitalCard>

            {/* Température */}
            <VitalCard
              icon="🌡️"
              label="Température"
              value={vitals?.temperature?.toFixed(1) ?? "—"}
              unit="°C"
              status={getTempStatus(vitals?.temperature ?? null) as any}
              delay={0.3}
              borderColor="border-l-accent" />

            {/* Chute */}
            <VitalCard
              icon={vitals?.chute ? "🚨" : "🧠"}
              label={vitals?.chute ? "Chute Détectée !" : "Statut Capteur"}
              value={vitals?.chute ? "ALERTE" : "Normal"}
              unit=""
              status={vitals?.chute ? "critical" : "safe" as any}
              delay={0.4}
              borderColor={vitals?.chute ? "border-l-destructive" : "border-l-safe"}>
              <p className="text-xs text-muted-foreground mt-2">
                {vitals?.chute ? "⚠️ Chute détectée — secours alertés" : "Aucune chute détectée"}
              </p>
            </VitalCard>

          </div>
        )}

        {/* Live chart */}
        <LiveECGChart />

        {/* AI Analysis + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Analyse IA */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Analyse des Constantes</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-muted/50 rounded-xl p-3">
                <span className="text-xs text-muted-foreground">BPM</span>
                <span className={`text-sm font-semibold ${getBpmStatus(vitals?.bpm ?? null) === "safe" ? "text-green-500" : "text-red-500"}`}>
                  {vitals?.bpm ?? "—"} BPM
                </span>
              </div>
              <div className="flex justify-between items-center bg-muted/50 rounded-xl p-3">
                <span className="text-xs text-muted-foreground">SpO2</span>
                <span className={`text-sm font-semibold ${getSpo2Status(vitals?.spo2 ?? null) === "safe" ? "text-green-500" : "text-red-500"}`}>
                  {vitals?.spo2 ?? "—"} %
                </span>
              </div>
              <div className="flex justify-between items-center bg-muted/50 rounded-xl p-3">
                <span className="text-xs text-muted-foreground">Température</span>
                <span className={`text-sm font-semibold ${getTempStatus(vitals?.temperature ?? null) === "safe" ? "text-green-500" : "text-red-500"}`}>
                  {vitals?.temperature?.toFixed(1) ?? "—"} °C
                </span>
              </div>
              <div className="flex justify-between items-center bg-muted/50 rounded-xl p-3">
                <span className="text-xs text-muted-foreground">Dernière mesure</span>
                <span className="text-xs text-foreground">
                  {vitals ? formatTime(vitals.recorded_at) : "—"}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Alertes récentes */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Alertes Récentes</h3>
            {alertes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                ✅ Aucune alerte récente
              </div>
            ) : (
              <div className="space-y-3">
                {alertes.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                    <StatusBadge status={SEVERITY_LABELS[a.severity] as any ?? "normal"} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-card-foreground">{a.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatTime(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Emergency */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Urgence</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-muted rounded-2xl h-48 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Localisation GPS Active</p>
                <p className="text-xs text-muted-foreground">36.7538°N, 3.0588°E</p>
              </div>
            </div>
            <div className="space-y-3">
              <button className="w-full bg-critical text-critical-foreground py-4 rounded-2xl font-bold text-lg hover:brightness-110 transition-all flex items-center justify-center gap-2">
                <AlertTriangle className="w-5 h-5" /> SOS
              </button>
              <button className="w-full bg-muted text-foreground py-3 rounded-2xl text-sm font-medium hover:bg-muted/80 transition-all flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" /> Appeler Contact d'Urgence
              </button>
              <p className="text-xs text-center text-muted-foreground">
                Votre médecin et vos proches seront alertés instantanément
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </DashboardLayout>
  );
};

export default PatientDashboard;