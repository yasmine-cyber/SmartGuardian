import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import FamilyMessagerie from "@/components/FamilyMessagerie";

/* ── Palette ─────────────────────────────────────────────── */
const C = {
  primary:   "#4a9d87",
  secondary: "#5b8fa0",
  text:      "#1a2e28",
  textSoft:  "rgba(30,60,50,0.62)",
};

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.16)",
  borderRadius: "22px",
  boxShadow: "0 12px 36px rgba(30,60,50,0.06)",
};

const FamilyMessages = () => {
  return (
    <DashboardLayout role="family">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .fm-page * { font-family: 'DM Sans', sans-serif; }
        .fm-sora { font-family: 'Sora', sans-serif !important; }
        .fm-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes fmAurora {
          0%,100% { transform: translate(0,0) scale(1); opacity: .48; }
          50%      { transform: translate(26px,-16px) scale(1.05); opacity: .75; }
        }
        .fm-aurora { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; }
      `}</style>

      <div className="fm-page relative space-y-5 max-w-6xl mx-auto">

        {/* Aurora blobs */}
        <div className="fm-aurora" style={{ width: 380, height: 380, background: "rgba(74,157,135,0.11)", top: -80, right: -60, animation: "fmAurora 22s ease-in-out infinite" }} />
        <div className="fm-aurora" style={{ width: 300, height: 300, background: "rgba(91,143,160,0.09)", top: 300, left: -100, animation: "fmAurora 18s ease-in-out infinite reverse" }} />

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-3xl relative overflow-hidden" style={glass}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${C.secondary}, ${C.primary})`,
                boxShadow: "0 8px 24px rgba(91,143,160,0.30)",
              }}>
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight fm-sora" style={{ color: C.text }}>
                Messa<span className="fm-gradient-text">gerie</span>
              </h1>
              <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                Échangez avec le médecin de votre proche
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Chat component ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <FamilyMessagerie role="proche" />
        </motion.div>

      </div>
    </DashboardLayout>
  );
};

export default FamilyMessages;