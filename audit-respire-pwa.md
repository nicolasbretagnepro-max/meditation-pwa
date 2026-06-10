# Audit complet — Respire PWA
*Expert méditation · méthodologie · engagement · UX · technique*

---

## Résumé exécutif

L'app est bien conçue pour une V1 : architecture propre, philosophie anti-perfectionnisme cohérente ("2 minutes comptent"), mesure avant/après légitime. Les fondations sont solides. Mais plusieurs problèmes bloquent la rétention réelle, et deux bugs techniques nuisent à l'expérience de séance.

---

## 1. Méthodologie — Qualité des séances

### Ce qui fonctionne bien

- **La séance "Reprise 2 minutes"** est le meilleur choix de design : elle anticipe la résistance ("la séance à faire quand tu n'as pas envie"). C'est une porte d'entrée à friction quasi nulle, alignée sur ce que la recherche montre (les micro-habitudes fonctionnent mieux que les objectifs ambitieux pour l'adhérence).
- **4-6 pour le stress** : choix correcte. L'expiration longue active le nerf vague → réponse parasympathique. Bonne implémentation.
- **Box breathing** : utilisé en milieu militaire et clinique pour la régulation rapide. Bien adapté au mood "dispersé".
- **Cohérence cardiaque 5-5** ("Énergie calme") : 6 cycles/minute, validé scientifiquement pour la variabilité de fréquence cardiaque. Parfaitement placé.
- **La mesure avant/après** (stress/énergie/clarté) est un vrai atout différenciant. C'est ce que font les apps professionnelles comme Waking Up ou Headspace Pro. La formule d'effet moyen `(stressAvant − stressAprès) + (clartéAprès − clartéAvant)` est raisonnable.

### Problèmes méthodologiques

**A. Guidance text : rotation cassée**

La phrase de guidance change selon `Math.floor((durée − restant) / 35) % guidance.length`. Conséquence : pour le "Scan corporel du soir" (600s, 6 phrases), les phrases se répètent après 3,5 minutes sur 10. L'utilisateur voit "Commence par les pieds" deux fois dans la même séance. C'est pédagogiquement faux : une méditation progressive ne doit pas boucler sur elle-même.

**Fix minimal** : distribuer les phrases uniformément sur la durée totale.
```js
const guidanceIndex = Math.floor(
  ((selectedSession.duration - remaining) / selectedSession.duration) * selectedSession.guidance.length
);
```

**B. Guidance du body scan trop squelettique**

6 phrases pour 10 minutes de pratique guidée, c'est insuffisant. Un body scan authentique couvre : pieds → mollets → genoux → cuisses → bassin → ventre → thorax → épaules → bras → mains → nuque → visage → sommet du crâne. Les 6 phrases actuelles s'arrêtent à "adoucis la mâchoire".

**C. 4-7-8 : risque pour les débutants**

Retenir 7 secondes est exigeant. Sans pratique préalable, ça peut induire une légère anxiété ou un effort qui contrecarre le but sédatif. À minima, ajouter une note dans la description : "Si la rétention de 7 secondes est inconfortable, commence à 4-5-6".

**D. Séances manquantes à fort intérêt**

| Type manquant | Intérêt |
|---|---|
| NSDR / Yoga Nidra | Récupération cognitive, reconnu par Stanford (Huberman) |
| Cohérence cardiaque 3×5 min | Format clinique standard, très facile à implémenter |
| Loving-kindness (metta) courte | Régulation émotionnelle, anxiété sociale |
| Scan corporel rapide 3 min | Version courte manquante |
| Méditation assise 10-20 min | Aucune longue méditation pure sans pattern respiratoire |
| "Soupir physiologique" | 2 inspirations + longue expiration, 1 cycle suffit, ultra-efficace pour le stress aigu |

**E. Aucun parcours progressif**

L'app traite toutes les séances comme équivalentes. Il n'y a pas de notion de niveau débutant/intermédiaire, ni de chemin recommandé pour quelqu'un qui commence. Beaucoup d'utilisateurs ne savent pas par où commencer.

---

## 2. Engagement & rétention

### Problème fondamental : aucun mécanisme de re-engagement

L'app est entièrement passive. Elle attend que l'utilisateur l'ouvre. Or la recherche comportementale est claire : sans cue externe, les habitudes de bien-être s'effondrent en moins de 3 semaines pour 80% des nouveaux utilisateurs.

**A. Pas d'onboarding** *(déjà identifié dans la roadmap)*

La première ouverture arrive directement sur l'interface sans contexte. L'utilisateur ne sait pas pourquoi cliquer sur une émotion, ce que représentent les statistiques, ni quel engagement il signe. Un onboarding en 3 écrans maximum suffirait :
1. Ce que fait Respire (30 secondes)
2. Choix d'un objectif (3, 5 ou 7 séances/semaine)
3. Première séance guidée immédiatement

**B. Pas de notifications** *(déjà identifié)*

Les PWA iOS supportent les Web Push Notifications depuis iOS 16.4 (2023). C'est faisable sans backend : la notification locale (Notification API avec ServiceWorker) suffit pour un rappel quotidien à heure fixe. C'est la fonctionnalité manquante avec le plus fort impact sur la rétention.

**C. Streak trop fragile**

Le streak actuel est binaire : un jour manqué = retour à 0. C'est démotivant, surtout pour une app qui prêche "la régularité souple vaut mieux qu'une série parfaite". Contradiction directe avec la philosophie affichée.

Solutions possibles :
- **Streak with grace period** : le streak survit à un seul jour manqué (comme Duolingo "streak shield")
- **Streak hebdomadaire** plutôt que journalier : si l'objectif est 5 séances/semaine, le streak compte des semaines réussies
- **Afficher les deux** : "8 jours actifs sur les 14 derniers" plutôt qu'un nombre absolu

**D. Objectif hebdomadaire invisible**

Le setting "objectif hebdomadaire" existe mais n'est nulle part matérialisé visuellement. L'utilisateur voit "3 séances / 7 j" mais ne sait pas si c'est bien ou non par rapport à son objectif de 5.

**Fix** : remplacer le chiffre brut par une progress bar dans la hero card. "3/5 séances cette semaine" avec un indicateur visuel est infiniment plus motivant.

**E. Citation pseudo-aléatoire**

`quotes[day % list.length]` → avec 4 citations neutrales, la même citation revient les jours 1, 5, 9, 13, 17... L'utilisateur qui ouvre l'app chaque matin voit la même citation toutes les 4 ouvertures. Utiliser un shuffle mémorisé (Fisher-Yates sur les indices non vus) serait bien meilleur.

**F. Aucun retour positif après séance**

La séance se termine sur "Séance validée" + sliders + textarea. C'est froid. Un message de complétion contextuel (selon l'effet mesuré, le streak, le nombre total) renforcerait la dopamine de complétion. Exemple : "Stress −3 points. Ton 28e séance. Continue comme ça."

