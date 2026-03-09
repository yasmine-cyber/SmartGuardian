import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Cpu, Activity, Clock, Search, Wifi, WifiOff, Battery, CheckCircle2, XCircle, Plus, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type Utilisateur = {
  id: string;
  nom: string;
  email: string;
  role: "admin" | "medecin" | "patient" | "proche";
  telephone: string | null;
};

const devices_mock = [
  { id: "ESP32-001", patient: "Karim Messaoudi", battery: 87, signal: 3, status: "online", lastSync: "il y a 4s" },
  { id: "ESP32-002", patient: "Fatima Chérif", battery: 23, signal: 0, status: "offline", lastSync: "il y a 3 jours" },
  { id: "ESP32-003", patient: "Mohamed Brahimi", battery: 65, signal: 2, status: "online", lastSync: "il y a 1 min" },
  { id: "ESP32-004", patient: "Omar Zidane", battery: 91, signal: 4, status: "online", lastSync: "il y a 5 min" },
];

const logs = [
  { user: "Dr. Isabelle Moreau", action: "Consultation dossier Karim Messaoudi", time: "14h14", ip: "192.168.1.45" },
  { user: "Système", action: "Alerte déclenchée : FC élevée pour Mohamed Brahimi", time: "14h10", ip: "—" },
  { user: "Admin", action: "Mise à jour seuil FC à 120 BPM", time: "13h45", ip: "10.0.0.1" },
  { user: "Fatima Chérif", action: "Connexion via mobile", time: "13h30", ip: "41.100.52.8" },
];

const systemHealth = [
  { label: "API Gateway", status: true, latency: "12ms" },
  { label: "Cloud DB", status: true, latency: "3ms" },
  { label: "Passerelle Cellulaire", status: true, latency: "45ms" },
  { label: "Modèle IA v2.4", status: true, latency: "8ms" },
];

