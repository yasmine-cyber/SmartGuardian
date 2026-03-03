import { motion } from "framer-motion";
import { Phone, MapPin, MessageSquare, Heart, AlertCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const lovedOnes = [
  {
    name: "Karim Messaoudi",
    relation: "Mon père",
    status: "normal" as const,
    statusLabel: "Tout va bien",
    lastUpdate: "il y a 18 secondes",
    bpm: 74,
    avatar: "K",
  },
  {
    name: "Mohamed Brahimi",
    relation: "Mon frère",
    status: "elevated" as const,
    statusLabel: "À surveiller",
    lastUpdate: "il y a 5 min",
    bpm: 92,
    avatar: "M",
  },
];

const statusConfig = {
  normal: { color: "bg-safe", ring: "ring-safe/20", shadowColor: "shadow-safe/20" },
  elevated: { color: "bg-warning", ring: "ring-warning/20", shadowColor: "shadow-warning/20" },
  critical: { color: "bg-critical", ring: "ring-critical/20", shadowColor: "shadow-critical/20" },
};

const alertFeed = [
  { time: "Ce matin à 09h14", msg: "La température de votre père a dépassé 38.5°C. Son médecin traitant a été automatiquement notifié.", type: "warning" },
  { time: "Hier à 16h30", msg: "Karim a terminé sa marche quotidienne — 2 400 pas, fréquence cardiaque stable.", type: "safe" },
  { time: "Hier à 14h14", msg: "Mohamed : fréquence cardiaque élevée à 112 BPM. Son médecin a été informé.", type: "warning" },
  { time: "Avant-hier", msg: "Toutes les constantes de Karim sont normales depuis 48h. ✓", type: "safe" },
];

const FamilyDashboard = () => {
  return (
    <DashboardLayout role="family">
      <div className="space-y-8 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-foreground">Bonjour, Fatima 💛</h1>
          <p className="text-lg text-muted-foreground mt-2">Vos proches sont sous bonne garde.</p>
        </motion.div>

        {/* Loved ones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {lovedOnes.map((person, i) => {
            const sc = statusConfig[person.status];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                className="bg-card border border-border rounded-3xl p-7 shadow-sm"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className={`relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold ring-4 ${sc.ring}`}>
                    {person.avatar}
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${sc.color} border-2 border-card animate-status-pulse`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-card-foreground">{person.name}</h2>
                    <p className="text-muted-foreground">{person.relation}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-6 bg-muted/50 rounded-2xl p-4">
                  <div>
                    <p className="text-3xl font-bold text-card-foreground">{person.bpm} <span className="text-lg text-muted-foreground">BPM</span></p>
                    <p className="text-sm text-muted-foreground">Dernière mise à jour {person.lastUpdate}</p>
                  </div>
                  <div className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    person.status === "normal" ? "bg-safe/10 text-safe" :
                    person.status === "elevated" ? "bg-warning/10 text-warning" :
                    "bg-critical/10 text-critical"
                  }`}>
                    {person.statusLabel}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button className="flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-2xl font-semibold text-sm hover:brightness-110 transition-all">
                    <Phone className="w-4 h-4" /> Appeler
                  </button>
                  <button className="flex items-center justify-center gap-2 bg-muted text-foreground py-3.5 rounded-2xl font-semibold text-sm hover:bg-muted/80 transition-all">
                    <MapPin className="w-4 h-4" /> Localiser
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Alert Feed */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-border rounded-3xl p-7 shadow-sm">
          <h2 className="text-xl font-bold text-card-foreground mb-5">Dernières Nouvelles</h2>
          <div className="space-y-4">
            {alertFeed.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-muted/30">
                {a.type === "warning" ? (
                  <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                ) : (
                  <Heart className="w-5 h-5 text-safe flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-base text-card-foreground leading-relaxed">{a.msg}</p>
                  <p className="text-sm text-muted-foreground mt-1">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Emergency map placeholder */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card border border-border rounded-3xl p-7 shadow-sm">
          <h2 className="text-xl font-bold text-card-foreground mb-4">Localisation d'Urgence</h2>
          <div className="bg-muted rounded-2xl h-48 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Position GPS de votre proche</p>
              <p className="text-xs text-muted-foreground">36.7538°N, 3.0588°E — Alger, Algérie</p>
            </div>
          </div>
        </motion.div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Phone, label: "Appeler le Médecin", desc: "Dr. Isabelle Moreau", variant: "primary" },
            { icon: AlertCircle, label: "Appeler le 15", desc: "SAMU / Urgences", variant: "critical" },
            { icon: MessageSquare, label: "Envoyer un Message", desc: "À l'équipe de soins", variant: "secondary" },
          ].map((action, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="bg-card border border-border rounded-2xl p-5 text-left hover:shadow-md transition-all group shadow-sm"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                action.variant === "primary" ? "bg-primary/10" :
                action.variant === "critical" ? "bg-critical/10" : "bg-muted"
              }`}>
                <action.icon className={`w-5 h-5 ${
                  action.variant === "primary" ? "text-primary" :
                  action.variant === "critical" ? "text-critical" : "text-muted-foreground"
                }`} />
              </div>
              <p className="font-semibold text-card-foreground">{action.label}</p>
              <p className="text-sm text-muted-foreground">{action.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FamilyDashboard;
