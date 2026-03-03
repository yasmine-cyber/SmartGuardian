import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { Heart, Shield, Brain, MapPin, Users, Activity, Bell, Zap, ArrowRight, ChevronRight, Wifi, WifiOff, Lock, Smartphone, Radio } from "lucide-react";

const AnimatedCounter = ({ target, suffix = "" }: {target: number;suffix?: string;}) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 2000;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {setCount(target);clearInterval(timer);} else
      setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
};

const floatingVitals = [
{ label: "Fréquence Cardiaque", value: "72 BPM", icon: "❤️", x: "62%", y: "45%", delay: 0.6 },
{ label: "SpO2", value: "98%", icon: "🩸", x: "77%", y: "18%", delay: 0.9 },
{ label: "Température", value: "36.6°C", icon: "🌡️", x: "85%", y: "62%", delay: 1.2 }];


const steps = [
{ num: "01", title: "Capture Biométrique", desc: "Capteurs portables mesurant FC, SpO2 et température en continu", icon: Activity },
{ num: "02", title: "IA Embarquée", desc: "Analyse locale par IA — détection sans connexion internet", icon: Brain },
{ num: "03", title: "Anomalie Détectée", desc: "Schéma critique déclenche l'empaquetage sécurisé avec GPS", icon: Bell },
{ num: "04", title: "Transmission Cellulaire", desc: "Données chiffrées envoyées via 4G/GSM → Cloud → alerte instantanée", icon: Radio }];


const features = [
{ icon: WifiOff, title: "Fonctionnement Autonome", desc: "Fonctionne sans WiFi — le capteur analyse et alerte de manière indépendante." },
{ icon: Brain, title: "IA Embarquée", desc: "La détection se fait directement sur le capteur portable, sans latence réseau." },
{ icon: MapPin, title: "Localisation GPS", desc: "Position en temps réel transmise automatiquement lors d'une alerte critique." },
{ icon: Bell, title: "Alertes Multi-Canal", desc: "Notifications via application, SMS et appel vocal simultanément." },
{ icon: Users, title: "Réseau de Soins Unifié", desc: "Patient, médecin et famille connectés dans un écosystème unique." },
{ icon: Lock, title: "Sécurisé & Privé", desc: "Chiffrement de bout en bout pour toutes les transmissions de données." }];


