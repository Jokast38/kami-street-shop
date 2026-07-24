# Kami Street — Boutique e-commerce

Boutique e-commerce pour **Kami Street** : fatbikes électriques, scooters, trottinettes électriques et accessoires. Le projet remplace le site WordPress/WooCommerce historique (`kamistreet.fr`) par une stack dédiée (React + FastAPI + MongoDB), avec un dashboard admin, un moteur de synchronisation WooCommerce/WordPress, le paiement Stripe et les emails transactionnels via Brevo.

## Sommaire

- [Stack technique](#stack-technique)
- [Structure du projet](#structure-du-projet)
- [Fonctionnalités](#fonctionnalités)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Lancer le projet en local](#lancer-le-projet-en-local)
- [Migration depuis WordPress / WooCommerce](#migration-depuis-wordpress--woocommerce)
- [Dashboard admin](#dashboard-admin)
- [Paiement (Stripe)](#paiement-stripe)
- [Emails transactionnels (Brevo)](#emails-transactionnels-brevo)
- [API — endpoints principaux](#api--endpoints-principaux)
- [Sécurité](#sécurité)

## Stack technique

**Frontend**
- React 19 + React Router 7
- CRACO (Create React App configuré) + Tailwind CSS
- Framer Motion (animations), react-fast-marquee (bandeaux défilants)
- Radix UI / shadcn-style components (`src/components/ui`)
- Axios pour les appels API

**Backend**
- FastAPI (Python) + Uvicorn
- MongoDB (via Motor, driver async) — base dédiée `kamistreet_db`
- Auth admin par JWT (PyJWT) + hash bcrypt
- Stripe (paiement / webhooks)
- Brevo (emails transactionnels)
- Intégration WooCommerce REST API + WordPress REST API (migration/synchronisation)

## Structure du projet

```
kami-street-shop/
├── backend/
│   ├── server.py           # API FastAPI complète (catalogue, admin, checkout, sync WP/Woo)
│   ├── requirements.txt
│   └── .env                # Secrets backend (non versionné)
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── logo/           # Logos & koala (variantes noir / jaune / offwhite)
│   ├── src/
│   │   ├── components/     # Navbar, Footer, TopBar, CartDrawer, ProductCard, ui/...
│   │   ├── context/        # AuthContext, CartContext, ThemeContext
│   │   ├── pages/          # Home, Shop, ProductDetail, Blog, BlogPost, Admin*, Checkout*
│   │   ├── lib/            # client API (axios), utils
│   │   └── App.js          # Routes + layout
│   └── .env                # Secrets frontend (non versionné)
└── README.md
```

## Fonctionnalités

### Boutique (front public)
- Page d'accueil avec **diaporama hero** (rotation automatique + flèches + indicateurs) piloté par les bannières actives du dashboard
- Bandeau déroulant (`TopBar`) au-dessus du header avec message livraison/marque
- Catalogue produits avec filtres (catégorie, prix, recherche, mise en avant)
- Fiche produit avec variations (taille, couleur, stock par variation)
- Panier (drawer) + tunnel de commande Stripe Checkout
- Pages de succès/annulation de commande
- Blog (liste + article) synchronisé depuis WordPress
- Thème clair/sombre avec logos et koala adaptés automatiquement à chaque contexte (page vs bandeau ticker, dont le fond est inversé par rapport au thème)
- Favicon koala (carré, non déformé)

### Dashboard admin (`/admin`)
- Authentification JWT (`/admin/login`)
- CRUD Produits (prix, stock, variations, catégories, images, mise en avant)
- CRUD Articles de blog
- CRUD Bannières hero (image, titre, sous-titre, CTA, ordre, activation)
- Suivi des commandes + changement de statut (`pending`, `paid`, `shipped`, `cancelled`)
- Statistiques (nombre de produits, commandes, commandes payées, articles, chiffre d'affaires)
- Boutons de synchronisation WooCommerce / WordPress / Médias (voir plus bas)

### Emails automatiques
- Confirmation de commande envoyée au client
- Notification de nouvelle commande envoyée à l'administrateur
- Fiabilisé par un double déclenchement : webhook Stripe **et** vérification du statut à l'affichage de la page de succès (fallback si le webhook est en retard/absent)

## Prérequis

- Node.js ≥ 18 + Yarn
- Python ≥ 3.11
- Un cluster MongoDB (Atlas ou local)
- Un compte Stripe (mode test suffit pour développer)
- Un compte Brevo avec une clé API v3
- Les identifiants WooCommerce/WordPress du site `kamistreet.fr` (pour la migration)

## Installation

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Frontend
cd ../frontend
yarn install
```

## Variables d'environnement

### `backend/.env`

| Variable | Description |
|---|---|
| `MONGO_URL` | URI de connexion MongoDB (Atlas ou local) |
| `DB_NAME` | Nom de la base dédiée à Kami Street (ex: `kamistreet_db`) — **ne pas partager avec d'autres projets** pour éviter les collisions de collections |
| `CORS_ORIGINS` | Origines autorisées pour le CORS (`*` en dev) |
| `JWT_SECRET` / `JWT_ALG` | Secret et algorithme de signature des tokens admin |
| `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` | Compte admin créé automatiquement au premier démarrage (à changer après la première connexion) |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` | Clés API Stripe |
| `STRIPE_ACCOUNT_ID` | Identifiant du compte Stripe connecté |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature du webhook Stripe |
| `STRIPE_MODE` | `test` ou `live` |
| `FRONTEND_URL` | URL du frontend (utilisée pour les redirections Stripe) |
| `BREVO_V3_API_KEY` | Clé API Brevo (v3, `xkeysib-...`) |
| `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | Expéditeur des emails transactionnels |
| `WOOCOMMERCE_KEY_K` / `WOOCOMMERCE_SECRET_K` | Clés API REST WooCommerce (lecture) |
| `WORDPRESS_SITE_K` | Domaine du site WordPress source (`kamistreet.fr`) |
| `WORDPRESS_USER` / `WORDPRESS_APP_PASSWORD_K` | Compte + mot de passe d'application WordPress (migration articles/médias) |

### `frontend/.env`

| Variable | Description |
|---|---|
| `REACT_APP_BACKEND_URL` (ou équivalent, cf. `src/lib/api.js`) | URL de base de l'API backend |

> ⚠️ **Les fichiers `.env` ne sont jamais commités** (voir `.gitignore`). Ne collez jamais leur contenu réel dans un ticket, un chat ou un prompt tiers — régénérez les clés si cela arrive.

## Lancer le projet en local

```bash
# Terminal 1 — backend
cd backend
uvicorn server:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
yarn start
```

Le frontend tourne par défaut sur `http://localhost:3000`, le backend sur `http://localhost:8000` (API préfixée par `/api`).

## Migration depuis WordPress / WooCommerce

Le backend expose des routes de synchronisation idempotentes (upsert par identifiant WooCommerce/WordPress d'origine, donc rejouables sans dupliquer les données) :

| Endpoint | Effet |
|---|---|
| `POST /api/admin/sync/woocommerce` | Importe catégories + produits (+ variations) depuis WooCommerce |
| `POST /api/admin/sync/wordpress` | Importe les articles de blog depuis WordPress |
| `POST /api/admin/sync/media` | Récupère les médias WordPress et crée les bannières hero par défaut (si aucune bannière n'existe encore) |
| `POST /api/admin/sync/all` | Enchaîne les trois synchronisations ci-dessus |

Toutes ces routes nécessitent un token admin (`Authorization: Bearer <token>`). Elles peuvent être relancées à tout moment pour resynchroniser depuis WordPress tant que celui-ci reste la source de vérité.

## Dashboard admin

1. Se connecter sur `/admin/login` avec `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` (à changer après la première connexion).
2. Lancer une synchronisation initiale (bouton dédié dans le dashboard, ou appel direct à `/api/admin/sync/all`).
3. Gérer produits, blog, bannières et commandes depuis les onglets du dashboard.

## Paiement (Stripe)

- Le tunnel de commande crée une session Stripe Checkout (`POST /api/checkout/session`) après recalcul serveur des prix (jamais confiance dans les prix envoyés par le client).
- Le webhook `POST /api/stripe/webhook` marque la commande comme payée et déclenche les emails.
- En secours, `GET /api/checkout/status/{session_id}` revérifie le statut auprès de Stripe lors de l'affichage de la page de succès, au cas où le webhook n'aurait pas encore été reçu.

## Emails transactionnels (Brevo)

Chaque commande payée déclenche deux emails via l'API Brevo (`send_email` dans `server.py`) :
- Confirmation au client (`customer_email`)
- Notification à l'administrateur (`ADMIN_EMAIL`)

Le template HTML (`order_email_html`) reprend l'identité visuelle Kami Street (fond sombre, accent jaune/vert). Pour l'ajout du logo dans ces emails, utiliser une variante hébergée en HTTPS (ex. `frontend/public/logo/logo-kami-jaune.png` une fois déployé) car les clients mail n'exécutent pas de JS ni de CSS `prefers-color-scheme`.

## API — endpoints principaux

**Public**
- `GET /api/products`, `GET /api/products/{slug}`
- `GET /api/categories`
- `GET /api/blog`, `GET /api/blog/{slug}`
- `GET /api/banners`
- `POST /api/checkout/session`, `GET /api/checkout/status/{session_id}`

**Admin (JWT requis)**
- `POST /api/auth/login`, `GET /api/auth/me`
- CRUD `/api/admin/products`, `/api/admin/blog`, `/api/admin/banners`
- `GET /api/admin/orders`, `PUT /api/admin/orders/{id}/status`
- `GET /api/admin/stats`
- `POST /api/admin/sync/{woocommerce|wordpress|media|all}`

## Sécurité

- Les fichiers `.env` (backend et frontend) sont exclus du dépôt Git (`.gitignore`).
- La base MongoDB (`DB_NAME`) doit être dédiée à ce projet — ne pas la partager avec d'autres applications pour éviter toute collision de collections (`users`, `products`, `orders`, etc. sont des noms génériques).
- Les prix de commande sont toujours recalculés côté serveur avant création de la session Stripe.
- Si des clés API ont été exposées accidentellement (chat, ticket, commit), régénérez-les immédiatement depuis Stripe, Brevo et WooCommerce/WordPress.
