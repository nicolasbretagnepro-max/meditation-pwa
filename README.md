# Respire — PWA méditation & respiration

V1 ambitieuse mais statique : web app installable sur iPhone, hébergeable gratuitement sur GitHub Pages.

## Fonctionnalités

- choix d'état émotionnel
- recommandation automatique de séance
- bibliothèque de séances respiration / méditation / sommeil / énergie
- timer guidé avec animation respiratoire
- mesure avant / après : stress, énergie, clarté
- historique local
- statistiques simples
- export JSON des données
- fonctionnement hors ligne via service worker
- installation iPhone via "Ajouter à l'écran d'accueil"

## Déploiement GitHub Pages

1. Créer un repository GitHub, par exemple `respire-pwa`.
2. Ajouter tous les fichiers de ce dossier à la racine du repository.
3. Aller dans `Settings` > `Pages`.
4. Dans `Build and deployment`, choisir `Deploy from a branch`.
5. Choisir la branche `main`, dossier `/root`.
6. Attendre la publication.
7. Ouvrir l'URL GitHub Pages sur iPhone avec Safari.
8. Partager > Ajouter à l'écran d'accueil.

## Modifier les séances

Les séances sont dans `data/sessions.json`.

Champs principaux :

- `title` : nom de la séance
- `category` : catégorie affichée
- `type` : Respiration ou Méditation
- `duration` : durée en secondes
- `moods` : états pour lesquels la séance peut être recommandée
- `pattern` : phases du timer
- `guidance` : phrases affichées pendant la séance

## Limites V1

- pas de compte utilisateur
- pas de synchronisation cloud
- pas de connexion Garmin
- notifications non activées
- données stockées uniquement dans le navigateur de l'appareil

## Roadmap recommandée

### V1.1
- ajout d'une vraie page d'onboarding
- rappel local configurable
- plus de séances
- meilleur tableau de progression

### V2
- backend Supabase ou Vercel
- authentification
- sauvegarde cloud
- préparation intégration Garmin Health API

### V3
- recommandations basées sur sommeil, BPM, stress Garmin
- notifications intelligentes
- éventuelle app Garmin Connect IQ