---

## 3. Bugs techniques

### Bug 1 (critique) — Animation respiratoire saccadée

`updateActiveUI()` est appelé à chaque seconde et fait :
```js
visual.classList.remove("expand", "contract");
// puis immédiatement :
visual.classList.add("expand"); // ou "contract"
```

Le CSS a `transition: transform 1s ease-in-out`. En retirant et réajoutant la classe chaque seconde, la transition redémarre à chaque tick. Pour une phase "Inspire" de 4 secondes, le cercle n'atteint jamais pleinement 1.18x : la transition est interrompue et relancée chaque seconde. L'animation est jittery.

**Fix** : ne changer les classes qu'au changement de phase, pas à chaque tick.
```js
// Stocker le phaseIndex précédent
let prevPhaseIndex = -1;

function updateBreathVisual(phase) {
  if (phaseIndex === prevPhaseIndex) return; // pas de changement
  prevPhaseIndex = phaseIndex;
  visual.classList.remove("expand", "contract");
  void visual.offsetWidth; // force reflow pour relancer la transition
  if (/inspire|présence|respire/i.test(phase.label)) visual.classList.add("expand");
  else if (/expire|observe/i.test(phase.label)) visual.classList.add("contract");
}
```

### Bug 2 (biais de données) — Sliders post-séance pré-remplis à des valeurs "améliorées"

