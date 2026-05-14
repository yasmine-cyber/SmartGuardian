import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader, Lightbulb, BarChart2, ShieldCheck, TrendingUp, AlertCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import VitalCard from "@/components/VitalCard";
import StatusBadge from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

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

// ─── Health tips keyed by overall status ────────────────────────────────────
const HEALTH_TIPS: Record<string, { icon: string; title: string; body: string }[]> = {
  stable: [
    { icon: "💧", title: "Hydratation", body: "Pensez à boire au moins 1,5 L d'eau par jour pour maintenir une bonne circulation sanguine." },
    { icon: "🚶", title: "Activité légère", body: "Une marche de 20 minutes par jour contribue à stabiliser votre fréquence cardiaque au repos." },
    { icon: "😴", title: "Sommeil", body: "Un sommeil régulier de 7 à 8 heures favorise la récupération cardiovasculaire." },
  ],
  attention: [
    { icon: "🧘", title: "Respirez", body: "Essayez la respiration 4-7-8 : inspirez 4 s, retenez 7 s, expirez 8 s. Cela abaisse la fréquence cardiaque." },
    { icon: "🪑", title: "Repos", body: "Vos constantes nécessitent votre attention. Évitez les efforts intenses jusqu'à votre prochaine consultation." },
  ],
  critical: [
    { icon: "📞", title: "Contactez votre médecin", body: "Vos constantes indiquent une situation qui mérite une attention médicale rapide. Contactez votre médecin dès que possible." },
  ],
  offline: [
    { icon: "🔋", title: "Capteur hors ligne", body: "Assurez-vous que votre capteur est chargé et porté correctement pour bénéficier du suivi en temps réel." },
  ],
};

// ─── Severity mapping: DB enum → UI label ───────────────────────────────────
// DB enum: LOW, MEDIUM, HIGH, CRITICAL
const SEVERITY_MAP: Record<string, { label: string; uiStatus: string }> = {
  CRITICAL: { label: "Critique",  uiStatus: "critical" },
  HIGH:     { label: "Élevée",    uiStatus: "elevated" },
  MEDIUM:   { label: "Modérée",   uiStatus: "elevated" },
  LOW:      { label: "Faible",    uiStatus: "normal" },
};

