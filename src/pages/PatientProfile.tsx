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

const STATUS_COLORS: Record<string, string> = {
  normal: "bg-green-500/10 text-green-500 border-green-500/20",
  elevated: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
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
  { id: "info", label: "Informations", icon: User },
  { id: "medical", label: "Médical", icon: Heart },
  { id: "traitements", label: "Traitements", icon: Pill },
];

const PatientProfile = () => {
  const [utilisateur, setUtilisateur] = useState<Partial<UtilisateurData>>({});
  const [patient, setPatient] = useState<Partial<PatientData>>({});
  const [formUtil, setFormUtil] = useState<Partial<UtilisateurData>>({});
  const [formPatient, setFormPatient] = useState<Partial<PatientData>>({});
  const [activeTab, setActiveTab] = useState("info");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tag input state
  const [maladieInput, setMaladieInput] = useState("");
  const [traitementInput, setTraitementInput] = useState("");
  const [autreMaladie, setAutreMaladie] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

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
    } catch (err) {
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

      // Toujours mettre à jour utilisateurs
      const { error: e1 } = await supabase
        .from("utilisateurs")
        .update({
          nom: formUtil.nom,
          prenom: formUtil.prenom,
          telephone: formUtil.telephone,
          sexe: formUtil.sexe,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (e1) throw e1;

      setUtilisateur({ ...utilisateur, ...formUtil });

      // Mise à jour fiche patient uniquement si elle existe (sinon inviter à compléter le profil)
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
        if (rpcData && typeof rpcData === "object" && (rpcData as { ok?: boolean }).ok === false) {
          throw new Error((rpcData as { error?: string }).error || "Fiche patient introuvable.");
        }
        setPatient({ ...patient, ...formPatient });
        setSuccess("Profil mis à jour avec succès !");
        loadProfile();
      } else {
        setSuccess("Profil utilisateur enregistré. Pour enregistrer vos données médicales (maladies, date de naissance), complétez votre fiche patient.");
      }
      setEditing(false);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la mise à jour.";
      setError(msg);
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

      // Use simple filename without subfolder to avoid path issues
      const ext = file.name.split(".").pop();
      const path = `${user.id}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("Profiles")
        .upload(path, file, { upsert: true, cacheControl: "0" });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        setError(`Erreur upload: ${uploadError.message}`);
        return;
      }

      console.log("Upload success:", uploadData);

      const { data: urlData } = supabase.storage
        .from("Profiles")
        .getPublicUrl(path);

      // Cache bust
      const photo_url = `${urlData.publicUrl}?t=${Date.now()}`;
      console.log("Public URL:", photo_url);

      const { error: updateError } = await supabase
        .from("utilisateurs")
        .update({ photo_url, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (updateError) {
        console.error("DB update error:", updateError);
        setError(`Erreur mise à jour DB: ${updateError.message}`);
        return;
      }

      setUtilisateur((u) => ({ ...u, photo_url }));
      setFormUtil((u) => ({ ...u, photo_url }));
      setSuccess("Photo mise à jour !");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      console.error("Unexpected error:", err);
      setError(`Erreur inattendue: ${err?.message || JSON.stringify(err)}`);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const addTag = (field: "maladies" | "traitements", value: string) => {
    if (!value.trim()) return;
    const current = formPatient[field] || [];
    if (!current.includes(value.trim())) {
      setFormPatient((p) => ({ ...p, [field]: [...current, value.trim()] }));
    }
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
      setFormPatient((p) => ({
        ...p,
        maladies: (p.maladies || []).filter((m) => m !== nom && !String(m).startsWith("Autre:")),
      }));
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

  if (loading) {
    return (
      <DashboardLayout role="patient">
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 text-primary animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="patient">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Feedback */}
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/30 rounded-xl text-sm text-primary">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {!patient?.id && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm">
            <span className="text-amber-700 dark:text-amber-400">Pour enregistrer vos données médicales (maladies, date de naissance), complétez d&apos;abord votre fiche patient.</span>
            <Link to="/complete-profile" className="shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90">
              Compléter ma fiche
            </Link>
          </motion.div>
        )}

        {/* Hero card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">

            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-muted border border-border">
                {utilisateur.photo_url ? (
                  <img src={utilisateur.photo_url} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <span className="text-2xl font-bold text-primary">{initials}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:brightness-110 transition-all shadow-md disabled:opacity-50"
              >
                {uploadingPhoto ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl font-bold text-foreground">
                {[utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") || "Mon Profil"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">{utilisateur.email}</p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                  <Shield className="w-3 h-3 inline mr-1" /> Patient
                </span>
                {patient.status && (
                  <span className={`text-xs font-medium px-3 py-1 rounded-full border ${STATUS_COLORS[patient.status] || STATUS_COLORS.normal}`}>
                    <Activity className="w-3 h-3 inline mr-1" />
                    {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground px-3 py-1 rounded-full bg-muted">
                  Depuis {utilisateur.created_at ? new Date(utilisateur.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "—"}
                </span>
              </div>
            </div>

            {/* Edit / Cancel */}
            <button
              onClick={() => editing ? handleCancel() : setEditing(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${
                editing ? "bg-muted text-foreground hover:bg-muted/80" : "bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              {editing ? <><X className="w-4 h-4" /> Annuler</> : <><Edit3 className="w-4 h-4" /> Modifier</>}
            </button>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-border">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "text-primary border-b-2 border-primary bg-primary/5"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
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

                  <Field label="Prénom" icon={<User className="w-4 h-4" />}
                    value={formUtil.prenom || ""} editing={editing}
                    onChange={(v) => setFormUtil((f) => ({ ...f, prenom: v }))}
                    placeholder="Votre prénom" />

                  <Field label="Nom" icon={<User className="w-4 h-4" />}
                    value={formUtil.nom || ""} editing={editing}
                    onChange={(v) => setFormUtil((f) => ({ ...f, nom: v }))}
                    placeholder="Votre nom" />

                  <Field label="Email" icon={<Mail className="w-4 h-4" />}
                    value={formUtil.email || ""} editing={false}
                    onChange={() => {}} placeholder="—" hint="Non modifiable" />

                  <Field label="Téléphone" icon={<Phone className="w-4 h-4" />}
                    value={formUtil.telephone || ""} editing={editing}
                    onChange={(v) => setFormUtil((f) => ({ ...f, telephone: v }))}
                    placeholder="+213 ..." />

                  <Field label="Date de naissance" icon={<Calendar className="w-4 h-4" />}
                    value={formPatient.date_naissance || ""} editing={editing}
                    onChange={(v) => setFormPatient((f) => ({ ...f, date_naissance: v }))}
                    placeholder="YYYY-MM-DD" type="date" />

                  {/* Sexe */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                      <User className="w-4 h-4" /> Sexe
                    </label>
                    {editing ? (
                      <select
                        value={formUtil.sexe || ""}
                        onChange={(e) => setFormUtil((f) => ({ ...f, sexe: e.target.value }))}
                        className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
                      >
                        <option value="">— Sélectionner —</option>
                        <option value="homme">Homme</option>
                        <option value="femme">Femme</option>
                        <option value="autre">Autre</option>
                      </select>
                    ) : (
                      <ReadonlyField value={formUtil.sexe} />
                    )}
                  </div>

                  {/* Adresse full width */}
                  <div className="sm:col-span-2">
                    <Field label="Adresse" icon={<MapPin className="w-4 h-4" />}
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

                  {/* Maladies — liste comme à la création de compte */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <Heart className="w-4 h-4" /> Maladies chroniques
                    </label>
                    {editing ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                          {MALADIES_REF.map((nom) => (
                            <label key={nom} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isMaladieChecked(nom)}
                                onChange={() => toggleMaladie(nom)}
                                className="rounded border-border text-primary focus:ring-primary/20"
                              />
                              <span className="text-sm text-foreground">{nom}</span>
                            </label>
                          ))}
                        </div>
                        {isMaladieChecked("Autre") && (
                          <div className="mb-3">
                            <input
                              type="text"
                              value={autreMaladie}
                              onChange={(e) => setAutreMaladie(e.target.value)}
                              placeholder="Précisez la maladie (Autre)"
                              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                            />
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap items-center mt-2">
                          <input
                            value={maladieInput}
                            onChange={(e) => setMaladieInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag("maladies", maladieInput))}
                            placeholder="Autre maladie (libre) — Entrée pour ajouter"
                            className="flex-1 min-w-[180px] bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                          />
                          <button
                            type="button"
                            onClick={() => addTag("maladies", maladieInput)}
                            className="px-3 py-2 bg-primary/10 text-primary rounded-xl text-sm hover:bg-primary/20"
                          >
                            + Ajouter
                          </button>
                        </div>
                        {(formPatient.maladies || []).filter((m) => !MALADIES_REF.includes(m) && !String(m).startsWith("Autre:")).map((m, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-muted text-foreground px-2 py-1 rounded-full mr-2 mt-2">
                            {m}
                            <button type="button" onClick={() => removeTag("maladies", formPatient.maladies!.indexOf(m))} className="hover:text-destructive">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(formPatient.maladies || []).length === 0 ? (
                          <span className="text-sm text-muted-foreground">Aucune maladie renseignée</span>
                        ) : (
                          (formPatient.maladies || []).map((m, i) => (
                            <span key={i} className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full">
                              {m}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Antécédents */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                      <FileText className="w-4 h-4" /> Antécédents médicaux
                    </label>
                    {editing ? (
                      <textarea
                        value={formPatient.antecedents || ""}
                        onChange={(e) => setFormPatient((f) => ({ ...f, antecedents: e.target.value }))}
                        placeholder="Décrivez vos antécédents médicaux..."
                        rows={4}
                        className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
                      />
                    ) : (
                      <div className="w-full bg-muted/30 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-foreground min-h-[80px] whitespace-pre-wrap">
                        {formPatient.antecedents || <span className="text-muted-foreground">Aucun antécédent renseigné</span>}
                      </div>
                    )}
                  </div>

                  {/* Notes médecin — readonly */}
                  {patient.notes_medecin && (
                    <div>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                        <FileText className="w-4 h-4" /> Notes du médecin
                        <span className="ml-1 text-xs bg-muted px-2 py-0.5 rounded-full">Lecture seule</span>
                      </label>
                      <div className="w-full bg-muted/30 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-foreground min-h-[60px] whitespace-pre-wrap">
                        {patient.notes_medecin}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* TAB: Traitements */}
              {activeTab === "traitements" && (
                <motion.div key="traitements" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                  className="space-y-4">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                    <Pill className="w-4 h-4" /> Traitements en cours
                  </label>

                  <div className="space-y-2">
                    {(formPatient.traitements || []).map((t, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-muted/40 border border-border/50 rounded-xl">
                        <Pill className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground flex-1">{t}</span>
                        {editing && (
                          <button onClick={() => removeTag("traitements", i)}
                            className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {(formPatient.traitements || []).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">Aucun traitement renseigné</p>
                    )}
                  </div>

                  {editing && (
                    <div className="flex gap-2 mt-3">
                      <input
                        value={traitementInput}
                        onChange={(e) => setTraitementInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag("traitements", traitementInput))}
                        placeholder="Ex: Metformine 500mg — Entrée pour ajouter"
                        className="flex-1 bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
                      />
                      <button
                        onClick={() => addTag("traitements", traitementInput)}
                        className="px-3 py-2 bg-primary/10 text-primary rounded-xl text-sm hover:bg-primary/20 transition-all"
                      >
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
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  className="mt-6 pt-5 border-t border-border flex justify-end"
                >
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-sage"
                  >
                    {saving ? <><Loader className="w-4 h-4 animate-spin" /> Enregistrement...</> : <><Save className="w-4 h-4" /> Enregistrer</>}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

// ─── Helper components ───────────────────────────────────────────────────────

const ReadonlyField = ({ value }: { value?: string }) => (
  <div className="w-full bg-muted/30 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-foreground capitalize">
    {value || <span className="text-muted-foreground">—</span>}
  </div>
);

const Field = ({
  label, icon, value, editing, onChange, placeholder, type = "text", hint,
}: {
  label: string; icon: React.ReactNode; value: string;
  editing: boolean; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string;
}) => (
  <div>
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
      {icon} {label} {hint && <span className="ml-1 text-xs bg-muted px-2 py-0.5 rounded-full">{hint}</span>}
    </label>
    {editing ? (
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
      />
    ) : (
      <ReadonlyField value={value} />
    )}
  </div>
);

export default PatientProfile;