import { useState } from "react";
import { motion } from "framer-motion";
import { Stethoscope, Phone, BadgeCheck, CheckCircle, Clock, XCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

type Medecin = {
  id: string;
  specialite: string;
  numero_licence: string;
  utilisateurs: {
    nom: string;
    email: string;
    telephone: string | null;
  } | null;
};

type Demande = {
  id: string;
  medecin_id: string;
  statut: "en_attente" | "approuvee" | "refusee" | "annulee";
};

const MesMedecins = () => {
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState<string | null>(null);

  // Get current patient's id
  useQuery({
    queryKey: ["current-patient-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setPatientId(data.id);
      return data;
    },
  });

  // Fetch all medecins
  const { data: medecins, isLoading } = useQuery({
    queryKey: ["medecins-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medecins")
        .select("id, specialite, numero_licence, utilisateurs(nom, email, telephone)");
      if (error) throw error;
      return (data || []) as unknown as Medecin[];
    },
  });

  // Fetch patient's demandes
  const { data: demandes } = useQuery({
    queryKey: ["mes-demandes", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("id, medecin_id, statut")
        .eq("patient_id", patientId);
      if (error) throw error;
      return (data || []) as Demande[];
    },
  });

  // Create demande (une seule demande par médecin : pas de doublon en_attente / approuvee)
  const { mutate: choisirMedecin, isPending } = useMutation({
    mutationFn: async (medecinId: string) => {
      if (!patientId) throw new Error("Patient non identifié");
      const { data: existing } = await supabase
        .from("demandes")
        .select("id, statut")
        .eq("patient_id", patientId)
        .eq("medecin_id", medecinId)
        .in("statut", ["en_attente", "approuvee"])
        .maybeSingle();
      if (existing) {
        throw new Error("Vous avez déjà une demande en cours ou acceptée pour ce médecin.");
      }
      const { error } = await supabase.from("demandes").insert({
        patient_id: patientId,
        medecin_id: medecinId,
        statut: "en_attente",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mes-demandes", patientId] });
      toast.success("Demande envoyée au médecin.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Impossible d'envoyer la demande.");
    },
  });

  // Annuler demande
  const { mutate: annulerDemande } = useMutation({
    mutationFn: async (demandeId: string) => {
      const { error } = await supabase
        .from("demandes")
        .update({ statut: "annulee", updated_at: new Date().toISOString() })
        .eq("id", demandeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mes-demandes", patientId] });
    },
  });

  const getDemandeForMedecin = (medecinId: string) =>
    demandes?.find((d) => d.medecin_id === medecinId);

  const StatusButton = ({ medecin }: { medecin: Medecin }) => {
    const demande = getDemandeForMedecin(medecin.id);

    if (!demande || demande.statut === "annulee" || demande.statut === "refusee") {
      return (
        <button
          onClick={() => choisirMedecin(medecin.id)}
          disabled={isPending || !patientId}
          className="mt-2 w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:brightness-110 transition-all disabled:opacity-50"
        >
          Choisir ce médecin
        </button>
      );
    }

    if (demande.statut === "en_attente") {
      return (
        <div className="mt-2 flex gap-2">
          <div className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-yellow-500/10 text-yellow-600 text-xs font-medium">
            <Clock className="w-3.5 h-3.5" /> En attente
          </div>
          <button
            onClick={() => annulerDemande(demande.id)}
            className="px-3 py-2 rounded-xl bg-muted text-muted-foreground text-xs hover:text-destructive transition-colors"
          >
            Annuler
          </button>
        </div>
      );
    }

    if (demande.statut === "approuvee") {
      return (
        <div className="mt-2 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500/10 text-green-600 text-xs font-medium">
          <CheckCircle className="w-3.5 h-3.5" /> Votre médecin
        </div>
      );
    }

    if (demande.statut === "refusee") {
      return (
        <div className="mt-2 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
          <XCircle className="w-3.5 h-3.5" /> Refusée
        </div>
      );
    }

    return null;
  };

  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Médecins disponibles</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Choisissez un médecin pour vous suivre sur SmartGuardian
          </p>
        </motion.div>

        {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(medecins || []).map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold text-base">
                    {m.utilisateurs?.nom?.charAt(0) ?? "?"}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-card-foreground truncate">
                    {m.utilisateurs?.nom ?? "—"}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Stethoscope className="w-3 h-3 text-primary" />
                    <span className="text-xs text-primary">{m.specialite}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <BadgeCheck className="w-3.5 h-3.5 text-safe flex-shrink-0" />
                  <span>Licence : {m.numero_licence}</span>
                </div>
                {m.utilisateurs?.telephone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{m.utilisateurs.telephone}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground truncate">
                  {m.utilisateurs?.email}
                </p>
              </div>

              <StatusButton medecin={m} />
            </motion.div>
          ))}

          {!isLoading && (medecins || []).length === 0 && (
            <div className="md:col-span-2 text-center py-12 text-muted-foreground text-sm">
              Aucun médecin enregistré pour le moment.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MesMedecins;