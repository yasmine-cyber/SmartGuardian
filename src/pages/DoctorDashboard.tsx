import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Users, AlertTriangle, Activity, TrendingUp,
  Bell, BarChart3, MessageSquare, ChevronRight,
  CheckCircle, Loader, UserPlus,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";

interface Patient { id: string; status: string; }
interface Alerte {
  id: string; patient_id: string; severity: string;
  type: string; message: string; resolved: boolean;
  created_at: string; patient_nom?: string;
}

// ─── Palette ─────────────────────────────────────────────────────────────────
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
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.18)",
  borderRadius: "22px",
  boxShadow: "0 8px 32px rgba(30,60,50,0.08), 0 1px 0 rgba(255,255,255,0.9) inset",
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: C.muted,   bg: "rgba(192,80,74,0.10)",  border: "rgba(192,80,74,0.30)"  },
  CRITIQUE: { color: C.muted,   bg: "rgba(192,80,74,0.10)",  border: "rgba(192,80,74,0.30)"  },
  HIGH:     { color: "#d4843a", bg: "rgba(212,132,58,0.10)", border: "rgba(212,132,58,0.30)" },
  MOYEN:    { color: C.gold,    bg: "rgba(212,168,67,0.12)", border: "rgba(212,168,67,0.30)" },
  MEDIUM:   { color: C.gold,    bg: "rgba(212,168,67,0.12)", border: "rgba(212,168,67,0.30)" },
  FAIBLE:   { color: C.primary, bg: "rgba(74,157,135,0.10)", border: "rgba(74,157,135,0.28)" },
  LOW:      { color: C.primary, bg: "rgba(74,157,135,0.10)", border: "rgba(74,157,135,0.28)" },
};

const quickLinks = [
  { to: "/doctor/patients",  label: "Mes patients",     icon: Users,         description: "Liste et fiches patients"       },
  { to: "/doctor/alerts",    label: "Alertes critiques", icon: Bell,          description: "Gérer les alertes"              },
  { to: "/doctor/analytics", label: "Analyses",          icon: BarChart3,     description: "Statistiques et graphiques"     },
  { to: "/doctor/messages",  label: "Messages",          icon: MessageSquare, description: "Échanger avec les patients"     },
];

const KPI_CONFIG = [
  { icon: Users,         label: "Patients",      key: "total",      color: C.primary,   bg: "rgba(74,157,135,0.10)",  border: "rgba(74,157,135,0.22)"  },
  { icon: AlertTriangle, label: "Alertes",       key: "alertes",    color: C.muted,     bg: "rgba(192,80,74,0.10)",   border: "rgba(192,80,74,0.22)"   },
  { icon: Activity,      label: "Critiques",     key: "critical",   color: "#d4843a",   bg: "rgba(212,132,58,0.10)",  border: "rgba(212,132,58,0.22)"  },
  { icon: TrendingUp,    label: "Surveillance",  key: "attention",  color: C.gold,      bg: "rgba(212,168,67,0.12)",  border: "rgba(212,168,67,0.26)"  },
] as const;

const DoctorDashboard = () => {
  const [doctorName, setDoctorName]       = useState<string | null>(null);
  const [patients, setPatients]           = useState<Patient[]>([]);
  const [alertes, setAlertes]             = useState<Alerte[]>([]);
  const [demandesCount, setDemandesCount] = useState(0);
  const [loading, setLoading]             = useState(true);

  const refetchPatients = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("patients").select("id, status").eq("medecin_id", user.id);
    if (data) setPatients(data);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: util } = await supabase.from("utilisateurs").select("nom, prenom").eq("id", user.id).single();
      if (util) setDoctorName([util.prenom, util.nom].filter(Boolean).join(" ") || util.nom);

      const { data: patientsData } = await supabase
        .from("patients")
        .select("id, status, utilisateurs!patients_user_id_fkey (nom, prenom)")
        .eq("medecin_id", user.id);

      if (patientsData?.length) {
        setPatients(patientsData.map((p: any) => ({ id: p.id, status: p.status || "offline" })));
        const patientIds = patientsData.map((p: any) => p.id);
        const { data: alertesData } = await supabase
          .from("alerts").select("*").in("patient_id", patientIds)
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
        .from("demandes").select("*", { count: "exact", head: true })
        .eq("medecin_id", user.id).eq("statut", "en_attente");
      setDemandesCount(count ?? 0);
      setLoading(false);
    };
    init();
  }, []);

  const unresolvedAlertes = alertes.filter((a) => !a.resolved);
  const latestAlertes     = unresolvedAlertes.slice(0, 3);

  const kpiValues = {
    total:     patients.length,
    alertes:   unresolvedAlertes.length,
    critical:  patients.filter((p) => p.status === "critical").length,
    attention: patients.filter((p) => p.status === "attention").length,
  };

  return (
    <DashboardLayout role="doctor">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        .dd-root {
          font-family: 'DM Sans', sans-serif;
          position: relative;
          min-height: 100vh;
          background: linear-gradient(135deg, #edf7f4 0%, #e6f2f7 50%, #f0f7f5 100%);
          margin: -24px;
          padding: 24px;
        }
        .dd-root h1, .dd-root h2, .dd-sora { font-family: 'Sora', sans-serif !important; }
        .dd-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes ddAurora {
          0%,100% { transform: translate(0,0) scale(1); opacity:.55; }
          50%      { transform: translate(28px,-18px) scale(1.06); opacity:.85; }
        }
        .dd-aurora { position:fixed; border-radius:50%; filter:blur(90px); pointer-events:none; z-index:0; }
        .dd-content { position:relative; z-index:1; }

        .dd-card { transition: transform .28s cubic-bezier(.22,1,.36,1), box-shadow .28s; }
        .dd-card:hover { transform: translateY(-2px); box-shadow: 0 20px 48px rgba(30,60,50,0.10) !important; }

        .dd-quicklink {
          display:flex; align-items:center; gap:16px;
          padding:18px 20px; text-decoration:none;
          transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s, border-color .2s;
        }
        .dd-quicklink:hover { transform: translateY(-2px); box-shadow: 0 18px 44px rgba(74,157,135,0.12) !important; border-color: rgba(74,157,135,0.38) !important; }
        .dd-quicklink:hover .dd-ql-icon { transform: scale(1.08); }
        .dd-quicklink:hover .dd-ql-label { color: #4a9d87; }
        .dd-quicklink:hover .dd-ql-chevron { transform: translateX(2px); }
        .dd-ql-icon { transition: transform .2s; }
        .dd-ql-label { transition: color .2s; }
        .dd-ql-chevron { transition: transform .2s; }

        .dd-alert-row { transition: background .15s; border-radius: 14px; }
        .dd-alert-row:hover { background: rgba(74,157,135,0.05) !important; }
      `}</style>

      <div className="dd-root">
        {/* Aurora orbs */}
        <div className="dd-aurora" style={{ width:480, height:480, background:"rgba(74,157,135,0.16)", top:"2%",  right:"3%",  animation:"ddAurora 22s ease-in-out infinite" }} />
        <div className="dd-aurora" style={{ width:380, height:380, background:"rgba(91,143,160,0.13)", top:"50%", left:"0%",   animation:"ddAurora 18s ease-in-out infinite reverse" }} />
        <div className="dd-aurora" style={{ width:300, height:300, background:"rgba(212,168,67,0.08)", bottom:"8%",right:"15%", animation:"ddAurora 26s ease-in-out infinite 3s" }} />

        <div className="dd-content max-w-6xl mx-auto space-y-5">

          {/* ── Welcome + KPIs ── */}
          <motion.section initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
            className="p-6 dd-card" style={glass}>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 8px 24px rgba(74,157,135,0.35)",
                }}>
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight dd-sora" style={{ color: C.text }}>
                  Bonjour{doctorName
                    ? <>, Dr. <span className="dd-gradient-text">{doctorName}</span></>
                    : " 👋"}
                </h1>
                <p className="text-sm mt-0.5" style={{ color: C.textSoft }}>
                  Voici votre activité en un coup d'œil
                </p>
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {KPI_CONFIG.map((s, i) => (
                <motion.div key={s.key}
                  initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                  <s.icon className="w-5 h-5 shrink-0" style={{ color: s.color }} />
                  <div>
                    <p className="text-xl font-bold dd-sora tabular-nums" style={{ color: loading ? C.textSoft : s.color }}>
                      {loading ? "—" : kpiValues[s.key]}
                    </p>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.textSoft }}>{s.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* ── Quick links ── */}
          <motion.section initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.10 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3 dd-sora" style={{ color: C.textSoft }}>
              Accès rapide
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickLinks.map((item, i) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to}
                    className="dd-quicklink dd-card"
                    style={glass}>
                    <div className="dd-ql-icon w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                        boxShadow: "0 4px 14px rgba(74,157,135,0.28)",
                      }}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="dd-ql-label text-sm font-semibold dd-sora" style={{ color: C.text }}>{item.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>{item.description}</p>
                    </div>
                    <ChevronRight className="dd-ql-chevron w-4 h-4 shrink-0" style={{ color: C.textSoft }} />
                  </Link>
                );
              })}
            </div>
          </motion.section>

          {/* ── À traiter ── */}
          <motion.section initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.16 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3 dd-sora" style={{ color: C.textSoft }}>
              À traiter
            </p>
            <div className="dd-card overflow-hidden" style={glass}>

              {/* Demandes block */}
              <div className="p-5" style={{ borderBottom: "1px solid rgba(74,157,135,0.12)" }}>
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader className="w-5 h-5 animate-spin" style={{ color: C.primary }} />
                  </div>
                ) : demandesCount === 0 ? (
                  <div className="text-center py-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center mx-auto mb-2"
                      style={{ background: "rgba(74,157,135,0.10)" }}>
                      <CheckCircle className="w-5 h-5" style={{ color: C.primary }} />
                    </div>
                    <p className="text-xs font-semibold dd-sora" style={{ color: C.text }}>Aucune demande</p>
                    <Link to="/doctor/patients"
                      className="inline-flex items-center gap-1 mt-2 text-xs font-semibold hover:underline"
                      style={{ color: C.primary }}>
                      Mes patients <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <Link to="/doctor/patients?section=demandes"
                    className="flex items-center gap-3 p-2 -m-2 rounded-xl transition-colors dd-alert-row">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                        boxShadow: "0 4px 12px rgba(74,157,135,0.28)",
                      }}>
                      <UserPlus className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold dd-sora" style={{ color: C.text }}>
                        {demandesCount} demande{demandesCount > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs" style={{ color: C.textSoft }}>Accepter ou refuser</p>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: C.textSoft }} />
                  </Link>
                )}
              </div>

              {/* Alertes block */}
              <div className="p-5">
                {unresolvedAlertes.length === 0 ? (
                  <div className="text-center py-3">
                    <p className="text-xs" style={{ color: C.textSoft }}>Aucune alerte active</p>
                    <Link to="/doctor/alerts"
                      className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold hover:underline"
                      style={{ color: C.primary }}>
                      Voir les alertes <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold dd-sora" style={{ color: C.text }}>Dernières alertes</span>
                      <Link to="/doctor/alerts"
                        className="text-xs font-semibold hover:underline"
                        style={{ color: C.primary }}>
                        Tout voir →
                      </Link>
                    </div>
                    <ul className="space-y-1.5">
                      {latestAlertes.map((a) => {
                        const cfg = SEVERITY_CONFIG[a.severity] ?? SEVERITY_CONFIG.FAIBLE;
                        return (
                          <li key={a.id}>
                            <Link to="/doctor/alerts"
                              className="dd-alert-row flex items-center gap-3 p-2.5">
                              <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                                {a.severity}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold dd-sora truncate" style={{ color: C.text }}>{a.patient_nom}</p>
                                <p className="text-[11px] truncate" style={{ color: C.textSoft }}>{a.message}</p>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: C.textSoft }} />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>

            </div>
          </motion.section>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoctorDashboard;