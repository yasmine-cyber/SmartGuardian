import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Loader, ChevronRight, ChevronLeft,
  Activity, Thermometer, Droplets, WifiOff,
  MapPin, MessageSquare, AlertCircle, Heart,
  Save, Trash2, Clock, Zap, Bell,
  UserPlus, Navigation,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon   from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

// ─── Types ────────────────────────────────────────────────────────────────────

type PatientStatus = "online" | "offline" | "alert";

interface LastKnownLocation {
  lat: number;
  lng: number;
  recorded_at: string;
  isLive: boolean;
}

interface Proche {
  patient_user_id: string;
  patient_row_id:  string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  date_naissance: string | null;
  adresse: string | null;
  maladies: string[];
  traitements: string[];
  antecedents: string | null;
  lien_parente: string;
  contact_prioritaire: boolean;
  bpm: number | null;
  spo2: number | null;
  temperature: number | null;
  status: PatientStatus;
  lastUpdate: string | null;
  latitude: number | null;
  longitude: number | null;
  lastKnownLocation: LastKnownLocation | null;
  deviceId: string | null;
}

interface AlertItem {
  id: string;
  message: string;
  severity: string;
  type: string;
  created_at: string;
}

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

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.16)",
  borderRadius: "22px",
  boxShadow: "0 12px 36px rgba(30,60,50,0.06)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<PatientStatus, {
  dot: string; label: string; color: string; bg: string; border: string; ring: string;
}> = {
  online:  { dot: "#22c55e", label: "En ligne",      color: "#16a34a", bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.25)",  ring: "rgba(34,197,94,0.20)"  },
  offline: { dot: "#94a3b8", label: "Hors ligne",    color: "#64748b", bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.22)", ring: "rgba(148,163,184,0.18)" },
  alert:   { dot: C.muted,   label: "Alerte active", color: C.muted,   bg: "rgba(192,80,74,0.10)",  border: "rgba(192,80,74,0.28)",  ring: "rgba(192,80,74,0.18)"  },
};

function normalizeSev(s: string): "critical" | "medium" | "low" {
  const v = (s || "").toUpperCase().trim();
  if (["CRITICAL", "CRITIQUE"].includes(v))              return "critical";
  if (["MEDIUM", "MOYEN", "HIGH", "ELEVE"].includes(v)) return "medium";
  return "low";
}

function timeAgo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60)    return `il y a ${diff}s`;
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

function calcAge(dob: string | null) {
  if (!dob) return "—";
  return `${Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600_000))} ans`;
}

// ─── Map sub-component ────────────────────────────────────────────────────────

interface ProximityMapProps {
  location: LastKnownLocation | null;
  status: PatientStatus;
}

