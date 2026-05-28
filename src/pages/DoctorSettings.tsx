import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader, Save, User, Lock, Camera, Eye, EyeOff, Upload, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Tab = "profile" | "security";

interface DoctorProfile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  sexe: string;
  photo_url: string;
  specialite: string;
  numero_licence: string;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "Profil", icon: <User className="w-4 h-4" /> },
  { id: "security", label: "Sécurité", icon: <Lock className="w-4 h-4" /> },
];

/* ── Palette ─────────────────────────────────────────────── */
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

const DoctorSettings = () => {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<DoctorProfile>({
    id: "",
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
    sexe: "",
    photo_url: "",
    specialite: "",
    numero_licence: "",
  });

  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: userData, error: userError } = await supabase
        .from("utilisateurs")
        .select("*")
        .eq("id", user.id)
        .single();

      const { data: medecinData } = await supabase
        .from("medecins")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (userError) toast.error("Erreur lors du chargement du profil");

      setProfile({
        id: user.id,
        nom: userData?.nom ?? "",
        prenom: userData?.prenom ?? "",
        email: userData?.email ?? user.email ?? "",
        telephone: userData?.telephone ?? "",
        sexe: userData?.sexe ?? "",
        photo_url: userData?.photo_url ?? "",
        specialite: medecinData?.specialite ?? "",
        numero_licence: medecinData?.numero_licence ?? "",
      });

      setLoading(false);
    };
    load();
  }, []);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 2 Mo.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${userId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("Profiles")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("Profiles").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const { error: dbError } = await supabase
        .from("utilisateurs")
        .update({ photo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (dbError) throw dbError;

      setProfile((p) => ({ ...p, photo_url: publicUrl }));
      toast.success("Photo de profil mise à jour !");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors de l'upload de la photo.");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await supabase
        .from("utilisateurs")
        .update({ photo_url: null, updated_at: new Date().toISOString() })
        .eq("id", userId);
      setProfile((p) => ({ ...p, photo_url: "" }));
      toast.success("Photo supprimée.");
    } catch {
      toast.error("Erreur lors de la suppression.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const { error: userError } = await supabase
        .from("utilisateurs")
        .update({
          nom: profile.nom,
          prenom: profile.prenom,
          telephone: profile.telephone || null,
          sexe: profile.sexe || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      const { error: medecinError } = await supabase
        .from("medecins")
        .upsert(
          {
            id: userId,
            specialite: profile.specialite || "",
            numero_licence: profile.numero_licence || "N/A",
            compte_active: true,
          },
          { onConflict: "id" }
        );

      if (userError || medecinError) throw new Error("Erreur de mise à jour");
      toast.success("Profil mis à jour avec succès");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (passwords.new.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwords.new });
      if (error) throw error;
      toast.success("Mot de passe modifié avec succès");
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du changement de mot de passe");
    } finally {
      setSaving(false);
    }
  };

  const togglePassword = (field: keyof typeof showPasswords) =>
    setShowPasswords((p) => ({ ...p, [field]: !p[field] }));

  /* ── Render ── */
  return (
    <DashboardLayout role="doctor">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .ds-page * { font-family: 'DM Sans', sans-serif; }
        .ds-page h1, .ds-page h2, .ds-sora { font-family: 'Sora', sans-serif !important; }
        .ds-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes dsAurora {
          0%,100% { transform: translate(0,0) scale(1); opacity: .48; }
          50%      { transform: translate(26px,-16px) scale(1.05); opacity: .75; }
        }
        .ds-aurora { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; }
        .ds-input {
          width: 100%;
          padding: 10px 14px;
          font-size: 0.875rem;
          border-radius: 14px;
          background: rgba(74,157,135,0.05);
          border: 1px solid rgba(74,157,135,0.18);
          color: #1a2e28;
          transition: box-shadow .2s, border-color .2s;
          outline: none;
          font-family: 'DM Sans', sans-serif;
        }
        .ds-input:focus { border-color: rgba(74,157,135,0.45); box-shadow: 0 0 0 3px rgba(74,157,135,0.14); }
        .ds-input:disabled { opacity: 0.55; cursor: not-allowed; }
        .ds-input::placeholder { color: rgba(30,60,50,0.38); }
        .ds-divider { height: 1px; background: rgba(74,157,135,0.12); border: none; margin: 0; }
      `}</style>

      <div className="ds-page relative space-y-5 max-w-2xl">

        {/* Aurora blobs */}
        <div className="ds-aurora" style={{ width: 380, height: 380, background: "rgba(74,157,135,0.11)", top: -80, right: -60, animation: "dsAurora 22s ease-in-out infinite" }} />
        <div className="ds-aurora" style={{ width: 300, height: 300, background: "rgba(91,143,160,0.09)", top: 300, left: -100, animation: "dsAurora 18s ease-in-out infinite reverse" }} />

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-3xl relative overflow-hidden" style={glass}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
              }}>
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight ds-sora" style={{ color: C.text }}>
                Para<span className="ds-gradient-text">mètres</span>
              </h1>
              <p className="text-sm mt-1" style={{ color: C.textSoft }}>Gérer votre profil et vos préférences</p>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* ── Tab bar ── */}
            <div className="flex gap-1 p-1 rounded-2xl w-full"
              style={{ background: "rgba(74,157,135,0.08)", border: "1px solid rgba(74,157,135,0.14)" }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold transition-all ds-sora"
                  style={
                    activeTab === tab.id
                      ? {
                          background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                          color: "#fff",
                          boxShadow: "0 4px 14px rgba(74,157,135,0.28)",
                        }
                      : { color: C.textSoft }
                  }>
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">

              {/* ══════════ PROFILE TAB ══════════ */}
              {activeTab === "profile" && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="p-6 space-y-5"
                  style={glass}>

                  {/* Avatar */}
                  <div className="flex items-center gap-5">
                    <div className="relative shrink-0">
                      <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, rgba(74,157,135,0.18), rgba(91,143,160,0.14))`,
                          border: "2px solid rgba(74,157,135,0.25)",
                        }}>
                        {uploadingPhoto ? (
                          <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
                        ) : profile.photo_url ? (
                          <img src={profile.photo_url} alt="Photo de profil" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl font-bold ds-sora" style={{ color: C.primaryDark }}>
                            {profile.prenom?.[0]?.toUpperCase() || ""}
                            {profile.nom?.[0]?.toUpperCase() || ""}
                          </span>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        title="Changer la photo"
                        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110 disabled:opacity-50"
                        style={{
                          background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                          boxShadow: "0 4px 10px rgba(74,157,135,0.35)",
                        }}>
                        <Camera className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate ds-sora" style={{ color: C.text }}>
                        Dr. {profile.prenom} {profile.nom}
                      </p>
                      <p className="text-xs" style={{ color: C.textSoft }}>{profile.specialite || "Médecin"}</p>
                      <p className="text-xs truncate" style={{ color: C.textSoft }}>{profile.email}</p>

                      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingPhoto}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
                          style={{ background: "rgba(74,157,135,0.10)", color: C.primaryDark, border: "1px solid rgba(74,157,135,0.22)" }}>
                          <Upload className="w-3 h-3" />
                          {uploadingPhoto ? "Envoi..." : "Changer la photo"}
                        </button>
                        {profile.photo_url && (
                          <button
                            onClick={handleRemovePhoto}
                            disabled={saving || uploadingPhoto}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
                            style={{ background: "rgba(192,80,74,0.08)", color: C.muted, border: "1px solid rgba(192,80,74,0.20)" }}>
                            <X className="w-3 h-3" />
                            Supprimer
                          </button>
                        )}
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: C.textSoft }}>JPG, PNG · max 2 Mo</p>
                    </div>
                  </div>

                  <hr className="ds-divider" />

                  {/* Form grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: "prenom", label: "Prénom", placeholder: "Prénom", span: false },
                      { key: "nom",    label: "Nom",    placeholder: "Nom",    span: false },
                      { key: "telephone", label: "Téléphone", placeholder: "+216 XX XXX XXX", span: false },
                    ].map(({ key, label, placeholder, span }) => (
                      <div key={key} className={span ? "sm:col-span-2" : ""}>
                        <label className="block text-xs font-semibold mb-1.5 ds-sora" style={{ color: C.textSoft }}>{label}</label>
                        <input
                          className="ds-input"
                          value={(profile as any)[key]}
                          onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                          placeholder={placeholder}
                        />
                      </div>
                    ))}

                    {/* Sexe select */}
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 ds-sora" style={{ color: C.textSoft }}>Sexe</label>
                      <select
                        className="ds-input"
                        value={profile.sexe}
                        onChange={(e) => setProfile((p) => ({ ...p, sexe: e.target.value }))}>
                        <option value="">Non spécifié</option>
                        <option value="homme">Homme</option>
                        <option value="femme">Femme</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold mb-1.5 ds-sora" style={{ color: C.textSoft }}>Spécialité</label>
                      <input
                        className="ds-input"
                        value={profile.specialite}
                        onChange={(e) => setProfile((p) => ({ ...p, specialite: e.target.value }))}
                        placeholder="Ex: Cardiologie"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold mb-1.5 ds-sora" style={{ color: C.textSoft }}>Numéro de licence</label>
                      <input
                        className="ds-input"
                        value={profile.numero_licence}
                        disabled
                        readOnly
                        title="Non modifiable"
                      />
                      <p className="text-xs mt-1" style={{ color: C.textSoft }}>Ce champ n'est pas modifiable.</p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50 ds-sora"
                      style={{
                        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                        color: "#fff",
                        boxShadow: "0 6px 18px rgba(74,157,135,0.28)",
                      }}>
                      {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Enregistrer
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ══════════ SECURITY TAB ══════════ */}
              {activeTab === "security" && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="p-6 space-y-5"
                  style={glass}>

                  <div>
                    <h2 className="text-sm font-semibold ds-sora" style={{ color: C.text }}>Changer le mot de passe</h2>
                    <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>
                      Utilisez un mot de passe fort d'au moins 6 caractères.
                    </p>
                  </div>

                  <hr className="ds-divider" />

                  <div className="space-y-4">
                    {(
                      [
                        { field: "current", label: "Mot de passe actuel",             placeholder: "••••••••" },
                        { field: "new",     label: "Nouveau mot de passe",             placeholder: "••••••••" },
                        { field: "confirm", label: "Confirmer le nouveau mot de passe", placeholder: "••••••••" },
                      ] as const
                    ).map(({ field, label, placeholder }) => (
                      <div key={field}>
                        <label className="block text-xs font-semibold mb-1.5 ds-sora" style={{ color: C.textSoft }}>{label}</label>
                        <div className="relative">
                          <input
                            type={showPasswords[field] ? "text" : "password"}
                            className="ds-input"
                            style={{ paddingRight: "2.5rem" }}
                            value={passwords[field]}
                            onChange={(e) => setPasswords((p) => ({ ...p, [field]: e.target.value }))}
                            placeholder={placeholder}
                          />
                          <button
                            type="button"
                            onClick={() => togglePassword(field)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                            style={{ color: C.textSoft }}>
                            {showPasswords[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {passwords.new && passwords.confirm && passwords.new !== passwords.confirm && (
                    <p className="text-xs font-medium" style={{ color: C.muted }}>Les mots de passe ne correspondent pas.</p>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleChangePassword}
                      disabled={saving || !passwords.new || !passwords.confirm}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50 ds-sora"
                      style={{
                        background: `linear-gradient(135deg, ${C.secondary}, ${C.primary})`,
                        color: "#fff",
                        boxShadow: "0 6px 18px rgba(91,143,160,0.28)",
                      }}>
                      {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      Modifier le mot de passe
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorSettings;