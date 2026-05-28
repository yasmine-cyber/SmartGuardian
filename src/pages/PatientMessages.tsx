import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import Messagerie from "@/components/Messagerie";

// ─── Palette (matches landing page) ─────────────────────────────────────────
const C = {
  primary:  "#4a9d87",
  secondary: "#5b8fa0",
  text:     "#1a2e28",
  textSoft: "rgba(30,60,50,0.62)",
};

const glass = {
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.16)",
  borderRadius: "22px",
  boxShadow: "0 12px 36px rgba(30,60,50,0.06)",
} as React.CSSProperties;

const PatientMessages = () => {
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
      `}</style>

      <div className="sg-page relative max-w-6xl mx-auto">
        {/* Aurora orbs */}
        <div className="sg-aurora-a" style={{ background: "rgba(74,157,135,0.13)", top: -100, right: -80, animation: "sgAurora 22s ease-in-out infinite", zIndex: 0 }} />
        <div className="sg-aurora-a" style={{ background: "rgba(91,143,160,0.12)", top: 280, left: -120, animation: "sgAurora 18s ease-in-out infinite reverse", zIndex: 0 }} />

        <div className="relative space-y-5">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-6" style={glass}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                }}>
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight sg-sora" style={{ color: C.text }}>
                  Ma <span className="sg-gradient-text">Messagerie</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                  Échangez avec votre médecin
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Messagerie component ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Messagerie role="patient" />
          </motion.div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientMessages;