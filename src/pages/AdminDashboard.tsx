import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users, Cpu, Activity, Clock, Search, Wifi, WifiOff, Battery,
  CheckCircle2, XCircle, Plus, X, Loader, AlertTriangle,
  QrCode, Package, CreditCard, Check, Ban, Trash2, RefreshCw
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import QRCode from "qrcode";

type Utilisateur = {
  id: string;
  nom: string;
  email: string;
  role: "admin" | "medecin" | "patient" | "proche";
  telephone: string | null;
};

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

type Device = {
  id: string;
  actif: boolean;
  dernier_signal: string | null;
  patient_nom: string | null;
  niveau_batterie: number | null;
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

function getLastSync(dernier_signal: string | null): string {
  if (!dernier_signal) return "Jamais";
  const diff = Date.now() - new Date(dernier_signal).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `il y a ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)} jours`;
}

function getSignalBars(actif: boolean, dernier_signal: string | null): number {
  if (!actif || !dernier_signal) return 0;
  const min = (Date.now() - new Date(dernier_signal).getTime()) / 60000;
  if (min < 1) return 4;
  if (min < 5) return 3;
  if (min < 30) return 2;
  return 1;
}

const severityColor: Record<string, string> = {
  CRITIQUE: "text-red-600 bg-red-500/10",
  URGENT: "text-orange-600 bg-orange-500/10",
  MODERE: "text-amber-600 bg-amber-500/10",
  INFO: "text-blue-600 bg-blue-500/10",
};

const systemServices = [
  { label: "Base de données", description: "Supabase PostgreSQL" },
  { label: "API Supabase", description: "REST & Realtime" },
  { label: "Authentification", description: "Supabase Auth" },
  { label: "Edge Functions", description: "Deno serverless" },
];

const AdminDashboard = () => {
  const [tab, setTab] = useState<"users" | "devices" | "logs" | "system" | "demandes" | "bracelets">("users");
  const [search, setSearch] = useState("");
  const [showCreateMedecin, setShowCreateMedecin] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [createForm, setCreateForm] = useState({
    nom: "", email: "", telephone: "", specialite: "", numero_licence: "",
  });

  const [showAddDevice, setShowAddDevice] = useState(false);
  const [addDeviceLoading, setAddDeviceLoading] = useState(false);
  const [addDeviceError, setAddDeviceError] = useState("");
  const [addDeviceSuccess, setAddDeviceSuccess] = useState("");
  const [deleteDeviceLoading, setDeleteDeviceLoading] = useState<string | null>(null);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<Record<string, string>>({});
  const [approveSuccess, setApproveSuccess] = useState<string | null>(null);

  const queryClient = useQueryClient();

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
      const { count } = await supabase.from("alerts").select("*", { count: "exact", head: true }).gte("created_at", since).eq("severity", "CRITIQUE");
      return count ?? 0;
    },
  });

  const { data: demandesList, isLoading: demandesLoading } = useQuery({
    queryKey: ["admin-demandes"],
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

      return demandesRaw.map((d: { id: string; patient_id: string; medecin_id: string; statut: string; created_at: string }) => {
        const patientRow = patientsRows?.find((p: { id: string }) => p.id === d.patient_id);
        const patientUser = utilisateursRows?.find((u: { id: string }) => u.id === patientRow?.user_id);
        const medecinUser = utilisateursRows?.find((u: { id: string }) => u.id === d.medecin_id);
        return {
          id: d.id, patient_id: d.patient_id, medecin_id: d.medecin_id, statut: d.statut, created_at: d.created_at,
          patient_nom: patientUser ? [patientUser.prenom, patientUser.nom].filter(Boolean).join(" ") : "Patient inconnu",
          patient_maladies: patientRow?.maladies ?? [],
          medecin_nom: medecinUser ? [medecinUser.prenom, medecinUser.nom].filter(Boolean).join(" ") : "—",
        };
      }) as DemandeAdmin[];
    },
  });

  const { data: deviceRequests, isLoading: deviceRequestsLoading } = useQuery({
    queryKey: ["admin-device-requests"],
    enabled: tab === "bracelets",
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

      return requests.map((r: { id: string; patient_id: string; status: string; payment_status: string; created_at: string; device_id: string | null; qr_code: string | null; notes_admin: string | null }) => {
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
    enabled: tab === "bracelets",
    queryFn: async () => {
      const { data, error } = await supabase.from("devices").select("id").is("patient_id", null);
      if (error) throw error;
      return data || [];
    },
  });

  const handleAddDevice = async () => {
    setAddDeviceLoading(true);
    setAddDeviceError("");
    setAddDeviceSuccess("");
    try {
      const { data, error } = await supabase.from("devices").insert({ actif: false }).select("id").single();
      if (error) throw error;
      setAddDeviceSuccess(`✅ Dispositif ajouté : ${data.id}`);
      queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
      queryClient.invalidateQueries({ queryKey: ["available-devices"] });
      setTimeout(() => setAddDeviceSuccess(""), 5000);
    } catch (e: any) {
      setAddDeviceError("Erreur : " + e.message);
    } finally {
      setAddDeviceLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm("Supprimer ce dispositif ? Cette action est irréversible.")) return;
    setDeleteDeviceLoading(deviceId);
    try {
      const { error } = await supabase.from("devices").delete().eq("id", deviceId).is("patient_id", null);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-devices"] });
      queryClient.invalidateQueries({ queryKey: ["available-devices"] });
    } catch (e: any) {
      alert("Erreur suppression : " + e.message);
    } finally {
      setDeleteDeviceLoading(null);
    }
  };

  const handleApprove = async (request: DeviceRequest) => {
    const deviceId = selectedDeviceId[request.id];
    if (!deviceId) { alert("Veuillez sélectionner un dispositif à assigner."); return; }
    setProcessingId(request.id);
    setApproveSuccess(null);
    try {
      const qrDataUrl = await QRCode.toDataURL(deviceId, { width: 300 });
      const { error: updateError } = await supabase.from("device_requests").update({
        status: "approved", device_id: deviceId, qr_code: qrDataUrl,
        approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", request.id);
      if (updateError) throw updateError;
      setApproveSuccess(request.id);
      queryClient.invalidateQueries({ queryKey: ["admin-device-requests"] });
      queryClient.invalidateQueries({ queryKey: ["available-devices"] });
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
      await supabase.from("device_requests").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", requestId);
      queryClient.invalidateQueries({ queryKey: ["admin-device-requests"] });
    } catch (e: any) {
      alert("Erreur : " + e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const { data: users, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("utilisateurs").select("id, nom, email, role, telephone").order("nom", { ascending: true });
      if (error) throw error;
      return (data || []) as Utilisateur[];
    },
  });

  const filteredUsers = (users || []).filter((u) => {
    const term = search.toLowerCase();
    return u.nom.toLowerCase().includes(term) || u.email.toLowerCase().includes(term) || u.role.toLowerCase().includes(term);
  });

  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ["admin-devices"],
    enabled: tab === "devices",
    queryFn: async () => {
      const { data: devicesRaw, error } = await supabase.from("devices").select("id, actif, dernier_signal, patient_id").order("created_at", { ascending: false });
      if (error) throw error;
      if (!devicesRaw?.length) return [] as Device[];

      const patientIds = devicesRaw.map((d: { patient_id: string | null }) => d.patient_id).filter(Boolean) as string[];
      let patientsMap: Record<string, string> = {};

      if (patientIds.length > 0) {
        const { data: patientsRows } = await supabase.from("patients").select("id, user_id").in("id", patientIds);
        const userIds = (patientsRows || []).map((p: { user_id: string }) => p.user_id);
        if (userIds.length > 0) {
          const { data: utilisateurs } = await supabase.from("utilisateurs").select("id, nom, prenom").in("id", userIds);
          (patientsRows || []).forEach((p: { id: string; user_id: string }) => {
            const u = (utilisateurs || []).find((u: { id: string }) => u.id === p.user_id);
            if (u) patientsMap[p.id] = [u.prenom, u.nom].filter(Boolean).join(" ");
          });
        }
      }

      const deviceIds = devicesRaw.map((d: { id: string }) => d.id);
      let batteryMap: Record<string, number | null> = {};
      if (deviceIds.length > 0) {
        const { data: vitals } = await supabase.from("vital_signs").select("device_id, niveau_batterie, recorded_at").in("device_id", deviceIds).not("niveau_batterie", "is", null).order("recorded_at", { ascending: false });
        (vitals || []).forEach((v: { device_id: string; niveau_batterie: number }) => {
          if (!(v.device_id in batteryMap)) batteryMap[v.device_id] = v.niveau_batterie;
        });
      }

      return devicesRaw.map((d: { id: string; actif: boolean; dernier_signal: string | null; patient_id: string | null }) => ({
        id: d.id, actif: d.actif, dernier_signal: d.dernier_signal,
        patient_nom: d.patient_id ? (patientsMap[d.patient_id] ?? "Patient inconnu") : "Non assigné",
        niveau_batterie: batteryMap[d.id] ?? null,
      })) as Device[];
    },
    refetchInterval: 30000,
  });

  const { data: alertLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["admin-logs"],
    enabled: tab === "logs",
    queryFn: async () => {
      const { data: alertsRaw, error } = await supabase.from("alerts").select("id, severity, type, message, resolved, created_at, patient_id").order("created_at", { ascending: false }).limit(50);
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

      return alertsRaw.map((a: { id: string; severity: string; type: string; message: string; resolved: boolean; created_at: string; patient_id: string }) => ({
        ...a, patient_nom: patientMap[a.patient_id] ?? "Patient inconnu",
      })) as AlertLog[];
    },
    refetchInterval: 60000,
  });

  const { data: dbPing, isLoading: systemLoading } = useQuery({
    queryKey: ["system-db-ping"],
    enabled: tab === "system",
    queryFn: async () => {
      const start = Date.now();
      const { error } = await supabase.from("utilisateurs").select("id").limit(1);
      return { ok: !error, latency: `${Date.now() - start}ms` };
    },
    refetchInterval: 30000,
  });

  const { data: systemStats } = useQuery({
    queryKey: ["system-stats"],
    enabled: tab === "system",
    queryFn: async () => {
      const since = new Date(Date.now() - 86400000).toISOString();
      const [u, d, a, v] = await Promise.all([
        supabase.from("utilisateurs").select("*", { count: "exact", head: true }),
        supabase.from("devices").select("*", { count: "exact", head: true }),
        supabase.from("alerts").select("*", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("vital_signs").select("*", { count: "exact", head: true }).gte("recorded_at", since),
      ]);
      return { totalUsers: u.count ?? 0, totalDevices: d.count ?? 0, alertes24h: a.count ?? 0, vitals24h: v.count ?? 0 };
    },
    refetchInterval: 60000,
  });

  const handleCreateMedecin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(""); setCreateSuccess("");
    if (!createForm.nom.trim()) { setCreateError("Le nom est obligatoire."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(createForm.email.trim())) { setCreateError("E-mail invalide."); return; }
    if (!createForm.specialite.trim() || !createForm.numero_licence.trim()) { setCreateError("Spécialité et numéro de licence sont obligatoires."); return; }
    setCreateLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { setCreateError("Session expirée."); return; }
      const { data, error } = await supabase.functions.invoke("create-medecin", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { email: createForm.email.trim(), nom: createForm.nom.trim(), telephone: createForm.telephone.trim() || undefined, specialite: createForm.specialite.trim(), numero_licence: createForm.numero_licence.trim() },
      });
      if (error || data?.error) { setCreateError(data?.error || error?.message || "Erreur."); return; }
      setCreateSuccess("Médecin créé. Invitation envoyée par e-mail.");
      setCreateForm({ nom: "", email: "", telephone: "", specialite: "", numero_licence: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch { setCreateError("Erreur inattendue."); }
    finally { setCreateLoading(false); }
  };

  const statusBadge = (status: string, paymentStatus: string) => {
    if (paymentStatus === "unpaid") return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Non payé</span>;
    if (status === "pending") return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600">En attente</span>;
    if (status === "approved") return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600">Approuvé</span>;
    if (status === "rejected") return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600">Refusé</span>;
    if (status === "completed") return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">Complété</span>;
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">{status}</span>;
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Panneau d'Administration</h1>
          <p className="text-muted-foreground text-sm mt-1">Vue système & gestion</p>
        </motion.div>

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "Patients actifs", value: patientsActifs?.toString() ?? "...", sub: "statut non offline" },
            { icon: Cpu, label: "Dispositifs en ligne", value: capteursEnLigne?.toString() ?? "...", sub: `${capteursHorsLigne ?? "..."} hors ligne` },
            { icon: Activity, label: "Alertes (24h)", value: alertes24h?.toString() ?? "...", sub: `${alertesCritiques ?? "..."} critiques` },
            { icon: Clock, label: "Uptime système", value: "99.98%", sub: "30 derniers jours" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <s.icon className="w-5 h-5 text-primary mb-2" />
              <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xs text-primary mt-1">{s.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit flex-wrap">
          {([
            { key: "users",     label: "Utilisateurs" },
            { key: "bracelets", label: "Demandes de dispositifs" },
            { key: "demandes",  label: "Demandes médecin" },
            { key: "devices",   label: "Dispositifs" },
            { key: "logs",      label: "Journaux" },
            { key: "system",    label: "Système" },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t.key === "bracelets" && <Package className="w-3.5 h-3.5" />}
              {t.label}
            </button>
          ))}
        </div>

        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

          {/* ── DEMANDES DE DISPOSITIFS ── */}
          {tab === "bracelets" && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                      <Package className="w-5 h-5 text-primary" />
                      Demandes de Dispositifs IoT
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gérez les demandes de dispositifs des patients
                    </p>
                  </div>
                </div>

                {deviceRequestsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
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
                      <motion.div key={req.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="p-4 hover:bg-muted/20 transition-colors">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-card-foreground">{req.patient_nom}</p>
                              {statusBadge(req.status, req.payment_status)}
                            </div>
                            <p className="text-xs text-muted-foreground">{req.patient_email}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <CreditCard className="w-3 h-3" />
                                Paiement : {req.payment_status === "paid"
                                  ? <span className="text-green-600 font-medium">Confirmé ✅</span>
                                  : <span className="text-amber-600">En attente</span>}
                              </span>
                              <span>·</span>
                              <span>{new Date(req.created_at).toLocaleDateString("fr-FR", { dateStyle: "medium" })}</span>
                            </div>
                            {req.device_id && (
                              <p className="text-xs text-muted-foreground font-mono">Dispositif : {req.device_id}</p>
                            )}
                          </div>

                          {req.status === "pending" && req.payment_status === "paid" && (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
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
                            <div className="flex flex-col items-center gap-2">
                              <img src={req.qr_code} alt="QR Code dispositif" className="w-20 h-20 rounded-lg border border-border" />
                              <a href={req.qr_code} download={`qr-${req.patient_nom}.png`}
                                className="flex items-center gap-1 text-xs text-primary hover:underline">
                                <QrCode className="w-3 h-3" /> Télécharger QR
                              </a>
                            </div>
                          )}

                          {approveSuccess === req.id && (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="w-4 h-4" /> Approuvé !
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── UTILISATEURS ── */}
          {tab === "users" && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" placeholder="Rechercher un utilisateur..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-muted rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <button onClick={() => { setShowCreateMedecin((v) => !v); setCreateError(""); setCreateSuccess(""); }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs md:text-sm bg-primary text-primary-foreground hover:brightness-110 transition-all">
                  {showCreateMedecin ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  <span>{showCreateMedecin ? "Fermer" : "Ajouter un médecin"}</span>
                </button>
              </div>
              {showCreateMedecin && (
                <div className="px-4 pt-3 pb-4 border-b border-border bg-muted/40">
                  <form onSubmit={handleCreateMedecin} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { label: "Nom complet", key: "nom", type: "text", placeholder: "Dr Prénom Nom" },
                      { label: "E-mail", key: "email", type: "email", placeholder: "medecin@clinique.dz" },
                      { label: "Téléphone", key: "telephone", type: "tel", placeholder: "+213..." },
                      { label: "Spécialité", key: "specialite", type: "text", placeholder: "Cardiologue..." },
                      { label: "Numéro de licence", key: "numero_licence", type: "text", placeholder: "Identifiant ordre" },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="block text-xs text-muted-foreground mb-1">{f.label}</label>
                        <input type={f.type} value={createForm[f.key as keyof typeof createForm]} onChange={(e) => setCreateForm((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50" placeholder={f.placeholder} />
                      </div>
                    ))}
                    <div className="md:col-span-2 flex flex-col gap-2 items-start md:items-end">
                      {createError && <p className="text-xs text-destructive w-full">{createError}</p>}
                      {createSuccess && <p className="text-xs text-green-600 w-full">{createSuccess}</p>}
                      <button type="submit" disabled={createLoading} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50">
                        {createLoading ? <><Loader className="w-4 h-4 animate-spin" /> Création...</> : "Créer le médecin"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
              {usersError && <p className="px-4 py-3 text-sm text-destructive">Impossible de charger les utilisateurs.</p>}
              {usersLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement...</span></div>
              ) : (
                <table className="w-full">
                  <thead><tr className="border-b border-border">{["Nom", "E-mail", "Rôle", "Téléphone"].map((h) => <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-card-foreground">{u.nom}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3"><span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">{u.role}</span></td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{u.telephone || "—"}</td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && !usersError && <tr><td colSpan={4} className="px-4 py-6 text-sm text-muted-foreground text-center">Aucun utilisateur trouvé.</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── DEMANDES MÉDECIN ── */}
          {tab === "demandes" && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-card-foreground">Demandes médecin</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Demandes d'association patient → médecin</p>
              </div>
              {demandesLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement...</span></div>
              ) : !demandesList?.length ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Aucune demande.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b border-border">{["Patient", "Maladies", "Médecin", "Date", "Statut"].map((h) => <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>)}</tr></thead>
                    <tbody>
                      {demandesList.map((d) => (
                        <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-card-foreground">{d.patient_nom}</td>
                          <td className="px-4 py-3">{d.patient_maladies?.length ? <div className="flex flex-wrap gap-1">{d.patient_maladies.map((m, i) => <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{m}</span>)}</div> : <span className="text-xs text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">Dr. {d.medecin_nom}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(d.created_at).toLocaleDateString("fr-FR", { dateStyle: "medium" })}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${d.statut === "approuvee" ? "bg-green-500/10 text-green-600" : d.statut === "refusee" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"}`}>
                              {d.statut === "en_attente" ? "En attente" : d.statut === "approuvee" ? "Approuvée" : "Refusée"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── DISPOSITIFS ── */}
          {tab === "devices" && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-primary" /> Gestion des Dispositifs
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {devices?.length ?? 0} dispositif(s) enregistré(s) ·{" "}
                      {(devices || []).filter(d => d.patient_nom === "Non assigné").length} libre(s)
                    </p>
                  </div>
                  <button
                    onClick={() => { setShowAddDevice(v => !v); setAddDeviceError(""); setAddDeviceSuccess(""); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-primary text-primary-foreground hover:brightness-110 transition-all">
                    {showAddDevice ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showAddDevice ? "Fermer" : "Ajouter un dispositif"}
                  </button>
                </div>

                {showAddDevice && (
                  <div className="p-4 border-b border-border bg-muted/40">
                    <p className="text-sm text-muted-foreground mb-3">
                      Un UUID sera généré automatiquement pour identifier le dispositif dans le système.
                    </p>
                    <div className="flex items-center gap-3">
                      <button onClick={handleAddDevice} disabled={addDeviceLoading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50">
                        {addDeviceLoading
                          ? <><Loader className="w-4 h-4 animate-spin" /> Création...</>
                          : <><RefreshCw className="w-4 h-4" /> Générer un nouveau dispositif</>}
                      </button>
                      {addDeviceSuccess && <span className="text-xs text-green-600 font-mono">{addDeviceSuccess}</span>}
                      {addDeviceError && <span className="text-xs text-destructive">{addDeviceError}</span>}
                    </div>
                  </div>
                )}
              </div>

              {devicesLoading && (
                <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
                  <Loader className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Chargement des dispositifs...</span>
                </div>
              )}

              {!devicesLoading && devices?.length === 0 && (
                <div className="bg-card border border-border rounded-2xl p-12 text-center">
                  <Cpu className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Aucun dispositif enregistré.</p>
                  <p className="text-xs text-muted-foreground mt-1">Cliquez sur "Ajouter un dispositif" pour commencer.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(devices || []).map((d, i) => {
                  const signal = getSignalBars(d.actif, d.dernier_signal);
                  const isFree = d.patient_nom === "Non assigné";
                  return (
                    <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                      className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-5 h-5 text-primary" />
                          <span className="font-mono text-xs font-semibold text-card-foreground truncate max-w-[140px]">{d.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isFree
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Libre</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">Assigné</span>}
                          {d.actif
                            ? <div className="flex items-center gap-1 text-green-600 text-xs"><Wifi className="w-3 h-3" /> En ligne</div>
                            : <div className="flex items-center gap-1 text-muted-foreground text-xs"><WifiOff className="w-3 h-3" /> Hors ligne</div>}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Patient lié : <span className="text-card-foreground font-medium">{d.patient_nom}</span>
                      </p>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1 text-sm">
                          <Battery className={`w-4 h-4 ${d.niveau_batterie !== null && d.niveau_batterie < 30 ? "text-red-500" : "text-green-500"}`} />
                          <span className={d.niveau_batterie !== null && d.niveau_batterie < 30 ? "text-red-500" : "text-card-foreground"}>
                            {d.niveau_batterie !== null ? `${d.niveau_batterie}%` : "—"}
                          </span>
                        </div>
                        <div className="flex gap-0.5 items-end">
                          {[1, 2, 3, 4].map((bar) => (
                            <div key={bar} className={`w-1.5 rounded-sm ${bar <= signal ? "bg-primary" : "bg-muted"}`} style={{ height: `${bar * 4 + 4}px` }} />
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Dernière transmission : {getLastSync(d.dernier_signal)}
                        </span>
                        {isFree && (
                          <button onClick={() => handleDeleteDevice(d.id)} disabled={deleteDeviceLoading === d.id}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50">
                            {deleteDeviceLoading === d.id ? <Loader className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Supprimer
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── JOURNAUX ── */}
          {tab === "logs" && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              {logsLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader className="w-5 h-5 animate-spin" /><span className="text-sm">Chargement...</span></div>
              ) : !alertLogs?.length ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Aucune alerte enregistrée.</div>
              ) : (
                <table className="w-full">
                  <thead><tr className="border-b border-border bg-muted/30">{["Patient", "Type", "Message", "Sévérité", "Statut", "Date"].map((h) => <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody>
                    {alertLogs.map((l, i) => (
                      <motion.tr key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-card-foreground whitespace-nowrap">{l.patient_nom}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{l.type}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{l.message}</td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${severityColor[l.severity] ?? "bg-muted text-muted-foreground"}`}><AlertTriangle className="w-3 h-3" />{l.severity}</span></td>
                        <td className="px-4 py-3">
                          {l.resolved
                            ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-3 h-3" /> Résolu</span>
                            : <span className="inline-flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="w-3 h-3" /> En cours</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── SYSTÈME ── */}
          {tab === "system" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-2xl p-4 flex items-center gap-3 ${dbPing?.ok !== false ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                  {systemLoading ? <Loader className="w-5 h-5 animate-spin text-muted-foreground" /> : dbPing?.ok !== false ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                  <p className={`text-sm font-medium ${dbPing?.ok !== false ? "text-green-700" : "text-red-700"}`}>
                    {systemLoading ? "Vérification..." : dbPing?.ok !== false ? "Tous les services sont opérationnels" : "Certains services sont dégradés"}
                  </p>
                </motion.div>
              </div>
              {systemStats && (
                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Utilisateurs total", value: systemStats.totalUsers },
                    { label: "Dispositifs enregistrés", value: systemStats.totalDevices },
                    { label: "Alertes (24h)", value: systemStats.alertes24h },
                    { label: "Mesures (24h)", value: systemStats.vitals24h },
                  ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                      <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                    </motion.div>
                  ))}
                </div>
              )}
              {systemServices.map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    {dbPing?.ok !== false ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{s.label}</p>
                      <p className="text-xs text-muted-foreground">{s.description} · Latence : {dbPing?.latency ?? "..."}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${dbPing?.ok !== false ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                    {dbPing?.ok !== false ? "Opérationnel" : "Hors service"}
                  </span>
                </motion.div>
              ))}
            </div>
          )}

        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;