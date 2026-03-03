import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Cpu, Activity, Clock, Search, Wifi, WifiOff, Battery, CheckCircle2, XCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const users = [
  { id: 1, name: "Karim Messaoudi", email: "karim@mail.com", role: "patient", status: "active", device: "ESP32-001", lastLogin: "il y a 2 min" },
  { id: 2, name: "Dr. Isabelle Moreau", email: "i.moreau@chu.dz", role: "médecin", status: "active", device: "—", lastLogin: "il y a 15 min" },
  { id: 3, name: "Fatima Chérif", email: "fatima@mail.com", role: "aidant", status: "active", device: "—", lastLogin: "il y a 1h" },
  { id: 4, name: "Mohamed Brahimi", email: "m.brahimi@mail.com", role: "patient", status: "inactive", device: "ESP32-004", lastLogin: "il y a 3 jours" },
  { id: 5, name: "Dr. Ahmed Khalil", email: "a.khalil@chu.dz", role: "médecin", status: "active", device: "—", lastLogin: "il y a 30 min" },
];

const devices = [
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
            { icon: Users, label: "Patients actifs", value: "142", sub: "+5 cette semaine" },
            { icon: Cpu, label: "Capteurs en ligne", value: "89", sub: "3 hors ligne" },
            { icon: Activity, label: "Alertes (24h)", value: "17", sub: "2 critiques" },
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
              <div className="p-4 border-b border-border">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" placeholder="Rechercher un utilisateur..." className="w-full bg-muted rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Nom", "E-mail", "Rôle", "Statut", "Capteur lié", "Dernière connexion"].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-card-foreground">{u.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3"><span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">{u.role}</span></td>
                      <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.status === "active" ? "bg-safe/10 text-safe" : "bg-muted text-muted-foreground"}`}>{u.status === "active" ? "Actif" : "Inactif"}</span></td>
                      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{u.device}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{u.lastLogin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "devices" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {devices.map((d) => (
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
