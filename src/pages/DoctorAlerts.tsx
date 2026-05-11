import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCircle, Loader, ChevronDown, ChevronUp } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";

interface Alerte {
  id: string;
  patient_id: string;
  severity: string;
  type: string;
  message: string;
  resolved: boolean;
  created_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  patient_nom?: string;
}

const SEVERITY_CONFIG: Record<string, { label: string; classes: string; headerBg: string }> = {
  CRITICAL: { label: "Critique", classes: "bg-red-500/10 text-red-500 border-red-500/20",         headerBg: "bg-red-500/10 border-red-500/20" },
  HIGH:     { label: "Élevé",    classes: "bg-orange-500/10 text-orange-500 border-orange-500/20", headerBg: "bg-orange-500/10 border-orange-500/20" },
  MEDIUM:   { label: "Moyen",    classes: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", headerBg: "bg-yellow-500/10 border-yellow-500/20" },
  LOW:      { label: "Faible",   classes: "bg-green-500/10 text-green-500 border-green-500/20",    headerBg: "bg-green-500/10 border-green-500/20" },
};

const AlerteCard = ({
  alerte,
  onResolve,
}: {
  alerte: Alerte;
  onResolve: (id: string) => void;
}) => {
  const config = SEVERITY_CONFIG[alerte.severity] ?? SEVERITY_CONFIG.LOW;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-3 flex flex-col gap-2"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{alerte.patient_nom}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alerte.message}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(alerte.created_at).toLocaleString("fr-FR")} • {alerte.type}
        </p>
      </div>
      <button
        onClick={() => onResolve(alerte.id)}
        className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 bg-green-500/10 text-green-500 rounded-lg text-xs font-medium hover:bg-green-500/20 transition-all"
      >
        <CheckCircle className="w-3.5 h-3.5" /> Résoudre
      </button>
    </motion.div>
  );
};

const ResolvedCard = ({ alerte }: { alerte: Alerte }) => {
  const config = SEVERITY_CONFIG[alerte.severity] ?? SEVERITY_CONFIG.LOW;
  return (
    <div className="bg-muted/30 border border-border/50 rounded-2xl p-4 flex items-start gap-4 opacity-70">
      <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-muted text-muted-foreground flex-shrink-0">
        {config.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{alerte.patient_nom}</p>
        <p className="text-sm text-muted-foreground">{alerte.message}</p>
        <div className="flex flex-wrap gap-x-3 mt-1">
          <p className="text-xs text-muted-foreground">
            Créée le {new Date(alerte.created_at).toLocaleString("fr-FR")}
          </p>
          {alerte.resolved_at && (
            <p className="text-xs text-green-600">
              Résolue le {new Date(alerte.resolved_at).toLocaleString("fr-FR")}
            </p>
          )}
        </div>
      </div>
      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
    </div>
  );
};

const DoctorAlerts = () => {
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patientsData } = await supabase
        .from("patients")
        .select("id, utilisateurs!patients_user_id_fkey (nom, prenom)")
        .eq("medecin_id", user.id);

      if (!patientsData?.length) {
        setLoading(false);
        return;
      }

      const patientIds = patientsData.map((p: any) => p.id);
      const { data: alertesData } = await supabase
        .from("alerts")
        .select("*")
        .in("patient_id", patientIds)
        .order("created_at", { ascending: false });

      if (alertesData) {
        const mapped = alertesData.map((a: any) => {
          const patient = patientsData.find((p: any) => p.id === a.patient_id) as any;
          return {
            ...a,
            patient_nom: patient
              ? [patient.utilisateurs?.prenom, patient.utilisateurs?.nom].filter(Boolean).join(" ")
              : "Inconnu",
          };
        });
        setAlertes(mapped);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleResolve = async (alerteId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("alerts")
      .update({ resolved: true, resolved_by: user?.id, resolved_at: new Date().toISOString() })
      .eq("id", alerteId);
    setAlertes((prev) =>
      prev.map((a) =>
        a.id === alerteId
          ? { ...a, resolved: true, resolved_at: new Date().toISOString() }
          : a
      )
    );
  };

  const unresolved = alertes.filter((a) => !a.resolved);
  const resolved   = alertes.filter((a) => a.resolved);

  const bySeverity = (list: Alerte[], level: string) =>
    list.filter((a) => a.severity === level);

  return (
    <DashboardLayout role="doctor">
      <div className="space-y-6 max-w-7xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Alertes</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {unresolved.length} non résolue{unresolved.length > 1 ? "s" : ""}
                {" · "}
                {resolved.length} résolue{resolved.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : alertes.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Aucune alerte</p>
            <p className="text-xs text-muted-foreground mt-1">Tous vos patients sont stables</p>
          </div>
        ) : (
          <>
            {/* ── Colonnes horizontales par sévérité ── */}
            {unresolved.length === 0 ? (
              <div className="text-center py-10 bg-card border border-border rounded-2xl">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Toutes les alertes sont résolues</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
                {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((level) => {
                  const config = SEVERITY_CONFIG[level];
                  const items = bySeverity(unresolved, level);
                  return (
                    <div key={level} className="flex flex-col gap-2">
                      {/* Colonne header */}
                      <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${config.headerBg}`}>
                        <span className={`text-xs font-semibold ${config.classes.split(" ").find(c => c.startsWith("text-"))}`}>
                          {config.label}
                        </span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${config.classes}`}>
                          {items.length}
                        </span>
                      </div>
                      {/* Cartes */}
                      {items.length === 0 ? (
                        <div className="bg-muted/20 border border-dashed border-border rounded-xl p-4 text-center">
                          <p className="text-xs text-muted-foreground">Aucune alerte</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {items.map((a) => (
                            <AlerteCard key={a.id} alerte={a} onResolve={handleResolve} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Historique résolues (toggle collapsé) ── */}
            {resolved.length > 0 && (
              <div className="border-t border-border pt-4">
                <button
                  onClick={() => setShowResolved((v) => !v)}
                  className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                >
                  {showResolved
                    ? <ChevronUp className="w-4 h-4" />
                    : <ChevronDown className="w-4 h-4" />}
                  Historique des résolues ({resolved.length})
                </button>

                <AnimatePresence>
                  {showResolved && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 mt-3">
                        {resolved.map((a) => (
                          <ResolvedCard key={a.id} alerte={a} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorAlerts;