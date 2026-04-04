-- =============================================================================
-- SmartGuardian – Code d'invitation proche (patient → proche)
-- =============================================================================
-- À exécuter dans Supabase : SQL Editor → New query → coller et Run.
-- Permet au patient de générer un code, et au proche de lier son compte au patient.
-- =============================================================================

-- 1. Colonnes sur la table patients pour le code d'invitation
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS invite_code text,
  ADD COLUMN IF NOT EXISTS invite_code_expires_at timestamptz;

-- Index pour la recherche par code (optionnel, utile si beaucoup de patients)
CREATE INDEX IF NOT EXISTS idx_patients_invite_code
  ON public.patients (invite_code)
  WHERE invite_code IS NOT NULL AND invite_code_expires_at > now();

-- 2. RLS : le patient peut lire/écrire ses propres colonnes invite_* (déjà couvert par patients_update_own / patients_select_own)
-- Aucune politique supplémentaire nécessaire : le patient met à jour sa propre ligne.

-- 3. Fonction : consommer un code d'invitation (appelée par le proche)
-- Crée le lien proche_patient et invalide le code.
CREATE OR REPLACE FUNCTION public.consume_invite_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
  v_proche_id uuid;
  v_expires_at timestamptz;
BEGIN
  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Code manquant');
  END IF;

  v_proche_id := auth.uid();
  IF v_proche_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifié');
  END IF;

  -- Trouver le patient avec ce code, non expiré
  SELECT id, invite_code_expires_at
  INTO v_patient_id, v_expires_at
  FROM public.patients
  WHERE invite_code = trim(p_code)
    AND invite_code_expires_at IS NOT NULL
    AND invite_code_expires_at > now()
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Code invalide ou expiré');
  END IF;

  -- Éviter doublon : ne pas insérer si le lien existe déjà
  IF EXISTS (
    SELECT 1 FROM public.proche_patient
    WHERE patient_id = v_patient_id AND proche_id = v_proche_id
  ) THEN
    -- Invalider le code quand même
    UPDATE public.patients
    SET invite_code = NULL, invite_code_expires_at = NULL
    WHERE id = v_patient_id;
    RETURN jsonb_build_object('ok', true, 'already_linked', true);
  END IF;

  -- Créer le lien proche_patient
  INSERT INTO public.proche_patient (patient_id, proche_id, lien_parente, contact_prioritaire)
  VALUES (v_patient_id, v_proche_id, NULL, false);

  -- Invalider le code après utilisation
  UPDATE public.patients
  SET invite_code = NULL, invite_code_expires_at = NULL
  WHERE id = v_patient_id;

  RETURN jsonb_build_object('ok', true, 'patient_id', v_patient_id);
END;
$$;

-- Droits d'exécution pour les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.consume_invite_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_invite_code(text) TO service_role;

-- =============================================================================
-- RLS sur proche_patient (si la table n'a pas encore de politiques)
-- Le proche peut voir les lignes où il est proche_id ; le patient peut voir les lignes où il est patient_id.
-- =============================================================================
ALTER TABLE IF EXISTS public.proche_patient ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proche_patient_select_proche" ON public.proche_patient;
CREATE POLICY "proche_patient_select_proche"
  ON public.proche_patient FOR SELECT
  USING (proche_id = auth.uid());

DROP POLICY IF EXISTS "proche_patient_select_patient" ON public.proche_patient;
CREATE POLICY "proche_patient_select_patient"
  ON public.proche_patient FOR SELECT
  USING (
    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

-- L'insert est fait par la fonction consume_invite_code (SECURITY DEFINER).
-- On peut autoriser l'insert pour le proche lui-même si on préfère faire l'insert côté client ;
-- ici tout passe par la RPC pour vérifier le code.
-- Aucune policy INSERT pour les utilisateurs : seul consume_invite_code insère.

COMMENT ON FUNCTION public.consume_invite_code(text) IS 'Utilisé par un proche pour lier son compte à un patient via le code fourni par le patient.';
