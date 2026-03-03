import { motion } from "framer-motion";
import { MapPin, Phone, AlertTriangle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import VitalCard from "@/components/VitalCard";
import LiveECGChart from "@/components/LiveECGChart";
import StatusBadge from "@/components/StatusBadge";

const alerts = [
  { time: "14h14", msg: "Fréquence cardiaque élevée à 112 BPM pendant l'activité", severity: "elevated" as const },
  { time: "11h30", msg: "SpO2 brièvement à 94% — retour à la normale", severity: "elevated" as const },
  { time: "Hier", msg: "Toutes les constantes dans la norme pendant 24h", severity: "normal" as const },
];

const PatientDashboard = () => {
  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 max-w-6xl">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bonjour, Karim</h1>
            <p className="text-muted-foreground text-sm mt-1">Votre cœur se porte bien aujourd'hui ✓</p>
          </div>
          <StatusBadge status="normal" size="lg" />
        </motion.div>

        {/* Vital cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <VitalCard icon="❤️" label="Fréquence Cardiaque" value="74" unit="BPM" status="safe" delay={0.1} borderColor="border-l-primary">
            <div className="mt-3 h-1 rounded-full bg-primary/10">
              <div className="h-full w-3/4 rounded-full bg-primary animate-pulse" />
            </div>
          </VitalCard>
          <VitalCard icon="🩸" label="SpO2" value="98" unit="%" status="safe" delay={0.2} borderColor="border-l-safe">
            <div className="mt-3">
              <svg viewBox="0 0 36 36" className="w-10 h-10">
                <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="hsl(var(--safe))" strokeWidth="3" strokeDasharray="98, 100" strokeLinecap="round" />
              </svg>
            </div>
          </VitalCard>
          <VitalCard icon="🌡️" label="Température" value="36.7" unit="°C" status="safe" delay={0.3} borderColor="border-l-accent" />
          <VitalCard icon="🧠" label="Statut IA" value="Normal" unit="" status="safe" delay={0.4} borderColor="border-l-safe">
            <p className="text-xs text-muted-foreground mt-2">Confiance IA : 94%</p>
          </VitalCard>
        </div>

        {/* Live chart */}
        <LiveECGChart />

        {/* AI Analysis + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Analyse IA</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full border-4 border-safe flex items-center justify-center">
                <span className="text-lg font-bold text-safe">BAS</span>
              </div>
              <div>
                <p className="text-sm text-card-foreground font-medium">Risque cardiovasculaire : Faible</p>
                <p className="text-xs text-muted-foreground">Confiance IA : 94.2%</p>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mb-3">
              <div className="bg-safe h-2 rounded-full" style={{ width: "94.2%" }} />
            </div>
            <p className="text-xs text-muted-foreground">Aucune anomalie détectée. Dernière analyse il y a 1s.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Alertes Récentes</h3>
            <div className="space-y-3">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                  <StatusBadge status={a.severity} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-card-foreground">{a.msg}</p>
                    <p className="text-xs text-muted-foreground mt-1">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Emergency */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Urgence</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-muted rounded-2xl h-48 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Localisation GPS Active</p>
                <p className="text-xs text-muted-foreground">36.7538°N, 3.0588°E</p>
              </div>
            </div>
            <div className="space-y-3">
              <button className="w-full bg-critical text-critical-foreground py-4 rounded-2xl font-bold text-lg hover:brightness-110 transition-all flex items-center justify-center gap-2">
                <AlertTriangle className="w-5 h-5" /> SOS
              </button>
              <button className="w-full bg-muted text-foreground py-3 rounded-2xl text-sm font-medium hover:bg-muted/80 transition-all flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" /> Appeler Contact d'Urgence
              </button>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Médecin : Dr. Isabelle Moreau</p>
                <p className="text-xs text-muted-foreground">Famille : Fatima Chérif</p>
              </div>
              <p className="text-xs text-center text-muted-foreground">Votre médecin et vos proches seront alertés instantanément</p>
            </div>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default PatientDashboard;
