# AtelierPLUS

Application de gestion simple pour un atelier de couture : clients, mensurations, commandes, acomptes, dépenses et équipe. Application Next.js, base PostgreSQL via Drizzle et PWA installable.

## Développement local

Prérequis : Node.js et un serveur PostgreSQL accessible.

1. Installer les dépendances : `npm install`
2. Copier `.env.example` vers `.env` et renseigner les URLs PostgreSQL et `AUTH_SECRET`.
3. Créer/appliquer les tables : `npx drizzle-kit push`
4. Démarrer le serveur : `npm run dev`
5. Ouvrir `http://localhost:3000`, puis créer le premier compte patron.

La création initiale est réservée au tout premier compte de la base. Le patron ajoute ensuite les comptes séparés de l’équipe depuis **Mon équipe**.

## Neon + Vercel

### 1. Créer la base Neon

- Créer un projet PostgreSQL dans la région **Frankfurt / eu-central-1**.
- Dans Neon, ouvrir **Connect** et copier les deux URLs de la branche de production :
  - connexion **poolée** (hôte contenant `-pooler`) pour l’application ;
  - connexion **directe** (hôte sans `-pooler`) pour Drizzle Kit.
- Ne pas inclure ces identifiants dans Git ou dans du code client.

### 2. Configurer les variables Vercel

Dans **Project → Settings → Environment Variables**, renseigner pour les environnements nécessaires (au minimum Production, puis Preview si utilisé) :

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | URL Neon poolée, avec `sslmode=require` |
| `DATABASE_URL_UNPOOLED` | URL Neon directe, avec `sslmode=require` |
| `AUTH_SECRET` | Secret aléatoire d’au moins 32 caractères |

Générer le secret depuis un terminal de confiance : `openssl rand -base64 32`. Garder la même valeur par environnement ; la remplacer invalidera les sessions existantes de cet environnement.

### 3. Déployer le schéma et l’application

Après avoir vérifié que l’URL directe cible **le bon projet et la bonne branche Neon**, appliquer le schéma :

```bash
npx drizzle-kit push
```

La configuration Drizzle privilégie `DATABASE_URL_UNPOOLED` pour les opérations de schéma et retombe sur `DATABASE_URL` en son absence. Vérifier ensuite que le déploiement Vercel contient les trois variables et que `/api/health` répond `{ "ok": true }`.

Connecter le projet Git à Vercel et déployer avec la commande de build `npm run build`. Après le premier déploiement, ouvrir l’adresse de l’application et créer le compte patron. Vérifier aussi l’ajout d’un membre, la lecture/écriture d’une commande et un paiement avec deux comptes distincts.

> **Usage commercial :** le cadrage AtelierPLUS prévoit de passer de Vercel Hobby au plan Pro avant d’utiliser l’application dans un atelier commercial. Confirmer les conditions et coûts des offres en vigueur avant le lancement réel.

## Installer la PWA

Ouvrir le site en HTTPS dans Chrome sur Android, puis choisir **Installer l’application** ou **Ajouter à l’écran d’accueil**. Le manifeste se trouve dans `public/manifest.json` et le service worker dans `public/sw.js`.

Sur iPhone, installer depuis Safari via **Partager → Sur l’écran d’accueil**. Le navigateur peut limiter la conservation longue du stockage hors-ligne ; exporter régulièrement une sauvegarde depuis le compte patron.

## Hors-ligne et sauvegarde

- Les fiches, mensurations, commandes, statuts et paiements sont mis en cache sur l’appareil, puis envoyés au serveur au retour du réseau quand l’application est ouverte.
- Les identifiants des brouillons sont créés sur l’appareil ; le serveur attribue le numéro final `CMD-001`, `CMD-002`, etc. pendant la synchronisation.
- Une modification de statut faite depuis une version obsolète déclenche un signalement de conflit ; elle ne remplace pas silencieusement la dernière révision serveur.
- Le service worker met en cache la coque et les ressources de l’application. Les routes API et les secrets restent exclusivement côté serveur.
- Depuis **Vue d’ensemble → Sauvegarder**, le patron peut exporter les données locales connues et la file d’opérations en attente en JSON. Garder ces sauvegardes dans un emplacement sûr.
- Pour la fiabilité de la synchronisation, laisser l’application ouverte au retour du réseau : la synchronisation automatique en arrière-plan lorsque la PWA est totalement fermée n’est pas configurée dans cette V1.

## Accès et rôles

- **Patron** : tableau de bord, soldes, paiements, dépenses, sauvegarde et gestion de l’équipe.
- **Membre** : clients, mensurations, commandes, statuts et saisie des paiements. Les montants, paiements détaillés et dépenses sont filtrés côté serveur.
- Les comptes utilisent un téléphone normalisé et un mot de passe ; les mots de passe sont stockés sous forme de dérivés scrypt. La récupération autonome de mot de passe n’est pas incluse dans cette V1.

## Vérifications techniques

```bash
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
```

## Auteur et signature

**AtelierPLUS** est conçu et développé par **Atissoli KABRAME**, FabManager.

- Téléphone : +228 96933893
- Autre ligne : +228 71572302

Cette signature (avec la photo de l’auteur, `public/images/auteur.jpg`) apparaît dans le pied de page de l’application et dans le panneau **Plus d’options → À propos**. Elle n’apparaît **pas** sur les reçus, qui appartiennent à l’atelier.
