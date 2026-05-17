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

  // ── Upload photo depuis le PC ──
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

  const inputClass =
    "w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all";

  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <DashboardLayout role="doctor">
      <div className="space-y-6 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
          <p className="text-muted-foreground text-sm mt-1">Gérer votre profil et vos préférences</p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Tab Bar */}
            <div className="flex gap-1 bg-muted/50 rounded-xl p-1 border border-border">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-card text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {/* ── PROFILE TAB ── */}
              {activeTab === "profile" && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5"
                >
                  {/* Avatar section */}
                  <div className="flex items-center gap-5">
                    <div className="relative flex-shrink-0">
                      <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden">
                        {uploadingPhoto ? (
                          <Loader className="w-6 h-6 text-primary animate-spin" />
                        ) : profile.photo_url ? (
                          <img
                            src={profile.photo_url}
                            alt="Photo de profil"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl font-bold text-primary">
                            {profile.prenom?.[0]?.toUpperCase() || ""}
                            {profile.nom?.[0]?.toUpperCase() || ""}
                          </span>
                        )}
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoChange}
                      />

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        title="Changer la photo"
                        className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-sm hover:brightness-110 transition-all disabled:opacity-50"
                      >
                        <Camera className="w-3.5 h-3.5 text-primary-foreground" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        Dr. {profile.prenom} {profile.nom}
                      </p>
                      <p className="text-xs text-muted-foreground">{profile.specialite || "Médecin"}</p>
                      <p className="text-xs text-muted-foreground truncate">{profile.email}</p>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingPhoto}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-xs font-medium text-foreground hover:bg-muted transition-all disabled:opacity-50"
                        >
                          <Upload className="w-3 h-3" />
                          {uploadingPhoto ? "Envoi en cours..." : "Changer la photo"}
                        </button>
                        {profile.photo_url && (
                          <button
                            onClick={handleRemovePhoto}
                            disabled={saving || uploadingPhoto}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-all disabled:opacity-50"
                          >
                            <X className="w-3 h-3" />
                            Supprimer
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">JPG, PNG · max 2 Mo</p>
                    </div>
                  </div>

                  <hr className="border-border" />

                  {/* Form Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Prénom</label>
                      <input
                        className={inputClass}
                        value={profile.prenom}
                        onChange={(e) => setProfile((p) => ({ ...p, prenom: e.target.value }))}
                        placeholder="Prénom"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Nom</label>
                      <input
                        className={inputClass}
                        value={profile.nom}
                        onChange={(e) => setProfile((p) => ({ ...p, nom: e.target.value }))}
                        placeholder="Nom"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Téléphone</label>
                      <input
                        className={inputClass}
                        value={profile.telephone}
                        onChange={(e) => setProfile((p) => ({ ...p, telephone: e.target.value }))}
                        placeholder="+216 XX XXX XXX"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Sexe</label>
                      <select
                        className={inputClass}
                        value={profile.sexe}
                        onChange={(e) => setProfile((p) => ({ ...p, sexe: e.target.value }))}
                      >
                        <option value="">Non spécifié</option>
                        <option value="homme">Homme</option>
                        <option value="femme">Femme</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Spécialité</label>
                      <input
                        className={inputClass}
                        value={profile.specialite}
                        onChange={(e) => setProfile((p) => ({ ...p, specialite: e.target.value }))}
                        placeholder="Ex: Cardiologie"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Numéro de licence</label>
                      <input
                        className={`${inputClass} opacity-60 cursor-not-allowed`}
                        value={profile.numero_licence}
                        disabled
                        readOnly
                        title="Non modifiable"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Ce champ n'est pas modifiable.</p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Enregistrer
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── SECURITY TAB ── */}
              {activeTab === "security" && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5"
                >
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Changer le mot de passe</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Utilisez un mot de passe fort d'au moins 6 caractères.
                    </p>
                  </div>

                  <hr className="border-border" />

                  <div className="space-y-4">
                    {(
                      [
                        { field: "current", label: "Mot de passe actuel", placeholder: "••••••••" },
                        { field: "new", label: "Nouveau mot de passe", placeholder: "••••••••" },
                        { field: "confirm", label: "Confirmer le nouveau mot de passe", placeholder: "••••••••" },
                      ] as const
                    ).map(({ field, label, placeholder }) => (
                      <div key={field}>
                        <label className={labelClass}>{label}</label>
                        <div className="relative">
                          <input
                            type={showPasswords[field] ? "text" : "password"}
                            className={`${inputClass} pr-10`}
                            value={passwords[field]}
                            onChange={(e) => setPasswords((p) => ({ ...p, [field]: e.target.value }))}
                            placeholder={placeholder}
                          />
                          <button
                            type="button"
                            onClick={() => togglePassword(field)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPasswords[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {passwords.new && passwords.confirm && passwords.new !== passwords.confirm && (
                    <p className="text-xs text-red-500">Les mots de passe ne correspondent pas.</p>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleChangePassword}
                      disabled={saving || !passwords.new || !passwords.confirm}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50"
                    >
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