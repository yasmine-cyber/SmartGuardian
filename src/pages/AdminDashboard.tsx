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

/* ── Helpers ─────────────────────────────────────────────── */
const severityColor: Record<string, string> = {
  CRITICAL: "text-red-600 bg-red-500/10 border-red-500/20",
  HIGH:     "text-orange-600 bg-orange-500/10 border-orange-500/20",
  MEDIUM:   "text-amber-600 bg-amber-500/10 border-amber-500/20",
  INFO:     "text-blue-600 bg-blue-500/10 border-blue-500/20",
  // legacy French labels just in case
  CRITIQUE: "text-red-600 bg-red-500/10 border-red-500/20",
  URGENT:   "text-orange-600 bg-orange-500/10 border-orange-500/20",
  MODERE:   "text-amber-600 bg-amber-500/10 border-amber-500/20",
};

const statusBadge = (status: string, paymentStatus: string) => {
  if (paymentStatus === "unpaid")
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Non payé</span>;
  if (status === "pending")
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600">En attente</span>;
  if (status === "approved")
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600">Approuvé</span>;
  if (status === "rejected")
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600">Refusé</span>;
  if (status === "completed")
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">Complété</span>;
  return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">{status}</span>;
};

/* ── Component ───────────────────────────────────────────── */
const AdminDashboard = () => {
  const queryClient = useQueryClient();

  // Modal state
  const [activeModal, setActiveModal] = useState<"bracelets" | "demandes" | null>(null);

  // Device request state
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

  /* ── Recent alerts (5) ── */
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

  /* ── Pending device requests count ── */
  const { data: pendingDeviceCount } = useQuery({
    queryKey: ["pending-device-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("device_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("payment_status", "paid");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  /* ── Pending demandes count ── */
  const { data: pendingDemandesCount } = useQuery({
    queryKey: ["pending-demandes-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("demandes")
        .select("*", { count: "exact", head: true })
        .eq("statut", "en_attente");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  /* ── System ping ── */
  const { data: dbPing, isLoading: systemLoading } = useQuery({
    queryKey: ["system-db-ping"],
    queryFn: async () => {
      const start = Date.now();
      const { error } = await supabase.from("utilisateurs").select("id").limit(1);
      return { ok: !error, latency: `${Date.now() - start}ms` };
    },
    refetchInterval: 30000,
  });

  /* ── Device requests (modal) ── */
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

  /* ── Demandes (modal) ── */
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
      <div className="space-y-6 max-w-7xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Panneau d'Administration</h1>
          <p className="text-muted-foreground text-sm mt-1">Vue d'ensemble du système</p>
        </motion.div>

        {/* System health strip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${dbPing?.ok !== false ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
          {systemLoading
            ? <Loader className="w-4 h-4 animate-spin text-muted-foreground" />
            : dbPing?.ok !== false
              ? <CheckCircle2 className="w-4 h-4 text-green-600" />
              : <XCircle className="w-4 h-4 text-red-600" />}
          <p className={`text-sm font-medium ${dbPing?.ok !== false ? "text-green-700" : "text-red-700"}`}>
            {systemLoading
              ? "Vérification des services..."
              : dbPing?.ok !== false
                ? `Tous les services sont opérationnels (Temps de réponse : ${dbPing.latency})`
                : "Certains services sont dégradés"}
          </p>
        </motion.div>

        {/* KPIs */}

        {/* Action required — two cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Device requests */}
          <motion.button
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
            onClick={() => setActiveModal("bracelets")}
            className="bg-card border border-border rounded-2xl p-5 shadow-sm text-left hover:border-primary/40 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-card-foreground">Demandes de dispositifs</p>
                  <p className="text-xs text-muted-foreground">Bracelets IoT en attente</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            {(pendingDeviceCount ?? 0) > 0
              ? <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 text-xs font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {pendingDeviceCount} demande{(pendingDeviceCount ?? 0) > 1 ? "s" : ""} en attente
                </span>
              : <span className="text-xs text-muted-foreground"></span>
            }
          </motion.button>

          {/* Doctor requests */}
          <motion.button
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            onClick={() => setActiveModal("demandes")}
            className="bg-card border border-border rounded-2xl p-5 shadow-sm text-left hover:border-primary/40 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-card-foreground">Demandes médecin</p>
                  <p className="text-xs text-muted-foreground">Associations patient → médecin</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            {(pendingDemandesCount ?? 0) > 0
              ? <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 text-xs font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {pendingDemandesCount} demande{(pendingDemandesCount ?? 0) > 1 ? "s" : ""} en attente
                </span>
              : <span className="text-xs text-muted-foreground"></span>
            }
          </motion.button>
        </div>

        {/* Recent alerts */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}
          className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-card-foreground">Alertes récentes</h2>
            <span className="ml-auto text-xs text-muted-foreground">5 dernières</span>
          </div>
          {!recentAlerts?.length ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Aucune alerte récente.</div>
          ) : (
            <div className="divide-y divide-border">
              {recentAlerts.map((alert, i) => (
                <motion.div key={alert.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  className="px-5 py-3 flex items-center gap-4 hover:bg-muted/20 transition-colors">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${severityColor[alert.severity] ?? "bg-muted text-muted-foreground border-border"}`}>
                    <AlertTriangle className="w-3 h-3" />
                    {alert.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">{alert.patient_nom}</p>
                    <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {new Date(alert.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    {alert.resolved
                      ? <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> Résolu</span>
                      : <span className="text-xs text-amber-600 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> En cours</span>
                    }
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── MODALS ── */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setActiveModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}>

              {/* Modal header */}
              <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  {activeModal === "bracelets"
                    ? <Package className="w-5 h-5 text-primary" />
                    : <UserPlus className="w-5 h-5 text-primary" />}
                  <h2 className="font-semibold text-card-foreground">
                    {activeModal === "bracelets" ? "Demandes de dispositifs IoT" : "Demandes médecin"}
                  </h2>
                </div>
                <button onClick={() => setActiveModal(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors rounded-lg p-1 hover:bg-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="overflow-y-auto flex-1">

                {/* ── BRACELETS MODAL ── */}
                {activeModal === "bracelets" && (
                  deviceRequestsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                      <Loader className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Chargement...</span>
                    </div>
                  ) : !deviceRequests?.length ? (
                    <div className="py-16 text-center">
                      <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Aucune demande de dispositif.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {deviceRequests.map((req) => (
                        <div key={req.id} className="p-5 hover:bg-muted/20 transition-colors">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-card-foreground">{req.patient_nom}</p>
                              {statusBadge(req.status, req.payment_status)}
                            </div>
                            <p className="text-xs text-muted-foreground">{req.patient_email}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <CreditCard className="w-3 h-3" />
                                Paiement : {req.payment_status === "paid"
                                  ? <span className="text-green-600 font-medium ml-1">Confirmé ✅</span>
                                  : <span className="text-amber-600 ml-1">En attente</span>}
                              </span>
                              <span>·</span>
                              <span>{new Date(req.created_at).toLocaleDateString("fr-FR", { dateStyle: "medium" })}</span>
                            </div>
                            {req.device_id && (
                              <p className="text-xs text-muted-foreground font-mono">Dispositif : {req.device_id}</p>
                            )}

                            {req.status === "pending" && req.payment_status === "paid" && (
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <select
                                  value={selectedDeviceId[req.id] ?? ""}
                                  onChange={(e) => setSelectedDeviceId(prev => ({ ...prev, [req.id]: e.target.value }))}
                                  className="bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[180px]">
                                  <option value="">Choisir un dispositif...</option>
                                  {(availableDevices || []).map((d: { id: string }) => (
                                    <option key={d.id} value={d.id}>{d.id.slice(0, 8)}...</option>
                                  ))}
                                </select>
                                <button onClick={() => handleApprove(req)}
                                  disabled={processingId === req.id || !selectedDeviceId[req.id]}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-green-500/10 text-green-700 hover:bg-green-500/20 transition-all disabled:opacity-50">
                                  {processingId === req.id ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  Approuver
                                </button>
                                <button onClick={() => handleReject(req.id)} disabled={processingId === req.id}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-700 hover:bg-red-500/20 transition-all disabled:opacity-50">
                                  <Ban className="w-4 h-4" /> Refuser
                                </button>
                              </div>
                            )}

                            {req.status === "approved" && req.qr_code && (
                              <div className="flex items-center gap-3">
                                <img src={req.qr_code} alt="QR Code" className="w-16 h-16 rounded-lg border border-border" />
                                <a href={req.qr_code} download={`qr-${req.patient_nom}.png`}
                                  className="text-xs text-primary hover:underline flex items-center gap-1">
                                  Télécharger QR
                                </a>
                              </div>
                            )}

                            {approveSuccess === req.id && (
                              <span className="flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle2 className="w-4 h-4" /> Approuvé avec succès !
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* ── DEMANDES MODAL ── */}
                {activeModal === "demandes" && (
                  demandesLoading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                      <Loader className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Chargement...</span>
                    </div>
                  ) : !demandesList?.length ? (
                    <div className="py-16 text-center">
                      <UserPlus className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Aucune demande médecin.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {demandesList.map((d) => (
                        <div key={d.id} className="p-5 hover:bg-muted/20 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-card-foreground text-sm">{d.patient_nom}</p>
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                  d.statut === "approuvee" ? "bg-green-500/10 text-green-600"
                                  : d.statut === "refusee"  ? "bg-destructive/10 text-destructive"
                                  : "bg-amber-500/10 text-amber-600"}`}>
                                  {d.statut === "en_attente" ? "En attente" : d.statut === "approuvee" ? "Approuvée" : "Refusée"}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">Dr. {d.medecin_nom}</p>
                              {d.patient_maladies?.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {d.patient_maladies.map((m, i) => (
                                    <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{m}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground flex-shrink-0">
                              {new Date(d.created_at).toLocaleDateString("fr-FR", { dateStyle: "medium" })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
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