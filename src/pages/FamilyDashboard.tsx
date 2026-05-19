import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import {
  Heart,
  AlertCircle,
  Loader,
  UserPlus,
  Users,
  Bell,
  MessageSquare,
  ChevronRight,
  Activity,
  WifiOff,
  MapPin,
} from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type PatientStatus = "online" | "offline" | "alert";

interface LinkedPatient {
  patient_user_id: string;
  patient_row_id: string;
  nom: string;
  prenom: string | null;
  lien_parente: string | null;
  bpm: number | null;
  spo2: number | null;
  temperature: number | null;
  status: PatientStatus;
  lastUpdate: string | null;
}

interface AlertItem {
  id: string;
  message: string;
  severity: string;
  created_at: string;
  patient_nom: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<
  PatientStatus,
  {
    dot: string;
    ring: string;
    label: string;
    bg: string;
    text: string;
  }
> = {
  online: {
    dot: "bg-emerald-500",
    ring: "ring-emerald-200 dark:ring-emerald-800",
    label: "En ligne",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-600 dark:text-emerald-400",
  },

  offline: {
    dot: "bg-slate-400",
    ring: "ring-slate-200 dark:ring-slate-700",
    label: "Hors ligne",
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-500 dark:text-slate-400",
  },

  alert: {
    dot: "bg-red-500",
    ring: "ring-red-200 dark:ring-red-800",
    label: "Alerte active",
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-600 dark:text-red-400",
  },
};

function normalizeSeverity(
  s: string
): "critical" | "medium" | "low" {
  const v = (s || "").toUpperCase();

  if (["CRITICAL", "CRITIQUE"].includes(v))
    return "critical";

  if (
    ["MEDIUM", "MOYEN", "HIGH", "ELEVE"].includes(v)
  )
    return "medium";

  return "low";
}

function timeAgo(dateStr: string) {
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );

  if (diff < 60) return `il y a ${diff}s`;

  if (diff < 3600)
    return `il y a ${Math.floor(diff / 60)} min`;

  if (diff < 86400)
    return `il y a ${Math.floor(diff / 3600)}h`;

  return `il y a ${Math.floor(diff / 86400)}j`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const FamilyDashboard = () => {
  const navigate = useNavigate();

  const [patients, setPatients] = useState<
    LinkedPatient[]
  >([]);

  const [alerts, setAlerts] = useState<AlertItem[]>(
    []
  );

  const [loading, setLoading] = useState(true);

  const [inviteCodeInput, setInviteCodeInput] =
    useState("");

  const [linkLoading, setLinkLoading] =
    useState(false);

  const [linkError, setLinkError] = useState("");

  const [linkSuccess, setLinkSuccess] =
    useState("");

  const fetchData = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: links } = await supabase
      .from("proche_patient")
      .select("patient_id, lien_parente")
      .eq("proche_id", user.id);

    if (!links?.length) {
      setLoading(false);
      return;
    }

    const patientUserIds = links.map(
      (l) => l.patient_id
    );

    const [
      { data: utilisateurs },
      { data: patientRows },
    ] = await Promise.all([
      supabase
        .from("utilisateurs")
        .select("id, nom, prenom")
        .in("id", patientUserIds),

      supabase
        .from("patients")
        .select("id, user_id, status")
        .in("user_id", patientUserIds),
    ]);

    const enriched: LinkedPatient[] =
      await Promise.all(
        (utilisateurs ?? []).map(async (u) => {
          const link = links.find(
            (l) => l.patient_id === u.id
          );

          const patRow = (
            patientRows ?? []
          ).find((p) => p.user_id === u.id);

          let bpm = null;
          let spo2 = null;
          let temperature = null;
          let lastUpdate = null;

          if (patRow?.id) {
            const { data: device } =
              await supabase
                .from("devices")
                .select("id")
                .eq("patient_id", patRow.id)
                .eq("actif", true)
                .order("created_at", {
                  ascending: false,
                })
                .limit(1)
                .single();

            if (device?.id) {
              const { data: vital } =
                await supabase
                  .from("vital_signs")
                  .select(
                    "bpm, spo2, temperature, recorded_at"
                  )
                  .eq("device_id", device.id)
                  .order("recorded_at", {
                    ascending: false,
                  })
                  .limit(1)
                  .single();

              if (vital) {
                bpm = vital.bpm;
                spo2 = vital.spo2;
                temperature = vital.temperature;
                lastUpdate = vital.recorded_at;
              }
            }
          }

          let status: PatientStatus = "offline";

          if (patRow?.status === "alert")
            status = "alert";

          else if (
            lastUpdate &&
            Date.now() -
              new Date(lastUpdate).getTime() <
              5 * 60_000
          )
            status = "online";

          return {
            patient_user_id: u.id,
            patient_row_id: patRow?.id ?? "",
            nom: u.nom,
            prenom: u.prenom,
            lien_parente:
              link?.lien_parente ?? null,
            bpm,
            spo2,
            temperature,
            status,
            lastUpdate,
          };
        })
      );

    setPatients(enriched);

    const pRowIds = (patientRows ?? [])
      .map((p) => p.id)
      .filter(Boolean);

    if (pRowIds.length) {
      const { data: alertData } =
        await supabase
          .from("alerts")
          .select(
            "id, message, severity, created_at, patient_id"
          )
          .in("patient_id", pRowIds)
          .order("created_at", {
            ascending: false,
          })
          .limit(5);

      if (alertData) {
        setAlerts(
          alertData.map((a) => {
            const pr = (
              patientRows ?? []
            ).find((p) => p.id === a.patient_id);

            const u = (
              utilisateurs ?? []
            ).find((x) => x.id === pr?.user_id);

            return {
              id: a.id,
              message: a.message,
              severity: a.severity ?? "",
              created_at: a.created_at,
              patient_nom: u
                ? `${u.prenom ?? ""} ${u.nom}`.trim()
                : "Votre proche",
            };
          })
        );
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLinkPatient = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const code = inviteCodeInput.trim();

    if (!code) return;

    setLinkLoading(true);
    setLinkError("");
    setLinkSuccess("");

    const { data, error } =
      await supabase.rpc(
        "consume_invite_code",
        {
          p_code: code,
        }
      );

    setLinkLoading(false);

    if (error) {
      setLinkError(
        error.message ||
          "Code invalide ou expiré."
      );

      return;
    }

    const res = data as {
      ok?: boolean;
      error?: string;
      already_linked?: boolean;
    };

    if (res?.ok === false) {
      setLinkError(
        res.error ||
          "Code invalide ou expiré."
      );

      return;
    }

    setInviteCodeInput("");

    setLinkSuccess(
      res.already_linked
        ? "Déjà lié à ce patient."
        : "Lien établi avec succès ✓"
    );

    fetchData();
  };

  const onlineCount = patients.filter(
    (p) => p.status === "online"
  ).length;

  const alertCount = patients.filter(
    (p) => p.status === "alert"
  ).length;

  const criticalAlerts = alerts.filter(
    (a) =>
      normalizeSeverity(a.severity) ===
      "critical"
  );

  return (
    <DashboardLayout role="family">
      <div className="space-y-6 max-w-4xl">

        {/* Header */}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-foreground">
            Bonjour 💛
          </h1>

          <p className="text-muted-foreground mt-1 text-sm">
            Vue d'ensemble de vos proches
          </p>
        </motion.div>

      </div>
    </DashboardLayout>
  );
};

export default FamilyDashboard;