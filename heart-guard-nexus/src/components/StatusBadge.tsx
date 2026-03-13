interface StatusBadgeProps {
  status?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const config: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  normal: { label: "Stable", bg: "bg-safe/10", text: "text-safe", dot: "bg-safe" },
  stable: { label: "Stable", bg: "bg-safe/10", text: "text-safe", dot: "bg-safe" },
  elevated: { label: "Surveillance", bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
  attention: { label: "Surveillance", bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
  surveillance: { label: "Surveillance", bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
  critical: { label: "Critique", bg: "bg-critical/10", text: "text-critical", dot: "bg-critical" },
  critique: { label: "Critique", bg: "bg-critical/10", text: "text-critical", dot: "bg-critical" },
  offline: { label: "Hors ligne", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  moyen: { label: "Moyen", bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
  faible: { label: "Faible", bg: "bg-safe/10", text: "text-safe", dot: "bg-safe" },
};

const defaultConfig = { label: "—", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" };

const sizes: Record<string, string> = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
  lg: "text-base px-4 py-1.5",
};

const StatusBadge = ({ status, size = "md", className = "" }: StatusBadgeProps) => {
  const key = (status ?? "").toString().trim().toLowerCase();
  const c = config[key] ?? defaultConfig;
  const sizeClass = sizes[size] ?? sizes.md;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${c.bg} ${c.text} ${sizeClass} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

export default StatusBadge;
