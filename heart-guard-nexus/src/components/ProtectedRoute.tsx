import { useEffect, useState, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const [status, setStatus] = useState<"loading" | "authorized" | "unauthorized" | "unauthenticated">("loading");

  useEffect(() => {
    const checkAuth = async () => {
      // getSession is more reliable than getUser for checking auth state
      const { data: { session } } = await supabase.auth.getSession();

      if (!session || !session.user) {
        setStatus("unauthenticated");
        return;
      }

      const { data, error } = await supabase
        .from("utilisateurs")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (error || !data) {
        setStatus("unauthenticated");
        return;
      }

      if (allowedRoles.includes(data.role)) {
        setStatus("authorized");
      } else {
        setStatus("unauthorized");
      }
    };

    checkAuth();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (status === "unauthorized") {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;