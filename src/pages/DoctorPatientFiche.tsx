import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, MessageCircle, Heart, Thermometer, Activity,
  Battery, MapPin, AlertTriangle, Clock, User, Phone,
  Home, Stethoscope, FileText, Users, Wifi, WifiOff,
  ChevronRight, Save, Loader, CheckCircle, TrendingUp,
  Shield, Zap, Video, Calendar, X, Plus, ExternalLink, Check,
  Bell, CalendarClock, RefreshCw, FlaskConical,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import StatusBadge from "@/components/StatusBadge";
import VitalCard from "@/components/VitalCard";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format, formatDistanceToNow, startOfDay, addDays, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientFiche {
  id: string; user_id: string; nom: string; prenom: string;
  email: string; telephone: string; sexe: string | null;
  date_naissance: string; adresse: string; maladies: string[];
  antecedents: string; traitements: string[]; notes_medecin: string;
  status: string; consultation_day: number | null;
}
interface Device { id: string; actif: boolean; dernier_signal: string | null; }
interface VitalSign {
  id: string; bpm: number | null; spo2: number | null; temperature: number | null;
  niveau_batterie: number | null; chute: boolean | null; latitude: number | null;
  longitude: number | null; recorded_at: string;
}
interface Alert { id: string; severity: string; type: string; message: string; resolved: boolean; created_at: string; }
interface Anomalie { id: string; type_anomalie: string; score_confiance: number | null; detected_at: string; }
interface Proche { proche_id: string; nom: string; prenom: string; telephone: string | null; email: string | null; }
interface Consultation {
  id: string; zoom_link: string; scheduled_at: string;
  status: "planifiee" | "terminee" | "annulee"; notes: string | null; created_at: string;
}
interface Analyse {
  id: string; type: string; note_medecin: string | null;
  statut: string; file_url: string | null; file_name: string | null;
  created_at: string; submitted_at: string | null;
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const C = {
  primary:     "#4a9d87",
  primaryDark: "#3d8c7a",
  secondary:   "#5b8fa0",
  text:        "#1a2e28",
  textSoft:    "rgba(30,60,50,0.62)",
  gold:        "#d4a843",
  muted:       "#c0504a",
};

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(74,157,135,0.18)",
  borderRadius: "18px",
  boxShadow: "0 8px 32px rgba(30,60,50,0.08), 0 1px 0 rgba(255,255,255,0.9) inset",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const JOURS = [
  { label: "Dimanche", short: "Dim" },
  { label: "Lundi",    short: "Lun" },
  { label: "Mardi",    short: "Mar" },
  { label: "Mercredi", short: "Mer" },
  { label: "Jeudi",    short: "Jeu" },
  { label: "Vendredi", short: "Ven" },
  { label: "Samedi",   short: "Sam" },
];

const ANALYSE_TYPES = [
  "Bilan sanguin", "Radio thorax", "Échographie abdominale",
  "Scanner", "IRM", "Électrocardiogramme", "Analyse urine", "Autre",
];

const ANALYSES_BUCKET = "medical-analyses";

// ─── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_CFG: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: C.muted,    bg: "rgba(192,80,74,0.10)",  border: "rgba(192,80,74,0.28)"  },
  HIGH:     { color: "#d4843a",  bg: "rgba(212,132,58,0.10)", border: "rgba(212,132,58,0.28)" },
  MEDIUM:   { color: C.gold,     bg: "rgba(212,168,67,0.12)", border: "rgba(212,168,67,0.28)" },
  LOW:      { color: C.primary,  bg: "rgba(74,157,135,0.10)", border: "rgba(74,157,135,0.25)" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const age = (dob: string) => {
  if (!dob) return "—";
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
};

const batteryColor = (level: number | null) => {
  if (!level) return C.textSoft;
  if (level > 60) return "#5aaa6e";
  if (level > 30) return C.gold;
  return C.muted;
};

const getNextOccurrence = (targetDay: number): Date => {
  const today = new Date();
  const todayDay = getDay(today);
  const diff = (targetDay - todayDay + 7) % 7;
  return startOfDay(addDays(today, diff === 0 ? 0 : diff));
};

const getLastOccurrence = (targetDay: number): Date => {
  const now = new Date();
  const todayUTCDay = now.getUTCDay();
  const diff = (todayUTCDay - targetDay + 7) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
};

const toUTCDateStr = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

const isConsultationOverdue = (consultationDay: number | null, consultations: Consultation[]): boolean => {
  if (consultationDay === null) return false;
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const lastOccurrence = getLastOccurrence(consultationDay);
  if (lastOccurrence.getTime() === todayUTC.getTime()) return false;
  const nextOccurrence = new Date(lastOccurrence.getTime() + 7 * 24 * 60 * 60 * 1000);
  const hasConsult = consultations.some((c) => {
    if (c.status === "annulee") return false;
    const d = new Date(c.scheduled_at);
    const dUTC = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    return dUTC.getTime() >= lastOccurrence.getTime() && dUTC.getTime() <= nextOccurrence.getTime();
  });
  return !hasConsult;
};

const isNextOccurrencePlanned = (consultationDay: number | null, consultations: Consultation[]): boolean => {
  if (consultationDay === null) return false;
  const nextOcc = getNextOccurrence(consultationDay);
  const nextOccStr = toUTCDateStr(new Date(Date.UTC(nextOcc.getFullYear(), nextOcc.getMonth(), nextOcc.getDate())));
  return consultations.some((c) => {
    if (c.status === "annulee") return false;
    const d = new Date(c.scheduled_at);
    return toUTCDateStr(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))) === nextOccStr;
  });
};

const getBpmStatus  = (v: number | null): "safe" | "warning" | "critical" => { if (!v) return "safe"; if (v > 120 || v < 40) return "critical"; if (v > 100 || v < 50) return "warning"; return "safe"; };
const getSpo2Status = (v: number | null): "safe" | "warning" | "critical" => { if (!v) return "safe"; if (v < 90) return "critical"; if (v < 95) return "warning"; return "safe"; };
const getTempStatus = (v: number | null): "safe" | "warning" | "critical" => { if (!v) return "safe"; if (v > 39.5 || v < 35) return "critical"; if (v > 37.5) return "warning"; return "safe"; };

