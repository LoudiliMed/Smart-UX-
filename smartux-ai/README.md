# SmartUX-AI

Prototype d'interface hospitalière IA en français pour le projet **SILLAGE** (CRIStAL x Centrale Lille).

L'application permet à un professionnel de santé de :
- Saisir une prescription en langage naturel (NLP) → structuration automatique par IA
- Recevoir des alertes en temps réel sur les interactions médicamenteuses et allergies
- Interroger un chatbot médical contextuel (Doctor AI) sur les dossiers patients

---

## Prérequis

- [Node.js](https://nodejs.org) v18 ou supérieur
- Un compte [Groq](https://console.groq.com) (gratuit) pour obtenir une clé API

---

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/votre-utilisateur/smartux-ai.git
cd smartux-ai
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer la clé API

Copier le fichier d'exemple et y renseigner votre clé Groq :

```bash
cp .env.example .env
```

Ouvrir `.env` et remplacer la valeur :

```
GROQ_API_KEY=votre_cle_groq_ici
```

Pour obtenir une clé : [console.groq.com](https://console.groq.com) → **API Keys** → **Create API Key**.

> Le fichier `.env` est ignoré par git et ne sera jamais publié.

### 4. Lancer l'application

L'application nécessite **deux terminaux en parallèle** :

```bash
# Terminal 1 — Backend Express (port 3001)
node server.js

# Terminal 2 — Frontend React (port 3000)
npm start
```

Ouvrir [http://localhost:3000](http://localhost:3000) dans le navigateur.

---

## Connexion

L'application démarre sur un écran d'authentification. Trois méthodes sont disponibles :

| Méthode | Fonctionnement |
|---------|---------------|
| Reconnaissance faciale | Simule un scan biométrique (caméra décorative) |
| Badge RFID | Simule un scan de badge |
| Mot de passe | Saisie classique |

### Comptes disponibles

| Nom | Mot de passe | Rôle | Niveau d'accès |
|-----|-------------|------|----------------|
| Dr Sophie Martin | `sophie2024` | Médecin | 4 — accès clinique complet |
| Pr Laurent Dubois | `laurent2024` | Médecin | 4 — accès clinique complet |
| Dr Isabelle Bernard | `isa2024` | Chirurgien | 4 — accès clinique complet |
| Céline Moreau | `celine2024` | Cadre de Santé | 3 — accès opérationnel |
| Pierre Simon | `pierre2024` | Infirmier | 3 — accès opérationnel |
| Nadia Laurent | `nadia2024` | Aide-Soignant | 2 — accès soins de base |
| Admin | `admin` | Super Administrateur | 5 — tous les droits |

---

## Fonctionnalités

### Write out — Saisie NLP

L'onglet principal permet de saisir une instruction médicale en français libre. L'IA extrait automatiquement les données structurées.

**Exemples de phrases :**

```
Prescrire 500mg de Doliprane per os toutes les 6h pour le patient Dupont
Injecter 4000UI de Lovenox en SC pour Morin — indication TVP
Radiographie thoracique en urgence pour le patient Hakimi chambre 201
Mme Lefevre signale une allergie à la pénicilline — mettre en dossier urgent
Transfert du patient Tremblay de cardiologie vers réanimation, priorité haute
```

Après analyse, le bot pose trois questions obligatoires avant de permettre l'enregistrement :

1. **Délai** — quand administrer l'acte (ex : `2h`, `24h`, `3 jours`, `aucun`)
2. **Fréquence** — combien de fois par jour (ex : `1`, `2`, `3`)
3. **Durée** — pour combien de jours (ex : `7`, `14`, `2 semaines`)

Une fois les trois réponses fournies, le bouton **Enregistrer dans SILLAGE** apparaît.

### Système d'alertes

Dès qu'un médicament est saisi pour un patient sélectionné, l'IA vérifie automatiquement :
- Conflits d'allergies connues
- Interactions médicamenteuses
- Contre-indications

Les alertes sont classées **CRITIQUE** / **MODERE** / **FAIBLE**. Les alertes CRITIQUE nécessitent un accusé de réception explicite avant de pouvoir continuer.

### Actes & Ordres

Consultation et gestion de toutes les prescriptions enregistrées en base SQLite. Permet de valider, annuler ou modifier une prescription existante.

### Sous-onglets

| Sous-onglet | Contenu |
|-------------|---------|
| **Dossier** | Dossiers de 6 patients — allergies, constantes, observations |
| **Observations** | Notes cliniques et constantes vitales par patient |
| **Imagerie** | Examens d'imagerie avec filtre par statut |
| **Paramètres** | Profil utilisateur, permissions, préférences d'affichage |

### Doctor AI — Chatbot médical

Bouton **Doctor AI** dans la barre de navigation → tiroir latéral droit.

Le chatbot a accès au contexte complet de tous les patients (dossier, constantes, prescriptions enregistrées). Si un patient est sélectionné, le focus est mis sur ce patient.

Le niveau de détail des réponses s'adapte automatiquement au rôle de l'utilisateur connecté :

| Niveau | Rôles | Contenu |
|--------|-------|---------|
| 4-5 | Médecin, Chirurgien, Radiologue... | Hypothèses diagnostiques, interactions, pronostic |
| 3 | Infirmier, Pharmacien, Cadre | Médicaments, posologies, protocoles de soins |
| 2 | Aide-Soignant, Interne | Etat général, instructions immédiates |
| 1 | Agent d'Accueil | Chambre, service, rendez-vous uniquement |

Les prescriptions enregistrées via le NLP sont visibles dans le contexte du chatbot.

---

## Commandes utiles

```bash
node server.js                                     # Démarrer le backend
npm start                                          # Démarrer le frontend
npm run build                                      # Build de production
npm test                                           # Tests en mode watch
npm test -- --watchAll=false                       # Tests en mode CI
npm test -- --testPathPattern=ChatPanel            # Un seul fichier de test
npm test -- --testNamePattern="CHAT-01"            # Tests par nom
```

---

## Architecture

### Structure du projet

```
smartux-ai/
├── server.js                  # Backend Express — proxy Groq + SQLite REST
├── sillage.db                 # Base SQLite (créée automatiquement)
├── .env                       # Clé API Groq (non committé)
├── .env.example               # Modèle à copier
├── src/
│   ├── SmartUX_AI_Bots.jsx    # Composant racine — auth gate + layout + état partagé
│   ├── database.js            # Données statiques (patients, staff, médicaments…)
│   ├── App.js                 # Point d'entrée React
│   │
│   ├── constants/
│   │   └── theme.js           # Palette de couleurs partagée (ACCENT, RED, GREEN…)
│   │
│   ├── utils/
│   │   ├── nlp.js             # Fonctions NLP pures et testables (autoCorrect, mapNLPToPrescription…)
│   │   └── pdf.js             # Export PDF jsPDF (lazy-load depuis CDN)
│   │
│   ├── api/
│   │   └── client.js          # Toutes les requêtes HTTP (fetchPrescriptions, callAIChat…)
│   │
│   ├── ai/
│   │   └── prompts.js         # Prompts système et constructeurs de contexte patient
│   │
│   ├── components/
│   │   ├── ui/                # Atomes réutilisables
│   │   │   ├── Badge.jsx
│   │   │   ├── Btn.jsx
│   │   │   ├── Icon.jsx
│   │   │   ├── LiveClock.jsx
│   │   │   └── AutocompleteInput.jsx   # Avec saisie vocale (Web Speech API)
│   │   │
│   │   ├── auth/
│   │   │   └── BioBot.jsx     # Authentification biométrique / RFID / mot de passe
│   │   │
│   │   ├── alerts/
│   │   │   └── AlertSystem.jsx  # Vérification interactions médicamenteuses (debounced IA)
│   │   │
│   │   ├── chat/
│   │   │   └── ChatPanel.jsx  # Tiroir Doctor AI — streaming SSE
│   │   │
│   │   ├── nlp/
│   │   │   └── NLPBot.jsx     # Saisie NLP + dialogue multi-étapes (délai / fréquence / durée)
│   │   │
│   │   ├── rx/
│   │   │   └── RxTab.jsx      # Actes & Ordres — vue Kanban avec sections par urgence
│   │   │
│   │   └── panels/
│   │       ├── DossierPanel.jsx       # Accordéon patients — allergies + prescriptions
│   │       ├── ImageriePanel.jsx      # Examens d'imagerie filtrables par statut
│   │       ├── ObservationsPanel.jsx  # Notes cliniques + constantes vitales
│   │       └── ParametresPanel.jsx    # Profil, permissions, préférences d'affichage
│   │
│   └── __tests__/
│       ├── AlertSystem.test.js
│       ├── ChatPanel.test.js
│       ├── buildDossierContext.test.js
│       └── callClaudeChat.test.js
└── public/
```

### Deux processus requis

| Processus | Port | Rôle |
|-----------|------|------|
| `server.js` (Express) | 3001 | Proxy vers l'API Groq, persistance SQLite |
| `src/` (React CRA) | 3000 | Interface utilisateur complète |

Les routes `/api/claude` et `/api/claude-stream` appellent l'**API Groq** (`api.groq.com`) avec le modèle `llama-3.3-70b-versatile`.

### API Backend

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/prescriptions` | Récupérer toutes les prescriptions |
| POST | `/api/prescriptions` | Créer une prescription |
| PATCH | `/api/prescriptions/:id` | Mettre à jour une prescription |
| POST | `/api/claude` | Proxy Groq — réponse JSON (NLP + alertes) |
| POST | `/api/claude-stream` | Proxy Groq — SSE streaming (Doctor AI) |

### Données statiques — `src/database.js`

Toutes les données de démonstration sont des tableaux JavaScript statiques exportés depuis ce seul fichier :

| Export | Contenu |
|--------|---------|
| `DB_PATIENTS` | 6 patients (IPP, nom, naissance, groupe sanguin, chambre, service) |
| `DB_STAFF` | 16 membres du personnel (rôle, niveau d'accès 1-5, mot de passe) |
| `DB_MEDICAMENTS` | 45 médicaments (DCI, forme, dosage, voie, catégorie) |
| `DB_OBSERVATIONS` | Notes cliniques par patient |
| `DB_CONSTANTES` | Constantes vitales par patient |
| `DB_IMAGERIE` | Examens d'imagerie par patient |
| `KNOWN_ALLERGIES` | Allergies connues par `patient_id` |
| `TYPO_CORRECTIONS` | Corrections orthographiques médicales pour `autoCorrect()` |
| `AUTOCOMPLETE_CORPUS` | Suggestions de saisie pour `AutocompleteInput` |
| `ACCESS_PERMISSIONS` | Permissions par niveau d'accès (1–5) |
| `PERM_LABELS` | Labels lisibles des permissions |

### Modules clés pour les contributeurs

| Fichier | Ce qu'il faut savoir |
|---------|---------------------|
| `src/api/client.js` | Changer `API_BASE` pour pointer vers un autre serveur |
| `src/ai/prompts.js` | Modifier les instructions données à l'IA |
| `src/utils/nlp.js` | Ajouter des médicaments, corriger des règles d'extraction |
| `src/constants/theme.js` | Changer toute la palette de couleurs en un seul endroit |
| `src/components/nlp/NLPBot.jsx` | Modifier le dialogue multi-étapes (délai / fréquence / durée) |

---

## Sécurité & contraintes

- **Disclaimer IA obligatoire** : toute réponse commence par `"Analyse assistée par IA — vérification clinique recommandée"` — double couche système + failsafe dans le code
- **Anonymisation RGPD** : les patients sont identifiés par `H-{id}` dans les prompts envoyés à l'IA, jamais par leur nom
- **L'IA ne pose pas de diagnostic** — hypothèses uniquement, à vérifier par le clinicien
- **Biométrie simulée** — la caméra s'ouvre mais aucun traitement biométrique réel n'est effectué
- **Prototype de recherche** — non certifié pour usage clinique réel (voir `proposition.md` pour la roadmap de mise en production)

---

## Dépannage

**Le NLP affiche "Erreur serveur IA"**
- Vérifier que `node server.js` tourne bien (Terminal 1)
- Vérifier que `GROQ_API_KEY` dans `.env` est valide — tester sur [console.groq.com](https://console.groq.com)

**La page ne s'affiche pas**
- Vérifier que `npm start` tourne (Terminal 2)
- Ouvrir [http://localhost:3000](http://localhost:3000)

**Les prescriptions ne persistent pas**
- `sillage.db` est créé automatiquement au premier démarrage de `node server.js`
- Ne pas supprimer ce fichier entre les sessions

---

## Contribuer

Le code source est organisé en modules indépendants pour faciliter les contributions :

- **Ajouter une fonctionnalité UI** → créer un composant dans `src/components/` et l'importer dans `SmartUX_AI_Bots.jsx`
- **Modifier les prompts IA** → éditer `src/ai/prompts.js` uniquement
- **Ajouter un médicament ou un patient de démo** → éditer `src/database.js` uniquement
- **Changer le modèle LLM** → modifier `model` dans `server.js` (route `/api/claude` et `/api/claude-stream`)
- **Changer l'URL du backend** → modifier `API_BASE` dans `src/api/client.js`
- **Écrire un test** → ajouter un fichier `*.test.js` dans `src/__tests__/` (Jest + React Testing Library)

---

## Licence

Projet de recherche — CRIStAL x Centrale Lille. Usage académique uniquement.
