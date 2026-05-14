import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Copy, RefreshCw, CheckCircle, Loader, Phone, Mail, Heart, UserX, ShieldCheck } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Proche {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  lien_parente: string | null;
  contact_prioritaire: boolean;
}

const PatientProches = () => {
  const [inviteCode, setInviteCode] = useState<string>("");
  const [inviteCodeExpiresAt, setInviteCodeExpiresAt] = useState<string>("");
  const [inviteCodeLoading, setInviteCodeLoading] = useState(false);
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [proches, setProches] = useState<Proche[]>([]);
  const [loadingProches, setLoadingProches] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get patient record
      const { data: patient } = await supabase
        .from("patients")
        .select("id, invite_code, invite_code_expires_at")
        .eq("user_id", user.id)
        .single();

      if (patient) {
        setPatientId(patient.id);
        const isValid = patient.invite_code && patient.invite_code_expires_at && new Date(patient.invite_code_expires_at) > new Date();
        setInviteCode(isValid ? patient.invite_code : "");
        setInviteCodeExpiresAt(isValid ? patient.invite_code_expires_at : "");
      }

      // Fetch linked proches via proche_patient → utilisateurs
      const { data: links } = await supabase
        .from("proche_patient")
        .select("proche_id, lien_parente, contact_prioritaire")
        .eq("patient_id", user.id);

      if (links && links.length > 0) {
        const procheIds = links.map(l => l.proche_id);
        const { data: users } = await supabase
          .from("utilisateurs")
          .select("id, nom, prenom, email, telephone")
          .in("id", procheIds);

        if (users) {
          const merged: Proche[] = users.map(u => {
            const link = links.find(l => l.proche_id === u.id);
            return {
              ...u,
              lien_parente: link?.lien_parente || null,
              contact_prioritaire: link?.contact_prioritaire || false,
            };
          });
          setProches(merged);
        }
      }
      setLoadingProches(false);
    };
    init();
  }, []);

  const generateInviteCode = async () => {
    if (!patientId || inviteCodeLoading) return;
    setInviteCodeLoading(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    const { error } = await supabase
      .from("patients")
      .update({ invite_code: code, invite_code_expires_at: expiresAt.toISOString(), updated_at: new Date().toISOString() })
      .eq("id", patientId);
    if (!error) {
      setInviteCode(code);
      setInviteCodeExpiresAt(expiresAt.toISOString());
      toast.success("Nouveau code généré !");
    } else {
      toast.error("Erreur lors de la génération du code.");
    }
    setInviteCodeLoading(false);
  };

  const copyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setInviteCodeCopied(true);
      setTimeout(() => setInviteCodeCopied(false), 2000);
      toast.success("Code copié !");
    }
  };

  const isCodeValid = inviteCode !== "" && inviteCodeExpiresAt !== "" && new Date(inviteCodeExpiresAt) > new Date();

  const getInitials = (nom: string, prenom: string) =>
    `${prenom?.[0] || ""}${nom?.[0] || ""}`.toUpperCase() || "?";

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Mes Proches
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez vos proches et invitations</p>
        </motion.div>

        {/* ── PROCHES ASSIGNÉS ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Proches assignés
          </h3>

          {loadingProches ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : proches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserX className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun proche assigné pour le moment.</p>
              <p className="text-xs mt-1">Générez un code d'invitation ci-dessous pour en ajouter un.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {proches.map((p) => (
                <div key={p.id}
                  className="flex items-center gap-4 p-4 bg-muted/40 rounded-xl border border-border/50">
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-sm">{getInitials(p.nom, p.prenom)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {[p.prenom, p.nom].filter(Boolean).join(" ")}
                      </p>
                      {p.contact_prioritaire && (
                        <span className="px-1.5 py-0.5 rounded-full bg-critical/10 text-critical text-[10px] font-bold">
                          PRIORITAIRE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.lien_parente || "Proche"}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3" /> {p.email}
                      </span>
                      {p.telephone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" /> {p.telephone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── INVITATION CODE ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <Heart className="w-4 h-4 text-primary" /> Inviter un proche
          </h3>
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
                  <button onClick={copyInviteCode}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all">
                    {inviteCodeCopied
                      ? <><CheckCircle className="w-4 h-4" /> Copié</>
                      : <><Copy className="w-4 h-4" /> Copier</>
                    }
                  </button>
                  <button onClick={generateInviteCode} disabled={inviteCodeLoading}
                    className="p-2 rounded-xl border border-border hover:bg-muted/50 transition-all disabled:opacity-50"
                    title="Générer un nouveau code">
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
                <button onClick={generateInviteCode} disabled={inviteCodeLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50">
                  {inviteCodeLoading
                    ? <><Loader className="w-4 h-4 animate-spin" /> Génération...</>
                    : <><Users className="w-4 h-4" /> Générer un code d'invitation</>
                  }
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default PatientProches;