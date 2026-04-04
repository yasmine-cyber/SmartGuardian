import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const roles = [
  {
    name: "Admin",
    color: "bg-red-500/10 text-red-600",
    permissions: ["Gestion utilisateurs", "Gestion capteurs", "Journaux système", "Configuration seuils", "Accès complet"],
  },
  {
    name: "Médecin",
    color: "bg-blue-500/10 text-blue-600",
    permissions: ["Voir patients assignés", "Consulter constantes", "Recevoir alertes critiques", "Messagerie patients", "Analyses et rapports"],
  },
  {
    name: "Patient",
    color: "bg-green-500/10 text-green-600",
    permissions: ["Voir ses propres constantes", "Historique personnel", "Messagerie médecin", "Gestion profil", "Alertes personnelles"],
  },
  {
    name: "Proche",
    color: "bg-amber-500/10 text-amber-600",
    permissions: ["Voir constantes du proche", "Recevoir alertes", "Lecture seule"],
  },
];

const AdminRoles = () => {
  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Rôles & Accès</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Permissions par rôle</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((role, i) => (
            <motion.div
              key={role.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card border border-border rounded-2xl p-5 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${role.color}`}>{role.name}</span>
              </div>
              <ul className="space-y-2">
                {role.permissions.map((perm) => (
                  <li key={perm} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    {perm}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminRoles;