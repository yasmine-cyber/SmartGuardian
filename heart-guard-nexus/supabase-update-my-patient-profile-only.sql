-- =============================================================================
-- À ajouter uniquement (maladies / traitements = arrays dans la table patients)
-- Copier-coller dans Supabase → SQL Editor → Run
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_my_patient_profile(
  p_date_naissance date,
  p_adresse text,
  p_maladies text[],
  p_antecedents text,
  p_traitements text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_count int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifié');
  END IF;

  SELECT 1 INTO v_count FROM public.patients WHERE user_id = v_uid;
  IF v_count IS NULL OR v_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Fiche patient introuvable');
  END IF;

  UPDATE public.patients
  SET
    date_naissance = p_date_naissance,
    adresse = COALESCE(p_adresse, ''),
    maladies = COALESCE(p_maladies, '{}'),
    antecedents = COALESCE(p_antecedents, ''),
    traitements = COALESCE(p_traitements, '{}'),
    updated_at = NOW()
  WHERE user_id = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_patient_profile(date, text, text[], text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_patient_profile(date, text, text[], text, text[]) TO service_role;
