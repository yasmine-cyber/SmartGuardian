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

const PatientSettings = () => {
  const [profile, setProfile] = useState<UserProfile>({
    nom: "", prenom: "", email: "", telephone: "", sexe: "",
  });
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    id: "", date_naissance: "", adresse: "", maladies: [], antecedents: "",
  });
  const [userId, setUserId]     = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [activeTab, setActiveTab] = useState<"profil" | "medical" | "proches" | "notifications" | "securite">("profil");

  // Invite code — never null, use "" instead
  const [inviteCode, setInviteCode]                 = useState<string>("");
  const [inviteCodeExpiresAt, setInviteCodeExpiresAt] = useState<string>("");
  const [inviteCodeLoading, setInviteCodeLoading]   = useState(false);
  const [inviteCodeCopied, setInviteCodeCopied]     = useState(false);

  // Notifications prefs
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
        nom:       util.nom       ?? "",
        prenom:    util.prenom    ?? "",
        email:     util.email     ?? "",
        telephone: util.telephone ?? "",
        sexe:      util.sexe      ?? "",
      });

      const { data: patient } = await supabase
        .from("patients")
        .select("id, date_naissance, adresse, maladies, antecedents, invite_code, invite_code_expires_at")
        .eq("user_id", user.id)
        .single();

      if (patient) {
        setPatientInfo({
          id:             patient.id             ?? "",
          date_naissance: patient.date_naissance ?? "",
          adresse:        patient.adresse        ?? "",
          maladies:       patient.maladies       ?? [],
          antecedents:    patient.antecedents    ?? "",
        });

        // Only set code if it's still valid
        const isValid =
          patient.invite_code &&
          patient.invite_code_expires_at &&
          new Date(patient.invite_code_expires_at) > new Date();

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

    await supabase
      .from("utilisateurs")
      .update({
        nom:       profile.nom,
        prenom:    profile.prenom,
        telephone: profile.telephone,
        sexe:      profile.sexe,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (patientInfo.id) {
      await supabase
        .from("patients")
        .update({
          date_naissance: patientInfo.date_naissance || null,
          adresse:        patientInfo.adresse,
          antecedents:    patientInfo.antecedents,
          updated_at:     new Date().toISOString(),
        })
        .eq("id", patientInfo.id);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const generateInviteCode = async () => {
    if (!patientInfo.id || inviteCodeLoading) return;
    setInviteCodeLoading(true);

    const code      = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { error } = await supabase
      .from("patients")
      .update({
        invite_code:            code,
        invite_code_expires_at: expiresAt.toISOString(),
        updated_at:             new Date().toISOString(),
      })
      .eq("id", patientInfo.id);

    if (!error) {
      setInviteCode(code);
      setInviteCodeExpiresAt(expiresAt.toISOString());
    } else {
      console.error("Erreur génération code:", error.message);
    }

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
    { id: "profil",        label: "Profil",         icon: User       },
    { id: "medical",       label: "Médical",         icon: Smartphone },
    { id: "proches",       label: "Proches",         icon: Users      },
    { id: "notifications", label: "Notifications",   icon: Bell       },
    { id: "securite",      label: "Sécurité",        icon: Shield     },
  ] as const;

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 max-w-3xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" /> Paramètres
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez votre profil et vos préférences</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit flex-wrap">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4"
          >

            {/* ━━━ PROFIL ━━━ */}
            {activeTab === "profil" && (
              <>
                <h3 className="text-sm font-semibold text-card-foreground">Informations personnelles</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Prénom</label>
                    <input
                      value={profile.prenom}
                      onChange={e => setProfile(p => ({ ...p, prenom: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Nom</label>
                    <input
                      value={profile.nom}
                      onChange={e => setProfile(p => ({ ...p, nom: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                    <input
                      value={profile.email}
                      disabled
                      className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Téléphone</label>
                    <input
                      value={profile.telephone}
                      onChange={e => setProfile(p => ({ ...p, telephone: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Sexe</label>
                    <select
                      value={profile.sexe}
                      onChange={e => setProfile(p => ({ ...p, sexe: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
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
                <h3 className="text-sm font-semibold text-card-foreground">Informations médicales</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Date de naissance</label>
                    <input
                      type="date"
                      value={patientInfo.date_naissance}
                      onChange={e => setPatientInfo(p => ({ ...p, date_naissance: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Adresse</label>
                    <input
                      value={patientInfo.adresse}
                      onChange={e => setPatientInfo(p => ({ ...p, adresse: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Maladies</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-xl border border-border min-h-[48px]">
                      {patientInfo.maladies?.length > 0
                        ? patientInfo.maladies.map((m, i) => (
                            <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{m}</span>
                          ))
                        : <span className="text-xs text-muted-foreground">Aucune maladie renseignée</span>
                      }
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Antécédents médicaux</label>
                    <textarea
                      value={patientInfo.antecedents}
                      onChange={e => setPatientInfo(p => ({ ...p, antecedents: e.target.value }))}
                      rows={4}
                      placeholder="Chirurgies, allergies, antécédents familiaux..."
                      className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ━━━ PROCHES ━━━ */}
            {activeTab === "proches" && (
              <>
                <h3 className="text-sm font-semibold text-card-foreground">Inviter un proche</h3>
                <p className="text-xs text-muted-foreground">
                  Générez un code à transmettre à un proche (parent, conjoint, aidant).
                  Il pourra l'utiliser pour lier son compte au vôtre et voir vos alertes en cas d'urgence.
                </p>
                <div className="p-4 bg-muted/50 rounded-xl border border-border space-y-3">
                  {isCodeValid ? (
                    <>
                      <p className="text-xs text-muted-foreground">Code valide 24h — partagez-le avec votre proche</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-2xl font-mono font-bold tracking-widest text-foreground bg-background px-4 py-2 rounded-lg border border-border">
                          {inviteCode}
                        </span>
                        <button
                          type="button"
                          onClick={copyInviteCode}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                        >
                          {inviteCodeCopied
                            ? <><CheckCircle className="w-4 h-4" /> Copié</>
                            : <><Copy className="w-4 h-4" /> Copier</>
                          }
                        </button>
                        <button
                          type="button"
                          onClick={generateInviteCode}
                          disabled={inviteCodeLoading}
                          className="p-2 rounded-xl border border-border hover:bg-muted/50 transition-all disabled:opacity-50"
                          title="Générer un nouveau code"
                        >
                          <RefreshCw className={`w-4 h-4 ${inviteCodeLoading ? "animate-spin" : ""}`} />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Expire le {new Date(inviteCodeExpiresAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">Aucun code actif. Générez-en un pour inviter un proche.</p>
                      <button
                        type="button"
                        onClick={generateInviteCode}
                        disabled={inviteCodeLoading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50"
                      >
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
                <h3 className="text-sm font-semibold text-card-foreground">Préférences de notifications</h3>
                <div className="space-y-4">
                  {[
                    { label: "Alertes médicales",    desc: "Recevoir les alertes critiques",              value: notifAlertes, set: setNotifAlertes },
                    { label: "Détection de chute",   desc: "Notification immédiate en cas de chute",      value: notifChute,   set: setNotifChute   },
                    { label: "Rapport hebdomadaire", desc: "Résumé de vos constantes chaque semaine",     value: notifRapport, set: setNotifRapport },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => item.set(!item.value)}
                        className={`w-12 h-6 rounded-full transition-all relative ${item.value ? "bg-primary" : "bg-muted-foreground/30"}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow ${item.value ? "left-7" : "left-1"}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ━━━ SECURITE ━━━ */}
            {activeTab === "securite" && (
              <>
                <h3 className="text-sm font-semibold text-card-foreground">Sécurité du compte</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-xl">
                    <p className="text-sm font-medium text-foreground">Changer le mot de passe</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Un email de réinitialisation sera envoyé à {profile.email}
                    </p>
                    <button
                      onClick={async () => {
                        await supabase.auth.resetPasswordForEmail(profile.email);
                        alert("Email de réinitialisation envoyé !");
                      }}
                      className="mt-3 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-all"
                    >
                      Envoyer le lien de réinitialisation
                    </button>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl">
                    <p className="text-sm font-medium text-foreground">Email du compte</p>
                    <p className="text-xs text-muted-foreground mt-1">{profile.email}</p>
                  </div>
                </div>
              </>
            )}

            {/* Save button — profil & medical only */}
            {(activeTab === "profil" || activeTab === "medical") && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {saving
                    ? <><Loader className="w-4 h-4 animate-spin" /> Sauvegarde...</>
                    : saved
                    ? <><CheckCircle className="w-4 h-4" /> Sauvegardé !</>
                    : <><Save className="w-4 h-4" /> Sauvegarder</>
                  }
                </button>
                {saved && <span className="text-xs text-green-500">✅ Modifications enregistrées</span>}
              </div>
            )}

          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientSettings;