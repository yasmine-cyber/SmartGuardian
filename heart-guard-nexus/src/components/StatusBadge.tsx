interface StatusBadgeProps {
  status: "normal" | "elevated" | "critical";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const config = {
  normal: { label: "Stable", bg: "bg-safe/10", text: "text-safe", dot: "bg-safe" },
  elevated: { label: "Surveillance", bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
  critical: { label: "Critique", bg: "bg-critical/10", text: "text-critical", dot: "bg-critical" },
};

const sizes = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
  lg: "text-base px-4 py-1.5",
};

const StatusBadge = ({ status, size = "md", className = "" }: StatusBadgeProps) => {
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${c.bg} ${c.text} ${sizes[size]} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

export default StatusBadge;
