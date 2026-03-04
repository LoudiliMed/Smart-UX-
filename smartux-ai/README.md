# SmartUX-AI

Prototype d'interface hospitalière en français pour le projet **SILLAGE** (CRIStAL × Centrale Lille).

---

## Installation

```bash
npm install
```

### Configuration de la clé API (obligatoire pour le NLP)

Copiez le fichier d'exemple et ajoutez votre clé Groq :

```bash
cp .env.example .env
```

Éditez `.env` et remplacez `your_groq_api_key_here` par votre clé.
Obtenez une clé gratuite sur **[console.groq.com](https://console.groq.com)**.

## Lancer le projet

Deux serveurs doivent tourner en parallèle :

```bash
# Terminal 1 — Frontend React (port 3000)
npm start

# Terminal 2 — API Express (port 3001)
node server.js
```

Autres commandes :

```bash
npm run build   # Build de production
npm test        # Lancer les tests
```

---

## Architecture

### Frontend — `src/SmartUX_AI_Bots.jsx`

Composant principal React (~1500 lignes). Toute la logique UI s'y trouve.

### Base de données locale — `src/database.js`

Toutes les données statiques du projet ont été **extraites** de `SmartUX_AI_Bots.jsx` vers ce fichier dédié. Il exporte :

| Export | Contenu |
|--------|---------|
| `DB_PATIENTS` | 6 patients (IPP, nom, naissance, groupe sanguin, chambre, service) |
| `DB_STAFF` | 16 membres du personnel (rôle, niveau d'accès, mot de passe, biométrie) |
| `DB_MEDICAMENTS` | 45 médicaments (DCI, forme, dosage, voie, catégorie) |
| `KNOWN_ALLERGIES` | Allergies connues par `patient_id` |
| `TYPO_CORRECTIONS` | Dictionnaire de correction automatique des fautes de frappe |
| `AUTOCOMPLETE_CORPUS` | Phrases et termes médicaux pour l'autocomplétion NLP |
| `ACCESS_PERMISSIONS` | Permissions par niveau d'accès (1 à 5) |
| `PERM_LABELS` | Labels français des permissions |

Le fichier est importé dans `SmartUX_AI_Bots.jsx` et peut être réutilisé dans tout autre composant.

### Backend — `server.js`

API Express sur `http://localhost:3001`.

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/prescriptions` | Récupérer toutes les prescriptions |
| POST | `/api/prescriptions` | Créer une prescription |
| PATCH | `/api/prescriptions/:id` | Mettre à jour une prescription |
| POST | `/api/claude` | Proxy vers l'API Groq (LLM) |

Base SQLite (`sillage.db`) créée automatiquement au premier lancement.

---

## Flux d'authentification

L'application est **protégée par une authentification biométrique** avant tout accès.

- Au lancement, seul l'écran d'authentification est affiché (pas d'onglets visibles)
- Trois méthodes disponibles : **Reconnaissance faciale**, **Badge RFID**, **Mot de passe**
- Après validation, l'utilisateur accède à l'application complète
- Son nom, titre et niveau d'accès s'affichent dans la barre de navigation
- Un bouton **✕** permet de se déconnecter et revenir à l'écran d'authentification

Éléments supprimés de l'écran d'authentification :
- Sélection manuelle du personnel (supprimée — la biométrie/badge identifie l'utilisateur automatiquement)
- Flux d'authentification (diagramme d'étapes)
- Bannière d'information "Base personnel SILLAGE"

---

## Onglets principaux

| Onglet | Description |
|--------|-------------|
| **NLP Contextuel** | Saisie libre en français → prescription structurée via LLM (Groq) |
| **Actes & Ordres** | Consultation et gestion des prescriptions en base SQLite |

L'onglet **Biométrique** a été supprimé : l'authentification se fait désormais en amont, avant l'accès à l'application.

---

## Sous-onglets (barre secondaire)

### Dossier

Affiche la liste complète des **6 patients** avec :

- Groupe sanguin coloré, nom, IPP, service, chambre, âge, sexe
- Tags **ALLERGIE** (rouge) et **URGENT** (orange) si applicable
- Flèche ▾ pour déplier/replier la fiche complète de chaque patient

Quand la fiche est dépliée :
- **Colonne gauche** : tableau d'informations (date de naissance, âge, sexe, groupe sanguin, service, chambre) + allergies connues
- **Colonne droite** : liste des Actes & Ordres associés au patient (médicament, dosage, voie, fréquence, indication, priorité, statut de validation)

Si un patient n'a aucun acte, la colonne droite affiche *"Aucun acte ou ordre enregistré"*.

Les cartes sans actes sont repliées par défaut. Les cartes avec actes sont dépliées par défaut.

### Observations / Prescriptions / Labo

Modules en cours de développement — connectés au système SILLAGE.

---

## Intégration LLM

- L'onglet NLP envoie la saisie libre vers `POST /api/claude`
- Le backend proxie vers **Groq API** (modèle `llama-3.3-70b-versatile`)
- La réponse est parsée par `mapNLPToPrescription()` pour remplir les champs de prescription
- La clé API Groq est lue depuis la variable d'environnement `GROQ_API_KEY` (fichier `.env`)

---

## Contraintes techniques

- **Pas de TypeScript** — JavaScript/JSX uniquement
- **Pas de gestionnaire d'état** — `useState` / `useRef` / `useCallback` uniquement
- **Pas de CSS externe** — styles inline uniquement (Google Fonts : DM Sans + Space Mono)
- **Biométrie simulée** — pas de vraie reconnaissance faciale ; le flux caméra est décoratif
- **Données patients/personnel/médicaments** — hardcodées dans `src/database.js`, pas fetchées depuis la base
