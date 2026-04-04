import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Users,
  AlertTriangle,
  Activity,
  TrendingUp,
  Bell,
  BarChart3,
  MessageSquare,
  ChevronRight,
  CheckCircle,
  Loader,
  UserPlus,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";

interface Patient {
  id: string;
  status: string;
}

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

const quickLinks = [
  { to: "/doctor/patients", label: "Mes patients", icon: Users, description: "Liste et fiches patients" },
  { to: "/doctor/alerts", label: "Alertes critiques", icon: Bell, description: "Gérer les alertes" },
  { to: "/doctor/analytics", label: "Analyses", icon: BarChart3, description: "Statistiques et graphiques" },
  { to: "/doctor/messages", label: "Messages", icon: MessageSquare, description: "Échanger avec les patients" },
];

const DoctorDashboard = () => {
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [demandesCount, setDemandesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refetchPatients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("patients")
      .select("id, status")
      .eq("medecin_id", user.id);
    if (data) setPatients(data);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: util } = await supabase
        .from("utilisateurs")
        .select("nom, prenom")
        .eq("id", user.id)
        .single();
      if (util) {
        setDoctorName([util.prenom, util.nom].filter(Boolean).join(" ") || util.nom);
      }

      const { data: patientsData } = await supabase
        .from("patients")
        .select("id, status, utilisateurs!patients_user_id_fkey (nom, prenom)")
        .eq("medecin_id", user.id);

      if (patientsData?.length) {
        setPatients(patientsData.map((p: any) => ({ id: p.id, status: p.status || "offline" })));
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
      }

      const { count } = await supabase
        .from("demandes")
        .select("*", { count: "exact", head: true })
        .eq("medecin_id", user.id)
        .eq("statut", "en_attente");
      setDemandesCount(count ?? 0);

      setLoading(false);
    };
    init();
  }, []);

  const unresolvedAlertes = alertes.filter((a) => !a.resolved);
  const latestAlertes = unresolvedAlertes.slice(0, 3);

  const kpis = [
    { icon: Users, label: "Patients", value: patients.length, color: "text-primary", bg: "bg-primary/5" },
    { icon: AlertTriangle, label: "Alertes", value: unresolvedAlertes.length, color: "text-red-500", bg: "bg-red-500/5" },
    { icon: Activity, label: "Critiques", value: patients.filter((p) => p.status === "critical").length, color: "text-amber-500", bg: "bg-amber-500/5" },
    { icon: TrendingUp, label: "Surveillance", value: patients.filter((p) => p.status === "attention").length, color: "text-emerald-500", bg: "bg-emerald-500/5" },
  ];

  return (
    <DashboardLayout role="doctor">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm"
        >
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Bonjour{doctorName ? `, Dr. ${doctorName}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Voici votre activité en un coup d’œil
          </p>

          {/* KPI cards — under the greeting */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            {kpis.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 ${s.bg} border border-border/50`}
              >
                <s.icon className={`w-5 h-5 ${s.color} shrink-0`} />
                <div>
                  <p className="text-lg font-bold text-foreground tabular-nums">{loading ? "—" : s.value}</p>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Accès rapide — 2x2 grid */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Accès rapide
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-4 bg-card border border-border rounded-2xl p-5 shadow-sm hover:border-primary/40 hover:shadow-md hover:bg-card/80 transition-all duration-200 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 group-hover:scale-105 transition-all duration-200 shrink-0">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              );
            })}
          </div>
        </motion.section>

        {/* À traiter — Demandes + Alertes (under Accès rapide) */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              À traiter
            </h2>
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              {/* Demandes block */}
              <div className="p-4 border-b border-border/60">
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader className="w-5 h-5 text-primary animate-spin" />
                  </div>
                ) : demandesCount === 0 ? (
                  <div className="text-center py-4">
                    <CheckCircle className="w-8 h-8 text-emerald-500/80 mx-auto mb-2" />
                    <p className="text-xs font-medium text-foreground">Aucune demande</p>
                    <Link to="/doctor/patients" className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-primary hover:underline">
                      Mes patients <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <Link
                    to="/doctor/patients?section=demandes"
                    className="flex items-center gap-3 p-2 -m-2 rounded-xl hover:bg-muted/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {demandesCount} demande{demandesCount > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">Accepter ou refuser</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                )}
              </div>

              {/* Alertes block */}
              <div className="p-4">
                {unresolvedAlertes.length === 0 ? (
                  <div className="text-center py-3">
                    <p className="text-xs text-muted-foreground">Aucune alerte active</p>
                    <Link to="/doctor/alerts" className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-primary hover:underline">
                      Voir les alertes <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-foreground">Dernières alertes</span>
                      <Link to="/doctor/alerts" className="text-xs font-medium text-primary hover:underline">
                        Tout voir →
                      </Link>
                    </div>
                    <ul className="space-y-2">
                      {latestAlertes.map((a) => (
                        <li key={a.id}>
                          <Link
                            to="/doctor/alerts"
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.FAIBLE}`}>
                              {a.severity}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{a.patient_nom}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{a.message}</p>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </motion.section>
      </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
