import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  AlertCircle,
  Info,
  Clock,
  Filter,
  ChevronDown,
  Heart,
  Zap,
} from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alerte {
  id: string;
  patient_id: string;
  severity: string;
  type: string;
  message: string;
  created_at: string;
  patient_nom: string;
}

type FilterSeverity = "toutes" | "critical" | "medium" | "low";
type SortOrder = "desc" | "asc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeSeverity(
  s: string
): "critical" | "medium" | "low" {
  const v = (s || "").toUpperCase().trim();

  if (["CRITICAL", "CRITIQUE"].includes(v)) return "critical";

  if (["MEDIUM", "MOYEN", "HIGH", "ELEVE"].includes(v))
    return "medium";

  return "low";
}

const SEV_CFG = {
  critical: {
    label: "Critique",
    border: "border-l-red-500",
    icon: "critical",
    badge:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },

  medium: {
    label: "Moyen",
    border: "border-l-amber-400",
    icon: "warning",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },

  low: {
    label: "Faible",
    border: "border-l-primary",
    icon: "info",
    badge: "bg-primary/10 text-primary",
  },
} as const;

function timeAgo(dateStr: string) {
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );

  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;

  return `il y a ${Math.floor(diff / 86400)}j`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const FamilyAlerts = () => {
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [patientIds, setPatientIds] = useState<string[]>([]);
  const [nameByPatientId, setNameByPatientId] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);

  const [filterSev, setFilterSev] =
    useState<FilterSeverity>("toutes");

  const [sortOrder, setSortOrder] =
    useState<SortOrder>("desc");

  const [showFilters, setShowFilters] = useState(false);

  const channelRef = useRef<
    ReturnType<typeof supabase.channel> | null
  >(null);

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: links } = await supabase
        .from("proche_patient")
        .select("patient_id")
        .eq("proche_id", user.id);

      if (!links?.length) {
        setLoading(false);
        return;
      }

      const patientUserIds = links.map((l) => l.patient_id);

      const { data: patientRows } = await supabase
        .from("patients")
        .select("id, user_id")
        .in("user_id", patientUserIds);

      if (!patientRows?.length) {
        setLoading(false);
        return;
      }

      const pids = patientRows.map((p) => p.id);

      setPatientIds(pids);

      const { data: utilisateurs } = await supabase
        .from("utilisateurs")
        .select("id, nom, prenom")
        .in("id", patientUserIds);

      const nameMap: Record<string, string> = {};

      patientRows.forEach((p) => {
        const u = (utilisateurs || []).find(
          (x) => x.id === p.user_id
        );

        nameMap[p.id] = u
          ? [u.prenom, u.nom]
              .filter(Boolean)
              .join(" ")
              .trim() || "Proche"
          : "Proche";
      });

      setNameByPatientId(nameMap);

      const { data: alertData, error: alertError } =
        await supabase
          .from("alerts")
          .select(
            "id, message, severity, type, created_at, patient_id"
          )
          .in("patient_id", pids)
          .order("created_at", { ascending: false });

      console.log("alerts fetch:", alertData, alertError);

      if (alertData) {
        setAlertes(
          alertData.map((a) => ({
            ...a,
            patient_nom:
              nameMap[a.patient_id] || "Proche",
          }))
        );
      }

      setLoading(false);
    };

    load();
  }, []);

  // ── Realtime ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!patientIds.length) return;

    const channel = supabase
      .channel("family-alerts-rt")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            patient_id: string;
            message?: string;
            severity?: string;
            type?: string;
            created_at?: string;
          };

          if (!patientIds.includes(row.patient_id)) return;

          const patientNom =
            nameByPatientId[row.patient_id] ||
            "Un proche";

          setAlertes((prev) => [
            {
              id: row.id,
              patient_id: row.patient_id,
              message: row.message ?? "",
              severity: row.severity ?? "",
              type: row.type ?? "",
              created_at:
                row.created_at ??
                new Date().toISOString(),
              patient_nom: patientNom,
            },
            ...prev,
          ]);

          toast.info(
            `Nouvelle alerte pour ${patientNom}`
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current)
        supabase.removeChannel(channelRef.current);
    };
  }, [patientIds, nameByPatientId]);

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filtered = alertes
    .filter((a) => {
      if (filterSev === "toutes") return true;

      return normalizeSeverity(a.severity) === filterSev;
    })
    .sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();

      return sortOrder === "desc"
        ? tb - ta
        : ta - tb;
    });

  const counts = {
    total: alertes.length,

    critical: alertes.filter(
      (a) =>
        normalizeSeverity(a.severity) === "critical"
    ).length,

    medium: alertes.filter(
      (a) =>
        normalizeSeverity(a.severity) === "medium"
    ).length,

    low: alertes.filter(
      (a) =>
        normalizeSeverity(a.severity) === "low"
    ).length,
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="family">
      <div className="space-y-6 max-w-3xl">

        {/* Header */}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Bell className="w-6 h-6 text-primary" />
                Alertes
              </h1>

              <p className="text-muted-foreground text-sm mt-1">
                Historique en temps réel
              </p>
            </div>

            {counts.critical > 0 && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2">
                <Zap className="w-4 h-4 text-red-500 animate-pulse" />

                <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                  {counts.critical} critique
                  {counts.critical > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </DashboardLayout>
  );
};

export default FamilyAlerts;