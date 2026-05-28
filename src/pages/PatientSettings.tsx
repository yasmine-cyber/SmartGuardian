import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings, Loader, Save, CheckCircle, User, Bell, Shield, Smartphone, Users, Copy, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  sexe: string;
}

interface PatientInfo {
  id: string;
  date_naissance: string;
  adresse: string;
  maladies: string[];
  antecedents: string;
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

const PatientSettings = () => {
  const [profile, setProfile] = useState<UserProfile>({
    nom: "", prenom: "", email: "", telephone: "", sexe: "",
  });
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    id: "", date_naissance: "", adresse: "", maladies: [], antecedents: "",
  });
  const [userId, setUserId]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [activeTab, setActiveTab] = useState<"profil" | "medical" | "proches" | "notifications" | "securite">("profil");

  const [inviteCode, setInviteCode]                   = useState<string>("");
  const [inviteCodeExpiresAt, setInviteCodeExpiresAt] = useState<string>("");
  const [inviteCodeLoading, setInviteCodeLoading]     = useState(false);
  const [inviteCodeCopied, setInviteCodeCopied]       = useState(false);

  const [notifAlertes, setNotifAlertes] = useState(true);
  const [notifChute, setNotifChute]     = useState(true);
  const [notifRapport, setNotifRapport] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: util } = await supabase
        .from("utilisateurs")
        .select("nom, prenom, email, telephone, sexe")
        .eq("id", user.id)
        .single();

      if (util) setProfile({
        nom: util.nom ?? "", prenom: util.prenom ?? "", email: util.email ?? "",
        telephone: util.telephone ?? "", sexe: util.sexe ?? "",
      });

      const { data: patient } = await supabase
        .from("patients")
        .select("id, date_naissance, adresse, maladies, antecedents, invite_code, invite_code_expires_at")
        .eq("user_id", user.id)
        .single();

      if (patient) {
        setPatientInfo({
          id: patient.id ?? "", date_naissance: patient.date_naissance ?? "",
          adresse: patient.adresse ?? "", maladies: patient.maladies ?? [],
          antecedents: patient.antecedents ?? "",
        });
        const isValid = patient.invite_code && patient.invite_code_expires_at && new Date(patient.invite_code_expires_at) > new Date();
        setInviteCode(isValid ? patient.invite_code : "");
        setInviteCodeExpiresAt(isValid ? patient.invite_code_expires_at : "");
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase.from("utilisateurs").update({
      nom: profile.nom, prenom: profile.prenom, telephone: profile.telephone,
      sexe: profile.sexe, updated_at: new Date().toISOString(),
    }).eq("id", userId);
    if (patientInfo.id) {
      await supabase.from("patients").update({
        date_naissance: patientInfo.date_naissance || null,
        adresse: patientInfo.adresse, antecedents: patientInfo.antecedents,
        updated_at: new Date().toISOString(),
      }).eq("id", patientInfo.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const generateInviteCode = async () => {
    if (!patientInfo.id || inviteCodeLoading) return;
    setInviteCodeLoading(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    const { error } = await supabase.from("patients").update({
      invite_code: code, invite_code_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", patientInfo.id);
    if (!error) { setInviteCode(code); setInviteCodeExpiresAt(expiresAt.toISOString()); }
    setInviteCodeLoading(false);
  };

  const copyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setInviteCodeCopied(true);
      setTimeout(() => setInviteCodeCopied(false), 2000);
    }
  };

  const isCodeValid = inviteCode !== "" && inviteCodeExpiresAt !== "" && new Date(inviteCodeExpiresAt) > new Date();

  const tabs = [
    { id: "profil",        label: "Profil",       icon: User       },
    { id: "medical",       label: "Médical",       icon: Smartphone },
    { id: "proches",       label: "Proches",       icon: Users      },
    { id: "notifications", label: "Notifs",        icon: Bell       },
    { id: "securite",      label: "Sécurité",      icon: Shield     },
  ] as const;

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
          outline:none; transition:border .2s, box-shadow .2s; font-family:'DM Sans',sans-serif;
        }
        .sg-input::placeholder { color:rgba(30,60,50,0.35); }
        .sg-input:focus { border-color:rgba(74,157,135,0.50); box-shadow:0 0 0 3px rgba(74,157,135,0.10); }
        .sg-input:disabled { opacity:.50; cursor:not-allowed; background:rgba(74,157,135,0.04); }
        .sg-section-title { font-family:'Sora',sans-serif; font-size:13px; font-weight:600; color:#1a2e28; margin-bottom:16px; }
        .sg-tab-pill-active {
          background: linear-gradient(135deg, #4a9d87, #5b8fa0);
          color: #fff;
          box-shadow: 0 4px 14px rgba(74,157,135,0.30);
        }
        .sg-tab-pill {
          color: rgba(30,60,50,0.55);
          background: transparent;
          transition: all .2s;
        }
        .sg-tab-pill:hover { color: #1a2e28; background: rgba(74,157,135,0.07); }
        .sg-toggle-on  { background: linear-gradient(135deg, #4a9d87, #5b8fa0); }
        .sg-toggle-off { background: rgba(30,60,50,0.18); }
        .sg-notif-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:14px 16px; border-radius:16px;
          background:rgba(74,157,135,0.04); border:1px solid rgba(74,157,135,0.12);
        }
      `}</style>

      <div className="sg-page relative max-w-3xl">
        {/* Aurora orbs */}
        <div className="sg-aurora-a" style={{ background: "rgba(74,157,135,0.13)", top: -100, right: -80, animation: "sgAurora 22s ease-in-out infinite", zIndex: 0 }} />
        <div className="sg-aurora-a" style={{ background: "rgba(91,143,160,0.11)", top: 320, left: -120, animation: "sgAurora 18s ease-in-out infinite reverse", zIndex: 0 }} />

        <div className="relative space-y-5">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 sg-card" style={glass}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                }}>
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight sg-sora" style={{ color: C.text }}>
                  Mes <span className="sg-gradient-text">Paramètres</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                  Gérez votre profil et vos préférences
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Tab pills ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
            <div className="flex gap-1.5 flex-wrap p-1.5 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.60)", backdropFilter: "blur(12px)", border: "1px solid rgba(74,157,135,0.14)" }}>
              {tabs.map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold sg-sora ${active ? "sg-tab-pill-active" : "sg-tab-pill"}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* ── Content ── */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
            </div>
          ) : (
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="sg-card p-6 space-y-4" style={glass}>

              {/* ━━━ PROFIL ━━━ */}
              {activeTab === "profil" && (
                <>
                  <p className="sg-section-title">Informations personnelles</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Prénom",    val: profile.prenom,    set: (v: string) => setProfile(p => ({ ...p, prenom: v })) },
                      { label: "Nom",       val: profile.nom,       set: (v: string) => setProfile(p => ({ ...p, nom: v })) },
                      { label: "Téléphone", val: profile.telephone, set: (v: string) => setProfile(p => ({ ...p, telephone: v })) },
                    ].map(f => (
                      <div key={f.label}>
                        <label className="block text-xs mb-1.5" style={{ color: C.textSoft }}>{f.label}</label>
                        <input value={f.val} onChange={e => f.set(e.target.value)} className="sg-input" />
                      </div>
                    ))}

                    {/* Email — disabled */}
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: C.textSoft }}>
                        Email <span className="ml-1 px-2 py-0.5 rounded-full text-[10px]"
                          style={{ background: "rgba(74,157,135,0.08)", color: C.textSoft }}>Non modifiable</span>
                      </label>
                      <input value={profile.email} disabled className="sg-input" />
                    </div>

                    {/* Sexe */}
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: C.textSoft }}>Sexe</label>
                      <select value={profile.sexe} onChange={e => setProfile(p => ({ ...p, sexe: e.target.value }))} className="sg-input">
                        <option value="">Non précisé</option>
                        <option value="homme">Homme</option>
                        <option value="femme">Femme</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* ━━━ MEDICAL ━━━ */}
              {activeTab === "medical" && (
                <>
                  <p className="sg-section-title">Informations médicales</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: C.textSoft }}>Date de naissance</label>
                      <input type="date" value={patientInfo.date_naissance}
                        onChange={e => setPatientInfo(p => ({ ...p, date_naissance: e.target.value }))}
                        className="sg-input" />
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: C.textSoft }}>Adresse</label>
                      <input value={patientInfo.adresse}
                        onChange={e => setPatientInfo(p => ({ ...p, adresse: e.target.value }))}
                        className="sg-input" />
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: C.textSoft }}>Maladies</label>
                      <div className="flex flex-wrap gap-2 p-3 rounded-2xl min-h-[48px]"
                        style={{ background: "rgba(74,157,135,0.04)", border: "1px solid rgba(74,157,135,0.14)" }}>
                        {patientInfo.maladies?.length > 0
                          ? patientInfo.maladies.map((m, i) => (
                              <span key={i} className="text-xs px-3 py-1 rounded-full"
                                style={{ background: "rgba(74,157,135,0.10)", color: C.primary, border: "1px solid rgba(74,157,135,0.22)" }}>
                                {m}
                              </span>
                            ))
                          : <span className="text-xs" style={{ color: C.textSoft }}>Aucune maladie renseignée</span>
                        }
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs mb-1.5" style={{ color: C.textSoft }}>Antécédents médicaux</label>
                      <textarea value={patientInfo.antecedents}
                        onChange={e => setPatientInfo(p => ({ ...p, antecedents: e.target.value }))}
                        rows={4}
                        placeholder="Chirurgies, allergies, antécédents familiaux..."
                        className="sg-input resize-none" />
                    </div>
                  </div>
                </>
              )}

              {/* ━━━ PROCHES ━━━ */}
              {activeTab === "proches" && (
                <>
                  <p className="sg-section-title">Inviter un proche</p>
                  <p className="text-xs" style={{ color: C.textSoft }}>
                    Générez un code à transmettre à un proche (parent, conjoint, aidant).
                    Il pourra l'utiliser pour lier son compte au vôtre et voir vos alertes en cas d'urgence.
                  </p>

                  <div className="p-4 rounded-2xl space-y-3"
                    style={{
                      background: isCodeValid ? "rgba(74,157,135,0.06)" : "rgba(30,60,50,0.03)",
                      border: isCodeValid ? "1px solid rgba(74,157,135,0.22)" : "1px solid rgba(74,157,135,0.12)",
                    }}>
                    {isCodeValid ? (
                      <>
                        <p className="text-xs" style={{ color: C.textSoft }}>Code valide 24h — partagez-le avec votre proche</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-2xl font-mono font-bold tracking-widest sg-sora px-4 py-2 rounded-xl"
                            style={{
                              color: C.text,
                              background: "rgba(255,255,255,0.85)",
                              border: "1px solid rgba(74,157,135,0.20)",
                              boxShadow: "0 4px 12px rgba(74,157,135,0.10)",
                            }}>
                            {inviteCode}
                          </span>
                          <button type="button" onClick={copyInviteCode}
                            className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold transition-all hover:scale-105"
                            style={{
                              background: inviteCodeCopied ? `linear-gradient(135deg, ${C.primary}, ${C.secondary})` : "rgba(74,157,135,0.10)",
                              color: inviteCodeCopied ? "#fff" : C.primary,
                              border: "1px solid rgba(74,157,135,0.28)",
                              boxShadow: inviteCodeCopied ? "0 6px 18px rgba(74,157,135,0.30)" : "none",
                            }}>
                            {inviteCodeCopied ? <><CheckCircle className="w-3.5 h-3.5" /> Copié</> : <><Copy className="w-3.5 h-3.5" /> Copier</>}
                          </button>
                          <button type="button" onClick={generateInviteCode} disabled={inviteCodeLoading}
                            className="p-2 rounded-full transition-all hover:scale-105 disabled:opacity-50"
                            title="Générer un nouveau code"
                            style={{ background: "rgba(74,157,135,0.08)", border: "1px solid rgba(74,157,135,0.20)", color: C.primaryDark }}>
                            <RefreshCw className={`w-4 h-4 ${inviteCodeLoading ? "animate-spin" : ""}`} />
                          </button>
                        </div>
                        <p className="text-[11px]" style={{ color: C.textSoft }}>
                          Expire le {new Date(inviteCodeExpiresAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm" style={{ color: C.textSoft }}>Aucun code actif. Générez-en un pour inviter un proche.</p>
                        <button type="button" onClick={generateInviteCode} disabled={inviteCodeLoading}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
                          style={{
                            background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                            color: "#fff",
                            boxShadow: "0 6px 22px rgba(74,157,135,0.35)",
                          }}>
                          {inviteCodeLoading
                            ? <><Loader className="w-4 h-4 animate-spin" /> Génération...</>
                            : <><Users className="w-4 h-4" /> Générer un code d'invitation</>
                          }
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* ━━━ NOTIFICATIONS ━━━ */}
              {activeTab === "notifications" && (
                <>
                  <p className="sg-section-title">Préférences de notifications</p>
                  <div className="space-y-3">
                    {[
                      { label: "Alertes médicales",    desc: "Recevoir les alertes critiques",          value: notifAlertes, set: setNotifAlertes },
                      { label: "Détection de chute",   desc: "Notification immédiate en cas de chute",  value: notifChute,   set: setNotifChute   },
                      { label: "Rapport hebdomadaire", desc: "Résumé de vos constantes chaque semaine", value: notifRapport, set: setNotifRapport },
                    ].map((item, i) => (
                      <div key={i} className="sg-notif-row">
                        <div>
                          <p className="text-sm font-semibold sg-sora" style={{ color: C.text }}>{item.label}</p>
                          <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>{item.desc}</p>
                        </div>
                        <button onClick={() => item.set(!item.value)}
                          className={`w-12 h-6 rounded-full transition-all relative ${item.value ? "sg-toggle-on" : "sg-toggle-off"}`}
                          style={{ boxShadow: item.value ? "0 3px 10px rgba(74,157,135,0.30)" : "none" }}>
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${item.value ? "left-7" : "left-1"}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ━━━ SECURITE ━━━ */}
              {activeTab === "securite" && (
                <>
                  <p className="sg-section-title">Sécurité du compte</p>
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl"
                      style={{ background: "rgba(74,157,135,0.04)", border: "1px solid rgba(74,157,135,0.14)" }}>
                      <p className="text-sm font-semibold sg-sora" style={{ color: C.text }}>Changer le mot de passe</p>
                      <p className="text-xs mt-1" style={{ color: C.textSoft }}>
                        Un email de réinitialisation sera envoyé à {profile.email}
                      </p>
                      <button
                        onClick={async () => {
                          await supabase.auth.resetPasswordForEmail(profile.email);
                          alert("Email de réinitialisation envoyé !");
                        }}
                        className="mt-3 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105"
                        style={{
                          background: "rgba(74,157,135,0.10)",
                          color: C.primary,
                          border: "1px solid rgba(74,157,135,0.24)",
                        }}>
                        Envoyer le lien de réinitialisation
                      </button>
                    </div>
                    <div className="p-4 rounded-2xl"
                      style={{ background: "rgba(74,157,135,0.04)", border: "1px solid rgba(74,157,135,0.14)" }}>
                      <p className="text-sm font-semibold sg-sora" style={{ color: C.text }}>Email du compte</p>
                      <p className="text-xs mt-1" style={{ color: C.textSoft }}>{profile.email}</p>
                    </div>
                  </div>
                </>
              )}

              {/* ── Save button — profil & medical only ── */}
              {(activeTab === "profil" || activeTab === "medical") && (
                <div className="flex items-center gap-3 pt-2" style={{ borderTop: "1px solid rgba(74,157,135,0.12)" }}>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: saved
                        ? `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})`
                        : `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      color: "#fff",
                      boxShadow: "0 6px 22px rgba(74,157,135,0.35)",
                    }}>
                    {saving
                      ? <><Loader className="w-4 h-4 animate-spin" /> Sauvegarde...</>
                      : saved
                      ? <><CheckCircle className="w-4 h-4" /> Sauvegardé !</>
                      : <><Save className="w-4 h-4" /> Sauvegarder</>
                    }
                  </button>
                  {saved && (
                    <span className="text-xs font-medium" style={{ color: C.primary }}>
                      ✅ Modifications enregistrées
                    </span>
                  )}
                </div>
              )}

            </motion.div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientSettings;