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

/* ── Palette ─────────────────────────────────────────────── */
const C = {
  primary:     "#4a9d87",
  primaryDark: "#3d8c7a",
  secondary:   "#5b8fa0",
  text:        "#1a2e28",
  textSoft:    "rgba(30,60,50,0.62)",
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
    { id: "profil"   as Tab, label: "Profil",   icon: User   },
    { id: "securite" as Tab, label: "Sécurité", icon: Shield },
  ];

  return (
    <DashboardLayout role="family">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .fp-page * { font-family: 'DM Sans', sans-serif; }
        .fp-sora { font-family: 'Sora', sans-serif !important; }
        .fp-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes fpAurora {
          0%,100% { transform: translate(0,0) scale(1); opacity: .48; }
          50%      { transform: translate(26px,-16px) scale(1.05); opacity: .75; }
        }
        .fp-aurora { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; }
        .fp-input {
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
        .fp-input:focus { border-color: rgba(74,157,135,0.45); box-shadow: 0 0 0 3px rgba(74,157,135,0.14); }
        .fp-input:disabled { opacity: 0.52; cursor: not-allowed; background: rgba(30,60,50,0.04); }
        .fp-input::placeholder { color: rgba(30,60,50,0.32); }
      `}</style>

      <div className="fp-page relative space-y-5 max-w-2xl">

        {/* Aurora blobs */}
        <div className="fp-aurora" style={{ width: 360, height: 360, background: "rgba(74,157,135,0.11)", top: -80, right: -60, animation: "fpAurora 22s ease-in-out infinite" }} />
        <div className="fp-aurora" style={{ width: 280, height: 280, background: "rgba(91,143,160,0.09)", top: 300, left: -100, animation: "fpAurora 18s ease-in-out infinite reverse" }} />

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-3xl relative overflow-hidden" style={glass}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
              }}>
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight fp-sora" style={{ color: C.text }}>
                Para<span className="fp-gradient-text">mètres</span>
              </h1>
              <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                Gérez votre profil et la sécurité de votre compte
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Tab bar ── */}
        <div className="flex gap-1 p-1 rounded-2xl w-fit"
          style={{ background: "rgba(74,157,135,0.08)", border: "1px solid rgba(74,157,135,0.14)" }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all fp-sora"
                style={
                  activeTab === tab.id
                    ? {
                        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                        color: "#fff",
                        boxShadow: "0 4px 14px rgba(74,157,135,0.28)",
                      }
                    : { color: C.textSoft }
                }>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={activeTab}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
              className="p-6 space-y-5"
              style={glass}>

              {/* ══════════ PROFIL TAB ══════════ */}
              {activeTab === "profil" && (
                <>
                  {/* Avatar + name preview */}
                  <div className="flex items-center gap-4 pb-4"
                    style={{ borderBottom: "1px solid rgba(74,157,135,0.12)" }}>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0 fp-sora"
                      style={{
                        background: `linear-gradient(135deg, rgba(74,157,135,0.18), rgba(91,143,160,0.14))`,
                        color: C.primaryDark,
                        border: "2px solid rgba(74,157,135,0.22)",
                      }}>
                      {initials}
                    </div>
                    <div>
                      <p className="font-semibold fp-sora" style={{ color: C.text }}>
                        {[profile.prenom, profile.nom].filter(Boolean).join(" ") || "Votre profil"}
                      </p>
                      <p className="text-xs" style={{ color: C.textSoft }}>{profile.email}</p>
                    </div>
                  </div>

                  {/* Form grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Prénom",    key: "prenom",    disabled: false },
                      { label: "Nom",       key: "nom",       disabled: false },
                      { label: "Email",     key: "email",     disabled: true  },
                      { label: "Téléphone", key: "telephone", disabled: false },
                    ].map(({ label, key, disabled }) => (
                      <div key={key}>
                        <label className="text-xs font-semibold mb-1.5 block fp-sora" style={{ color: C.textSoft }}>
                          {label}
                        </label>
                        <input
                          value={profile[key as keyof ProfileForm]}
                          disabled={disabled}
                          onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                          className="fp-input"
                        />
                      </div>
                    ))}
                  </div>

                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50 fp-sora"
                    style={{
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      color: "#fff",
                      boxShadow: "0 6px 18px rgba(74,157,135,0.28)",
                    }}>
                    {saving
                      ? <><Loader className="w-4 h-4 animate-spin" />Enregistrement…</>
                      : <><Save className="w-4 h-4" />Enregistrer le profil</>}
                  </button>
                </>
              )}

              {/* ══════════ SÉCURITÉ TAB ══════════ */}
              {activeTab === "securite" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold fp-sora" style={{ color: C.text }}>Sécurité du compte</h3>

                  {/* Email display */}
                  <div className="p-4 rounded-xl"
                    style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.14)" }}>
                    <p className="text-xs font-semibold mb-1 fp-sora" style={{ color: C.textSoft }}>Adresse email</p>
                    <p className="text-sm font-semibold fp-sora" style={{ color: C.text }}>{profile.email || "—"}</p>
                  </div>

                  {/* Password reset */}
                  <div className="p-4 rounded-xl space-y-3"
                    style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.14)" }}>
                    <div>
                      <p className="text-sm font-semibold fp-sora" style={{ color: C.text }}>Changer le mot de passe</p>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: C.textSoft }}>
                        Un lien de réinitialisation sera envoyé à votre adresse email. Vérifiez aussi vos spams.
                      </p>
                    </div>
                    <button onClick={handleResetPassword}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 fp-sora"
                      style={{
                        background: "rgba(74,157,135,0.10)",
                        color: C.primaryDark,
                        border: "1px solid rgba(74,157,135,0.24)",
                      }}>
                      <Shield className="w-4 h-4" /> Envoyer le lien de réinitialisation
                    </button>
                  </div>

                  {/* Security tip */}
                  <div className="flex items-start gap-3 p-3.5 rounded-xl"
                    style={{
                      background: "rgba(74,157,135,0.07)",
                      border: "1px solid rgba(74,157,135,0.20)",
                    }}>
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: C.primary }} />
                    <p className="text-xs" style={{ color: C.textSoft }}>
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