import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader } from "lucide-react";
import { supabase } from "@/lib/supabase";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        navigate("/login");
        return;
      }

      const user = session.user;
      const metadata = user.user_metadata || {};

      // Extract name from Google metadata
      const fullName: string = metadata.full_name || metadata.name || "";
      const parts = fullName.trim().split(/\s+/);
      const prenom = parts[0] || "";
      const nom = parts.slice(1).join(" ") || "";

      // Check if user exists in utilisateurs
      const { data: existing } = await supabase
        .from("utilisateurs")
        .select("role, nom, prenom, telephone")
        .eq("id", user.id)
        .single();

      if (!existing) {
        // New Google user — insert with extracted name
        await supabase.from("utilisateurs").insert({
          id: user.id,
          email: user.email,
          nom: nom || "Utilisateur",
          prenom: prenom || "",
          role: "patient",
        });

        // Always redirect to complete profile for new Google users
        navigate("/complete-profile");
        return;
      }

      // Existing user — check if profile is complete
      const isIncomplete = !existing.telephone || !existing.nom || existing.nom === "Utilisateur";
      if (isIncomplete) {
        navigate("/complete-profile");
        return;
      }

      // Redirect based on role
      const dashboardMap: Record<string, string> = {
        patient: "/patient",
        medecin: "/doctor",
        proche: "/family",
        admin: "/admin",
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