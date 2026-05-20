import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import {
  Heart, Brain, MapPin, Users, Activity,
  Bell, ArrowRight, ChevronRight, WifiOff, Lock,
  Watch, Sparkles, AlertCircle, Stethoscope, Shield, Radio,
} from "lucide-react";

// ─── Central Palette ──────────────────────────────────────────────
const C = {
  primary:     "#4a9d87",
  primaryDark: "#3d8c7a",
  secondary:   "#5b8fa0",
  cream:       "#f0ede6",
  beige:       "#e4ede8",
  beigeDark:   "#d4dfe8",
  text:        "#1a2e28",
  textSoft:    "rgba(30,60,50,0.62)",
  gold:        "#d4a843",
  muted:       "#c0504a",
  glass:       "rgba(255,255,255,0.55)",
};

// ─── Animated Counter ─────────────────────────────────────────────
const AnimatedCounter = ({ target, suffix = "" }: { target: number; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (2400 / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString("fr-FR")}{suffix}</span>;
};

// ─── Word-by-word reveal ──────────────────────────────────────────
const AnimatedWords = ({ text, delay = 0 }: { text: string; delay?: number }) => (
  <span>
    {text.split(" ").map((word, i) => (
      <motion.span key={i} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + i * 0.075, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: "inline-block", marginRight: "0.26em" }}>
        {word}
      </motion.span>
    ))}
  </span>
);

// ─── Footer Modal ─────────────────────────────────────────────────
const FooterModal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }} onClick={onClose}>
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }} />
    <div onClick={e => e.stopPropagation()}
      style={{ position: "relative", background: "rgba(255,255,255,0.97)", border: "1px solid rgba(74,157,135,0.20)", borderRadius: "24px", padding: "36px", maxWidth: "520px", width: "100%", boxShadow: "0 32px 72px rgba(26,46,40,0.18)", maxHeight: "80vh", overflowY: "auto" }}>
      <button onClick={onClose} style={{ position: "absolute", top: "16px", right: "20px", background: "none", border: "none", fontSize: "20px", color: C.textSoft, cursor: "pointer", lineHeight: 1 }}>✕</button>
      <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: "1.5rem", fontWeight: 800, color: C.text, marginBottom: "20px", letterSpacing: "-0.5px" }}>{title}</h2>
      <div style={{ fontSize: "14px", color: C.textSoft, lineHeight: 1.75, display: "flex", flexDirection: "column", gap: "12px" }}>{children}</div>
    </div>
  </div>
);

// ─── Feature Card Data ────────────────────────────────────────────
const featureData = [
  {
    icon: WifiOff, title: "Fonctionnement Autonome",
    desc: "Fonctionne sans WiFi — le capteur analyse et alerte de manière indépendante, même en zone isolée.",
    category: "IA", accent: "#4a9d87", bg: "linear-gradient(135deg, #e8f2ee 0%, #eef5f2 100%)",
    iconBg: "rgba(74,157,135,0.12)",
  },
  {
    icon: Brain, title: "IA Embarquée",
    desc: "La détection se fait directement sur le capteur portable, sans latence réseau. Analyse en temps réel.",
    category: "IA", accent: "#3d8c9e", bg: "linear-gradient(135deg, #e2eef4 0%, #eaf3f7 100%)",
    iconBg: "rgba(61,140,158,0.12)",
  },
  {
    icon: MapPin, title: "Localisation GPS",
    desc: "Position en temps réel transmise automatiquement lors d'une alerte critique pour intervention rapide.",
    category: "Sécurité", accent: "#6b7fa8", bg: "linear-gradient(135deg, #e6eaf4 0%, #eceef8 100%)",
    iconBg: "rgba(107,127,168,0.12)",
  },
  {
    icon: Bell, title: "Alertes Multi-Canal",
    desc: "Notifications instantanées via application mobile, SMS et appel vocal simultanément.",
    category: "Connectivité", accent: "#5b8fa0", bg: "linear-gradient(135deg, #e2ecf2 0%, #eaf3f8 100%)",
    iconBg: "rgba(91,143,160,0.12)",
  },
  {
    icon: Users, title: "Réseau de Soins Unifié",
    desc: "Patient, médecin et famille connectés dans un écosystème unique et partagé.",
    category: "Réseau", accent: "#4a9d87", bg: "linear-gradient(135deg, #e8f2ee 0%, #eef5f2 100%)",
    iconBg: "rgba(74,157,135,0.12)",
  },
  {
    icon: Lock, title: "Sécurisé & Privé",
    desc: "Chiffrement de bout en bout (AES-256) pour toutes les transmissions de données médicales.",
    category: "Sécurité", accent: "#7a8fa0", bg: "linear-gradient(135deg, #e4ecf2 0%, #ecf2f7 100%)",
    iconBg: "rgba(122,143,160,0.12)",
  },
];

// ─── Steps Data ───────────────────────────────────────────────────
const steps = [
  { icon: Activity,    title: "Capture Biométrique", desc: "Capteurs portables mesurant FC, SpO₂ et température en continu, 24h/24.", color: "#4a9d87", bg: "rgba(74,157,135,0.12)" },
  { icon: Brain,       title: "IA Embarquée",        desc: "Analyse locale par IA — détection sans connexion internet, sans latence réseau.", color: "#3d8c9e", bg: "rgba(61,140,158,0.12)" },
  { icon: AlertCircle, title: "Anomalie Détectée",   desc: "Schéma critique déclenche l'empaquetage sécurisé avec position GPS.", color: "#c0504a", bg: "rgba(192,80,74,0.10)" },
  { icon: Radio,       title: "Transmission & Soins", desc: "Données chiffrées envoyées via 4G/GSM → Cloud → alerte instantanée à toute l'équipe.", color: "#6b7fa8", bg: "rgba(107,127,168,0.12)" },
];

// ─── Live Badge ───────────────────────────────────────────────────
const LiveBadge = () => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "rgba(74,157,135,0.14)", border: "1px solid rgba(74,157,135,0.35)", borderRadius: "999px", padding: "2px 8px", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", color: "#3d8c7a", textTransform: "uppercase" as const }}>
    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#4a9d87", animation: "livePulse 1.4s ease-in-out infinite", display: "inline-block" }} />
    Live
  </span>
);

// ─── Component ────────────────────────────────────────────────────
export default function Index() {
  const [activeStep, setActiveStep] = useState(0);
  const [modal, setModal] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setActiveStep(s => (s + 1) % 4), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: C.cream }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
        * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
        h1,h2,h3,.sora { font-family: 'Sora', sans-serif !important; }

        .gt {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }

        @keyframes heartbeat   { 0%,100%{transform:scale(1)} 14%{transform:scale(1.18)} 28%{transform:scale(1)} 42%{transform:scale(1.12)} 56%{transform:scale(1)} }
        @keyframes ringRotate  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes floatA      { 0%,100%{transform:translateY(0)}      50%{transform:translateY(-9px)} }
        @keyframes floatB      { 0%,100%{transform:translateY(0)}      50%{transform:translateY(-7px)} }
        @keyframes floatLeft   { 0%,100%{transform:translateY(-50%)}   50%{transform:translateY(calc(-50% - 8px))} }
        @keyframes aurora      { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(28px,-18px) scale(1.06)} 66%{transform:translate(-18px,14px) scale(0.95)} }
        @keyframes livePulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.45;transform:scale(0.75)} }
        @keyframes waveBar     { 0%,100%{opacity:0.35;transform:scaleY(var(--h))} 50%{opacity:1;transform:scaleY(calc(var(--h)*1.4))} }

        @keyframes hero-ecg-loop {
          0%   { stroke-dashoffset: 3200; opacity: 0; }
          5%   { opacity: 1; }
          82%  { stroke-dashoffset: -600; opacity: 0.95; }
          90%  { stroke-dashoffset: -600; opacity: 0; }
          100% { stroke-dashoffset: 3200; opacity: 0; }
        }

        @keyframes statFloat {
          0%,100% { transform: translateY(0) scale(1); }
          50%     { transform: translateY(-6px) scale(1.01); }
        }
        @keyframes cardShine {
          0%   { left: -80%; }
          100% { left: 120%; }
        }
        @keyframes stepRipple {
          0%   { transform: scale(0.85); opacity: 0.55; }
          80%  { transform: scale(1.65); opacity: 0; }
          100% { transform: scale(1.65); opacity: 0; }
        }
        @keyframes bgShift {
          0%,100% { opacity: 0.6; transform: scale(1) translateY(0); }
          50%     { opacity: 1; transform: scale(1.05) translateY(-4px); }
        }
        @keyframes iconFloat {
          0%,100% { transform: translateY(0) rotate(0deg); }
          50%     { transform: translateY(-8px) rotate(3deg); }
        }

        .animate-heartbeat { animation: heartbeat 2s ease-in-out infinite; }
        .animate-ring      { animation: ringRotate 30s linear infinite; }
        .animate-ring-rev  { animation: ringRotate 22s linear infinite reverse; }
        .animate-ring-slow { animation: ringRotate 45s linear infinite; }
        .animate-aurora    { animation: aurora 16s ease-in-out infinite; }
        .animate-ecg-loop  {
          stroke-dasharray: 3200;
          stroke-dashoffset: 3200;
          animation: hero-ecg-loop 3.8s cubic-bezier(0.4,0,0.2,1) 0.5s infinite;
        }

        .nav-link { position:relative; transition:color .2s; }
        .nav-link::after { content:''; position:absolute; bottom:-2px; left:0; right:0; height:1.5px; background:linear-gradient(90deg,#4a9d87,#5b8fa0); transform:scaleX(0); transform-origin:left; transition:transform .25s cubic-bezier(.22,1,.36,1); }
        .nav-link:hover::after { transform:scaleX(1); }

        .btn-primary {
          background: linear-gradient(135deg, #3d8c7a, #4a9d87, #5b8fa0);
          color: #fff; font-weight: 700; border-radius: 999px;
          box-shadow: 0 6px 22px rgba(74,157,135,0.30);
          transition: filter .2s, transform .2s, box-shadow .2s;
          display: inline-flex; align-items: center; gap: 8px;
        }
        .btn-primary:hover { filter:brightness(1.10); transform:translateY(-2px); box-shadow:0 10px 30px rgba(74,157,135,0.42); }

        .btn-ghost {
          border: 1.5px solid rgba(74,157,135,0.30);
          color: #1a2e28;
          border-radius: 999px; font-weight: 600;
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(8px);
          display: inline-flex; align-items: center; gap: 8px;
          transition: background .2s, border-color .2s, color .2s;
        }
        .btn-ghost:hover { background: rgba(255,255,255,0.85); border-color: rgba(74,157,135,0.55); color: #1a2e28; }

        .feat-card {
          border-radius: 24px;
          overflow: hidden; position: relative;
          border: 1px solid rgba(255,255,255,0.88);
          transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s ease;
          cursor: default;
        }
        .feat-card:hover { transform: translateY(-8px) scale(1.01); box-shadow: 0 24px 56px rgba(30,60,50,0.12); }
        .feat-card .shine {
          position: absolute; top: 0; left: -80%; width: 60%; height: 100%;
          background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.65) 50%, transparent 70%);
          transform: skewX(-15deg); pointer-events: none; z-index: 10;
        }
        .feat-card:hover .shine { animation: cardShine 0.55s ease forwards; }

        .step-card {
          background: rgba(255,255,255,0.82);
          border: 1px solid rgba(74,157,135,0.16);
          border-radius: 20px;
          backdrop-filter: blur(16px);
          transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s, border-color .35s;
          position: relative; overflow: hidden;
        }
        .step-card.active {
          border-color: rgba(74,157,135,0.45);
          box-shadow: 0 16px 48px rgba(74,157,135,0.16);
          transform: translateY(-8px);
        }
        .step-card:hover { transform: translateY(-5px); box-shadow: 0 12px 36px rgba(30,60,50,0.10); }

        .test-card {
          background: rgba(255,255,255,0.78);
          border: 1px solid rgba(74,157,135,0.12);
          border-radius: 22px;
          backdrop-filter: blur(12px);
          transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s;
        }
        .test-card:hover { transform: translateY(-5px); box-shadow: 0 16px 40px rgba(30,60,50,0.10); }

        .stat-card {
          background: rgba(255,255,255,0.70);
          border: 1px solid rgba(74,157,135,0.14);
          border-radius: 22px;
          backdrop-filter: blur(12px);
          animation: statFloat var(--dur, 5s) ease-in-out var(--delay, 0s) infinite;
          transition: box-shadow .3s;
        }
        .stat-card:hover { box-shadow: 0 16px 40px rgba(30,60,50,0.11); }

        .footer-link { background: none; border: none; cursor: pointer; font-size: 13px; color: rgba(160,200,185,0.48); transition: color .2s; padding: 0; }
        .footer-link:hover { color: rgba(160,200,185,0.80); }
      `}</style>

      {/* ══ NAV ══ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(26,46,40,0.48)",
        backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)",
        borderBottom: "1px solid rgba(74,157,135,0.18)",
      }}>
        <div className="container mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2.5">
            <div style={{ width: "30px", height: "30px", borderRadius: "9px", background: "rgba(74,157,135,0.20)", border: "1px solid rgba(74,157,135,0.40)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Heart className="animate-heartbeat" style={{ width: "14px", height: "14px", color: "#6ecfb5" }} />
            </div>
            <span className="sora" style={{ fontSize: "15px", fontWeight: 700, color: "#e0f0ea", letterSpacing: "-0.3px" }}>SmartGuardian</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[["#how","Fonctionnement"],["#features","Fonctionnalités"],["#testimonials","Témoignages"]].map(([h,l]) => (
              <a key={h} href={h} className="nav-link text-sm font-medium" style={{ color: "rgba(200,228,218,0.82)" }}>{l}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium px-4 py-2 transition-colors" style={{ color: "rgba(180,218,205,0.70)" }}>Connexion</Link>
            <Link to="/register" className="btn-primary text-sm px-5 py-2.5">S'inscrire</Link>
          </div>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", overflow: "hidden", paddingTop: "64px" }}>

        <div style={{ position: "absolute", inset: 0, zIndex: 0, backgroundImage: "url('https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1600&q=85&auto=format&fit=crop')", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "linear-gradient(108deg, rgba(45,30,24,0.92) 0%, rgba(120,98,78,0.70) 35%, rgba(196,178,152,0.38) 62%, rgba(240,232,220,0.14) 82%, transparent 100%)" }} />

        <div className="animate-aurora" style={{ position: "absolute", top: "6%", left: "3%", width: "520px", height: "520px", borderRadius: "50%", filter: "blur(130px)", opacity: 0.22, zIndex: 2, background: "radial-gradient(circle, rgba(74,157,135,0.60), transparent 65%)" }} />
        <div className="animate-aurora" style={{ position: "absolute", bottom: "10%", right: "5%", width: "380px", height: "380px", borderRadius: "50%", filter: "blur(120px)", opacity: 0.14, zIndex: 2, animationDelay: "-8s", background: "radial-gradient(circle, rgba(91,143,160,0.45), transparent 65%)" }} />

        {/* ECG layers */}
        <div style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none", display: "flex", alignItems: "center", opacity: 0.38 }}>
          <svg viewBox="0 0 1400 180" style={{ width: "100%", height: "180px" }} preserveAspectRatio="none">
            <path d="M0 90 L110 90 L128 90 L136 72 L143 90 L150 90 L157 90 L162 22 L166 158 L170 4 L174 176 L178 44 L182 90 L204 90 L224 78 L244 90 L320 90 L450 90 L466 72 L473 90 L480 90 L487 90 L492 22 L496 158 L500 4 L504 176 L508 44 L512 90 L532 90 L552 78 L572 90 L650 90 L780 90 L796 72 L803 90 L810 90 L817 90 L822 22 L826 158 L830 4 L834 176 L838 44 L842 90 L862 90 L882 78 L902 90 L980 90 L1110 90 L1126 72 L1133 90 L1140 90 L1147 90 L1152 22 L1156 158 L1160 4 L1164 176 L1168 44 L1172 90 L1192 90 L1212 78 L1232 90 L1400 90"
              fill="none" stroke="#c94040" strokeWidth="3.5" strokeLinecap="round" className="animate-ecg-loop" />
          </svg>
        </div>
        <div style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none", display: "flex", alignItems: "center", opacity: 0.14, marginTop: "60px" }}>
          <svg viewBox="0 0 1400 180" style={{ width: "100%", height: "180px" }} preserveAspectRatio="none">
            <path d="M0 90 L110 90 L128 90 L136 72 L143 90 L150 90 L157 90 L162 22 L166 158 L170 4 L174 176 L178 44 L182 90 L204 90 L224 78 L244 90 L320 90 L450 90 L466 72 L473 90 L480 90 L487 90 L492 22 L496 158 L500 4 L504 176 L508 44 L512 90 L532 90 L552 78 L572 90 L650 90 L780 90 L796 72 L803 90 L810 90 L817 90 L822 22 L826 158 L830 4 L834 176 L838 44 L842 90 L862 90 L882 78 L902 90 L980 90 L1110 90 L1126 72 L1133 90 L1140 90 L1147 90 L1152 22 L1156 158 L1160 4 L1164 176 L1168 44 L1172 90 L1192 90 L1212 78 L1232 90 L1400 90"
              fill="none" stroke="#4a9d87" strokeWidth="2" strokeLinecap="round" className="animate-ecg-loop" style={{ animationDelay: "1.9s" }} />
          </svg>
        </div>

        <div className="container mx-auto px-6" style={{ position: "relative", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center" }}>

            {/* LEFT — text */}
            <div style={{ flex: 1, maxWidth: "590px" }}>
              {/* Badge from file 2 */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 16px", borderRadius: "999px", background: "rgba(74,157,135,0.16)", border: "1px solid rgba(74,157,135,0.32)", marginBottom: "24px" }}>
                <Shield style={{ width: "14px", height: "14px", color: "#6ecfb5" }} />
                <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(200,240,225,0.85)", letterSpacing: "0.05em" }}>Télémédecine Autonome par IA</span>
              </motion.div>

              <motion.h1 className="sora" style={{ fontSize: "clamp(2.8rem,5vw,4.3rem)", fontWeight: 800, color: "#ffffff", lineHeight: 1.04, letterSpacing: "-1.5px", marginBottom: "20px" }}>
                <AnimatedWords text="Votre Santé," delay={0.1} />
                <br />
                <motion.span className="gt" style={{ display: "inline-block" }} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
                  Surveillée.
                </motion.span>
                <br />
                <AnimatedWords text="Intelligemment." delay={0.65} />
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 }}
                style={{ maxWidth: "500px", marginBottom: "36px", fontSize: "1.08rem", lineHeight: 1.78, color: "rgba(220,240,232,0.90)", fontWeight: 400 }}>
                Un système IA portable qui surveille vos constantes vitales 24h/24, détecte les anomalies avant qu'elles ne deviennent des urgences, et connecte votre équipe de soins — où que vous soyez.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }}
                style={{ display: "flex", flexWrap: "wrap" as const, gap: "14px" }}>
                <Link to="/register" className="btn-primary" style={{ padding: "14px 30px", fontSize: "15px" }}>
                  Commencer le Suivi <ArrowRight style={{ width: "16px", height: "16px" }} />
                </Link>
                <a href="#how" className="btn-ghost" style={{ padding: "14px 30px", fontSize: "15px" }}>
                  Voir Comment Ça Marche <ChevronRight style={{ width: "16px", height: "16px" }} />
                </a>
              </motion.div>
            </div>

            {/* RIGHT — ring visual */}
            <motion.div initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block" style={{ position: "relative", flexShrink: 0, marginLeft: "auto", width: "520px", height: "520px" }}>

              <div style={{ position: "absolute", inset: "-10px", borderRadius: "50%", background: "radial-gradient(circle, rgba(74,157,135,0.14), transparent 65%)" }} />

              <svg className="absolute inset-0 w-full h-full animate-ring" style={{ animationDuration: "28s" }} viewBox="0 0 520 520">
                <circle cx="260" cy="260" r="248" fill="none" stroke="rgba(74,157,135,0.65)" strokeWidth="2.2" strokeDasharray="8 16" />
              </svg>
              <svg className="absolute inset-0 w-full h-full animate-ring-rev" viewBox="0 0 520 520">
                <circle cx="260" cy="260" r="214" fill="none" stroke="rgba(91,143,160,0.50)" strokeWidth="1.5" strokeDasharray="4 20" />
              </svg>
              <svg className="absolute inset-0 w-full h-full animate-ring-slow" viewBox="0 0 520 520">
                <circle cx="260" cy="260" r="178" fill="none" stroke="rgba(74,157,135,0.28)" strokeWidth="1.1" strokeDasharray="2 12" />
              </svg>
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 520 520">
                <circle cx="260" cy="260" r="142" fill="none" stroke="rgba(61,140,158,0.18)" strokeWidth="0.9" />
              </svg>

              {/* Center disc */}
              <div style={{ position: "absolute", width: "210px", height: "210px", left: "50%", top: "50%", transform: "translate(-50%,-50%)", background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(74,157,135,0.26)", borderRadius: "50%", backdropFilter: "blur(16px)", boxShadow: "0 0 52px rgba(74,157,135,0.16), 0 6px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)" }} />

              <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", zIndex: 10, display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
                <motion.div animate={{ scale: [1, 1.10, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  style={{ width: "62px", height: "62px", borderRadius: "50%", marginBottom: "10px", background: "linear-gradient(135deg, rgba(74,157,135,0.18), rgba(91,143,160,0.10))", border: "1.5px solid rgba(74,157,135,0.42)", boxShadow: "0 0 26px rgba(74,157,135,0.30)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Heart style={{ width: "26px", height: "26px", color: "#4a9d87" }} />
                </motion.div>
                <span className="sora" style={{ fontSize: "2.7rem", fontWeight: 800, lineHeight: 1, letterSpacing: "-2px", color: "#1a2e28" }}>72</span>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", color: "#4a9d87", marginTop: "3px", textTransform: "uppercase" as const }}>BPM</span>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", marginTop: "13px", height: "22px" }}>
                  {[0.45,0.88,0.38,1,0.52,0.82,0.28,0.68,0.88,0.36,0.58,0.92].map((h,i) => (
                    <div key={i} style={{ width: "3px", height: "100%", borderRadius: "2px", background: "linear-gradient(to top, rgba(74,157,135,0.3), rgba(74,157,135,0.9))", transform: `scaleY(${h})`, transformOrigin: "bottom", animation: `waveBar 1.25s ease-in-out ${i*0.1}s infinite`, ["--h" as string]: h }} />
                  ))}
                </div>
              </div>

              {/* Floating vital cards */}
              <motion.div initial={{ opacity: 0, x: 16, y: -12 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ delay: 0.9, duration: 0.72, ease: [0.22,1,0.36,1] }}
                style={{ position: "absolute", top: "22px", right: "-14px", animation: "floatA 4.8s ease-in-out infinite" }}>
                <div style={{ background: "rgba(255,255,255,0.45)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.68)", borderRadius: "18px", boxShadow: "0 8px 28px rgba(26,46,40,0.12), inset 0 1px 0 rgba(255,255,255,0.8)", padding: "13px 18px" }}>
                  <p style={{ fontSize: "10px", fontWeight: 600, color: "rgba(30,60,50,0.58)", marginBottom: "5px", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>SpO₂</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "19px" }}>🩸</span>
                    <span className="sora" style={{ fontSize: "1.35rem", fontWeight: 700, color: "#1a2e28" }}>98%</span>
                    <LiveBadge />
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.1, duration: 0.72, ease: [0.22,1,0.36,1] }}
                style={{ position: "absolute", left: "-30px", top: "50%", animation: "floatLeft 5.2s 0.6s ease-in-out infinite" }}>
                <div style={{ background: "rgba(255,255,255,0.45)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.68)", borderRadius: "18px", boxShadow: "0 8px 28px rgba(26,46,40,0.12), inset 0 1px 0 rgba(255,255,255,0.8)", padding: "13px 18px" }}>
                  <p style={{ fontSize: "10px", fontWeight: 600, color: "rgba(30,60,50,0.58)", marginBottom: "5px", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Fréquence Cardiaque</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "19px" }}>❤️</span>
                    <span className="sora" style={{ fontSize: "1.35rem", fontWeight: 700, color: "#1a2e28" }}>72 BPM</span>
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 16, y: 12 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ delay: 1.3, duration: 0.72, ease: [0.22,1,0.36,1] }}
                style={{ position: "absolute", bottom: "44px", right: "-20px", animation: "floatB 5.6s 1.2s ease-in-out infinite" }}>
                <div style={{ background: "rgba(255,255,255,0.45)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.68)", borderRadius: "18px", boxShadow: "0 8px 28px rgba(26,46,40,0.12), inset 0 1px 0 rgba(255,255,255,0.8)", padding: "13px 18px" }}>
                  <p style={{ fontSize: "10px", fontWeight: 600, color: "rgba(30,60,50,0.58)", marginBottom: "5px", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>Température</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "19px" }}>🌡️</span>
                    <span className="sora" style={{ fontSize: "1.35rem", fontWeight: 700, color: "#1a2e28" }}>36.6°C</span>
                    <LiveBadge />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "100px", zIndex: 10, background: `linear-gradient(to top, ${C.cream}, transparent)` }} />
      </section>

      {/* ══ STATS ══ */}
      <section style={{ padding: "96px 0", position: "relative", background: "linear-gradient(180deg, #f0ede6 0%, #e8ede9 100%)", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle, rgba(26,46,40,1) 1px, transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none" }} />
        <div className="container mx-auto px-6" style={{ position: "relative", zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: "64px" }}>
            <h2 className="sora" style={{ fontSize: "clamp(2rem,4vw,3.2rem)", fontWeight: 800, color: C.text, marginBottom: "16px", letterSpacing: "-0.8px" }}>Le Problème Que Nous Résolvons</h2>
            <p style={{ color: C.textSoft, fontSize: "1.05rem", maxWidth: "560px", margin: "0 auto" }}>Les maladies cardiovasculaires restent la première cause de mortalité mondiale. La détection précoce sauve des vies.</p>
          </motion.div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "24px", maxWidth: "900px", margin: "0 auto" }}>
            {[
              { value: 17900000, suffix: "+",    label: "Décès par an dans le monde liés aux MCV",                    dur: "5s",   delay: "0s",   glow: "rgba(192,80,74,0.10)",   num: "#c0504a" },
              { value: 80,       suffix: "%",    label: "Des événements cardiaques évitables avec détection précoce", dur: "6s",   delay: "0.8s", glow: "rgba(74,157,135,0.10)",  num: "#3d8c7a" },
              { value: 4,        suffix: " min", label: "Temps de réponse moyen avec les alertes SmartGuardian",      dur: "5.5s", delay: "1.4s", glow: "rgba(91,143,160,0.10)",  num: "#3d7fa0" },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                className="stat-card" style={{ padding: "40px 24px", textAlign: "center", ["--dur" as string]: s.dur, ["--delay" as string]: s.delay, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: "-20px", left: "50%", transform: "translateX(-50%)", width: "160px", height: "120px", borderRadius: "50%", background: s.glow, filter: "blur(28px)", pointerEvents: "none" }} />
                <div className="sora" style={{ fontSize: "clamp(2.2rem,4vw,3.2rem)", fontWeight: 800, color: s.num, lineHeight: 1.15, marginBottom: "14px", position: "relative", wordBreak: "break-word" as const, overflowWrap: "break-word" as const }}>
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </div>
                <p style={{ color: C.textSoft, fontSize: "14px", lineHeight: 1.6 }}>{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "80px", background: "linear-gradient(to top, #dde8e2, transparent)" }} />
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section id="how" style={{ padding: "96px 0 80px", position: "relative", background: "linear-gradient(180deg, #dde8e2 0%, #d4dfe8 100%)", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg, transparent, rgba(74,157,135,0.45), rgba(91,143,160,0.38), transparent)" }} />
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: "80px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "18px", padding: "5px 16px", borderRadius: "999px", background: "rgba(74,157,135,0.12)", border: "1px solid rgba(74,157,135,0.28)" }}>
              <Activity style={{ width: "13px", height: "13px", color: "#3d8c7a" }} />
              <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#3d8c7a", letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Comment Ça Marche</span>
            </div>
            <h2 className="sora" style={{ fontSize: "clamp(2rem,4vw,3.2rem)", fontWeight: 800, color: C.text, marginBottom: "14px", letterSpacing: "-0.8px" }}>
              Quatre étapes.<br /><span className="gt">Zéro complication.</span>
            </h2>
            <p style={{ color: C.textSoft, fontSize: "1.05rem" }}>De votre poignet à votre médecin en quelques secondes. Vraiment.</p>
          </motion.div>

          {/* Steps */}
          <div style={{ maxWidth: "1020px", margin: "0 auto", position: "relative" }}>
            <div className="hidden md:block" style={{ position: "absolute", top: "44px", left: "calc(12.5%)", right: "calc(12.5%)", height: "2px", zIndex: 0, pointerEvents: "none" }}>
              <svg width="100%" height="2" style={{ overflow: "visible" }}>
                <defs>
                  <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(74,157,135,0)" />
                    <stop offset="35%" stopColor="rgba(74,157,135,0.95)" />
                    <stop offset="65%" stopColor="rgba(91,143,160,0.95)" />
                    <stop offset="100%" stopColor="rgba(107,127,168,0)" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="1" x2="100%" y2="1" stroke="rgba(74,157,135,0.20)" strokeWidth="1.5" strokeDasharray="4 8" />
                <line x1="0" y1="1" x2="100%" y2="1" stroke="url(#beamGrad)" strokeWidth="4" strokeLinecap="round" strokeDasharray="90 9999">
                  <animate attributeName="stroke-dashoffset" from="90" to="-9999" dur="2.2s" repeatCount="indefinite" />
                </line>
              </svg>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", position: "relative", zIndex: 1 }}>
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 48 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    transition={{ delay: i * 0.18, duration: 0.65, ease: [0.22,1,0.36,1] }}
                    style={{ display: "flex", flexDirection: "column" as const, alignItems: "center" }}>

                    <div style={{
                      width: "88px", height: "88px", borderRadius: "50%", zIndex: 2, position: "relative",
                      background: `radial-gradient(circle at 35% 35%, ${step.color}32, ${step.color}10)`,
                      border: `2px solid ${step.color}50`,
                      boxShadow: `0 8px 32px ${step.color}30, 0 0 0 6px ${step.color}12`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: "-22px",
                      animation: `iconFloat ${3.5 + i * 0.4}s ease-in-out ${i * 0.5}s infinite`,
                      backdropFilter: "blur(8px)",
                      backgroundColor: "rgba(255,252,248,0.22)",
                    }}>
                      {activeStep === i && [0,1].map(r => (
                        <div key={r} style={{
                          position: "absolute", inset: 0, borderRadius: "50%",
                          border: `1.5px solid ${step.color}60`,
                          animation: `stepRipple 1.8s ease-out ${r * 0.6}s infinite`,
                        }} />
                      ))}
                      <Icon style={{ width: "34px", height: "34px", color: step.color, filter: `drop-shadow(0 2px 8px ${step.color}55)` }} />
                    </div>

                    <div className={`step-card${activeStep === i ? " active" : ""}`}
                      style={{ width: "100%", padding: "32px 18px 22px", textAlign: "center" }}>

                      <div style={{
                        position: "absolute", top: "-30px", left: "50%", transform: "translateX(-50%)",
                        width: "140px", height: "120px", borderRadius: "50%",
                        background: `radial-gradient(circle, ${step.color}18, transparent 70%)`,
                        animation: `bgShift ${4 + i * 0.5}s ease-in-out ${i * 0.8}s infinite`,
                        pointerEvents: "none",
                      }} />

                      <div className="sora" style={{
                        fontSize: "3.5rem", fontWeight: 800, lineHeight: 1,
                        color: `${step.color}20`,
                        position: "absolute", top: "8px", right: "12px",
                        letterSpacing: "-3px",
                        userSelect: "none" as const,
                        pointerEvents: "none",
                      }}>
                        {String(i + 1).padStart(2, "0")}
                      </div>

                      <div style={{
                        width: "26px", height: "26px", borderRadius: "50%",
                        background: `linear-gradient(135deg, ${step.color}ee, ${step.color}88)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "11px", fontWeight: 800, color: "#fff",
                        margin: "10px auto 14px",
                        boxShadow: `0 3px 10px ${step.color}44`,
                      }}>
                        {i + 1}
                      </div>

                      <h3 className="sora" style={{ fontSize: "14px", fontWeight: 700, color: C.text, marginBottom: "10px", lineHeight: 1.3 }}>{step.title}</h3>
                      <p style={{ fontSize: "12.5px", color: C.textSoft, lineHeight: 1.65 }}>{step.desc}</p>

                      {activeStep === i && (
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0, height: "3px",
                          background: `linear-gradient(90deg, transparent, ${step.color}, transparent)`,
                          borderRadius: "0 0 20px 20px",
                        }} />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Images */}
          <div style={{ maxWidth: "1020px", margin: "80px auto 0", position: "relative", height: "380px" }}>
            <motion.div initial={{ opacity: 0, x: -32 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.82, ease: [0.22,1,0.36,1] }}
              style={{ position: "absolute", left: 0, top: 0, borderRadius: "28px", overflow: "hidden", height: "340px", width: "58%", boxShadow: "0 24px 64px rgba(26,46,40,0.18)", border: "1px solid rgba(74,157,135,0.20)" }}>
              <img src="https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=900&q=80&auto=format&fit=crop" alt="Capteur" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(13,31,26,0.78) 0%, rgba(13,31,26,0.22) 60%, transparent 100%)" }} />
              <div style={{ position: "absolute", top: "18px", left: "18px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: "999px", padding: "5px 14px", fontSize: "10px", fontWeight: 700, color: "#22c55e", textTransform: "uppercase" as const, letterSpacing: "0.1em", backdropFilter: "blur(8px)" }}>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#22c55e", animation: "livePulse 1.4s ease-in-out infinite" }} /> Capteur actif
                </span>
              </div>
              <div style={{ position: "absolute", bottom: "22px", left: "22px", right: "22px" }}>
                <p style={{ color: "#fff", fontWeight: 700, fontSize: "1.25rem", lineHeight: 1.3, marginBottom: "6px" }}>Conçu pour être oublié.</p>
                <p style={{ color: "rgba(200,230,218,0.65)", fontSize: "13px" }}>Léger, discret, porté en continu.</p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 32, y: 32 }} whileInView={{ opacity: 1, x: 0, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.18, duration: 0.82, ease: [0.22,1,0.36,1] }}
              style={{ position: "absolute", top: "40px", right: 0, width: "46%", borderRadius: "24px", overflow: "hidden", height: "300px", boxShadow: "0 32px 72px rgba(26,46,40,0.20), 0 0 0 1px rgba(74,157,135,0.22)", zIndex: 2 }}>
              <img src="https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&q=80&auto=format&fit=crop" alt="Dashboard" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(13,43,42,0.95) 0%, rgba(13,43,42,0.40) 55%, transparent 100%)" }} />
              <div style={{ position: "absolute", top: "14px", left: "14px", right: "14px", display: "flex", gap: "6px", flexWrap: "wrap" as const }}>
                {["FC 72","SpO₂ 98%","36.6°C"].map(v => (
                  <span key={v} style={{ padding: "3px 10px", borderRadius: "999px", color: "#fff", fontSize: "10px", fontWeight: 600, background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.20)", backdropFilter: "blur(8px)" }}>{v}</span>
                ))}
              </div>
              <div style={{ position: "absolute", bottom: "18px", left: "18px", right: "18px" }}>
                <p style={{ color: "#6ecfb5", fontSize: "9px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.13em", marginBottom: "5px" }}>✓ Soins coordonnés</p>
                <p style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.3, marginBottom: "5px" }}>Vos médecins voient tout. Au bon moment.</p>
                <p style={{ color: "rgba(180,220,210,0.55)", fontSize: "11px" }}>Tableau de bord clinique partagé.</p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.45, duration: 0.6, ease: [0.22,1,0.36,1] }}
              style={{ position: "absolute", bottom: "0px", left: "50%", transform: "translateX(-50%)", zIndex: 5, animation: "floatA 4s ease-in-out infinite" }}>
              <div style={{ background: "rgba(255,255,255,0.96)", backdropFilter: "blur(20px)", border: "1px solid rgba(74,157,135,0.22)", borderRadius: "16px", padding: "12px 20px", boxShadow: "0 8px 32px rgba(26,46,40,0.14), inset 0 1px 0 white", whiteSpace: "nowrap" as const }}>
                <p style={{ fontSize: "9px", color: C.textSoft, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "3px" }}>Temps de réponse</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                  <span className="sora" style={{ fontSize: "1.7rem", fontWeight: 800, color: "#4a9d87", lineHeight: 1 }}>{'<'}3</span>
                  <span style={{ fontSize: "12px", color: "#4a9d87", fontWeight: 600 }}>secondes</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "90px", background: "linear-gradient(to top, #d4dfe8, transparent)" }} />
      </section>

      {/* ══ FEATURES ══ */}
      <section id="features" style={{ padding: "96px 0", position: "relative", background: "linear-gradient(180deg, #d4dfe8 0%, #d8e6df 100%)", overflow: "hidden" }}>
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: "60px" }}>
            <h2 className="sora" style={{ fontSize: "clamp(2rem,4vw,3.2rem)", fontWeight: 800, color: C.text, marginBottom: "14px", letterSpacing: "-0.8px" }}>Fonctionnalités Clés</h2>
            <p style={{ color: C.textSoft, fontSize: "1.05rem" }}>Tout ce dont vous avez besoin pour une santé proactive</p>
          </motion.div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "18px", maxWidth: "1040px", margin: "0 auto" }}>
            {featureData.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ delay: i * 0.09, duration: 0.62, ease: [0.22,1,0.36,1] }}
                  className="feat-card">
                  <div className="shine" />
                  <div style={{ background: f.bg, padding: "26px 22px 18px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: "-24px", right: "-24px", width: "110px", height: "110px", borderRadius: "50%", background: `radial-gradient(circle, ${f.accent}22, transparent 70%)`, pointerEvents: "none" }} />
                    <div style={{ position: "absolute", bottom: "-30px", left: "-16px", width: "80px", height: "80px", borderRadius: "50%", background: `radial-gradient(circle, ${f.accent}12, transparent 70%)`, pointerEvents: "none" }} />
                    <div style={{ marginBottom: "18px", position: "relative", zIndex: 1 }}>
                      <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", background: `${f.accent}18`, border: `1px solid ${f.accent}38`, color: f.accent, textTransform: "uppercase" as const }}>
                        {f.category}
                      </span>
                    </div>
                    <div style={{ width: "58px", height: "58px", borderRadius: "16px", background: f.iconBg, border: `1.5px solid ${f.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 6px 20px ${f.accent}1a`, position: "relative", zIndex: 1 }}>
                      <Icon style={{ width: "26px", height: "26px", color: f.accent }} />
                    </div>
                  </div>
                  <div style={{ height: "2px", background: `linear-gradient(90deg, ${f.accent}45, ${f.accent}12, transparent)` }} />
                  <div style={{ padding: "18px 22px 22px", background: "rgba(255,255,255,0.88)" }}>
                    <h3 className="sora" style={{ fontSize: "14.5px", fontWeight: 700, color: C.text, marginBottom: "9px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: `${f.accent}18`, border: `1.5px solid ${f.accent}40`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: "10px", color: f.accent, fontWeight: 800, lineHeight: 1 }}>✓</span>
                      </span>
                      {f.title}
                    </h3>
                    <p style={{ fontSize: "13px", color: C.textSoft, lineHeight: 1.72, margin: 0 }}>{f.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "90px", background: "linear-gradient(to top, #cdddd5, transparent)" }} />
      </section>

      {/* ══ TESTIMONIALS ══ */}
      <section id="testimonials" style={{ padding: "96px 0", position: "relative", background: "linear-gradient(180deg, #cdddd5 0%, #c4d8d0 100%)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(74,157,135,0.40), transparent)" }} />
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: "60px" }}>
            <h2 className="sora" style={{ fontSize: "clamp(2rem,4vw,3.2rem)", fontWeight: 800, color: C.text, letterSpacing: "-0.8px" }}>Ils Nous Font Confiance</h2>
          </motion.div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "20px", maxWidth: "1040px", margin: "0 auto" }}>
            {[
              { quote: "Les alertes prédictives de SmartGuardian nous ont permis de détecter une arythmie 48h avant qu'elle ne devienne critique. Cette technologie sauve des vies.", name: "Dr. Ahmed Khalil",     role: "Cardiologue, CHU Mustapha", init: "AK", accent: "#4a9d87" },
              { quote: "En tant que parent, la tranquillité d'esprit est inestimable. Je peux vérifier la santé cardiaque de mon père à tout moment.",                              name: "Leila Benmoussa",    role: "Aidante familiale",          init: "LB", accent: "#5b8fa0" },
              { quote: "Le système fonctionne même dans les zones sans couverture WiFi. L'IA embarquée est un vrai game-changer pour nos patients ruraux.",                         name: "Dr. Isabelle Moreau", role: "Médecin généraliste",        init: "IM", accent: "#6b7fa8" },
            ].map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.13, duration: 0.65, ease: [0.22,1,0.36,1] }}
                className="test-card" style={{ padding: "32px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: "-24px", right: "-24px", width: "100px", height: "100px", borderRadius: "50%", background: `radial-gradient(circle, ${t.accent}18, transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ display: "flex", gap: "3px", marginBottom: "18px" }}>
                  {[...Array(5)].map((_,s) => <span key={s} style={{ color: C.gold, fontSize: "14px" }}>★</span>)}
                </div>
                <p style={{ color: C.textSoft, marginBottom: "22px", lineHeight: 1.7, fontSize: "14px", fontStyle: "italic" }}>"{t.quote}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", borderTop: "1px solid rgba(74,157,135,0.16)", paddingTop: "18px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: `${t.accent}14`, border: `1.5px solid ${t.accent}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 800, color: t.accent }}>{t.init}</div>
                  <div>
                    <p style={{ fontSize: "13.5px", fontWeight: 700, color: C.text }}>{t.name}</p>
                    <p style={{ fontSize: "12px", color: C.textSoft }}>{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "90px", background: "linear-gradient(to top, #1a2e28, transparent)" }} />
      </section>

      {/* ══ CTA ══ */}
      <section style={{ padding: "100px 0", position: "relative", overflow: "hidden", background: "linear-gradient(135deg, #1a2e28 0%, #1e3438 50%, #1c302c 100%)" }}>
        <div style={{ position: "absolute", top: "-80px", left: "50%", transform: "translateX(-50%)", width: "700px", height: "300px", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(74,157,135,0.18) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="container mx-auto px-6" style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="sora" style={{ fontSize: "clamp(2rem,4.5vw,3.4rem)", fontWeight: 800, color: "#edf5f0", marginBottom: "18px", letterSpacing: "-1px", lineHeight: 1.1 }}>
              Commencez à protéger des vies{" "}
              <span className="gt">aujourd'hui</span>
            </h2>
            <p style={{ marginBottom: "40px", maxWidth: "480px", margin: "0 auto 40px", color: "rgba(200,228,215,0.55)", fontSize: "1.05rem" }}>
              Rejoignez les premiers utilisateurs de SmartGuardian et protégez ce qui compte vraiment.
            </p>
            <Link to="/register" className="btn-primary" style={{ padding: "15px 38px", fontSize: "15px" }}>
              Commencer Gratuitement <ArrowRight style={{ width: "16px", height: "16px" }} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ background: "#121f1a", borderTop: "1px solid rgba(74,157,135,0.14)", padding: "40px 0" }}>
        <div className="container mx-auto px-6" style={{ display: "flex", flexDirection: "row" as const, alignItems: "center", justifyContent: "space-between", gap: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "rgba(74,157,135,0.16)", border: "1px solid rgba(74,157,135,0.30)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Heart style={{ width: "13px", height: "13px", color: "#6ecfb5" }} />
            </div>
            <span className="sora" style={{ fontSize: "14px", fontWeight: 700, color: "#c8ddd6" }}>SmartGuardian</span>
          </div>
          <div style={{ display: "flex", gap: "28px" }}>
            {["Confidentialité","Conditions","Contact","Support"].map(l => (
              <button key={l} className="footer-link" onClick={() => setModal(l)}>{l}</button>
            ))}
          </div>
          <p style={{ fontSize: "12px", color: "rgba(130,170,155,0.38)" }}>© 2026 SmartGuardian. Tous droits réservés.</p>
        </div>
      </footer>

      {/* ══ FOOTER MODALS ══ */}
      {modal === "Confidentialité" && (
        <FooterModal title="Politique de Confidentialité" onClose={() => setModal(null)}>
          <p>SmartGuardian collecte uniquement les données nécessaires à la surveillance médicale : constantes vitales, localisation GPS lors d'alertes, et informations de compte.</p>
          <p>Toutes les données sont chiffrées de bout en bout (AES-256) et stockées sur des serveurs conformes au RGPD situés en Europe.</p>
          <p>Nous ne vendons jamais vos données à des tiers. L'accès est strictement limité à vous, vos médecins désignés et votre famille autorisée.</p>
          <p>Vous pouvez demander la suppression de vos données à tout moment via votre espace personnel ou en nous contactant à privacy@smartguardian.io.</p>
        </FooterModal>
      )}
      {modal === "Conditions" && (
        <FooterModal title="Conditions d'Utilisation" onClose={() => setModal(null)}>
          <p>SmartGuardian est un outil de surveillance et d'aide à la détection. Il ne remplace pas un diagnostic médical professionnel.</p>
          <p>En utilisant ce service, vous acceptez de fournir des informations exactes et de maintenir votre équipement en bon état de fonctionnement.</p>
          <p>SmartGuardian ne peut être tenu responsable en cas de défaillance réseau, de mauvais port du capteur, ou d'utilisation non conforme aux instructions fournies.</p>
          <p>L'abonnement est mensuel et résiliable à tout moment. Aucun remboursement n'est effectué pour les périodes entamées.</p>
        </FooterModal>
      )}
      {modal === "Contact" && (
        <FooterModal title="Contactez-Nous" onClose={() => setModal(null)}>
          <p><strong style={{ color: C.text }}>Laboratoire :</strong> AIoT Lab Tunisia</p>
          <p><strong style={{ color: C.text }}>Email :</strong> contact@smartguardian.io</p>
          <p><strong style={{ color: C.text }}>Support médical urgent :</strong> +216 73 00 00 00</p>
          <p><strong style={{ color: C.text }}>Adresse :</strong> Rue Farhat Hachad, Sousse 4000, Tunisie</p>
          <p><strong style={{ color: C.text }}>Horaires :</strong> Lundi–Vendredi, 8h–18h (support d'urgence 24h/24)</p>
        </FooterModal>
      )}
      {modal === "Support" && (
        <FooterModal title="Support Technique" onClose={() => setModal(null)}>
          <p><strong style={{ color: C.text }}>Documentation :</strong> Consultez notre centre d'aide en ligne pour les guides d'installation et FAQ.</p>
          <p><strong style={{ color: C.text }}>Problème avec le capteur ?</strong> Vérifiez le port USB-C et redémarrez l'appareil. Si le problème persiste, contactez notre équipe.</p>
          <p><strong style={{ color: C.text }}>Application mobile :</strong> Disponible sur iOS 14+ et Android 10+. Mettez à jour vers la dernière version pour les correctifs.</p>
          <p><strong style={{ color: C.text }}>Chat en direct :</strong> Disponible dans l'application pour les abonnés actifs.</p>
        </FooterModal>
      )}

    </div>
  );
}