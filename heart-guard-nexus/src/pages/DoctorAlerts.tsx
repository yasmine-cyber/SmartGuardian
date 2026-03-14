import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCircle, Loader } from "lucide-react";
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
  patient_nom?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITIQUE: "bg-red-500/10 text-red-500 border-red-500/20",
  MOYEN: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  FAIBLE: "bg-green-500/10 text-green-500 border-green-500/20",
};

const DoctorAlerts = () => {
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleResolveAlerte = async (alerteId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("alerts")
      .update({ resolved: true, resolved_by: user?.id, resolved_at: new Date().toISOString() })
      .eq("id", alerteId);
    setAlertes((prev) => prev.map((a) => (a.id === alerteId ? { ...a, resolved: true } : a)));
  };

  const unresolved = alertes.filter((a) => !a.resolved);
  const resolved = alertes.filter((a) => a.resolved);

  return (
    <DashboardLayout role="doctor">
      <div className="space-y-6 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Alertes critiques</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {unresolved.length} alerte(s) non résolue(s) • {resolved.length} résolue(s)
          </p>
        </motion.div>

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
            {unresolved.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Non résolues ({unresolved.length})
                </p>
                <div className="space-y-2">
                  {unresolved.map((a) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card border border-border rounded-2xl p-4 flex items-start gap-4"
                    >
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${
                          SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.FAIBLE
                        }`}
                      >
                        {a.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{a.patient_nom}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{a.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(a.created_at).toLocaleString("fr-FR")} • {a.type}
                        </p>
                      </div>
                      <button
                        onClick={() => handleResolveAlerte(a.id)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-xl text-xs font-medium hover:bg-green-500/20 transition-all"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Résoudre
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
            {resolved.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Résolues
                </p>
                <div className="space-y-2">
                  {resolved.map((a) => (
                    <div
                      key={a.id}
                      className="bg-muted/30 border border-border/50 rounded-2xl p-4 flex items-start gap-4 opacity-60"
                    >
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-muted text-muted-foreground flex-shrink-0">
                        {a.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{a.patient_nom}</p>
                        <p className="text-sm text-muted-foreground">{a.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(a.created_at).toLocaleString("fr-FR")}
                        </p>
                      </div>
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorAlerts;