Les sliders avant séance sont à 5/5/5 (neutre). Les sliders après séance sont à 4/6/6 — soit déjà un stress réduit et une énergie/clarté augmentés avant que l'utilisateur n'ait bougé les curseurs. Tout utilisateur qui clique rapidement sur "Enregistrer" sans ajuster enregistre une amélioration fictive. Les statistiques "effet moyen" sont corrompues.

**Fix** : initialiser les sliders après à la même valeur qu'avant (copier les valeurs before → after au moment de showPostSession).

### Bug 3 (mineur) — Durée enregistrée si séance interrompue tôt

`durationSeconds: Math.max(durationDone, 30)` assure un minimum de 30 secondes, mais si quelqu'un lance une séance de 10 minutes et termine après 45 secondes, les stats "minutes totales" incluent 0,75 min au lieu de 0. C'est le comportement voulu (les minutes incomplètes comptent), mais il n'est pas documenté et peut surprendre.

---

## 4. UX & interface

**A. Navigation bas de page = ancres HTML, pas des vues**

Les 3 onglets naviguent vers des ancres (`#moodSection`, `#categoryFilter`, `#historyList`). Sur mobile, le défilement peut couper les sections de manière inattendue. "Suivi" fait défiler jusqu'au milieu d'une section — ce n'est pas une vraie page de suivi.

Recommandation V1.1 : implémenter 3 vues réelles avec `display:none/block` — Accueil, Séances, Suivi.

**B. Aucune indication de temps de la dernière séance**

La hero card montre streak + séances/7j + minutes, mais pas "ta dernière séance : il y a 2 jours". Ce contexte temporel est le meilleur déclencheur comportemental pour reprendre.

**C. Safe area iOS** ✅

Bien géré : `env(safe-area-inset-top)` et `env(safe-area-inset-bottom)` sont utilisés. Rien à corriger ici.

**D. Accessibilité**

Points positifs : `<dialog>` natif, aria-labels sur les boutons icon, focus-visible. Manquant : les mood buttons n'indiquent pas l'état sélectionné (pas de `aria-pressed`, pas de style visuel de sélection active).

**E. Aucun état de chargement**

Le `fetch("data/sessions.json")` initial n'a pas d'état de chargement visible. Sur une connexion lente, l'interface apparaît vide pendant une fraction de seconde. Mineur, mais un spinner ou skeleton améliore la perception de performance.

---

## 5. Priorités recommandées

### Impact immédiat (V1 patch)

1. **Corriger l'animation respiratoire** — bug visible à chaque séance
2. **Corriger les sliders post-séance** — corrompt les données de progression
3. **Corriger l'algorithme de guidance** — `/ durée * guidance.length` au lieu de `/ 35`
4. **Ajouter un message de complétion contextuel** — effet dopaminergique fort, 30 min de dev

### V1.1 — Rétention

5. **Notification locale configurable** — rappel quotidien à heure choisie via ServiceWorker
6. **Onboarding 3 écrans** — réduction du churn jour 1
7. **Progress bar objectif hebdomadaire** — dans la hero card
8. **Streak plus clément** — grace period d'un jour ou passage en streak hebdomadaire
9. **"Dernière séance il y a X jours"** — dans la hero card comme déclencheur

### V2 — Contenu & personnalisation

10. **+10 séances** : NSDR, metta, soupir physiologique, cohérence cardiaque 3×5, méditations longues
11. **Parcours débutant** : 7 jours guidés, une pratique par jour
12. **Navigation en vues réelles** (3 onglets)
13. **Recommandation apprenante** : pondérer les séances par l'effet moyen mesuré par l'utilisateur

---

## Note finale

La philosophie de l'app est sa vraie force : sobre, anti-perfectionniste, orientée régularité plutôt que performance. Ne la compromets pas en ajoutant trop de gamification ou de notifications agressives. L'enjeu est de trouver le juste niveau de friction positive — assez pour rappeler, pas assez pour fatiguer.
