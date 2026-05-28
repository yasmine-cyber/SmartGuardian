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

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  primary:     "#4a9d87",
  primaryDark: "#3d8c7a",
  secondary:   "#5b8fa0",
  text:        "#1a2e28",
  textSoft:    "rgba(30,60,50,0.62)",
  gold:        "#d4a843",
  muted:       "#c0504a",
};

const glass = {
  background: "rgba(255,255,255,0.78)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.16)",
  borderRadius: "22px",
  boxShadow: "0 12px 36px rgba(30,60,50,0.06)",
} as React.CSSProperties;

// ─── Role config using C palette ──────────────────────────────────────────────
const roleConfig: Record<string, {
  label: string; icon: React.ElementType;
  color: string; bg: string; border: string;
}> = {
  admin:   { label: "Admin",   icon: ShieldCheck, color: "#7c5cbf", bg: "rgba(124,92,191,0.10)", border: "rgba(124,92,191,0.25)" },
  medecin: { label: "Médecin", icon: Stethoscope, color: C.secondary, bg: "rgba(91,143,160,0.12)", border: "rgba(91,143,160,0.28)" },
  patient: { label: "Patient", icon: UserRound,   color: C.primary,   bg: "rgba(74,157,135,0.10)", border: "rgba(74,157,135,0.25)" },
  proche:  { label: "Proche",  icon: Heart,       color: C.muted,     bg: "rgba(192,80,74,0.10)",  border: "rgba(192,80,74,0.25)" },
};

const AdminUsers = () => {
  const [search, setSearch]                   = useState("");
  const [roleFilter, setRoleFilter]           = useState<RoleFilter>("all");
  const [showCreateMedecin, setShowCreateMedecin] = useState(false);
  const [createLoading, setCreateLoading]     = useState(false);
  const [createError, setCreateError]         = useState("");
  const [createSuccess, setCreateSuccess]     = useState("");
  const [createForm, setCreateForm]           = useState({
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .sg-page * { font-family: 'DM Sans', sans-serif; }
        .sg-page h1, .sg-page h2, .sg-page h3, .sg-sora { font-family: 'Sora', sans-serif !important; }
        .sg-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes sgAurora { 0%,100%{transform:translate(0,0) scale(1);opacity:.55} 50%{transform:translate(30px,-20px) scale(1.06);opacity:.85} }
        .sg-aurora-a { position:absolute; width:420px; height:420px; border-radius:50%; filter:blur(80px); pointer-events:none; }
        .sg-card { transition: transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s; }
        .sg-card:hover { transform: translateY(-2px); box-shadow: 0 18px 44px rgba(30,60,50,0.08); }
        .sg-input { transition: all .2s; }
        .sg-input:focus { outline: none; box-shadow: 0 0 0 3px rgba(74,157,135,0.18); }
        .sg-tr:hover { background: rgba(74,157,135,0.04); }
      `}</style>

      <div className="sg-page relative">
        {/* Aurora blobs */}
        <div className="sg-aurora-a" style={{ background: "rgba(74,157,135,0.13)", top: -100, right: -80, animation: "sgAurora 22s ease-in-out infinite" }} />
        <div className="sg-aurora-a" style={{ background: "rgba(91,143,160,0.11)", top: 340, left: -120, animation: "sgAurora 18s ease-in-out infinite reverse" }} />

        <div className="relative space-y-5 max-w-7xl">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl" style={glass}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                }}>
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight sg-sora" style={{ color: C.text }}>
                  <span className="sg-gradient-text">Utilisateurs</span>
                </h1>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>Gestion de tous les comptes</p>
              </div>
            </div>
          </motion.div>

          {/* ── Role stat cards ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["admin", "medecin", "patient", "proche"] as const).map((role) => {
              const cfg   = roleConfig[role];
              const Icon  = cfg.icon;
              const count = roleCounts[role] ?? 0;
              const active = roleFilter === role;
              return (
                <button
                  key={role}
                  onClick={() => setRoleFilter(roleFilter === role ? "all" : role)}
                  className="sg-card flex items-center gap-3 p-4 text-left"
                  style={{
                    ...glass,
                    borderLeft: `3px solid ${active ? cfg.color : "transparent"}`,
                    background: active ? cfg.bg : "rgba(255,255,255,0.78)",
                  }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                  </div>
                  <div>
                    <p className="text-lg font-bold leading-none sg-sora" style={{ color: active ? cfg.color : C.text }}>
                      {count}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>{cfg.label}</p>
                  </div>
                </button>
              );
            })}
          </motion.div>

          {/* ── Main glass card ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="overflow-hidden" style={glass}>

            {/* Toolbar */}
            <div className="p-5 space-y-3" style={{ borderBottom: "1px solid rgba(74,157,135,0.12)" }}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                {/* Search */}
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.textSoft }} />
                  <input
                    type="text"
                    placeholder="Rechercher par nom, email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="sg-input w-full pl-10 pr-10 py-2.5 text-sm rounded-xl"
                    style={{
                      background: "rgba(74,157,135,0.06)",
                      border: "1px solid rgba(74,157,135,0.18)",
                      color: C.text,
                    }}
                  />
                  {search && (
                    <button onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                      style={{ color: C.textSoft }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Role filter pills */}
                  <div className="flex items-center gap-1 p-1 rounded-xl overflow-x-auto"
                    style={{ background: "rgba(74,157,135,0.07)", border: "1px solid rgba(74,157,135,0.14)" }}>
                    {filterButtons.map((btn) => (
                      <button
                        key={btn.key}
                        onClick={() => setRoleFilter(btn.key)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
                        style={
                          roleFilter === btn.key
                            ? {
                                background: "rgba(255,255,255,0.90)",
                                color: C.text,
                                boxShadow: "0 2px 8px rgba(30,60,50,0.08)",
                              }
                            : { color: C.textSoft }
                        }
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => { setShowCreateMedecin((v) => !v); setCreateError(""); setCreateSuccess(""); }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition-all hover:scale-105 whitespace-nowrap shrink-0"
                    style={
                      showCreateMedecin
                        ? { background: "rgba(74,157,135,0.10)", color: C.primaryDark, border: "1px solid rgba(74,157,135,0.25)" }
                        : {
                            background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                            color: "#fff",
                            boxShadow: "0 6px 18px rgba(74,157,135,0.28)",
                          }
                    }
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
                  <div className="px-5 pt-5 pb-6" style={{
                    borderBottom: "1px solid rgba(74,157,135,0.12)",
                    background: "rgba(74,157,135,0.03)",
                  }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: C.textSoft }}>
                      Nouveau médecin
                    </p>
                    <form onSubmit={handleCreateMedecin} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                        { label: "Nom complet",       key: "nom",            type: "text",  placeholder: "Dr Prénom Nom" },
                        { label: "E-mail",             key: "email",          type: "email", placeholder: "medecin@clinique.dz" },
                        { label: "Téléphone",          key: "telephone",      type: "tel",   placeholder: "+213..." },
                        { label: "Spécialité",         key: "specialite",     type: "text",  placeholder: "Cardiologue..." },
                        { label: "Numéro de licence",  key: "numero_licence", type: "text",  placeholder: "Identifiant ordre" },
                      ].map((f) => (
                        <div key={f.key}>
                          <label className="block text-xs font-semibold mb-1.5" style={{ color: C.textSoft }}>
                            {f.label}
                          </label>
                          <input
                            type={f.type}
                            value={createForm[f.key as keyof typeof createForm]}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            className="sg-input w-full px-3 py-2.5 text-sm rounded-xl"
                            style={{
                              background: "rgba(255,255,255,0.85)",
                              border: "1px solid rgba(74,157,135,0.20)",
                              color: C.text,
                            }}
                          />
                        </div>
                      ))}
                      <div className="flex flex-col gap-2 justify-end">
                        {createError   && <p className="text-xs" style={{ color: C.muted }}>{createError}</p>}
                        {createSuccess && <p className="text-xs" style={{ color: C.primary }}>{createSuccess}</p>}
                        <button
                          type="submit"
                          disabled={createLoading}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
                          style={{
                            background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                            color: "#fff",
                            boxShadow: "0 6px 18px rgba(74,157,135,0.28)",
                          }}
                        >
                          {createLoading
                            ? <><Loader className="w-4 h-4 animate-spin" /> Création...</>
                            : "Créer le médecin"}
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results count bar */}
            {!usersLoading && (
              <div className="px-5 py-2.5" style={{ borderBottom: "1px solid rgba(74,157,135,0.08)", background: "rgba(74,157,135,0.02)" }}>
                <p className="text-xs" style={{ color: C.textSoft }}>
                  <span className="font-semibold" style={{ color: C.text }}>{filteredUsers.length}</span>{" "}
                  utilisateur{filteredUsers.length !== 1 ? "s" : ""}
                  {roleFilter !== "all" && (
                    <> · filtrés par{" "}
                      <span className="font-semibold" style={{ color: C.primary }}>
                        {roleConfig[roleFilter]?.label}
                      </span>
                    </>
                  )}
                  {search && (
                    <> · recherche "<span style={{ color: C.primary }}>{search}</span>"</>
                  )}
                </p>
              </div>
            )}

            {/* Error */}
            {usersError && (
              <p className="px-5 py-3 text-sm" style={{ color: C.muted, background: "rgba(192,80,74,0.05)" }}>
                Impossible de charger les utilisateurs.
              </p>
            )}

            {/* Loading */}
            {usersLoading ? (
              <div className="flex items-center justify-center gap-2 py-16">
                <Loader className="w-5 h-5 animate-spin" style={{ color: C.primary }} />
                <span className="text-sm" style={{ color: C.textSoft }}>Chargement...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(74,157,135,0.12)", background: "rgba(74,157,135,0.03)" }}>
                      {["Nom", "E-mail", "Rôle", "Téléphone"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                          style={{ color: C.textSoft }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredUsers.map((u, i) => {
                        const cfg  = roleConfig[u.role];
                        const Icon = cfg?.icon;
                        return (
                          <motion.tr
                            key={u.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: Math.min(i * 0.02, 0.3) }}
                            className="sg-tr"
                            style={{ borderBottom: "1px solid rgba(74,157,135,0.07)" }}
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                  style={{ background: cfg?.bg ?? "rgba(74,157,135,0.08)", border: `1px solid ${cfg?.border ?? "rgba(74,157,135,0.20)"}` }}>
                                  {Icon && <Icon className="w-3.5 h-3.5" style={{ color: cfg?.color }} />}
                                </div>
                                <span className="text-sm font-semibold" style={{ color: C.text }}>{u.nom}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-sm" style={{ color: C.textSoft }}>{u.email}</td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                                style={{
                                  background: cfg?.bg ?? "rgba(74,157,135,0.08)",
                                  color: cfg?.color ?? C.textSoft,
                                  border: `1px solid ${cfg?.border ?? "rgba(74,157,135,0.20)"}`,
                                }}>
                                {cfg?.label ?? u.role}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-sm font-mono" style={{ color: C.textSoft }}>
                              {u.telephone || "—"}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-16 text-center">
                          <Users className="w-8 h-8 mx-auto mb-2" style={{ color: "rgba(74,157,135,0.25)" }} />
                          <p className="text-sm" style={{ color: C.textSoft }}>Aucun utilisateur trouvé.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminUsers;