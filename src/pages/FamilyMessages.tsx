import { motion } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import FamilyMessagerie from "@/components/FamilyMessagerie";

const FamilyMessages = () => {
  return (
    <DashboardLayout role="family">
      <div className="space-y-6 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Messagerie</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Échangez avec le médecin de votre proche
          </p>
        </motion.div>
        <FamilyMessagerie role="proche" />
      </div>
    </DashboardLayout>
  );
};

export default FamilyMessages;