import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Search, Plus, X, Loader } from "lucide-react";
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

const AdminUsers = () => {
  const [search, setSearch] = useState("");
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

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Utilisateurs</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Gestion de tous les comptes</p>
            </div>
          </div>
        </motion.div>

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
              onClick={() => { setShowCreateMedecin((v) => !v); setCreateError(""); setCreateSuccess(""); }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs md:text-sm bg-primary text-primary-foreground hover:brightness-110 transition-all"
            >
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
                    <input
                      type={f.type}
                      value={createForm[f.key as keyof typeof createForm]}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                      placeholder={f.placeholder}
                    />
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
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader className="w-5 h-5 animate-spin" />
              <span className="text-sm">Chargement...</span>
            </div>
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
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-sm text-muted-foreground text-center">Aucun utilisateur trouvé.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminUsers;