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

      // Check if user exists in `utilisateurs`
      const { data: existing } = await supabase
        .from("utilisateurs")
        .select("role, nom, prenom, telephone")
        .eq("id", user.id)
        .single();

      if (!existing) {
        // New Google user → insert and complete profile
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

      // Incomplete profile → complete it
      const isIncomplete = !existing.telephone || !existing.nom || existing.nom === "Utilisateur";
      if (isIncomplete) {
        navigate("/complete-profile");
        return;
      }

      // ── Patient: check payment + device request status ──
      if (existing.role === "patient") {
        const { data: patientRow } = await supabase
          .from("patients")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!patientRow) {
          navigate("/checkout");
          return;
        }

        // Get latest device request
        const { data: deviceReq } = await supabase
          .from("device_requests")
          .select("payment_status, status, device_id")
          .eq("patient_id", patientRow.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // No request or not paid yet → send to checkout
        if (!deviceReq || deviceReq.payment_status !== "paid") {
          navigate("/checkout");
          return;
        }

        // Paid but not yet approved → send to pending page
        if (deviceReq.status === "pending") {
          navigate("/pending");
          return;
        }

        // Approved: check if device was activated via mobile QR scan
        if (deviceReq.status === "approved" && deviceReq.device_id) {
          const { data: device } = await supabase
            .from("devices")
            .select("actif")
            .eq("id", deviceReq.device_id)
            .single();

          if (!device?.actif) {
            // Device assigned but QR not scanned yet → stay on pending
            navigate("/pending");
            return;
          }
          // Device active → fall through to dashboard
        }

        // Rejected → back to checkout so they can re-request
        if (deviceReq.status === "rejected") {
          navigate("/checkout");
          return;
        }

        // Completed or active device → go to dashboard
        navigate("/patient");
        return;
      }

      // Role-based redirect for non-patients
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