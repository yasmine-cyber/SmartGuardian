import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Heart, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="text-center px-4 max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6">
          <Heart className="w-8 h-8" />
        </div>
        <h1 className="mb-2 text-5xl font-bold text-foreground">404</h1>
        <p className="mb-6 text-lg text-muted-foreground">
          Oups ! Cette page n'existe pas ou a été déplacée.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-medium hover:brightness-110 transition-all"
        >
          <Home className="w-4 h-4" />
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
