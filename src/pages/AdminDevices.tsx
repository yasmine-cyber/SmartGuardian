import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, Wifi, WifiOff, Battery, Loader, Plus, X,
  Trash2, RefreshCw, QrCode, CheckCircle2, BatteryLow, BatteryMedium, BatteryFull
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
  if (level === null) return <Battery className="w-4 h-4 text-muted-foreground" />;
  if (level < 20) return <BatteryLow className="w-4 h-4 text-red-500" />;
  if (level < 60) return <BatteryMedium className="w-4 h-4 text-amber-500" />;
  return <BatteryFull className="w-4 h-4 text-green-500" />;
}

const AdminDevices = () => {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [addDeviceLoading, setAddDeviceLoading] = useState(false);
  const [addDeviceError, setAddDeviceError] = useState("");
  const [addDeviceSuccess, setAddDeviceSuccess] = useState("");
  const [deleteDeviceLoading, setDeleteDeviceLoading] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{ deviceId: string; dataUrl: string } | null>(null);
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
          .from("patients")
          .select("id, user_id")
          .in("id", patientIds);

        const userIds = (patientsRows || []).map((p: { user_id: string }) => p.user_id);

        if (userIds.length > 0) {
          const { data: utilisateurs } = await supabase
            .from("utilisateurs")
            .select("id, nom, prenom")
            .in("id", userIds);

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
        .from("devices")
        .insert({ actif: false })
        .select("id")
        .single();

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
        .from("devices")
        .delete()
        .eq("id", deviceId)
        .is("patient_id", null);
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

  const allDevices = devices || [];
  const freeCount    = allDevices.filter(d => !d.patient_id).length;
  const assignedCount= allDevices.filter(d => d.patient_id).length;
  const onlineCount  = allDevices.filter(d => d.actif).length;
  const offlineCount = allDevices.filter(d => !d.actif).length;

  const filteredDevices = allDevices.filter((d) => {
    if (statusFilter === "libre")   return !d.patient_id;
    if (statusFilter === "assigne") return !!d.patient_id;
    if (statusFilter === "online")  return d.actif;
    if (statusFilter === "offline") return !d.actif;
    return true;
  });

  const statCards = [
    { key: "libre"   as StatusFilter, label: "Libres",    count: freeCount,    color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { key: "assigne" as StatusFilter, label: "Assignés",  count: assignedCount,color: "text-blue-600",    bg: "bg-blue-500/10 border-blue-500/20" },
    { key: "online"  as StatusFilter, label: "En ligne",  count: onlineCount,  color: "text-green-600",   bg: "bg-green-500/10 border-green-500/20" },
    { key: "offline" as StatusFilter, label: "Hors ligne",count: offlineCount, color: "text-slate-500",   bg: "bg-slate-500/10 border-slate-500/20" },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-7xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Dispositifs IoT</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  État des appareils ESP32 · <span className="font-medium text-foreground">{allDevices.length} total</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => { setShowAddDevice(v => !v); setAddDeviceError(""); setAddDeviceSuccess(""); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground hover:brightness-110 transition-all"
            >
              {showAddDevice ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span className="hidden sm:inline">{showAddDevice ? "Fermer" : "Ajouter un dispositif"}</span>
            </button>
          </div>
        </motion.div>

        {/* Stat filter cards */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {statCards.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(statusFilter === s.key ? "all" : s.key)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                statusFilter === s.key
                  ? `${s.bg} ring-1 ring-inset ring-current/20`
                  : "bg-card border-border hover:bg-muted/40"
              }`}
            >
              <p className={`text-2xl font-bold ${statusFilter === s.key ? s.color : "text-foreground"}`}>{s.count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </button>
          ))}
        </motion.div>

        {/* Add device panel */}
        <AnimatePresence>
          {showAddDevice && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-card-foreground mb-1">Nouveau dispositif</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Un UUID unique sera généré automatiquement. Scannez ensuite le QR code pour lier le bracelet à un patient.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={handleAddDevice}
                    disabled={addDeviceLoading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {addDeviceLoading
                      ? <><Loader className="w-4 h-4 animate-spin" /> Création...</>
                      : <><RefreshCw className="w-4 h-4" /> Générer un nouveau dispositif</>
                    }
                  </button>
                  {addDeviceSuccess && (
                    <span className="flex items-center gap-1.5 text-xs text-green-600 font-mono bg-green-500/10 px-3 py-2 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {addDeviceSuccess}
                    </span>
                  )}
                  {addDeviceError && <span className="text-xs text-destructive">{addDeviceError}</span>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active filter label */}
        {statusFilter !== "all" && (
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Filtre actif : <span className="text-foreground font-medium capitalize">{statusFilter}</span> · {filteredDevices.length} dispositif{filteredDevices.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => setStatusFilter("all")}
              className="text-xs text-primary hover:underline"
            >
              Effacer
            </button>
          </div>
        )}

        {/* Loading / Error / Empty */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader className="w-5 h-5 animate-spin" />
            <span className="text-sm">Chargement des dispositifs...</span>
          </div>
        )}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 text-sm text-destructive">
            Impossible de charger les dispositifs.
          </div>
        )}
        {!isLoading && allDevices.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-16 text-center">
            <Cpu className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-card-foreground">Aucun dispositif enregistré</p>
            <p className="text-xs text-muted-foreground mt-1">Cliquez sur "Ajouter un dispositif" pour commencer.</p>
          </div>
        )}

        {/* Devices grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {filteredDevices.map((d, i) => {
              const signal = getSignalBars(d.actif, d.dernier_signal);
              const battery = d.niveau_batterie;
              const isFree = !d.patient_id;

              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${d.actif ? "bg-green-500/10" : "bg-muted"}`}>
                        <Cpu className={`w-4.5 h-4.5 ${d.actif ? "text-green-600" : "text-muted-foreground"}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-card-foreground truncate">{d.id}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Ajouté le {new Date(d.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                        isFree
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                      }`}>
                        {isFree ? "Libre" : "Assigné"}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border flex items-center gap-1 ${
                        d.actif
                          ? "bg-green-500/10 text-green-600 border-green-500/20"
                          : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                      }`}>
                        {d.actif ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {d.actif ? "En ligne" : "Hors ligne"}
                      </span>
                    </div>
                  </div>

                  {/* Patient */}
                  <div className="flex items-center justify-between mb-3 p-2.5 rounded-xl bg-muted/40">
                    <span className="text-xs text-muted-foreground">Patient lié</span>
                    <span className={`text-xs font-semibold ${d.patient_id ? "text-card-foreground" : "text-muted-foreground italic"}`}>
                      {d.patient_nom}
                    </span>
                  </div>

                  {/* Battery + Signal */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <BatteryIcon level={battery} />
                      <span className={`text-sm font-medium ${
                        battery !== null && battery < 20
                          ? "text-red-500"
                          : battery !== null && battery < 60
                          ? "text-amber-500"
                          : "text-card-foreground"
                      }`}>
                        {battery !== null ? `${battery}%` : "—"}
                      </span>
                    </div>

                    {/* Signal bars */}
                    <div className="flex gap-0.5 items-end">
                      {[1, 2, 3, 4].map((bar) => (
                        <div
                          key={bar}
                          className={`w-1.5 rounded-sm transition-colors ${bar <= signal ? "bg-primary" : "bg-muted"}`}
                          style={{ height: `${bar * 4 + 4}px` }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Sync : <span className="text-card-foreground">{getLastSync(d.dernier_signal)}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleShowQr(d.id)}
                        disabled={qrLoading === d.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-primary hover:bg-primary/10 transition-all disabled:opacity-50"
                      >
                        {qrLoading === d.id ? <Loader className="w-3 h-3 animate-spin" /> : <QrCode className="w-3 h-3" />}
                        QR Code
                      </button>
                      {isFree && (
                        <button
                          onClick={() => handleDeleteDevice(d.id)}
                          disabled={deleteDeviceLoading === d.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
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
            <div className="md:col-span-2 bg-card border border-border rounded-2xl p-12 text-center">
              <Cpu className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucun dispositif pour ce filtre.</p>
              <button onClick={() => setStatusFilter("all")} className="text-xs text-primary hover:underline mt-1">
                Voir tous les dispositifs
              </button>
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setQrModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-card-foreground">QR Code du Bracelet</h3>
                <button onClick={() => setQrModal(null)} className="text-muted-foreground hover:text-foreground transition-all p-1 rounded-lg hover:bg-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-center space-y-3">
                <div className="p-3 bg-white rounded-xl inline-block">
                  <img src={qrModal.dataUrl} alt="QR Code" className="w-48 h-48" />
                </div>
                <p className="font-mono text-xs text-muted-foreground break-all px-2">{qrModal.deviceId}</p>
                <p className="text-xs text-muted-foreground">Le patient scanne ce QR code pour associer son bracelet</p>
                <a
                  href={qrModal.dataUrl}
                  download={`qr-device-${qrModal.deviceId.slice(0, 8)}.png`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all"
                >
                  <QrCode className="w-4 h-4" />
                  Télécharger le QR code
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default AdminDevices;