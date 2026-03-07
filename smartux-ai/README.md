# SmartUX-AI

Prototype d'interface hospitalière en français pour le projet **SILLAGE** (CRIStAL x Centrale Lille).

---

## Lancer le projet

Les deux processus doivent tourner en parallèle :

```bash
# Terminal 1 — API Express (port 3001)
node server.js

# Terminal 2 — Frontend React (port 3000)
npm start
```

Autres commandes :

```bash
npm run build                                      # Build de production
npm test                                           # Tests en mode watch
npm test -- --watchAll=false                       # Tests en mode CI
npm test -- --testPathPattern=ChatPanel            # Un seul fichier de test
npm test -- --testNamePattern="CHAT-01"            # Tests par nom
```

---

## Architecture

### Deux processus requis

| Processus | Port | Rôle |
|-----------|------|------|
| `server.js` (Express) | 3001 | Proxy vers l'API Groq, persistance SQLite |
| `src/` (React CRA) | 3000 | Interface utilisateur complète |

Malgré les noms de routes `/api/claude`, le backend appelle l'**API Groq** (`api.groq.com`) avec le modèle `llama-3.3-70b-versatile`.

### Frontend — `src/SmartUX_AI_Bots.jsx`

Fichier unique (~1700 lignes) contenant toute la logique UI, organisé en blocs :

| Bloc | Contenu |
|------|---------|
| `IMPORTS & THEME CONSTANTS` | Imports React, palette de couleurs |
| `UTILITY FUNCTIONS` | `autoCorrect`, `detectAllergyConflict` |
| `NLP → PRESCRIPTION MAPPER` | `mapNLPToPrescription()` |
| `PARSE DELAY` | Conversion délais texte vers timestamp |
| `AI API CALL` | `parseWithClaude()` — NLP non-streaming |
| `PATIENT DOSSIER CONTEXT BUILDER` | `buildDossierContext()` — SAFE-01 |
| `ALL-PATIENTS CONTEXT BUILDER` | `buildAllPatientsContext()` |
| `SYSTEM PROMPTS` | `SYSTEM_PROMPT_ALERT`, `SYSTEM_PROMPT_CHAT` |
| `ROLE-AWARE SYSTEM PROMPT BUILDER` | `buildChatSystemPrompt(user)` |
| `AI CHAT WRAPPER` | `callAIChat()` — non-streaming, alertes — SAFE-02 |
| `ALERT SYSTEM` | `AlertSystem`, `AlertBanner`, `parseAlertResponse()` |
| `CHAT PANEL` | `ChatPanel`, `ChatPanelInner` — SSE streaming |
| `EXPORT PDF` | Génération PDF via jsPDF CDN |
| `SHARED UI ATOMS` | `Badge`, `Btn` |
| `AUTOCOMPLETE INPUT` | Saisie avec voix, historique, autocomplétion |
| `ICONS` | SVG inline — pas d'emoji |
| `LIVE CLOCK` | Horloge temps réel |
| `DOSSIER PANEL` | Vue patients avec actes & ordres |
| `IMAGERIE PANEL` | Examens d'imagerie avec filtres |
| `OBSERVATIONS PANEL` | Notes cliniques + constantes vitales |
| `PARAMETRES PANEL` | Profil utilisateur, permissions, préférences |
| `TABS` | Configuration des onglets principaux et secondaires |
| `ROOT COMPONENT` | `SmartUXBots` — état global, navigation |

### Base de données locale — `src/database.js`

Toutes les données statiques (pas de fetch frontend) :

