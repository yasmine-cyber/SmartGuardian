import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Cpu, Activity, Clock, Wifi, WifiOff,
  CheckCircle2, XCircle, Plus, X, Loader, AlertTriangle,
  Package, CreditCard, Check, Ban, ChevronRight,
  ShieldAlert, UserPlus
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import QRCode from "qrcode";

/* ── Types ───────────────────────────────────────────────── */
type DemandeAdmin = {
  id: string;
  patient_id: string;
  medecin_id: string;
  statut: string;
  created_at: string;
  patient_nom: string;
  patient_maladies: string[];
  medecin_nom: string;
};

type DeviceRequest = {
  id: string;
  patient_id: string;
  status: string;
  payment_status: string;
  created_at: string;
  patient_nom: string;
  patient_email: string;
  device_id: string | null;
  qr_code: string | null;
  notes_admin: string | null;
};

type AlertLog = {
  id: string;
  severity: string;
  type: string;
  message: string;
  resolved: boolean;
  created_at: string;
  patient_nom: string;
};

/* ── Palette ─────────────────────────────────────────────── */
const C = {
  primary:     "#4a9d87",
  primaryDark: "#3d8c7a",
  secondary:   "#5b8fa0",
  text:        "#1a2e28",
  textSoft:    "rgba(30,60,50,0.62)",
  gold:        "#d4a843",
  muted:       "#c0504a",
};

/* ── Shared styles ───────────────────────────────────────── */
const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.18)",
  borderRadius: "22px",
  boxShadow: "0 8px 32px rgba(30,60,50,0.08), 0 1px 0 rgba(255,255,255,0.9) inset",
};

const glassModal: React.CSSProperties = {
  background: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(74,157,135,0.18)",
  borderRadius: "24px",
  boxShadow: "0 24px 64px rgba(30,60,50,0.16)",
};

/* ── Severity config ─────────────────────────────────────── */
const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: C.muted,    bg: "rgba(192,80,74,0.10)",  border: "rgba(192,80,74,0.30)" },
  HIGH:     { color: "#d4843a",  bg: "rgba(212,132,58,0.10)", border: "rgba(212,132,58,0.30)" },
  MEDIUM:   { color: C.gold,     bg: "rgba(212,168,67,0.12)", border: "rgba(212,168,67,0.30)" },
  INFO:     { color: C.secondary,bg: "rgba(91,143,160,0.10)", border: "rgba(91,143,160,0.28)" },
  CRITIQUE: { color: C.muted,    bg: "rgba(192,80,74,0.10)",  border: "rgba(192,80,74,0.30)" },
  URGENT:   { color: "#d4843a",  bg: "rgba(212,132,58,0.10)", border: "rgba(212,132,58,0.30)" },
  MODERE:   { color: C.gold,     bg: "rgba(212,168,67,0.12)", border: "rgba(212,168,67,0.30)" },
};

const statusBadge = (status: string, paymentStatus: string) => {
  if (paymentStatus === "unpaid")
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(30,60,50,0.07)", color: C.textSoft }}>Non payé</span>;
  if (status === "pending")
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(212,168,67,0.12)", color: C.gold, border: `1px solid rgba(212,168,67,0.30)` }}>En attente</span>;
  if (status === "approved")
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(74,157,135,0.10)", color: C.primaryDark, border: `1px solid rgba(74,157,135,0.28)` }}>Approuvé</span>;
  if (status === "rejected")
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(192,80,74,0.10)", color: C.muted, border: `1px solid rgba(192,80,74,0.28)` }}>Refusé</span>;
  if (status === "completed")
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(91,143,160,0.10)", color: C.secondary, border: `1px solid rgba(91,143,160,0.28)` }}>Complété</span>;
  return <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(30,60,50,0.07)", color: C.textSoft }}>{status}</span>;
};

/* ── Component ───────────────────────────────────────────── */
const AdminDashboard = () => {
  const queryClient = useQueryClient();

  const [activeModal, setActiveModal] = useState<"bracelets" | "demandes" | null>(null);
  const [processingId, setProcessingId]         = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<Record<string, string>>({});
  const [approveSuccess, setApproveSuccess]     = useState<string | null>(null);

  /* ── KPI queries ── */
  const { data: patientsActifs } = useQuery({
    queryKey: ["stat-patients-actifs"],
    queryFn: async () => {
      const { count } = await supabase.from("patients").select("*", { count: "exact", head: true }).neq("status", "offline");
      return count ?? 0;
    },
  });

  const { data: capteursEnLigne } = useQuery({
    queryKey: ["stat-capteurs-enligne"],
    queryFn: async () => {
      const { count } = await supabase.from("devices").select("*", { count: "exact", head: true }).eq("actif", true);
      return count ?? 0;
    },
  });

  const { data: capteursHorsLigne } = useQuery({
    queryKey: ["stat-capteurs-horsligne"],
    queryFn: async () => {
      const { count } = await supabase.from("devices").select("*", { count: "exact", head: true }).eq("actif", false);
      return count ?? 0;
    },
  });

  const { data: alertes24h } = useQuery({
    queryKey: ["stat-alertes-24h"],
    queryFn: async () => {
      const since = new Date(Date.now() - 86400000).toISOString();
      const { count } = await supabase.from("alerts").select("*", { count: "exact", head: true }).gte("created_at", since);
      return count ?? 0;
    },
  });

  const { data: alertesCritiques } = useQuery({
    queryKey: ["stat-alertes-critiques"],
    queryFn: async () => {
      const since = new Date(Date.now() - 86400000).toISOString();
      const { count } = await supabase.from("alerts").select("*", { count: "exact", head: true }).gte("created_at", since).in("severity", ["CRITICAL", "CRITIQUE"]);
      return count ?? 0;
    },
  });

  const { data: recentAlerts } = useQuery({
    queryKey: ["dashboard-recent-alerts"],
    queryFn: async () => {
      const { data: alertsRaw, error } = await supabase
        .from("alerts")
        .select("id, severity, type, message, resolved, created_at, patient_id")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      if (!alertsRaw?.length) return [] as AlertLog[];

      const patientIds = [...new Set(alertsRaw.map((a: { patient_id: string }) => a.patient_id))];
      const { data: patientsRows } = await supabase.from("patients").select("id, user_id").in("id", patientIds);
      const userIds = (patientsRows || []).map((p: { user_id: string }) => p.user_id);
      const { data: utilisateurs } = await supabase.from("utilisateurs").select("id, nom, prenom").in("id", userIds);

      const patientMap: Record<string, string> = {};
      (patientsRows || []).forEach((p: { id: string; user_id: string }) => {
        const u = (utilisateurs || []).find((u: { id: string }) => u.id === p.user_id);
        if (u) patientMap[p.id] = [u.prenom, u.nom].filter(Boolean).join(" ");
      });

      return alertsRaw.map((a: AlertLog & { patient_id: string }) => ({
        ...a, patient_nom: patientMap[a.patient_id] ?? "Patient inconnu",
      })) as AlertLog[];
    },
    refetchInterval: 60000,
  });

  const { data: pendingDeviceCount } = useQuery({
    queryKey: ["pending-device-count"],
    queryFn: async () => {
      const { count } = await supabase.from("device_requests").select("*", { count: "exact", head: true }).eq("status", "pending").eq("payment_status", "paid");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const { data: pendingDemandesCount } = useQuery({
    queryKey: ["pending-demandes-count"],
    queryFn: async () => {
      const { count } = await supabase.from("demandes").select("*", { count: "exact", head: true }).eq("statut", "en_attente");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const { data: dbPing, isLoading: systemLoading } = useQuery({
    queryKey: ["system-db-ping"],
    queryFn: async () => {
      const start = Date.now();
      const { error } = await supabase.from("utilisateurs").select("id").limit(1);
      return { ok: !error, latency: `${Date.now() - start}ms` };
    },
    refetchInterval: 30000,
  });

  const { data: deviceRequests, isLoading: deviceRequestsLoading } = useQuery({
    queryKey: ["admin-device-requests"],
    enabled: activeModal === "bracelets",
    queryFn: async () => {
      const { data: requests, error } = await supabase
        .from("device_requests")
        .select("id, patient_id, status, payment_status, created_at, device_id, qr_code, notes_admin")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!requests?.length) return [] as DeviceRequest[];

      const patientIds = [...new Set(requests.map((r: { patient_id: string }) => r.patient_id))];
      const { data: patientsRows } = await supabase.from("patients").select("id, user_id").in("id", patientIds);
      const userIds = (patientsRows || []).map((p: { user_id: string }) => p.user_id);
      const { data: utilisateurs } = await supabase.from("utilisateurs").select("id, nom, prenom, email").in("id", userIds);

      return requests.map((r: DeviceRequest & { patient_id: string }) => {
        const patient = patientsRows?.find((p: { id: string }) => p.id === r.patient_id);
        const user = utilisateurs?.find((u: { id: string }) => u.id === patient?.user_id);
        return {
          ...r,
          patient_nom: user ? [user.prenom, user.nom].filter(Boolean).join(" ") : "Patient inconnu",
          patient_email: user?.email ?? "—",
        };
      }) as DeviceRequest[];
    },
    refetchInterval: 30000,
  });

  const { data: availableDevices } = useQuery({
    queryKey: ["available-devices"],
    enabled: activeModal === "bracelets",
    queryFn: async () => {
      const { data, error } = await supabase.from("devices").select("id").is("patient_id", null);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: demandesList, isLoading: demandesLoading } = useQuery({
    queryKey: ["admin-demandes"],
    enabled: activeModal === "demandes",
    queryFn: async () => {
      const { data: demandesRaw, error } = await supabase
        .from("demandes").select("id, patient_id, medecin_id, statut, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!demandesRaw?.length) return [] as DemandeAdmin[];

      const patientIds = [...new Set(demandesRaw.map((d: { patient_id: string }) => d.patient_id))];
      const medecinIds = [...new Set(demandesRaw.map((d: { medecin_id: string }) => d.medecin_id))];

      const { data: patientsRows } = await supabase.from("patients").select("id, user_id, maladies").in("id", patientIds);
      const userIds = [...new Set([...(patientsRows || []).map((p: { user_id: string }) => p.user_id), ...medecinIds])];
      const { data: utilisateursRows } = await supabase.from("utilisateurs").select("id, nom, prenom").in("id", userIds);

      return demandesRaw.map((d: DemandeAdmin & { patient_id: string; medecin_id: string }) => {
        const patientRow = patientsRows?.find((p: { id: string }) => p.id === d.patient_id);
        const patientUser = utilisateursRows?.find((u: { id: string }) => u.id === patientRow?.user_id);
        const medecinUser = utilisateursRows?.find((u: { id: string }) => u.id === d.medecin_id);
        return {
          ...d,
          patient_nom: patientUser ? [patientUser.prenom, patientUser.nom].filter(Boolean).join(" ") : "Patient inconnu",
          patient_maladies: patientRow?.maladies ?? [],
          medecin_nom: medecinUser ? [medecinUser.prenom, medecinUser.nom].filter(Boolean).join(" ") : "—",
        };
      }) as DemandeAdmin[];
    },
  });

  /* ── Handlers ── */
  const handleApprove = async (request: DeviceRequest) => {
    const deviceId = selectedDeviceId[request.id];
    if (!deviceId) { alert("Veuillez sélectionner un dispositif à assigner."); return; }
    setProcessingId(request.id);
    setApproveSuccess(null);
    try {
      const qrDataUrl = await QRCode.toDataURL(deviceId, { width: 300 });
      const { error } = await supabase.from("device_requests").update({
        status: "approved", device_id: deviceId, qr_code: qrDataUrl,
        approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", request.id);
      if (error) throw error;
      setApproveSuccess(request.id);
      queryClient.invalidateQueries({ queryKey: ["admin-device-requests"] });
      queryClient.invalidateQueries({ queryKey: ["available-devices"] });
      queryClient.invalidateQueries({ queryKey: ["pending-device-count"] });
      setTimeout(() => setApproveSuccess(null), 3000);
    } catch (e: any) {
      alert("Erreur lors de l'approbation : " + e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!confirm("Confirmer le refus de cette demande ?")) return;
    setProcessingId(requestId);
    try {
      await supabase.from("device_requests").update({
        status: "rejected", updated_at: new Date().toISOString(),
      }).eq("id", requestId);
      queryClient.invalidateQueries({ queryKey: ["admin-device-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pending-device-count"] });
    } catch (e: any) {
      alert("Erreur : " + e.message);
    } finally {
      setProcessingId(null);
    }
  };

  /* ── Render ── */
  return (
    <DashboardLayout role="admin">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        /* Force the dashboard content area to have the tinted background */
        .adm-root {
          font-family: 'DM Sans', sans-serif;
          position: relative;
          min-height: 100vh;
          /* This background is what makes backdrop-filter visible */
          background: linear-gradient(135deg, #edf7f4 0%, #e6f2f7 50%, #f0f7f5 100%);
          margin: -24px;          /* bleed over DashboardLayout padding */
          padding: 24px;
        }

        .adm-root h1, .adm-root h2, .adm-root h3,
        .adm-sora { font-family: 'Sora', sans-serif !important; }

        .adm-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Aurora orbs */
        @keyframes admAurora {
          0%,100% { transform: translate(0,0) scale(1); opacity: .55; }
          50%      { transform: translate(28px,-18px) scale(1.06); opacity: .85; }
        }
        .adm-aurora {
          position: fixed;   /* fixed so they show through regardless of scroll */
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          z-index: 0;
        }

        /* Cards */
        .adm-content { position: relative; z-index: 1; }
        .adm-card { transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s; }
        .adm-card:hover { transform: translateY(-2px); box-shadow: 0 20px 48px rgba(30,60,50,0.10) !important; }
        .adm-action-card { transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s, border-color .2s; cursor: pointer; }
        .adm-action-card:hover { transform: translateY(-3px); box-shadow: 0 22px 52px rgba(74,157,135,0.14) !important; border-color: rgba(74,157,135,0.38) !important; }
      `}</style>

      <div className="adm-root">
        {/* Aurora blobs — fixed position so they're always visible */}
        <div className="adm-aurora" style={{
          width: 500, height: 500,
          background: "rgba(74,157,135,0.18)",
          top: "5%", right: "5%",
          animation: "admAurora 22s ease-in-out infinite",
        }} />
        <div className="adm-aurora" style={{
          width: 400, height: 400,
          background: "rgba(91,143,160,0.14)",
          top: "45%", left: "0%",
          animation: "admAurora 18s ease-in-out infinite reverse",
        }} />
        <div className="adm-aurora" style={{
          width: 320, height: 320,
          background: "rgba(192,80,74,0.08)",
          bottom: "10%", right: "20%",
          animation: "admAurora 26s ease-in-out infinite 4s",
        }} />

        <div className="adm-content space-y-5 max-w-7xl">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 adm-card" style={glass}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 8px 24px rgba(74,157,135,0.35)",
                }}>
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight adm-sora" style={{ color: C.text }}>
                  Panneau d'<span className="adm-gradient-text">Administration</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>Vue d'ensemble du système</p>
              </div>
            </div>
          </motion.div>

          {/* ── System health strip ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-2xl px-5 py-3.5 flex items-center gap-3"
            style={
              dbPing?.ok !== false
                ? { background: "rgba(74,157,135,0.12)", border: "1px solid rgba(74,157,135,0.28)", borderRadius: 16 }
                : { background: "rgba(192,80,74,0.10)", border: "1px solid rgba(192,80,74,0.28)", borderRadius: 16 }
            }>
            {systemLoading
              ? <Loader className="w-4 h-4 animate-spin" style={{ color: C.textSoft }} />
              : dbPing?.ok !== false
                ? <CheckCircle2 className="w-4 h-4" style={{ color: C.primary }} />
                : <XCircle className="w-4 h-4" style={{ color: C.muted }} />}
            <p className="text-sm font-semibold adm-sora" style={{ color: dbPing?.ok !== false ? C.primaryDark : C.muted }}>
              {systemLoading
                ? "Vérification des services..."
                : dbPing?.ok !== false
                  ? `Tous les services sont opérationnels — ${dbPing.latency}`
                  : "Certains services sont dégradés"}
            </p>
          </motion.div>

          {/* ── Action cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Device requests */}
            <motion.button
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
              onClick={() => setActiveModal("bracelets")}
              className="adm-action-card text-left p-5"
              style={glass}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      boxShadow: "0 6px 18px rgba(74,157,135,0.30)",
                    }}>
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold adm-sora" style={{ color: C.text }}>Demandes de dispositifs</p>
                    <p className="text-xs" style={{ color: C.textSoft }}>Bracelets IoT en attente</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: C.textSoft }} />
              </div>
              {(pendingDeviceCount ?? 0) > 0
                ? <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: "rgba(212,168,67,0.15)", color: C.gold, border: "1px solid rgba(212,168,67,0.35)" }}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {pendingDeviceCount} demande{(pendingDeviceCount ?? 0) > 1 ? "s" : ""} en attente
                  </span>
                : <span className="text-xs" style={{ color: C.textSoft }}>Aucune demande en attente</span>
              }
            </motion.button>

            {/* Doctor requests */}
            <motion.button
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
              onClick={() => setActiveModal("demandes")}
              className="adm-action-card text-left p-5"
              style={glass}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${C.secondary}, ${C.primary})`,
                      boxShadow: "0 6px 18px rgba(91,143,160,0.30)",
                    }}>
                    <UserPlus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold adm-sora" style={{ color: C.text }}>Demandes médecin</p>
                    <p className="text-xs" style={{ color: C.textSoft }}>Associations patient → médecin</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4" style={{ color: C.textSoft }} />
              </div>
              {(pendingDemandesCount ?? 0) > 0
                ? <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: "rgba(212,168,67,0.15)", color: C.gold, border: "1px solid rgba(212,168,67,0.35)" }}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {pendingDemandesCount} demande{(pendingDemandesCount ?? 0) > 1 ? "s" : ""} en attente
                  </span>
                : <span className="text-xs" style={{ color: C.textSoft }}>Aucune demande en attente</span>
              }
            </motion.button>
          </div>

          {/* ── Recent alerts ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
            className="adm-card overflow-hidden"
            style={glass}>

            <div className="px-5 py-4 flex items-center gap-3"
              style={{ borderBottom: "1px solid rgba(74,157,135,0.12)" }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, boxShadow: "0 4px 12px rgba(74,157,135,0.25)" }}>
                <ShieldAlert className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-sm font-semibold adm-sora" style={{ color: C.text }}>Alertes récentes</h2>
              <span className="ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full"
                style={{ background: "rgba(74,157,135,0.10)", color: C.primaryDark, border: "1px solid rgba(74,157,135,0.20)" }}>
                5 dernières
              </span>
            </div>

            {!recentAlerts?.length ? (
              <div className="py-14 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, boxShadow: "0 8px 20px rgba(74,157,135,0.25)" }}>
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm font-semibold adm-sora" style={{ color: C.text }}>Aucune alerte récente</p>
              </div>
            ) : (
              recentAlerts.map((alert, i) => {
                const cfg = SEVERITY_CONFIG[alert.severity];
                return (
                  <motion.div key={alert.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="px-5 py-3.5 flex items-center gap-4 transition-colors"
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid rgba(74,157,135,0.08)",
                      borderLeft: cfg ? `3px solid ${cfg.color}` : `3px solid rgba(74,157,135,0.3)`,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(74,157,135,0.04)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
                      style={cfg
                        ? { background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }
                        : { background: "rgba(30,60,50,0.07)", color: C.textSoft }}>
                      <AlertTriangle className="w-3 h-3" />
                      {alert.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold adm-sora truncate" style={{ color: C.text }}>{alert.patient_nom}</p>
                      <p className="text-xs truncate" style={{ color: C.textSoft }}>{alert.message}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs" style={{ color: C.textSoft }}>
                        {new Date(alert.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                      {alert.resolved
                        ? <span className="text-xs flex items-center gap-0.5 font-semibold" style={{ color: C.primary }}>
                            <CheckCircle2 className="w-3 h-3" /> Résolu
                          </span>
                        : <span className="text-xs flex items-center gap-0.5 font-semibold" style={{ color: C.gold }}>
                            <AlertTriangle className="w-3 h-3" /> En cours
                          </span>
                      }
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>

        </div>{/* /adm-content */}
      </div>{/* /adm-root */}

      {/* ── MODALS ── */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{ background: "rgba(26,46,40,0.50)", backdropFilter: "blur(6px)" }}
            onClick={() => setActiveModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
              style={glassModal}
              onClick={e => e.stopPropagation()}>

              {/* Modal header */}
              <div className="px-5 py-4 flex items-center justify-between shrink-0"
                style={{ borderBottom: "1px solid rgba(74,157,135,0.14)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                      boxShadow: "0 6px 16px rgba(74,157,135,0.28)",
                    }}>
                    {activeModal === "bracelets"
                      ? <Package className="w-4 h-4 text-white" />
                      : <UserPlus className="w-4 h-4 text-white" />}
                  </div>
                  <h2 className="font-semibold adm-sora" style={{ color: C.text }}>
                    {activeModal === "bracelets" ? "Demandes de dispositifs IoT" : "Demandes médecin"}
                  </h2>
                </div>
                <button onClick={() => setActiveModal(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
                  style={{ background: "rgba(192,80,74,0.08)", color: C.muted, border: "1px solid rgba(192,80,74,0.18)" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal body */}
              <div className="overflow-y-auto flex-1">

                {/* ── BRACELETS ── */}
                {activeModal === "bracelets" && (
                  deviceRequestsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-16">
                      <Loader className="w-5 h-5 animate-spin" style={{ color: C.primary }} />
                      <span className="text-sm" style={{ color: C.textSoft }}>Chargement...</span>
                    </div>
                  ) : !deviceRequests?.length ? (
                    <div className="py-16 text-center">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                        style={{ background: "rgba(74,157,135,0.10)" }}>
                        <Package className="w-6 h-6" style={{ color: C.primary }} />
                      </div>
                      <p className="text-sm" style={{ color: C.textSoft }}>Aucune demande de dispositif.</p>
                    </div>
                  ) : (
                    deviceRequests.map((req, i) => (
                      <div key={req.id}
                        className="p-5 transition-colors"
                        style={{ borderTop: i === 0 ? "none" : "1px solid rgba(74,157,135,0.10)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(74,157,135,0.03)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold adm-sora text-sm" style={{ color: C.text }}>{req.patient_nom}</p>
                            {statusBadge(req.status, req.payment_status)}
                          </div>
                          <p className="text-xs" style={{ color: C.textSoft }}>{req.patient_email}</p>
                          <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: C.textSoft }}>
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              Paiement :&nbsp;
                              {req.payment_status === "paid"
                                ? <span className="font-semibold" style={{ color: C.primary }}>Confirmé ✅</span>
                                : <span style={{ color: C.gold }}>En attente</span>}
                            </span>
                            <span style={{ color: "rgba(30,60,50,0.25)" }}>·</span>
                            <span>{new Date(req.created_at).toLocaleDateString("fr-FR", { dateStyle: "medium" })}</span>
                          </div>
                          {req.device_id && (
                            <p className="text-xs font-mono" style={{ color: C.textSoft }}>Dispositif : {req.device_id}</p>
                          )}

                          {req.status === "pending" && req.payment_status === "paid" && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <select
                                value={selectedDeviceId[req.id] ?? ""}
                                onChange={(e) => setSelectedDeviceId(prev => ({ ...prev, [req.id]: e.target.value }))}
                                className="rounded-xl px-3 py-2 text-sm focus:outline-none min-w-[180px]"
                                style={{
                                  background: "rgba(74,157,135,0.07)",
                                  border: "1px solid rgba(74,157,135,0.22)",
                                  color: C.text,
                                  fontFamily: "'DM Sans', sans-serif",
                                }}>
                                <option value="">Choisir un dispositif...</option>
                                {(availableDevices || []).map((d: { id: string }) => (
                                  <option key={d.id} value={d.id}>{d.id.slice(0, 8)}...</option>
                                ))}
                              </select>
                              <button onClick={() => handleApprove(req)}
                                disabled={processingId === req.id || !selectedDeviceId[req.id]}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
                                style={{ background: "rgba(74,157,135,0.12)", color: C.primaryDark, border: "1px solid rgba(74,157,135,0.28)" }}>
                                {processingId === req.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                Approuver
                              </button>
                              <button onClick={() => handleReject(req.id)} disabled={processingId === req.id}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
                                style={{ background: "rgba(192,80,74,0.08)", color: C.muted, border: "1px solid rgba(192,80,74,0.22)" }}>
                                <Ban className="w-3.5 h-3.5" /> Refuser
                              </button>
                            </div>
                          )}

                          {req.status === "approved" && req.qr_code && (
                            <div className="flex items-center gap-3">
                              <img src={req.qr_code} alt="QR Code" className="w-16 h-16 rounded-xl"
                                style={{ border: "1px solid rgba(74,157,135,0.20)" }} />
                              <a href={req.qr_code} download={`qr-${req.patient_nom}.png`}
                                className="text-xs font-semibold hover:underline flex items-center gap-1"
                                style={{ color: C.primary }}>
                                Télécharger QR
                              </a>
                            </div>
                          )}

                          {approveSuccess === req.id && (
                            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.primary }}>
                              <CheckCircle2 className="w-4 h-4" /> Approuvé avec succès !
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )
                )}

                {/* ── DEMANDES ── */}
                {activeModal === "demandes" && (
                  demandesLoading ? (
                    <div className="flex items-center justify-center gap-2 py-16">
                      <Loader className="w-5 h-5 animate-spin" style={{ color: C.primary }} />
                      <span className="text-sm" style={{ color: C.textSoft }}>Chargement...</span>
                    </div>
                  ) : !demandesList?.length ? (
                    <div className="py-16 text-center">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                        style={{ background: "rgba(91,143,160,0.10)" }}>
                        <UserPlus className="w-6 h-6" style={{ color: C.secondary }} />
                      </div>
                      <p className="text-sm" style={{ color: C.textSoft }}>Aucune demande médecin.</p>
                    </div>
                  ) : (
                    demandesList.map((d, i) => (
                      <div key={d.id}
                        className="p-5 transition-colors"
                        style={{ borderTop: i === 0 ? "none" : "1px solid rgba(74,157,135,0.10)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(74,157,135,0.03)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold adm-sora text-sm" style={{ color: C.text }}>{d.patient_nom}</p>
                              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold"
                                style={
                                  d.statut === "approuvee"
                                    ? { background: "rgba(74,157,135,0.10)", color: C.primaryDark, border: "1px solid rgba(74,157,135,0.25)" }
                                    : d.statut === "refusee"
                                      ? { background: "rgba(192,80,74,0.10)", color: C.muted, border: "1px solid rgba(192,80,74,0.25)" }
                                      : { background: "rgba(212,168,67,0.12)", color: C.gold, border: "1px solid rgba(212,168,67,0.28)" }
                                }>
                                {d.statut === "en_attente" ? "En attente" : d.statut === "approuvee" ? "Approuvée" : "Refusée"}
                              </span>
                            </div>
                            <p className="text-xs" style={{ color: C.textSoft }}>Dr. {d.medecin_nom}</p>
                            {d.patient_maladies?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {d.patient_maladies.map((m, idx) => (
                                  <span key={idx} className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{ background: "rgba(74,157,135,0.10)", color: C.primaryDark }}>
                                    {m}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-xs shrink-0" style={{ color: C.textSoft }}>
                            {new Date(d.created_at).toLocaleDateString("fr-FR", { dateStyle: "medium" })}
                          </p>
                        </div>
                      </div>
                    ))
                  )
                )}

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

export default AdminDashboard;