const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2.5">
            <Heart className="w-7 h-7 text-primary animate-heartbeat" />
            <span className="text-lg font-bold text-foreground tracking-tight">SmartGuardian</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Fonctionnement</a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Fonctionnalités</a>
            <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Témoignages</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2">
              Connexion
            </Link>
            <Link to="/login" className="text-sm font-semibold bg-sky-900 text-white px-5 py-2.5 rounded-full hover:brightness-110 transition-all shadow-md">
              Commencer
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative hero-bg aurora-bg min-h-screen flex items-center overflow-hidden pt-16">
        {/* Animated sage blobs */}
        <div className="absolute top-[15%] left-[10%] w-[600px] h-[600px] rounded-full blur-[160px] animate-aurora opacity-70" style={{ background: 'radial-gradient(circle, hsla(150, 40%, 65%, 0.7), transparent 65%)' }} />
        <div className="absolute top-[50%] right-[5%] w-[500px] h-[500px] rounded-full blur-[140px] animate-aurora opacity-55" style={{ background: 'radial-gradient(circle, hsla(155, 35%, 60%, 0.6), transparent 60%)', animationDelay: '-5s' }} />
        <div className="absolute top-[30%] left-[50%] w-[450px] h-[450px] rounded-full blur-[130px] animate-aurora opacity-50" style={{ background: 'radial-gradient(circle, hsla(145, 30%, 70%, 0.65), transparent 60%)', animationDelay: '-10s' }} />
        <div className="absolute bottom-[20%] left-[30%] w-[350px] h-[350px] rounded-full blur-[120px] animate-aurora opacity-45" style={{ background: 'radial-gradient(circle, hsla(160, 38%, 58%, 0.5), transparent 55%)', animationDelay: '-3s' }} />

        {/* Sweeping ECG line behind content */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.12]">
          <svg viewBox="0 0 1400 200" className="w-full max-w-[1400px] h-48" preserveAspectRatio="none">
            <path
              d={`M0 100 L100 100 L130 100 L140 85 L150 100 L160 100 L180 100 L190 60 L195 140 L200 20 L205 160 L210 80 L215 100 L240 100 L260 90 L280 100 L320 100 L400 100 L430 100 L440 85 L450 100 L460 100 L480 100 L490 60 L495 140 L500 20 L505 160 L510 80 L515 100 L540 100 L560 90 L580 100 L620 100 L700 100 L730 100 L740 85 L750 100 L760 100 L780 100 L790 60 L795 140 L800 20 L805 160 L810 80 L815 100 L840 100 L860 90 L880 100 L920 100 L1000 100 L1030 100 L1040 85 L1050 100 L1060 100 L1080 100 L1090 60 L1095 140 L1100 20 L1105 160 L1110 80 L1115 100 L1140 100 L1160 90 L1180 100 L1220 100 L1300 100 L1400 100`}
              fill="none"
              stroke="hsl(160, 20%, 46%)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="3000"
              strokeDashoffset="3000"
              className="animate-hero-ecg"
            />
          </svg>
        </div>

        {/* Floating vitals */}
        {floatingVitals.map((v, i) =>
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: v.delay, duration: 0.7, ease: "easeOut" }}
          className="hidden lg:block absolute bg-card/90 backdrop-blur-sm border border-border rounded-2xl px-5 py-4 shadow-sm animate-float"
          style={{ left: v.x, top: v.y, animationDelay: `${i * 0.7}s` }}>
            <div className="flex items-center gap-3">
              <span className="text-xl">{v.icon}</span>
              <div>
                <p className="text-xs text-muted-foreground">{v.label}</p>
                <p className="text-lg font-bold text-foreground">{v.value}</p>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <span className="w-1.5 h-1.5 rounded-full bg-safe animate-pulse" />
                <span className="text-[10px] text-safe">Live</span>
              </div>
            </div>
          </motion.div>
        )}

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24">
            {/* Left: Text */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="flex-1 text-center lg:text-left max-w-xl">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-sm text-foreground/70 mb-8">
                <Shield className="w-4 h-4 text-primary" />
                Télémédecine Autonome par IA
              </div>
              <h1 className="text-5xl md:text-7xl font-extrabold text-foreground leading-[1.05] tracking-tight mb-6">
                Votre Santé,{" "}
                <span className="gradient-text">Surveillée.</span>{" "}
                Intelligemment.
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed">
                Un système IA portable qui surveille vos constantes vitales 24h/24, détecte les anomalies avant qu'elles ne deviennent des urgences, et connecte votre équipe de soins — où que vous soyez.
              </p>
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 bg-sky-900 text-white px-8 py-4 rounded-full text-base font-semibold hover:brightness-110 transition-all shadow-md">
                  Commencer le Suivi <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center gap-2 border border-border text-foreground px-8 py-4 rounded-full text-base font-semibold hover:bg-muted transition-all">
                  Voir Comment Ça Marche <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </motion.div>

            {/* Right: Animated Health Ring Visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 1, ease: "easeOut" }}
              className="hidden lg:flex flex-shrink-0 items-center justify-center relative w-[500px] h-[500px] lg:ml-auto">

              {/* Outer glow */}
              <div className="absolute inset-0 rounded-full bg-primary/5 animate-ring-pulse" />

              {/* Rotating ring 1 */}
              <svg className="absolute inset-0 w-full h-full animate-ring-rotate" viewBox="0 0 500 500">
                <circle cx="250" cy="250" r="220" fill="none" stroke="hsl(160, 20%, 46%)" strokeWidth="1.5" strokeDasharray="8 16" opacity="0.25" />
              </svg>

              {/* Rotating ring 2 (reverse) */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 500" style={{ animation: 'ring-rotate 25s linear infinite reverse' }}>
                <circle cx="250" cy="250" r="190" fill="none" stroke="hsl(160, 38%, 59%)" strokeWidth="1" strokeDasharray="4 20" opacity="0.2" />
              </svg>

              {/* Inner ECG ring */}
              <svg className="absolute inset-[50px] w-[400px] h-[400px]" viewBox="0 0 400 400">
                <circle cx="200" cy="200" r="170" fill="none" stroke="hsl(160, 20%, 46%)" strokeWidth="2" strokeDasharray="60 800" strokeLinecap="round" opacity="0.3" className="animate-ring-rotate" />
                {/* Progress arc */}
                <circle cx="200" cy="200" r="170" fill="none" stroke="hsl(160, 20%, 46%)" strokeWidth="3" strokeDasharray="580 240" strokeLinecap="round" opacity="0.15" transform="rotate(-90 200 200)" />
              </svg>

              {/* Orbiting dots */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-0 h-0">
                  <div className="absolute animate-orbit">
                    <div className="w-3 h-3 rounded-full bg-primary/60 shadow-[0_0_8px_hsla(160,20%,46%,0.4)]" />
                  </div>
                  <div className="absolute animate-orbit-outer">
                    <div className="w-2 h-2 rounded-full bg-safe/50 shadow-[0_0_6px_hsla(160,38%,59%,0.3)]" />
                  </div>
                </div>
              </div>

              {/* Center content */}
              <div className="relative z-10 flex flex-col items-center">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mb-3 backdrop-blur-sm">
                  <Heart className="w-9 h-9 text-primary" />
                </motion.div>
                <span className="text-3xl font-extrabold text-foreground">72</span>
                <span className="text-xs font-medium text-muted-foreground tracking-wider">BPM</span>
                {/* Mini waveform bars */}
                <div className="flex items-end gap-[3px] mt-3 h-5">
                  {[0.6, 1, 0.4, 0.8, 0.5, 1, 0.3, 0.7, 0.9, 0.4, 0.6, 1].map((h, i) => (
                    <div
                      key={i}
                      className="w-[3px] rounded-full bg-primary/50"
                      style={{
                        height: '100%',
                        transform: `scaleY(${h})`,
                        animation: `waveform-bar 1.2s ease-in-out ${i * 0.1}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent opacity-100" />
      </section>

      {/* The Problem */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">Le Problème Que Nous Résolvons</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Les maladies cardiovasculaires restent la première cause de mortalité mondiale. La détection précoce sauve des vies.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
            { value: 17900000, suffix: "+", label: "Décès par an dans le monde liés aux MCV" },
            { value: 80, suffix: "%", label: "Des événements cardiaques évitables avec détection précoce" },
            { value: 4, suffix: "min", label: "Temps de réponse moyen avec les alertes SmartGuardian" }].
            map((stat, i) =>
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} className="text-center p-8">
                <div className="text-5xl md:text-6xl font-extrabold gradient-text mb-3">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-muted-foreground">{stat.label}</p>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">Comment Ça Marche</h2>
            <p className="text-muted-foreground text-lg">Quatre étapes entre vous et la tranquillité d'esprit</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {steps.map((step, i) =>
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative bg-card rounded-2xl p-7 border border-border shadow-sm hover:shadow-md transition-shadow">

                <div className="text-6xl font-extrabold text-primary/8 absolute top-3 right-5">{step.num}</div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <step.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-card-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                {i < 3 &&
              <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-primary/20" />
              }
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-secondary relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">Fonctionnalités Clés</h2>
            <p className="text-muted-foreground text-lg">Tout ce dont vous avez besoin pour une santé proactive</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {features.map((f, i) =>
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">

                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">Ils Nous Font Confiance</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
            { quote: "Les alertes prédictives de SmartGuardian nous ont permis de détecter une arythmie 48h avant qu'elle ne devienne critique. Cette technologie sauve des vies.", name: "Dr. Ahmed Khalil", role: "Cardiologue, CHU Mustapha" },
            { quote: "En tant que parent, la tranquillité d'esprit est inestimable. Je peux vérifier la santé cardiaque de mon père à tout moment.", name: "Leila Benmoussa", role: "Aidante familiale" },
            { quote: "Le système fonctionne même dans les zones sans couverture WiFi. L'IA embarquée est un vrai game-changer pour nos patients ruraux.", name: "Dr. Isabelle Moreau", role: "Médecin généraliste" }].
            map((t, i) =>
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="bg-card border border-border rounded-2xl p-8 shadow-sm">

                <p className="text-card-foreground mb-6 leading-relaxed">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-secondary relative overflow-hidden">
        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
              Commencez à protéger des vies <span className="gradient-text">aujourd'hui</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              Rejoignez des milliers de patients et professionnels de santé utilisant SmartGuardian.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-full text-base font-semibold hover:brightness-110 transition-all glow-sage">

              Commencer Gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-foreground">SmartGuardian</span>
            </div>
            <div className="flex gap-6">
              {["Confidentialité", "Conditions", "Contact", "Support"].map((l) =>
              <a key={l} href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</a>
              )}
            </div>
            <p className="text-xs text-muted-foreground">© 2026 SmartGuardian. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>);

};

export default Index;