import { motion } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import Messagerie from "@/components/Messagerie";

const PatientMessages = () => {
  return (
    <DashboardLayout role="patient">
      <div className="space-y-6 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Messagerie</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Échangez avec votre médecin
          </p>
        </motion.div>
        <Messagerie role="patient" />
      </div>
    </DashboardLayout>
  );
};

export default PatientMessages;
