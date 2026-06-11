---
title: SmartUX-AI — Session de développement
date: 2026-03-11
tags:
  - dev/session
  - project/smartux-ai
  - ia/chat
  - infra/env
  - infra/sih
  - interop/fhir
status: done
project: "[[SmartUX-AI]]"
---

# SmartUX-AI — Session du 2026-03-18

Projet : [[smartux-ai/README|SmartUX-AI]]

---

## Changements effectues

### 1. Calcul automatique des prises/jour depuis la frequence en heures (Write out)

**Etat avant :** Quand le NLP extrayait `frequency = "toutes les 6 heures"`, `parsePositiveInt` retournait `6` — soit le nombre d'heures, pas le nombre de prises par jour. La question "Combien de fois par jour ?" etait donc pre-remplie avec une valeur incorrecte.

**Correction :**
- `src/utils/nlp.js` : nouvelle fonction exportee `parseFrequencyToTimesPerDay(str)` — detecte le pattern `toutes les Xh` / `toutes les X heures` et calcule `Math.round(24 / X)` ; retombe sur `parsePositiveInt` pour les autres formes ("2 fois par jour", "3", etc.)
- `src/components/nlp/NLPBot.jsx` : import de `parseFrequencyToTimesPerDay` ; ligne 256 remplace `parsePositiveInt(rx.frequency)` par `parseFrequencyToTimesPerDay(rx.frequency)`

**Exemples :**

| frequency NLP       | avant | apres |
|---------------------|-------|-------|
| "toutes les 6 heures" | 6   | 4     |
| "toutes les 8h"     | 8     | 3     |
| "toutes les 12h"    | 12    | 2     |
| "2 fois par jour"   | 2     | 2     |

**Fichiers modifies :** `src/utils/nlp.js`, `src/components/nlp/NLPBot.jsx`

---

# SmartUX-AI — Session du 2026-03-11

Projet : [[smartux-ai/README|SmartUX-AI]]

---

## Changements effectues

### 1. Dialogue adapte au type d'ordonnance (NLPBot)

**Etat avant :** Le bot posait les 3 memes questions (delai, frequence/jour, duree) pour TOUS les types d'ordonnances.

**Corrections :**
- `src/components/nlp/NLPBot.jsx` : etat `pendingDelay` transforme en machine a etats typee (`{ rx, type, step, collected }`)
- 3 flux distincts :
  - **Medicament** (`action === "prescrire"`, pas d'examen) : frequence/jour -> nb jours -> delai -> confirmation
  - **Imagerie** (`examen` present ou `action === "planifier"`) : priorite -> delai -> indication clinique -> confirmation
  - **Autre** (transfert, signaler, stopper, modifier) : delai -> confirmation
- Smart-skip : si le NLP a deja extrait un champ (ex: priorite dans "radiographie en urgence"), la question est sautee
- Fonctions utilitaires : `getOrderType()`, `getFirstStep()`, `getStepQuestion()`, `finalizeDialogue()`
- Labels UI adaptes : "Question" au lieu de "Delai imparti", "En attente de completion" generique
- Champs supplementaires affiches dans l'apercu prescription : Examen, Fois/jour, Nb jours, Urgence

### 2. Persistance locale (localStorage)

**Etat avant :** Les prescriptions n'existaient qu'en SQLite cote serveur. Si le serveur etait arrete, rien n'etait accessible.

**Corrections :**
- `src/api/client.js` : `fetchPrescriptions()` tente le serveur d'abord, retombe sur `localStorage` si echec
- `savePrescription()` ecrit en localStorage AVANT l'appel serveur (survit aux pannes)
- `patchPrescription()` met a jour le cache local en parallele
- Cle localStorage : `smartux_prescriptions`
- Synchronisation automatique : chaque fetch serveur reussi met a jour le cache local

### 3. Nouvelles colonnes SQLite

**Corrections :**
- `server.js` : 5 nouvelles colonnes ajoutees a la table `prescriptions` : `fois_par_jour` (INTEGER), `nb_jours` (INTEGER), `echeance` (TEXT), `indication_clinique` (TEXT), `urgence` (TEXT)
- Migration automatique via `ALTER TABLE` avec try/catch (compatible bases existantes)
- INSERT/REPLACE mis a jour pour inclure les nouvelles colonnes avec fallback `?? null`

**Fichiers modifies :** `src/components/nlp/NLPBot.jsx`, `src/api/client.js`, `server.js`

**Verification :**
- Build React reussi sans erreurs
- Tests pre-existants inchanges (les echecs ChatPanel sont anterieurs a cette session)

---

# Session du 2026-03-09

Projet : [[smartux-ai/README|SmartUX-AI]]

---

## Changements effectués

### 3. Adaptateur SIH — proposition.md Section 3

> [!info] Contexte
> La [[smartux-ai/proposition|proposition d'evolution]] Section 3 identifie l'absence de connexion avec les systemes hospitaliers existants (DPI, SIH) comme un bloquant majeur avant tout deploiement. Le standard impose par le SEGUR du numerique est HL7 FHIR R4.

**Etat avant :**
- Toutes les donnees patients, medicaments, observations, constantes, imagerie etaient des tableaux JS statiques dans `database.js`
- Aucune couche d'abstraction — impossible de brancher un vrai DPI sans réécrire le code
- Le frontend importait directement depuis `database.js`

**Ce qui a ete fait :**
- `server/adapters/index.js` — fabrique SIH : lit `SIH_ADAPTER` dans `.env` et retourne l'adaptateur correspondant
- `server/adapters/local-adapter.js` — wraps `database.js` via `import()` dynamique ; expose l'interface asynchrone complete (`getPatients`, `getPatient`, `getMedicaments`, `getObservations`, `getConstantes`, `getImagerie`)
- `server/adapters/fhir-adapter.js` — connecteur HL7 FHIR R4 complet :
  - Consomme `Patient`, `AllergyIntolerance`, `Medication`, `Observation` (vital-signs + survey), `ImagingStudy`
  - Mapping FHIR → format interne SmartUX (codes LOINC pour constantes vitales : 8480-6 TA systolique, 8462-4 TA diastolique, 8867-4 FC, 8310-5 temperature, 59408-5 SpO2, 29463-7 poids)
  - Gestion des composants FHIR pour la TA (certains SIH encodent systolique/diastolique comme `component`)
  - Chargement parallele des allergies pour ne pas bloquer la liste patients
- `server.js` — 6 nouvelles routes serveur via l'adaptateur :
  - `GET /api/patients` → liste patients
  - `GET /api/patients/:id` → dossier complet (patient + observations + constantes + imagerie)
  - `GET /api/patients/:id/observations|constantes|imagerie` → ressources individuelles
  - `GET /api/medicaments` → formulaire medicamenteux
- `.env.example` — documentation des 3 nouvelles variables : `SIH_ADAPTER`, `FHIR_BASE_URL`, `FHIR_AUTH_TOKEN`

**Fichiers crees :** `server/adapters/index.js`, `server/adapters/local-adapter.js`, `server/adapters/fhir-adapter.js`

**Fichiers modifies :** `server.js`, `.env.example`, `proposition.md`, `README.md`, `SUMMARY.md`

**Verification :**
- Local adapter charge : 6 patients, 45 medicaments, 2 observations/2 constantes/2 imagerie pour patient 1
- `SIH_ADAPTER=local` fonctionne sans configuration supplementaire (prototype inchange)
- `SIH_ADAPTER=fhir` necessite `FHIR_BASE_URL` (validation au demarrage avec `process.exit(1)` si absente)

**Ce qui reste hors scope (Phase 2+) :**
- Branchement effectif sur un DPI reel (Crossway, Dx Care, Easily) — necessite infrastructure externe
- Integration pharmacie (Dispen-Sys, Pharma)
- Lecture PACS DICOM (Orthanc, Synapse)
- Synchronisation temps reel des constantes vitales (WebSocket HL7 v2)
- Migration du frontend pour appeler `/api/patients` au lieu d'importer `database.js` directement

---

### 1. Variables d'environnement — proposition.md Section 1

> [!info] Contexte
> La [[smartux-ai/proposition|proposition d'evolution]] Section 1 identifie la cle API Groq hardcodee, le port et le chemin DB comme bloquants avant tout deploiement. Action marquee "Immediate" dans le tableau de priorisation.

**Etat avant :**
- `dotenv` etait require dans `server.js` et la cle lue depuis `process.env.GROQ_API_KEY`, mais `dotenv` n'etait pas declare dans `package.json`
- Port `3001` hardcode dans `server.js`
- Chemin DB `sillage.db` hardcode dans `server.js`
- Pas de validation au demarrage si la cle API manque
- `.env.example` incomplet (seulement `GROQ_API_KEY`)

**Corrections :**
- `dotenv` ajoute dans `package.json` dependencies
- `PORT` et `DB_PATH` lus depuis `.env` avec fallback (`3001`, `sillage.db`)
- Validation au demarrage : `server.js` refuse de lancer si `GROQ_API_KEY` absente (message explicite + `process.exit(1)`)
- `.env` complete : `GROQ_API_KEY`, `PORT`, `DB_PATH`
- `.env.example` complete avec les 3 variables documentees
- `.env` deja dans `.gitignore` (pre-existant)

**Fichiers modifies :** `server.js`, `package.json`, `.env`, `.env.example`

**Verification :**
- Serveur demarre correctement et repond sur `/api/prescriptions`
- Tests unitaires : resultat identique avant/apres (36 failed, 1 passed — echecs pre-existants lies aux exports de composants, pas a ces changements)
- `proposition.md` mise a jour : action marquee "Fait", callout passe de `[!warning]` a `[!done]`

---

### 2. Authentification — proposition.md Section 2

> [!info] Contexte
> La [[smartux-ai/proposition|proposition d'evolution]] Section 2 identifie trois problemes critiques : mots de passe en clair dans le bundle frontend, comparaison cote client, et absence de session persistante.

**Etat avant :**
- `DB_STAFF` dans `database.js` (module frontend) contenait les mots de passe en clair (`"sophie2024"`, `"admin"`, etc.) — visibles dans le bundle JS envoye au navigateur
- `handlePasswordAuth` dans `BioBot.jsx` comparait directement `match.password !== pwdPass` cote client
- `authenticatedUser` etait un simple `useState(null)` — perdu au rechargement de page
- Pas de timeout de session

**Corrections :**
- `database.js` : champ `password` retire de tous les 16 entrees `DB_STAFF` — les mots de passe ne transitent plus vers le frontend
- `server.js` : ajout de `STAFF_LOOKUP` (donnees staff sans mots de passe) + `DEFAULT_CREDENTIALS` (mots de passe en clair en memoire serveur uniquement)
- `server.js` : table SQLite `staff_credentials` creee au demarrage — `DEFAULT_CREDENTIALS` haches avec `crypto.scryptSync` (sel aleatoire 16 bytes, cle 64 bytes) et inseres au premier lancement
- `server.js` : route `POST /api/auth` — recherche staff par `last_name` / `employee_number` / `first_name`, verifie le hash en base, retourne le record staff sans mot de passe
- `src/api/client.js` : fonction `authLogin(login, password)` ajoutee — appel centralise a `POST /api/auth`
- `BioBot.jsx` : `handlePasswordAuth` remplace la comparaison locale par `await authLogin(...)` — affiche `"Serveur inaccessible."` si reseau KO
- `SmartUX_AI_Bots.jsx` : `useState` initialise depuis `sessionStorage` (restauration transparente au rechargement)
- `SmartUX_AI_Bots.jsx` : `handleAuth` persiste le user en `sessionStorage`, `handleLogout` le supprime
- `SmartUX_AI_Bots.jsx` : timeout inactivite 15 min — `useEffect` avec listeners `mousemove` / `keydown` / `click` qui reinitialisent le timer

**Fichiers modifies :** `server.js`, `src/database.js`, `src/api/client.js`, `src/components/auth/BioBot.jsx`, `src/SmartUX_AI_Bots.jsx`

**Verification :**
- `crypto.scryptSync` verifie : `hash("admin")` puis `verify("admin", hash)` → true, `verify("wrong", hash)` → false
- Aucun champ `password` dans `DB_STAFF` frontend
- Les methodes bio et badge (simulation) sont inchangees — elles n'utilisaient pas les mots de passe
- La demo hint dans BioBot conserve `admin / admin` pour le prototype

**Ce qui reste a faire (hors scope simple) :**
- LDAP / Active Directory (requiert infrastructure externe)
- SSO SAML / OpenID Connect (requiert fournisseur d'identite)
- MFA (requiert canal secondaire)
- Vraie biometrie (requiert SDK certifie)
- Les mots de passe par defaut dans `DEFAULT_CREDENTIALS` de `server.js` devraient migrer vers un processus de bootstrap securise ou variables d'environnement avant production

---

---

### 3. Sequences utilisateur (documentation)

- Ajout d'un dossier `sequences/` avec les parcours utilisateur de chaque bot :
  - `01-biobot-authentification.md` — connexion (mot de passe, biometrie, badge), deconnexion, session
  - `02-nlpbot-writeout.md` — saisie NLP, extraction, dialogue 3 questions, enregistrement
  - `03-alertsystem-securite.md` — alertes automatiques, severites, gestion concurrence
  - `04-doctor-ai-chat.md` — chat SSE streaming, contexte patients, dictee vocale
  - `05-rxtab-prescriptions.md` — Kanban, validation, annulation, export PDF
  - `06-panels-consultation.md` — Dossier, Observations, Imagerie, Parametres
- `sequences/` ajoute a `.gitignore` (documentation interne, pas dans le repo)

## Notes

- Les 5 suites de tests echouent toutes a cause de fonctions non exportees depuis `SmartUX_AI_Bots.jsx` (`callClaudeChat`, `buildDossierContext`, `AlertSystem`). C'est un probleme pre-existant distinct de cette session.
- Les autres actions de Section 1 (multi-tenant, PostgreSQL, Docker, config par etablissement) sont des changements architecturaux majeurs — pas des corrections simples a appliquer au code actuel.

---

# Sessions precedentes

Projet : [[smartux-ai/README|SmartUX-AI]]
Stack : React · Node.js / Express · [[Groq]] (LLaMA 3.3-70b) · SQLite

---

## Changements effectués

### 1. Suppression de la sidebar NLP dans Dossier / Observations / Imagerie

> [!info] Contexte
> Les rubriques **Dossier**, **Observations** et **Imagerie** affichaient une sidebar [[NLPBot]] sur la droite (360 px). L'utilisateur voulait un affichage pleine largeur sans assistant IA sur ces onglets.

- Suppression du bloc flex deux-colonnes (panel + `NLPBot` compact) pour ces trois sous-onglets
- Les panneaux passent en pleine largeur (`animation: tabIn`)
- `maxWidth` réduit de `1380` → `1200` pour ces vues

**Fichier modifié :** `src/SmartUX_AI_Bots.jsx` — section `MAIN` (layout principal)

---

### 2. Correction du parsing SSE — espaces entre les mots

> [!bug] Problème
> Les tokens renvoyés par [[Groq]] via SSE commencent par un espace (ex : ` Comment`, ` puis`). Le `.trim()` appliqué sur chaque token supprimait ces espaces, ce qui collait tous les mots : `AnalyseassistéeparIA…`

- **Fix :** Retrait du `.trim()` sur le payload SSE dans `ChatPanel.sendMessage`
- Les checks `[DONE]` et `[ERROR]` utilisent toujours `.trim()` pour la comparaison uniquement

**Fichier modifié :** `src/SmartUX_AI_Bots.jsx` — fonction `sendMessage` dans `ChatPanel`

---

### 3. Messages d'erreur + indicateur de chargement dans le chat

> [!warning] Problème
> Quand le serveur n'était pas lancé, le chat échouait silencieusement — aucun retour visuel pour l'utilisateur.

- `chatReducer` — case `ERROR` : ajout d'un message bulle rouge *"Impossible de contacter le serveur…"*
- Ajout d'un **indicateur de chargement** (3 points animés) pendant que l'IA répond
- Les bulles d'erreur ont un fond `#FEF2F2` + bordure rouge

**Fichier modifié :** `src/SmartUX_AI_Bots.jsx` — `chatReducer` + `ChatPanelInner`

---

### 4. Accès à la base de données depuis Doctor AI

> [!success] Fonctionnalité ajoutée
> Le chat peut maintenant répondre à des questions sur **n'importe quel patient** de la base, même sans patient sélectionné.

- Nouvelle fonction `buildAllPatientsContext(allPrescriptions)` :
  - Itère sur tous les patients de [[DB_PATIENTS]]
  - Injecte : constantes (dernières), allergies ([[KNOWN_ALLERGIES]]), note clinique récente, imagerie ([[DB_IMAGERIE]]), prescriptions actives
- Le `systemPrompt` du chat inclut toujours ce contexte complet
- Si un patient est sélectionné → une ligne de focus est ajoutée : *"Le personnel a actuellement sélectionné Jean Dupont"*
- Prop `prescriptions` ajoutée sur `ChatPanel`

**Fichier modifié :** `src/SmartUX_AI_Bots.jsx` — `buildAllPatientsContext` + `ChatPanel` + appel parent

---

### 5. Renommage en "Doctor AI"

- Titre du drawer chat : `"Chat clinique"` → `"Doctor AI"`
- Bouton dans le header : `"Chat clinique"` / `"Fermer chat"` → `"Doctor AI"` / `"Fermer Doctor AI"`
- Barre d'identité patient : correction des champs `patient.prenom` / `patient.nom` (inexistants) → `patient.first_name` / `patient.last_name`

**Fichier modifié :** `src/SmartUX_AI_Bots.jsx` — `ChatPanelInner` + header principal

---

### 6. Renommage de l'onglet "NLP Contextuel" → "Write out"

- Label du tab `nlp` renommé de `"NLP Contextuel"` → `"Write out"`

**Fichier modifié :** `src/SmartUX_AI_Bots.jsx` — tableau `tabs`

---

### 7. Anonymisation des patients dans le chatbot Doctor AI

> [!info] Contexte RGPD
> Le chatbot Doctor AI ne doit jamais mentionner le nom des patients — seul l'identifiant `H-{patient_id}` est utilisé. L'alerte NLP (Write out) conserve les noms complets.

- `buildAllPatientsContext` : en-tête patient anonymisé → `## Patient H-{id}` (au lieu de nom + prénom + IPP)
- `focusLine` dans `ChatPanel.sendMessage` : retire le nom complet → `H-${patient.patient_id}` uniquement
- `CLAUDE_SYSTEM_PROMPT_CHAT` règle 7 ajoutée : *"Ne cite JAMAIS le nom d'un patient — réfère-toi uniquement à son identifiant"*

**Fichier modifié :** `src/SmartUX_AI_Bots.jsx` — `buildAllPatientsContext` + `ChatPanel` + `CLAUDE_SYSTEM_PROMPT_CHAT`

---

### 8. Préférences d'affichage fonctionnelles (Paramètres)

> [!success] Fonctionnalité activée
> Les boutons taille de texte (S/M/L) et densité (Compact/Normal) dans l'onglet Paramètres sont maintenant opérationnels.

- État `fontSize` et `density` remontés dans le composant racine `SmartUXBots`
- `fontSize` appliqué à `document.body.style.fontSize` en temps réel
- `density` appliqué au padding de `<main>` : Compact `16px 24px 60px` / Normal `32px 24px 80px`
- Les deux préférences sont **persistées dans `localStorage`** et restaurées au rechargement
- `ParametresPanel` passe de state local à props reçues depuis la racine
- Note mise à jour : *"sauvegardées automatiquement dans le navigateur"*

**Fichier modifié :** `src/SmartUX_AI_Bots.jsx` — `SmartUXBots` + `ParametresPanel`

---

### 9. Dictée vocale (voice input) dans Doctor AI

> [!success] Fonctionnalité ajoutée
> Le chatbot Doctor AI dispose maintenant d'un bouton microphone pour dicter les messages (comme le Write out l'avait déjà).

- `ChatPanelInner` : ajout de `SpeechRecognition` (`fr-FR`, non-continu) via `useRef` + `useState`
- Bouton microphone inséré entre le champ texte et "Envoyer" — visible uniquement si `window.SpeechRecognition` est disponible
- Quand écoute active : bouton rouge + animation `voicePulse` + bordure rouge sur l'input
- Le transcript remplace le contenu de l'input dès que la parole est détectée
- Note : le Write out (`AutocompleteInput`) avait déjà cette fonctionnalité complète

**Fichier modifié :** `src/SmartUX_AI_Bots.jsx` — `ChatPanelInner`

---

## Architecture du projet

```
smartux-ai/
├── src/
│   ├── SmartUX_AI_Bots.jsx       <- composant racine (auth, tabs, layout)
│   ├── api/client.js              <- fonctions fetch (auth, NLP, chat SSE)
│   ├── components/
│   │   ├── auth/BioBot.jsx        <- ecran de connexion (mot de passe, biometrie)
│   │   ├── alerts/                <- systeme d'alertes IA
│   │   ├── chat/                  <- Doctor AI drawer
│   │   ├── nlp/                   <- Write out (saisie NLP)
│   │   ├── panels/                <- Dossier, Observations, Imagerie, Parametres
│   │   ├── rx/                    <- gestion prescriptions
│   │   └── ui/                    <- composants partages (Btn, Badge...)
│   ├── constants/theme.js         <- palette couleurs
│   ├── database.js                <- donnees statiques (patients, staff, medicaments)
│   └── App.js
├── server.js                      <- API Express (auth, prescriptions, Groq NLP/SSE)
├── .env                           <- GROQ_API_KEY, PORT, DB_PATH (gitignored)
├── .env.example                   <- template des variables requises
└── sillage.db                     <- SQLite (prescriptions + staff_credentials)
```

> [!tip] Pour démarrer
> ```bash
> node server.js   # port 3001
> npm start        # port 3000
> ```

---

## Notes techniques

- Le backend `server.js` utilise **[[Groq]]** (`api.groq.com`) avec le modèle `llama-3.3-70b-versatile` — malgré les routes nommées `/api/claude` (legacy)
- Le streaming SSE est géré côté serveur avec `res.write("data: token\n\n")` et côté client avec `ReadableStream` + `getReader()`
- La cle Groq est dans `.env` (valide au demarrage, `process.exit(1)` si absente)

---

## Liens

- [[smartux-ai/README|README du projet]]
- [[smartux-ai/.planning/research/SUMMARY|Recherche initiale]]
