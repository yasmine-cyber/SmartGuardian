import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader } from "lucide-react";
import { supabase } from "@/lib/supabase";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      // Supabase lit automatiquement le token depuis l'URL (hash ou query param)
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        navigate("/login");
        return;
      }

      const user = session.user;
      const metadata = user.user_metadata || {};

      // Extraire le nom depuis les métadonnées Google
      const fullName: string = metadata.full_name || metadata.name || "";
      const parts = fullName.trim().split(/\s+/);
      const prenom = parts[0] || "";
      const nom = parts.slice(1).join(" ") || "";

      // Vérifier si l'utilisateur existe dans `utilisateurs`
      const { data: existing } = await supabase
        .from("utilisateurs")
        .select("role, nom, prenom, telephone")
        .eq("id", user.id)
        .single();

      if (!existing) {
        // Nouvel utilisateur Google — insérer et aller compléter le profil
        await supabase.from("utilisateurs").insert({
          id: user.id,
          email: user.email,
          nom: nom || "Utilisateur",
          prenom: prenom || "",
          role: "patient",
        });
        navigate("/complete-profile");
        return;
      }

      // Profil incomplet → compléter
      const isIncomplete = !existing.telephone || !existing.nom || existing.nom === "Utilisateur";
      if (isIncomplete) {
        navigate("/complete-profile");
        return;
      }

      // ── Patient : vérifier si le paiement a déjà été effectué ──
      if (existing.role === "patient") {
        const { data: patientRow } = await supabase
          .from("patients")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (patientRow) {
          const { data: deviceReq } = await supabase
            .from("device_requests")
            .select("payment_status")
            .eq("patient_id", patientRow.id)
            .eq("payment_status", "paid")
            .maybeSingle();

          if (!deviceReq) {
            // Pas encore payé → rediriger vers la page de paiement
            navigate("/checkout");
            return;
          }
        } else {
          // Ligne patient manquante (cas rare) → aller au checkout quand même
          navigate("/checkout");
          return;
        }
      }

      // Redirection selon le rôle
      const dashboardMap: Record<string, string> = {
        patient: "/patient",
        medecin: "/doctor",
        proche:  "/family",
        admin:   "/admin",
      };

      navigate(dashboardMap[existing.role] || "/patient");
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Connexion en cours...</p>
      </div>
    </div>
  );
};

export default AuthCallback;