const ProximityMap = ({ location, status }: ProximityMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef  = useRef<L.Map | null>(null);
  const markerRef       = useRef<L.Marker | null>(null);
  const pulseRef        = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [36.8065, 10.1815], zoom: 13,
      zoomControl: true, scrollWheelZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; markerRef.current = null; pulseRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !location) return;
    const latlng: L.LatLngExpression = [location.lat, location.lng];
    const circleColor = location.isLive ? C.primary : C.gold;
    if (markerRef.current) { markerRef.current.setLatLng(latlng); }
    else {
      markerRef.current = L.marker(latlng).addTo(map)
        .bindPopup(`<b>Dernière position connue</b><br/>${new Date(location.recorded_at).toLocaleString("fr-FR")}`);
    }
    if (pulseRef.current) { pulseRef.current.setLatLng(latlng); pulseRef.current.setStyle({ color: circleColor, fillColor: circleColor }); }
    else {
      pulseRef.current = L.circleMarker(latlng, {
        radius: 18, color: circleColor, fillColor: circleColor, fillOpacity: 0.15, weight: 2,
      }).addTo(map);
    }
    map.flyTo(latlng, 15, { duration: 1.4, easeLinearity: 0.25 });
  }, [location]);

  const isLive = location?.isLive ?? false;

  const badgeStyle: React.CSSProperties = !location
    ? { background: "rgba(148,163,184,0.12)", color: "#64748b", border: "1px solid rgba(148,163,184,0.25)" }
    : isLive
      ? { background: "rgba(34,197,94,0.10)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.25)" }
      : { background: "rgba(212,168,67,0.10)", color: C.gold,   border: "1px solid rgba(212,168,67,0.28)" };

  return (
    <div className="p-5 rounded-[22px]" style={glass}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold fp-sora flex items-center gap-2" style={{ color: C.text }}>
          <MapPin className="w-4 h-4" style={{ color: C.primary }} />
          Localisation GPS
        </h3>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full fp-sora" style={badgeStyle}>
          {!location ? (
            <><WifiOff className="w-3 h-3" /> Position inconnue</>
          ) : isLive ? (
            <><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} /> En direct</>
          ) : (
            <><Navigation className="w-3 h-3" /> Dernière connue</>
          )}
        </span>
      </div>

      {location && (
        <div className="mb-3 flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl w-fit"
          style={{ background: "rgba(74,157,135,0.07)", border: "1px solid rgba(74,157,135,0.16)", color: C.textSoft }}>
          <Navigation className="w-3 h-3 shrink-0" style={{ color: C.primary }} />
          <span className="font-mono">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
          <span style={{ color: "rgba(30,60,50,0.25)" }}>•</span>
          <span>{timeAgo(location.recorded_at)}</span>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl" style={{ height: 280, border: "1px solid rgba(74,157,135,0.14)" }}>
        {!location && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.70)", backdropFilter: "blur(8px)" }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(148,163,184,0.12)" }}>
              <MapPin className="w-6 h-6" style={{ color: "#94a3b8" }} />
            </div>
            <p className="text-sm font-semibold fp-sora" style={{ color: C.text }}>Position GPS non disponible</p>
            <p className="text-xs text-center max-w-[220px]" style={{ color: C.textSoft }}>
              {status === "online" ? "Signal GPS en attente…" : "Capteur inactif — aucune position reçue."}
            </p>
          </div>
        )}
        <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
      </div>

      <p className="mt-2.5 text-[11px]" style={{ color: C.textSoft }}>
        {isLive
          ? "🟢 Position mise à jour en temps réel via le capteur."
          : location
            ? `🟡 Position non actualisée depuis ${timeAgo(location.recorded_at)}. Dernière position reçue affichée.`
            : "⚪ En attente du premier signal GPS du capteur."}
      </p>

      {location && (
        <a href={`https://maps.google.com/?q=${location.lat},${location.lng}`}
          target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105 fp-sora"
          style={{ background: "rgba(74,157,135,0.10)", color: C.primaryDark, border: "1px solid rgba(74,157,135,0.22)" }}>
          <MapPin className="w-3.5 h-3.5" /> Ouvrir dans Google Maps
        </a>
      )}
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const FamilyProches = () => {
  const navigate = useNavigate();

  const [proches,  setProches]  = useState<Proche[]>([]);
  const [alerts,   setAlerts]   = useState<Record<string, AlertItem[]>>({});
  const [loading,  setLoading]  = useState(true);
  const [userId,   setUserId]   = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editLien,   setEditLien]   = useState("");
  const [editPrio,   setEditPrio]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);

  const [code,        setCode]        = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError,   setCodeError]   = useState("");
  const [codeSuccess, setCodeSuccess] = useState("");

  const fetchLastKnownLocation = async (devId: string): Promise<LastKnownLocation | null> => {
    const { data } = await supabase.from("vital_signs")
      .select("latitude, longitude, recorded_at")
      .eq("device_id", devId).not("latitude", "is", null).not("longitude", "is", null)
      .order("recorded_at", { ascending: false }).limit(1).single();
    if (!data) return null;
    const isLive = (Date.now() - new Date(data.recorded_at).getTime()) < 30 * 60_000;
    return { lat: data.latitude, lng: data.longitude, recorded_at: data.recorded_at, isLive };
  };

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const { data: links } = await supabase.from("proche_patient")
      .select("patient_id, lien_parente, contact_prioritaire").eq("proche_id", user.id);
    if (!links?.length) { setLoading(false); return; }

    const patientUserIds = links.map((l) => l.patient_id);
    const [{ data: utilisateurs }, { data: patientRows }] = await Promise.all([
      supabase.from("utilisateurs").select("id, nom, prenom, telephone").in("id", patientUserIds),
      supabase.from("patients").select("id, user_id, status, date_naissance, adresse, maladies, traitements, antecedents").in("user_id", patientUserIds),
    ]);

    const enriched: Proche[] = await Promise.all(
      (utilisateurs ?? []).map(async (u) => {
        const link   = links.find((l) => l.patient_id === u.id);
        const patRow = (patientRows ?? []).find((p) => p.user_id === u.id);
        let bpm = null, spo2 = null, temperature = null, lastUpdate = null, latitude = null, longitude = null;
        let deviceId: string | null = null;
        let lastKnownLocation: LastKnownLocation | null = null;

        if (patRow?.id) {
          const { data: device } = await supabase.from("devices").select("id")
            .eq("patient_id", patRow.id).eq("actif", true)
            .order("created_at", { ascending: false }).limit(1).single();
          if (device?.id) {
            deviceId = device.id;
            const { data: vital } = await supabase.from("vital_signs")
              .select("bpm, spo2, temperature, recorded_at, latitude, longitude")
              .eq("device_id", device.id).order("recorded_at", { ascending: false }).limit(1).single();
            if (vital) { bpm = vital.bpm; spo2 = vital.spo2; temperature = vital.temperature; lastUpdate = vital.recorded_at; latitude = vital.latitude; longitude = vital.longitude; }
            lastKnownLocation = await fetchLastKnownLocation(device.id);
            if (latitude !== null && longitude !== null && lastUpdate) {
              const isLive = (Date.now() - new Date(lastUpdate).getTime()) < 30 * 60_000;
              lastKnownLocation = { lat: latitude, lng: longitude, recorded_at: lastUpdate, isLive };
            }
          }
        }

        let status: PatientStatus = "offline";
        if (patRow?.status === "alert") status = "alert";
        else if (lastUpdate && Date.now() - new Date(lastUpdate).getTime() < 5 * 60_000) status = "online";

        return {
          patient_user_id: u.id, patient_row_id: patRow?.id ?? "",
          nom: u.nom, prenom: u.prenom, telephone: u.telephone,
          date_naissance: patRow?.date_naissance ?? null, adresse: patRow?.adresse ?? null,
          maladies: patRow?.maladies ?? [], traitements: patRow?.traitements ?? [],
          antecedents: patRow?.antecedents ?? null,
          lien_parente: link?.lien_parente ?? "", contact_prioritaire: link?.contact_prioritaire ?? false,
          bpm, spo2, temperature, status, lastUpdate, latitude, longitude, lastKnownLocation, deviceId,
        };
      })
    );
    setProches(enriched);

    const pRowIds = (patientRows ?? []).map((p) => p.id).filter(Boolean);
    if (pRowIds.length) {
      const { data: alertData } = await supabase.from("alerts")
        .select("id, message, severity, type, created_at, patient_id")
        .in("patient_id", pRowIds).order("created_at", { ascending: false }).limit(50);
      if (alertData) {
        const byUserId: Record<string, AlertItem[]> = {};
        alertData.forEach((a) => {
          const pr = (patientRows ?? []).find((p) => p.id === a.patient_id);
          if (!pr) return;
          if (!byUserId[pr.user_id]) byUserId[pr.user_id] = [];
          byUserId[pr.user_id].push({ id: a.id, message: a.message, severity: a.severity ?? "", type: a.type ?? "", created_at: a.created_at });
        });
        setAlerts(byUserId);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selected = selectedId ? (proches.find((p) => p.patient_user_id === selectedId) ?? null) : null;

  const openFiche = (id: string) => {
    const p = proches.find((x) => x.patient_user_id === id);
    if (p) { setEditLien(p.lien_parente); setEditPrio(p.contact_prioritaire); }
    setDelConfirm(false); setSelectedId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const closeFiche = () => { setSelectedId(null); setDelConfirm(false); };

  const handleSave = async () => {
    if (!selected || !userId) return;
    setSaving(true);
    const payload = { lien_parente: editLien.trim() || null, contact_prioritaire: editPrio };
    const { data, error } = await supabase.from("proche_patient").update(payload)
      .eq("proche_id", userId).eq("patient_id", selected.patient_user_id).select();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) { toast.error("Mise à jour échouée : vérifiez les permissions Supabase (RLS)."); return; }
    setProches((prev) => prev.map((p) => p.patient_user_id === selected.patient_user_id ? { ...p, lien_parente: editLien.trim(), contact_prioritaire: editPrio } : p));
    toast.success("Lien mis à jour ✓");
  };

  const handleDelete = async () => {
    if (!selected || !userId) return;
    const { error } = await supabase.from("proche_patient").delete()
      .eq("patient_id", selected.patient_user_id).eq("proche_id", userId);
    if (error) { toast.error(error.message); return; }
    setProches((prev) => prev.filter((p) => p.patient_user_id !== selected.patient_user_id));
    toast.success("Lien supprimé");
    closeFiche();
  };

  const handleLinkPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setCodeLoading(true); setCodeError(""); setCodeSuccess("");
    const { data, error } = await supabase.rpc("consume_invite_code", { p_code: c });
    setCodeLoading(false);
    if (error) { setCodeError(error.message || "Code invalide ou expiré."); return; }
    const res = data as { ok?: boolean; error?: string; already_linked?: boolean };
    if (res?.ok === false) { setCodeError(res.error ?? "Code invalide ou expiré."); return; }
    setCode("");
    setCodeSuccess(res.already_linked ? "Déjà lié à ce patient." : "Lien établi ✓");
    load();
  };

  const inFiche = selectedId !== null;

  /* ── Render ── */
  return (
    <DashboardLayout role="family">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .frp-page * { font-family: 'DM Sans', sans-serif; }
        .fp-sora, .frp-page h1, .frp-page h2, .frp-page h3 { font-family: 'Sora', sans-serif !important; }
        .frp-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes frpAurora {
          0%,100% { transform: translate(0,0) scale(1); opacity: .48; }
          50%      { transform: translate(26px,-16px) scale(1.05); opacity: .75; }
        }
        .frp-aurora { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; }
        .frp-card { transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s, border-color .2s; }
        .frp-card:hover { transform: translateY(-2px); box-shadow: 0 18px 44px rgba(30,60,50,0.09); }
        .frp-input {
          width: 100%; padding: 10px 14px; font-size: 0.875rem; border-radius: 14px;
          background: rgba(74,157,135,0.05); border: 1px solid rgba(74,157,135,0.18);
          color: #1a2e28; transition: box-shadow .2s, border-color .2s; outline: none;
          font-family: 'DM Sans', sans-serif;
        }
        .frp-input:focus { border-color: rgba(74,157,135,0.45); box-shadow: 0 0 0 3px rgba(74,157,135,0.14); }
        .frp-input::placeholder { color: rgba(30,60,50,0.32); }
        .frp-page .leaflet-container { border-radius: 16px; }
      `}</style>

      <div className="frp-page relative max-w-4xl space-y-5">

        {/* Aurora blobs */}
        <div className="frp-aurora" style={{ width: 400, height: 400, background: "rgba(74,157,135,0.11)", top: -80, right: -60, animation: "frpAurora 22s ease-in-out infinite" }} />
        <div className="frp-aurora" style={{ width: 300, height: 300, background: "rgba(212,168,67,0.08)", top: 340, left: -100, animation: "frpAurora 18s ease-in-out infinite reverse" }} />

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          {inFiche && (
            <button onClick={closeFiche}
              className="flex items-center gap-1.5 text-sm font-medium mb-3 transition-colors fp-sora"
              style={{ color: C.textSoft }}>
              <ChevronLeft className="w-4 h-4" />
              Retour à mes proches
            </button>
          )}
          <div className="p-6 rounded-3xl relative overflow-hidden" style={glass}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                    boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                  }}>
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight fp-sora" style={{ color: C.text }}>
                    {inFiche && selected
                      ? <span className="frp-gradient-text">{selected.prenom ? `${selected.prenom} ${selected.nom}` : selected.nom}</span>
                      : <>Mes <span className="frp-gradient-text">Proches</span></>}
                  </h1>
                  {!inFiche && (
                    <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                      {proches.length > 0
                        ? `${proches.length} proche${proches.length > 1 ? "s" : ""} — cliquez pour voir la fiche`
                        : "Liez votre premier proche ci-dessous"}
                    </p>
                  )}
                </div>
              </div>
              {inFiche && selected && (
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full fp-sora"
                  style={{
                    background: STATUS_CFG[selected.status].bg,
                    color: STATUS_CFG[selected.status].color,
                    border: `1px solid ${STATUS_CFG[selected.status].border}`,
                  }}>
                  {STATUS_CFG[selected.status].label}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
          </div>
        )}

        {!loading && (
          <AnimatePresence mode="wait">

            {/* ══════════════ LIST VIEW ══════════════ */}
            {!inFiche && (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">

                {/* Empty state */}
                {proches.length === 0 && (
                  <div className="py-14 text-center rounded-[22px]" style={glass}>
                    <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, boxShadow: "0 10px 24px rgba(74,157,135,0.28)" }}>
                      <Heart className="w-7 h-7 text-white" />
                    </div>
                    <p className="text-sm font-semibold fp-sora" style={{ color: C.text }}>Aucun proche lié pour l'instant</p>
                    <p className="text-xs mt-1" style={{ color: C.textSoft }}>Utilisez le code d'invitation ci-dessous</p>
                  </div>
                )}

                {/* Patient grid */}
                {proches.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {proches.map((p, i) => {
                      const sc        = STATUS_CFG[p.status];
                      const initial   = (p.prenom?.[0] ?? p.nom[0]).toUpperCase();
                      const patAlerts = alerts[p.patient_user_id] ?? [];
                      const critCount = patAlerts.filter((a) => normalizeSev(a.severity) === "critical").length;
                      const hasAlert  = p.status === "alert" || critCount > 0;

                      return (
                        <motion.button key={p.patient_user_id}
                          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.07 }}
                          onClick={() => openFiche(p.patient_user_id)}
                          className="frp-card text-left w-full p-5 rounded-[20px]"
                          style={{
                            ...glass,
                            borderColor: hasAlert ? "rgba(192,80,74,0.30)" : "rgba(74,157,135,0.16)",
                          }}>

                          <div className="flex items-center gap-3 mb-4">
                            <div className="relative w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
                              style={{
                                background: `linear-gradient(135deg, rgba(74,157,135,0.18), rgba(91,143,160,0.14))`,
                                color: C.primaryDark,
                                boxShadow: `0 0 0 3px ${sc.ring}`,
                              }}>
                              {initial}
                              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                                style={{
                                  background: sc.dot,
                                  borderColor: "rgba(255,255,255,0.9)",
                                  ...(p.status !== "offline" ? { animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" } : {}),
                                }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold fp-sora" style={{ color: C.text }}>
                                {p.prenom ? `${p.prenom} ${p.nom}` : p.nom}
                              </p>
                              <p className="text-xs" style={{ color: C.textSoft }}>{p.lien_parente || "Proche"}</p>
                              {p.contact_prioritaire && (
                                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full font-semibold mt-0.5 fp-sora"
                                  style={{ background: "rgba(212,168,67,0.12)", color: C.gold }}>
                                  Contact prioritaire
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 fp-sora"
                              style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                              {sc.label}
                            </span>
                          </div>

                          {/* Vitals */}
                          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl mb-3"
                            style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.12)" }}>
                            {p.bpm ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <Activity className="w-3.5 h-3.5" style={{ color: C.muted }} />
                                  <span className="text-sm font-bold fp-sora" style={{ color: C.text }}>{p.bpm}</span>
                                  <span className="text-xs" style={{ color: C.textSoft }}>BPM</span>
                                </div>
                                <div className="h-4 w-px" style={{ background: "rgba(74,157,135,0.20)" }} />
                                <span className="text-xs" style={{ color: C.textSoft }}>SpO₂ {p.spo2 ?? "--"}%</span>
                                <div className="h-4 w-px" style={{ background: "rgba(74,157,135,0.20)" }} />
                                <span className="text-xs" style={{ color: C.textSoft }}>{p.temperature ?? "--"}°C</span>
                              </>
                            ) : (
                              <div className="flex items-center gap-1.5" style={{ color: C.textSoft }}>
                                <WifiOff className="w-3.5 h-3.5" />
                                <span className="text-xs">Capteur inactif</span>
                              </div>
                            )}
                            {patAlerts.length > 0 && (
                              <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold fp-sora" style={{ color: C.muted }}>
                                <Zap className="w-3 h-3" />
                                {patAlerts.length} alerte{patAlerts.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-[11px] flex items-center gap-1" style={{ color: C.textSoft }}>
                              <Clock className="w-3 h-3" />
                              {p.lastUpdate ? timeAgo(p.lastUpdate) : "Pas de données"}
                            </span>
                            <span className="text-xs font-semibold flex items-center gap-0.5 fp-sora" style={{ color: C.primary }}>
                              Voir la fiche <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* Invite code card */}
                <div className="p-5 rounded-[22px]" style={glass}>
                  <div className="flex items-center gap-2 mb-1">
                    <UserPlus className="w-4 h-4" style={{ color: C.primary }} />
                    <h2 className="text-sm font-bold fp-sora" style={{ color: C.text }}>
                      {proches.length === 0 ? "Lier un patient" : "Ajouter un autre proche"}
                    </h2>
                  </div>
                  <p className="text-xs mb-4" style={{ color: C.textSoft }}>
                    Entrez le code à 6 chiffres fourni par votre proche depuis{" "}
                    <strong>son espace → Paramètres → Proches</strong>.
                  </p>
                  <form onSubmit={handleLinkPatient} className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-[150px]">
                      <input
                        type="text" inputMode="numeric" value={code} maxLength={6}
                        onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setCodeError(""); setCodeSuccess(""); }}
                        placeholder="0 0 0 0 0 0"
                        className="frp-input text-base font-mono text-center tracking-[0.4em]"
                      />
                      {codeError   && <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: C.muted }}><AlertCircle className="w-3 h-3" />{codeError}</p>}
                      {codeSuccess && <p className="text-xs mt-1.5 font-semibold" style={{ color: C.primary }}>{codeSuccess}</p>}
                    </div>
                    <button type="submit" disabled={codeLoading || code.length < 6}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50 fp-sora"
                      style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, color: "#fff", boxShadow: "0 6px 18px rgba(74,157,135,0.28)" }}>
                      {codeLoading ? <><Loader className="w-4 h-4 animate-spin" />En cours…</> : <><UserPlus className="w-4 h-4" />Lier</>}
                    </button>
                  </form>
                </div>

              </motion.div>
            )}

            {/* ══════════════ FICHE VIEW ══════════════ */}
            {inFiche && (
              <motion.div key="fiche" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} className="space-y-4">

                {!selected && (
                  <div className="text-center py-20">
                    <Loader className="w-6 h-6 animate-spin mx-auto" style={{ color: C.primary }} />
                  </div>
                )}

                {selected && (
                  <>
                    {/* Alert banner */}
                    {selected.status === "alert" && (
                      <div className="flex items-center gap-3 p-4 rounded-2xl"
                        style={{ background: "rgba(192,80,74,0.10)", border: "1px solid rgba(192,80,74,0.28)", boxShadow: "0 8px 24px rgba(192,80,74,0.12)" }}>
                        <Zap className="w-5 h-5 shrink-0 animate-pulse" style={{ color: C.muted }} />
                        <p className="text-sm font-semibold fp-sora" style={{ color: C.muted }}>Alerte active en ce moment</p>
                      </div>
                    )}

                    {/* Identity card */}
                    <div className="p-5 rounded-[22px]" style={glass}>
                      <div className="flex items-center gap-4 mb-5 pb-5"
                        style={{ borderBottom: "1px solid rgba(74,157,135,0.12)" }}>
                        <div className="relative w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
                          style={{
                            background: `linear-gradient(135deg, rgba(74,157,135,0.20), rgba(91,143,160,0.14))`,
                            color: C.primaryDark,
                            boxShadow: `0 0 0 4px ${STATUS_CFG[selected.status].ring}`,
                          }}>
                          {(selected.prenom?.[0] ?? selected.nom[0]).toUpperCase()}
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2"
                            style={{
                              background: STATUS_CFG[selected.status].dot,
                              borderColor: "rgba(255,255,255,0.9)",
                              ...(selected.status !== "offline" ? { animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" } : {}),
                            }} />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-xl font-bold fp-sora" style={{ color: C.text }}>
                            {selected.prenom ? `${selected.prenom} ${selected.nom}` : selected.nom}
                          </h2>
                          {selected.lien_parente && <p className="text-sm mt-0.5" style={{ color: C.textSoft }}>{selected.lien_parente}</p>}
                          {selected.contact_prioritaire && (
                            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-semibold fp-sora"
                              style={{ background: "rgba(212,168,67,0.12)", color: C.gold }}>
                              Contact prioritaire
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: "Âge",       value: calcAge(selected.date_naissance) },
                          { label: "Téléphone", value: selected.telephone ?? "—" },
                        ].map((row) => (
                          <div key={row.label} className="rounded-xl p-3"
                            style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.12)" }}>
                            <p className="text-xs font-medium fp-sora" style={{ color: C.textSoft }}>{row.label}</p>
                            <p className="text-sm font-semibold mt-0.5 fp-sora" style={{ color: C.text }}>{row.value}</p>
                          </div>
                        ))}
                        {selected.adresse && (
                          <div className="col-span-2 rounded-xl p-3"
                            style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.12)" }}>
                            <p className="text-xs font-medium fp-sora" style={{ color: C.textSoft }}>Adresse</p>
                            <p className="text-sm font-medium mt-0.5" style={{ color: C.text }}>{selected.adresse}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Vitals card */}
                    <div className="p-5 rounded-[22px]" style={glass}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold fp-sora flex items-center gap-2" style={{ color: C.text }}>
                          <Activity className="w-4 h-4" style={{ color: C.primary }} /> Signes vitaux
                        </h3>
                        {selected.lastUpdate && (
                          <span className="text-[11px] flex items-center gap-1" style={{ color: C.textSoft }}>
                            <Clock className="w-3 h-3" />{timeAgo(selected.lastUpdate)}
                          </span>
                        )}
                      </div>

                      {selected.bpm ? (
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { icon: Activity,    label: "Fréquence card.", value: `${selected.bpm}`,                unit: "BPM", color: C.muted,      bg: "rgba(192,80,74,0.08)",  border: "rgba(192,80,74,0.18)"  },
                            { icon: Droplets,    label: "Saturation O₂",   value: `${selected.spo2 ?? "—"}`,        unit: "%",   color: C.secondary,  bg: "rgba(91,143,160,0.08)", border: "rgba(91,143,160,0.18)" },
                            { icon: Thermometer, label: "Température",     value: `${selected.temperature ?? "—"}`, unit: "°C",  color: C.gold,       bg: "rgba(212,168,67,0.08)", border: "rgba(212,168,67,0.18)" },
                          ].map((v) => (
                            <div key={v.label} className="text-center p-3 rounded-xl"
                              style={{ background: v.bg, border: `1px solid ${v.border}` }}>
                              <v.icon className="w-4 h-4 mx-auto mb-1.5" style={{ color: v.color }} />
                              <p className="text-xl font-bold leading-none fp-sora" style={{ color: C.text }}>
                                {v.value}
                                <span className="text-xs font-normal ml-0.5" style={{ color: C.textSoft }}>{v.unit}</span>
                              </p>
                              <p className="text-[10px] mt-1" style={{ color: C.textSoft }}>{v.label}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8" style={{ color: C.textSoft }}>
                          <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Capteur inactif — aucune donnée disponible</p>
                        </div>
                      )}
                    </div>

                    {/* Medical info */}
                    {(selected.maladies?.length > 0 || selected.traitements?.length > 0 || selected.antecedents) && (
                      <div className="p-5 rounded-[22px] space-y-4" style={glass}>
                        <h3 className="text-sm font-bold fp-sora" style={{ color: C.text }}>Informations médicales</h3>

                        {selected.maladies?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium mb-2 fp-sora" style={{ color: C.textSoft }}>Maladies connues</p>
                            <div className="flex flex-wrap gap-1.5">
                              {selected.maladies.map((m, i) => (
                                <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium fp-sora"
                                  style={{ background: "rgba(192,80,74,0.08)", color: C.muted, border: "1px solid rgba(192,80,74,0.20)" }}>
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {selected.traitements?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium mb-2 fp-sora" style={{ color: C.textSoft }}>Traitements en cours</p>
                            <div className="flex flex-wrap gap-1.5">
                              {selected.traitements.map((t, i) => (
                                <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium fp-sora"
                                  style={{ background: "rgba(91,143,160,0.08)", color: C.secondary, border: "1px solid rgba(91,143,160,0.20)" }}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {selected.antecedents && (
                          <div>
                            <p className="text-xs font-medium mb-2 fp-sora" style={{ color: C.textSoft }}>Antécédents médicaux</p>
                            <p className="text-sm leading-relaxed p-3 rounded-xl" style={{ color: C.text, background: "rgba(74,157,135,0.05)", border: "1px solid rgba(74,157,135,0.12)" }}>
                              {selected.antecedents}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recent alerts */}
                    {(alerts[selected.patient_user_id] ?? []).length > 0 && (
                      <div className="p-5 rounded-[22px]" style={glass}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-bold fp-sora flex items-center gap-2" style={{ color: C.text }}>
                            <Bell className="w-4 h-4" style={{ color: C.primary }} /> Alertes récentes
                          </h3>
                          <button onClick={() => navigate("/family/alerts")}
                            className="text-xs font-semibold flex items-center gap-1 hover:underline fp-sora" style={{ color: C.primary }}>
                            Tout voir <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(alerts[selected.patient_user_id] ?? []).slice(0, 5).map((a) => {
                            const sev = normalizeSev(a.severity);
                            const alertColor = sev === "critical" ? C.muted : sev === "medium" ? C.gold : C.primary;
                            const alertBg    = sev === "critical" ? "rgba(192,80,74,0.07)" : sev === "medium" ? "rgba(212,168,67,0.08)" : "rgba(74,157,135,0.06)";
                            return (
                              <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl"
                                style={{ background: alertBg, border: `1px solid ${alertColor}22`, borderLeft: `3px solid ${alertColor}` }}>
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: alertColor }} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm leading-snug" style={{ color: C.text }}>{a.message}</p>
                                  <p className="text-[11px] mt-0.5" style={{ color: C.textSoft }}>{timeAgo(a.created_at)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* GPS map */}
                    <ProximityMap location={selected.lastKnownLocation} status={selected.status} />

                    {/* Messagerie CTA */}
                    <button onClick={() => navigate("/family/messages")}
                      className="frp-card w-full p-4 flex items-center gap-3 rounded-[18px]"
                      style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.18)", borderRadius: "18px" }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `linear-gradient(135deg, ${C.secondary}, ${C.primary})`, boxShadow: "0 6px 16px rgba(91,143,160,0.26)" }}>
                        <MessageSquare className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-semibold fp-sora" style={{ color: C.text }}>Messagerie médicale</p>
                        <p className="text-xs" style={{ color: C.textSoft }}>Contacter l'équipe soignante de ce patient</p>
                      </div>
                      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: C.primary }} />
                    </button>

                    {/* Edit link card */}
                    <div className="p-5 rounded-[22px] space-y-4" style={glass}>
                      <h3 className="text-sm font-bold fp-sora" style={{ color: C.text }}>Mon lien avec ce proche</h3>

                      <div>
                        <label className="text-xs font-semibold mb-1.5 block fp-sora" style={{ color: C.textSoft }}>Lien de parenté</label>
                        <input
                          value={editLien}
                          onChange={(e) => setEditLien(e.target.value)}
                          placeholder="Ex : Mon père, Ma mère, Mon conjoint…"
                          className="frp-input"
                        />
                      </div>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={editPrio}
                          onChange={(e) => setEditPrio(e.target.checked)}
                          className="h-4 w-4 mt-0.5 rounded" style={{ accentColor: C.primary }} />
                        <div>
                          <p className="text-sm font-semibold fp-sora" style={{ color: C.text }}>Contact prioritaire</p>
                          <p className="text-xs" style={{ color: C.textSoft }}>Je suis contacté en premier en cas d'urgence</p>
                        </div>
                      </label>

                      <div className="flex items-center justify-between pt-3"
                        style={{ borderTop: "1px solid rgba(74,157,135,0.12)" }}>
                        {delConfirm ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs" style={{ color: C.textSoft }}>Supprimer ce lien ?</span>
                            <button onClick={handleDelete}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 fp-sora"
                              style={{ background: C.muted, color: "#fff" }}>
                              Confirmer
                            </button>
                            <button onClick={() => setDelConfirm(false)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all fp-sora"
                              style={{ background: "rgba(74,157,135,0.08)", color: C.textSoft, border: "1px solid rgba(74,157,135,0.16)" }}>
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setDelConfirm(true)}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all hover:scale-105 fp-sora"
                            style={{ background: "rgba(192,80,74,0.07)", color: C.muted, border: "1px solid rgba(192,80,74,0.18)" }}>
                            <Trash2 className="w-3.5 h-3.5" /> Supprimer le lien
                          </button>
                        )}

                        <button onClick={handleSave} disabled={saving}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50 fp-sora"
                          style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, color: "#fff", boxShadow: "0 6px 18px rgba(74,157,135,0.26)" }}>
                          {saving ? <><Loader className="w-3.5 h-3.5 animate-spin" />Sauvegarde…</> : <><Save className="w-3.5 h-3.5" />Enregistrer</>}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        )}
      </div>
    </DashboardLayout>
  );
};

export default FamilyProches;