const PatientDashboard = () => {
  const [userName, setUserName]       = useState<string | null>(null);
  const [vitals, setVitals]           = useState<VitalSigns | null>(null);
  const [alertes, setAlertes]         = useState<Alerte[]>([]);
  const [weeklyAlertes, setWeeklyAlertes] = useState<Alerte[]>([]);
  const [deviceId, setDeviceId]       = useState<string | null>(null);
  const [patientId, setPatientId]     = useState<string | null>(null);
  const [loadingVitals, setLoadingVitals] = useState(true);
  const navigate = useNavigate();

  // ── Status helpers ──────────────────────────────────────────────────────────
  const getBpmStatus  = (v: number | null) => !v ? "safe" : v > 120 || v < 40 ? "critical" : v > 100 || v < 50 ? "elevated" : "safe";
  const getSpo2Status = (v: number | null) => !v ? "safe" : v < 90 ? "critical" : v < 95 ? "elevated" : "safe";
  const getTempStatus = (v: number | null) => !v ? "safe" : v > 39.5 || v < 35 ? "critical" : v > 37.5 ? "elevated" : "safe";

  const getOverallStatus = (): "stable" | "attention" | "critical" | "offline" => {
    if (!vitals) return "offline";
    const s = [getBpmStatus(vitals.bpm), getSpo2Status(vitals.spo2), getTempStatus(vitals.temperature)];
    if (s.includes("critical") || vitals.chute) return "critical";
    if (s.includes("elevated")) return "attention";
    return "stable";
  };

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patientRow } = await supabase
        .from("patients").select("id").eq("user_id", user.id).single();
      if (!patientRow) { navigate("/checkout"); return; }

      const { data: req } = await supabase
        .from("device_requests")
        .select("status, payment_status, device_id")
        .eq("patient_id", patientRow.id)
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();

      if (!req || req.payment_status !== "paid") { navigate("/checkout"); return; }
      if (req.status === "pending") { navigate("/pending"); return; }
      if (req.status === "approved" && req.device_id) {
        const { data: device } = await supabase.from("devices").select("actif").eq("id", req.device_id).single();
        if (!device?.actif) { navigate("/pending"); return; }
      }
      if (req.status === "rejected") { navigate("/checkout"); return; }

      const { data: util } = await supabase
        .from("utilisateurs").select("nom, prenom").eq("id", user.id).single();
      if (util) setUserName([util.prenom, util.nom].filter(Boolean).join(" ").trim() || util.nom || "");

      const { data: patient } = await supabase
        .from("patients").select("id").eq("user_id", user.id).single();
      if (!patient) return;
      setPatientId(patient.id);

      const { data: device } = await supabase
        .from("devices").select("id").eq("patient_id", patient.id).eq("actif", true).single();
      if (device) setDeviceId(device.id);

      await fetchLatestVitals(device?.id);

      // Fetch recent alerts (5 most recent for display)
      const { data: alertesData } = await supabase
        .from("alerts")
        .select("id, severity, message, created_at, resolved")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (alertesData) setAlertes(alertesData);

      // Fetch ALL alerts from last 7 days for the summary widget
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: weeklyData } = await supabase
        .from("alerts")
        .select("id, severity, message, created_at, resolved")
        .eq("patient_id", patient.id)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false });
      if (weeklyData) setWeeklyAlertes(weeklyData);

      setLoadingVitals(false);
    };
    init();
  }, []);

  const fetchLatestVitals = async (devId?: string) => {
    if (!devId) return;
    const { data } = await supabase
      .from("vital_signs")
      .select("bpm, spo2, temperature, chute, recorded_at")
      .eq("device_id", devId)
      .order("recorded_at", { ascending: false })
      .limit(1).single();
    if (data) setVitals(data);
  };

  useEffect(() => {
    if (!deviceId) return;
    const ch = supabase.channel("vital_signs_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "vital_signs", filter: `device_id=eq.${deviceId}` },
        (payload) => setVitals(payload.new as VitalSigns))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [deviceId]);

  useEffect(() => {
    if (!patientId) return;
    const ch = supabase.channel("alertes_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts", filter: `patient_id=eq.${patientId}` },
        (payload) => {
          const newAlert = payload.new as Alerte;
          setAlertes((prev) => [newAlert, ...prev].slice(0, 5));
          const oneWeekAgo = Date.now() - 7 * 86_400_000;
          if (new Date(newAlert.created_at).getTime() > oneWeekAgo) {
            setWeeklyAlertes((prev) => [newAlert, ...prev]);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [patientId]);

  const formatTime = (dateStr: string) => {
    const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`;
    return "Hier";
  };

  // ── Derived data for new widgets ────────────────────────────────────────────
  const overallStatus = getOverallStatus();

  // Pick a daily tip (rotates by day-of-year so it feels fresh)
  const tips = HEALTH_TIPS[overallStatus] ?? HEALTH_TIPS.stable;
  const todayTip = tips[Math.floor(Date.now() / 86_400_000) % tips.length];

  // Weekly alert summary — FIXED: uses DB enum values LOW, MEDIUM, HIGH, CRITICAL
  const critCount  = weeklyAlertes.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH").length;
  const medCount   = weeklyAlertes.filter((a) => a.severity === "MEDIUM").length;
  const lowCount   = weeklyAlertes.filter((a) => a.severity === "LOW").length;

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 max-w-6xl">

        {/* ── Greeting ─────────────────────────────────────────────────────── */}
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
          <StatusBadge status={overallStatus as any} size="lg" />
        </motion.div>

        {/* ── Vital cards ───────────────────────────────────────────────────── */}
        {loadingVitals ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <VitalCard icon="❤️" label="Fréquence Cardiaque"
              value={vitals?.bpm?.toString() ?? "—"} unit="BPM"
              status={getBpmStatus(vitals?.bpm ?? null) as any}
              delay={0.1} borderColor="border-l-primary">
              <div className="mt-3 h-1 rounded-full bg-primary/10">
                <div className="h-full rounded-full bg-primary animate-pulse"
                  style={{ width: `${Math.min(((vitals?.bpm ?? 0) / 200) * 100, 100)}%` }} />
              </div>
            </VitalCard>

            <VitalCard icon="🩸" label="SpO2"
              value={vitals?.spo2?.toString() ?? "—"} unit="%"
              status={getSpo2Status(vitals?.spo2 ?? null) as any}
              delay={0.2} borderColor="border-l-safe">
              <div className="mt-3">
                <svg viewBox="0 0 36 36" className="w-10 h-10">
                  <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="hsl(var(--safe))" strokeWidth="3"
                    strokeDasharray={`${vitals?.spo2 ?? 0}, 100`} strokeLinecap="round" />
                </svg>
              </div>
            </VitalCard>

            <VitalCard icon="🌡️" label="Température"
              value={vitals?.temperature?.toFixed(1) ?? "—"} unit="°C"
              status={getTempStatus(vitals?.temperature ?? null) as any}
              delay={0.3} borderColor="border-l-accent" />

            <VitalCard
              icon={vitals?.chute ? "🚨" : "🧠"}
              label={vitals?.chute ? "Chute Détectée !" : "Statut Capteur"}
              value={vitals?.chute ? "ALERTE" : "Normal"} unit=""
              status={vitals?.chute ? "critical" : "safe" as any}
              delay={0.4}
              borderColor={vitals?.chute ? "border-l-destructive" : "border-l-safe"}>
              <p className="text-xs text-muted-foreground mt-2">
                {vitals?.chute ? "⚠️ Chute détectée — secours alertés" : "Aucune chute détectée"}
              </p>
            </VitalCard>
          </div>
        )}

        {/* ── Analyse + Alertes ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Analyse des constantes */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Analyse des Constantes</h3>
            <div className="space-y-3">
              {[
                { label: "BPM", val: vitals?.bpm ? `${vitals.bpm} BPM` : "—", status: getBpmStatus(vitals?.bpm ?? null) },
                { label: "SpO2", val: vitals?.spo2 ? `${vitals.spo2} %` : "—", status: getSpo2Status(vitals?.spo2 ?? null) },
                { label: "Température", val: vitals?.temperature ? `${vitals.temperature.toFixed(1)} °C` : "—", status: getTempStatus(vitals?.temperature ?? null) },
              ].map(({ label, val, status }) => (
                <div key={label} className="flex justify-between items-center bg-muted/50 rounded-xl p-3">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className={`text-sm font-semibold ${status === "safe" ? "text-green-500" : "text-red-500"}`}>{val}</span>
                </div>
              ))}
              <div className="flex justify-between items-center bg-muted/50 rounded-xl p-3">
                <span className="text-xs text-muted-foreground">Dernière mesure</span>
                <span className="text-xs text-foreground">{vitals ? formatTime(vitals.recorded_at) : "—"}</span>
              </div>
            </div>
          </motion.div>

          {/* Alertes récentes */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Alertes Récentes</h3>
            {alertes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">✅ Aucune alerte récente</div>
            ) : (
              <div className="space-y-3">
                {alertes.map((a) => {
                  const sev = SEVERITY_MAP[a.severity] ?? { label: a.severity, uiStatus: "normal" };
                  return (
                    <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                      <StatusBadge status={sev.uiStatus as any} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-card-foreground">{a.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatTime(a.created_at)} • {sev.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── NEW: Conseil santé + Résumé semaine ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Conseil du jour */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-card-foreground">Conseil du jour</h3>
            </div>
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-2">
              <p className="text-lg">{todayTip.icon}</p>
              <p className="text-sm font-semibold text-foreground">{todayTip.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{todayTip.body}</p>
            </div>
            {/* Overall status message */}
            <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${
              overallStatus === "stable"   ? "bg-green-500/10 text-green-600 border-green-500/20" :
              overallStatus === "attention"? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
              overallStatus === "critical" ? "bg-red-500/10 text-red-600 border-red-500/20" :
                                            "bg-muted text-muted-foreground border-border"
            }`}>
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              {overallStatus === "stable"    && "Toutes vos constantes sont dans les normes."}
              {overallStatus === "attention" && "Certaines constantes méritent votre attention."}
              {overallStatus === "critical"  && "Consultez votre médecin dès que possible."}
              {overallStatus === "offline"   && "Capteur non détecté — vérifiez le port du dispositif."}
            </div>
          </motion.div>

          {/* Résumé des 7 derniers jours */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-card-foreground">Résumé des 7 derniers jours</h3>
            </div>

            {weeklyAlertes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                <TrendingUp className="w-8 h-8 text-green-500/60" />
                <p className="text-sm font-medium text-foreground">Aucune alerte cette semaine</p>
                <p className="text-xs text-muted-foreground">Continuez ainsi, votre suivi est excellent.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Total */}
                <div className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-3">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Total alertes
                  </span>
                  <span className="text-sm font-bold text-foreground">{weeklyAlertes.length}</span>
                </div>

                {/* By severity — FIXED mapping */}
                {[
                  { label: "Critiques / Élevées", count: critCount, color: "bg-red-500", track: "bg-red-500/10" },
                  { label: "Modérées",            count: medCount,  color: "bg-yellow-500", track: "bg-yellow-500/10" },
                  { label: "Faibles",             count: lowCount,  color: "bg-blue-500",   track: "bg-blue-500/10" },
                ].map(({ label, count, color, track }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground">{count}</span>
                    </div>
                    <div className={`h-1.5 rounded-full ${track}`}>
                      <div
                        className={`h-full rounded-full ${color} transition-all duration-700`}
                        style={{ width: weeklyAlertes.length ? `${(count / weeklyAlertes.length) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default PatientDashboard;