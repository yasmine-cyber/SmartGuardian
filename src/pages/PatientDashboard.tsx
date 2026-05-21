import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Loader, Lightbulb, BarChart2, ShieldCheck, TrendingUp, AlertCircle, MapPin, Navigation, WifiOff } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import VitalCard from "@/components/VitalCard";
import StatusBadge from "@/components/StatusBadge";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

import L from "leaflet";

// Fix Leaflet's default icon paths when bundled with Vite / Webpack
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon   from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

interface VitalSigns {
  bpm: number | null;
  spo2: number | null;
  temperature: number | null;
  chute: boolean | null;
  recorded_at: string;
  latitude: number | null;
  longitude: number | null;
}

interface LastKnownLocation {
  lat: number;
  lng: number;
  recorded_at: string;
  isLive: boolean;
}

interface Alerte {
  id: string;
  severity: string;
  message: string;
  created_at: string;
  resolved: boolean;
}

// ─── Palette synced with landing page ───────────────────────────────────────
const C = {
  primary:     "#4a9d87",
  primaryDark: "#3d8c7a",
  secondary:   "#5b8fa0",
  cream:       "#f0ede6",
  beige:       "#e4ede8",
  text:        "#1a2e28",
  textSoft:    "rgba(30,60,50,0.62)",
  gold:        "#d4a843",
  muted:       "#c0504a",
};

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

const SEVERITY_MAP: Record<string, { label: string; uiStatus: string; color: string; bg: string }> = {
  CRITICAL: { label: "Critique",  uiStatus: "critical", color: C.muted,     bg: "rgba(192,80,74,0.10)" },
  HIGH:     { label: "Élevée",    uiStatus: "elevated", color: "#d4843a",   bg: "rgba(212,132,58,0.10)" },
  MEDIUM:   { label: "Modérée",   uiStatus: "elevated", color: C.gold,      bg: "rgba(212,168,67,0.12)" },
  LOW:      { label: "Faible",    uiStatus: "normal",   color: C.primary,   bg: "rgba(74,157,135,0.10)" },
};

// ─── Reusable visual primitives ─────────────────────────────────────────────
const glass = {
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.16)",
  borderRadius: "22px",
  boxShadow: "0 12px 36px rgba(30,60,50,0.06)",
} as React.CSSProperties;


