import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Activity, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { supabase } from "@/lib/supabase";

const chartConfig = {
  count: { label: "Nombre", color: "hsl(var(--primary))" },
  month: { label: "Mois" },
};

const DoctorAnalytics = () => {
  const [stats, setStats] = useState<{
    total: number;
    stable: number;
    attention: number;
    critical: number;
  }>({ total: 0, stable: 0, attention: 0, critical: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
  .from("patients")
  .select("id, status")
  .eq("medecin_id", user.id);

console.log("user.id:", user.id);
console.log("data:", data);
console.log("error:", error);

      if (error) {
        console.error("DoctorAnalytics: failed to fetch patients", error);
        setLoading(false);
        return;
      }

      const list = data ?? [];
      setStats({
        total: list.length,
        stable: list.filter((p: { status?: string }) => p.status === "stable").length,
        attention: list.filter((p: { status?: string }) => p.status === "attention").length,
        critical: list.filter((p: { status?: string }) => p.status === "critical").length,
      });
      setLoading(false);
    };
    load();
  }, []);

  const chartData = [
    { month: "Stable", count: stats.stable },
    { month: "Surveillance", count: stats.attention },
    { month: "Critique", count: stats.critical },
  ];
  const total = stats.total;

  return (
    <DashboardLayout role="doctor">
      <div className="space-y-6 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Analyses</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Vue d'ensemble de l'état de vos patients
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { icon: Users,    label: "Total patients",    value: total,          color: "text-primary"    },
            { icon: TrendingUp, label: "Stables",         value: stats.stable,   color: "text-green-500"  },
            { icon: Activity, label: "Sous surveillance", value: stats.attention, color: "text-yellow-500" },
            { icon: BarChart3, label: "Critiques",        value: stats.critical, color: "text-red-500"    },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-card border border-border rounded-2xl p-4 shadow-sm"
            >
              <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
              <p className="text-2xl font-bold text-card-foreground">{loading ? "—" : s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-foreground mb-4">Répartition par statut</h2>
          <div className="h-[280px]">
            <ChartContainer config={chartConfig} className="w-full h-full">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default DoctorAnalytics;