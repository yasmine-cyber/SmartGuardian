import { motion } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import Messagerie from "@/components/Messagerie";

const DoctorMessages = () => {
  return (
    <DashboardLayout role="doctor">
      <div className="space-y-6 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Échangez avec vos patients
          </p>
        </motion.div>
        <Messagerie role="doctor" dossierLink="/doctor/patients" />
      </div>
    </DashboardLayout>
  );
};

export default DoctorMessages;
