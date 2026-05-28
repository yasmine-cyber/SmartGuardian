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

    const { data, error } = await supabase.rpc("generate_invite_code", {
      p_patient_id: patientId,
    });

    if (!error && data?.ok) {
      setInviteCode(data.code);
      setInviteCodeExpiresAt(data.expires_at);
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
        .sg-card:hover { transform: translateY(-2px); box-shadow: 0 18px 44px rgba(30,60,50,0.08); }
      `}</style>

      <div className="sg-page relative max-w-3xl">
        {/* Aurora orbs */}
        <div className="sg-aurora-a" style={{ background: "rgba(74,157,135,0.13)", top: -100, right: -80, animation: "sgAurora 22s ease-in-out infinite" }} />
        <div className="sg-aurora-a" style={{ background: "rgba(91,143,160,0.12)", top: 280, left: -120, animation: "sgAurora 18s ease-in-out infinite reverse" }} />

        <div className="relative space-y-5">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl sg-card" style={glass}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                }}>
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight sg-sora" style={{ color: C.text }}>
                  Mes <span className="sg-gradient-text">Proches</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                  Gérez vos proches et invitations
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Proches assignés ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="sg-card" style={glass}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, boxShadow: "0 4px 14px rgba(74,157,135,0.25)" }}>
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>Proches assignés</h3>
              </div>

              {loadingProches ? (
                <div className="flex items-center justify-center py-10">
                  <Loader className="w-5 h-5 animate-spin" style={{ color: C.primary }} />
                </div>
              ) : proches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-14 h-14 rounded-3xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      boxShadow: "0 12px 28px rgba(74,157,135,0.28)",
                      opacity: 0.5,
                    }}>
                    <UserX className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold sg-sora" style={{ color: C.text }}>Aucun proche assigné</p>
                    <p className="text-xs mt-1" style={{ color: C.textSoft }}>Générez un code d'invitation ci-dessous pour en ajouter un.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {proches.map((p) => (
                    <div key={p.id}
                      className="flex items-center gap-4 p-4 rounded-2xl transition-colors"
                      style={{
                        background: "rgba(74,157,135,0.04)",
                        border: "1px solid rgba(74,157,135,0.14)",
                      }}>
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                          boxShadow: "0 4px 14px rgba(74,157,135,0.28)",
                        }}>
                        <span className="text-white font-bold text-sm sg-sora">{getInitials(p.nom, p.prenom)}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold sg-sora" style={{ color: C.text }}>
                            {[p.prenom, p.nom].filter(Boolean).join(" ")}
                          </p>
                          {p.contact_prioritaire && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: "rgba(192,80,74,0.12)", color: C.muted, border: "1px solid rgba(192,80,74,0.25)" }}>
                              PRIORITAIRE
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>{p.lien_parente || "Proche"}</p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px]" style={{ color: C.textSoft }}>
                            <Mail className="w-3 h-3" style={{ color: C.primary }} /> {p.email}
                          </span>
                          {p.telephone && (
                            <span className="flex items-center gap-1 text-[11px]" style={{ color: C.textSoft }}>
                              <Phone className="w-3 h-3" style={{ color: C.primary }} /> {p.telephone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Invitation Code ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="sg-card" style={glass}>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.primary})`, boxShadow: "0 4px 14px rgba(212,168,67,0.28)" }}>
                  <Heart className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-sm font-semibold sg-sora" style={{ color: C.text }}>Inviter un proche</h3>
              </div>

              <p className="text-xs" style={{ color: C.textSoft }}>
                Générez un code à transmettre à un proche (parent, conjoint, aidant).
                Il pourra l'utiliser pour lier son compte au vôtre et voir vos alertes en cas d'urgence.
              </p>

              {/* Code box */}
              <div className="p-4 rounded-2xl space-y-3"
                style={{
                  background: isCodeValid
                    ? "rgba(74,157,135,0.06)"
                    : "rgba(30,60,50,0.03)",
                  border: isCodeValid
                    ? "1px solid rgba(74,157,135,0.22)"
                    : "1px solid rgba(74,157,135,0.12)",
                }}>
                {isCodeValid ? (
                  <>
                    <p className="text-xs" style={{ color: C.textSoft }}>Code valide 24h — partagez-le avec votre proche</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Code display */}
                      <span className="text-2xl font-mono font-bold tracking-widest sg-sora px-4 py-2 rounded-xl"
                        style={{
                          color: C.text,
                          background: "rgba(255,255,255,0.85)",
                          border: "1px solid rgba(74,157,135,0.20)",
                          boxShadow: "0 4px 12px rgba(74,157,135,0.10)",
                        }}>
                        {inviteCode}
                      </span>

                      {/* Copy button */}
                      <button onClick={copyInviteCode}
                        className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold transition-all hover:scale-105"
                        style={{
                          background: inviteCodeCopied
                            ? `linear-gradient(135deg, ${C.primary}, ${C.secondary})`
                            : "rgba(74,157,135,0.10)",
                          color: inviteCodeCopied ? "#fff" : C.primary,
                          border: `1px solid rgba(74,157,135,0.28)`,
                          boxShadow: inviteCodeCopied ? "0 6px 18px rgba(74,157,135,0.30)" : "none",
                        }}>
                        {inviteCodeCopied
                          ? <><CheckCircle className="w-3.5 h-3.5" /> Copié</>
                          : <><Copy className="w-3.5 h-3.5" /> Copier</>
                        }
                      </button>

                      {/* Refresh button */}
                      <button onClick={generateInviteCode} disabled={inviteCodeLoading}
                        className="p-2 rounded-full transition-all hover:scale-105 disabled:opacity-50"
                        title="Générer un nouveau code"
                        style={{
                          background: "rgba(74,157,135,0.08)",
                          border: "1px solid rgba(74,157,135,0.20)",
                          color: C.primaryDark,
                        }}>
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
                    <button onClick={generateInviteCode} disabled={inviteCodeLoading}
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
            </div>
          </motion.div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientProches;