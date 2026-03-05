import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldX, ArrowLeft } from "lucide-react";

const Unauthorized = () => (
  <div className="min-h-screen flex items-center justify-center bg-background p-6">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center max-w-md"
    >
      <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <ShieldX className="w-8 h-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Accès refusé</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Vous n'avez pas les permissions nécessaires pour accéder à cette page.
      </p>
      <Link
        to="/login"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:brightness-110 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la connexion
      </Link>
    </motion.div>
  </div>
);

export default Unauthorized;