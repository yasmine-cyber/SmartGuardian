import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin, Heart,
  AlertCircle, Loader, UserPlus,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type PatientStatus = "online" | "offline" | "alert";

interface LinkedPatient {
  user_id: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  lien_parente: string | null;
  bpm: number | null;
  spo2: number | null;
  temperature: number | null;
  status: PatientStatus;
  lastUpdate: string | null;
}

interface AlertItem {
  id: string;
  message: string;
  severity: string;
  created_at: string;
  patient_nom: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { color: string; ring: string; label: string }> = {
  online:  { color: "bg-safe",             ring: "ring-safe/20",     label: "Tout va bien"    },
  offline: { color: "bg-muted-foreground", ring: "ring-muted/20",    label: "Hors ligne"      },
  alert:   { color: "bg-critical",         ring: "ring-critical/20", label: "Alerte en cours" },
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return `il y a ${diff}s`;
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const FamilyDashboard = () => {
  const [patients, setPatients]               = useState<LinkedPatient[]>([]);
  const [alerts, setAlerts]                   = useState<AlertItem[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [linkLoading, setLinkLoading]         = useState(false);
  const [linkError, setLinkError]             = useState("");
  const [linkSuccess, setLinkSuccess]         = useState("");

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Step 1 — get links
    const { data: links, error: linksError } = await supabase
      .from("proche_patient")
      .select("patient_id, lien_parente")
      .eq("proche_id", user.id);

    console.log("1. links:", links, "error:", linksError);
    if (!links || links.length === 0) { setLoading(false); return; }

    const patientUserIds = links.map((l) => l.patient_id);
    console.log("patientUserIds:", patientUserIds);

    // Step 2 — get utilisateurs
    const { data: utilisateurs, error: utilError } = await supabase
      .from("utilisateurs")
      .select("id, nom, prenom, telephone")
      .in("id", patientUserIds);

    console.log("2. utilisateurs:", utilisateurs, "error:", utilError);

    // Step 3 — get patients rows
    const { data: patientRows, error: patientError } = await supabase
      .from("patients")
      .select("id, user_id, status, updated_at")
      .in("user_id", patientUserIds);

    console.log("3. patientRows:", patientRows, "error:", patientError);

    // Step 4 — enrich with vitals
    const enriched: LinkedPatient[] = await Promise.all(
      (utilisateurs ?? []).map(async (u) => {
        const link   = links.find((l) => l.patient_id === u.id);
        const patRow = (patientRows ?? []).find((p) => p.user_id === u.id);

        const { data: device, error: deviceError } = await supabase
          .from("devices")
          .select("id")
          .eq("patient_id", patRow?.id)
          .eq("actif", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        console.log(`4. device for ${u.nom}:`, device, "error:", deviceError);

        let bpm = null, spo2 = null, temperature = null, lastUpdate = null;
        if (device?.id) {
          const { data: vital, error: vitalError } = await supabase
            .from("vital_signs")
            .select("bpm, spo2, temperature, recorded_at")
            .eq("device_id", device.id)
            .order("recorded_at", { ascending: false })
            .limit(1)
            .single();

          console.log(`5. vital for ${u.nom}:`, vital, "error:", vitalError);

          if (vital) {
            bpm         = vital.bpm;
            spo2        = vital.spo2;
            temperature = vital.temperature;
            lastUpdate  = vital.recorded_at;
          }
        }

        let status: PatientStatus = "offline";
        if (patRow?.status === "alert") status = "alert";
        else if (lastUpdate && (Date.now() - new Date(lastUpdate).getTime()) < 5 * 60 * 1000) {
          status = "online";
        }

        return {
          user_id:      u.id,
          nom:          u.nom,
          prenom:       u.prenom,
          telephone:    u.telephone,
          lien_parente: link?.lien_parente ?? null,
          bpm, spo2, temperature, status, lastUpdate,
        };
      })
    );

    console.log("enriched patients:", enriched);
    setPatients(enriched);

    // Step 5 — alerts
    if (patientRows && patientRows.length > 0) {
      const patientIds = patientRows.map((p) => p.id);
      const { data: alertData, error: alertError } = await supabase
        .from("alerts")
        .select("id, message, severity, created_at, patient_id")
        .in("patient_id", patientIds)
        .order("created_at", { ascending: false })
        .limit(10);

      console.log("6. alerts:", alertData, "error:", alertError);

      if (alertData) {
        const alertsWithNames: AlertItem[] = alertData.map((a) => {
          const patRow = (patientRows ?? []).find((p) => p.id === a.patient_id);
          const util   = (utilisateurs ?? []).find((u) => u.id === patRow?.user_id);
          return {
            id:          a.id,
            message:     a.message,
            severity:    a.severity,
            created_at:  a.created_at,
            patient_nom: util ? `${util.prenom ?? ""} ${util.nom}`.trim() : "Votre proche",
          };
        });
        setAlerts(alertsWithNames);
      }
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ── Link patient ──────────────────────────────────────────────────────────
  const handleLinkPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = inviteCodeInput.trim();
    if (!code) return;
    setLinkLoading(true);
    setLinkError("");
    setLinkSuccess("");

    const { data, error } = await supabase.rpc("consume_invite_code", { p_code: code });
    setLinkLoading(false);

    if (error) { setLinkError(error.message || "Code invalide ou expiré."); return; }

    const res = data as { ok?: boolean; error?: string; already_linked?: boolean };
    if (res?.ok === false) { setLinkError(res.error ?? "Code invalide ou expiré."); return; }

    setInviteCodeInput("");
    setLinkSuccess(res.already_linked ? "Vous êtes déjà lié à ce patient." : "Lien établi avec succès ! ✓");
    fetchData();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout role="family">
      <div className="space-y-8 max-w-4xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-foreground">Bonjour 💛</h1>
          <p className="text-lg text-muted-foreground mt-2">Vos proches sont sous bonne garde.</p>
        </motion.div>

        {/* Link patient card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-3xl p-7 shadow-sm">
          <h2 className="text-lg font-bold text-card-foreground mb-2 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            {patients.length === 0 ? "Lier un patient" : "Lier un autre patient"}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Entrez le code d'invitation fourni par la personne que vous accompagnez
            (depuis son espace <strong>Paramètres → Proches</strong>).
          </p>
          <form onSubmit={handleLinkPatient} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={inviteCodeInput}
                onChange={(e) => { setInviteCodeInput(e.target.value); setLinkError(""); setLinkSuccess(""); }}
                placeholder="Code à 6 chiffres"
                maxLength={6}
                className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
              />
              {linkError   && <p className="text-xs text-destructive mt-1">{linkError}</p>}
              {linkSuccess && <p className="text-xs text-safe mt-1">{linkSuccess}</p>}
            </div>
            <button type="submit" disabled={linkLoading || !inviteCodeInput.trim()}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50">
              {linkLoading
                ? <><Loader className="w-4 h-4 animate-spin" /> En cours...</>
                : <><UserPlus className="w-4 h-4" /> Lier</>
              }
            </button>
          </form>
        </motion.div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && patients.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Heart className="w-10 h-10 mx-auto mb-3 text-primary/30" />
            <p className="text-sm">Aucun proche lié pour l'instant.</p>
            <p className="text-xs mt-1">Entrez un code d'invitation ci-dessus pour commencer.</p>
          </div>
        )}

        {/* Patient cards */}
        {!loading && patients.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {patients.map((person, i) => {
              const sc      = statusConfig[person.status] ?? statusConfig.offline;
              const initial = (person.prenom?.[0] ?? person.nom[0]).toUpperCase();
              return (
                <motion.div key={person.user_id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="bg-card border border-border rounded-3xl p-7 shadow-sm">

                  <div className="flex items-center gap-4 mb-6">
                    <div className={`relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold ring-4 ${sc.ring}`}>
                      {initial}
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${sc.color} border-2 border-card animate-pulse`} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-card-foreground">
                        {person.prenom ? `${person.prenom} ${person.nom}` : person.nom}
                      </h2>
                      <p className="text-muted-foreground">{person.lien_parente ?? "Proche"}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-muted/50 rounded-2xl p-4">
                    <div>
                      {person.bpm ? (
                        <>
                          <p className="text-3xl font-bold text-card-foreground">
                            {person.bpm} <span className="text-lg text-muted-foreground">BPM</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            SpO2 {person.spo2 ?? "--"}% · {person.temperature ?? "--"}°C
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Aucune donnée récente</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {person.lastUpdate ? `Mis à jour ${timeAgo(person.lastUpdate)}` : "Capteur inactif"}
                      </p>
                    </div>
                    <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                      person.status === "online" ? "bg-safe/10 text-safe" :
                      person.status === "alert"  ? "bg-critical/10 text-critical" :
                                                   "bg-muted text-muted-foreground"
                    }`}>
                      {sc.label}
                    </div>
                  </div>

                  <div className="mt-4">
                    <button className="w-full flex items-center justify-center gap-2 bg-muted text-foreground py-3.5 rounded-2xl font-semibold text-sm hover:bg-muted/80 transition-all">
                      <MapPin className="w-4 h-4" /> Localiser
                    </button>
                  </div>

                </motion.div>
              );
            })}
          </div>
        )}

        {/* Alert feed */}
        {!loading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-3xl p-7 shadow-sm">
            <h2 className="text-xl font-bold text-card-foreground mb-5">Dernières Nouvelles</h2>
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Heart className="w-8 h-8 mx-auto mb-2 text-safe/50" />
                <p className="text-sm">Aucune alerte récente. Tout va bien ✓</p>
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 p-4 rounded-2xl bg-muted/30">
                    {a.severity === "critique" || a.severity === "warning"
                      ? <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${a.severity === "critique" ? "text-critical" : "text-warning"}`} />
                      : <Heart className="w-5 h-5 text-safe flex-shrink-0 mt-0.5" />
                    }
                    <div>
                      <p className="text-xs font-semibold text-primary mb-0.5">{a.patient_nom}</p>
                      <p className="text-base text-card-foreground leading-relaxed">{a.message}</p>
                      <p className="text-sm text-muted-foreground mt-1">{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Emergency map */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-3xl p-7 shadow-sm">
          <h2 className="text-xl font-bold text-card-foreground mb-4">Localisation d'Urgence</h2>
          <div className="bg-muted rounded-2xl h-48 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Position GPS de votre proche</p>
              <p className="text-xs text-muted-foreground">Disponible quand le capteur est actif</p>
            </div>
          </div>
        </motion.div>

      </div>
    </DashboardLayout>
  );
};

export default FamilyDashboard;