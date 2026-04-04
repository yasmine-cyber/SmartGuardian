import { motion } from "framer-motion";
import { ReactNode } from "react";

interface VitalCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  unit: string;
  status?: "safe" | "warning" | "critical";
  delay?: number;
  borderColor?: string;
  children?: ReactNode;
}

const statusDot = {
  safe: "bg-safe",
  warning: "bg-warning",
  critical: "bg-critical",
};

const VitalCard = ({ icon, label, value, unit, status = "safe", delay = 0, borderColor = "border-l-primary", children }: VitalCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      className={`relative bg-card rounded-2xl p-5 border border-border shadow-sm border-l-4 ${borderColor}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${statusDot[status]} animate-status-pulse`} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight text-card-foreground">{value}</span>
        <span className="text-sm font-medium text-muted-foreground">{unit}</span>
      </div>
      {children}
    </motion.div>
  );
};

export default VitalCard;
