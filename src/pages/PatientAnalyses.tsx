import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Upload, CheckCircle, Clock, Loader, FileText,
  Eye, X, Sparkles, ChevronRight,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Analyse {
  id: string;
  type: string;
  note_medecin: string | null;
  statut: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  submitted_at: string | null;
}

// ─── Palette (matches PatientAlerts / landing page) ──────────────────────────
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

// ─── Status config ────────────────────────────────────────────────────────────
const STATUT_CONFIG: Record<string, {
  label: string; shortLabel: string; color: string; bg: string; border: string; icon: React.ReactNode;
}> = {
  demandee: {
    label: "En attente de votre résultat",
    shortLabel: "À faire",
    color: C.gold,
    bg: "rgba(212,168,67,0.12)",
    border: "rgba(212,168,67,0.30)",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  soumise: {
    label: "Résultat envoyé — en attente de lecture",
    shortLabel: "Envoyée",
    color: C.secondary,
    bg: "rgba(91,143,160,0.12)",
    border: "rgba(91,143,160,0.30)",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  vue: {
    label: "Consultée par votre médecin",
    shortLabel: "Consultée",
    color: C.primary,
    bg: "rgba(74,157,135,0.10)",
    border: "rgba(74,157,135,0.28)",
    icon: <Eye className="w-3.5 h-3.5" />,
  },
};

const BUCKET = "medical-analyses";

// ─── Backdrop helper ───────────────────────────────────────────────────────────
const Backdrop = ({ onClick }: { onClick: () => void }) => (
  <motion.div
    className="fixed inset-0 z-40"
    style={{ background: "rgba(26,46,40,0.45)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onClick}
  />
);

// ─── Detail Modal ──────────────────────────────────────────────────────────────
const DetailModal = ({
  analyse,
  onClose,
  onUpload,
  onDownload,
  uploadingId,
  downloadingId,
}: {
  analyse: Analyse;
  onClose: () => void;
  onUpload: (id: string) => void;
  onDownload: (id: string, url: string, name: string) => void;
  uploadingId: string | null;
  downloadingId: string | null;
}) => {
  const a = analyse;
  const cfg = STATUT_CONFIG[a.statut] || STATUT_CONFIG.demandee;

  return (
    <>
      <Backdrop onClick={onClose} />
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative w-full max-w-lg overflow-hidden"
          style={{ ...glass, borderRadius: "28px" }}
          initial={{ y: 60, scale: 0.96, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 60, scale: 0.96, opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
        >
          {/* Coloured top accent strip */}
          <div style={{
            height: "4px",
            width: "100%",
            background: `linear-gradient(90deg, ${cfg.color}, ${C.secondary})`,
          }} />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:scale-110"
            style={{ background: "rgba(74,157,135,0.10)", color: C.textSoft }}
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 space-y-5">
            {/* Icon + title */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                }}>
                <FlaskConical className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold sg-sora" style={{ color: C.text }}>{a.type}</h2>
                <p className="text-[11px]" style={{ color: C.textSoft }}>
                  Demandée le {format(new Date(a.created_at), "dd MMMM yyyy", { locale: fr })}
                </p>
              </div>
            </div>

            {/* Status pill */}
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
            >
              {cfg.icon}
              {cfg.label}
              {a.submitted_at && ` · ${formatDistanceToNow(new Date(a.submitted_at), { addSuffix: true, locale: fr })}`}
            </span>

            {/* Doctor's note */}
            {a.note_medecin && (
              <div className="rounded-2xl p-4 space-y-1.5"
                style={{ background: "rgba(74,157,135,0.06)", border: "1px solid rgba(74,157,135,0.15)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.textSoft }}>
                  Instructions du médecin
                </p>
                <p className="text-sm leading-relaxed" style={{ color: C.text }}>{a.note_medecin}</p>
              </div>
            )}

            {/* Divider */}
            <div style={{ height: "1px", background: "rgba(74,157,135,0.15)" }} />

            {/* Actions */}
            {a.statut === "demandee" && (
              <button
                onClick={() => { onClose(); onUpload(a.id); }}
                disabled={uploadingId === a.id}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  color: "#fff",
                  boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                }}
              >
                {uploadingId === a.id
                  ? <><Loader className="w-4 h-4 animate-spin" /> Envoi en cours...</>
                  : <><Upload className="w-4 h-4" /> Soumettre le résultat (PDF)</>}
              </button>
            )}

            {a.file_url && a.statut !== "demandee" && (
              <button
                onClick={() => onDownload(a.id, a.file_url!, a.file_name || "document.pdf")}
                disabled={downloadingId === a.id}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
                style={{
                  background: "rgba(74,157,135,0.08)",
                  color: C.primaryDark,
                  border: "1px solid rgba(74,157,135,0.22)",
                }}
              >
                {downloadingId === a.id
                  ? <Loader className="w-4 h-4 animate-spin" />
                  : <FileText className="w-4 h-4" />}
                {a.file_name || "Voir le document soumis"}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </>
  );
};

// ─── Upload Confirm Modal ──────────────────────────────────────────────────────
const UploadConfirmModal = ({
  analyse,
  onConfirm,
  onCancel,
}: {
  analyse: Analyse;
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <>
    <Backdrop onClick={onCancel} />
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative w-full max-w-sm p-6 space-y-5 text-center overflow-hidden"
        style={{ ...glass, borderRadius: "28px" }}
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 340 }}
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
          style={{
            background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
            boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
          }}>
          <Upload className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold sg-sora" style={{ color: C.text }}>Soumettre un résultat</h3>
          <p className="text-sm mt-1" style={{ color: C.textSoft }}>
            Vous allez envoyer le résultat pour{" "}
            <span className="font-semibold" style={{ color: C.text }}>{analyse.type}</span>.
            Votre médecin en sera notifié.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:scale-105"
            style={{
              background: "rgba(74,157,135,0.07)",
              color: C.textSoft,
              border: "1px solid rgba(74,157,135,0.18)",
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:scale-105"
            style={{
              background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
              color: "#fff",
              boxShadow: "0 6px 18px rgba(74,157,135,0.30)",
            }}
          >
            Continuer
          </button>
        </div>
      </motion.div>
    </motion.div>
  </>
);

// ─── Success Toast-banner (auto-dismiss) ──────────────────────────────────────
const SuccessBanner = ({ onDone }: { onDone: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-semibold"
      style={{
        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
        color: "#fff",
        boxShadow: "0 12px 32px rgba(74,157,135,0.40)",
      }}
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
    >
      <Sparkles className="w-4 h-4" />
      Résultat envoyé à votre médecin !
    </motion.div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────
const PatientAnalyses = () => {
  const [analyses, setAnalyses]       = useState<Analyse[]>([]);
  const [patientId, setPatientId]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef                  = useRef<HTMLInputElement>(null);
  const activeAnalyseId               = useRef<string | null>(null);

  const [detailAnalyse, setDetailAnalyse]     = useState<Analyse | null>(null);
  const [confirmUploadId, setConfirmUploadId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess]         = useState(false);

  // ── unchanged data init ──
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from("patients").select("id").eq("user_id", user.id).single();
      if (!p) { setLoading(false); return; }
      setPatientId(p.id);
      const { data } = await supabase
        .from("medical_analyses")
        .select("id, type, note_medecin, statut, file_url, file_name, created_at, submitted_at")
        .eq("patient_id", p.id)
        .order("created_at", { ascending: false });
      setAnalyses((data as Analyse[]) || []);
      setLoading(false);
    };
    init();
  }, []);

  // ── unchanged realtime ──
  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`patient_analyses:${patientId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "medical_analyses",
        filter: `patient_id=eq.${patientId}`,
      }, (payload) => {
        setAnalyses((prev) =>
          prev.map((a) => a.id === payload.new.id ? { ...a, ...(payload.new as Analyse) } : a)
        );
        setDetailAnalyse((prev) =>
          prev?.id === payload.new.id ? { ...prev, ...(payload.new as Analyse) } : prev
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId]);

  // ── unchanged upload logic ──
  const handleUploadClick = (analyseId: string) => {
    setConfirmUploadId(analyseId);
  };

  const triggerFileInput = (analyseId: string) => {
    activeAnalyseId.current = analyseId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const analyseId = activeAnalyseId.current;
    if (!file || !analyseId) return;
    if (file.type !== "application/pdf") {
      toast.error("Veuillez sélectionner un fichier PDF");
      e.target.value = "";
      return;
    }
    setUploadingId(analyseId);
    const path = `analyses/${analyseId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET).upload(path, file, { upsert: true });
    e.target.value = "";
    if (upErr) {
      toast.error("Erreur lors de l'envoi du fichier");
      setUploadingId(null);
      return;
    }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { error: updateErr } = await supabase.from("medical_analyses").update({
      statut: "soumise",
      file_url: urlData.publicUrl,
      file_name: file.name,
      submitted_at: new Date().toISOString(),
    }).eq("id", analyseId);
    if (updateErr) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      setAnalyses((prev) =>
        prev.map((a) => a.id === analyseId
          ? { ...a, statut: "soumise", file_url: urlData.publicUrl, file_name: file.name, submitted_at: new Date().toISOString() }
          : a
        )
      );
      setShowSuccess(true);
    }
    setUploadingId(null);
  };

  // ── unchanged download ──
  const handleDownload = async (analyseId: string, fileUrl: string, fileName: string) => {
    setDownloadingId(analyseId);
    const marker = `/object/public/${BUCKET}/`;
    const pathIndex = fileUrl.indexOf(marker);
    if (pathIndex === -1) {
      window.open(fileUrl, "_blank");
      setDownloadingId(null);
      return;
    }
    const filePath = fileUrl.slice(pathIndex + marker.length);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 120);
    if (error || !data?.signedUrl) {
      toast.error("Impossible d'ouvrir le fichier. Vérifiez vos permissions.");
      setDownloadingId(null);
      return;
    }
    window.open(data.signedUrl, "_blank");
    setDownloadingId(null);
  };

  const pending = analyses.filter((a) => a.statut === "demandee").length;

  return (
    <DashboardLayout role="patient">
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
      `}</style>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="application/pdf"
        onChange={handleFileChange}
      />

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {detailAnalyse && (
          <DetailModal
            key="detail"
            analyse={detailAnalyse}
            onClose={() => setDetailAnalyse(null)}
            onUpload={handleUploadClick}
            onDownload={handleDownload}
            uploadingId={uploadingId}
            downloadingId={downloadingId}
          />
        )}

        {confirmUploadId && (() => {
          const a = analyses.find((x) => x.id === confirmUploadId)!;
          return (
            <UploadConfirmModal
              key="confirm"
              analyse={a}
              onConfirm={() => { setConfirmUploadId(null); triggerFileInput(confirmUploadId); }}
              onCancel={() => setConfirmUploadId(null)}
            />
          );
        })()}

        {showSuccess && (
          <SuccessBanner key="success" onDone={() => setShowSuccess(false)} />
        )}
      </AnimatePresence>

      {/* ── Page ────────────────────────────────────────────────────────────── */}
      <div className="sg-page relative">
        {/* Aurora blobs */}
        <div className="sg-aurora-a" style={{ background: "rgba(74,157,135,0.13)", top: -100, right: -80, animation: "sgAurora 22s ease-in-out infinite" }} />
        <div className="sg-aurora-a" style={{ background: "rgba(91,143,160,0.12)", top: 280, left: -120, animation: "sgAurora 18s ease-in-out infinite reverse" }} />

        <div className="relative space-y-5 max-w-3xl mx-auto">

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-3xl" style={glass}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                    boxShadow: "0 8px 24px rgba(74,157,135,0.30)",
                  }}>
                  <FlaskConical className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight sg-sora" style={{ color: C.text }}>
                    Mes <span className="sg-gradient-text">Analyses</span>
                  </h1>
                  <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                    {pending > 0
                      ? `${pending} analyse${pending > 1 ? "s" : ""} en attente de votre résultat`
                      : "Analyses demandées par votre médecin"}
                  </p>
                </div>
              </div>
              {pending > 0 && (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold sg-sora"
                  style={{
                    background: "rgba(212,168,67,0.15)",
                    color: C.gold,
                    border: "1px solid rgba(212,168,67,0.30)",
                  }}>
                  {pending}
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Content ── */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader className="w-6 h-6 animate-spin" style={{ color: C.primary }} />
            </div>
          ) : analyses.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-3" style={glass}>
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: "0 12px 28px rgba(74,157,135,0.30)",
                }}>
                <FlaskConical className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold sg-sora" style={{ color: C.text }}>Aucune analyse demandée</p>
                <p className="text-sm mt-1" style={{ color: C.textSoft }}>
                  Votre médecin vous notifiera ici lorsqu'il demandera une analyse
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {analyses.map((a, i) => {
                const cfg = STATUT_CONFIG[a.statut] || STATUT_CONFIG.demandee;
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3) }}
                    className="sg-card overflow-hidden cursor-pointer"
                    style={{
                      ...glass,
                      borderLeft: `3px solid ${cfg.color}`,
                    }}
                    onClick={() => setDetailAnalyse(a)}
                  >
                    <div className="p-5 space-y-3">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                            style={{ background: cfg.bg }}>
                            <FlaskConical className="w-4 h-4" style={{ color: cfg.color }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold sg-sora" style={{ color: C.text }}>{a.type}</p>
                            <p className="text-[11px]" style={{ color: C.textSoft }}>
                              Demandée le {format(new Date(a.created_at), "dd MMMM yyyy", { locale: fr })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                          >
                            {cfg.icon}
                            {cfg.shortLabel}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5" style={{ color: C.textSoft }} />
                        </div>
                      </div>

                      {/* Doctor's note preview */}
                      {a.note_medecin && (
                        <div className="rounded-xl px-3 py-2.5 text-xs leading-relaxed line-clamp-2"
                          style={{
                            background: "rgba(74,157,135,0.06)",
                            border: "1px solid rgba(74,157,135,0.14)",
                            color: C.text,
                          }}>
                          <span className="font-semibold block mb-0.5" style={{ color: C.textSoft }}>Instructions :</span>
                          {a.note_medecin}
                        </div>
                      )}

                      {/* Status message */}
                      <p className="flex items-center gap-1.5 text-xs" style={{ color: C.textSoft }}>
                        {cfg.icon}
                        {cfg.label}
                        {a.submitted_at && ` · ${formatDistanceToNow(new Date(a.submitted_at), { addSuffix: true, locale: fr })}`}
                      </p>

                      {/* Quick upload */}
                      {a.statut === "demandee" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUploadClick(a.id); }}
                          disabled={uploadingId === a.id}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
                          style={{
                            background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                            color: "#fff",
                            boxShadow: "0 6px 18px rgba(74,157,135,0.28)",
                          }}
                        >
                          {uploadingId === a.id
                            ? <><Loader className="w-4 h-4 animate-spin" /> Envoi en cours...</>
                            : <><Upload className="w-4 h-4" /> Soumettre le résultat (PDF)</>}
                        </button>
                      )}

                      {/* Download link */}
                      {a.file_url && a.statut !== "demandee" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(a.id, a.file_url!, a.file_name || "document.pdf"); }}
                          disabled={downloadingId === a.id}
                          className="flex items-center gap-2 text-xs font-medium transition-all hover:underline disabled:opacity-50"
                          style={{ color: C.primaryDark }}
                        >
                          {downloadingId === a.id
                            ? <Loader className="w-3.5 h-3.5 animate-spin" />
                            : <FileText className="w-3.5 h-3.5" />}
                          {a.file_name || "Voir le document soumis"}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PatientAnalyses;