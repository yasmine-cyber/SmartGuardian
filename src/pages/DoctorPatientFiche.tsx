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

// ─── YOUR BUCKET NAME — change this to match your Supabase Storage bucket ────
const ANALYSES_BUCKET = "analyses";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const age = (dob: string) => {
  if (!dob) return "—";
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
};

const severityColor: Record<string, string> = {
  CRITICAL: "text-red-500 bg-red-500/10 border-red-500/20",
  HIGH:     "text-orange-500 bg-orange-500/10 border-orange-500/20",
  MEDIUM:   "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
  LOW:      "text-green-500 bg-green-500/10 border-green-500/20",
};

const batteryColor = (level: number | null) => {
  if (!level) return "text-muted-foreground";
  if (level > 60) return "text-green-500";
  if (level > 30) return "text-yellow-500";
  return "text-red-500";
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

// ─── Extract storage path from any form of file_url ──────────────────────────
// Handles three cases:
//   1. Raw path:       "analyses/uuid/file.pdf"
//   2. Public URL:     "https://.../storage/v1/object/public/analyses/uuid/file.pdf"
//   3. Signed URL:     "https://.../storage/v1/object/sign/analyses/uuid/file.pdf?token=..."
const extractStoragePath = (fileUrl: string): string => {
  try {
    if (!fileUrl.startsWith("http")) return fileUrl; // already a raw path
    const url = new URL(fileUrl);
    const pathname = url.pathname;
    // match /object/public/<bucket>/<path> or /object/sign/<bucket>/<path>
    const match = pathname.match(/\/object\/(?:public|sign)\/[^/]+\/(.+)/);
    if (match) return match[1];
    // fallback: return everything after the bucket name
    const bucketIndex = pathname.indexOf(`/${ANALYSES_BUCKET}/`);
    if (bucketIndex !== -1) return pathname.slice(bucketIndex + ANALYSES_BUCKET.length + 2);
  } catch {
    // not a valid URL, treat as raw path
  }
  return fileUrl;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Section = ({ title, icon, children, className = "", action }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  className?: string; action?: React.ReactNode;
}) => (
  <div className={`bg-card border border-border rounded-2xl p-5 shadow-sm ${className}`}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const consultationStatusBadge = (status: string) => {
  if (status === "planifiee") return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">Planifiée</span>;
  if (status === "terminee")  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">Terminée</span>;
  if (status === "annulee")   return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600">Annulée</span>;
  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DoctorPatientFiche = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  // ── Core states ──
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

  // ── Consultation states ──
  const [consultations, setConsultations]         = useState<Consultation[]>([]);
  const [showConsultForm, setShowConsultForm]     = useState(false);
  const [consultLoading, setConsultLoading]       = useState(false);
  const [consultForm, setConsultForm]             = useState({ zoom_link: "", scheduled_at: "", notes: "" });
  const [consultationDay, setConsultationDay]     = useState<number | null>(null);
  const [savingConsultDay, setSavingConsultDay]   = useState(false);
  const [editingConsultDay, setEditingConsultDay] = useState(false);
  const [selectedDay, setSelectedDay]             = useState<number | null>(null);
  const [overdueAlertSent, setOverdueAlertSent]   = useState(false);

  // ── Analyses states ──
  const [analyses, setAnalyses]               = useState<Analyse[]>([]);
  const [showAnalyseForm, setShowAnalyseForm] = useState(false);
  const [analyseLoading, setAnalyseLoading]   = useState(false);
  const [analyseForm, setAnalyseForm]         = useState({ type: "", note_medecin: "" });
  const [openingFile, setOpeningFile]         = useState<string | null>(null); // tracks which analyse id is loading

  // ── Realtime vitals ──
  const [deviceId, setDeviceId]     = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const consultSectionRef = useRef<HTMLDivElement>(null);

  const openConsultForm = () => {
    setShowConsultForm(true);
    setTimeout(() => consultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  // ─── Loaders ──────────────────────────────────────────────────────────────

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

  // ─── Main data loader ──────────────────────────────────────────────────────

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

  // ─── Realtime vitals ───────────────────────────────────────────────────────

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

  // ─── Handlers: Overdue alert ───────────────────────────────────────────────

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

  // ─── Handlers: Consultation day ────────────────────────────────────────────

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
    } else {
      toast.error("Erreur lors de la sauvegarde");
    }
    setSavingConsultDay(false);
  };

  // ─── Handlers: Consultations ───────────────────────────────────────────────

  const handlePlanifierConsultation = async () => {
    if (!patient || !consultForm.zoom_link || !consultForm.scheduled_at) {
      toast.error("Lien Zoom et date/heure sont obligatoires."); return;
    }
    if (!consultForm.zoom_link.startsWith("http")) {
      toast.error("Le lien Zoom doit commencer par http:// ou https://"); return;
    }
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
    } catch (err: any) {
      toast.error("Erreur : " + err.message);
    } finally {
      setConsultLoading(false);
    }
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

  // ─── Handlers: Analyses ────────────────────────────────────────────────────

  const handleDemanderAnalyse = async () => {
    if (!patient || !analyseForm.type) {
      toast.error("Veuillez choisir un type d'analyse"); return;
    }
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
    } catch (err: any) {
      toast.error("Erreur : " + err.message);
    } finally {
      setAnalyseLoading(false);
    }
  };

  const handleMarquerVue = async (analyseId: string) => {
    const { error } = await supabase.from("medical_analyses")
      .update({ statut: "vue", viewed_at: new Date().toISOString() })
      .eq("id", analyseId);
    if (!error && patient) {
      await loadAnalyses(patient.id);
      toast.success("Analyse marquée comme consultée.");
    }
  };

  // ─── Handler: Open analyse file via signed URL ─────────────────────────────
  const handleOpenAnalyse = async (analyseId: string, fileUrl: string, fileName: string) => {
    setOpeningFile(analyseId);
    try {
      const path = extractStoragePath(fileUrl);
      const { data, error } = await supabase.storage
        .from(ANALYSES_BUCKET)
        .createSignedUrl(path, 60 * 60); // 1-hour expiry

      if (error || !data?.signedUrl) {
        console.error("Signed URL error:", error);
        toast.error("Impossible d'ouvrir le fichier. Vérifiez le nom du bucket.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Open analyse error:", err);
      toast.error("Erreur lors de l'ouverture du fichier");
    } finally {
      setOpeningFile(null);
    }
  };

  // ─── Handlers: Other ──────────────────────────────────────────────────────

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

  // ─── Derived ──────────────────────────────────────────────────────────────

  const chartData = vitalsHistory.map(v => ({
    time: new Date(v.recorded_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    BPM: v.bpm, SpO2: v.spo2, Température: v.temperature,
  }));

  const overdue               = isConsultationOverdue(consultationDay, consultations);
  const nextOccurrencePlanned = isNextOccurrencePlanned(consultationDay, consultations);
  const nextOccurrence        = consultationDay !== null ? getNextOccurrence(consultationDay) : null;
  const isToday               = nextOccurrence ? nextOccurrence.toDateString() === new Date().toDateString() : false;
  const newSubmissions        = analyses.filter(a => a.statut === "soumise").length;

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  if (loading) return (
    <DashboardLayout role="doctor">
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    </DashboardLayout>
  );
  if (!patient) return null;

  const initials = `${patient.prenom?.[0] || ""}${patient.nom?.[0] || ""}`.toUpperCase() || "?";
  const fullName = [patient.prenom, patient.nom].filter(Boolean).join(" ") || "—";
  const isOnline = device?.actif && device?.dernier_signal
    ? Date.now() - new Date(device.dernier_signal).getTime() < 5 * 60 * 1000 : false;

  return (
    <DashboardLayout role="doctor">
      <div className="max-w-7xl space-y-6">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <button onClick={() => navigate("/doctor/patients")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour aux patients
          </button>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">{initials}</div>
                  <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card ${isOnline ? "bg-green-500" : "bg-muted-foreground"}`} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{fullName}</h1>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                    {patient.date_naissance && <span>{age(patient.date_naissance)} ans</span>}
                    {patient.sexe && <span>• {patient.sexe}</span>}
                    {patient.maladies?.[0] && <span>• {patient.maladies[0]}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleStartConversation}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all">
                  <MessageCircle className="w-4 h-4" /> Envoyer un message
                </button>
                <StatusBadge status={patient.status as any} size="md" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Bannières consultation ── */}
        {consultationDay !== null && (() => {
          if (overdue) return (
            <motion.div key="overdue" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-5 py-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600">
              <Bell className="w-5 h-5 shrink-0 animate-pulse" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Consultation en retard !</p>
                <p className="text-xs opacity-80 mt-0.5">La consultation du <strong>{JOURS[consultationDay].label}</strong> de cette semaine n'a pas encore été planifiée.</p>
              </div>
              <button onClick={openConsultForm} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-xl text-xs font-medium hover:bg-red-600 transition-colors shrink-0">
                <Plus className="w-3.5 h-3.5" /> Planifier maintenant
              </button>
            </motion.div>
          );
          if (nextOccurrencePlanned && nextOccurrence) return (
            <motion.div key="planned" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-5 py-3.5 bg-green-500/10 border border-green-500/30 rounded-2xl text-green-600">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Consultation planifiée ✓</p>
                <p className="text-xs opacity-80 mt-0.5">Le <strong>{JOURS[consultationDay].label}</strong> {isToday ? "aujourd'hui" : format(nextOccurrence, "dd MMMM yyyy", { locale: fr })}</p>
              </div>
            </motion.div>
          );
          if (nextOccurrence) return (
            <motion.div key="upcoming" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border ${isToday ? "bg-orange-500/10 border-orange-500/30 text-orange-600" : "bg-blue-500/10 border-blue-500/30 text-blue-600"}`}>
              <CalendarClock className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold">{isToday ? "Consultation prévue aujourd'hui !" : "Prochaine consultation à planifier"}</p>
                <p className="text-xs opacity-80 mt-0.5">Le <strong>{JOURS[consultationDay].label}</strong> {isToday ? "— n'oubliez pas de planifier la séance." : `— ${format(nextOccurrence, "dd MMMM yyyy", { locale: fr })}`}</p>
              </div>
              <button onClick={openConsultForm} className="flex items-center gap-1.5 px-3 py-1.5 bg-current/20 rounded-xl text-xs font-medium hover:bg-current/30 transition-colors shrink-0">
                <Plus className="w-3.5 h-3.5" /> Planifier
              </button>
            </motion.div>
          );
          return null;
        })()}

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-5">

            {/* Infos personnelles */}
            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
              <Section title="Informations personnelles" icon={<User className="w-4 h-4" />}>
                <div className="space-y-2 text-sm">
                  {patient.telephone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5 shrink-0" /><span className="text-foreground">{patient.telephone}</span></div>}
                  {patient.email && <div className="flex items-center gap-2 text-muted-foreground"><FileText className="w-3.5 h-3.5 shrink-0" /><span className="text-foreground truncate">{patient.email}</span></div>}
                  {patient.adresse && <div className="flex items-start gap-2 text-muted-foreground"><Home className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span className="text-foreground">{patient.adresse}</span></div>}
                  {patient.date_naissance && <div className="flex items-center gap-2 text-muted-foreground"><Clock className="w-3.5 h-3.5 shrink-0" /><span className="text-foreground">{format(new Date(patient.date_naissance), "dd MMMM yyyy", { locale: fr })}</span></div>}
                </div>
              </Section>
            </motion.div>

            {/* Dossier médical */}
            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Section title="Dossier médical" icon={<Stethoscope className="w-4 h-4" />}>
                <div className="space-y-3 text-sm">
                  {patient.maladies?.length > 0 && <div><p className="text-xs text-muted-foreground mb-1.5">Maladies</p><div className="flex flex-wrap gap-1">{patient.maladies.map((m, i) => <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">{m}</span>)}</div></div>}
                  {patient.antecedents && <div><p className="text-xs text-muted-foreground mb-1">Antécédents</p><p className="text-foreground text-xs leading-relaxed">{patient.antecedents}</p></div>}
                  {patient.traitements?.length > 0 && <div><p className="text-xs text-muted-foreground mb-1.5">Traitements</p><div className="flex flex-wrap gap-1">{patient.traitements.map((t, i) => <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{t}</span>)}</div></div>}
                  {!patient.maladies?.length && !patient.antecedents && !patient.traitements?.length && <p className="text-xs text-muted-foreground">Aucune information renseignée</p>}
                </div>
              </Section>
            </motion.div>

            {/* Proches */}
            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
              <Section title={`Proches (${proches.length})`} icon={<Users className="w-4 h-4" />}>
                {proches.length === 0 ? <p className="text-xs text-muted-foreground">Aucun proche lié</p> : (
                  <div className="space-y-2">
                    {proches.map((p) => (
                      <div key={p.proche_id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-600 text-xs font-semibold shrink-0">
                            {`${p.prenom?.[0] || ""}${p.nom?.[0] || ""}`.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{[p.prenom, p.nom].filter(Boolean).join(" ") || "—"}</p>
                            {p.telephone && <p className="text-[10px] text-muted-foreground">{p.telephone}</p>}
                          </div>
                        </div>
                        <button onClick={() => handleMessageProche(p.proche_id)} className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors shrink-0">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </motion.div>

            {/* ── ANALYSES MÉDICALES ── */}
            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.17 }}>
              <Section
                title={`Analyses médicales${newSubmissions > 0 ? ` · ${newSubmissions} résultat(s)` : ""}`}
                icon={<FlaskConical className="w-4 h-4" />}
                action={
                  <button onClick={() => setShowAnalyseForm(v => !v)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:brightness-110 transition-all">
                    {showAnalyseForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {showAnalyseForm ? "Annuler" : "Demander"}
                  </button>
                }
              >
                {showAnalyseForm && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="mb-4 p-4 bg-muted/40 border border-border rounded-xl space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Type d'analyse *</label>
                      <select value={analyseForm.type}
                        onChange={(e) => setAnalyseForm(p => ({ ...p, type: e.target.value }))}
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50 transition-all">
                        <option value="">Choisir...</option>
                        {ANALYSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Instructions (optionnel)</label>
                      <textarea
                        placeholder="Ex : À jeun depuis 12h, apporter les résultats précédents..."
                        value={analyseForm.note_medecin}
                        onChange={(e) => setAnalyseForm(p => ({ ...p, note_medecin: e.target.value }))}
                        rows={3}
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50 transition-all resize-none" />
                    </div>
                    <button onClick={handleDemanderAnalyse}
                      disabled={analyseLoading || !analyseForm.type}
                      className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50">
                      {analyseLoading
                        ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Envoi...</>
                        : <><FlaskConical className="w-3.5 h-3.5" /> Envoyer la demande</>}
                    </button>
                  </motion.div>
                )}

                {analyses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucune analyse demandée.</p>
                ) : (
                  <div className="space-y-2">
                    {analyses.map((a) => (
                      <div key={a.id} className={`p-3 rounded-xl border space-y-2 ${
                        a.statut === "soumise" ? "border-blue-500/30 bg-blue-500/5" : "border-border bg-muted/30"
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-foreground">{a.type}</p>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            a.statut === "demandee" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
                            a.statut === "soumise"  ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                                                      "bg-green-500/10 text-green-600 border-green-500/20"
                          }`}>
                            {a.statut === "demandee" ? "En attente" : a.statut === "soumise" ? "Résultat reçu" : "Consultée"}
                          </span>
                        </div>

                        {a.note_medecin && (
                          <p className="text-[11px] text-muted-foreground italic leading-relaxed">{a.note_medecin}</p>
                        )}

                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(a.created_at), "dd MMM yyyy", { locale: fr })}
                          {a.submitted_at && ` · Soumis ${formatDistanceToNow(new Date(a.submitted_at), { addSuffix: true, locale: fr })}`}
                        </p>

                        {/* ── Statut: soumise — show file + mark as viewed ── */}
                        {a.statut === "soumise" && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {a.file_url && (
                              <button
                                onClick={() => handleOpenAnalyse(a.id, a.file_url!, a.file_name || "document")}
                                disabled={openingFile === a.id}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-60"
                              >
                                {openingFile === a.id
                                  ? <Loader className="w-3 h-3 animate-spin" />
                                  : <FileText className="w-3 h-3" />}
                                {a.file_name || "Voir le document"}
                              </button>
                            )}
                            <button
                              onClick={() => handleMarquerVue(a.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-all"
                            >
                              <CheckCircle className="w-3 h-3" /> Marquer comme vue
                            </button>
                          </div>
                        )}

                        {/* ── Statut: vue — show file link only ── */}
                        {a.statut === "vue" && a.file_url && (
                          <button
                            onClick={() => handleOpenAnalyse(a.id, a.file_url!, a.file_name || "document")}
                            disabled={openingFile === a.id}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-60"
                          >
                            {openingFile === a.id
                              ? <Loader className="w-3 h-3 animate-spin" />
                              : <FileText className="w-3 h-3" />}
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
              <Section title="Consultation hebdomadaire" icon={<RefreshCw className="w-4 h-4" />}
                action={
                  <button onClick={() => { setEditingConsultDay(v => !v); setSelectedDay(consultationDay); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-all">
                    {editingConsultDay ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {editingConsultDay ? "Annuler" : (consultationDay !== null ? "Modifier" : "Définir")}
                  </button>
                }
              >
                {!editingConsultDay && (
                  consultationDay !== null ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">Chaque <span className="text-primary">{JOURS[consultationDay].label}</span></p>
                          <p className="text-xs text-muted-foreground mt-0.5">Prochain : {nextOccurrence ? (isToday ? "Aujourd'hui" : format(nextOccurrence, "dd MMMM yyyy", { locale: fr })) : "—"}</p>
                        </div>
                      </div>
                      {overdue && <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium"><AlertTriangle className="w-3.5 h-3.5" />Consultation de cette semaine non planifiée</div>}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">Aucun jour récurrent défini. Cliquez sur <strong>Définir</strong> pour en choisir un.</p>
                )}
                {editingConsultDay && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    <p className="text-xs text-muted-foreground">Choisissez le jour de consultation :</p>
                    <div className="grid grid-cols-7 gap-1">
                      {JOURS.map((j, i) => (
                        <button key={i} onClick={() => setSelectedDay(i)}
                          className={`py-2 rounded-xl text-xs font-medium transition-all ${selectedDay === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                          {j.short}
                        </button>
                      ))}
                    </div>
                    {selectedDay !== null && (
                      <p className="text-xs text-muted-foreground">Prochain <strong className="text-foreground">{JOURS[selectedDay].label}</strong> : {format(getNextOccurrence(selectedDay), "dd MMMM yyyy", { locale: fr })}</p>
                    )}
                    <button onClick={handleSaveConsultationDay} disabled={savingConsultDay || selectedDay === null}
                      className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50">
                      {savingConsultDay ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</> : <><Check className="w-3.5 h-3.5" /> Confirmer</>}
                    </button>
                  </motion.div>
                )}
              </Section>
            </motion.div>

            {/* Consultations vidéo */}
            <motion.div ref={consultSectionRef} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Section title="Consultations vidéo" icon={<Video className="w-4 h-4" />}
                action={
                  <button onClick={() => setShowConsultForm(v => !v)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:brightness-110 transition-all">
                    {showConsultForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {showConsultForm ? "Annuler" : "Planifier"}
                  </button>
                }
              >
                {showConsultForm && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 p-4 bg-muted/40 border border-border rounded-xl space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Lien Zoom *</label>
                      <input type="url" placeholder="https://zoom.us/j/..." value={consultForm.zoom_link}
                        onChange={e => setConsultForm(p => ({ ...p, zoom_link: e.target.value }))}
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50 transition-all" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Date et heure *</label>
                      <input type="datetime-local" value={consultForm.scheduled_at}
                        min={new Date().toISOString().slice(0, 16)}
                        onChange={e => setConsultForm(p => ({ ...p, scheduled_at: e.target.value }))}
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50 transition-all" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Notes (optionnel)</label>
                      <textarea placeholder="Instructions pour le patient..." value={consultForm.notes}
                        onChange={e => setConsultForm(p => ({ ...p, notes: e.target.value }))}
                        rows={2} className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50 transition-all resize-none" />
                    </div>
                    <button onClick={handlePlanifierConsultation}
                      disabled={consultLoading || !consultForm.zoom_link || !consultForm.scheduled_at}
                      className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50">
                      {consultLoading ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Envoi...</> : <><Calendar className="w-3.5 h-3.5" /> Confirmer et notifier le patient</>}
                    </button>
                  </motion.div>
                )}
                {consultations.length === 0 ? <p className="text-xs text-muted-foreground">Aucune consultation planifiée.</p> : (
                  <div className="space-y-2">
                    {consultations.map((c) => (
                      <div key={c.id} className="p-3 rounded-xl border border-border bg-muted/30 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span className="font-medium text-foreground">{format(new Date(c.scheduled_at), "dd MMM yyyy · HH:mm", { locale: fr })}</span>
                          </div>
                          {consultationStatusBadge(c.status)}
                        </div>
                        {c.notes && <p className="text-xs text-muted-foreground italic">{c.notes}</p>}
                        <div className="flex items-center gap-2 flex-wrap">
                          <a href={c.zoom_link} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-all">
                            <Video className="w-3 h-3" /> Rejoindre <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                          {c.status === "planifiee" && (
                            <>
                              <button onClick={() => handleTerminerConsultation(c.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-all">
                                <Check className="w-3 h-3" /> Terminée
                              </button>
                              <button onClick={() => handleAnnulerConsultation(c.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-all">
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
          <div className="lg:col-span-2 space-y-5">

            {/* Vitals temps réel */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Constantes vitales en temps réel</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    {lastUpdate && <span className="text-xs text-muted-foreground">Mise à jour : {formatTime(lastUpdate)}</span>}
                    {device ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        {isOnline
                          ? <><Wifi className="w-3.5 h-3.5 text-green-500" /><span className="text-green-500">En ligne</span></>
                          : <><WifiOff className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-muted-foreground">Hors ligne</span></>}
                        {device.dernier_signal && <span className="text-muted-foreground ml-1">· {formatDistanceToNow(new Date(device.dernier_signal), { addSuffix: true, locale: fr })}</span>}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">Aucun appareil</span>}
                    {lastUpdate && (
                      <div className="flex items-center gap-1.5 text-xs text-green-500">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Temps réel
                      </div>
                    )}
                  </div>
                </div>

                {!deviceId ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Aucun capteur associé à ce patient
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <VitalCard icon="❤️" label="Fréq. Cardiaque"
                        value={latestVital?.bpm?.toString() ?? "—"} unit="BPM"
                        status={getBpmStatus(latestVital?.bpm ?? null)} delay={0.1} borderColor="border-l-primary">
                        <div className="mt-2 h-1 rounded-full bg-primary/10">
                          <div className="h-full rounded-full bg-primary animate-pulse"
                            style={{ width: `${Math.min(((latestVital?.bpm ?? 0) / 200) * 100, 100)}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Normal : 60-100 BPM</p>
                      </VitalCard>
                      <VitalCard icon="🩸" label="SpO2"
                        value={latestVital?.spo2?.toString() ?? "—"} unit="%"
                        status={getSpo2Status(latestVital?.spo2 ?? null)} delay={0.15} borderColor="border-l-safe">
                        <p className="text-xs text-muted-foreground mt-2">Normal : 95-100%</p>
                      </VitalCard>
                      <VitalCard icon="🌡️" label="Température"
                        value={latestVital?.temperature?.toFixed(1) ?? "—"} unit="°C"
                        status={getTempStatus(latestVital?.temperature ?? null)} delay={0.2} borderColor="border-l-accent">
                        <p className="text-xs text-muted-foreground mt-2">Normal : 36.1-37.2°C</p>
                      </VitalCard>
                      <VitalCard
                        icon={latestVital?.chute ? "🚨" : "✅"}
                        label="Détection Chute"
                        value={latestVital?.chute ? "ALERTE" : "Normal"} unit=""
                        status={latestVital?.chute ? "critical" : "safe"} delay={0.25}
                        borderColor={latestVital?.chute ? "border-l-destructive" : "border-l-safe"}>
                        <p className="text-xs text-muted-foreground mt-2">
                          {latestVital?.chute ? "⚠️ Chute détectée !" : "Aucune chute détectée"}
                        </p>
                      </VitalCard>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      {latestVital?.niveau_batterie != null && (
                        <div className="flex items-center gap-1.5">
                          <Battery className="w-3.5 h-3.5" />
                          <span className={batteryColor(latestVital.niveau_batterie)}>Batterie : {latestVital.niveau_batterie}%</span>
                        </div>
                      )}
                      {latestVital?.latitude && latestVital?.longitude && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" />
                          <a href={`https://maps.google.com/?q=${latestVital.latitude},${latestVital.longitude}`}
                            target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                            {Number(latestVital.latitude).toFixed(5)}, {Number(latestVital.longitude).toFixed(5)} — Voir sur la carte
                          </a>
                        </div>
                      )}
                    </div>

                    {vitalsHistory.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground text-sm">
                        <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        En attente des premières mesures...
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-semibold text-foreground">Fréquence Cardiaque — 20 dernières mesures</h4>
                            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" style={{ animationDuration: "3s" }} />
                          </div>
                          <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                              <YAxis domain={[40, 160]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                              <Line type="monotone" dataKey="BPM" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        <div>
                          <h4 className="text-xs font-semibold text-foreground mb-3">SpO2 — 20 dernières mesures</h4>
                          <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                              <YAxis domain={[80, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                              <Line type="monotone" dataKey="SpO2" stroke="hsl(var(--safe))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        <div>
                          <h4 className="text-xs font-semibold text-foreground mb-3">Température — 20 dernières mesures</h4>
                          <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                              <YAxis domain={[35, 41]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                              <ReferenceLine y={37.5} stroke="#f97316" strokeDasharray="4 2" strokeOpacity={0.5} />
                              <Line type="monotone" dataKey="Température" stroke="#f97316" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </motion.div>

            {/* Alertes */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Section title={`Alertes récentes (${alerts.length})`} icon={<AlertTriangle className="w-4 h-4" />}>
                {alerts.length === 0 ? <p className="text-xs text-muted-foreground">Aucune alerte récente</p> : (
                  <div className="space-y-2">
                    {alerts.map(a => (
                      <div key={a.id} className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs ${severityColor[a.severity] || "text-muted-foreground bg-muted border-border"}`}>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{a.type.replace(/_/g, " ")}</p>
                          <p className="opacity-80 mt-0.5">{a.message}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="opacity-70">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: fr })}</span>
                          {!a.resolved && <span className="px-1.5 py-0.5 rounded-full bg-current/10 font-medium">Non résolu</span>}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => navigate("/doctor/alerts")} className="flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                      Voir toutes les alertes <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </Section>
            </motion.div>

            {/* Anomalies IA */}
            {anomalies.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Section title="Anomalies détectées par IA" icon={<Zap className="w-4 h-4" />}>
                  <div className="space-y-2">
                    {anomalies.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/50 text-xs">
                        <div>
                          <p className="font-medium text-foreground">{a.type_anomalie.replace(/_/g, " ")}</p>
                          <p className="text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(a.detected_at), { addSuffix: true, locale: fr })}</p>
                        </div>
                        {a.score_confiance != null && (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(a.score_confiance * 40, 100)}%` }} />
                            </div>
                            <span className="text-muted-foreground">{a.score_confiance.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              </motion.div>
            )}

            {/* Notes cliniques */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Section title="Notes cliniques" icon={<FileText className="w-4 h-4" />}>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Ajouter des notes cliniques..."
                  className="w-full bg-muted rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[120px] resize-none" />
                <div className="flex items-center justify-between mt-3">
                  {notesSaved && <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle className="w-3.5 h-3.5" /> Sauvegardé</span>}
                  <button onClick={handleSaveNotes} disabled={savingNotes}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50">
                    {savingNotes ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Sauvegarder
                  </button>
                </div>
              </Section>
            </motion.div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoctorPatientFiche;