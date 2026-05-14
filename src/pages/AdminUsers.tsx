import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, Plus, X, Loader, ShieldCheck, Stethoscope, UserRound, Heart } from "lucide-react";
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

type RoleFilter = "all" | "admin" | "medecin" | "patient" | "proche";

const roleConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  admin:   { label: "Admin",   icon: ShieldCheck,   color: "text-violet-600", bg: "bg-violet-500/10 border-violet-500/20" },
  medecin: { label: "Médecin", icon: Stethoscope,   color: "text-blue-600",   bg: "bg-blue-500/10 border-blue-500/20" },
  patient: { label: "Patient", icon: UserRound,     color: "text-emerald-600",bg: "bg-emerald-500/10 border-emerald-500/20" },
  proche:  { label: "Proche",  icon: Heart,         color: "text-rose-600",   bg: "bg-rose-500/10 border-rose-500/20" },
};

const AdminUsers = () => {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [showCreateMedecin, setShowCreateMedecin] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [createForm, setCreateForm] = useState({
    nom: "", email: "", telephone: "", specialite: "", numero_licence: "",
  });

  const queryClient = useQueryClient();

  const { data: users, isLoading: usersLoading, error: usersError } = useQuery({
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

  const roleCounts = (users || []).reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredUsers = (users || []).filter((u) => {
    const term = search.toLowerCase();
    const matchesSearch =
      u.nom.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term);
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreateMedecin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!createForm.nom.trim()) { setCreateError("Le nom est obligatoire."); return; }
    if (!emailRegex.test(createForm.email.trim())) { setCreateError("E-mail invalide."); return; }
    if (!createForm.specialite.trim() || !createForm.numero_licence.trim()) {
      setCreateError("Spécialité et numéro de licence sont obligatoires."); return;
    }
    setCreateLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { setCreateError("Session expirée."); setCreateLoading(false); return; }
      const { data, error } = await supabase.functions.invoke("create-medecin", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          email: createForm.email.trim(),
          nom: createForm.nom.trim(),
          telephone: createForm.telephone.trim() || undefined,
          specialite: createForm.specialite.trim(),
          numero_licence: createForm.numero_licence.trim(),
        },
      });
      if (error || data?.error) { setCreateError(data?.error || error?.message || "Erreur."); return; }
      setCreateSuccess("Médecin créé. Invitation envoyée par e-mail.");
      setCreateForm({ nom: "", email: "", telephone: "", specialite: "", numero_licence: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch { setCreateError("Erreur inattendue."); }
    finally { setCreateLoading(false); }
  };

  const filterButtons: { key: RoleFilter; label: string }[] = [
    { key: "all",     label: `Tous (${users?.length ?? 0})` },
    { key: "admin",   label: `Admin (${roleCounts.admin ?? 0})` },
    { key: "medecin", label: `Médecins (${roleCounts.medecin ?? 0})` },
    { key: "patient", label: `Patients (${roleCounts.patient ?? 0})` },
    { key: "proche",  label: `Proches (${roleCounts.proche ?? 0})` },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-7xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Utilisateurs</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Gestion de tous les comptes</p>
            </div>
          </div>
        </motion.div>

        {/* Role stats cards */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {(["admin", "medecin", "patient", "proche"] as const).map((role) => {
            const cfg = roleConfig[role];
            const Icon = cfg.icon;
            const count = roleCounts[role] ?? 0;
            return (
              <button
                key={role}
                onClick={() => setRoleFilter(roleFilter === role ? "all" : role)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                  roleFilter === role
                    ? `${cfg.bg} border-current ring-1 ring-inset ring-current/20`
                    : "bg-card border-border hover:bg-muted/40"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div>
                  <p className={`text-lg font-bold leading-none ${roleFilter === role ? cfg.color : "text-foreground"}`}>{count}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cfg.label}</p>
                </div>
              </button>
            );
          })}
        </motion.div>

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"
        >
          {/* Toolbar */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* Search */}
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-muted rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Role filter pills */}
                <div className="flex items-center gap-1 bg-muted rounded-xl p-1 overflow-x-auto">
                  {filterButtons.map((btn) => (
                    <button
                      key={btn.key}
                      onClick={() => setRoleFilter(btn.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                        roleFilter === btn.key
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => { setShowCreateMedecin((v) => !v); setCreateError(""); setCreateSuccess(""); }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs md:text-sm bg-primary text-primary-foreground hover:brightness-110 transition-all whitespace-nowrap flex-shrink-0"
                >
                  {showCreateMedecin ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  <span className="hidden sm:inline">{showCreateMedecin ? "Fermer" : "Ajouter un médecin"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Create form */}
          <AnimatePresence>
            {showCreateMedecin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pt-4 pb-5 border-b border-border bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Nouveau médecin</p>
                  <form onSubmit={handleCreateMedecin} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { label: "Nom complet", key: "nom", type: "text", placeholder: "Dr Prénom Nom" },
                      { label: "E-mail", key: "email", type: "email", placeholder: "medecin@clinique.dz" },
                      { label: "Téléphone", key: "telephone", type: "tel", placeholder: "+213..." },
                      { label: "Spécialité", key: "specialite", type: "text", placeholder: "Cardiologue..." },
                      { label: "Numéro de licence", key: "numero_licence", type: "text", placeholder: "Identifiant ordre" },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="block text-xs text-muted-foreground mb-1 font-medium">{f.label}</label>
                        <input
                          type={f.type}
                          value={createForm[f.key as keyof typeof createForm]}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                          placeholder={f.placeholder}
                        />
                      </div>
                    ))}
                    <div className="flex flex-col gap-2 justify-end">
                      {createError && <p className="text-xs text-destructive">{createError}</p>}
                      {createSuccess && <p className="text-xs text-green-600">{createSuccess}</p>}
                      <button
                        type="submit"
                        disabled={createLoading}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50"
                      >
                        {createLoading ? <><Loader className="w-4 h-4 animate-spin" /> Création...</> : "Créer le médecin"}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results count */}
          {!usersLoading && (
            <div className="px-4 py-2 border-b border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{filteredUsers.length}</span> utilisateur{filteredUsers.length !== 1 ? "s" : ""}
                {roleFilter !== "all" && <span> · filtrés par <span className="text-primary font-medium">{roleConfig[roleFilter]?.label}</span></span>}
                {search && <span> · recherche "<span className="text-primary">{search}</span>"</span>}
              </p>
            </div>
          )}

          {/* Error */}
          {usersError && (
            <p className="px-4 py-3 text-sm text-destructive bg-destructive/5">
              Impossible de charger les utilisateurs.
            </p>
          )}

          {/* Loading */}
          {usersLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader className="w-5 h-5 animate-spin" />
              <span className="text-sm">Chargement...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    {["Nom", "E-mail", "Rôle", "Téléphone"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredUsers.map((u, i) => {
                      const cfg = roleConfig[u.role];
                      const Icon = cfg?.icon;
                      return (
                        <motion.tr
                          key={u.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg?.bg ?? "bg-muted"}`}>
                                {Icon && <Icon className={`w-3.5 h-3.5 ${cfg?.color ?? "text-muted-foreground"}`} />}
                              </div>
                              <span className="text-sm font-medium text-card-foreground">{u.nom}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg?.bg ?? "bg-muted"} ${cfg?.color ?? "text-muted-foreground"}`}>
                              {cfg?.label ?? u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{u.telephone || "—"}</td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-16 text-center">
                        <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Aucun utilisateur trouvé.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default AdminUsers;