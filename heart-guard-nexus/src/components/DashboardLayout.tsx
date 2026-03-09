import { useEffect, useState, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Activity, Bell, History, AlertTriangle, User, Settings, Users,
  BarChart3, MessageSquare, Shield, Cpu, FileText, Heart, MapPin,
  ChevronLeft, ChevronRight, LogOut, Menu, Wifi
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Role = "patient" | "doctor" | "family" | "admin";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const navItems: Record<Role, NavItem[]> = {
  patient: [
    { icon: Home, label: "Accueil", path: "/patient" },
    { icon: Activity, label: "Mes Constantes", path: "/patient/vitals" },
    { icon: Users, label: "Mes Médecins", path: "/patient/medecins" },
    { icon: Bell, label: "Alertes", path: "/patient/alerts" },
    { icon: History, label: "Historique", path: "/patient/history" },
    { icon: AlertTriangle, label: "Urgence", path: "/patient/emergency" },
    { icon: User, label: "Profil", path: "/patient/profile" },
    { icon: Settings, label: "Paramètres", path: "/patient/settings" },
  ],
  doctor: [
    { icon: Home, label: "Vue d'ensemble", path: "/doctor" },
    { icon: Users, label: "Mes Patients", path: "/doctor/patients" },
    { icon: Bell, label: "Alertes Critiques", path: "/doctor/alerts" },
    { icon: BarChart3, label: "Analyses", path: "/doctor/analytics" },
    { icon: MessageSquare, label: "Messages", path: "/doctor/messages" },
    { icon: Settings, label: "Paramètres", path: "/doctor/settings" },
  ],
  family: [
    { icon: Heart, label: "Mes Proches", path: "/family" },
    { icon: Bell, label: "Alertes", path: "/family/alerts" },
    { icon: MapPin, label: "Urgence", path: "/family/emergency" },
    { icon: Settings, label: "Paramètres", path: "/family/settings" },
  ],
  admin: [
    { icon: Home, label: "Vue système", path: "/admin" },
    { icon: Users, label: "Utilisateurs", path: "/admin/users" },
    { icon: Cpu, label: "Capteurs IoT", path: "/admin/devices" },
    { icon: Shield, label: "Rôles & Accès", path: "/admin/roles" },
    { icon: Activity, label: "Seuils d'alerte", path: "/admin/thresholds" },
    { icon: FileText, label: "Journaux", path: "/admin/logs" },
    { icon: Settings, label: "Santé système", path: "/admin/system" },
  ],
};

const roleLabels: Record<Role, string> = {
  patient: "Patient",
  doctor: "Médecin",
  family: "Aidant Familial",
  admin: "Administrateur",
};

const roleNames: Record<Role, string> = {
  patient: "Karim Messaoudi",
  doctor: "Dr. Isabelle Moreau",
  family: "Fatima Chérif",
  admin: "Admin Système",
};

interface DashboardLayoutProps {
  role: Role;
  children: ReactNode;
}

const DashboardLayout = ({ role, children }: DashboardLayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const location = useLocation();
  const items = navItems[role];

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("utilisateurs")
        .select("nom, photo_url")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        if (data.nom) setUserName(data.nom);
        if (data.photo_url) setPhotoUrl(data.photo_url);
      }
    };

    loadProfile();
  }, []);

  const displayName = userName || roleNames[role];
  const displayInitial = displayName?.charAt(0) || roleNames[role].charAt(0);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <Heart className="w-7 h-7 text-primary flex-shrink-0" />
        {!collapsed && <span className="text-lg font-bold text-sidebar-foreground tracking-tight">SmartGuardian</span>}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${isActive
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }
                ${collapsed ? "justify-center" : ""}
              `}
            >
              <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          {/* Avatar with photo support */}
          <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt="Photo de profil" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary font-semibold text-sm">{displayInitial}</span>
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground">{roleLabels[role]}</p>
            </div>
          )}
        </div>
        <Link
          to="/"
          className={`flex items-center gap-2 mt-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${collapsed ? "justify-center" : ""}`}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Déconnexion</span>}
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 relative ${
          collapsed ? "w-[72px]" : "w-64"
        }`}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-20 -right-3 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-muted-foreground hover:text-foreground z-10"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-50 lg:hidden">
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-background">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          {/* Device status */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-safe" />
            <span>Capteur actif</span>
            <span className="text-border">•</span>
            <Wifi className="w-3 h-3" />
            <span>Réseau cellulaire</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-critical" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;