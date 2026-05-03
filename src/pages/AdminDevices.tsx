import { useState } from "react";
import { motion } from "framer-motion";
import {
  Cpu, Wifi, WifiOff, Battery, Loader, Plus, X,
  Trash2, RefreshCw, QrCode, CheckCircle2
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

const AdminDevices = () => {
  const queryClient = useQueryClient();

  // ── States ──
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [addDeviceLoading, setAddDeviceLoading] = useState(false);
  const [addDeviceError, setAddDeviceError] = useState("");
  const [addDeviceSuccess, setAddDeviceSuccess] = useState("");
  const [deleteDeviceLoading, setDeleteDeviceLoading] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{ deviceId: string; dataUrl: string } | null>(null);
  const [qrLoading, setQrLoading] = useState<string | null>(null);

  // ── Fetch devices ──
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

  // ── Add device ──
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

      setAddDeviceSuccess(`✅ Capteur ajouté : ${data.id}`);
      queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
      setTimeout(() => setAddDeviceSuccess(""), 6000);
    } catch (e: any) {
      setAddDeviceError("Erreur : " + e.message);
    } finally {
      setAddDeviceLoading(false);
    }
  };

  // ── Delete device (only if free) ──
  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm("Supprimer ce capteur ? Cette action est irréversible.")) return;
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

  // ── Show QR code for a device ──
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

  const freeCount = (devices || []).filter(d => !d.patient_id).length;
  const assignedCount = (devices || []).filter(d => d.patient_id).length;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-7xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cpu className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Capteurs IoT</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  État des appareils ESP32
                  {devices && (
                    <span className="ml-2">
                      · <span className="text-primary">{devices.length} capteur{devices.length > 1 ? "s" : ""}</span>
                      · <span className="text-green-600">{freeCount} libre{freeCount > 1 ? "s" : ""}</span>
                      · <span className="text-blue-600">{assignedCount} assigné{assignedCount > 1 ? "s" : ""}</span>
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* ✅ Bouton Ajouter */}
            <button
              onClick={() => { setShowAddDevice(v => !v); setAddDeviceError(""); setAddDeviceSuccess(""); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-primary text-primary-foreground hover:brightness-110 transition-all">
              {showAddDevice ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showAddDevice ? "Fermer" : "Ajouter un capteur"}
            </button>
          </div>
        </motion.div>

        {/* ✅ Add device panel */}
        {showAddDevice && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-card-foreground mb-2">Nouveau capteur</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Un UUID unique sera généré automatiquement. Vous pourrez ensuite scanner le QR code
              pour associer le bracelet physique à un patient.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleAddDevice}
                disabled={addDeviceLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50">
                {addDeviceLoading
                  ? <><Loader className="w-4 h-4 animate-spin" /> Création...</>
                  : <><RefreshCw className="w-4 h-4" /> Générer un nouveau capteur</>
                }
              </button>
              {addDeviceSuccess && (
                <span className="flex items-center gap-1.5 text-xs text-green-600 font-mono bg-green-500/10 px-3 py-2 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {addDeviceSuccess}
                </span>
              )}
              {addDeviceError && (
                <span className="text-xs text-destructive">{addDeviceError}</span>
              )}
            </div>
          </motion.div>
        )}

        {/* Loading / Error / Empty */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader className="w-5 h-5 animate-spin" />
            <span className="text-sm">Chargement des capteurs...</span>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 text-sm text-destructive">
            Impossible de charger les capteurs.
          </div>
        )}

        {!isLoading && devices?.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-16 text-center">
            <Cpu className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-card-foreground">Aucun capteur enregistré</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cliquez sur "Ajouter un capteur" pour enregistrer un bracelet.
            </p>
          </div>
        )}

        {/* ✅ Devices grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(devices || []).map((d, i) => {
            const signal = getSignalBars(d.actif, d.dernier_signal);
            const battery = d.niveau_batterie;
            const isFree = !d.patient_id;

            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-card border border-border rounded-2xl p-5 shadow-sm">

                {/* Top row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="font-mono text-xs font-semibold text-card-foreground truncate max-w-[140px]">
                      {d.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Badge libre/assigné */}
                    {isFree
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium">Libre</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-medium">Assigné</span>
                    }
                    {/* Badge en ligne/hors ligne */}
                    {d.actif
                      ? <div className="flex items-center gap-1 text-green-600 text-xs"><Wifi className="w-3 h-3" /> En ligne</div>
                      : <div className="flex items-center gap-1 text-muted-foreground text-xs"><WifiOff className="w-3 h-3" /> Hors ligne</div>
                    }
                  </div>
                </div>

                {/* Patient */}
                <p className="text-sm text-muted-foreground mb-3">
                  Patient lié : <span className="text-card-foreground font-medium">{d.patient_nom}</span>
                </p>

                {/* Battery + Signal */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1 text-sm">
                    <Battery className={`w-4 h-4 ${battery !== null && battery < 30 ? "text-red-500" : "text-green-500"}`} />
                    <span className={battery !== null && battery < 30 ? "text-red-500" : "text-card-foreground"}>
                      {battery !== null ? `${battery}%` : "—"}
                    </span>
                  </div>
                  <div className="flex gap-0.5 items-end">
                    {[1, 2, 3, 4].map((bar) => (
                      <div key={bar} className={`w-1.5 rounded-sm ${bar <= signal ? "bg-primary" : "bg-muted"}`}
                        style={{ height: `${bar * 4 + 4}px` }} />
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Dernière transmission : {getLastSync(d.dernier_signal)}
                  </span>

                  <div className="flex items-center gap-1">
                    {/* ✅ Bouton QR code — toujours disponible */}
                    <button
                      onClick={() => handleShowQr(d.id)}
                      disabled={qrLoading === d.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-primary hover:bg-primary/10 transition-all disabled:opacity-50">
                      {qrLoading === d.id
                        ? <Loader className="w-3 h-3 animate-spin" />
                        : <QrCode className="w-3 h-3" />
                      }
                      QR Code
                    </button>

                    {/* ✅ Supprimer seulement si libre */}
                    {isFree && (
                      <button
                        onClick={() => handleDeleteDevice(d.id)}
                        disabled={deleteDeviceLoading === d.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50">
                        {deleteDeviceLoading === d.id
                          ? <Loader className="w-3 h-3 animate-spin" />
                          : <Trash2 className="w-3 h-3" />
                        }
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ✅ QR Code Modal */}
      {qrModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setQrModal(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-xl max-w-sm w-full"
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-card-foreground">QR Code du Bracelet</h3>
              <button onClick={() => setQrModal(null)}
                className="text-muted-foreground hover:text-foreground transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center space-y-3">
              <img
                src={qrModal.dataUrl}
                alt="QR Code"
                className="w-48 h-48 mx-auto rounded-xl border border-border"
              />
              <p className="font-mono text-xs text-muted-foreground break-all px-2">
                {qrModal.deviceId}
              </p>
              <p className="text-xs text-muted-foreground">
                Le patient scanne ce QR code pour associer son bracelet
              </p>
              <a
                href={qrModal.dataUrl}
                download={`qr-device-${qrModal.deviceId.slice(0, 8)}.png`}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all">
                <QrCode className="w-4 h-4" />
                Télécharger le QR code
              </a>
            </div>
          </motion.div>
        </div>
      )}

    </DashboardLayout>
  );
};

export default AdminDevices;