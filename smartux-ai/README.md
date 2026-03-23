# SmartUX-AI

Prototype d'assistant clinique intelligent pour la prescription medicamenteuse hospitaliere.

Projet de recherche CRIStAL x Centrale Lille.

## Obtenir une cle API Groq

Le serveur utilise [Groq](https://groq.com) pour l'inference LLM (llama-3.3-70b). Un compte gratuit suffit pour tester le prototype.

1. Creez un compte sur [console.groq.com](https://console.groq.com)
2. Allez dans **API Keys** → **Create API Key**
3. Copiez la cle generee (elle commence par `gsk_`)
4. A la racine du projet, creez votre fichier `.env` a partir du template :

```bash
cp .env.example .env
```

5. Ouvrez `.env` et remplacez la valeur de `GROQ_API_KEY` :

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
PORT=3001
DB_PATH=sillage.db
```

> **Important** : ne committez jamais votre `.env` — il est deja dans `.gitignore`.

---

## Demarrage rapide

```bash
cp .env.example .env          # renseigner GROQ_API_KEY (voir section ci-dessus)
npm install
node server.js                # API backend — port 3001
npm start                     # React frontend — port 3000
```

Les deux processus doivent tourner simultanement.

## Variables d'environnement

| Variable          | Requis | Defaut       | Description                                    |
|-------------------|--------|--------------|------------------------------------------------|
| `GROQ_API_KEY`    | oui    | —            | Cle API Groq (llama-3.3-70b)                  |
| `PORT`            | non    | `3001`       | Port du serveur Express                        |
| `DB_PATH`         | non    | `sillage.db` | Chemin vers la base SQLite                     |
| `SIH_ADAPTER`     | non    | `local`      | Source de donnees : `local` ou `fhir`          |
| `FHIR_BASE_URL`   | non*   | —            | URL racine FHIR R4 (`*` requis si `fhir`)      |
| `FHIR_AUTH_TOKEN` | non    | —            | Authorization header pour le serveur FHIR      |

Le serveur refuse de demarrer si `GROQ_API_KEY` est absente (ou `FHIR_BASE_URL` si `SIH_ADAPTER=fhir`).

## Architecture

```
smartux-ai/
├── server/
│   └── adapters/
│       ├── index.js               <- fabrique SIH (SIH_ADAPTER=local|fhir)
│       ├── local-adapter.js       <- source locale : database.js statique
│       └── fhir-adapter.js        <- source FHIR R4 (Crossway, Easily, HAPI...)
├── src/
│   ├── SmartUX_AI_Bots.jsx       <- composant racine (auth, tabs, layout)
│   ├── api/client.js              <- fonctions fetch (auth, NLP, chat SSE)
│   ├── components/
│   │   ├── auth/BioBot.jsx        <- ecran de connexion
│   │   ├── alerts/                <- systeme d'alertes IA
│   │   ├── chat/                  <- Doctor AI drawer
│   │   ├── nlp/                   <- Write out (saisie NLP)
│   │   ├── panels/                <- Dossier, Observations, Imagerie, Parametres
│   │   ├── rx/                    <- gestion prescriptions
│   │   └── ui/                    <- composants partages (Btn, Badge...)
│   ├── constants/theme.js         <- palette couleurs
│   ├── database.js                <- donnees statiques (patients, staff, medicaments)
│   └── App.js
├── server.js                      <- API Express (auth, prescriptions, SIH, Groq)
├── .env                           <- variables d'environnement (gitignored — a creer via .env.example)
├── .env.example                   <- template des variables requises
└── sillage.db                     <- SQLite (prescriptions + staff_credentials) (gitignored)
```

## API backend

| Methode | Route                              | Description                                        |
|---------|------------------------------------|----------------------------------------------------|
| POST    | `/api/auth`                        | Authentification (login + mot de passe)            |
| GET     | `/api/prescriptions`               | Liste toutes les prescriptions                     |
| POST    | `/api/prescriptions`               | Enregistre une prescription                        |
| PATCH   | `/api/prescriptions/:id`           | Met a jour une prescription                        |
| GET     | `/api/patients`                    | Liste tous les patients (via adaptateur SIH)       |
| GET     | `/api/patients/:id`                | Dossier complet patient (via adaptateur SIH)       |
| GET     | `/api/patients/:id/observations`   | Notes cliniques du patient                         |
| GET     | `/api/patients/:id/constantes`     | Constantes vitales du patient                      |
| GET     | `/api/patients/:id/imagerie`       | Examens imagerie du patient                        |
| GET     | `/api/medicaments`                 | Formulaire medicamenteux (via adaptateur SIH)      |
| POST    | `/api/claude`                      | Appel Groq non-streaming (alertes NLP)             |
| POST    | `/api/claude-stream`               | Appel Groq SSE streaming (Doctor AI)               |

### Adaptateur SIH

Le serveur supporte deux sources de donnees, configurables via `.env` sans modifier le code :

- `SIH_ADAPTER=local` (defaut) — donnees statiques `database.js`, aucune infrastructure requise
- `SIH_ADAPTER=fhir` — connecte un serveur HL7 FHIR R4 reel (Crossway, Dx Care, Easily, HAPI FHIR...)

Ressources FHIR consommees : `Patient`, `AllergyIntolerance`, `Medication`, `Observation` (vital-signs + survey), `ImagingStudy`.

## Authentification

- Les mots de passe sont haches server-side (scrypt + salt aleatoire) dans la table `staff_credentials`
- Le frontend ne contient aucun mot de passe — `DB_STAFF` dans `database.js` ne sert que de reference pour l'affichage
- Session persistee en `sessionStorage` (survit au rechargement, pas a la fermeture d'onglet)
- Deconnexion automatique apres 15 min d'inactivite

Compte de demo : `admin` / `admin`

## Tests

```bash
npm test                                       # watch mode
npm test -- --watchAll=false                   # run once
npm test -- --testPathPattern=ChatPanel        # un fichier
```

## Securite

- Disclaimer IA obligatoire : chaque reponse commence par "Analyse assistee par IA -- verification clinique recommandee"
- Anonymisation PHI : les prompts IA utilisent `H-{patient_id}` au lieu du nom patient
- Cle API Groq dans `.env`, jamais dans le code source
- Mots de passe haches (scrypt), jamais en clair dans le frontend
