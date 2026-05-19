import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Settings, Loader, Save, User, Shield, Users, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface ProfileForm {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
}

interface LinkedProche {
  patient_id: string;
  proche_id: string;
  lien_parente: string;
  contact_prioritaire: boolean;
  name: string;
}

const FamilyParametres = () => {
  const [profile, setProfile] = useState<ProfileForm>({
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"profil" | "proches" | "securite">("profil");

  // Mes Proches
  const [proches, setProches] = useState<LinkedProche[]>([]);
  const [savingProcheId, setSavingProcheId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data: util } = await supabase
        .from("utilisateurs")
        .select("nom, prenom, email, telephone")
        .eq("id", user.id)
        .single();

      if (util) {
        setProfile({
          nom: util.nom ?? "",
          prenom: util.prenom ?? "",
          email: util.email ?? "",
          telephone: util.telephone ?? "",
        });
      }

      const { data: links } = await supabase
        .from("proche_patient")
        .select("patient_id, proche_id, lien_parente, contact_prioritaire")
        .eq("proche_id", user.id);

      if (links?.length) {
        const { data: patientRows } = await supabase
          .from("patients")
          .select("id, user_id")
          .in("user_id", links.map((l) => l.patient_id));

        const userIds = (patientRows || []).map((p) => p.user_id);
        const { data: utilisateurs } = await supabase
          .from("utilisateurs")
          .select("id, nom, prenom")
          .in("id", userIds);

        const list: LinkedProche[] = links.map((l) => {
          const pr = (patientRows || []).find((p) => p.user_id === l.patient_id);
          const u = (utilisateurs || []).find((x) => x.id === pr?.user_id);
          const name = u ? [u.prenom, u.nom].filter(Boolean).join(" ").trim() || "Proche" : "Proche";
          return {
            patient_id: l.patient_id,
            proche_id: l.proche_id,
            lien_parente: l.lien_parente ?? "",
            contact_prioritaire: l.contact_prioritaire ?? false,
            name,
          };
        });
        setProches(list);
      }

      setLoading(false);
    };
    load();
  }, []);

  const handleSaveProfil = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("utilisateurs")
      .update({
        nom: profile.nom,
        prenom: profile.prenom,
        telephone: profile.telephone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profil enregistré");
  };

  const handleSaveProche = async (patientId: string) => {
    const p = proches.find((x) => x.patient_id === patientId);
    if (!p) return;
    setSavingProcheId(patientId);
    const { error } = await supabase
      .from("proche_patient")
      .update({
        lien_parente: p.lien_parente || null,
        contact_prioritaire: p.contact_prioritaire,
      })
      .eq("patient_id", patientId)
      .eq("proche_id", userId);
    setSavingProcheId(null);
    if (error) toast.error(error.message);
    else toast.success("Lien mis à jour");
  };

  const handleDeleteProche = async (patientId: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from("proche_patient")
      .delete()
      .eq("patient_id", patientId)
      .eq("proche_id", userId);
    setDeleteConfirm(null);
    if (error) toast.error(error.message);
    else {
      setProches((prev) => prev.filter((x) => x.patient_id !== patientId));
      toast.success("Lien supprimé");
    }
  };

  const handleResetPassword = async () => {
    if (!profile.email) return;
    await supabase.auth.resetPasswordForEmail(profile.email);
    toast.success("Email de réinitialisation envoyé. Vérifiez votre boîte mail.");
  };

  const updateProche = (patientId: string, patch: Partial<LinkedProche>) => {
    setProches((prev) =>
      prev.map((x) => (x.patient_id === patientId ? { ...x, ...patch } : x))
    );
  };

  const tabs = [
    { id: "profil",   label: "Profil",      icon: User   },
    { id: "proches",  label: "Mes Proches", icon: Users  },
    { id: "securite", label: "Sécurité",    icon: Shield },
  ] as const;

  return (
    <DashboardLayout role="family">
      <div className="space-y-6 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" /> Paramètres
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez votre profil et vos préférences</p>
        </motion.div>

        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit flex-wrap">
          {tabs.map((tab) => {
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
          <div className="flex justify-center py-20">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4"
          >
            {/* Tab 1 — Profil */}
            {activeTab === "profil" && (
              <>
                <h3 className="text-sm font-semibold text-card-foreground">Informations personnelles</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Prénom</label>
                    <input
                      value={profile.prenom}
                      onChange={(e) => setProfile((p) => ({ ...p, prenom: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Nom</label>
                    <input
                      value={profile.nom}
                      onChange={(e) => setProfile((p) => ({ ...p, nom: e.target.value }))}
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
                      onChange={(e) => setProfile((p) => ({ ...p, telephone: e.target.value }))}
                      className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleSaveProfil}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </>
            )}

            {/* Tab 2 — Mes Proches */}
            {activeTab === "proches" && (
              <>
                <h3 className="text-sm font-semibold text-card-foreground">Mes Proches</h3>
                {proches.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Aucun proche lié.</p>
                    <p className="text-xs mt-1">
                      Utilisez le code d&apos;invitation depuis la page Mes Proches.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {proches.map((p) => (
                      <div
                        key={p.patient_id}
                        className="p-4 bg-muted/30 rounded-xl border border-border space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                            {p.name
                              .trim()
                              .split(/\s+/)
                              .map((s) => s[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase() || "?"}
                          </div>
                          <span className="font-medium text-foreground">{p.name}</span>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Lien (ex. Mon père, Ma mère)</label>
                          <input
                            value={p.lien_parente}
                            onChange={(e) => updateProche(p.patient_id, { lien_parente: e.target.value })}
                            placeholder="Mon père, Ma mère, Mon conjoint..."
                            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={p.contact_prioritaire}
                              onChange={(e) =>
                                updateProche(p.patient_id, { contact_prioritaire: e.target.checked })
                              }
                              className="h-4 w-4 rounded border-border accent-primary"
                            />
                            Contact prioritaire
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveProche(p.patient_id)}
                              disabled={savingProcheId === p.patient_id}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-50"
                            >
                              {savingProcheId === p.patient_id ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                              Enregistrer
                            </button>
                            {deleteConfirm === p.patient_id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Supprimer ?</span>
                                <button
                                  onClick={() => handleDeleteProche(p.patient_id)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-critical text-critical-foreground"
                                >
                                  Oui
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border"
                                >
                                  Non
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(p.patient_id)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-critical hover:bg-critical/10 transition-all"
                              >
                                <Trash2 className="w-4 h-4" /> Supprimer le lien
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Tab 3 — Sécurité */}
            {activeTab === "securite" && (
              <>
                <h3 className="text-sm font-semibold text-card-foreground">Sécurité du compte</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-xl">
                    <p className="text-sm font-medium text-foreground">Changer le mot de passe</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Un email de réinitialisation sera envoyé à votre adresse.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      className="mt-3 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-all"
                    >
                      Envoyer le lien de réinitialisation
                    </button>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl">
                    <p className="text-xs text-muted-foreground mb-1">Email du compte</p>
                    <p className="text-sm font-medium text-foreground">{profile.email || "—"}</p>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default FamilyParametres;