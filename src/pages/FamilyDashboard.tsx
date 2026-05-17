import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Heart, AlertCircle, Loader, UserPlus,
  Users, Bell, MessageSquare, ChevronRight,
  Activity, WifiOff, MapPin,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type PatientStatus = "online" | "offline" | "alert";

interface LinkedPatient {
  patient_user_id: string;
  patient_row_id:  string;
  nom: string;
  prenom: string | null;
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

const STATUS_CFG: Record<PatientStatus, { dot: string; ring: string; label: string; bg: string; text: string }> = {
  online:  { dot: "bg-emerald-500", ring: "ring-emerald-200 dark:ring-emerald-800", label: "En ligne",      bg: "bg-emerald-50 dark:bg-emerald-900/20",  text: "text-emerald-600 dark:text-emerald-400" },
  offline: { dot: "bg-slate-400",   ring: "ring-slate-200 dark:ring-slate-700",     label: "Hors ligne",    bg: "bg-slate-100 dark:bg-slate-800",         text: "text-slate-500 dark:text-slate-400"     },
  alert:   { dot: "bg-red-500",     ring: "ring-red-200 dark:ring-red-800",         label: "Alerte active", bg: "bg-red-50 dark:bg-red-900/20",           text: "text-red-600 dark:text-red-400"         },
};

function normalizeSeverity(s: string): "critical" | "medium" | "low" {
  const v = (s || "").toUpperCase();
  if (["CRITICAL", "CRITIQUE"].includes(v))              return "critical";
  if (["MEDIUM", "MOYEN", "HIGH", "ELEVE"].includes(v)) return "medium";
  return "low";
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return `il y a ${diff}s`;
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const FamilyDashboard = () => {
  const navigate = useNavigate();
  const [patients,        setPatients]        = useState<LinkedPatient[]>([]);
  const [alerts,          setAlerts]          = useState<AlertItem[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [linkLoading,     setLinkLoading]     = useState(false);
  const [linkError,       setLinkError]       = useState("");
  const [linkSuccess,     setLinkSuccess]     = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: links } = await supabase
      .from("proche_patient").select("patient_id, lien_parente").eq("proche_id", user.id);
    if (!links?.length) { setLoading(false); return; }

    const patientUserIds = links.map((l) => l.patient_id);
    const [{ data: utilisateurs }, { data: patientRows }] = await Promise.all([
      supabase.from("utilisateurs").select("id, nom, prenom").in("id", patientUserIds),
      supabase.from("patients").select("id, user_id, status").in("user_id", patientUserIds),
    ]);

    const enriched: LinkedPatient[] = await Promise.all(
      (utilisateurs ?? []).map(async (u) => {
        const link   = links.find((l) => l.patient_id === u.id);
        const patRow = (patientRows ?? []).find((p) => p.user_id === u.id);
        let bpm = null, spo2 = null, temperature = null, lastUpdate = null;
        if (patRow?.id) {
          const { data: device } = await supabase.from("devices").select("id")
            .eq("patient_id", patRow.id).eq("actif", true)
            .order("created_at", { ascending: false }).limit(1).single();
          if (device?.id) {
            const { data: vital } = await supabase.from("vital_signs")
              .select("bpm, spo2, temperature, recorded_at").eq("device_id", device.id)
              .order("recorded_at", { ascending: false }).limit(1).single();
            if (vital) { bpm = vital.bpm; spo2 = vital.spo2; temperature = vital.temperature; lastUpdate = vital.recorded_at; }
          }
        }
        let status: PatientStatus = "offline";
        if (patRow?.status === "alert") status = "alert";
        else if (lastUpdate && Date.now() - new Date(lastUpdate).getTime() < 5 * 60_000) status = "online";
        return { patient_user_id: u.id, patient_row_id: patRow?.id ?? "", nom: u.nom, prenom: u.prenom, lien_parente: link?.lien_parente ?? null, bpm, spo2, temperature, status, lastUpdate };
      })
    );
    setPatients(enriched);

    const pRowIds = (patientRows ?? []).map((p) => p.id).filter(Boolean);
    if (pRowIds.length) {
      const { data: alertData } = await supabase.from("alerts")
        .select("id, message, severity, created_at, patient_id")
        .in("patient_id", pRowIds).order("created_at", { ascending: false }).limit(5);
      if (alertData) {
        setAlerts(alertData.map((a) => {
          const pr = (patientRows ?? []).find((p) => p.id === a.patient_id);
          const u  = (utilisateurs ?? []).find((x) => x.id === pr?.user_id);
          return { id: a.id, message: a.message, severity: a.severity ?? "", created_at: a.created_at, patient_nom: u ? `${u.prenom ?? ""} ${u.nom}`.trim() : "Votre proche" };
        }));
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleLinkPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = inviteCodeInput.trim();
    if (!code) return;
    setLinkLoading(true); setLinkError(""); setLinkSuccess("");
    const { data, error } = await supabase.rpc("consume_invite_code", { p_code: code });
    setLinkLoading(false);
    if (error) { setLinkError(error.message || "Code invalide ou expiré."); return; }
    const res = data as { ok?: boolean; error?: string; already_linked?: boolean };
    if (res?.ok === false) { setLinkError(res.error ?? "Code invalide ou expiré."); return; }
    setInviteCodeInput("");
    setLinkSuccess(res.already_linked ? "Déjà lié à ce patient." : "Lien établi avec succès ✓");
    fetchData();
  };

  const onlineCount    = patients.filter((p) => p.status === "online").length;
  const alertCount     = patients.filter((p) => p.status === "alert").length;
  const criticalAlerts = alerts.filter((a) => normalizeSeverity(a.severity) === "critical");

  return (
    <DashboardLayout role="family">
      <div className="space-y-6 max-w-4xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-foreground">Bonjour 💛</h1>
          <p className="text-muted-foreground mt-1 text-sm">Vue d'ensemble de vos proches</p>
        </motion.div>

        {/* Stats */}
        {!loading && patients.length > 0 && (
          <motion.div className="grid grid-cols-3 gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            {[
              { label: "Proches",  value: patients.length, active: false },
              { label: "En ligne", value: onlineCount,     active: onlineCount > 0,  activeClass: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800", valClass: "text-emerald-600 dark:text-emerald-400" },
              { label: "En alerte", value: alertCount,     active: alertCount > 0,   activeClass: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",         valClass: "text-red-600 dark:text-red-400"     },
            ].map((s) => (
              <div key={s.label} className={`rounded-2xl p-4 text-center shadow-sm border transition-all ${s.active ? s.activeClass : "bg-card border-border"}`}>
                <p className={`text-2xl font-bold ${s.active ? s.valClass : "text-foreground"}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Navigation shortcuts */}
        {!loading && patients.length > 0 && (
          <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {[
              { icon: Users,         label: "Mes Proches",   desc: `${patients.length} fiche${patients.length > 1 ? "s" : ""}`,                                             route: "/family/proches",  badge: 0,                    iconColor: "text-primary",  iconBg: "bg-primary/10" },
              { icon: Bell,          label: "Alertes",        desc: alerts.length ? `${alerts.length} récente${alerts.length > 1 ? "s" : ""}` : "Aucune alerte",            route: "/family/alerts",   badge: criticalAlerts.length, iconColor: criticalAlerts.length ? "text-red-500" : "text-primary", iconBg: criticalAlerts.length ? "bg-red-50 dark:bg-red-900/20" : "bg-primary/10" },
              { icon: MessageSquare, label: "Messagerie",     desc: "Contacter l'équipe soignante",                                                                          route: "/family/messages", badge: 0,                    iconColor: "text-primary",  iconBg: "bg-primary/10" },
            ].map((card, i) => (
              <button key={i} onClick={() => navigate(card.route)}
                className="bg-card border border-border rounded-2xl p-4 text-left hover:shadow-md hover:border-primary/30 transition-all shadow-sm group flex items-center gap-3">
                <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${card.iconBg} group-hover:scale-110 transition-transform`}>
                  <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                  {card.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{card.badge}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-card-foreground text-sm">{card.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{card.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </button>
            ))}
          </motion.div>
        )}

        {/* Loading */}
        {loading && <div className="flex items-center justify-center py-20"><Loader className="w-6 h-6 text-primary animate-spin" /></div>}

        {/* Patient cards */}
        {!loading && patients.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground">Vos proches</h2>
              <button onClick={() => navigate("/family/proches")} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                Voir les fiches <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patients.map((person, i) => {
                const sc = STATUS_CFG[person.status];
                const initial = (person.prenom?.[0] ?? person.nom[0]).toUpperCase();
                return (
                  <motion.button key={person.patient_user_id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }}
                    onClick={() => navigate("/family/proches")}
                    className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/20 transition-all text-left w-full group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`relative w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-bold ring-4 ${sc.ring} flex-shrink-0`}>
                        {initial}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${sc.dot} border-2 border-card ${person.status !== "offline" ? "animate-pulse" : ""}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-card-foreground truncate">{person.prenom ? `${person.prenom} ${person.nom}` : person.nom}</p>
                        <p className="text-xs text-muted-foreground">{person.lien_parente ?? "Proche"}</p>
                      </div>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${sc.bg} ${sc.text}`}>{sc.label}</span>
                    </div>
                    <div className="bg-muted/40 rounded-xl p-3 flex flex-wrap items-center gap-3">
                      {person.bpm ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-red-400" />
                            <span className="text-sm font-bold text-foreground">{person.bpm}</span>
                            <span className="text-xs text-muted-foreground">BPM</span>
                          </div>
                          <div className="h-4 w-px bg-border" />
                          <span className="text-xs text-muted-foreground">SpO₂ {person.spo2 ?? "--"}%</span>
                          <div className="h-4 w-px bg-border" />
                          <span className="text-xs text-muted-foreground">{person.temperature ?? "--"}°C</span>
                          {person.lastUpdate && <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(person.lastUpdate)}</span>}
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <WifiOff className="w-3.5 h-3.5" />
                          <span className="text-xs">Capteur inactif</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="text-xs">{person.status === "online" ? "Localisation disponible" : "Localisation inactive"}</span>
                      </div>
                      <span className="text-xs text-primary font-medium flex items-center gap-0.5 group-hover:underline">Voir la fiche <ChevronRight className="w-3 h-3" /></span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Recent alerts preview */}
        {!loading && patients.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
            className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Bell className="w-4 h-4 text-primary" />Dernières alertes</h2>
              <button onClick={() => navigate("/family/alerts")} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">Tout voir <ChevronRight className="w-3 h-3" /></button>
            </div>
            {alerts.length === 0 ? (
              <div className="text-center py-5">
                <Heart className="w-7 h-7 mx-auto mb-2 text-emerald-400/50" />
                <p className="text-sm text-muted-foreground">Aucune alerte récente — tout va bien ✓</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 4).map((a) => {
                  const sev = normalizeSeverity(a.severity);
                  return (
                    <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                      <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${sev === "critical" ? "text-red-500" : sev === "medium" ? "text-amber-500" : "text-primary"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-primary">{a.patient_nom}</p>
                        <p className="text-sm text-foreground leading-snug">{a.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(a.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                {alerts.length > 4 && (
                  <button onClick={() => navigate("/family/alerts")} className="w-full text-xs text-primary font-medium py-2 hover:underline">
                    +{alerts.length - 4} autres alertes →
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Empty state */}
        {!loading && patients.length === 0 && (
          <div className="text-center py-12 bg-card border border-border rounded-2xl">
            <Heart className="w-10 h-10 mx-auto mb-3 text-primary/30" />
            <p className="text-sm font-semibold text-foreground">Aucun proche lié pour l'instant</p>
            <p className="text-xs text-muted-foreground mt-1">Entrez un code d'invitation ci-dessous pour commencer</p>
          </div>
        )}

        {/* Link card */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-card-foreground mb-1 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            {patients.length === 0 ? "Lier un patient" : "Ajouter un autre proche"}
          </h2>
          <p className="text-xs text-muted-foreground mb-3">Code fourni par votre proche via <strong>Paramètres → Proches</strong></p>
          <form onSubmit={handleLinkPatient} className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-[150px]">
              <input type="text" inputMode="numeric" value={inviteCodeInput}
                onChange={(e) => { setInviteCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6)); setLinkError(""); setLinkSuccess(""); }}
                placeholder="000000" maxLength={6}
                className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm font-mono text-center tracking-widest text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
              {linkError   && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{linkError}</p>}
              {linkSuccess && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{linkSuccess}</p>}
            </div>
            <button type="submit" disabled={linkLoading || inviteCodeInput.length < 6}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50">
              {linkLoading ? <><Loader className="w-4 h-4 animate-spin" />En cours…</> : <><UserPlus className="w-4 h-4" />Lier</>}
            </button>
          </form>
        </motion.div>

        {/* Messagerie CTA */}
        {!loading && patients.length > 0 && (
          <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
            onClick={() => navigate("/family/messages")}
            className="w-full bg-primary/5 border border-primary/20 hover:bg-primary/10 rounded-2xl p-4 flex items-center gap-3 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-foreground">Messagerie médicale</p>
              <p className="text-xs text-muted-foreground">Contacter l'équipe médicale de votre proche</p>
            </div>
            <ChevronRight className="w-4 h-4 text-primary flex-shrink-0" />
          </motion.button>
        )}

      </div>
    </DashboardLayout>
  );
};

export default FamilyDashboard;