const AdminDashboard = () => {
  const [tab, setTab] = useState<"users" | "devices" | "logs" | "system">("users");
  const [search, setSearch] = useState("");
  const [showCreateMedecin, setShowCreateMedecin] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [createForm, setCreateForm] = useState({
    nom: "",
    email: "",
    telephone: "",
    specialite: "",
    numero_licence: "",
  });

  const queryClient = useQueryClient();

  // ✅ Dynamic stat: patients actifs
  const { data: patientsActifs } = useQuery({
    queryKey: ["stat-patients-actifs"],
    queryFn: async () => {
      const { count } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true })
        .neq("status", "offline");
      return count ?? 0;
    },
  });

  // ✅ Dynamic stat: capteurs en ligne
  const { data: capteursEnLigne } = useQuery({
    queryKey: ["stat-capteurs-enligne"],
    queryFn: async () => {
      const { count } = await supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .eq("actif", true);
      return count ?? 0;
    },
  });

  // ✅ Dynamic stat: capteurs hors ligne
  const { data: capteursHorsLigne } = useQuery({
    queryKey: ["stat-capteurs-horsligne"],
    queryFn: async () => {
      const { count } = await supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .eq("actif", false);
      return count ?? 0;
    },
  });

  // ✅ Dynamic stat: alertes 24h
  const { data: alertes24h } = useQuery({
    queryKey: ["stat-alertes-24h"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since);
      return count ?? 0;
    },
  });

  // ✅ Dynamic stat: alertes critiques 24h
  const { data: alertesCritiques } = useQuery({
    queryKey: ["stat-alertes-critiques"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since)
        .eq("severity", "CRITIQUE");
      return count ?? 0;
    },
  });

  const {
    data: users,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utilisateurs")
        .select("id, nom, email, role, telephone")
        .order("nom", { ascending: true });
      if (error) throw error;
      return (data || []) as Utilisateur[];
    },
  });

  const filteredUsers = (users || []).filter((u) => {
    const term = search.toLowerCase();
    return (
      u.nom.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    );
  });

  const handleCreateMedecin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!createForm.nom.trim()) {
      setCreateError("Le nom du médecin est obligatoire.");
      return;
    }
    if (!emailRegex.test(createForm.email.trim())) {
      setCreateError("Adresse e-mail invalide pour le médecin.");
      return;
    }
    if (!createForm.specialite.trim() || !createForm.numero_licence.trim()) {
      setCreateError("Spécialité et numéro de licence sont obligatoires.");
      return;
    }

    setCreateLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        setCreateError("Session expirée. Veuillez vous reconnecter.");
        setCreateLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-medecin", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          email: createForm.email.trim(),
          nom: createForm.nom.trim(),
          telephone: createForm.telephone.trim() || undefined,
          specialite: createForm.specialite.trim(),
          numero_licence: createForm.numero_licence.trim(),
        },
      });

      if (error || data?.error) {
        setCreateError(data?.error || error?.message || "Erreur lors de la création du médecin.");
        return;
      }

      setCreateSuccess("Médecin créé. Une invitation a été envoyée automatiquement par e-mail.");
      setCreateForm({ nom: "", email: "", telephone: "", specialite: "", numero_licence: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      setCreateError("Erreur inattendue lors de la création du médecin.");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Panneau d'Administration</h1>
          <p className="text-muted-foreground text-sm mt-1">Vue système & gestion</p>
        </motion.div>

        {/* ✅ Dynamic KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Users,
              label: "Patients actifs",
              value: patientsActifs?.toString() ?? "...",
              sub: "statut non offline",
            },
            {
              icon: Cpu,
              label: "Capteurs en ligne",
              value: capteursEnLigne?.toString() ?? "...",
              sub: `${capteursHorsLigne ?? "..."} hors ligne`,
            },
            {
              icon: Activity,
              label: "Alertes (24h)",
              value: alertes24h?.toString() ?? "...",
              sub: `${alertesCritiques ?? "..."} critiques`,
            },
            {
              icon: Clock,
              label: "Uptime système",
              value: "99.98%",
              sub: "30 derniers jours",
            },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <s.icon className="w-5 h-5 text-primary mb-2" />
              <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xs text-primary mt-1">{s.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
          {([
            { key: "users", label: "Utilisateurs" },
            { key: "devices", label: "Capteurs" },
            { key: "logs", label: "Journaux" },
            { key: "system", label: "Système" },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {tab === "users" && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Rechercher un utilisateur..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-muted rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <button
                  onClick={() => {
                    setShowCreateMedecin((v) => !v);
                    setCreateError("");
                    setCreateSuccess("");
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs md:text-sm bg-primary text-primary-foreground hover:brightness-110 transition-all"
                >
                  {showCreateMedecin ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  <span>{showCreateMedecin ? "Fermer" : "Ajouter un médecin"}</span>
                </button>
              </div>

              {showCreateMedecin && (
                <div className="px-4 pt-3 pb-4 border-b border-border bg-muted/40">
                  <form onSubmit={handleCreateMedecin} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Nom complet</label>
                      <input type="text" value={createForm.nom} onChange={(e) => setCreateForm((f) => ({ ...f, nom: e.target.value }))} className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50" placeholder="Dr Prénom Nom" />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">E-mail</label>
                      <input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50" placeholder="medecin@clinique.dz" />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Téléphone</label>
                      <input type="tel" value={createForm.telephone} onChange={(e) => setCreateForm((f) => ({ ...f, telephone: e.target.value }))} className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50" placeholder="+213..." />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Spécialité</label>
                      <input type="text" value={createForm.specialite} onChange={(e) => setCreateForm((f) => ({ ...f, specialite: e.target.value }))} className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50" placeholder="Cardiologue, Généraliste..." />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Numéro de licence</label>
                      <input type="text" value={createForm.numero_licence} onChange={(e) => setCreateForm((f) => ({ ...f, numero_licence: e.target.value }))} className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50" placeholder="Identifiant ordre / licence" />
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-2 items-start md:items-end">
                      {createError && <p className="text-xs text-destructive text-left w-full">{createError}</p>}
                      {createSuccess && <p className="text-xs text-safe text-left w-full">{createSuccess}</p>}
                      <button type="submit" disabled={createLoading} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50">
                        {createLoading ? "Création..." : "Créer le médecin"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {usersError && <p className="px-4 py-3 text-sm text-destructive">Impossible de charger les utilisateurs.</p>}
              {usersLoading ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">Chargement des utilisateurs...</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {["Nom", "E-mail", "Rôle", "Téléphone"].map((h) => (
                        <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-card-foreground">{u.nom}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">{u.role}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{u.telephone || "—"}</td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && !usersError && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-sm text-muted-foreground text-center">Aucun utilisateur trouvé.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "devices" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {devices_mock.map((d) => (
                <div key={d.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-primary" />
                      <span className="font-mono text-sm font-semibold text-card-foreground">{d.id}</span>
                    </div>
                    {d.status === "online" ? (
                      <div className="flex items-center gap-1 text-safe text-xs"><Wifi className="w-3 h-3" /> En ligne</div>
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground text-xs"><WifiOff className="w-3 h-3" /> Hors ligne</div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Patient lié : {d.patient}</p>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 text-sm">
                      <Battery className={`w-4 h-4 ${d.battery < 30 ? "text-critical" : "text-safe"}`} />
                      <span className={d.battery < 30 ? "text-critical" : "text-card-foreground"}>{d.battery}%</span>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4].map((bar) => (
                        <div key={bar} className={`w-1 rounded-sm ${bar <= d.signal ? "bg-primary" : "bg-muted"}`} style={{ height: `${bar * 3 + 4}px` }} />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">Dernière transmission : {d.lastSync}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "logs" && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Utilisateur", "Action", "Heure", "IP"].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-sm font-medium text-card-foreground">{l.user}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{l.action}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{l.time}</td>
                      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{l.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "system" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {systemHealth.map((s, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    {s.status ? <CheckCircle2 className="w-5 h-5 text-safe" /> : <XCircle className="w-5 h-5 text-critical" />}
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{s.label}</p>
                      <p className="text-xs text-muted-foreground">Latence : {s.latency}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${s.status ? "bg-safe/10 text-safe" : "bg-critical/10 text-critical"}`}>
                    {s.status ? "Opérationnel" : "Hors service"}
                  </span>
                </div>
              ))}

              <div className="md:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-card-foreground mb-4">Seuils d'Alerte</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: "Fréquence Cardiaque (BPM)", min: 50, max: 120, current: [50, 120] },
                    { label: "SpO2 Minimum (%)", min: 85, max: 100, current: [90, 100] },
                    { label: "Température (°C)", min: 35, max: 40, current: [36, 38] },
                  ].map((t) => (
                    <div key={t.label}>
                      <p className="text-sm text-card-foreground mb-2">{t.label}</p>
                      <div className="h-2 bg-muted rounded-full relative">
                        <div className="absolute h-full bg-primary/30 rounded-full" style={{ left: `${((t.current[0] - t.min) / (t.max - t.min)) * 100}%`, right: `${100 - ((t.current[1] - t.min) / (t.max - t.min)) * 100}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{t.current[0]}</span>
                        <span>{t.current[1]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-card-foreground mb-4">Canaux d'Alerte</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {["Application", "SMS", "Appel vocal", "E-mail"].map((channel) => (
                    <div key={channel} className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
                      <span className="text-sm text-card-foreground">{channel}</span>
                      <div className="w-8 h-5 bg-safe rounded-full relative">
                        <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-card rounded-full shadow-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;