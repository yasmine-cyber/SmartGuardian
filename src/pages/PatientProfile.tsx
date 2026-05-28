import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Mail, Phone, MapPin, Calendar, Shield,
  Camera, Loader, CheckCircle, AlertCircle,
  Edit3, X, Save, Heart, Pill, FileText, Activity
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import DashboardLayout from "@/components/DashboardLayout";

interface UtilisateurData {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  telephone: string;
  photo_url: string;
  sexe: string;
  role: string;
  created_at: string;
}

interface PatientData {
  id: string;
  user_id: string;
  date_naissance: string;
  adresse: string;
  maladies: string[];
  antecedents: string;
  traitements: string[];
  notes_medecin: string;
  status: string;
}

// ─── Palette (matches landing page) ─────────────────────────────────────────
const C = {
  primary:     "#4a9d87",
  primaryDark: "#3d8c7a",
  secondary:   "#5b8fa0",
  text:        "#1a2e28",
  textSoft:    "rgba(30,60,50,0.62)",
  gold:        "#d4a843",
  muted:       "#c0504a",
};

const glass = {
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.16)",
  borderRadius: "22px",
  boxShadow: "0 12px 36px rgba(30,60,50,0.06)",
} as React.CSSProperties;

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  normal:   { bg: "rgba(74,157,135,0.10)",  color: C.primary, border: "rgba(74,157,135,0.28)" },
  elevated: { bg: "rgba(212,168,67,0.12)",  color: C.gold,    border: "rgba(212,168,67,0.30)" },
  critical: { bg: "rgba(192,80,74,0.10)",   color: C.muted,   border: "rgba(192,80,74,0.30)" },
};

const MALADIES_REF = [
  "Hypertension artérielle",
  "Insuffisance cardiaque",
  "Arythmie cardiaque",
  "Fibrillation auriculaire",
  "Angine de poitrine",
  "Diabète de type 1",
  "Diabète de type 2",
  "Obésité",
  "Insuffisance respiratoire",
  "Apnée du sommeil",
  "Épilepsie",
  "Maladie de Parkinson",
  "Alzheimer",
  "Insuffisance rénale",
  "Autre",
];

const TABS = [
  { id: "info",        label: "Informations", icon: User     },
  { id: "medical",     label: "Médical",      icon: Heart    },
  { id: "traitements", label: "Traitements",  icon: Pill     },
];

const PatientProfile = () => {
  const [utilisateur, setUtilisateur] = useState<Partial<UtilisateurData>>({});
  const [patient, setPatient]         = useState<Partial<PatientData>>({});
  const [formUtil, setFormUtil]       = useState<Partial<UtilisateurData>>({});
  const [formPatient, setFormPatient] = useState<Partial<PatientData>>({});
  const [activeTab, setActiveTab]     = useState("info");
  const [editing, setEditing]         = useState(false);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [success, setSuccess]         = useState("");
  const [error, setError]             = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [maladieInput, setMaladieInput]     = useState("");
  const [traitementInput, setTraitementInput] = useState("");
  const [autreMaladie, setAutreMaladie]     = useState("");

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: uData }, { data: pData }] = await Promise.all([
        supabase.from("utilisateurs").select("*").eq("id", user.id).single(),
        supabase.from("patients").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      const util = { ...uData, email: user.email };
      setUtilisateur(util);
      setFormUtil(util);

      if (pData) {
        setPatient(pData);
        setFormPatient(pData);
        const autre = (pData.maladies || []).find((m: string) => String(m).startsWith("Autre: "));
        setAutreMaladie(autre ? String(autre).replace(/^Autre:\s*/i, "").trim() : "");
      } else {
        setPatient({});
        setFormPatient({});
        setAutreMaladie("");
      }
    } catch {
      setError("Impossible de charger le profil.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: e1 } = await supabase
        .from("utilisateurs")
        .update({ nom: formUtil.nom, prenom: formUtil.prenom, telephone: formUtil.telephone, sexe: formUtil.sexe, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (e1) throw e1;

      setUtilisateur({ ...utilisateur, ...formUtil });

      if (patient?.id) {
        const maladiesToSave = (formPatient.maladies || []).map((m) =>
          m === "Autre" && autreMaladie?.trim() ? `Autre: ${autreMaladie.trim()}` : m
        );
        const { data: rpcData, error: e2 } = await supabase.rpc("update_my_patient_profile", {
          p_date_naissance: formPatient.date_naissance || null,
          p_adresse: formPatient.adresse ?? "",
          p_maladies: maladiesToSave,
          p_antecedents: formPatient.antecedents ?? "",
          p_traitements: formPatient.traitements ?? [],
        });
        if (e2) throw e2;
        if (rpcData && typeof rpcData === "object" && (rpcData as { ok?: boolean }).ok === false)
          throw new Error((rpcData as { error?: string }).error || "Fiche patient introuvable.");
        setPatient({ ...patient, ...formPatient });
        setSuccess("Profil mis à jour avec succès !");
        loadProfile();
      } else {
        setSuccess("Profil utilisateur enregistré. Pour enregistrer vos données médicales, complétez votre fiche patient.");
      }
      setEditing(false);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormUtil(utilisateur);
    setFormPatient(patient);
    const autre = (patient.maladies || []).find((m: string) => String(m).startsWith("Autre: "));
    setAutreMaladie(autre ? String(autre).replace(/^Autre:\s*/i, "").trim() : "");
    setEditing(false);
    setError("");
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Veuillez sélectionner une image."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("L'image ne doit pas dépasser 2 Mo."); return; }
    setUploadingPhoto(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ext = file.name.split(".").pop();
      const path = `${user.id}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from("Profiles").upload(path, file, { upsert: true, cacheControl: "0" });
      if (uploadError) { setError(`Erreur upload: ${uploadError.message}`); return; }
      console.log("Upload success:", uploadData);
      const { data: urlData } = supabase.storage.from("Profiles").getPublicUrl(path);
      const photo_url = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from("utilisateurs").update({ photo_url, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (updateError) { setError(`Erreur mise à jour DB: ${updateError.message}`); return; }
      setUtilisateur((u) => ({ ...u, photo_url }));
      setFormUtil((u) => ({ ...u, photo_url }));
      setSuccess("Photo mise à jour !");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(`Erreur inattendue: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const addTag = (field: "maladies" | "traitements", value: string) => {
    if (!value.trim()) return;
    const current = formPatient[field] || [];
    if (!current.includes(value.trim()))
      setFormPatient((p) => ({ ...p, [field]: [...current, value.trim()] }));
    if (field === "maladies") setMaladieInput("");
    else setTraitementInput("");
  };

  const removeTag = (field: "maladies" | "traitements", index: number) => {
    const current = [...(formPatient[field] || [])];
    current.splice(index, 1);
    setFormPatient((p) => ({ ...p, [field]: current }));
  };

  const toggleMaladie = (nom: string) => {
    const current = formPatient.maladies || [];
    const has = current.includes(nom) || (nom === "Autre" && current.some((m) => String(m).startsWith("Autre:")));
    if (has) {
      setFormPatient((p) => ({ ...p, maladies: (p.maladies || []).filter((m) => m !== nom && !String(m).startsWith("Autre:")) }));
      if (nom === "Autre") setAutreMaladie("");
    } else {
      setFormPatient((p) => ({ ...p, maladies: [...(p.maladies || []), nom] }));
    }
  };

  const isMaladieChecked = (nom: string) => {
    const m = formPatient.maladies || [];
    if (nom === "Autre") return m.some((x) => x === "Autre" || String(x).startsWith("Autre:"));
    return m.includes(nom);
  };

  const initials = `${formUtil.prenom?.[0] || ""}${formUtil.nom?.[0] || ""}`.toUpperCase() || "?";
  const statusCfg = STATUS_COLORS[patient.status || ""] || STATUS_COLORS.normal;

  if (loading) {
    return (
      <DashboardLayout role="patient">
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 animate-spin" style={{ color: C.primary }} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="patient">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .sg-page * { font-family: 'DM Sans', sans-serif; }
        .sg-page h1, .sg-page h2, .sg-page h3, .sg-sora { font-family: 'Sora', sans-serif !important; }
        .sg-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes sgAurora { 0%,100%{transform:translate(0,0) scale(1);opacity:.55} 50%{transform:translate(30px,-20px) scale(1.06);opacity:.85} }
        .sg-aurora-a { position:absolute; width:420px; height:420px; border-radius:50%; filter:blur(80px); pointer-events:none; }
        .sg-card { transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s; }
        .sg-input {
          width:100%; background:rgba(255,255,255,0.65); border:1px solid rgba(74,157,135,0.20);
          border-radius:14px; padding:10px 14px; font-size:14px; color:#1a2e28;
          outline:none; transition:border .2s, box-shadow .2s;
          font-family:'DM Sans',sans-serif;
        }
        .sg-input::placeholder { color:rgba(30,60,50,0.35); }
        .sg-input:focus { border-color:rgba(74,157,135,0.50); box-shadow:0 0 0 3px rgba(74,157,135,0.10); }
        .sg-input:disabled { opacity:.55; cursor:not-allowed; }
        .sg-readonly {
          width:100%; background:rgba(74,157,135,0.04); border:1px solid rgba(74,157,135,0.12);
          border-radius:14px; padding:10px 14px; font-size:14px; color:#1a2e28;
          font-family:'DM Sans',sans-serif; text-transform:capitalize;
        }
        .sg-checkbox { accent-color: #4a9d87; width:15px; height:15px; cursor:pointer; }
        .sg-tab-active { border-bottom: 2px solid #4a9d87; color:#4a9d87; background:rgba(74,157,135,0.06); }
        .sg-tab { color:rgba(30,60,50,0.55); transition:color .2s,background .2s; }
        .sg-tab:hover { color:#1a2e28; background:rgba(74,157,135,0.04); }
      `}</style>

      <div className="sg-page relative max-w-3xl mx-auto">
        {/* Aurora orbs */}
        <div className="sg-aurora-a" style={{ background: "rgba(74,157,135,0.13)", top: -100, right: -80, animation: "sgAurora 22s ease-in-out infinite", zIndex: 0 }} />
        <div className="sg-aurora-a" style={{ background: "rgba(91,143,160,0.11)", top: 320, left: -120, animation: "sgAurora 18s ease-in-out infinite reverse", zIndex: 0 }} />

        <div className="relative space-y-5">

          {/* ── Feedback banners ── */}
          <AnimatePresence>
            {success && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 p-4 rounded-2xl text-sm"
                style={{ background: "rgba(74,157,135,0.10)", border: "1px solid rgba(74,157,135,0.28)", color: C.primaryDark }}>
                <CheckCircle className="w-4 h-4 shrink-0" /> {success}
              </motion.div>
            )}
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 p-4 rounded-2xl text-sm"
                style={{ background: "rgba(192,80,74,0.08)", border: "1px solid rgba(192,80,74,0.28)", color: C.muted }}>
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── No patient record banner ── */}
          {!patient?.id && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 p-4 rounded-2xl text-sm"
              style={{ background: "rgba(212,168,67,0.10)", border: "1px solid rgba(212,168,67,0.30)" }}>
              <span style={{ color: "#8a6a10" }}>
                Pour enregistrer vos données médicales (maladies, date de naissance), complétez d&apos;abord votre fiche patient.
              </span>
              <Link to="/complete-profile"
                className="shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${C.gold}, #c49030)`,
                  color: "#fff",
                  boxShadow: "0 4px 14px rgba(212,168,67,0.30)",
                }}>
                Compléter ma fiche
              </Link>
            </motion.div>
          )}

          {/* ── Hero card ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 sg-card" style={glass}>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">

              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="w-24 h-24 rounded-2xl overflow-hidden"
                  style={{ border: "2px solid rgba(74,157,135,0.22)", boxShadow: "0 8px 24px rgba(74,157,135,0.18)" }}>
                  {utilisateur.photo_url ? (
                    <img src={utilisateur.photo_url} alt="Photo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})` }}>
                      <span className="text-2xl font-bold text-white sg-sora">{initials}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                    boxShadow: "0 4px 12px rgba(74,157,135,0.35)",
                    color: "#fff",
                  }}>
                  {uploadingPhoto ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-xl font-bold sg-sora" style={{ color: C.text }}>
                  {[utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") || (
                    <span className="sg-gradient-text">Mon Profil</span>
                  )}
                </h1>
                <p className="text-sm mt-0.5" style={{ color: C.textSoft }}>{utilisateur.email}</p>
                <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1"
                    style={{ background: "rgba(74,157,135,0.10)", color: C.primary, border: "1px solid rgba(74,157,135,0.22)" }}>
                    <Shield className="w-3 h-3" /> Patient
                  </span>
                  {patient.status && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1"
                      style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}>
                      <Activity className="w-3 h-3" />
                      {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
                    </span>
                  )}
                  <span className="text-xs px-3 py-1 rounded-full"
                    style={{ background: "rgba(74,157,135,0.06)", color: C.textSoft, border: "1px solid rgba(74,157,135,0.12)" }}>
                    Depuis {utilisateur.created_at ? new Date(utilisateur.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "—"}
                  </span>
                </div>
              </div>

              {/* Edit / Cancel */}
              <button
                onClick={() => editing ? handleCancel() : setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105 shrink-0"
                style={editing ? {
                  background: "rgba(30,60,50,0.07)",
                  color: C.text,
                  border: "1px solid rgba(30,60,50,0.14)",
                } : {
                  background: "rgba(74,157,135,0.10)",
                  color: C.primary,
                  border: "1px solid rgba(74,157,135,0.24)",
                }}>
                {editing ? <><X className="w-4 h-4" /> Annuler</> : <><Edit3 className="w-4 h-4" /> Modifier</>}
              </button>
            </div>
          </motion.div>

          {/* ── Tabs card ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="sg-card overflow-hidden" style={glass}>

            {/* Tab bar */}
            <div className="flex" style={{ borderBottom: "1px solid rgba(74,157,135,0.14)" }}>
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium ${active ? "sg-tab-active" : "sg-tab"}`}>
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline sg-sora">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="p-6">
              <AnimatePresence mode="wait">

                {/* TAB: Informations */}
                {activeTab === "info" && (
                  <motion.div key="info" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <SGField label="Prénom" icon={<User className="w-4 h-4" />}
                      value={formUtil.prenom || ""} editing={editing}
                      onChange={(v) => setFormUtil((f) => ({ ...f, prenom: v }))}
                      placeholder="Votre prénom" />

                    <SGField label="Nom" icon={<User className="w-4 h-4" />}
                      value={formUtil.nom || ""} editing={editing}
                      onChange={(v) => setFormUtil((f) => ({ ...f, nom: v }))}
                      placeholder="Votre nom" />

                    <SGField label="Email" icon={<Mail className="w-4 h-4" />}
                      value={formUtil.email || ""} editing={false}
                      onChange={() => {}} placeholder="—" hint="Non modifiable" />

                    <SGField label="Téléphone" icon={<Phone className="w-4 h-4" />}
                      value={formUtil.telephone || ""} editing={editing}
                      onChange={(v) => setFormUtil((f) => ({ ...f, telephone: v }))}
                      placeholder="+213 ..." />

                    <SGField label="Date de naissance" icon={<Calendar className="w-4 h-4" />}
                      value={formPatient.date_naissance || ""} editing={editing}
                      onChange={(v) => setFormPatient((f) => ({ ...f, date_naissance: v }))}
                      placeholder="YYYY-MM-DD" type="date" />

                    {/* Sexe */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: C.textSoft }}>
                        <User className="w-4 h-4" /> Sexe
                      </label>
                      {editing ? (
                        <select
                          value={formUtil.sexe || ""}
                          onChange={(e) => setFormUtil((f) => ({ ...f, sexe: e.target.value }))}
                          className="sg-input">
                          <option value="">— Sélectionner —</option>
                          <option value="homme">Homme</option>
                          <option value="femme">Femme</option>
                          <option value="autre">Autre</option>
                        </select>
                      ) : (
                        <SGReadonly value={formUtil.sexe} />
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <SGField label="Adresse" icon={<MapPin className="w-4 h-4" />}
                        value={formPatient.adresse || ""} editing={editing}
                        onChange={(v) => setFormPatient((f) => ({ ...f, adresse: v }))}
                        placeholder="Votre adresse complète" />
                    </div>
                  </motion.div>
                )}

                {/* TAB: Médical */}
                {activeTab === "medical" && (
                  <motion.div key="medical" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                    className="space-y-5">

                    {/* Maladies */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs mb-2" style={{ color: C.textSoft }}>
                        <Heart className="w-4 h-4" /> Maladies chroniques
                      </label>
                      {editing ? (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 p-4 rounded-2xl"
                            style={{ background: "rgba(74,157,135,0.04)", border: "1px solid rgba(74,157,135,0.12)" }}>
                            {MALADIES_REF.map((nom) => (
                              <label key={nom} className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={isMaladieChecked(nom)} onChange={() => toggleMaladie(nom)} className="sg-checkbox" />
                                <span className="text-sm" style={{ color: C.text }}>{nom}</span>
                              </label>
                            ))}
                          </div>
                          {isMaladieChecked("Autre") && (
                            <input type="text" value={autreMaladie}
                              onChange={(e) => setAutreMaladie(e.target.value)}
                              placeholder="Précisez la maladie (Autre)"
                              className="sg-input mb-3" />
                          )}
                          <div className="flex gap-2 flex-wrap items-center mt-2">
                            <input value={maladieInput}
                              onChange={(e) => setMaladieInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag("maladies", maladieInput))}
                              placeholder="Autre maladie (libre) — Entrée pour ajouter"
                              className="sg-input flex-1 min-w-[180px]" />
                            <button type="button" onClick={() => addTag("maladies", maladieInput)}
                              className="px-4 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105"
                              style={{ background: "rgba(74,157,135,0.10)", color: C.primary, border: "1px solid rgba(74,157,135,0.24)" }}>
                              + Ajouter
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {(formPatient.maladies || []).filter((m) => !MALADIES_REF.includes(m) && !String(m).startsWith("Autre:")).map((m, i) => (
                              <span key={i} className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full"
                                style={{ background: "rgba(74,157,135,0.10)", color: C.primary, border: "1px solid rgba(74,157,135,0.22)" }}>
                                {m}
                                <button type="button" onClick={() => removeTag("maladies", formPatient.maladies!.indexOf(m))}
                                  className="hover:opacity-70 transition-opacity">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(formPatient.maladies || []).length === 0 ? (
                            <span className="text-sm" style={{ color: C.textSoft }}>Aucune maladie renseignée</span>
                          ) : (
                            (formPatient.maladies || []).map((m, i) => (
                              <span key={i} className="text-xs px-3 py-1 rounded-full"
                                style={{ background: "rgba(74,157,135,0.10)", color: C.primary, border: "1px solid rgba(74,157,135,0.22)" }}>
                                {m}
                              </span>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Antécédents */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: C.textSoft }}>
                        <FileText className="w-4 h-4" /> Antécédents médicaux
                      </label>
                      {editing ? (
                        <textarea value={formPatient.antecedents || ""}
                          onChange={(e) => setFormPatient((f) => ({ ...f, antecedents: e.target.value }))}
                          placeholder="Décrivez vos antécédents médicaux..."
                          rows={4}
                          className="sg-input resize-none" />
                      ) : (
                        <div className="sg-readonly min-h-[80px] whitespace-pre-wrap">
                          {formPatient.antecedents || <span style={{ color: C.textSoft }}>Aucun antécédent renseigné</span>}
                        </div>
                      )}
                    </div>

                    {/* Notes médecin */}
                    {patient.notes_medecin && (
                      <div>
                        <label className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: C.textSoft }}>
                          <FileText className="w-4 h-4" /> Notes du médecin
                          <span className="ml-1 text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(74,157,135,0.08)", color: C.textSoft }}>
                            Lecture seule
                          </span>
                        </label>
                        <div className="sg-readonly min-h-[60px] whitespace-pre-wrap">{patient.notes_medecin}</div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* TAB: Traitements */}
                {activeTab === "traitements" && (
                  <motion.div key="traitements" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                    className="space-y-4">
                    <label className="flex items-center gap-1.5 text-xs mb-2" style={{ color: C.textSoft }}>
                      <Pill className="w-4 h-4" /> Traitements en cours
                    </label>

                    <div className="space-y-2">
                      {(formPatient.traitements || []).map((t, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl transition-colors"
                          style={{ background: "rgba(74,157,135,0.05)", border: "1px solid rgba(74,157,135,0.14)" }}>
                          <Pill className="w-4 h-4 shrink-0" style={{ color: C.primary }} />
                          <span className="text-sm flex-1" style={{ color: C.text }}>{t}</span>
                          {editing && (
                            <button onClick={() => removeTag("traitements", i)}
                              className="transition-opacity hover:opacity-70"
                              style={{ color: C.textSoft }}>
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {(formPatient.traitements || []).length === 0 && (
                        <p className="text-sm text-center py-8" style={{ color: C.textSoft }}>Aucun traitement renseigné</p>
                      )}
                    </div>

                    {editing && (
                      <div className="flex gap-2 mt-3">
                        <input value={traitementInput}
                          onChange={(e) => setTraitementInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag("traitements", traitementInput))}
                          placeholder="Ex: Metformine 500mg — Entrée pour ajouter"
                          className="sg-input flex-1" />
                        <button onClick={() => addTag("traitements", traitementInput)}
                          className="px-4 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105"
                          style={{ background: "rgba(74,157,135,0.10)", color: C.primary, border: "1px solid rgba(74,157,135,0.24)" }}>
                          + Ajouter
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Save button */}
              <AnimatePresence>
                {editing && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="mt-6 pt-5 flex justify-end"
                    style={{ borderTop: "1px solid rgba(74,157,135,0.14)" }}>
                    <button onClick={handleSave} disabled={saving}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                        color: "#fff",
                        boxShadow: "0 6px 22px rgba(74,157,135,0.35)",
                      }}>
                      {saving
                        ? <><Loader className="w-4 h-4 animate-spin" /> Enregistrement...</>
                        : <><Save className="w-4 h-4" /> Enregistrer</>}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

        </div>
      </div>
    </DashboardLayout>
  );
};

// ─── Helper components ───────────────────────────────────────────────────────

const SGReadonly = ({ value }: { value?: string }) => (
  <div className="sg-readonly">
    {value || <span style={{ color: "rgba(30,60,50,0.35)" }}>—</span>}
  </div>
);

const SGField = ({
  label, icon, value, editing, onChange, placeholder, type = "text", hint,
}: {
  label: string; icon: React.ReactNode; value: string;
  editing: boolean; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string;
}) => (
  <div>
    <label className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: "rgba(30,60,50,0.62)" }}>
      {icon} {label}
      {hint && (
        <span className="ml-1 text-xs px-2 py-0.5 rounded-full"
          style={{ background: "rgba(74,157,135,0.08)", color: "rgba(30,60,50,0.50)" }}>
          {hint}
        </span>
      )}
    </label>
    {editing
      ? <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="sg-input" />
      : <SGReadonly value={value} />
    }
  </div>
);

export default PatientProfile;