const extractStoragePath = (fileUrl: string): string => {
  try {
    const url = new URL(fileUrl);
    const pathname = url.pathname;
    const match = pathname.match(/\/object\/(?:public|sign)\/[^/]+\/(.+)/);
    if (match) return match[1];
  } catch {}
  return fileUrl;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Section = ({ title, icon, children, className = "", action }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  className?: string; action?: React.ReactNode;
}) => (
  <div className={`p-5 ${className}`} style={glass}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(74,157,135,0.12)" }}>
          <span style={{ color: C.primary }}>{icon}</span>
        </div>
        <h3 className="text-sm font-semibold dp-sora" style={{ color: C.text }}>{title}</h3>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const consultationStatusBadge = (status: string) => {
  if (status === "planifiee") return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "rgba(91,143,160,0.12)", color: C.secondary, border: "1px solid rgba(91,143,160,0.28)" }}>
      Planifiée
    </span>
  );
  if (status === "terminee") return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "rgba(74,157,135,0.10)", color: C.primaryDark, border: "1px solid rgba(74,157,135,0.25)" }}>
      Terminée
    </span>
  );
  if (status === "annulee") return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "rgba(192,80,74,0.10)", color: C.muted, border: "1px solid rgba(192,80,74,0.25)" }}>
      Annulée
    </span>
  );
  return null;
};

