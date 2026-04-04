-- =============================================================================
-- Corriger l'erreur "new row violates row-level security policy" sur demandes
-- (patient qui envoie une demande à un médecin)
-- Copier-coller dans Supabase → SQL Editor → Run
-- =============================================================================

-- Option 1 : Recréer la politique INSERT (si elle manque ou a été supprimée)
DROP POLICY IF EXISTS "demandes_insert_patient" ON public.demandes;

CREATE POLICY "demandes_insert_patient"
  ON public.demandes FOR INSERT
  WITH CHECK (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    AND medecin_id IS NOT NULL
  );

-- =============================================================================
-- Si ça ne suffit pas : utiliser une fonction (contourne certains cas RLS)
-- Décommentez le bloc ci-dessous et exécutez-le, puis recréez la policy
-- =============================================================================
/*
CREATE OR REPLACE FUNCTION public.get_my_patient_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT id FROM public.patients WHERE user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_patient_id() TO authenticated;

DROP POLICY IF EXISTS "demandes_insert_patient" ON public.demandes;

CREATE POLICY "demandes_insert_patient"
  ON public.demandes FOR INSERT
  WITH CHECK (
    patient_id = public.get_my_patient_id()
    AND medecin_id IS NOT NULL
  );
*/