const PatientDashboard = () => {
  const [userName, setUserName]                   = useState<string | null>(null);
  const [vitals, setVitals]                       = useState<VitalSigns | null>(null);
  const [alertes, setAlertes]                     = useState<Alerte[]>([]);
  const [weeklyAlertes, setWeeklyAlertes]         = useState<Alerte[]>([]);
  const [deviceId, setDeviceId]                   = useState<string | null>(null);
  const [patientId, setPatientId]                 = useState<string | null>(null);
  const [loadingVitals, setLoadingVitals]         = useState(true);
  const [lastKnownLocation, setLastKnownLocation] = useState<LastKnownLocation | null>(null);
  const navigate = useNavigate();

  // Leaflet map refs — managed imperatively to avoid re-renders
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef  = useRef<L.Map | null>(null);
  const markerRef       = useRef<L.Marker | null>(null);
  const pulseMarkerRef  = useRef<L.CircleMarker | null>(null);

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

  // ── Helper: update lastKnownLocation from a vitals row (only if coords present) ──
  const maybeUpdateLocation = (data: VitalSigns) => {
    if (data.latitude !== null && data.longitude !== null) {
      const isLive = (Date.now() - new Date(data.recorded_at).getTime()) < 30 * 60 * 1000;
      setLastKnownLocation({ lat: data.latitude, lng: data.longitude, recorded_at: data.recorded_at, isLive });
    }
  };

  // ── Fetch the most recent vital_signs row that actually has GPS coords ────
  const fetchLastKnownLocation = async (devId: string) => {
    const { data } = await supabase
      .from("vital_signs")
      .select("latitude, longitude, recorded_at")
      .eq("device_id", devId)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const isLive = (Date.now() - new Date(data.recorded_at).getTime()) < 30 * 60 * 1000;
      setLastKnownLocation({
        lat: data.latitude,
        lng: data.longitude,
        recorded_at: data.recorded_at,
        isLive,
      });
    }
  };

  // ── Fetch the latest vitals row (may or may not have GPS) ─────────────────
  const fetchLatestVitals = async (devId?: string) => {
    if (!devId) return;
    const { data } = await supabase
      .from("vital_signs")
      .select("bpm, spo2, temperature, chute, recorded_at, latitude, longitude")
      .eq("device_id", devId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();
    if (data) {
      setVitals(data);
      maybeUpdateLocation(data); // updates location only if this row has coords
    }
  };

  // ── Main init ─────────────────────────────────────────────────────────────
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

      if (device) {
        setDeviceId(device.id);
        // Fetch last GPS position (searches all rows, not just the latest)
        await fetchLastKnownLocation(device.id);
      }

      // Fetch latest vitals row (will also update location if that row has coords)
      await fetchLatestVitals(device?.id);

      const { data: alertesData } = await supabase
        .from("alerts")
        .select("id, severity, message, created_at, resolved")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (alertesData) setAlertes(alertesData);

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

  // ── Realtime vitals ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!deviceId) return;
    const ch = supabase.channel("vital_signs_realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "vital_signs", filter: `device_id=eq.${deviceId}` },
        (payload) => {
          const newVitals = payload.new as VitalSigns;
          setVitals(newVitals);
          maybeUpdateLocation(newVitals);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [deviceId]);

  // ── Realtime alerts ───────────────────────────────────────────────────────
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

  // ── Initialise Leaflet map once the container is mounted ──────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center:          [36.8065, 10.1815],
      zoom:            13,
      zoomControl:     true,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ── Update marker whenever lastKnownLocation changes ─────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !lastKnownLocation) return;

    const latlng: L.LatLngExpression = [lastKnownLocation.lat, lastKnownLocation.lng];

    if (markerRef.current) {
      markerRef.current.setLatLng(latlng);
    } else {
      markerRef.current = L.marker(latlng)
        .addTo(map)
        .bindPopup(`<b>Dernière position connue</b><br/>${new Date(lastKnownLocation.recorded_at).toLocaleString("fr-FR")}`);
    }

    const circleColor = lastKnownLocation.isLive ? C.primary : C.gold;
    if (pulseMarkerRef.current) {
      pulseMarkerRef.current.setLatLng(latlng);
      pulseMarkerRef.current.setStyle({ color: circleColor, fillColor: circleColor });
    } else {
      pulseMarkerRef.current = L.circleMarker(latlng, {
        radius: 18, color: circleColor, fillColor: circleColor,
        fillOpacity: 0.15, weight: 2,
      }).addTo(map);
    }

    map.flyTo(latlng, 15, { duration: 1.4, easeLinearity: 0.25 });
  }, [lastKnownLocation]);

  const formatTime = (dateStr: string) => {
    const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`;
    return "Hier";
  };

  const overallStatus = getOverallStatus();
  const tips          = HEALTH_TIPS[overallStatus] ?? HEALTH_TIPS.stable;
  const todayTip      = tips[Math.floor(Date.now() / 86_400_000) % tips.length];

  const critCount = weeklyAlertes.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH").length;
  const medCount  = weeklyAlertes.filter((a) => a.severity === "MEDIUM").length;
  const lowCount  = weeklyAlertes.filter((a) => a.severity === "LOW").length;

  const overallChipColor =
    overallStatus === "stable"    ? { bg: "rgba(74,157,135,0.10)",  fg: C.primaryDark, br: "rgba(74,157,135,0.25)" } :
    overallStatus === "attention" ? { bg: "rgba(212,168,67,0.12)",  fg: "#a8821f",     br: "rgba(212,168,67,0.30)" } :
    overallStatus === "critical"  ? { bg: "rgba(192,80,74,0.10)",   fg: C.muted,       br: "rgba(192,80,74,0.28)" } :
                                    { bg: "rgba(91,143,160,0.10)",  fg: C.secondary,   br: "rgba(91,143,160,0.25)" };

  const locationIsLive = lastKnownLocation?.isLive ?? false;
  const locationLabel  = !lastKnownLocation
    ? "Position inconnue"
    : locationIsLive
      ? "Position en temps réel"
      : `Dernière position connue — ${formatTime(lastKnownLocation.recorded_at)}`;

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
        .sg-card { transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s; }
        .sg-card:hover { transform: translateY(-4px); box-shadow: 0 22px 50px rgba(30,60,50,0.10); }
        @keyframes sgAurora { 0%,100%{transform:translate(0,0) scale(1);opacity:.55} 50%{transform:translate(30px,-20px) scale(1.06);opacity:.85} }
        .sg-aurora-a { position:absolute; width:420px; height:420px; border-radius:50%; filter:blur(80px); pointer-events:none; }
        .sg-map-wrap .leaflet-container { border-radius: 16px; height: 100%; width: 100%; z-index: 0; }
        @keyframes sgPulseDot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.6); opacity: 0.5; } }
        .sg-live-dot { animation: sgPulseDot 1.8s ease-in-out infinite; }
      `}</style>

      <div className="sg-page relative" style={{ minHeight: "100%" }}>
        <div className="sg-aurora-a" style={{ background: "rgba(74,157,135,0.18)", top: -120, left: -80, animation: "sgAurora 18s ease-in-out infinite" }} />
        <div className="sg-aurora-a" style={{ background: "rgba(91,143,160,0.15)", top: 200, right: -100, animation: "sgAurora 22s ease-in-out infinite reverse" }} />

        <div className="relative space-y-6 max-w-6xl">

          {/* ── Greeting ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between flex-wrap gap-4 p-6 rounded-3xl"
            style={glass}>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: C.text }}>
                Bonjour{userName ? <>, <span className="sg-gradient-text">{userName}</span></> : ""}
              </h1>
              <p className="text-sm mt-1.5" style={{ color: C.textSoft }}>
                {vitals
                  ? `Dernière mesure : ${formatTime(vitals.recorded_at)}`
                  : "En attente de données du capteur..."}
              </p>
            </div>
            <div className="px-4 py-2 rounded-full text-xs font-semibold border flex items-center gap-2"
              style={{ background: overallChipColor.bg, color: overallChipColor.fg, borderColor: overallChipColor.br }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: overallChipColor.fg }} />
              <StatusBadge status={overallStatus as any} size="sm" />
            </div>
          </motion.div>

          {/* ── Vital cards ── */}
          {loadingVitals ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                className="sg-card p-5 relative overflow-hidden" style={{ ...glass, borderLeft: `3px solid ${C.primary}` }}>
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full" style={{ background: "rgba(74,157,135,0.10)" }} />
                <div className="flex items-center justify-between relative">
                  <span className="text-xs font-medium" style={{ color: C.textSoft }}>Fréquence Cardiaque</span>
                  <span className="text-xl">❤️</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold sg-sora" style={{ color: C.text }}>{vitals?.bpm ?? "—"}</span>
                  <span className="text-xs font-medium" style={{ color: C.textSoft }}>BPM</span>
                </div>
                <div className="mt-3 h-1 rounded-full" style={{ background: "rgba(74,157,135,0.12)" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(((vitals?.bpm ?? 0) / 200) * 100, 100)}%`, background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})` }} />
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="sg-card p-5 relative overflow-hidden" style={{ ...glass, borderLeft: `3px solid ${C.secondary}` }}>
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full" style={{ background: "rgba(91,143,160,0.10)" }} />
                <div className="flex items-center justify-between relative">
                  <span className="text-xs font-medium" style={{ color: C.textSoft }}>SpO₂</span>
                  <span className="text-xl">🩸</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold sg-sora" style={{ color: C.text }}>{vitals?.spo2 ?? "—"}</span>
                  <span className="text-xs font-medium" style={{ color: C.textSoft }}>%</span>
                </div>
                <div className="mt-3">
                  <svg viewBox="0 0 36 36" className="w-10 h-10">
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke={C.secondary} strokeWidth="3"
                      strokeDasharray={`${vitals?.spo2 ?? 0}, 100`} strokeLinecap="round" />
                  </svg>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="sg-card p-5 relative overflow-hidden" style={{ ...glass, borderLeft: `3px solid ${C.gold}` }}>
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full" style={{ background: "rgba(212,168,67,0.10)" }} />
                <div className="flex items-center justify-between relative">
                  <span className="text-xs font-medium" style={{ color: C.textSoft }}>Température</span>
                  <span className="text-xl">🌡️</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold sg-sora" style={{ color: C.text }}>{vitals?.temperature?.toFixed(1) ?? "—"}</span>
                  <span className="text-xs font-medium" style={{ color: C.textSoft }}>°C</span>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="sg-card p-5 relative overflow-hidden"
                style={{ ...glass, borderLeft: `3px solid ${vitals?.chute ? C.muted : C.primary}` }}>
                <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full"
                  style={{ background: vitals?.chute ? "rgba(192,80,74,0.10)" : "rgba(74,157,135,0.10)" }} />
                <div className="flex items-center justify-between relative">
                  <span className="text-xs font-medium" style={{ color: C.textSoft }}>
                    {vitals?.chute ? "Chute Détectée !" : "Statut Capteur"}
                  </span>
                  <span className="text-xl">{vitals?.chute ? "🚨" : "🧠"}</span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold sg-sora" style={{ color: vitals?.chute ? C.muted : C.text }}>
                    {vitals?.chute ? "ALERTE" : "Normal"}
                  </span>
                </div>
                <p className="text-xs mt-2" style={{ color: C.textSoft }}>
                  {vitals?.chute ? "⚠️ Chute détectée — secours alertés" : "Aucune chute détectée"}
                </p>
              </motion.div>
            </div>
          )}

          {/* ── Analyse + Alertes ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="sg-card p-6" style={glass}>
              <h3 className="text-sm font-semibold mb-4 sg-sora flex items-center gap-2" style={{ color: C.text }}>
                <span className="w-1 h-4 rounded-full" style={{ background: `linear-gradient(180deg, ${C.primary}, ${C.secondary})` }} />
                Analyse des Constantes
              </h3>
              <div className="space-y-2.5">
                {[
                  { label: "BPM",         val: vitals?.bpm         ? `${vitals.bpm} BPM`               : "—", status: getBpmStatus(vitals?.bpm ?? null) },
                  { label: "SpO₂",        val: vitals?.spo2        ? `${vitals.spo2} %`                : "—", status: getSpo2Status(vitals?.spo2 ?? null) },
                  { label: "Température", val: vitals?.temperature ? `${vitals.temperature.toFixed(1)} °C` : "—", status: getTempStatus(vitals?.temperature ?? null) },
                ].map(({ label, val, status }) => (
                  <div key={label} className="flex justify-between items-center rounded-xl p-3"
                    style={{ background: "rgba(244,242,237,0.5)", border: "1px solid rgba(74,157,135,0.08)" }}>
                    <span className="text-xs font-medium" style={{ color: C.textSoft }}>{label}</span>
                    <span className="text-sm font-semibold"
                      style={{ color: status === "safe" ? C.primary : status === "elevated" ? C.gold : C.muted }}>
                      {val}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between items-center rounded-xl p-3"
                  style={{ background: "rgba(244,242,237,0.5)", border: "1px solid rgba(74,157,135,0.08)" }}>
                  <span className="text-xs font-medium" style={{ color: C.textSoft }}>Dernière mesure</span>
                  <span className="text-xs" style={{ color: C.text }}>{vitals ? formatTime(vitals.recorded_at) : "—"}</span>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="sg-card p-6" style={glass}>
              <h3 className="text-sm font-semibold mb-4 sg-sora flex items-center gap-2" style={{ color: C.text }}>
                <span className="w-1 h-4 rounded-full" style={{ background: `linear-gradient(180deg, ${C.muted}, ${C.gold})` }} />
                Alertes Récentes
              </h3>
              {alertes.length === 0 ? (
                <div className="text-center py-10 text-sm flex flex-col items-center gap-2" style={{ color: C.textSoft }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(74,157,135,0.12)" }}>
                    <span className="text-xl">✅</span>
                  </div>
                  Aucune alerte récente
                </div>
              ) : (
                <div className="space-y-2.5">
                  {alertes.map((a) => {
                    const sev = SEVERITY_MAP[a.severity] ?? SEVERITY_MAP.LOW;
                    return (
                      <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl"
                        style={{ background: sev.bg, borderLeft: `3px solid ${sev.color}`, border: `1px solid ${sev.color}25` }}>
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 animate-pulse" style={{ background: sev.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium" style={{ color: C.text }}>{a.message}</p>
                          <p className="text-xs mt-1" style={{ color: C.textSoft }}>
                            {formatTime(a.created_at)} • <span style={{ color: sev.color, fontWeight: 600 }}>{sev.label}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>

          {/* ── Conseil santé + Résumé semaine ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="sg-card p-6 relative overflow-hidden" style={glass}>
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none"
                style={{ background: "rgba(212,168,67,0.10)", filter: "blur(40px)", transform: "translate(30%,-30%)" }} />
              <div className="flex items-center gap-2 mb-4 relative">
                <Lightbulb className="w-4 h-4" style={{ color: C.gold }} />
                <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>Conseil du jour</h3>
              </div>
              <div className="rounded-2xl p-5 space-y-2 relative"
                style={{ background: "linear-gradient(135deg, rgba(74,157,135,0.08) 0%, rgba(91,143,160,0.06) 100%)", border: "1px solid rgba(74,157,135,0.18)" }}>
                <p className="text-2xl">{todayTip.icon}</p>
                <p className="text-base font-semibold sg-sora" style={{ color: C.text }}>{todayTip.title}</p>
                <p className="text-sm leading-relaxed" style={{ color: C.textSoft }}>{todayTip.body}</p>
              </div>
              <div className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium"
                style={{ background: overallChipColor.bg, color: overallChipColor.fg, border: `1px solid ${overallChipColor.br}` }}>
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                {overallStatus === "stable"    && "Toutes vos constantes sont dans les normes."}
                {overallStatus === "attention" && "Certaines constantes méritent votre attention."}
                {overallStatus === "critical"  && "Consultez votre médecin dès que possible."}
                {overallStatus === "offline"   && "Capteur non détecté — vérifiez le port du dispositif."}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              className="sg-card p-6" style={glass}>
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4" style={{ color: C.primary }} />
                <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>Résumé des 7 derniers jours</h3>
              </div>
              {weeklyAlertes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(74,157,135,0.12)" }}>
                    <TrendingUp className="w-7 h-7" style={{ color: C.primary }} />
                  </div>
                  <p className="text-sm font-semibold sg-sora" style={{ color: C.text }}>Aucune alerte cette semaine</p>
                  <p className="text-xs" style={{ color: C.textSoft }}>Continuez ainsi, votre suivi est excellent.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ background: "linear-gradient(135deg, rgba(74,157,135,0.10), rgba(91,143,160,0.08))", border: "1px solid rgba(74,157,135,0.18)" }}>
                    <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: C.textSoft }}>
                      <AlertCircle className="w-3.5 h-3.5" /> Total alertes
                    </span>
                    <span className="text-lg font-bold sg-sora sg-gradient-text">{weeklyAlertes.length}</span>
                  </div>
                  {[
                    { label: "Critiques / Élevées", count: critCount, color: C.muted },
                    { label: "Modérées",            count: medCount,  color: C.gold },
                    { label: "Faibles",             count: lowCount,  color: C.primary },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span style={{ color: C.textSoft }}>{label}</span>
                        <span className="font-semibold sg-sora" style={{ color }}>{count}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: `${color}15` }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: weeklyAlertes.length ? `${(count / weeklyAlertes.length) * 100}%` : "0%", background: `linear-gradient(90deg, ${color}, ${color}cc)` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* ── Localisation OpenStreetMap ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
            className="sg-card p-6 relative overflow-hidden" style={glass}>
            <div className="absolute bottom-0 right-0 w-56 h-56 rounded-full pointer-events-none"
              style={{ background: "rgba(74,157,135,0.08)", filter: "blur(50px)", transform: "translate(30%, 30%)" }} />

            <div className="flex items-center justify-between mb-4 relative">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: C.primary }} />
                <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>Localisation du Patient</h3>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border"
                style={{
                  background:   !lastKnownLocation ? "rgba(91,143,160,0.10)" : locationIsLive ? "rgba(74,157,135,0.10)" : "rgba(212,168,67,0.12)",
                  color:        !lastKnownLocation ? C.secondary              : locationIsLive ? C.primaryDark           : "#a8821f",
                  borderColor:  !lastKnownLocation ? "rgba(91,143,160,0.25)" : locationIsLive ? "rgba(74,157,135,0.25)" : "rgba(212,168,67,0.30)",
                }}>
                {!lastKnownLocation ? (
                  <><WifiOff className="w-3 h-3" /> Position inconnue</>
                ) : locationIsLive ? (
                  <><span className="w-1.5 h-1.5 rounded-full sg-live-dot" style={{ background: C.primary }} /> En direct</>
                ) : (
                  <><Navigation className="w-3 h-3" /> Dernière connue</>
                )}
              </div>
            </div>

            {lastKnownLocation && (
              <div className="mb-3 flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl w-fit"
                style={{ background: "rgba(74,157,135,0.08)", color: C.textSoft, border: "1px solid rgba(74,157,135,0.12)" }}>
                <Navigation className="w-3 h-3 shrink-0" style={{ color: C.primary }} />
                <span className="font-mono">{lastKnownLocation.lat.toFixed(5)}, {lastKnownLocation.lng.toFixed(5)}</span>
                <span style={{ color: C.textSoft }}>•</span>
                <span>{locationLabel}</span>
              </div>
            )}

            <div className="sg-map-wrap relative overflow-hidden rounded-2xl"
              style={{ height: 320, border: "1px solid rgba(74,157,135,0.18)", background: "rgba(240,237,230,0.4)" }}>
              {!lastKnownLocation && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl"
                  style={{ background: "rgba(240,237,230,0.85)", backdropFilter: "blur(6px)" }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(91,143,160,0.14)" }}>
                    <MapPin className="w-7 h-7" style={{ color: C.secondary }} />
                  </div>
                  <p className="text-sm font-semibold sg-sora" style={{ color: C.text }}>Position GPS non disponible</p>
                  <p className="text-xs text-center max-w-xs" style={{ color: C.textSoft }}>
                    Le capteur n'a pas encore transmis de coordonnées GPS. La carte s'actualisera automatiquement dès réception.
                  </p>
                </div>
              )}
              <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
            </div>

            <p className="mt-3 text-xs" style={{ color: C.textSoft }}>
              {locationIsLive
                ? "🟢 Position mise à jour en temps réel via le capteur."
                : lastKnownLocation
                  ? `🟡 Position non actualisée depuis ${formatTime(lastKnownLocation.recorded_at)}. La carte affiche la dernière position reçue.`
                  : "⚪ En attente du premier signal GPS du capteur."}
            </p>
          </motion.div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientDashboard;