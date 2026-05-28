import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, Wifi, WifiOff, Battery, Loader, Plus, X,
  Trash2, RefreshCw, QrCode, CheckCircle2, BatteryLow, BatteryMedium, BatteryFull,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import QRCode from "qrcode";

type Device = {
  id: string;
  actif: boolean;
  dernier_signal: string | null;
  created_at: string;
  patient_id: string | null;
  patient_nom: string | null;
  niveau_batterie: number | null;
};

type StatusFilter = "all" | "libre" | "assigne" | "online" | "offline";

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

// ─── Status config ─────────────────────────────────────────────────────────────
const STAT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  libre:    { label: "Libres",     color: C.primary,   bg: "rgba(74,157,135,0.10)",  border: "rgba(74,157,135,0.25)" },
  assigne:  { label: "Assignés",   color: C.secondary, bg: "rgba(91,143,160,0.12)",  border: "rgba(91,143,160,0.28)" },
  online:   { label: "En ligne",   color: C.primary,   bg: "rgba(74,157,135,0.10)",  border: "rgba(74,157,135,0.25)" },
  offline:  { label: "Hors ligne", color: C.textSoft,  bg: "rgba(30,60,50,0.06)",    border: "rgba(30,60,50,0.14)" },
};

function getLastSync(dernier_signal: string | null): string {
  if (!dernier_signal) return "Jamais";
  const diff = Date.now() - new Date(dernier_signal).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `il y a ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)} jours`;
}

function getSignalBars(actif: boolean, dernier_signal: string | null): number {
  if (!actif || !dernier_signal) return 0;
  const diff = Date.now() - new Date(dernier_signal).getTime();
  const min = diff / 60000;
  if (min < 1) return 4;
  if (min < 5) return 3;
  if (min < 30) return 2;
  return 1;
}

function BatteryIcon({ level }: { level: number | null }) {
  if (level === null) return <Battery className="w-4 h-4" style={{ color: C.textSoft }} />;
  if (level < 20) return <BatteryLow className="w-4 h-4" style={{ color: C.muted }} />;
  if (level < 60) return <BatteryMedium className="w-4 h-4" style={{ color: C.gold }} />;
  return <BatteryFull className="w-4 h-4" style={{ color: C.primary }} />;
}

const AdminDevices = () => {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter]         = useState<StatusFilter>("all");
  const [showAddDevice, setShowAddDevice]       = useState(false);
  const [addDeviceLoading, setAddDeviceLoading] = useState(false);
  const [addDeviceError, setAddDeviceError]     = useState("");
  const [addDeviceSuccess, setAddDeviceSuccess] = useState("");
  const [deleteDeviceLoading, setDeleteDeviceLoading] = useState<string | null>(null);
  const [qrModal, setQrModal]   = useState<{ deviceId: string; dataUrl: string } | null>(null);
  const [qrLoading, setQrLoading] = useState<string | null>(null);

  const { data: devices, isLoading, error } = useQuery({
    queryKey: ["admin-devices"],
    queryFn: async () => {
      const { data: devicesRaw, error: devErr } = await supabase
        .from("devices")
        .select("id, actif, dernier_signal, created_at, patient_id")
        .order("created_at", { ascending: false });

      if (devErr) throw devErr;
      if (!devicesRaw?.length) return [] as Device[];

      const patientIds = devicesRaw
        .map((d: { patient_id: string | null }) => d.patient_id)
        .filter(Boolean) as string[];

      let patientsMap: Record<string, string> = {};

      if (patientIds.length > 0) {
        const { data: patientsRows } = await supabase
          .from("patients").select("id, user_id").in("id", patientIds);
        const userIds = (patientsRows || []).map((p: { user_id: string }) => p.user_id);
        if (userIds.length > 0) {
          const { data: utilisateurs } = await supabase
            .from("utilisateurs").select("id, nom, prenom").in("id", userIds);
          (patientsRows || []).forEach((p: { id: string; user_id: string }) => {
            const u = (utilisateurs || []).find((u: { id: string }) => u.id === p.user_id);
            if (u) patientsMap[p.id] = [u.prenom, u.nom].filter(Boolean).join(" ");
          });
        }
      }

      const deviceIds = devicesRaw.map((d: { id: string }) => d.id);
      let batteryMap: Record<string, number | null> = {};
      if (deviceIds.length > 0) {
        const { data: vitals } = await supabase
          .from("vital_signs")
          .select("device_id, niveau_batterie, recorded_at")
          .in("device_id", deviceIds)
          .not("niveau_batterie", "is", null)
          .order("recorded_at", { ascending: false });
        (vitals || []).forEach((v: { device_id: string; niveau_batterie: number }) => {
          if (!(v.device_id in batteryMap)) batteryMap[v.device_id] = v.niveau_batterie;
        });
      }

      return devicesRaw.map((d: { id: string; actif: boolean; dernier_signal: string | null; created_at: string; patient_id: string | null }) => ({
        id: d.id,
        actif: d.actif,
        dernier_signal: d.dernier_signal,
        created_at: d.created_at,
        patient_id: d.patient_id,
        patient_nom: d.patient_id ? (patientsMap[d.patient_id] ?? "Patient inconnu") : "Non assigné",
        niveau_batterie: batteryMap[d.id] ?? null,
      })) as Device[];
    },
    refetchInterval: 30000,
  });

  const handleAddDevice = async () => {
    setAddDeviceLoading(true);
    setAddDeviceError("");
    setAddDeviceSuccess("");
    try {
      const { data, error } = await supabase
        .from("devices").insert({ actif: false }).select("id").single();
      if (error) throw error;
      setAddDeviceSuccess(`✅ Dispositif ajouté : ${data.id}`);
      queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
      setTimeout(() => setAddDeviceSuccess(""), 6000);
    } catch (e: any) {
      setAddDeviceError("Erreur : " + e.message);
    } finally {
      setAddDeviceLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm("Supprimer ce dispositif ? Cette action est irréversible.")) return;
    setDeleteDeviceLoading(deviceId);
    try {
      const { error } = await supabase
        .from("devices").delete().eq("id", deviceId).is("patient_id", null);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
    } catch (e: any) {
      alert("Erreur suppression : " + e.message);
    } finally {
      setDeleteDeviceLoading(null);
    }
  };

  const handleShowQr = async (deviceId: string) => {
    setQrLoading(deviceId);
    try {
      const dataUrl = await QRCode.toDataURL(deviceId, { width: 280, margin: 2 });
      setQrModal({ deviceId, dataUrl });
    } catch (e: any) {
      alert("Erreur QR : " + e.message);
    } finally {
      setQrLoading(null);
    }
  };

  const allDevices    = devices || [];
  const freeCount     = allDevices.filter(d => !d.patient_id).length;
  const assignedCount = allDevices.filter(d => d.patient_id).length;
  const onlineCount   = allDevices.filter(d => d.actif).length;
  const offlineCount  = allDevices.filter(d => !d.actif).length;

  const filteredDevices = allDevices.filter((d) => {
    if (statusFilter === "libre")   return !d.patient_id;
    if (statusFilter === "assigne") return !!d.patient_id;
    if (statusFilter === "online")  return d.actif;
    if (statusFilter === "offline") return !d.actif;
    return true;
  });

  const statCards = [
    { key: "libre"   as StatusFilter, label: "Libres",     count: freeCount,     ...STAT_CONFIG.libre },
    { key: "assigne" as StatusFilter, label: "Assignés",   count: assignedCount, ...STAT_CONFIG.assigne },
    { key: "online"  as StatusFilter, label: "En ligne",   count: onlineCount,   ...STAT_CONFIG.online },
    { key: "offline" as StatusFilter, label: "Hors ligne", count: offlineCount,  ...STAT_CONFIG.offline },
  ];

  return (
    <DashboardLayout role="admin">
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

        <div className="relative space-y-5 max-w-7xl">

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
                  <Cpu className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight sg-sora" style={{ color: C.text }}>
                    Dispositifs <span className="sg-gradient-text">IoT</span>
                  </h1>
                  <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                    État des appareils ESP32 ·{" "}
                    <span className="font-semibold" style={{ color: C.text }}>{allDevices.length} total</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowAddDevice(v => !v); setAddDeviceError(""); setAddDeviceSuccess(""); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105"
                style={{
                  background: showAddDevice
                    ? "rgba(74,157,135,0.10)"
                    : `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  color: showAddDevice ? C.primaryDark : "#fff",
                  border: showAddDevice ? `1px solid rgba(74,157,135,0.25)` : "none",
                  boxShadow: showAddDevice ? "none" : "0 6px 18px rgba(74,157,135,0.30)",
                }}
              >
                {showAddDevice ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span className="hidden sm:inline">{showAddDevice ? "Fermer" : "Ajouter un dispositif"}</span>
              </button>
            </div>
          </motion.div>

          {/* ── Stat filter cards ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statCards.map((s) => {
              const active = statusFilter === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(statusFilter === s.key ? "all" : s.key)}
                  className="sg-card p-4 text-left transition-all"
                  style={{
                    ...glass,
                    borderLeft: `3px solid ${active ? s.color : "transparent"}`,
                    background: active ? s.bg : "rgba(255,255,255,0.78)",
                  }}
                >
                  <p className="text-2xl font-bold sg-sora" style={{ color: active ? s.color : C.text }}>
                    {s.count}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>{s.label}</p>
                </button>
              );
            })}
          </motion.div>

          {/* ── Add device panel ── */}
          <AnimatePresence>
            {showAddDevice && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-5 space-y-4" style={glass}>
                  <div>
                    <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>Nouveau dispositif</h3>
                    <p className="text-xs mt-1" style={{ color: C.textSoft }}>
                      Un UUID unique sera généré automatiquement. Scannez ensuite le QR code pour lier le bracelet à un patient.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleAddDevice}
                      disabled={addDeviceLoading}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
                      style={{
                        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                        color: "#fff",
                        boxShadow: "0 6px 18px rgba(74,157,135,0.28)",
                      }}
                    >
                      {addDeviceLoading
                        ? <><Loader className="w-4 h-4 animate-spin" /> Création...</>
                        : <><RefreshCw className="w-4 h-4" /> Générer un nouveau dispositif</>}
                    </button>
                    {addDeviceSuccess && (
                      <span className="flex items-center gap-1.5 text-xs font-mono px-3 py-2 rounded-xl"
                        style={{ background: "rgba(74,157,135,0.10)", color: C.primary, border: "1px solid rgba(74,157,135,0.22)" }}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {addDeviceSuccess}
                      </span>
                    )}
                    {addDeviceError && (
                      <span className="text-xs" style={{ color: C.muted }}>{addDeviceError}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Active filter label ── */}
          {statusFilter !== "all" && (
            <div className="flex items-center gap-2 px-1">
              <p className="text-xs" style={{ color: C.textSoft }}>
                Filtre actif :{" "}
                <span className="font-semibold" style={{ color: C.text }}>{statusFilter}</span>
                {" "}· {filteredDevices.length} dispositif{filteredDevices.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={() => setStatusFilter("all")}
                className="text-xs font-semibold transition-all hover:underline"
                style={{ color: C.primary }}
              >
                Effacer
              </button>
            </div>
          )}

          {/* ── Loading / Error / Empty ── */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-24">
              <Loader className="w-5 h-5 animate-spin" style={{ color: C.primary }} />
              <span className="text-sm" style={{ color: C.textSoft }}>Chargement des dispositifs...</span>
            </div>
          )}
          {error && (
            <div className="rounded-2xl p-4 text-sm"
              style={{ background: "rgba(192,80,74,0.08)", border: "1px solid rgba(192,80,74,0.22)", color: C.muted }}>
              Impossible de charger les dispositifs.
            </div>
          )}
          {!isLoading && allDevices.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-3" style={glass}>
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 12px 28px rgba(74,157,135,0.30)",
                }}>
                <Cpu className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold sg-sora" style={{ color: C.text }}>Aucun dispositif enregistré</p>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                  Cliquez sur "Ajouter un dispositif" pour commencer.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Devices grid ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {filteredDevices.map((d, i) => {
                const signal  = getSignalBars(d.actif, d.dernier_signal);
                const battery = d.niveau_batterie;
                const isFree  = !d.patient_id;

                return (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: Math.min(i * 0.05, 0.3) }}
                    className="sg-card overflow-hidden"
                    style={{
                      ...glass,
                      borderLeft: `3px solid ${d.actif ? C.primary : "rgba(30,60,50,0.15)"}`,
                    }}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between p-5 pb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                          style={{
                            background: d.actif
                              ? `linear-gradient(135deg, ${C.primary}, ${C.secondary})`
                              : "rgba(30,60,50,0.08)",
                            boxShadow: d.actif ? "0 6px 16px rgba(74,157,135,0.25)" : "none",
                          }}>
                          <Cpu className="w-4 h-4" style={{ color: d.actif ? "#fff" : C.textSoft }} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold truncate" style={{ color: C.text }}>{d.id}</p>
                          <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>
                            Ajouté le {new Date(d.created_at).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                          style={{
                            background: isFree ? "rgba(74,157,135,0.10)" : "rgba(91,143,160,0.12)",
                            color: isFree ? C.primary : C.secondary,
                            border: `1px solid ${isFree ? "rgba(74,157,135,0.25)" : "rgba(91,143,160,0.28)"}`,
                          }}>
                          {isFree ? "Libre" : "Assigné"}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1"
                          style={{
                            background: d.actif ? "rgba(74,157,135,0.10)" : "rgba(30,60,50,0.06)",
                            color: d.actif ? C.primary : C.textSoft,
                            border: `1px solid ${d.actif ? "rgba(74,157,135,0.25)" : "rgba(30,60,50,0.12)"}`,
                          }}>
                          {d.actif ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {d.actif ? "En ligne" : "Hors ligne"}
                        </span>
                      </div>
                    </div>

                    {/* Patient row */}
                    <div className="mx-5 mb-3 flex items-center justify-between px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.12)" }}>
                      <span className="text-xs" style={{ color: C.textSoft }}>Patient lié</span>
                      <span className="text-xs font-semibold"
                        style={{ color: d.patient_id ? C.text : C.textSoft, fontStyle: d.patient_id ? "normal" : "italic" }}>
                        {d.patient_nom}
                      </span>
                    </div>

                    {/* Battery + signal bars */}
                    <div className="px-5 pb-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <BatteryIcon level={battery} />
                        <span className="text-sm font-semibold sg-sora"
                          style={{
                            color: battery !== null && battery < 20 ? C.muted
                              : battery !== null && battery < 60 ? C.gold
                              : C.text,
                          }}>
                          {battery !== null ? `${battery}%` : "—"}
                        </span>
                      </div>
                      <div className="flex gap-0.5 items-end">
                        {[1, 2, 3, 4].map((bar) => (
                          <div
                            key={bar}
                            className="w-1.5 rounded-sm transition-all"
                            style={{
                              height: `${bar * 4 + 4}px`,
                              background: bar <= signal
                                ? `linear-gradient(to top, ${C.primary}, ${C.secondary})`
                                : "rgba(74,157,135,0.15)",
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 flex items-center justify-between gap-2"
                      style={{ borderTop: "1px solid rgba(74,157,135,0.12)" }}>
                      <span className="text-xs" style={{ color: C.textSoft }}>
                        Sync :{" "}
                        <span className="font-semibold" style={{ color: C.text }}>
                          {getLastSync(d.dernier_signal)}
                        </span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleShowQr(d.id)}
                          disabled={qrLoading === d.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
                          style={{
                            background: "rgba(74,157,135,0.08)",
                            color: C.primary,
                            border: "1px solid rgba(74,157,135,0.20)",
                          }}
                        >
                          {qrLoading === d.id ? <Loader className="w-3 h-3 animate-spin" /> : <QrCode className="w-3 h-3" />}
                          QR Code
                        </button>
                        {isFree && (
                          <button
                            onClick={() => handleDeleteDevice(d.id)}
                            disabled={deleteDeviceLoading === d.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
                            style={{
                              background: "rgba(192,80,74,0.08)",
                              color: C.muted,
                              border: "1px solid rgba(192,80,74,0.20)",
                            }}
                          >
                            {deleteDeviceLoading === d.id ? <Loader className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Supprimer
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {!isLoading && filteredDevices.length === 0 && allDevices.length > 0 && (
              <div className="md:col-span-2 flex flex-col items-center justify-center py-16 gap-3" style={glass}>
                <Cpu className="w-10 h-10" style={{ color: "rgba(74,157,135,0.30)" }} />
                <p className="text-sm" style={{ color: C.textSoft }}>Aucun dispositif pour ce filtre.</p>
                <button onClick={() => setStatusFilter("all")}
                  className="text-xs font-semibold hover:underline" style={{ color: C.primary }}>
                  Voir tous les dispositifs
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── QR Code Modal ── */}
      <AnimatePresence>
        {qrModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: "rgba(26,46,40,0.50)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
            onClick={() => setQrModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="max-w-sm w-full overflow-hidden"
              style={{ ...glass, borderRadius: "28px" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Accent strip */}
              <div style={{
                height: "4px",
                background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
              }} />
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold sg-sora" style={{ color: C.text }}>QR Code du Bracelet</h3>
                  <button
                    onClick={() => setQrModal(null)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:scale-110"
                    style={{ background: "rgba(74,157,135,0.10)", color: C.textSoft }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-center space-y-3">
                  <div className="p-3 rounded-2xl inline-block"
                    style={{ background: "#fff", boxShadow: "0 4px 16px rgba(30,60,50,0.10)" }}>
                    <img src={qrModal.dataUrl} alt="QR Code" className="w-48 h-48" />
                  </div>
                  <p className="font-mono text-xs break-all px-2" style={{ color: C.textSoft }}>
                    {qrModal.deviceId}
                  </p>
                  <p className="text-xs" style={{ color: C.textSoft }}>
                    Le patient scanne ce QR code pour associer son bracelet
                  </p>
                  <a
                    href={qrModal.dataUrl}
                    download={`qr-device-${qrModal.deviceId.slice(0, 8)}.png`}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.02]"
                    style={{
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      color: "#fff",
                      boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                    }}
                  >
                    <QrCode className="w-4 h-4" />
                    Télécharger le QR code
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default AdminDevices;