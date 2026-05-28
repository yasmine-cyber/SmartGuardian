import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import Messagerie from "@/components/Messagerie";
import FamilyMessagerie from "@/components/FamilyMessagerie";

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  primary:   "#4a9d87",
  secondary: "#5b8fa0",
  text:      "#1a2e28",
  textSoft:  "rgba(30,60,50,0.62)",
};

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.18)",
  borderRadius: "22px",
  boxShadow: "0 8px 32px rgba(30,60,50,0.08), 0 1px 0 rgba(255,255,255,0.9) inset",
};

type Tab = "patients" | "proches";

const DoctorMessages = () => {
  const [tab, setTab] = useState<Tab>("patients");

  return (
    <DashboardLayout role="doctor">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        .dm-root {
          font-family: 'DM Sans', sans-serif;
          position: relative;
          min-height: 100vh;
          background: linear-gradient(135deg, #edf7f4 0%, #e6f2f7 50%, #f0f7f5 100%);
          margin: -24px;
          padding: 24px;
        }
        .dm-root h1, .dm-sora { font-family: 'Sora', sans-serif !important; }
        .dm-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes dmAurora {
          0%,100% { transform: translate(0,0) scale(1); opacity:.55; }
          50%      { transform: translate(28px,-18px) scale(1.06); opacity:.85; }
        }
        .dm-aurora { position:fixed; border-radius:50%; filter:blur(90px); pointer-events:none; z-index:0; }
        .dm-content { position:relative; z-index:1; }
      `}</style>

      <div className="dm-root">
        {/* Aurora orbs */}
        <div className="dm-aurora" style={{ width:460, height:460, background:"rgba(74,157,135,0.15)", top:"2%",  right:"3%",  animation:"dmAurora 22s ease-in-out infinite" }} />
        <div className="dm-aurora" style={{ width:360, height:360, background:"rgba(91,143,160,0.12)", top:"50%", left:"0%",   animation:"dmAurora 18s ease-in-out infinite reverse" }} />

        <div className="dm-content space-y-5 max-w-6xl mx-auto">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-6" style={glass}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 8px 24px rgba(74,157,135,0.35)",
                }}>
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight dm-sora" style={{ color: C.text }}>
                  Mes <span className="dm-gradient-text">Messages</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                  Échangez avec vos patients et leurs proches
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Tab switcher ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="flex gap-1.5 p-1.5 w-fit rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.65)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(74,157,135,0.16)",
              }}>
              {(["patients", "proches"] as Tab[]).map((t) => {
                const active = tab === t;
                return (
                  <button key={t} type="button" onClick={() => setTab(t)}
                    className="px-5 py-2 rounded-xl text-sm font-semibold dm-sora transition-all"
                    style={active ? {
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      color: "#fff",
                      boxShadow: `0 4px 14px rgba(74,157,135,0.30)`,
                    } : {
                      color: C.textSoft,
                      background: "transparent",
                    }}>
                    {t === "patients" ? "Patients" : "Proches"}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* ── Messagerie component ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}>
            {tab === "patients"
              ? <Messagerie role="doctor" dossierLink="/doctor/patients" />
              : <FamilyMessagerie role="doctor" />
            }
          </motion.div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoctorMessages;