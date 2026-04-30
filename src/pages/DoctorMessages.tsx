import { useState } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import Messagerie from "@/components/Messagerie";
import FamilyMessagerie from "@/components/FamilyMessagerie";

type Tab = "patients" | "proches";

const DoctorMessages = () => {
  const [tab, setTab] = useState<Tab>("patients");

  return (
    <DashboardLayout role="doctor">
      <div className="space-y-6 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Échangez avec vos patients et leurs proches
          </p>
        </motion.div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setTab("patients")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "patients"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Patients
          </button>
          <button
            type="button"
            onClick={() => setTab("proches")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "proches"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Proches
          </button>
        </div>

        {tab === "patients" ? (
          <Messagerie role="doctor" dossierLink="/doctor/patients" />
        ) : (
          <FamilyMessagerie role="doctor" />
        )}
      </div>
    </DashboardLayout>
  );
};

export default DoctorMessages;