// ─── Shared input style ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.70)",
  border: "1px solid rgba(74,157,135,0.22)",
  borderRadius: "12px",
  padding: "9px 12px",
  fontSize: "13px",
  color: C.text,
  outline: "none",
  fontFamily: "'DM Sans', sans-serif",
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DoctorPatientFiche = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  const [patient, setPatient]             = useState<PatientFiche | null>(null);
  const [device, setDevice]               = useState<Device | null>(null);
  const [latestVital, setLatestVital]     = useState<VitalSign | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<VitalSign[]>([]);
  const [alerts, setAlerts]               = useState<Alert[]>([]);
  const [anomalies, setAnomalies]         = useState<Anomalie[]>([]);
  const [proches, setProches]             = useState<Proche[]>([]);
  const [notes, setNotes]                 = useState("");
  const [savingNotes, setSavingNotes]     = useState(false);
  const [notesSaved, setNotesSaved]       = useState(false);
  const [loading, setLoading]             = useState(true);

  const [consultations, setConsultations]         = useState<Consultation[]>([]);
  const [showConsultForm, setShowConsultForm]     = useState(false);
  const [consultLoading, setConsultLoading]       = useState(false);
  const [consultForm, setConsultForm]             = useState({ zoom_link: "", scheduled_at: "", notes: "" });
  const [consultationDay, setConsultationDay]     = useState<number | null>(null);
  const [savingConsultDay, setSavingConsultDay]   = useState(false);
  const [editingConsultDay, setEditingConsultDay] = useState(false);
  const [selectedDay, setSelectedDay]             = useState<number | null>(null);
  const [overdueAlertSent, setOverdueAlertSent]   = useState(false);

  const [analyses, setAnalyses]               = useState<Analyse[]>([]);
  const [showAnalyseForm, setShowAnalyseForm] = useState(false);
  const [analyseLoading, setAnalyseLoading]   = useState(false);
  const [analyseForm, setAnalyseForm]         = useState({ type: "", note_medecin: "" });
  const [openingFile, setOpeningFile]         = useState<string | null>(null);

  const [deviceId, setDeviceId]     = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const consultSectionRef = useRef<HTMLDivElement>(null);

  const openConsultForm = () => {
    setShowConsultForm(true);
    setTimeout(() => consultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const loadConsultations = async (pid: string): Promise<Consultation[]> => {
    const { data } = await supabase
      .from("consultations")
      .select("id, zoom_link, scheduled_at, status, notes, created_at")
      .eq("patient_id", pid)
      .order("scheduled_at", { ascending: false })
      .limit(10);
    const result = (data as Consultation[]) || [];
    setConsultations(result);
    return result;
  };

  const loadAnalyses = async (pid: string) => {
    const { data } = await supabase
      .from("medical_analyses")
      .select("id, type, note_medecin, statut, file_url, file_name, created_at, submitted_at")
      .eq("patient_id", pid)
      .order("created_at", { ascending: false });
    setAnalyses((data as Analyse[]) || []);
  };

  const load = useCallback(async () => {
    if (!patientId) return;
    const { data: p } = await supabase
      .from("patients")
      .select(`id, user_id, maladies, date_naissance, adresse, antecedents, traitements,
               notes_medecin, status, consultation_day,
               utilisateurs!patients_user_id_fkey(nom, prenom, email, telephone, sexe)`)
      .eq("id", patientId).single();
    if (!p) { navigate("/doctor/patients"); return; }

    const u = p.utilisateurs as any;
    const patientData: PatientFiche = {
      id: p.id, user_id: p.user_id,
      nom: u?.nom || "", prenom: u?.prenom || "",
      email: u?.email || "", telephone: u?.telephone || "",
      sexe: u?.sexe || null, date_naissance: p.date_naissance || "",
      adresse: p.adresse || "", maladies: p.maladies || [],
      antecedents: p.antecedents || "", traitements: p.traitements || [],
      notes_medecin: p.notes_medecin || "", status: p.status || "offline",
      consultation_day: p.consultation_day ?? null,
    };
    setPatient(patientData);
    setNotes(p.notes_medecin || "");
    setConsultationDay(p.consultation_day ?? null);
    setSelectedDay(p.consultation_day ?? null);

    const { data: devData } = await supabase
      .from("devices").select("id, actif, dernier_signal")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();
    setDevice(devData as Device | null);

    if (devData) {
      setDeviceId(devData.id);
      const { data: vData } = await supabase
        .from("vital_signs")
        .select("id, bpm, spo2, temperature, niveau_batterie, chute, latitude, longitude, recorded_at")
        .eq("device_id", devData.id)
        .order("recorded_at", { ascending: false })
        .limit(20);
      if (vData && vData.length > 0) {
        const reversed = [...vData].reverse();
        setVitalsHistory(reversed as VitalSign[]);
        setLatestVital(reversed[reversed.length - 1] as VitalSign);
        setLastUpdate(new Date());
      }
    }

    const { data: aData } = await supabase
      .from("alerts").select("id, severity, type, message, resolved, created_at")
      .eq("patient_id", patientId).order("created_at", { ascending: false }).limit(5);
    setAlerts((aData as Alert[]) || []);

    const { data: anData } = await supabase
      .from("anomalies").select("id, type_anomalie, score_confiance, detected_at")
      .eq("patient_id", patientId).order("detected_at", { ascending: false }).limit(5);
    setAnomalies((anData as Anomalie[]) || []);

    const { data: ppData } = await supabase
      .from("proche_patient")
      .select("proche_id, utilisateurs!proche_patient_proche_id_fkey(nom, prenom, email, telephone)")
      .eq("patient_id", p.user_id);
    setProches((ppData || []).map((pp: any) => {
      const pu = Array.isArray(pp.utilisateurs) ? pp.utilisateurs[0] : pp.utilisateurs;
      return { proche_id: pp.proche_id, nom: pu?.nom || "", prenom: pu?.prenom || "",
               telephone: pu?.telephone || null, email: pu?.email || null };
    }));

    const consults = await loadConsultations(patientId);
    await loadAnalyses(patientId);

    const cDay = p.consultation_day ?? null;
    if (cDay !== null && isConsultationOverdue(cDay, consults)) {
      await sendOverdueAlert(p.id, u?.nom, u?.prenom, cDay);
    }

    setLoading(false);
  }, [patientId, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!deviceId) return;
    const channel = supabase
      .channel(`doctor_fiche_vitals_${deviceId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "vital_signs",
        filter: `device_id=eq.${deviceId}`,
      }, (payload) => {
        const newVital = payload.new as VitalSign;
        setLatestVital(newVital);
        setLastUpdate(new Date());
        setVitalsHistory(prev => [...prev.slice(-19), newVital]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [deviceId]);

  const sendOverdueAlert = async (pid: string, nom: string, prenom: string, cDay: number) => {
    if (overdueAlertSent) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const { data: existing } = await supabase.from("notifications").select("id")
      .eq("user_id", user.id).eq("title", "Consultation en retard").gte("created_at", startOfToday).maybeSingle();
    if (existing) return;
    await supabase.from("notifications").insert({
      user_id: user.id,
      title: "Consultation en retard",
      message: `La consultation hebdomadaire du ${JOURS[cDay].label} pour ${prenom} ${nom} n'a pas encore été planifiée.`,
      read: false,
    });
    setOverdueAlertSent(true);
    toast.warning(`⚠️ Consultation du ${JOURS[cDay].label} non planifiée pour ${prenom} ${nom}`);
  };

  const handleSaveConsultationDay = async () => {
    if (!patient || selectedDay === null) return;
    setSavingConsultDay(true);
    const { error } = await supabase.from("patients")
      .update({ consultation_day: selectedDay, updated_at: new Date().toISOString() }).eq("id", patient.id);
    if (!error) {
      setConsultationDay(selectedDay);
      setEditingConsultDay(false);
      toast.success(`Jour de consultation défini : ${JOURS[selectedDay].label}`);
      await supabase.from("notifications").insert({
        user_id: patient.user_id,
        title: "Planning de consultations mis à jour",
        message: `Votre médecin a défini le ${JOURS[selectedDay].label} comme votre jour de consultation hebdomadaire.`,
        read: false,
      });
    } else { toast.error("Erreur lors de la sauvegarde"); }
    setSavingConsultDay(false);
  };

  const handlePlanifierConsultation = async () => {
    if (!patient || !consultForm.zoom_link || !consultForm.scheduled_at) { toast.error("Lien Zoom et date/heure sont obligatoires."); return; }
    if (!consultForm.zoom_link.startsWith("http")) { toast.error("Le lien Zoom doit commencer par http:// ou https://"); return; }
    setConsultLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("consultations").insert({
        patient_id: patient.id, medecin_id: user.id,
        zoom_link: consultForm.zoom_link.trim(),
        scheduled_at: new Date(consultForm.scheduled_at).toISOString(),
        notes: consultForm.notes.trim() || null, status: "planifiee",
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: patient.user_id, title: "Consultation planifiée",
        message: `Votre médecin a planifié une consultation vidéo le ${format(new Date(consultForm.scheduled_at), "dd MMMM yyyy à HH:mm", { locale: fr })}.`,
        read: false,
      });
      toast.success("Consultation planifiée et patient notifié !");
      setConsultForm({ zoom_link: "", scheduled_at: "", notes: "" });
      setShowConsultForm(false);
      await loadConsultations(patient.id);
    } catch (err: any) { toast.error("Erreur : " + err.message); }
    finally { setConsultLoading(false); }
  };

  const handleTerminerConsultation = async (id: string) => {
    const { error } = await supabase.from("consultations")
      .update({ status: "terminee", updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) { toast.success("Consultation marquée comme terminée."); if (patient) await loadConsultations(patient.id); }
  };

  const handleAnnulerConsultation = async (id: string) => {
    if (!confirm("Confirmer l'annulation ?")) return;
    const { error } = await supabase.from("consultations")
      .update({ status: "annulee", updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) { toast.success("Consultation annulée."); if (patient) await loadConsultations(patient.id); }
  };

  const handleDemanderAnalyse = async () => {
    if (!patient || !analyseForm.type) { toast.error("Veuillez choisir un type d'analyse"); return; }
    setAnalyseLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("medical_analyses").insert({
        patient_id: patient.id, medecin_id: user.id,
        type: analyseForm.type,
        note_medecin: analyseForm.note_medecin.trim() || null,
        statut: "demandee",
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: patient.user_id,
        title: "Nouvelle demande d'analyse",
        message: `Votre médecin vous demande de soumettre : ${analyseForm.type}.`,
        read: false,
      });
      toast.success("Demande d'analyse envoyée au patient !");
      setAnalyseForm({ type: "", note_medecin: "" });
      setShowAnalyseForm(false);
      await loadAnalyses(patient.id);
    } catch (err: any) { toast.error("Erreur : " + err.message); }
    finally { setAnalyseLoading(false); }
  };

  const handleMarquerVue = async (analyseId: string) => {
    const { error } = await supabase.from("medical_analyses")
      .update({ statut: "vue", viewed_at: new Date().toISOString() }).eq("id", analyseId);
    if (!error && patient) { await loadAnalyses(patient.id); toast.success("Analyse marquée comme consultée."); }
  };

  const handleOpenAnalyse = async (analyseId: string, fileUrl: string, fileName: string) => {
    setOpeningFile(analyseId);
    try {
      const path = extractStoragePath(fileUrl);
      const { data, error } = await supabase.storage.from(ANALYSES_BUCKET).createSignedUrl(path, 60 * 60);
      if (error || !data?.signedUrl) { toast.error("Impossible d'ouvrir le fichier."); return; }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) { toast.error("Erreur lors de l'ouverture du fichier"); }
    finally { setOpeningFile(null); }
  };

  const handleSaveNotes = async () => {
    if (!patient) return;
    setSavingNotes(true);
    const { error } = await supabase.from("patients")
      .update({ notes_medecin: notes, updated_at: new Date().toISOString() }).eq("id", patient.id);
    if (!error) { setNotesSaved(true); setTimeout(() => setNotesSaved(false), 3000); }
    else toast.error("Erreur lors de la sauvegarde");
    setSavingNotes(false);
  };

  const handleStartConversation = async () => {
    if (!patient) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: existing } = await supabase.from("conversations").select("id")
      .eq("patient_id", patient.id).eq("medecin_id", user.id).maybeSingle();
    let convId = (existing as any)?.id;
    if (!convId) {
      const { data: ins } = await supabase.from("conversations")
        .insert({ patient_id: patient.id, medecin_id: user.id }).select("id").single();
      convId = (ins as any)?.id;
    }
    if (convId) navigate(`/doctor/messages?conversation=${convId}`);
  };

  const handleMessageProche = async (procheId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: existing } = await supabase.from("family_conversations").select("id")
      .eq("proche_id", procheId).eq("medecin_id", user.id).maybeSingle();
    let convId = (existing as any)?.id;
    if (!convId) {
      const { data: ins } = await supabase.from("family_conversations")
        .insert({ proche_id: procheId, medecin_id: user.id }).select("id").single();
      convId = (ins as any)?.id;
    }
    if (convId) navigate(`/doctor/messages?tab=proches&conversation=${convId}`);
  };

  const chartData = vitalsHistory.map(v => ({
    time: new Date(v.recorded_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    BPM: v.bpm, SpO2: v.spo2, Température: v.temperature,
  }));

  const overdue               = isConsultationOverdue(consultationDay, consultations);
  const nextOccurrencePlanned = isNextOccurrencePlanned(consultationDay, consultations);
  const nextOccurrence        = consultationDay !== null ? getNextOccurrence(consultationDay) : null;
  const isToday               = nextOccurrence ? nextOccurrence.toDateString() === new Date().toDateString() : false;
  const newSubmissions        = analyses.filter(a => a.statut === "soumise").length;
  const formatTime = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const isOnline = device?.actif && device?.dernier_signal
    ? Date.now() - new Date(device.dernier_signal).getTime() < 5 * 60 * 1000 : false;

  if (loading) return (
    <DashboardLayout role="doctor">
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 animate-spin" style={{ color: C.primary }} />
      </div>
    </DashboardLayout>
  );
  if (!patient) return null;

  const initials = `${patient.prenom?.[0] || ""}${patient.nom?.[0] || ""}`.toUpperCase() || "?";
  const fullName = [patient.prenom, patient.nom].filter(Boolean).join(" ") || "—";

  return (
    <DashboardLayout role="doctor">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .dp-root {
          font-family: 'DM Sans', sans-serif;
          position: relative;
          min-height: 100vh;
          background: linear-gradient(135deg, #edf7f4 0%, #e6f2f7 50%, #f0f7f5 100%);
          margin: -24px;
          padding: 24px;
        }
        .dp-root h1, .dp-root h2, .dp-root h3, .dp-sora { font-family: 'Sora', sans-serif !important; }
        .dp-gradient-text {
          background: linear-gradient(120deg, #3d8c7a 0%, #4a9d87 55%, #5b8fa0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @keyframes dpAurora {
          0%,100% { transform: translate(0,0) scale(1); opacity:.50; }
          50%      { transform: translate(24px,-16px) scale(1.05); opacity:.80; }
        }
        .dp-aurora { position:fixed; border-radius:50%; filter:blur(90px); pointer-events:none; z-index:0; }
        .dp-content { position:relative; z-index:1; }
        .dp-input {
          width:100%; background:rgba(255,255,255,0.70); border:1px solid rgba(74,157,135,0.22);
          border-radius:12px; padding:9px 12px; font-size:13px; color:#1a2e28;
          outline:none; transition:border .2s, box-shadow .2s; font-family:'DM Sans',sans-serif;
        }
        .dp-input:focus { border-color:rgba(74,157,135,0.50); box-shadow:0 0 0 3px rgba(74,157,135,0.10); }
        .dp-btn-primary {
          display:inline-flex; align-items:center; gap:6px;
          background:linear-gradient(135deg,#4a9d87,#5b8fa0);
          color:#fff; border:none; border-radius:12px; padding:8px 16px;
          font-size:13px; font-weight:600; cursor:pointer;
          transition:transform .2s, box-shadow .2s; font-family:'DM Sans',sans-serif;
          box-shadow: 0 4px 14px rgba(74,157,135,0.28);
        }
        .dp-btn-primary:hover:not(:disabled) { transform:scale(1.02); box-shadow:0 6px 20px rgba(74,157,135,0.35); }
        .dp-btn-primary:disabled { opacity:.50; cursor:not-allowed; }
        .dp-btn-ghost {
          display:inline-flex; align-items:center; gap:5px;
          background:rgba(74,157,135,0.08); color:#3d8c7a;
          border:1px solid rgba(74,157,135,0.22); border-radius:10px;
          padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer;
          transition:all .18s; font-family:'DM Sans',sans-serif;
        }
        .dp-btn-ghost:hover { background:rgba(74,157,135,0.14); transform:scale(1.02); }
        .dp-btn-danger {
          display:inline-flex; align-items:center; gap:5px;
          background:rgba(192,80,74,0.08); color:#c0504a;
          border:1px solid rgba(192,80,74,0.22); border-radius:10px;
          padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; transition:all .18s;
          font-family:'DM Sans',sans-serif;
        }
        .dp-btn-danger:hover { background:rgba(192,80,74,0.14); }
        .dp-chart-tooltip { background:rgba(255,255,255,0.95)!important; border:1px solid rgba(74,157,135,0.20)!important; border-radius:10px!important; font-size:12px!important; }
      `}</style>

      <div className="dp-root">
        {/* Aurora orbs */}
        <div className="dp-aurora" style={{ width:460, height:460, background:"rgba(74,157,135,0.14)", top:"2%",  right:"2%",  animation:"dpAurora 22s ease-in-out infinite" }} />
        <div className="dp-aurora" style={{ width:360, height:360, background:"rgba(91,143,160,0.11)", top:"55%", left:"0%",   animation:"dpAurora 18s ease-in-out infinite reverse" }} />
        <div className="dp-aurora" style={{ width:280, height:280, background:"rgba(212,168,67,0.07)", bottom:"5%",right:"20%", animation:"dpAurora 28s ease-in-out infinite 5s" }} />

        <div className="dp-content max-w-7xl space-y-5">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <button onClick={() => navigate("/doctor/patients")}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
              style={{ color: C.textSoft }}>
              <ArrowLeft className="w-4 h-4" /> Retour aux patients
            </button>

            <div className="p-6" style={glass}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl dp-sora"
                      style={{
                        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                        boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                      }}>
                      {initials}
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white"
                      style={{ background: isOnline ? "#5aaa6e" : "rgba(30,60,50,0.25)" }} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold dp-sora" style={{ color: C.text }}>{fullName}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {patient.date_naissance && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(74,157,135,0.08)", color: C.textSoft }}>
                          {age(patient.date_naissance)} ans
                        </span>
                      )}
                      {patient.sexe && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(74,157,135,0.08)", color: C.textSoft }}>
                          {patient.sexe}
                        </span>
                      )}
                      {patient.maladies?.[0] && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: "rgba(74,157,135,0.10)", color: C.primary, border: "1px solid rgba(74,157,135,0.22)" }}>
                          {patient.maladies[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleStartConversation} className="dp-btn-primary">
                    <MessageCircle className="w-4 h-4" /> Envoyer un message
                  </button>
                  <StatusBadge status={patient.status as any} size="md" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Consultation banners ── */}
          {consultationDay !== null && (() => {
            if (overdue) return (
              <motion.div key="overdue" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
                style={{ background: "rgba(192,80,74,0.10)", border: "1px solid rgba(192,80,74,0.30)" }}>
                <Bell className="w-5 h-5 shrink-0 animate-pulse" style={{ color: C.muted }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold dp-sora" style={{ color: C.muted }}>Consultation en retard !</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(192,80,74,0.80)" }}>
                    La consultation du <strong>{JOURS[consultationDay].label}</strong> de cette semaine n'a pas encore été planifiée.
                  </p>
                </div>
                <button onClick={openConsultForm} className="dp-btn-danger shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Planifier maintenant
                </button>
              </motion.div>
            );
            if (nextOccurrencePlanned && nextOccurrence) return (
              <motion.div key="planned" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
                style={{ background: "rgba(74,157,135,0.10)", border: "1px solid rgba(74,157,135,0.28)" }}>
                <CheckCircle className="w-5 h-5 shrink-0" style={{ color: C.primary }} />
                <div>
                  <p className="text-sm font-semibold dp-sora" style={{ color: C.primaryDark }}>Consultation planifiée ✓</p>
                  <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>
                    Le <strong>{JOURS[consultationDay].label}</strong> {isToday ? "aujourd'hui" : format(nextOccurrence, "dd MMMM yyyy", { locale: fr })}
                  </p>
                </div>
              </motion.div>
            );
            if (nextOccurrence) return (
              <motion.div key="upcoming" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
                style={isToday
                  ? { background: "rgba(212,132,58,0.10)", border: "1px solid rgba(212,132,58,0.28)" }
                  : { background: "rgba(91,143,160,0.10)", border: "1px solid rgba(91,143,160,0.28)" }}>
                <CalendarClock className="w-5 h-5 shrink-0" style={{ color: isToday ? "#d4843a" : C.secondary }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold dp-sora" style={{ color: isToday ? "#d4843a" : C.secondary }}>
                    {isToday ? "Consultation prévue aujourd'hui !" : "Prochaine consultation à planifier"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>
                    Le <strong>{JOURS[consultationDay].label}</strong> {isToday ? "— n'oubliez pas de planifier la séance." : `— ${format(nextOccurrence, "dd MMMM yyyy", { locale: fr })}`}
                  </p>
                </div>
                <button onClick={openConsultForm} className="dp-btn-ghost shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Planifier
                </button>
              </motion.div>
            );
            return null;
          })()}

          {/* ── Main grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-4">

              {/* Infos personnelles */}
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
                <Section title="Informations personnelles" icon={<User className="w-3.5 h-3.5" />}>
                  <div className="space-y-2.5 text-sm">
                    {patient.telephone && (
                      <div className="flex items-center gap-2.5">
                        <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: C.primary }} />
                        <span style={{ color: C.text }}>{patient.telephone}</span>
                      </div>
                    )}
                    {patient.email && (
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: C.primary }} />
                        <span className="truncate" style={{ color: C.text }}>{patient.email}</span>
                      </div>
                    )}
                    {patient.adresse && (
                      <div className="flex items-start gap-2.5">
                        <Home className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: C.primary }} />
                        <span style={{ color: C.text }}>{patient.adresse}</span>
                      </div>
                    )}
                    {patient.date_naissance && (
                      <div className="flex items-center gap-2.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: C.primary }} />
                        <span style={{ color: C.text }}>{format(new Date(patient.date_naissance), "dd MMMM yyyy", { locale: fr })}</span>
                      </div>
                    )}
                  </div>
                </Section>
              </motion.div>

              {/* Dossier médical */}
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.10 }}>
                <Section title="Dossier médical" icon={<Stethoscope className="w-3.5 h-3.5" />}>
                  <div className="space-y-3 text-sm">
                    {patient.maladies?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: C.textSoft }}>Maladies</p>
                        <div className="flex flex-wrap gap-1">
                          {patient.maladies.map((m, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background: "rgba(74,157,135,0.10)", color: C.primary, border: "1px solid rgba(74,157,135,0.22)" }}>
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {patient.antecedents && (
                      <div>
                        <p className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: C.textSoft }}>Antécédents</p>
                        <p className="text-xs leading-relaxed" style={{ color: C.text }}>{patient.antecedents}</p>
                      </div>
                    )}
                    {patient.traitements?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: C.textSoft }}>Traitements</p>
                        <div className="flex flex-wrap gap-1">
                          {patient.traitements.map((t, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(30,60,50,0.06)", color: C.textSoft, border: "1px solid rgba(30,60,50,0.10)" }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {!patient.maladies?.length && !patient.antecedents && !patient.traitements?.length && (
                      <p className="text-xs" style={{ color: C.textSoft }}>Aucune information renseignée</p>
                    )}
                  </div>
                </Section>
              </motion.div>

              {/* Proches */}
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                <Section title={`Proches (${proches.length})`} icon={<Users className="w-3.5 h-3.5" />}>
                  {proches.length === 0
                    ? <p className="text-xs" style={{ color: C.textSoft }}>Aucun proche lié</p>
                    : (
                      <div className="space-y-2">
                        {proches.map((p) => (
                          <div key={p.proche_id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl"
                            style={{ background: "rgba(74,157,135,0.05)", border: "1px solid rgba(74,157,135,0.12)" }}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold dp-sora shrink-0"
                                style={{ background: `linear-gradient(135deg, ${C.secondary}, ${C.primary})`, color: "#fff" }}>
                                {`${p.prenom?.[0] || ""}${p.nom?.[0] || ""}`.toUpperCase() || "?"}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold dp-sora truncate" style={{ color: C.text }}>
                                  {[p.prenom, p.nom].filter(Boolean).join(" ") || "—"}
                                </p>
                                {p.telephone && <p className="text-[10px]" style={{ color: C.textSoft }}>{p.telephone}</p>}
                              </div>
                            </div>
                            <button onClick={() => handleMessageProche(p.proche_id)}
                              className="p-1.5 rounded-lg transition-colors hover:scale-110"
                              style={{ color: C.primary }}>
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                </Section>
              </motion.div>

              {/* Analyses médicales */}
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.17 }}>
                <Section
                  title={`Analyses médicales${newSubmissions > 0 ? ` · ${newSubmissions} résultat(s)` : ""}`}
                  icon={<FlaskConical className="w-3.5 h-3.5" />}
                  action={
                    <button onClick={() => setShowAnalyseForm(v => !v)} className="dp-btn-primary" style={{ padding: "5px 10px", fontSize: "11px" }}>
                      {showAnalyseForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {showAnalyseForm ? "Annuler" : "Demander"}
                    </button>
                  }
                >
                  {showAnalyseForm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="mb-4 p-4 rounded-2xl space-y-3"
                      style={{ background: "rgba(74,157,135,0.05)", border: "1px solid rgba(74,157,135,0.14)" }}>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: C.textSoft }}>Type d'analyse *</label>
                        <select value={analyseForm.type}
                          onChange={(e) => setAnalyseForm(p => ({ ...p, type: e.target.value }))}
                          className="dp-input">
                          <option value="">Choisir...</option>
                          {ANALYSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: C.textSoft }}>Instructions (optionnel)</label>
                        <textarea
                          placeholder="Ex : À jeun depuis 12h, apporter les résultats précédents..."
                          value={analyseForm.note_medecin}
                          onChange={(e) => setAnalyseForm(p => ({ ...p, note_medecin: e.target.value }))}
                          rows={3} className="dp-input" style={{ resize: "none" }} />
                      </div>
                      <button onClick={handleDemanderAnalyse} disabled={analyseLoading || !analyseForm.type}
                        className="dp-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                        {analyseLoading
                          ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Envoi...</>
                          : <><FlaskConical className="w-3.5 h-3.5" /> Envoyer la demande</>}
                      </button>
                    </motion.div>
                  )}

                  {analyses.length === 0 ? (
                    <p className="text-xs" style={{ color: C.textSoft }}>Aucune analyse demandée.</p>
                  ) : (
                    <div className="space-y-2">
                      {analyses.map((a) => (
                        <div key={a.id} className="p-3 rounded-2xl space-y-2"
                          style={a.statut === "soumise"
                            ? { background: "rgba(91,143,160,0.08)", border: "1px solid rgba(91,143,160,0.25)" }
                            : { background: "rgba(74,157,135,0.04)", border: "1px solid rgba(74,157,135,0.14)" }}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold dp-sora" style={{ color: C.text }}>{a.type}</p>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={
                                a.statut === "demandee" ? { background: "rgba(212,168,67,0.12)", color: C.gold, border: "1px solid rgba(212,168,67,0.28)" } :
                                a.statut === "soumise"  ? { background: "rgba(91,143,160,0.12)", color: C.secondary, border: "1px solid rgba(91,143,160,0.28)" } :
                                                          { background: "rgba(74,157,135,0.10)", color: C.primaryDark, border: "1px solid rgba(74,157,135,0.25)" }
                              }>
                              {a.statut === "demandee" ? "En attente" : a.statut === "soumise" ? "Résultat reçu" : "Consultée"}
                            </span>
                          </div>
                          {a.note_medecin && <p className="text-[11px] italic leading-relaxed" style={{ color: C.textSoft }}>{a.note_medecin}</p>}
                          <p className="text-[10px]" style={{ color: C.textSoft }}>
                            {format(new Date(a.created_at), "dd MMM yyyy", { locale: fr })}
                            {a.submitted_at && ` · Soumis ${formatDistanceToNow(new Date(a.submitted_at), { addSuffix: true, locale: fr })}`}
                          </p>
                          {a.statut === "soumise" && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {a.file_url && (
                                <button onClick={() => handleOpenAnalyse(a.id, a.file_url!, a.file_name || "document")}
                                  disabled={openingFile === a.id}
                                  className="flex items-center gap-1 text-xs font-medium hover:underline disabled:opacity-60"
                                  style={{ color: C.secondary }}>
                                  {openingFile === a.id ? <Loader className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                                  {a.file_name || "Voir le document"}
                                </button>
                              )}
                              <button onClick={() => handleMarquerVue(a.id)} className="dp-btn-ghost" style={{ fontSize: "11px", padding: "4px 10px" }}>
                                <CheckCircle className="w-3 h-3" /> Marquer comme vue
                              </button>
                            </div>
                          )}
                          {a.statut === "vue" && a.file_url && (
                            <button onClick={() => handleOpenAnalyse(a.id, a.file_url!, a.file_name || "document")}
                              disabled={openingFile === a.id}
                              className="flex items-center gap-1 text-xs transition-colors disabled:opacity-60"
                              style={{ color: C.textSoft }}>
                              {openingFile === a.id ? <Loader className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                              {a.file_name || "Voir le document"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </motion.div>

              {/* Consultation hebdomadaire */}
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 }}>
                <Section title="Consultation hebdomadaire" icon={<RefreshCw className="w-3.5 h-3.5" />}
                  action={
                    <button onClick={() => { setEditingConsultDay(v => !v); setSelectedDay(consultationDay); }}
                      className="dp-btn-ghost" style={{ fontSize: "11px", padding: "4px 10px" }}>
                      {editingConsultDay ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {editingConsultDay ? "Annuler" : (consultationDay !== null ? "Modifier" : "Définir")}
                    </button>
                  }
                >
                  {!editingConsultDay && (
                    consultationDay !== null ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5 p-3 rounded-xl"
                          style={{ background: "rgba(74,157,135,0.07)", border: "1px solid rgba(74,157,135,0.18)" }}>
                          <Calendar className="w-4 h-4 shrink-0" style={{ color: C.primary }} />
                          <div>
                            <p className="text-sm font-semibold dp-sora" style={{ color: C.text }}>
                              Chaque <span style={{ color: C.primary }}>{JOURS[consultationDay].label}</span>
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: C.textSoft }}>
                              Prochain : {nextOccurrence ? (isToday ? "Aujourd'hui" : format(nextOccurrence, "dd MMMM yyyy", { locale: fr })) : "—"}
                            </p>
                          </div>
                        </div>
                        {overdue && (
                          <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.muted }}>
                            <AlertTriangle className="w-3.5 h-3.5" />Consultation de cette semaine non planifiée
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs" style={{ color: C.textSoft }}>
                        Aucun jour récurrent défini. Cliquez sur <strong>Définir</strong> pour en choisir un.
                      </p>
                    )
                  )}
                  {editingConsultDay && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                      <p className="text-xs" style={{ color: C.textSoft }}>Choisissez le jour de consultation :</p>
                      <div className="grid grid-cols-7 gap-1">
                        {JOURS.map((j, i) => (
                          <button key={i} onClick={() => setSelectedDay(i)}
                            className="py-2 rounded-xl text-xs font-semibold transition-all dp-sora"
                            style={selectedDay === i
                              ? { background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, color: "#fff", boxShadow: "0 4px 12px rgba(74,157,135,0.28)" }
                              : { background: "rgba(74,157,135,0.07)", color: C.textSoft, border: "1px solid rgba(74,157,135,0.14)" }}>
                            {j.short}
                          </button>
                        ))}
                      </div>
                      {selectedDay !== null && (
                        <p className="text-xs" style={{ color: C.textSoft }}>
                          Prochain <strong style={{ color: C.text }}>{JOURS[selectedDay].label}</strong> : {format(getNextOccurrence(selectedDay), "dd MMMM yyyy", { locale: fr })}
                        </p>
                      )}
                      <button onClick={handleSaveConsultationDay} disabled={savingConsultDay || selectedDay === null}
                        className="dp-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                        {savingConsultDay ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Check className="w-3.5 h-3.5" /> Confirmer</>}
                      </button>
                    </motion.div>
                  )}
                </Section>
              </motion.div>

              {/* Consultations vidéo */}
              <motion.div ref={consultSectionRef} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.20 }}>
                <Section title="Consultations vidéo" icon={<Video className="w-3.5 h-3.5" />}
                  action={
                    <button onClick={() => setShowConsultForm(v => !v)} className="dp-btn-primary" style={{ padding: "5px 10px", fontSize: "11px" }}>
                      {showConsultForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {showConsultForm ? "Annuler" : "Planifier"}
                    </button>
                  }
                >
                  {showConsultForm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="mb-4 p-4 rounded-2xl space-y-3"
                      style={{ background: "rgba(74,157,135,0.05)", border: "1px solid rgba(74,157,135,0.14)" }}>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: C.textSoft }}>Lien Zoom *</label>
                        <input type="url" placeholder="https://zoom.us/j/..." value={consultForm.zoom_link}
                          onChange={e => setConsultForm(p => ({ ...p, zoom_link: e.target.value }))}
                          className="dp-input" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: C.textSoft }}>Date et heure *</label>
                        <input type="datetime-local" value={consultForm.scheduled_at}
                          min={new Date().toISOString().slice(0, 16)}
                          onChange={e => setConsultForm(p => ({ ...p, scheduled_at: e.target.value }))}
                          className="dp-input" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1 block" style={{ color: C.textSoft }}>Notes (optionnel)</label>
                        <textarea placeholder="Instructions pour le patient..." value={consultForm.notes}
                          onChange={e => setConsultForm(p => ({ ...p, notes: e.target.value }))}
                          rows={2} className="dp-input" style={{ resize: "none" }} />
                      </div>
                      <button onClick={handlePlanifierConsultation}
                        disabled={consultLoading || !consultForm.zoom_link || !consultForm.scheduled_at}
                        className="dp-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                        {consultLoading ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Envoi...</> : <><Calendar className="w-3.5 h-3.5" /> Confirmer et notifier le patient</>}
                      </button>
                    </motion.div>
                  )}

                  {consultations.length === 0
                    ? <p className="text-xs" style={{ color: C.textSoft }}>Aucune consultation planifiée.</p>
                    : (
                      <div className="space-y-2">
                        {consultations.map((c) => (
                          <div key={c.id} className="p-3 rounded-2xl space-y-2"
                            style={{ background: "rgba(74,157,135,0.04)", border: "1px solid rgba(74,157,135,0.14)" }}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-xs" style={{ color: C.textSoft }}>
                                <Calendar className="w-3 h-3" />
                                <span className="font-semibold dp-sora" style={{ color: C.text }}>
                                  {format(new Date(c.scheduled_at), "dd MMM yyyy · HH:mm", { locale: fr })}
                                </span>
                              </div>
                              {consultationStatusBadge(c.status)}
                            </div>
                            {c.notes && <p className="text-xs italic" style={{ color: C.textSoft }}>{c.notes}</p>}
                            <div className="flex items-center gap-2 flex-wrap">
                              <a href={c.zoom_link} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:scale-105"
                                style={{ background: "rgba(91,143,160,0.10)", color: C.secondary, border: "1px solid rgba(91,143,160,0.25)" }}>
                                <Video className="w-3 h-3" /> Rejoindre <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                              {c.status === "planifiee" && (
                                <>
                                  <button onClick={() => handleTerminerConsultation(c.id)} className="dp-btn-ghost" style={{ fontSize: "11px", padding: "4px 10px" }}>
                                    <Check className="w-3 h-3" /> Terminée
                                  </button>
                                  <button onClick={() => handleAnnulerConsultation(c.id)} className="dp-btn-danger" style={{ fontSize: "11px", padding: "4px 10px" }}>
                                    <X className="w-3 h-3" /> Annuler
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </Section>
              </motion.div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Vitals temps réel */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <div className="p-5 space-y-5" style={glass}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, boxShadow: "0 4px 12px rgba(74,157,135,0.28)" }}>
                        <Shield className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-sm font-semibold dp-sora" style={{ color: C.text }}>Constantes vitales en temps réel</h3>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {lastUpdate && (
                        <span className="text-xs" style={{ color: C.textSoft }}>Mise à jour : {formatTime(lastUpdate)}</span>
                      )}
                      {device ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          {isOnline
                            ? <><Wifi className="w-3.5 h-3.5" style={{ color: "#5aaa6e" }} /><span style={{ color: "#5aaa6e" }}>En ligne</span></>
                            : <><WifiOff className="w-3.5 h-3.5" style={{ color: C.textSoft }} /><span style={{ color: C.textSoft }}>Hors ligne</span></>}
                          {device.dernier_signal && (
                            <span style={{ color: C.textSoft }} className="ml-1">
                              · {formatDistanceToNow(new Date(device.dernier_signal), { addSuffix: true, locale: fr })}
                            </span>
                          )}
                        </div>
                      ) : <span className="text-xs" style={{ color: C.textSoft }}>Aucun appareil</span>}
                      {lastUpdate && (
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#5aaa6e" }}>
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          Temps réel
                        </div>
                      )}
                    </div>
                  </div>

                  {!deviceId ? (
                    <div className="text-center py-8" style={{ color: C.textSoft }}>
                      <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Aucun capteur associé à ce patient</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <VitalCard icon="❤️" label="Fréq. Cardiaque"
                          value={latestVital?.bpm?.toString() ?? "—"} unit="BPM"
                          status={getBpmStatus(latestVital?.bpm ?? null)} delay={0.1} borderColor="border-l-primary">
                          <div className="mt-2 h-1 rounded-full" style={{ background: "rgba(74,157,135,0.12)" }}>
                            <div className="h-full rounded-full animate-pulse" style={{ background: C.primary, width: `${Math.min(((latestVital?.bpm ?? 0) / 200) * 100, 100)}%` }} />
                          </div>
                          <p className="text-xs mt-1" style={{ color: C.textSoft }}>Normal : 60-100 BPM</p>
                        </VitalCard>
                        <VitalCard icon="🩸" label="SpO2"
                          value={latestVital?.spo2?.toString() ?? "—"} unit="%"
                          status={getSpo2Status(latestVital?.spo2 ?? null)} delay={0.15} borderColor="border-l-safe">
                          <p className="text-xs mt-2" style={{ color: C.textSoft }}>Normal : 95-100%</p>
                        </VitalCard>
                        <VitalCard icon="🌡️" label="Température"
                          value={latestVital?.temperature?.toFixed(1) ?? "—"} unit="°C"
                          status={getTempStatus(latestVital?.temperature ?? null)} delay={0.2} borderColor="border-l-accent">
                          <p className="text-xs mt-2" style={{ color: C.textSoft }}>Normal : 36.1-37.2°C</p>
                        </VitalCard>
                        <VitalCard
                          icon={latestVital?.chute ? "🚨" : "✅"}
                          label="Détection Chute"
                          value={latestVital?.chute ? "ALERTE" : "Normal"} unit=""
                          status={latestVital?.chute ? "critical" : "safe"} delay={0.25}
                          borderColor={latestVital?.chute ? "border-l-destructive" : "border-l-safe"}>
                          <p className="text-xs mt-2" style={{ color: C.textSoft }}>
                            {latestVital?.chute ? "⚠️ Chute détectée !" : "Aucune chute détectée"}
                          </p>
                        </VitalCard>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: C.textSoft }}>
                        {latestVital?.niveau_batterie != null && (
                          <div className="flex items-center gap-1.5">
                            <Battery className="w-3.5 h-3.5" />
                            <span style={{ color: batteryColor(latestVital.niveau_batterie) }}>
                              Batterie : {latestVital.niveau_batterie}%
                            </span>
                          </div>
                        )}
                        {latestVital?.latitude && latestVital?.longitude && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3" style={{ color: C.primary }} />
                            <a href={`https://maps.google.com/?q=${latestVital.latitude},${latestVital.longitude}`}
                              target="_blank" rel="noopener noreferrer"
                              className="hover:underline transition-colors"
                              style={{ color: C.textSoft }}>
                              {Number(latestVital.latitude).toFixed(5)}, {Number(latestVital.longitude).toFixed(5)} — Voir sur la carte
                            </a>
                          </div>
                        )}
                      </div>

                      {vitalsHistory.length === 0 ? (
                        <div className="text-center py-10" style={{ color: C.textSoft }}>
                          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">En attente des premières mesures...</p>
                        </div>
                      ) : (
                        <>
                          {[
                            { title: "Fréquence Cardiaque — 20 dernières mesures", key: "BPM",         color: C.primary,   domain: [40, 160] as [number,number] },
                            { title: "SpO2 — 20 dernières mesures",                 key: "SpO2",        color: "#5aaa6e",   domain: [80, 100] as [number,number] },
                            { title: "Température — 20 dernières mesures",          key: "Température", color: "#f97316",   domain: [35, 41]  as [number,number] },
                          ].map((chart) => (
                            <div key={chart.key}>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-semibold dp-sora" style={{ color: C.text }}>{chart.title}</h4>
                                {chart.key === "BPM" && <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: C.textSoft, animationDuration: "3s" }} />}
                              </div>
                              <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,157,135,0.12)" />
                                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: C.textSoft }} stroke="transparent" />
                                  <YAxis domain={chart.domain} tick={{ fontSize: 10, fill: C.textSoft }} stroke="transparent" />
                                  <Tooltip contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(74,157,135,0.20)", borderRadius: "10px", fontSize: "12px" }} />
                                  {chart.key === "Température" && <ReferenceLine y={37.5} stroke="#f97316" strokeDasharray="4 2" strokeOpacity={0.5} />}
                                  <Line type="monotone" dataKey={chart.key} stroke={chart.color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: chart.color }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              </motion.div>

              {/* Alertes récentes */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.20 }}>
                <Section title={`Alertes récentes (${alerts.length})`} icon={<AlertTriangle className="w-3.5 h-3.5" />}>
                  {alerts.length === 0
                    ? <p className="text-xs" style={{ color: C.textSoft }}>Aucune alerte récente</p>
                    : (
                      <div className="space-y-2">
                        {alerts.map(a => {
                          const cfg = SEVERITY_CFG[a.severity] ?? SEVERITY_CFG.LOW;
                          return (
                            <div key={a.id} className="flex items-start gap-2.5 p-2.5 rounded-xl border text-xs"
                              style={{ background: cfg.bg, borderColor: cfg.border, borderLeftWidth: "3px", borderLeftColor: cfg.color }}>
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: cfg.color }} />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold dp-sora" style={{ color: cfg.color }}>{a.type.replace(/_/g, " ")}</p>
                                <p className="mt-0.5" style={{ color: C.textSoft }}>{a.message}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span style={{ color: C.textSoft }}>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: fr })}</span>
                                {!a.resolved && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                                    style={{ background: cfg.bg, color: cfg.color }}>Non résolu</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <button onClick={() => navigate("/doctor/alerts")}
                          className="flex items-center gap-1 text-xs font-semibold hover:underline mt-1"
                          style={{ color: C.primary }}>
                          Voir toutes les alertes <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                </Section>
              </motion.div>

              {/* Notes cliniques */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30 }}>
                <Section title="Notes cliniques" icon={<FileText className="w-3.5 h-3.5" />}>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Ajouter des notes cliniques..."
                    className="dp-input" rows={5} style={{ resize: "none" }} />
                  <div className="flex items-center justify-between mt-3">
                    {notesSaved && (
                      <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.primary }}>
                        <CheckCircle className="w-3.5 h-3.5" /> Sauvegardé
                      </span>
                    )}
                    <button onClick={handleSaveNotes} disabled={savingNotes}
                      className="dp-btn-primary ml-auto">
                      {savingNotes ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Sauvegarder
                    </button>
                  </div>
                </Section>
              </motion.div>

            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoctorPatientFiche;