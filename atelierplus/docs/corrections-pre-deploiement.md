# Corrections avant déploiement

1. **Isolation des ateliers** : un compte sans atelier ne voit plus aucune donnée (`/api/data`, `/api/sync`, `/api/invitations`). Avant, il voyait toutes les lignes de tous les ateliers.
2. **Invitations anciennes** sans atelier refusées (elles rattachaient le membre au premier atelier trouvé).
3. **Numérotation CMD-xxx par atelier** (verrou et lecture par atelier) ; index unique `(atelier_id, order_number)` au lieu d'un index global. Relancer `npx drizzle-kit push`.
4. **Cookie de session** `SameSite=Lax` (au lieu de `None`) : protège contre les requêtes forgées depuis un autre site. Le jeton Bearer reste utilisé en secours.
5. **Clé de signature** : sans `AUTH_SECRET`, tout environnement de production refuse de démarrer les sessions (avant : seulement Vercel Production).
6. **Code à 6 chiffres** : compteur d'essais incrémenté de façon atomique (plus de contournement par requêtes parallèles).

## Numéros de téléphone et pays

- Nouveau sélecteur de pays (Togo +228 par défaut) sur tous les champs téléphone : connexion, inscription, client, membre d'équipe, mot de passe oublié (`src/components/phone-field.tsx`, `src/lib/countries.ts`).
- Les numéros sont enregistrés au format international compact (`+22890123456`). Coller un numéro complet (`+228 90 12 34 56`) change le pays automatiquement.
- Compatibilité : un compte créé avant le sélecteur avec un numéro togolais sans `+228` se connecte toujours.
- Liens WhatsApp : un numéro togolais à 8 chiffres sans indicatif est complété par 228.
- Contact « Autre ligne » corrigé : +228 71572302.

## Signature de l'application

- Les reçus (texte, PDF, impression, partage WhatsApp) ne contiennent plus aucune information sur le concepteur ni la mention AtelierPLUS.
- La photo de l'auteur (`public/images/auteur.jpg`) apparaît dans le panneau À propos (à la place des initiales « AK ») et à côté de la signature du pied de page. Elle est mise en cache pour le hors-ligne.
