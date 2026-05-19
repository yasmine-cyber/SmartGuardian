import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Loader, ChevronRight, ChevronLeft,
  Activity, Thermometer, Droplets, WifiOff,
  MapPin, MessageSquare, AlertCircle, Heart,
  Save, Trash2, Clock, Zap, Bell,
  UserPlus,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type PatientStatus = "online" | "offline" | "alert";

interface Proche {
  patient_user_id: string;   // utilisateurs.id of patient
  patient_row_id:  string;   // patients.id
  nom: string;
  prenom: string | null;
  telephone: string | null;
  date_naissance: string | null;
  adresse: string | null;
  maladies: string[];
  traitements: string[];
  antecedents: string | null;
  lien_parente: string;
  contact_prioritaire: boolean;
  bpm: number | null;
  spo2: number | null;
  temperature: number | null;
  status: PatientStatus;
  lastUpdate: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface AlertItem {
  id: string;
  message: string;
  severity: string;
  type: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<PatientStatus, {
  dot: string; ring: string; label: string; bg: string; text: string;
}> = {
  online:  { dot: "bg-emerald-500", ring: "ring-emerald-200 dark:ring-emerald-800", label: "En ligne",      bg: "bg-emerald-50 dark:bg-emerald-900/20",  text: "text-emerald-600 dark:text-emerald-400" },
  offline: { dot: "bg-slate-400",   ring: "ring-slate-200 dark:ring-slate-700",     label: "Hors ligne",    bg: "bg-slate-100 dark:bg-slate-800",         text: "text-slate-500 dark:text-slate-400"    },
  alert:   { dot: "bg-red-500",     ring: "ring-red-200 dark:ring-red-800",         label: "Alerte active", bg: "bg-red-50 dark:bg-red-900/20",           text: "text-red-600 dark:text-red-400"        },
};

function normalizeSev(s: string): "critical" | "medium" | "low" {
  const v = (s || "").toUpperCase().trim();
  if (["CRITICAL", "CRITIQUE"].includes(v))               return "critical";
  if (["MEDIUM", "MOYEN", "HIGH", "ELEVE"].includes(v))  return "medium";
  return "low";
}

function timeAgo(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60)    return `il y a ${diff}s`;
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

function calcAge(dob: string | null) {
  if (!dob) return "—";
  return `${Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600_000))} ans`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const FamilyProches = () => {
  const navigate = useNavigate();

  // List state
  const [proches,  setProches]  = useState<Proche[]>([]);
  const [alerts,   setAlerts]   = useState<Record<string, AlertItem[]>>({});
  const [loading,  setLoading]  = useState(true);
  const [userId,   setUserId]   = useState<string | null>(null);

  // Fiche state — which card is open
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Edit state (fiche)
  const [editLien,    setEditLien]    = useState("");
  const [editPrio,    setEditPrio]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [delConfirm,  setDelConfirm]  = useState(false);

  // Invite code state
  const [code,        setCode]        = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError,   setCodeError]   = useState("");
  const [codeSuccess, setCodeSuccess] = useState("");

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    // proche_patient.patient_id → utilisateurs.id (patient's user id)
    const { data: links } = await supabase
      .from("proche_patient")
      .select("patient_id, lien_parente, contact_prioritaire")
      .eq("proche_id", user.id);

    if (!links?.length) { setLoading(false); return; }

    const patientUserIds = links.map((l) => l.patient_id);

    const [{ data: utilisateurs }, { data: patientRows }] = await Promise.all([
      supabase.from("utilisateurs").select("id, nom, prenom, telephone").in("id", patientUserIds),
      supabase.from("patients")
        .select("id, user_id, status, date_naissance, adresse, maladies, traitements, antecedents")
        .in("user_id", patientUserIds),
    ]);

    const enriched: Proche[] = await Promise.all(
      (utilisateurs ?? []).map(async (u) => {
        const link   = links.find((l) => l.patient_id === u.id);
        const patRow = (patientRows ?? []).find((p) => p.user_id === u.id);

        let bpm = null, spo2 = null, temperature = null,
            lastUpdate = null, latitude = null, longitude = null;

        if (patRow?.id) {
          const { data: device } = await supabase
            .from("devices").select("id")
            .eq("patient_id", patRow.id).eq("actif", true)
            .order("created_at", { ascending: false }).limit(1).single();

          if (device?.id) {
            const { data: vital } = await supabase
              .from("vital_signs")
              .select("bpm, spo2, temperature, recorded_at, latitude, longitude")
              .eq("device_id", device.id)
              .order("recorded_at", { ascending: false }).limit(1).single();

            if (vital) {
              bpm = vital.bpm; spo2 = vital.spo2; temperature = vital.temperature;
              lastUpdate = vital.recorded_at; latitude = vital.latitude; longitude = vital.longitude;
            }
          }
        }

        let status: PatientStatus = "offline";
        if (patRow?.status === "alert") status = "alert";
        else if (lastUpdate && Date.now() - new Date(lastUpdate).getTime() < 5 * 60_000) status = "online";

        return {
          patient_user_id:     u.id,
          patient_row_id:      patRow?.id ?? "",
          nom:                 u.nom,
          prenom:              u.prenom,
          telephone:           u.telephone,
          date_naissance:      patRow?.date_naissance ?? null,
          adresse:             patRow?.adresse ?? null,
          maladies:            patRow?.maladies ?? [],
          traitements:         patRow?.traitements ?? [],
          antecedents:         patRow?.antecedents ?? null,
          lien_parente:        link?.lien_parente ?? "",
          contact_prioritaire: link?.contact_prioritaire ?? false,
          bpm, spo2, temperature, status, lastUpdate, latitude, longitude,
        };
      })
    );

    setProches(enriched);

    // Alerts — keyed by patients.id, then remapped to utilisateurs.id
    const pRowIds = (patientRows ?? []).map((p) => p.id).filter(Boolean);
    if (pRowIds.length) {
      const { data: alertData } = await supabase
        .from("alerts").select("id, message, severity, type, created_at, patient_id")
        .in("patient_id", pRowIds).order("created_at", { ascending: false }).limit(50);

      if (alertData) {
        const byUserId: Record<string, AlertItem[]> = {};
        alertData.forEach((a) => {
          const pr = (patientRows ?? []).find((p) => p.id === a.patient_id);
          if (!pr) return;
          if (!byUserId[pr.user_id]) byUserId[pr.user_id] = [];
          byUserId[pr.user_id].push({
            id: a.id, message: a.message,
            severity: a.severity ?? "", type: a.type ?? "", created_at: a.created_at,
          });
        });
        setAlerts(byUserId);
      }
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────
  // Always compute selected from current proches — never stale
  const selected = selectedId ? (proches.find((p) => p.patient_user_id === selectedId) ?? null) : null;

  const openFiche = (id: string) => {
    const p = proches.find((x) => x.patient_user_id === id);
    if (p) { setEditLien(p.lien_parente); setEditPrio(p.contact_prioritaire); }
    setDelConfirm(false);
    setSelectedId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeFiche = () => { setSelectedId(null); setDelConfirm(false); };

  // ── Fiche actions ────────────────────────────────────────────────────────────
  const handleSave = async () => {
  if (!selected || !userId) return;
  setSaving(true);

  const payload = {
    lien_parente: editLien.trim() || null,
    contact_prioritaire: editPrio,
  };

  const { data, error, count } = await supabase
    .from("proche_patient")
    .update(payload)
    .eq("proche_id", userId)
    .eq("patient_id", selected.patient_user_id)
    .select();          // <-- force Supabase to return the updated rows

  setSaving(false);

  if (error) {
    toast.error(error.message);
    return;
  }

  if (!data || data.length === 0) {
    // RLS blocked or row not found — surface it
    toast.error("Mise à jour échouée : vérifiez les permissions Supabase (RLS).");
    return;
  }

  setProches((prev) =>
    prev.map((p) =>
      p.patient_user_id === selected.patient_user_id
        ? { ...p, lien_parente: editLien.trim(), contact_prioritaire: editPrio }
        : p
    )
  );
  toast.success("Lien mis à jour ✓");
};

  const handleDelete = async () => {
    if (!selected || !userId) return;
    const { error } = await supabase.from("proche_patient")
      .delete().eq("patient_id", selected.patient_user_id).eq("proche_id", userId);
    if (error) { toast.error(error.message); return; }
    setProches((prev) => prev.filter((p) => p.patient_user_id !== selected.patient_user_id));
    toast.success("Lien supprimé");
    closeFiche();
  };

  // ── Invite code ──────────────────────────────────────────────────────────────
  const handleLinkPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setCodeLoading(true); setCodeError(""); setCodeSuccess("");
    const { data, error } = await supabase.rpc("consume_invite_code", { p_code: c });
    setCodeLoading(false);
    if (error) { setCodeError(error.message || "Code invalide ou expiré."); return; }
    const res = data as { ok?: boolean; error?: string; already_linked?: boolean };
    if (res?.ok === false) { setCodeError(res.error ?? "Code invalide ou expiré."); return; }
    setCode("");
    setCodeSuccess(res.already_linked ? "Déjà lié à ce patient." : "Lien établi ✓");
    load(); // refresh list
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  const inFiche = selectedId !== null;

  return (
    <DashboardLayout role="family">
      <div className="max-w-4xl space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {inFiche && (
            <button onClick={closeFiche}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3 group">
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Retour à mes proches
            </button>
          )}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" />
                {inFiche && selected
                  ? (selected.prenom ? `${selected.prenom} ${selected.nom}` : selected.nom)
                  : "Mes Proches"}
              </h1>
              {!inFiche && (
                <p className="text-sm text-muted-foreground mt-1">
                  {proches.length > 0
                    ? `${proches.length} proche${proches.length > 1 ? "s" : ""} — cliquez pour voir la fiche`
                    : "Liez votre premier proche ci-dessous"}
                </p>
              )}
            </div>
            {inFiche && selected && (
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${STATUS_CFG[selected.status].bg} ${STATUS_CFG[selected.status].text}`}>
                {STATUS_CFG[selected.status].label}
              </span>
            )}
          </div>
        </motion.div>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        {!loading && (
          <AnimatePresence mode="wait">

            {/* ══════════════════ LIST VIEW ══════════════════ */}
            {!inFiche && (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-6">

                {/* Empty */}
                {proches.length === 0 && (
                  <div className="text-center py-14 bg-card border border-border rounded-2xl">
                    <Heart className="w-10 h-10 mx-auto mb-3 text-primary/30" />
                    <p className="text-sm font-semibold text-foreground">Aucun proche lié pour l'instant</p>
                    <p className="text-xs text-muted-foreground mt-1">Utilisez le code d'invitation ci-dessous</p>
                  </div>
                )}

                {/* Cards grid */}
                {proches.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {proches.map((p, i) => {
                      const sc           = STATUS_CFG[p.status];
                      const initial      = (p.prenom?.[0] ?? p.nom[0]).toUpperCase();
                      const patAlerts    = alerts[p.patient_user_id] ?? [];
                      const critCount    = patAlerts.filter((a) => normalizeSev(a.severity) === "critical").length;
                      const hasRedBorder = p.status === "alert" || critCount > 0;

                      return (
                        <motion.button key={p.patient_user_id}
                          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.07 }}
                          onClick={() => openFiche(p.patient_user_id)}
                          className={`bg-card border rounded-2xl p-5 text-left shadow-sm hover:shadow-md transition-all w-full group
                            ${hasRedBorder ? "border-red-200 dark:border-red-800" : "border-border hover:border-primary/20"}`}>

                          {/* Identity */}
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`relative w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-bold ring-4 ${sc.ring} flex-shrink-0`}>
                              {initial}
                              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${sc.dot} border-2 border-card ${p.status !== "offline" ? "animate-pulse" : ""}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-card-foreground">
                                {p.prenom ? `${p.prenom} ${p.nom}` : p.nom}
                              </p>
                              <p className="text-xs text-muted-foreground">{p.lien_parente || "Proche"}</p>
                              {p.contact_prioritaire && (
                                <span className="inline-block text-[10px] bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold mt-0.5">
                                  Contact prioritaire
                                </span>
                              )}
                            </div>
                            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${sc.bg} ${sc.text}`}>
                              {sc.label}
                            </span>
                          </div>

                          {/* Vitals */}
                          <div className="bg-muted/40 rounded-xl p-3 flex flex-wrap items-center gap-3 mb-3">
                            {p.bpm ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <Activity className="w-3.5 h-3.5 text-red-400" />
                                  <span className="text-sm font-bold text-foreground">{p.bpm}</span>
                                  <span className="text-xs text-muted-foreground">BPM</span>
                                </div>
                                <div className="h-4 w-px bg-border" />
                                <span className="text-xs text-muted-foreground">SpO₂ {p.spo2 ?? "--"}%</span>
                                <div className="h-4 w-px bg-border" />
                                <span className="text-xs text-muted-foreground">{p.temperature ?? "--"}°C</span>
                              </>
                            ) : (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <WifiOff className="w-3.5 h-3.5" />
                                <span className="text-xs">Capteur inactif</span>
                              </div>
                            )}
                            {patAlerts.length > 0 && (
                              <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-red-500">
                                <Zap className="w-3 h-3" />
                                {patAlerts.length} alerte{patAlerts.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {p.lastUpdate ? timeAgo(p.lastUpdate) : "Pas de données"}
                            </span>
                            <span className="text-xs text-primary font-medium flex items-center gap-0.5 group-hover:underline">
                              Voir la fiche <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* ── Invite code card ──────────────────────────────────── */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <UserPlus className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-bold text-card-foreground">
                      {proches.length === 0 ? "Lier un patient" : "Ajouter un autre proche"}
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Entrez le code à 6 chiffres fourni par votre proche depuis{" "}
                    <strong>son espace → Paramètres → Proches</strong>.
                  </p>
                  <form onSubmit={handleLinkPatient} className="flex flex-wrap items-start gap-3">
                    <div className="flex-1 min-w-[150px]">
                      <input
                        type="text" inputMode="numeric" value={code} maxLength={6}
                        onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setCodeError(""); setCodeSuccess(""); }}
                        placeholder="0 0 0 0 0 0"
                        className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-base font-mono text-center tracking-[0.4em] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                      />
                      {codeError   && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{codeError}</p>}
                      {codeSuccess && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5">{codeSuccess}</p>}
                    </div>
                    <button type="submit" disabled={codeLoading || code.length < 6}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50">
                      {codeLoading
                        ? <><Loader className="w-4 h-4 animate-spin" />En cours…</>
                        : <><UserPlus className="w-4 h-4" />Lier</>}
                    </button>
                  </form>
                </div>

              </motion.div>
            )}

            {/* ══════════════════ FICHE VIEW ══════════════════ */}
            {inFiche && (
              <motion.div key="fiche" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} className="space-y-4">

                {/* If selected is null (shouldn't happen, but safety) */}
                {!selected && (
                  <div className="text-center py-20">
                    <Loader className="w-6 h-6 text-primary animate-spin mx-auto" />
                  </div>
                )}

                {selected && (
                  <>
                    {/* Alert banner */}
                    {selected.status === "alert" && (
                      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
                        <Zap className="w-5 h-5 text-red-500 flex-shrink-0 animate-pulse" />
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">Alerte active en ce moment</p>
                      </div>
                    )}

                    {/* ── Identity ──────────────────────────────────────── */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center gap-4 mb-5 pb-5 border-b border-border">
                        <div className={`relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold ring-4 ${STATUS_CFG[selected.status].ring} flex-shrink-0`}>
                          {(selected.prenom?.[0] ?? selected.nom[0]).toUpperCase()}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${STATUS_CFG[selected.status].dot} border-2 border-card ${selected.status !== "offline" ? "animate-pulse" : ""}`} />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-xl font-bold text-foreground">
                            {selected.prenom ? `${selected.prenom} ${selected.nom}` : selected.nom}
                          </h2>
                          {selected.lien_parente && (
                            <p className="text-sm text-muted-foreground mt-0.5">{selected.lien_parente}</p>
                          )}
                          {selected.contact_prioritaire && (
                            <span className="inline-block mt-1 text-[10px] bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                              Contact prioritaire
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: "Âge",       value: calcAge(selected.date_naissance) },
                          { label: "Téléphone", value: selected.telephone ?? "—" },
                        ].map((row) => (
                          <div key={row.label}>
                            <p className="text-xs text-muted-foreground">{row.label}</p>
                            <p className="text-sm font-semibold text-foreground mt-0.5">{row.value}</p>
                          </div>
                        ))}
                        {selected.adresse && (
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">Adresse</p>
                            <p className="text-sm font-medium text-foreground mt-0.5">{selected.adresse}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Signes vitaux ─────────────────────────────────── */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Activity className="w-4 h-4 text-primary" /> Signes vitaux
                        </h3>
                        {selected.lastUpdate && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />{timeAgo(selected.lastUpdate)}
                          </span>
                        )}
                      </div>

                      {selected.bpm ? (
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { icon: Activity,    label: "Fréquence card.",  value: `${selected.bpm}`,                    unit: "BPM", color: "text-red-500",    bg: "bg-red-50 dark:bg-red-900/10"    },
                            { icon: Droplets,    label: "Saturation O₂",    value: `${selected.spo2 ?? "—"}`,            unit: "%",   color: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-900/10"  },
                            { icon: Thermometer, label: "Température",      value: `${selected.temperature ?? "—"}`,     unit: "°C",  color: "text-amber-500",  bg: "bg-amber-50 dark:bg-amber-900/10"},
                          ].map((v) => (
                            <div key={v.label} className={`${v.bg} rounded-xl p-3 text-center`}>
                              <v.icon className={`w-4 h-4 ${v.color} mx-auto mb-1.5`} />
                              <p className="text-xl font-bold text-foreground leading-none">
                                {v.value}
                                <span className="text-xs font-normal text-muted-foreground ml-0.5">{v.unit}</span>
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-1">{v.label}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Capteur inactif — aucune donnée disponible</p>
                        </div>
                      )}
                    </div>

                    {/* ── Informations médicales ────────────────────────── */}
                    {(selected.maladies?.length > 0 || selected.traitements?.length > 0 || selected.antecedents) && (
                      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-foreground">Informations médicales</h3>

                        {selected.maladies?.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Maladies connues</p>
                            <div className="flex flex-wrap gap-1.5">
                              {selected.maladies.map((m, i) => (
                                <span key={i} className="text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-full border border-red-100 dark:border-red-900/30">
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {selected.traitements?.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Traitements en cours</p>
                            <div className="flex flex-wrap gap-1.5">
                              {selected.traitements.map((t, i) => (
                                <span key={i} className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-full border border-blue-100 dark:border-blue-900/30">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {selected.antecedents && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Antécédents médicaux</p>
                            <p className="text-sm text-foreground bg-muted/40 rounded-xl p-3 leading-relaxed">
                              {selected.antecedents}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Alertes récentes ──────────────────────────────── */}
                    {(alerts[selected.patient_user_id] ?? []).length > 0 && (
                      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Bell className="w-4 h-4 text-primary" /> Alertes récentes
                          </h3>
                          <button onClick={() => navigate("/family/alerts")}
                            className="text-xs text-primary hover:underline flex items-center gap-1">
                            Tout voir <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(alerts[selected.patient_user_id] ?? []).slice(0, 5).map((a) => {
                            const sev = normalizeSev(a.severity);
                            return (
                              <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border ${
                                sev === "critical" ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30"
                                : sev === "medium"  ? "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30"
                                :                     "bg-muted/30 border-border/50"
                              }`}>
                                <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                                  sev === "critical" ? "text-red-500" : sev === "medium" ? "text-amber-500" : "text-primary"
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-foreground leading-snug">{a.message}</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(a.created_at)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Localisation ──────────────────────────────────── */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                      <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" /> Localisation GPS
                      </h3>
                      {selected.latitude && selected.longitude ? (
                        <div className="bg-muted/40 rounded-xl p-4 text-center">
                          <p className="text-sm font-semibold text-foreground mb-1">Position disponible</p>
                          <p className="text-xs text-muted-foreground">
                            {selected.latitude.toFixed(5)}°, {selected.longitude.toFixed(5)}°
                          </p>
                          <a href={`https://maps.google.com/?q=${selected.latitude},${selected.longitude}`}
                            target="_blank" rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-semibold hover:bg-primary/20 transition-colors">
                            <MapPin className="w-3.5 h-3.5" /> Ouvrir dans Google Maps
                          </a>
                        </div>
                      ) : (
                        <div className="bg-muted/30 rounded-xl h-24 flex items-center justify-center">
                          <div className="text-center text-muted-foreground">
                            <MapPin className="w-6 h-6 mx-auto mb-1 opacity-30" />
                            <p className="text-xs">
                              {selected.status === "online" ? "GPS en attente…" : "Capteur inactif"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Message ───────────────────────────────────────── */}
                    <button onClick={() => navigate("/family/messages")}
                      className="w-full bg-primary/5 border border-primary/20 hover:bg-primary/10 rounded-2xl p-4 flex items-center gap-3 transition-all group">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <MessageSquare className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-semibold text-foreground">Messagerie médicale</p>
                        <p className="text-xs text-muted-foreground">Contacter l'équipe soignante de ce patient</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0" />
                    </button>

                    {/* ── Mon lien (edit) ───────────────────────────────── */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-foreground">Mon lien avec ce proche</h3>

                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Lien de parenté</label>
                        <input
                          value={editLien}
                          onChange={(e) => setEditLien(e.target.value)}
                          placeholder="Ex : Mon père, Ma mère, Mon conjoint, Mon grand-père…"
                          className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                        />
                      </div>

                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" checked={editPrio}
                          onChange={(e) => setEditPrio(e.target.checked)}
                          className="h-4 w-4 mt-0.5 rounded border-border accent-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                            Contact prioritaire
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Je suis contacté en premier en cas d'urgence
                          </p>
                        </div>
                      </label>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        {delConfirm ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">Supprimer ce lien ?</span>
                            <button onClick={handleDelete}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors">
                              Confirmer
                            </button>
                            <button onClick={() => setDelConfirm(false)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors">
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setDelConfirm(true)}
                            className="flex items-center gap-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-xl transition-all">
                            <Trash2 className="w-3.5 h-3.5" /> Supprimer le lien
                          </button>
                        )}

                        <button onClick={handleSave} disabled={saving}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-50 transition-all">
                          {saving
                            ? <><Loader className="w-3.5 h-3.5 animate-spin" />Sauvegarde…</>
                            : <><Save className="w-3.5 h-3.5" />Enregistrer</>}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        )}

      </div>
    </DashboardLayout>
  );
};

export default FamilyProches;