| Export | Contenu |
|--------|---------|
| `DB_PATIENTS` | 6 patients (IPP, nom, naissance, groupe sanguin, chambre, service) |
| `DB_STAFF` | 16 membres du personnel (rôle, niveau d'accès 1-5, mot de passe, biométrie) |
| `DB_MEDICAMENTS` | 45 médicaments (DCI, forme, dosage, voie, catégorie) |
| `DB_OBSERVATIONS` | Notes cliniques par patient |
| `DB_CONSTANTES` | Constantes vitales par patient |
| `DB_IMAGERIE` | Examens d'imagerie par patient |
| `KNOWN_ALLERGIES` | Allergies connues par `patient_id` |
| `TYPO_CORRECTIONS` | Corrections automatiques de fautes médicales |
| `AUTOCOMPLETE_CORPUS` | Phrases et termes pour l'autocomplétion |
| `ACCESS_PERMISSIONS` | Permissions par niveau d'accès (1 à 5) |
| `PERM_LABELS` | Labels français des permissions |

### Backend — `server.js`

API Express sur `http://localhost:3001`. Base SQLite (`sillage.db`) créée automatiquement.

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/prescriptions` | Récupérer toutes les prescriptions |
| POST | `/api/prescriptions` | Créer une prescription |
| PATCH | `/api/prescriptions/:id` | Mettre à jour une prescription |
| POST | `/api/claude` | Proxy Groq — réponse JSON (NLP + alertes) |
| POST | `/api/claude-stream` | Proxy Groq — SSE streaming (Doctor AI chat) |

---

## Flux d'authentification

L'application est protégée par authentification avant tout accès.

- Au lancement : seul l'écran d'authentification est visible
- Trois méthodes : **Reconnaissance faciale**, **Badge RFID**, **Mot de passe**
- Après validation : accès complet avec nom, titre et niveau d'accès affichés dans la barre
- Bouton **x** pour se déconnecter

---

## Onglets principaux

| Onglet | Description |
|--------|-------------|
| **Write out** | Saisie libre en français → prescription structurée via LLM (Groq) |
| **Actes & Ordres** | Consultation et gestion des prescriptions en base SQLite |

### Sous-onglets

| Sous-onglet | Description |
|-------------|-------------|
| **Dossier** | 6 patients avec actes & ordres, allergies, priorités — affichage pleine largeur (sans sidebar NLP) |
| **Observations** | Notes cliniques + constantes vitales par patient — affichage pleine largeur |
| **Imagerie** | Examens d'imagerie avec filtre par statut — affichage pleine largeur |
| **Paramètres** | Profil utilisateur, permissions accordées, préférences d'affichage |

---

## Doctor AI — Chat panel

Bouton flottant dans la barre de navigation → tiroir latéral droit.

- Streaming SSE via `POST /api/claude-stream`
- Contexte complet de tous les patients injecté dans le system prompt
- Si un patient est sélectionné, le focus est mis sur ce patient
- Réinitialisation automatique de l'historique au changement de patient
- Indicateur de chargement (3 points animés) pendant la réponse IA
- Message d'erreur bulle rouge si le serveur est injoignable

### Réponses adaptées au rôle

Le contenu des réponses varie selon le niveau d'accès de l'utilisateur connecté :

| Niveau | Rôles | Contenu des réponses |
|--------|-------|----------------------|
| 4-5 | Médecin, Chirurgien, Anesthésiste, Biologiste, Radiologue, Sage-Femme | Détail clinique complet : hypothèses diagnostiques, interactions, pronostic |
| 3 | Infirmier, Cadre de Santé, Pharmacien | Informations opérationnelles : médicaments, posologies, protocoles |
| 2 | Aide-Soignant, Interne, Secrétaire | Soins de base : état général, instructions immédiates |
| 1 | Agent d'Accueil | Administratif uniquement : chambre, service, rendez-vous |

### Protocole SSE

Le serveur envoie des tokens bruts `data: <token>\n\n`. Ne pas appliquer `.trim()` sur les tokens — Groq inclut les espaces comme séparateurs de mots. Seules les sentinelles `[DONE]` et `[ERROR]` sont trimmées.

### Dictée vocale

Le bouton microphone dans le chat déclenche `SpeechRecognition` (fr-FR). A la fin de la dictée, le transcript est **envoyé automatiquement** sans clic supplémentaire.

---

## Préférences d'affichage (Paramètres)

Configurées dans l'onglet **Paramètres**, persistées dans `localStorage` et restaurées au rechargement.

| Préférence | Options | Effet |
|------------|---------|-------|
| Taille de texte | S / M / L | Appliqué à `document.body.style.fontSize` en temps réel |
| Densité | Compact / Normal | Modifie le padding du `<main>` (Compact : `16px 24px 60px`, Normal : `32px 24px 80px`) |

---

## Système d'alertes

Déclenché automatiquement dans l'onglet NLP quand un médicament est saisi pour un patient sélectionné.

- Appel à `callAIChat()` avec `SYSTEM_PROMPT_ALERT` + dossier patient
- Délai de déclenchement : 1,2 s après la dernière modification (debounce)
- Alertes classées : **CRITIQUE** / **MODERE** / **FAIBLE**
- Protection contre les races conditions via `requestIdRef`
- Les alertes CRITIQUE nécessitent un accusé de réception explicite

---

## System prompts

| Constante | Usage |
|-----------|-------|
| `SYSTEM_PROMPT_ALERT` | Vérification des prescriptions — alertes allergie/interaction |
| `SYSTEM_PROMPT_CHAT` | Base du prompt Doctor AI |
| `buildChatSystemPrompt(user)` | Génère le prompt final avec instructions adaptées au rôle |

---

## Contraintes de sécurité (SAFE-02)

- Les réponses d'alerte commencent toujours par `"Analyse assistée par IA — vérification clinique recommandée"` — double couche : instruction système + prepend de secours dans `callAIChat()`
- Anonymisation PHI : les en-têtes de patients utilisent `H-{patient_id}` au lieu du nom complet (RGPD — confirmation DPA en attente)
- L'IA ne pose jamais de diagnostic — hypothèses uniquement, à vérifier par le clinicien

---

## Contraintes techniques

- **Pas de TypeScript** — JavaScript/JSX uniquement
- **Pas de gestionnaire d'état externe** — `useState` / `useReducer` / `useCallback` uniquement
- **Pas de CSS externe** — styles inline uniquement (Google Fonts : DM Sans + Space Mono)
- **Biométrie simulée** — pas de vraie reconnaissance faciale, le flux caméra est décoratif
- **Données statiques** — patients, personnel, médicaments hardcodés dans `src/database.js`
- **Clé API Groq** — hardcodée dans `server.js`, à déplacer dans un fichier `.env`
