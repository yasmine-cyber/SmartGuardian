-- =============================================================================
-- SmartGuardian – Politiques RLS pour que le médecin voie ses patients
-- =============================================================================
-- À exécuter dans Supabase : SQL Editor → New query → coller et Run.
-- Ces politiques permettent :
-- 1. Au médecin de LIRE les lignes de la table "patients" où medecin_id = lui
-- 2. Au médecin de METTRE À JOUR medecin_id sur un patient quand il accepte une demande
-- =============================================================================

-- Activer RLS sur les tables si ce n'est pas déjà fait
ALTER TABLE IF EXISTS public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.demandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.utilisateurs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Table: patients
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "patients_select_own" ON public.patients;
DROP POLICY IF EXISTS "patients_select_doctor" ON public.patients;
DROP POLICY IF EXISTS "patients_update_doctor_on_demande" ON public.patients;
DROP POLICY IF EXISTS "patients_update_own" ON public.patients;

-- Le patient peut lire sa propre ligne (user_id = auth.uid())
CREATE POLICY "patients_select_own"
  ON public.patients FOR SELECT
  USING (user_id = auth.uid());

-- Le médecin peut lire les lignes des patients qui lui sont assignés (medecin_id = auth.uid())
CREATE POLICY "patients_select_doctor"
  ON public.patients FOR SELECT
  USING (medecin_id = auth.uid());

-- Le médecin peut mettre à jour une ligne patient UNIQUEMENT s'il a une demande en attente pour ce patient
-- (permet de mettre à jour medecin_id lors de l'acceptation)
CREATE POLICY "patients_update_doctor_on_demande"
  ON public.patients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.demandes d
      WHERE d.patient_id = patients.id
        AND d.medecin_id = auth.uid()
        AND d.statut = 'en_attente'
    )
  );

-- Le patient peut mettre à jour sa propre ligne (ex: profil)
CREATE POLICY "patients_update_own"
  ON public.patients FOR UPDATE
  USING (user_id = auth.uid());

-- (Optionnel) Admins : tout lire. Décommentez si vous avez un rôle admin en base.
-- CREATE POLICY "patients_select_admin"
--   ON public.patients FOR SELECT
--   USING (
--     EXISTS (SELECT 1 FROM public.utilisateurs u WHERE u.id = auth.uid() AND u.role = 'admin')
--   );

-- -----------------------------------------------------------------------------
-- Table: demandes
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "demandes_select_patient" ON public.demandes;
DROP POLICY IF EXISTS "demandes_select_doctor" ON public.demandes;
DROP POLICY IF EXISTS "demandes_insert_patient" ON public.demandes;
DROP POLICY IF EXISTS "demandes_update_doctor" ON public.demandes;
DROP POLICY IF EXISTS "demandes_update_patient" ON public.demandes;

-- Le patient peut lire ses propres demandes
CREATE POLICY "demandes_select_patient"
  ON public.demandes FOR SELECT
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- Le médecin peut lire les demandes qui lui sont adressées
CREATE POLICY "demandes_select_doctor"
  ON public.demandes FOR SELECT
  USING (medecin_id = auth.uid());

-- Le patient peut créer une demande (patient_id doit être son propre id dans patients)
CREATE POLICY "demandes_insert_patient"
  ON public.demandes FOR INSERT
  WITH CHECK (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    AND medecin_id IS NOT NULL
  );

-- Le médecin peut mettre à jour les demandes qui lui sont adressées (accepter / refuser)
CREATE POLICY "demandes_update_doctor"
  ON public.demandes FOR UPDATE
  USING (medecin_id = auth.uid());

-- Le patient peut mettre à jour ses demandes (ex: annuler)
CREATE POLICY "demandes_update_patient"
  ON public.demandes FOR UPDATE
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- Table: utilisateurs
-- Le médecin a besoin de lire nom, prenom, telephone des patients qu'il suit
-- (jointure utilisateurs dans la requête patients)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "utilisateurs_select_own" ON public.utilisateurs;
DROP POLICY IF EXISTS "utilisateurs_select_doctor_patients" ON public.utilisateurs;

-- Chacun peut lire son propre profil
CREATE POLICY "utilisateurs_select_own"
  ON public.utilisateurs FOR SELECT
  USING (id = auth.uid());

-- Le médecin peut lire les profils des utilisateurs qui sont ses patients assignés
CREATE POLICY "utilisateurs_select_doctor_patients"
  ON public.utilisateurs FOR SELECT
  USING (
    id IN (SELECT user_id FROM public.patients WHERE medecin_id = auth.uid())
  );

-- =============================================================================
-- Après avoir exécuté ce script :
-- 1. Vérifiez dans Table Editor → patients / demandes / utilisateurs → RLS
-- 2. Réessayez côté médecin : accepter une demande puis rafraîchir la liste patients
-- =============================================================================
