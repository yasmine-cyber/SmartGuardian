import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { FlaskConical, Upload, CheckCircle, Clock, Loader, FileText, Eye } from "lucide-react";
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

const statutStyle: Record<string, string> = {
  demandee: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  soumise:  "bg-blue-500/10 text-blue-600 border-blue-500/20",
  vue:      "bg-green-500/10 text-green-600 border-green-500/20",
};
const statutLabel: Record<string, string> = {
  demandee: "En attente de votre résultat",
  soumise:  "Résultat envoyé — en attente de lecture",
  vue:      "Consultée par votre médecin",
};
const statutIcon: Record<string, React.ReactNode> = {
  demandee: <Clock className="w-3.5 h-3.5" />,
  soumise:  <CheckCircle className="w-3.5 h-3.5" />,
  vue:      <Eye className="w-3.5 h-3.5" />,
};

const BUCKET = "medical-analyses";

const PatientAnalyses = () => {
  const [analyses, setAnalyses]       = useState<Analyse[]>([]);
  const [patientId, setPatientId]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef                  = useRef<HTMLInputElement>(null);
  const activeAnalyseId               = useRef<string | null>(null);

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

  // Realtime: update when doctor marks as vue
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
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId]);

  const handleUploadClick = (analyseId: string) => {
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
      toast.success("Résultat envoyé à votre médecin !");
    }
    setUploadingId(null);
  };

  /**
   * Extract the storage path from a full Supabase public URL, then generate
   * a short-lived signed URL so the file can be downloaded even when the
   * bucket is NOT set to public.
   *
   * URL shape:  https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
   */
  const handleDownload = async (analyseId: string, fileUrl: string, fileName: string) => {
    setDownloadingId(analyseId);

    const marker = `/object/public/${BUCKET}/`;
    const pathIndex = fileUrl.indexOf(marker);

    if (pathIndex === -1) {
      // URL doesn't match expected shape — open directly as fallback
      window.open(fileUrl, "_blank");
      setDownloadingId(null);
      return;
    }

    const filePath = fileUrl.slice(pathIndex + marker.length);

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 120); // valid for 2 minutes

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
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="application/pdf"
        onChange={handleFileChange}
      />

      <div className="space-y-6 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Mes analyses</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {pending > 0
                  ? `${pending} analyse${pending > 1 ? "s" : ""} en attente de votre résultat`
                  : "Analyses demandées par votre médecin"}
              </p>
            </div>
            {pending > 0 && (
              <span className="w-8 h-8 rounded-full bg-yellow-500/10 text-yellow-600 text-sm font-bold flex items-center justify-center border border-yellow-500/20">
                {pending}
              </span>
            )}
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : analyses.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-card border border-border rounded-2xl p-12 text-center">
            <FlaskConical className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Aucune analyse demandée</p>
            <p className="text-xs text-muted-foreground mt-1">Votre médecin vous notifiera ici lorsqu'il demandera une analyse</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {analyses.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`bg-card border rounded-2xl p-5 shadow-sm space-y-3 ${
                  a.statut === "demandee" ? "border-yellow-500/30" : "border-border"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <FlaskConical className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{a.type}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Demandée le {format(new Date(a.created_at), "dd MMMM yyyy", { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border ${statutStyle[a.statut]}`}>
                    {statutIcon[a.statut]}
                    {a.statut === "demandee" ? "À faire" : a.statut === "soumise" ? "Envoyée" : "Consultée"}
                  </span>
                </div>

                {/* Doctor's note */}
                {a.note_medecin && (
                  <div className="bg-muted/50 rounded-xl px-3 py-2.5 text-xs text-foreground leading-relaxed border border-border/60">
                    <span className="text-muted-foreground font-medium block mb-0.5">Instructions de votre médecin :</span>
                    {a.note_medecin}
                  </div>
                )}

                {/* Status message */}
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {statutIcon[a.statut]}
                  {statutLabel[a.statut]}
                  {a.submitted_at && ` · ${formatDistanceToNow(new Date(a.submitted_at), { addSuffix: true, locale: fr })}`}
                </p>

                {/* Actions */}
                {a.statut === "demandee" && (
                  <button
                    onClick={() => handleUploadClick(a.id)}
                    disabled={uploadingId === a.id}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {uploadingId === a.id
                      ? <><Loader className="w-4 h-4 animate-spin" /> Envoi en cours...</>
                      : <><Upload className="w-4 h-4" /> Soumettre le résultat (PDF)</>}
                  </button>
                )}

                {/* ✅ Fixed: uses signed URL instead of direct public URL */}
                {a.file_url && a.statut !== "demandee" && (
                  <button
                    onClick={() => handleDownload(a.id, a.file_url!, a.file_name || "document.pdf")}
                    disabled={downloadingId === a.id}
                    className="flex items-center gap-2 text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {downloadingId === a.id
                      ? <Loader className="w-3.5 h-3.5 animate-spin" />
                      : <FileText className="w-3.5 h-3.5" />}
                    {a.file_name || "Voir le document soumis"}
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientAnalyses;