# SmartUX-AI — Prototype SIH SILLAGE

**Projet CRIStAL × Centrale Lille** · Prototype de recherche UX · 2026

---

## Présentation

SmartUX-AI est un prototype de recherche UX démontrant des interfaces augmentées par l'IA pour **SILLAGE**, le système d'information hospitalier utilisé dans les établissements de santé français. Il explore trois défis HCI :

1. **Saisie en langage naturel** — remplacer les formulaires par du texte libre médical traité par un bot NLP (Groq — modèle Llama 3.3 70B).
2. **Contrôle d'accès sécurisé** — simulation d'authentification multi-méthodes (biométrie, badge RFID, mot de passe) liée à une base de personnel réelle.
3. **Gestion des actes et ordres** — suivi des prescriptions avec délais impartis, niveaux d'urgence et historique.

---

## Lancer le projet

### Prérequis

- [Node.js](https://nodejs.org/) v18 ou supérieur
- npm v9 ou supérieur

### Installation

```bash
# Aller dans le dossier de l'application React
cd smartux-ai

# Installer les dépendances
npm install
```

### Démarrer l'application complète (React + serveur API)

Le projet utilise **deux processus** : le serveur Express (API + SQLite) et le client React.

**Terminal 1 — Serveur API (port 3001) :**

```bash
cd smartux-ai
node server.js
```

Le serveur démarre sur `http://localhost:3001`. Il gère :
- `GET  /api/prescriptions` — récupérer toutes les prescriptions depuis `sillage.db`
- `POST /api/prescriptions` — enregistrer une nouvelle prescription
- `PATCH /api/prescriptions/:id` — mettre à jour (valider / annuler / modifier)
- `POST /api/claude` — proxy NLP : reçoit le texte du client React et appelle l'API Groq

**Terminal 2 — Application React (port 3000) :**

```bash
cd smartux-ai
npm start
```

L'app s'ouvre automatiquement sur `http://localhost:3000`.

### Structure du dossier `smartux-ai`

```
smartux-ai/
├── package.json              — Dépendances React + Express
├── server.js                 — API Express + SQLite (port 3001)
├── proxy.js                  — Proxy CORS (optionnel, port 8080)
├── sillage.db                — Base SQLite générée automatiquement au démarrage
├── public/
│   └── index.html
└── src/
    ├── index.js              — Point d'entrée React
    ├── App.js                — Monte SmartUXBots
    ├── SmartUX_AI_Bots.jsx   — Application complète (composant principal)
    └── App.css / index.css
```

### Construire pour la production

```bash
cd smartux-ai
npm run build
```

Le dossier `build/` contient l'application optimisée, à servir avec n'importe quel serveur statique.

### Base de données SQLite (optionnel)

Pour explorer la base directement :

```bash
sqlite3 smartux-ai/sillage.db
```

Pour réinitialiser le schéma depuis le fichier SQL :

```bash
sqlite3 sillage_new.db < sillage_database.sql
```

### Clé API Groq (NLP)

Le bot NLP **ne contacte pas l'API Groq directement depuis le navigateur**. Il passe par le serveur local :

```
React (port 3000) → POST /api/claude (port 3001) → API Groq → llama-3.3-70b-versatile
```

La clé API Groq est stockée dans `server.js` (variable `GROQ_API_KEY`, ligne 98). Pour l'obtenir ou la renouveler : [console.groq.com](https://console.groq.com).

En production, déplacez la clé dans une variable d'environnement pour ne pas la laisser dans le code source :

```js
// server.js
const GROQ_API_KEY = process.env.GROQ_API_KEY;
```

```bash
# Lancement avec variable d'environnement
GROQ_API_KEY=gsk_... node server.js
```

Le modèle utilisé est `llama-3.3-70b-versatile` avec `temperature: 0.1` pour des extractions stables et déterministes. Il est appelé avec un prompt structurant qui demande une réponse en JSON médical.

---

## Architecture de la base de données (`sillage_database.sql`)

Le projet fournit une base SQL complète **compatible SQLite et PostgreSQL** (ajustements de types mineurs pour PostgreSQL).

### Base patients

| Table | Description |
|---|---|
| `patients` | Identité patient : IPP, NIR/INS, démographie, consentement, assurance, médecin traitant |
| `hospitalizations` | Séjours d'hospitalisation : unité, lit, dates, type d'admission, équipe soignante |
| `diagnoses` | Diagnostics codés ICD-10 par séjour (principal, associé, complication) |
| `allergies` | Allergies aux substances avec sévérité et type de réaction |
| `medications` | Prescriptions en cours : médicament, dose, voie, fréquence, prescripteur |
| `vitals` | Mesures répétées de signes vitaux (FC, TA, température, SpO₂, douleur, IMC…) |
| `lab_results` | Résultats biologiques codés LOINC avec plages de référence et statut de validation |
| `medical_notes` | Notes cliniques libres, comptes-rendus de sortie, extraits NLP |
| `imaging` | Examens de radiologie (modalité, région, référence PACS, compte-rendu radiologue) |
| `surgical_acts` | Actes chirurgicaux codés CCAM avec chirurgien, anesthésiste et détails bloc |

### Base personnel

| Table | Description |
|---|---|
| `staff` | Dossier complet du personnel : identité, rôle, service, contrat, enrôlement biométrique, identifiants SILLAGE, **mot de passe** |
| `roles` | 15 rôles de Administrateur Système (niveau 5) à Agent d'Accueil (niveau 1) |
| `permissions` | 20 permissions atomiques réparties en 4 catégories : PATIENT, STAFF, SYSTEM, BILLING |
| `role_permissions` | Table de liaison rôle ↔ permissions (many-to-many) |
| `departments` | 12 services hospitaliers (Cardiologie, Urgences, Réanimation, Maternité…) |
| `wards` | Unités physiques avec capacité et type (USI, Chirurgie, Maternité…) |
| `staff_shifts` | Planning des gardes par membre du personnel et unité |
| `staff_access_log` | Journal d'audit : chaque connexion, accès patient, utilisation biométrique |

### Référentiel médicaments

| Table | Description |
|---|---|
| `medicaments` | **61 médicaments hospitaliers français réels** issus du référentiel Vidal/HAS — nom de marque, DCI/INN, forme, dosage standard, voie, code ATC, catégorie thérapeutique, prescription obligatoire, stupéfiant, dose max journalière, contre-indications, catégorie grossesse |

### Table prescriptions

| Table | Description |
|---|---|
| `prescriptions` | Ordonnances détaillées liées aux patients et médicaments. Inclut tous les champs cliniques **et** les métadonnées NLP : phrase originale (`nlp_raw_text`), JSON extrait (`nlp_extracted_json`), niveau de confiance, champs auto-remplis. Supporte le workflow de validation (en attente → validé / annulé). Inclut le champ `echeance` pour les délais impartis. |

### Vues SQL

- `v_active_patients` — patients hospitalisés en cours avec unité et médecin référent
- `v_staff_summary` — personnel avec libellé de rôle, niveau d'accès, service
- `v_staff_permissions` — permissions à plat par membre actif du personnel
- `v_prescriptions` — prescriptions enrichies avec nom patient, nom complet du médicament et prescripteur

---

## Application React (`SmartUX_AI_Bots.jsx`)

### Onglet 1 — NLP Contextuel

Le bot NLP accepte des phrases médicales libres en français et :

1. Envoie le texte au serveur local (`POST http://localhost:3001/api/claude`), qui appelle l'API **Groq** avec le modèle `llama-3.3-70b-versatile`
2. Extrait un JSON structuré : `patient`, `medicament`, `dose`, `voie`, `frequence`, `diagnostic`, `service`, `priorite`, `chambre`, `allergie`, `action`, `examen`, `note`
3. **Mappe les champs extraits sur les colonnes de la table `prescriptions`** — correspondance patient via `DB_PATIENTS`, médicament via `DB_MEDICAMENTS`
4. Affiche un aperçu de prescription avec badges de correspondance (patient, médicament) et indicateur de confiance (HIGH / MEDIUM / LOW)
5. **Pose une question sur le délai imparti** après extraction : "Quel est le délai imparti pour cet acte ? (ex : 2h, 24h, 3 jours, ou « aucun »)" — l'`echeance` est calculée et stockée sur la prescription
6. Permet au clinicien d'**enregistrer dans SILLAGE** via le serveur API (POST `/api/prescriptions`)

**Autocomplete (`AutocompleteInput`)** : suggestions en cours de frappe depuis la base de données (noms de patients, médicaments, gabarits de phrases médicales, termes courants). Navigation au clavier : Tab pour accepter, ↑↓ pour naviguer, Entrée pour soumettre.

### Onglet 2 — Sécurité Biométrique

Simule l'authentification multi-méthodes pour les actions sensibles dans SILLAGE.

**3 méthodes d'authentification disponibles (sélection par onglets) :**

| Méthode | Description |
|---|---|
| Biométrie | Caméra faciale — capture vidéo, détection de visage simulée, vérification |
| Badge RFID | Lecture de badge simulée — affiche le N° employé, accès en 1 clic |
| Mot de passe | Formulaire identifiant + mot de passe — validé contre `DB_STAFF` en temps réel |

La liste du personnel est issue de `DB_STAFF` (16 membres dont le compte admin). Recherche par nom, rôle ou service. Niveau d'accès affiché par cercle coloré (5 = rouge/admin, 1 = gris/lecture seule). Statut d'enrôlement biométrique affiché par point vert/gris.

À l'accès accordé, la carte de résultat affiche : identité, N° employé, rôle, service, spécialité, niveau d'accès, **méthode d'authentification utilisée**, statut biométrique, horodatage et liste complète des permissions issues de `role_permissions`.

**Compte administrateur :**
- Identifiant : `admin` · Mot de passe : `admin`
- Niveau d'accès : 5/5 · Rôle : Super Administrateur

**Mots de passe du personnel** (pour les tests, méthode "Mot de passe") :

| Identifiant | Mot de passe | Rôle |
|---|---|---|
| martin | sophie2024 | Médecin — Cardiologie |
| dubois | laurent2024 | Médecin — Neurologie |
| bernard | isa2024 | Chirurgien |
| leroy | karim2024 | Anesthésiste-Réanimateur |
| moreau | celine2024 | Cadre de Santé |
| simon | pierre2024 | IDE — Urgences |
| rousseau | marc2024 | Biologiste Médical |
| petit | amina2024 | Radiologue |
| admin | admin | Super Administrateur |

### Onglet 3 — Actes & Ordres

Vue en temps réel de toutes les prescriptions/actes enregistrés depuis le bot NLP.

**Badges de notification sur l'onglet :**
- Badge **orange** (à gauche) — nombre d'actes non-urgents en attente
- Badge **rouge** (à droite) — nombre d'actes urgents (URGENTE ou STAT)
- Badge **orange foncé** — actes dont l'échéance expire dans moins de 30 minutes

Les urgents ne sont pas comptés dans le badge orange (évite le doublon).

**Sections dans l'onglet :**

| Section | Couleur | Condition |
|---|---|---|
| Expirent dans moins de 30 min | Ambre | Délai imparti actif, échéance dans < 30 min |
| Tâches urgentes | Rouge | Priorité URGENTE ou STAT, non validé |
| Tâches à faire | Ambre | En attente, non urgent |
| Historique | Gris | Validé ou annulé |
| ↳ Délai dépassé | Rouge | Traité après l'échéance |
| ↳ Dans les délais | Vert | Traité avant l'échéance |

Chaque carte affiche : médicament/acte, patient, dosage, voie, fréquence, service, chambre, action, allergie, phrase NLP originale (en italique), **délai restant ou dépassé en temps réel** (ex. "2h restantes", "Dépassé depuis 15 min"). Actions : **Valider** / **Annuler** pour les actes en attente.

---

## Données de référence

| Entité | Nombre |
|---|---|
| Patients | 6 (avec dossiers cliniques complets) |
| Personnel | 16 (dont 1 compte admin) |
| Rôles | 15 |
| Permissions | 20 |
| Services | 12 |
| Unités | 10 |
| Hospitalisations actives | 6 |
| Diagnostics | 8 (codés ICD-10) |
| Médicaments de référence | 61 médicaments réels |

---

## Design Tokens

| Token | Valeur | Usage |
|---|---|---|
| `ACCENT` | `#0F4C75` | Bleu principal — en-têtes, liens, actions clés |
| `ACCENT2` | `#E91E8C` | Rose — biométrie, badges, highlights |
| `BG` | `#F5F3EE` | Fond de l'application |
| `CARD` | `#FFFFFF` | Fonds de cartes |
| `MUTED` | `#6B7280` | Texte secondaire |
| `GREEN` | `#10B981` | Succès, validé, dans les délais |
| `AMBER` | `#F59E0B` | Attention, à faire, délai proche |
| `RED` | `#EF4444` | Urgent, refus, délai dépassé |
| Police | DM Sans + Space Mono | Corps + mono/code |

---

## Fichiers du projet

```
UX/
├── README.md                   — Ce fichier
├── sillage_database.sql        — Schéma complet + données de référence (SQLite/PostgreSQL)
└── smartux-ai/                 — Application React
    ├── package.json
    ├── server.js               — API Express + SQLite (port 3001)
    ├── proxy.js                — Proxy CORS optionnel (port 8080)
    ├── sillage.db              — Base SQLite (créée au 1er démarrage du serveur)
    └── src/
        ├── SmartUX_AI_Bots.jsx — Application complète (~1 500 lignes)
        ├── App.js
        └── index.js
```

---

*Prototype — CRIStAL × Centrale Lille · Recherche UX 2026*
