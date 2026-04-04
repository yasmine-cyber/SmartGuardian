import { motion } from "framer-motion";
import { Cpu, Wifi, WifiOff, Battery, Loader } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

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

      // Dernier niveau batterie par device
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

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            <Cpu className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Capteurs IoT</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                État des appareils ESP32
                {devices && <span className="ml-2 text-primary">· {devices.length} capteur{devices.length > 1 ? "s" : ""}</span>}
              </p>
            </div>
          </div>
        </motion.div>

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
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-sm text-muted-foreground">
            Aucun capteur enregistré.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(devices || []).map((d, i) => {
            const signal = getSignalBars(d.actif, d.dernier_signal);
            const battery = d.niveau_batterie;
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-card border border-border rounded-2xl p-5 shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-primary" />
                    <span className="font-mono text-xs font-semibold text-card-foreground truncate max-w-[160px]">{d.id}</span>
                  </div>
                  {d.actif ? (
                    <div className="flex items-center gap-1 text-green-600 text-xs"><Wifi className="w-3 h-3" /> En ligne</div>
                  ) : (
                    <div className="flex items-center gap-1 text-muted-foreground text-xs"><WifiOff className="w-3 h-3" /> Hors ligne</div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mb-3">
                  Patient lié : <span className="text-card-foreground font-medium">{d.patient_nom}</span>
                </p>

                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1 text-sm">
                    <Battery className={`w-4 h-4 ${battery !== null && battery < 30 ? "text-red-500" : "text-green-500"}`} />
                    <span className={battery !== null && battery < 30 ? "text-red-500" : "text-card-foreground"}>
                      {battery !== null ? `${battery}%` : "—"}
                    </span>
                  </div>
                  <div className="flex gap-0.5 items-end">
                    {[1, 2, 3, 4].map((bar) => (
                      <div key={bar} className={`w-1.5 rounded-sm ${bar <= signal ? "bg-primary" : "bg-muted"}`} style={{ height: `${bar * 4 + 4}px` }} />
                    ))}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">Dernière transmission : {getLastSync(d.dernier_signal)}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDevices;