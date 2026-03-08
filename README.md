# SmartUX-AI — Prototype SIH SILLAGE

**Projet CRIStAL × Centrale Lille** · Prototype de recherche UX · 2026

SmartUX-AI est un prototype explorant des interfaces augmentées par l'IA pour **SILLAGE**, le système d'information hospitalier utilisé dans les établissements de santé français. Il adresse trois défis HCI :

1. **Saisie en langage naturel** — remplacer les formulaires par du texte libre médical traité par un bot NLP (Groq — modèle Llama 3.3 70B).
2. **Contrôle d'accès sécurisé** — authentification multi-méthodes (biométrie, badge RFID, mot de passe) liée à une base de personnel réelle.
3. **Gestion des actes et ordres** — suivi des prescriptions avec délais impartis, niveaux d'urgence et historique.

---

## Prérequis

- [Node.js](https://nodejs.org/) v18 ou supérieur
- Un compte [Groq](https://console.groq.com) (gratuit) pour obtenir une clé API

---

## Installation & lancement

### 1. Cloner le dépôt

```bash
git clone https://github.com/LoudiliMed/Smart-UX-.git
cd Smart-UX-/smartux-ai
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer la clé API Groq

```bash
cp .env.example .env
```

Ouvrir `.env` et renseigner votre clé :

```
GROQ_API_KEY=votre_cle_groq_ici
```

Pour obtenir une clé : [console.groq.com](https://console.groq.com) → **API Keys** → **Create API Key**.

> Le fichier `.env` est ignoré par git et ne sera jamais publié.

### 4. Lancer l'application

L'application nécessite **deux terminaux en parallèle** — à relancer à chaque session :

```bash
# Terminal 1 — Backend Express (port 3001)
node server.js

# Terminal 2 — Frontend React (port 3000)
npm start
```

Ouvrir [http://localhost:3000](http://localhost:3000) dans le navigateur.

Le flux NLP passe entièrement par le serveur local :

```
React (port 3000) → POST /api/claude (port 3001) → API Groq → llama-3.3-70b-versatile
```

---

## Connexion

L'application démarre sur un écran d'authentification avec trois méthodes disponibles :

| Méthode | Fonctionnement |
|---------|----------------|
| Reconnaissance faciale | Simule un scan biométrique (caméra décorative) |
| Badge RFID | Simule un scan de badge — accès en 1 clic |
| Mot de passe | Saisie identifiant + mot de passe, validé contre `DB_STAFF` |

### Comptes disponibles

| Identifiant | Mot de passe | Rôle | Niveau d'accès |
|-------------|-------------|------|----------------|
| martin | `sophie2024` | Médecin — Cardiologie | 4 — accès clinique complet |
| dubois | `laurent2024` | Médecin — Neurologie | 4 — accès clinique complet |
| bernard | `isa2024` | Chirurgien | 4 — accès clinique complet |
| leroy | `karim2024` | Anesthésiste-Réanimateur | 4 — accès clinique complet |
| moreau | `celine2024` | Cadre de Santé | 3 — accès opérationnel |
| simon | `pierre2024` | IDE — Urgences | 3 — accès opérationnel |
| rousseau | `marc2024` | Biologiste Médical | 3 — accès opérationnel |
| petit | `amina2024` | Radiologue | 3 — accès opérationnel |
| admin | `admin` | Super Administrateur | 5 — tous les droits |

---

## Fonctionnalités

### Write out — Saisie NLP

L'onglet principal permet de saisir une instruction médicale en français libre.

**Exemples de phrases :**

```
Prescrire 500mg de Doliprane per os toutes les 6h pour le patient Dupont
Injecter 4000UI de Lovenox en SC pour Morin — indication TVP
Radiographie thoracique en urgence pour le patient Hakimi chambre 201
Mme Lefevre signale une allergie à la pénicilline — mettre en dossier urgent
Transfert du patient Tremblay de cardiologie vers réanimation, priorité haute
```

Le bot applique automatiquement des corrections orthographiques médicales, envoie le texte à l'API Groq, extrait un JSON structuré (`patient`, `medicament`, `dose`, `voie`, `frequence`, `diagnostic`, `service`, `priorite`, `chambre`, `allergie`, `action`, `examen`), puis pose trois questions obligatoires avant d'autoriser l'enregistrement :

1. **Délai** — quand administrer l'acte (ex : `2h`, `24h`, `3 jours`, `aucun`)
2. **Fréquence** — combien de fois par jour (ex : `1`, `2`, `3`)
3. **Durée** — pour combien de jours (ex : `7`, `14`, `2 semaines`)

Une fois les trois réponses fournies, les boutons **Enregistrer dans SILLAGE** et **Exporter PDF** apparaissent.

**Autocomplete** : suggestions en cours de frappe depuis la base de données (noms de patients, médicaments, gabarits de phrases). Navigation clavier : Tab pour accepter, ↑↓ pour l'historique, Entrée pour soumettre.

**Saisie vocale** : bouton microphone pour dicter en français (Web Speech API, `fr-FR`).

### Système d'alertes

Dès qu'un médicament est saisi pour un patient sélectionné, l'IA vérifie automatiquement les conflits d'allergies, interactions médicamenteuses et contre-indications. Les alertes sont classées **CRITIQUE** / **MODÉRÉ** / **FAIBLE**. Les alertes CRITIQUE nécessitent un accusé de réception explicite avant de pouvoir continuer.

### Actes & Ordres

Vue Kanban de toutes les prescriptions enregistrées, réparties en quatre sections :

| Section | Couleur | Condition |
|---------|---------|-----------|
| Expirent dans moins de 30 min | Ambre | Échéance dans < 30 min |
| Tâches urgentes | Rouge | Priorité URGENTE ou STAT |
| Tâches à faire | Ambre | En attente, non urgent |
| Historique | Gris | Validé ou annulé |
| ↳ Délai dépassé | Rouge | Traité après l'échéance |
| ↳ Dans les délais | Vert | Traité avant l'échéance |

Chaque carte affiche le délai restant en temps réel et les actions **Valider** / **Annuler** / **Exporter PDF**.

### Sous-onglets

| Sous-onglet | Contenu |
|-------------|---------|
| **Dossier** | Accordéon patients — démographie, allergies, prescriptions enregistrées |
| **Observations** | Notes cliniques par catégorie + constantes vitales |
| **Imagerie** | Examens d'imagerie filtrables par statut |
| **Paramètres** | Profil utilisateur, permissions accordées, préférences d'affichage |

### Doctor AI — Chatbot médical

Bouton **Doctor AI** dans la barre de navigation → tiroir latéral droit (streaming SSE).

Le chatbot a accès au contexte complet de tous les patients. Le niveau de détail des réponses s'adapte au rôle de l'utilisateur connecté :

| Niveau | Rôles | Contenu |
|--------|-------|---------|
| 4–5 | Médecin, Chirurgien, Radiologue | Hypothèses diagnostiques, interactions, pronostic |
| 3 | Infirmier, Pharmacien, Cadre | Médicaments, posologies, protocoles de soins |
| 2 | Aide-Soignant, Interne | État général, instructions immédiates |
| 1 | Agent d'Accueil | Chambre, service, rendez-vous uniquement |

---

## Architecture

### Structure du projet

```
UX/
├── README.md                      — Ce fichier
├── sillage_database.sql           — Schéma SQL complet (SQLite/PostgreSQL)
└── smartux-ai/
    ├── server.js                  — Backend Express — proxy Groq + SQLite REST
    ├── sillage.db                 — Base SQLite (créée automatiquement)
    ├── .env                       — Clé API Groq (non committé)
    ├── .env.example               — Modèle à copier
    ├── src/
    │   ├── SmartUX_AI_Bots.jsx    — Composant racine — auth gate + layout + état partagé
    │   ├── database.js            — Données statiques (patients, staff, médicaments…)
    │   ├── App.js                 — Point d'entrée React
    │   │
    │   ├── constants/
    │   │   └── theme.js           — Palette de couleurs partagée (ACCENT, RED, GREEN…)
    │   │
    │   ├── utils/
    │   │   ├── nlp.js             — Fonctions NLP pures et testables (autoCorrect, mapNLPToPrescription…)
    │   │   └── pdf.js             — Export PDF jsPDF (lazy-load depuis CDN)
    │   │
    │   ├── api/
    │   │   └── client.js          — Toutes les requêtes HTTP (fetchPrescriptions, callAIChat…)
    │   │
    │   ├── ai/
    │   │   └── prompts.js         — Prompts système et constructeurs de contexte patient
    │   │
    │   ├── components/
    │   │   ├── ui/                — Atomes réutilisables
    │   │   │   ├── Badge.jsx
    │   │   │   ├── Btn.jsx
    │   │   │   ├── Icon.jsx
    │   │   │   ├── LiveClock.jsx
    │   │   │   └── AutocompleteInput.jsx   — Avec saisie vocale (Web Speech API)
    │   │   │
    │   │   ├── auth/
    │   │   │   └── BioBot.jsx     — Authentification biométrique / RFID / mot de passe
    │   │   │
    │   │   ├── alerts/
    │   │   │   └── AlertSystem.jsx  — Vérification interactions médicamenteuses (debounced IA)
    │   │   │
    │   │   ├── chat/
    │   │   │   └── ChatPanel.jsx  — Tiroir Doctor AI — streaming SSE
    │   │   │
    │   │   ├── nlp/
    │   │   │   └── NLPBot.jsx     — Saisie NLP + dialogue multi-étapes (délai / fréquence / durée)
    │   │   │
    │   │   ├── rx/
    │   │   │   └── RxTab.jsx      — Actes & Ordres — vue Kanban avec sections par urgence
    │   │   │
    │   │   └── panels/
    │   │       ├── DossierPanel.jsx       — Accordéon patients — allergies + prescriptions
    │   │       ├── ImageriePanel.jsx      — Examens d'imagerie filtrables par statut
    │   │       ├── ObservationsPanel.jsx  — Notes cliniques + constantes vitales
    │   │       └── ParametresPanel.jsx    — Profil, permissions, préférences d'affichage
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
| `DB_STAFF` | 16 membres du personnel (rôle, niveau d'accès 1–5, mot de passe) |
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
| `server.js` | Changer le modèle LLM (variable `model`, routes `/api/claude*`) |

---

## Base de données SQL (`sillage_database.sql`)

Schéma complet **compatible SQLite et PostgreSQL**.

### Base patients

| Table | Description |
|-------|-------------|
| `patients` | Identité patient : IPP, NIR/INS, démographie, consentement, assurance, médecin traitant |
| `hospitalizations` | Séjours : unité, lit, dates, type d'admission, équipe soignante |
| `diagnoses` | Diagnostics codés ICD-10 par séjour (principal, associé, complication) |
| `allergies` | Allergies aux substances avec sévérité et type de réaction |
| `medications` | Prescriptions en cours : médicament, dose, voie, fréquence, prescripteur |
| `vitals` | Signes vitaux répétés (FC, TA, température, SpO₂, douleur, IMC…) |
| `lab_results` | Résultats biologiques codés LOINC avec plages de référence et statut de validation |
| `medical_notes` | Notes cliniques libres, comptes-rendus de sortie, extraits NLP |
| `imaging` | Examens de radiologie (modalité, région, référence PACS, compte-rendu radiologue) |
| `surgical_acts` | Actes chirurgicaux codés CCAM avec chirurgien, anesthésiste et détails bloc |

### Base personnel

| Table | Description |
|-------|-------------|
| `staff` | Dossier complet du personnel : identité, rôle, service, contrat, enrôlement biométrique, identifiants SILLAGE, mot de passe |
| `roles` | 15 rôles de Super Administrateur (niveau 5) à Agent d'Accueil (niveau 1) |
| `permissions` | 20 permissions atomiques réparties en 4 catégories : PATIENT, STAFF, SYSTEM, BILLING |
| `role_permissions` | Liaison rôle ↔ permissions (many-to-many) |
| `departments` | 12 services hospitaliers (Cardiologie, Urgences, Réanimation, Maternité…) |
| `wards` | Unités physiques avec capacité et type (USI, Chirurgie, Maternité…) |
| `staff_shifts` | Planning des gardes par membre du personnel et unité |
| `staff_access_log` | Journal d'audit : chaque connexion, accès patient, utilisation biométrique |

### Référentiel médicaments

| Table | Description |
|-------|-------------|
| `medicaments` | 61 médicaments hospitaliers français réels (Vidal/HAS) — DCI, forme, dosage, voie, code ATC, catégorie thérapeutique, contre-indications, catégorie grossesse |

### Table prescriptions

| Table | Description |
|-------|-------------|
| `prescriptions` | Ordonnances détaillées avec métadonnées NLP : phrase originale (`nlp_raw_text`), JSON extrait, niveau de confiance, champs auto-remplis, workflow de validation, champ `echeance` pour les délais impartis |

### Vues SQL

- `v_active_patients` — patients hospitalisés avec unité et médecin référent
- `v_staff_summary` — personnel avec libellé de rôle, niveau d'accès, service
- `v_staff_permissions` — permissions à plat par membre actif
- `v_prescriptions` — prescriptions enrichies avec nom patient, médicament et prescripteur

---

## Commandes utiles

```bash
node server.js                              # Démarrer le backend
npm start                                   # Démarrer le frontend
npm run build                               # Build de production
npm test                                    # Tests en mode watch
npm test -- --watchAll=false                # Tests en mode CI
npm test -- --testPathPattern=ChatPanel     # Un seul fichier de test
npm test -- --testNamePattern="CHAT-01"     # Tests par nom

sqlite3 smartux-ai/sillage.db               # Explorer la base directement
sqlite3 sillage_new.db < sillage_database.sql  # Réinitialiser depuis le schéma SQL
```

---

## Données de référence

| Entité | Nombre |
|--------|--------|
| Patients | 6 (avec dossiers cliniques complets) |
| Personnel | 16 (dont 1 compte admin) |
| Rôles | 15 |
| Permissions | 20 |
| Services | 12 |
| Unités | 10 |
| Médicaments de référence | 61 médicaments réels |

---

## Design tokens

Définis dans `src/constants/theme.js` — modifier ce seul fichier change la palette entière.

| Token | Valeur | Usage |
|-------|--------|-------|
| `ACCENT` | `#0F4C75` | Bleu principal — en-têtes, actions clés |
| `ACCENT2` | `#E91E8C` | Rose — biométrie, badges, highlights IA |
| `BG` | `#F0F4F8` | Fond de l'application |
| `CARD` | `#FFFFFF` | Fonds de cartes et panneaux |
| `MUTED` | `#6B7280` | Texte secondaire |
| `GREEN` | `#10B981` | Succès, validé, dans les délais |
| `AMBER` | `#F59E0B` | Attention, à faire, délai proche |
| `RED` | `#EF4444` | Urgent, refus, allergie, délai dépassé |
| Police | DM Sans + Space Mono | Corps + mono/code |

---

## Sécurité & contraintes

- **Disclaimer IA obligatoire** : toute réponse commence par `"Analyse assistée par IA — vérification clinique recommandée"` — double couche système + failsafe dans le code
- **Anonymisation RGPD** : les patients sont identifiés par `H-{id}` dans les prompts envoyés à l'IA, jamais par leur nom réel
- **L'IA ne pose pas de diagnostic** — hypothèses uniquement, à vérifier par le clinicien
- **Biométrie simulée** — la caméra s'ouvre mais aucun traitement biométrique réel n'est effectué
- **Prototype de recherche** — non certifié pour usage clinique réel

---

## Dépannage

**Le NLP affiche "Erreur serveur IA"**
- Vérifier que `node server.js` tourne (Terminal 1)
- Vérifier que `GROQ_API_KEY` dans `.env` est valide sur [console.groq.com](https://console.groq.com)

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
- **Changer le modèle LLM** → modifier `model` dans `server.js` (routes `/api/claude` et `/api/claude-stream`)
- **Changer l'URL du backend** → modifier `API_BASE` dans `src/api/client.js`
- **Écrire un test** → ajouter un fichier `*.test.js` dans `src/__tests__/` (Jest + React Testing Library)

---

*Prototype — CRIStAL × Centrale Lille · Recherche UX 2026*
