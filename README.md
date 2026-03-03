# SmartGuardian

Projet de télésurveillance médicale.

Cette application utilise :

- React + Vite pour le frontend
- Supabase pour le backend (auth, base de données, realtime, storage)
- PWA pour un accès mobile et offline

## Objectif

Permettre le suivi médical des patients avec :

- mesures biométriques (HR, SpO₂, température…)
- alertes temps réel pour le médecin
- interface web et mobile-friendly

## Frontend

Le frontend se trouve dans le dossier `heart-guard-nexus/`.

### Lancer en local

```bash
cd heart-guard-nexus
npm install
npm run dev
```

## Auth & rôles (Supabase)

Le système utilise un type enum `user_role` côté Supabase :

- `admin`
- `medecin`
- `patient`
- `proche` (aidant)

### Inscription (signup)

- Seuls **`patient`** et **`proche`** sont proposés à l’inscription dans l’UI.
- **`admin`** et **`medecin`** ne s’inscrivent pas depuis l’interface : ils sont créés/provisionnés par un admin (ex. invitation email), puis se connectent.

### Trigger de création du profil

Un trigger `handle_new_user` (sur `auth.users`) crée automatiquement la ligne correspondante dans `public.utilisateurs` à l’inscription, en lisant `raw_user_meta_data` (ex. `role`, `nom`).

### Dépannage : erreur 500 au signup

Si `POST /auth/v1/signup` renvoie **500** avec `unexpected_failure`, la cause est généralement dans le trigger `handle_new_user` (ex. **RLS**, permissions, contrainte).

- Vérifier dans Supabase **Database → Logs → Errors** le message Postgres exact après une tentative de signup.