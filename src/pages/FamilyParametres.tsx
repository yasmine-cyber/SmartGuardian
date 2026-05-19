import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Loader, Save, User, Shield, CheckCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface ProfileForm {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
}

type Tab = "profil" | "securite";

const FamilyParametres = () => {
  const [profile,   setProfile]   = useState<ProfileForm>({ nom: "", prenom: "", email: "", telephone: "" });
  const [userId,    setUserId]    = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("profil");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await supabase.from("utilisateurs")
        .select("nom, prenom, email, telephone").eq("id", user.id).single();
      if (data) setProfile({ nom: data.nom ?? "", prenom: data.prenom ?? "", email: data.email ?? "", telephone: data.telephone ?? "" });
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from("utilisateurs")
      .update({ nom: profile.nom, prenom: profile.prenom, telephone: profile.telephone, updated_at: new Date().toISOString() })
      .eq("id", userId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profil enregistré ✓");
  };

  const handleResetPassword = async () => {
    if (!profile.email) return;
    await supabase.auth.resetPasswordForEmail(profile.email);
    toast.success("Email de réinitialisation envoyé — vérifiez vos spams");
  };

  const initials = `${profile.prenom?.[0] ?? ""}${profile.nom?.[0] ?? ""}`.toUpperCase() || "?";

  const tabs = [
    { id: "profil"  as Tab, label: "Profil",   icon: User   },
    { id: "securite"as Tab, label: "Sécurité", icon: Shield },
  ];

  return (
    <DashboardLayout role="family">
      <div className="space-y-6 max-w-2xl">

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" /> Paramètres
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez votre profil et la sécurité de votre compte</p>
        </motion.div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader className="w-6 h-6 text-primary animate-spin" /></div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">

              {/* ── Profil ─────────────────────────────────────────────── */}
              {activeTab === "profil" && (
                <>
                  {/* Avatar + name preview */}
                  <div className="flex items-center gap-4 pb-4 border-b border-border">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold flex-shrink-0">
                      {initials}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {[profile.prenom, profile.nom].filter(Boolean).join(" ") || "Votre profil"}
                      </p>
                      <p className="text-xs text-muted-foreground">{profile.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Prénom",    key: "prenom",    disabled: false },
                      { label: "Nom",       key: "nom",       disabled: false },
                      { label: "Email",     key: "email",     disabled: true  },
                      { label: "Téléphone", key: "telephone", disabled: false },
                    ].map(({ label, key, disabled }) => (
                      <div key={key}>
                        <label className="text-xs text-muted-foreground mb-1.5 block font-medium">{label}</label>
                        <input
                          value={profile[key as keyof ProfileForm]}
                          disabled={disabled}
                          onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                          className={`w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all ${
                            disabled ? "bg-muted/50 text-muted-foreground cursor-not-allowed" : "bg-muted hover:border-primary/30"
                          }`}
                        />
                      </div>
                    ))}
                  </div>

                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50">
                    {saving ? <><Loader className="w-4 h-4 animate-spin" />Enregistrement…</> : <><Save className="w-4 h-4" />Enregistrer le profil</>}
                  </button>
                </>
              )}

              {/* ── Sécurité ───────────────────────────────────────────── */}
              {activeTab === "securite" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-card-foreground">Sécurité du compte</h3>

                  <div className="p-4 bg-muted/50 rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Adresse email</p>
                    <p className="text-sm font-semibold text-foreground">{profile.email || "—"}</p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Changer le mot de passe</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Un lien de réinitialisation sera envoyé à votre adresse email. Vérifiez aussi vos spams.
                      </p>
                    </div>
                    <button onClick={handleResetPassword}
                      className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary/20 transition-all">
                      <Shield className="w-4 h-4" /> Envoyer le lien de réinitialisation
                    </button>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Utilisez un mot de passe unique et ne le partagez jamais. Votre compte donne accès aux données de santé de vos proches.
                    </p>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </DashboardLayout>
  );
};

export default FamilyParametres;