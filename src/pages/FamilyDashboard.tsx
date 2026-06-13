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

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.16)",
  borderRadius: "22px",
  boxShadow: "0 12px 36px rgba(30,60,50,0.06)",
};

const STATUS_CFG: Record<PatientStatus, {
  dot: string; label: string; color: string; bg: string; border: string; ring: string;
}> = {
  online:  { dot: "#22c55e", label: "En ligne",      color: "#16a34a", bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.25)",  ring: "rgba(34,197,94,0.20)"  },
  offline: { dot: "#94a3b8", label: "Hors ligne",    color: "#64748b", bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.22)", ring: "rgba(148,163,184,0.18)" },
  alert:   { dot: C.muted,   label: "Alerte active", color: C.muted,   bg: "rgba(192,80,74,0.10)",  border: "rgba(192,80,74,0.28)",  ring: "rgba(192,80,74,0.18)"  },
};

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

  /* ── Render ── */
  return (
    <DashboardLayout role="family">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .fd-page * { font-family: 'DM Sans', sans-serif; }
        .fd-page h1, .fd-page h2, .fd-sora { font-family: 'Sora', sans-serif !important; }
        .fd-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes fdAurora {
          0%,100% { transform: translate(0,0) scale(1); opacity: .48; }
          50%      { transform: translate(26px,-16px) scale(1.05); opacity: .75; }
        }
        .fd-aurora { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; }
        .fd-card { transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s, border-color .2s; }
        .fd-card:hover { transform: translateY(-2px); box-shadow: 0 18px 44px rgba(30,60,50,0.09); }
        .fd-nav-card { transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s, border-color .15s; }
        .fd-nav-card:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(74,157,135,0.10); border-color: rgba(74,157,135,0.32) !important; }
        .fd-input { font-family: 'DM Sans', sans-serif; }
        .fd-input:focus { outline: none; box-shadow: 0 0 0 3px rgba(74,157,135,0.16); border-color: rgba(74,157,135,0.42) !important; }
      `}</style>

      <div className="fd-page relative space-y-5 max-w-4xl">

        {/* Aurora blobs */}
        <div className="fd-aurora" style={{ width: 400, height: 400, background: "rgba(74,157,135,0.12)", top: -80, right: -60, animation: "fdAurora 22s ease-in-out infinite" }} />
        <div className="fd-aurora" style={{ width: 320, height: 320, background: "rgba(212,168,67,0.08)", top: 340, left: -100, animation: "fdAurora 18s ease-in-out infinite reverse" }} />

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-3xl relative overflow-hidden" style={glass}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${C.gold}, #e8b84b)`,
                boxShadow: "0 8px 24px rgba(212,168,67,0.32)",
              }}>
              <img src="/logo.png" alt="SmartGuardian" className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight fd-sora" style={{ color: C.text }}>
                Bon<span className="fd-gradient-text">jour 💛</span>
              </h1>
              <p className="text-sm mt-1" style={{ color: C.textSoft }}>Vue d'ensemble de vos proches</p>
            </div>
          </div>
        </motion.div>

        {/* ── Stats ── */}
        {!loading && patients.length > 0 && (
          <motion.div className="grid grid-cols-3 gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            {[
              { label: "Proches",   value: patients.length, color: C.text,    bg: "rgba(74,157,135,0.06)",  border: "rgba(74,157,135,0.14)" },
              { label: "En ligne",  value: onlineCount,     color: onlineCount > 0  ? "#16a34a" : C.text,  bg: onlineCount > 0  ? "rgba(34,197,94,0.08)"   : "rgba(74,157,135,0.06)",  border: onlineCount > 0  ? "rgba(34,197,94,0.22)"   : "rgba(74,157,135,0.14)" },
              { label: "En alerte", value: alertCount,      color: alertCount  > 0  ? C.muted   : C.text,  bg: alertCount  > 0  ? "rgba(192,80,74,0.08)"   : "rgba(74,157,135,0.06)",  border: alertCount  > 0  ? "rgba(192,80,74,0.22)"   : "rgba(74,157,135,0.14)" },
            ].map((s) => (
              <div key={s.label} className="fd-card text-center p-4 rounded-[18px]"
                style={{ background: s.bg, border: `1px solid ${s.border}`, backdropFilter: "blur(8px)" }}>
                <p className="text-2xl font-bold fd-sora" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs mt-0.5 font-medium" style={{ color: C.textSoft }}>{s.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Nav shortcuts ── */}
        {!loading && patients.length > 0 && (
          <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}>
            {[
              {
                icon: Users,
                label: "Mes Proches",
                desc: `${patients.length} fiche${patients.length > 1 ? "s" : ""}`,
                route: "/family/proches",
                badge: 0,
                iconGrad: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                iconShadow: "0 6px 16px rgba(74,157,135,0.28)",
              },
              {
                icon: Bell,
                label: "Alertes",
                desc: alerts.length ? `${alerts.length} récente${alerts.length > 1 ? "s" : ""}` : "Aucune alerte",
                route: "/family/alerts",
                badge: criticalAlerts.length,
                iconGrad: criticalAlerts.length
                  ? `linear-gradient(135deg, ${C.muted}, #d4843a)`
                  : `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                iconShadow: criticalAlerts.length
                  ? "0 6px 16px rgba(192,80,74,0.28)"
                  : "0 6px 16px rgba(74,157,135,0.28)",
              },
              {
                icon: MessageSquare,
                label: "Messagerie",
                desc: "Contacter l'équipe soignante",
                route: "/family/messages",
                badge: 0,
                iconGrad: `linear-gradient(135deg, ${C.secondary}, ${C.primary})`,
                iconShadow: "0 6px 16px rgba(91,143,160,0.28)",
              },
            ].map((card, i) => (
              <button key={i} onClick={() => navigate(card.route)}
                className="fd-nav-card text-left p-4 flex items-center gap-3 rounded-[18px]"
                style={glass}>
                <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: card.iconGrad, boxShadow: card.iconShadow }}>
                  <card.icon className="w-5 h-5 text-white" />
                  {card.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center fd-sora"
                      style={{ background: C.muted, boxShadow: "0 2px 8px rgba(192,80,74,0.40)" }}>
                      {card.badge}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm fd-sora" style={{ color: C.text }}>{card.label}</p>
                  <p className="text-xs truncate" style={{ color: C.textSoft }}>{card.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: C.textSoft }} />
              </button>
            ))}
          </motion.div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
          </div>
        )}

        {/* ── Patient cards ── */}
        {!loading && patients.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold fd-sora" style={{ color: C.text }}>Vos proches</h2>
              <button onClick={() => navigate("/family/proches")}
                className="text-xs font-semibold flex items-center gap-1 hover:underline fd-sora"
                style={{ color: C.primary }}>
                Voir les fiches <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patients.map((person, i) => {
                const sc      = STATUS_CFG[person.status];
                const initial = (person.prenom?.[0] ?? person.nom[0]).toUpperCase();
                return (
                  <motion.button key={person.patient_user_id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }}
                    onClick={() => navigate("/family/proches")}
                    className="fd-card text-left w-full p-5 rounded-[20px]"
                    style={glass}>

                    {/* Top row */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
                        style={{
                          background: `linear-gradient(135deg, rgba(74,157,135,0.18), rgba(91,143,160,0.14))`,
                          color: C.primaryDark,
                          boxShadow: `0 0 0 3px ${sc.ring}`,
                        }}>
                        {initial}
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                          style={{
                            background: sc.dot,
                            borderColor: "rgba(255,255,255,0.9)",
                            ...(person.status !== "offline" ? { animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" } : {}),
                          }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate fd-sora" style={{ color: C.text }}>
                          {person.prenom ? `${person.prenom} ${person.nom}` : person.nom}
                        </p>
                        <p className="text-xs" style={{ color: C.textSoft }}>{person.lien_parente ?? "Proche"}</p>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 fd-sora"
                        style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                        {sc.label}
                      </span>
                    </div>

                    {/* Vitals row */}
                    <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl"
                      style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.12)" }}>
                      {person.bpm ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5" style={{ color: C.muted }} />
                            <span className="text-sm font-bold fd-sora" style={{ color: C.text }}>{person.bpm}</span>
                            <span className="text-xs" style={{ color: C.textSoft }}>BPM</span>
                          </div>
                          <div className="h-4 w-px" style={{ background: "rgba(74,157,135,0.20)" }} />
                          <span className="text-xs" style={{ color: C.textSoft }}>SpO₂ {person.spo2 ?? "--"}%</span>
                          <div className="h-4 w-px" style={{ background: "rgba(74,157,135,0.20)" }} />
                          <span className="text-xs" style={{ color: C.textSoft }}>{person.temperature ?? "--"}°C</span>
                          {person.lastUpdate && (
                            <span className="ml-auto text-[10px]" style={{ color: C.textSoft }}>{timeAgo(person.lastUpdate)}</span>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5" style={{ color: C.textSoft }}>
                          <WifiOff className="w-3.5 h-3.5" />
                          <span className="text-xs">Capteur inactif</span>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-3 pt-3"
                      style={{ borderTop: "1px solid rgba(74,157,135,0.10)" }}>
                      <div className="flex items-center gap-1.5" style={{ color: C.textSoft }}>
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="text-xs">
                          {person.status === "online" ? "Localisation disponible" : "Localisation inactive"}
                        </span>
                      </div>
                      <span className="text-xs font-semibold flex items-center gap-0.5 fd-sora" style={{ color: C.primary }}>
                        Voir la fiche <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Recent alerts preview ── */}
        {!loading && patients.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
            className="p-5 rounded-[22px]" style={glass}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold fd-sora flex items-center gap-2" style={{ color: C.text }}>
                <Bell className="w-4 h-4" style={{ color: C.primary }} />
                Dernières alertes
              </h2>
              <button onClick={() => navigate("/family/alerts")}
                className="text-xs font-semibold flex items-center gap-1 hover:underline fd-sora"
                style={{ color: C.primary }}>
                Tout voir <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {alerts.length === 0 ? (
              <div className="text-center py-5">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mx-auto mb-2"
                  style={{ background: "rgba(74,157,135,0.10)" }}>
                  <Heart className="w-5 h-5" style={{ color: C.primary }} />
                </div>
                <p className="text-sm" style={{ color: C.textSoft }}>Aucune alerte récente — tout va bien ✓</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 4).map((a) => {
                  const sev = normalizeSeverity(a.severity);
                  const alertColor = sev === "critical" ? C.muted : sev === "medium" ? C.gold : C.primary;
                  const alertBg    = sev === "critical" ? "rgba(192,80,74,0.07)" : sev === "medium" ? "rgba(212,168,67,0.08)" : "rgba(74,157,135,0.07)";
                  return (
                    <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl"
                      style={{ background: alertBg, border: `1px solid ${alertColor}22` }}>
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: alertColor }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold fd-sora" style={{ color: C.primaryDark }}>{a.patient_nom}</p>
                        <p className="text-sm leading-snug" style={{ color: C.text }}>{a.message}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: C.textSoft }}>{timeAgo(a.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                {alerts.length > 4 && (
                  <button onClick={() => navigate("/family/alerts")}
                    className="w-full text-xs font-semibold py-2 hover:underline fd-sora"
                    style={{ color: C.primary }}>
                    +{alerts.length - 4} autres alertes →
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Empty state ── */}
        {!loading && patients.length === 0 && (
          <div className="py-14 text-center rounded-[22px]" style={glass}>
            <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: `linear-gradient(135deg, ${C.gold}, #e8b84b)`,
                boxShadow: "0 10px 24px rgba(212,168,67,0.30)",
              }}>
              <Heart className="w-7 h-7 text-white" />
            </div>
            <p className="text-sm font-semibold fd-sora" style={{ color: C.text }}>Aucun proche lié pour l'instant</p>
            <p className="text-xs mt-1" style={{ color: C.textSoft }}>Entrez un code d'invitation ci-dessous pour commencer</p>
          </div>
        )}

        {/* ── Link card ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          className="p-5 rounded-[22px]" style={glass}>
          <h2 className="text-sm font-bold fd-sora mb-1 flex items-center gap-2" style={{ color: C.text }}>
            <UserPlus className="w-4 h-4" style={{ color: C.primary }} />
            {patients.length === 0 ? "Lier un patient" : "Ajouter un autre proche"}
          </h2>
          <p className="text-xs mb-3" style={{ color: C.textSoft }}>
            Code fourni par votre proche via <strong>Paramètres → Proches</strong>
          </p>
          <form onSubmit={handleLinkPatient} className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-[150px]">
              <input
                type="text"
                inputMode="numeric"
                value={inviteCodeInput}
                onChange={(e) => { setInviteCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6)); setLinkError(""); setLinkSuccess(""); }}
                placeholder="000000"
                maxLength={6}
                className="fd-input w-full px-4 py-2.5 text-sm font-mono text-center tracking-widest rounded-xl transition-all"
                style={{
                  background: "rgba(74,157,135,0.06)",
                  border: "1px solid rgba(74,157,135,0.20)",
                  color: C.text,
                }}
              />
              {linkError   && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: C.muted }}>
                  <AlertCircle className="w-3 h-3" />{linkError}
                </p>
              )}
              {linkSuccess && (
                <p className="text-xs mt-1 font-semibold" style={{ color: C.primary }}>{linkSuccess}</p>
              )}
            </div>
            <button type="submit" disabled={linkLoading || inviteCodeInput.length < 6}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50 fd-sora"
              style={{
                background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                color: "#fff",
                boxShadow: "0 6px 18px rgba(74,157,135,0.28)",
              }}>
              {linkLoading
                ? <><Loader className="w-4 h-4 animate-spin" />En cours…</>
                : <><UserPlus className="w-4 h-4" />Lier</>}
            </button>
          </form>
        </motion.div>

        {/* ── Messagerie CTA ── */}
        {!loading && patients.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
            onClick={() => navigate("/family/messages")}
            className="fd-nav-card w-full p-4 flex items-center gap-3 rounded-[18px]"
            style={{
              background: "rgba(74,157,135,0.06)",
              border: "1px solid rgba(74,157,135,0.18)",
              borderRadius: "18px",
            }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${C.secondary}, ${C.primary})`,
                boxShadow: "0 6px 16px rgba(91,143,160,0.26)",
              }}>
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold fd-sora" style={{ color: C.text }}>Messagerie médicale</p>
              <p className="text-xs" style={{ color: C.textSoft }}>Contacter l'équipe médicale de votre proche</p>
            </div>
            <ChevronRight className="w-4 h-4 shrink-0" style={{ color: C.primary }} />
          </motion.button>
        )}

      </div>
    </DashboardLayout>
  );
};

export default FamilyDashboard;