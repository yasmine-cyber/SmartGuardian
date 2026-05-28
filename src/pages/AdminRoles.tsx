import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  primary:  "#4a9d87",
  primaryDark: "#3d8c7a",
  secondary: "#5b8fa0",
  text:     "#1a2e28",
  textSoft: "rgba(30,60,50,0.62)",
  gold:     "#d4a843",
  muted:    "#c0504a",
};

const glass = {
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.16)",
  borderRadius: "22px",
  boxShadow: "0 12px 36px rgba(30,60,50,0.06)",
} as React.CSSProperties;

const roles = [
  {
    name: "Admin",
    color: C.muted,
    bg: "rgba(192,80,74,0.10)",
    border: "rgba(192,80,74,0.25)",
    accentLeft: C.muted,
    permissions: ["Gestion utilisateurs", "Gestion capteurs", "Journaux système", "Configuration seuils", "Accès complet"],
  },
  {
    name: "Médecin",
    color: C.secondary,
    bg: "rgba(91,143,160,0.12)",
    border: "rgba(91,143,160,0.28)",
    accentLeft: C.secondary,
    permissions: ["Voir patients assignés", "Consulter constantes", "Recevoir alertes critiques", "Messagerie patients", "Analyses et rapports"],
  },
  {
    name: "Patient",
    color: C.primary,
    bg: "rgba(74,157,135,0.10)",
    border: "rgba(74,157,135,0.25)",
    accentLeft: C.primary,
    permissions: ["Voir ses propres constantes", "Historique personnel", "Messagerie médecin", "Gestion profil", "Alertes personnelles"],
  },
  {
    name: "Proche",
    color: C.gold,
    bg: "rgba(212,168,67,0.12)",
    border: "rgba(212,168,67,0.28)",
    accentLeft: C.gold,
    permissions: ["Voir constantes du proche", "Recevoir alertes", "Lecture seule"],
  },
];

const AdminRoles = () => {
  return (
    <DashboardLayout role="admin">
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

      <div className="sg-page relative">
        {/* Aurora blobs */}
        <div className="sg-aurora-a" style={{ background: "rgba(74,157,135,0.13)", top: -100, right: -80, animation: "sgAurora 22s ease-in-out infinite" }} />
        <div className="sg-aurora-a" style={{ background: "rgba(91,143,160,0.11)", top: 300, left: -120, animation: "sgAurora 18s ease-in-out infinite reverse" }} />

        <div className="relative space-y-5 max-w-7xl">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl" style={glass}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                }}>
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight sg-sora" style={{ color: C.text }}>
                  Rôles &amp; <span className="sg-gradient-text">Accès</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>Permissions par rôle</p>
              </div>
            </div>
          </motion.div>

          {/* ── Role cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map((role, i) => (
              <motion.div
                key={role.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="sg-card overflow-hidden"
                style={{ ...glass, borderLeft: `3px solid ${role.accentLeft}` }}
              >
                <div className="p-5">
                  {/* Role badge row */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: role.bg, border: `1px solid ${role.border}` }}>
                      <Shield className="w-4 h-4" style={{ color: role.color }} />
                    </div>
                    <span className="px-3 py-1 rounded-full text-sm font-semibold sg-sora"
                      style={{ background: role.bg, color: role.color, border: `1px solid ${role.border}` }}>
                      {role.name}
                    </span>
                  </div>

                  {/* Permissions list */}
                  <ul className="space-y-2">
                    {role.permissions.map((perm) => (
                      <li key={perm} className="flex items-center gap-2.5 text-sm"
                        style={{ color: C.textSoft }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: role.color }} />
                        {perm}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminRoles;