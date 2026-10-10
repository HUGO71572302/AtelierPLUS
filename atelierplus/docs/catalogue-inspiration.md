# Catalogue d’inspiration AtelierPLUS

## Nouvelle sélection

12 suggestions intégrées : les quatre fiches précédentes sont conservées et huit coupes sont ajoutées.

- Robe sirène indigo
- Robe portefeuille en wax
- Grand boubou indigo
- Jupe midi à plis creux
- Chemisier manches ballon
- Chemise à col officier
- Pantalon palazzo fluide
- Ensemble péplum & jupe

Les fiches sont dans `src/lib/inspiration-catalog.ts`. Elles sont disponibles pour tous les ateliers sans écraser leurs modèles personnels en PostgreSQL. La commande créée depuis une fiche reprend le type de vêtement, le titre et les notes de confection, enregistrés via l’API habituelle.

## Références Pinterest consultées

Les résultats indexés et pages publiques suivantes ont été consultés pour sélectionner les thèmes. Certaines pages Pinterest ne livrent que leur titre aux outils de lecture : il ne s’agit pas d’un accès authentifié aux tableaux ni d’un import d’épingles.

1. https://fr.pinterest.com/ideas/robe-sir%C3%A8ne-en-pagne/935962593755/
2. https://fr.pinterest.com/ideas/robe-portefeuille/941416335703/
3. https://www.pinterest.com/baf78/ensemble-homme/
4. https://www.pinterest.com/ideas/jupe-%C3%A0-plis-creux-patron/904488368793/
5. https://fr.pinterest.com/ideas/chemisier-manche-bouffante/933616492485/
6. https://fr.pinterest.com/ideas/chemise-col-officier-homme/929664575832/
7. https://fr.pinterest.com/ideas/pantalons-palazzo/911874719816/
8. https://fr.pinterest.com/ideas/ensemble-jupe-et-corsage-en-pagne/946455228161/

Chaque nouvelle fiche conserve un lien explicite vers la piste consultée, ouvert dans un nouvel onglet avec `noopener noreferrer`. Ces liens ne transportent aucune donnée de client. Pinterest peut demander une connexion à l’utilisateur et reste indisponible sans réseau.

## Visuels et conseils

Aucune photographie Pinterest n’est recopiée ou hotlinkée. Les cinq nouveaux visuels raster sont des illustrations générées pour AtelierPLUS. Les trois autres sont des croquis SVG originaux (col officier, palazzo, péplum). Les quatre visuels existants sont également des illustrations générées. L’interface les identifie comme tels et distingue clairement références externes et illustrations locales.

Les nouvelles images raster sont optimisées en WebP 768 × 1152 et chargées paresseusement. Les cadres portrait montrent les ourlets au lieu de recadrer le vêtement en paysage. Les conseils de coupe sont rédigés pour l’atelier : ce ne sont pas des patrons gradés et ils ne garantissent pas un métrage. Un essayage reste nécessaire.

## Tests

`npx playwright test tests/browser/inspiration-catalog.spec.ts`

Le runtime de production doit être lancé et `DATABASE_URL` doit correspondre à sa base de test. Le test crée et supprime uniquement son atelier synthétique via les routes authentifiées et Drizzle.

Les tests couvrent au format ordinateur et mobile :
- 12 fiches, huit nouveautés, sept types de vêtements, validité des codes de mesure et présence des fichiers ;
- chargement des images et liens sources ;
- recherche sans accents, filtres vêtement/occasion et état vide ;
- commande préremplie puis persistée en PostgreSQL ;
- ajout d’une création personnelle avec photo, conservée après rechargement.
