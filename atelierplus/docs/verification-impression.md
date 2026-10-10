# Régression : contexte d’impression absent

## Cause vérifiée

`PrintProvider` était importé dans le layout racine mais n’était pas rendu autour des pages. `PlanSettingsView` (utilisé par Réglages et Abonnement), `OrderDetailView` et la fiche de partage appellent `usePrint` dès leur rendu : leur ouverture levait donc `usePrint must be used inside <PrintProvider>`.

Un test Chromium a reproduit le message avant la correction. La présence de la fonction dans un bundle, le healthcheck et une compilation réussie ne suffisent pas à vérifier le contexte React d’une fenêtre ouverte après connexion.

## Architecture à conserver

- `src/app/layout.tsx` rend `AppProviders` autour de toutes les routes.
- `src/app/providers.tsx` rend **un seul** `PrintProvider`, sans condition de connexion ou de section, au-dessus du garde d’environnement et des pages.
- `src/components/print/print-document.tsx` possède le document d’impression et son portail, enfant direct de `body`.
- `usePrint` conserve une assertion en l’absence du fournisseur : ne pas remplacer cette erreur par une impression silencieuse de toute l’application.

Le portail reste monté jusqu’à `afterprint`, la sortie du média impression ou la fermeture explicite. Certains navigateurs mobiles retournent de `window.print()` avant que la boîte d’impression ait terminé : vider le portail immédiatement dans un `finally` peut produire une feuille vide.

Les règles masquant l’application à l’impression s’activent uniquement pendant un document préparé (`data-atelier-printing`). Les réglages, comptes et caches IndexedDB ne sont pas supprimés lors de cette correction.

## Vérification navigateur reproductible

1. Installer les dépendances du projet.
2. Préparer Chromium et ses bibliothèques : `npx playwright install --with-deps chromium`.
3. Démarrer l’application de production avec le runtime géré.
4. Exécuter `npx playwright test`.

La configuration utilise par défaut `http://127.0.0.1:3000`; `PLAYWRIGHT_BASE_URL` permet de désigner un autre serveur. **La variable `DATABASE_URL` du test doit viser la même base que le serveur**, car le nettoyage des seules fixtures de test utilise Drizzle.

Le test crée un nouvel atelier synthétique, un client, une commande, des mesures et un acompte via les vraies API. Il se connecte avec ce compte, puis nettoie l’atelier par son UUID exact. Il n’utilise ni ne modifie un compte utilisateur existant.

Scénarios, au format ordinateur et mobile Chromium :

- navigation Réglages → Abonnement → Réglages sans erreur React ;
- sauvegarde du profil, rechargement et lecture des valeurs ;
- fiche du jour imprimée seule, puis deuxième impression ;
- ouverture de la fiche de coupe et impression ciblée ;
- ouverture du reçu, téléchargement d’un fichier PDF et impression ciblée ;
- rechargement hors-ligne avec accès à Réglages et Abonnement, et impression locale.

Seule la boîte native du système est simulée : le contexte React, les API, la base, le portail et le CSS sont réels. Le média `print` et la génération PDF de Chromium vérifient que le tableau de bord n’est pas visible dans le document. Cela ne remplace pas un essai sur une imprimante physique ou sur Safari iOS.

Les captures et PDF de tests sont déposés dans `/tmp/atelierplus-browser-results`, hors des fichiers publics du site.
