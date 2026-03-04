# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend dev server (port 3000)
npm start

# Backend API server (port 3001) — run in a separate terminal
node server.js

# Production build
npm run build

# Run tests
npm test

# Run a single test file
npm test -- --testPathPattern=App.test
```

## Architecture

**SmartUX-AI** is a French-language hospital UI prototype (SILLAGE project, CRIStAL × Centrale Lille) with a React frontend and an Express/SQLite backend.

### Two servers must run concurrently

- `npm start` → React frontend on `http://localhost:3000` (Create React App)
- `node server.js` → Express API on `http://localhost:3001`

The frontend calls the backend at `http://localhost:3001/api/*`.

### Frontend (`src/SmartUX_AI_Bots.jsx`)

All UI logic lives in one large file (~1500 lines) organized as three tabs:

| Tab | Component | Purpose |
|-----|-----------|---------|
| `nlp` | `NLPBot` | Free-text French input → structured prescription via LLM (Groq) |
| `rx` | `RxTab` | View/manage prescriptions from SQLite |
| `bio` | `BioBot` | Simulated biometric/badge/password authentication |

**File layout within SmartUX_AI_Bots.jsx:**
1. Color palette constants
2. Hardcoded data: `DB_PATIENTS` (6), `DB_STAFF` (16), `DB_MEDICAMENTS` (45), `KNOWN_ALLERGIES`, `TYPO_CORRECTIONS`, `AUTOCOMPLETE_CORPUS`
3. Utility functions: `autoCorrect()`, `detectAllergyConflict()`, `mapNLPToPrescription()`, `parseDelay()`, `parseWithClaude()`
4. Shared UI atoms: `Badge`, `Btn`, `AutocompleteInput`
5. Main components: `SmartUXBots` (tab router), `NLPBot`, `RxTab`, `BioBot`

**Styling**: Inline styles only. Google Fonts (DM Sans + Space Mono). No CSS framework.

### Backend (`server.js`)

Express server exposing four endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/prescriptions` | Fetch all prescriptions |
| POST | `/api/prescriptions` | Create a prescription |
| PATCH | `/api/prescriptions/:id` | Update a prescription |
| POST | `/api/claude` | Proxy to Groq LLM API |

SQLite database (`sillage.db`) is created automatically on first run. The schema is defined inline in `server.js` (25-column `prescriptions` table).

### LLM Integration

The NLP tab sends French free-text to `POST /api/claude`, which proxies to the **Groq API** using model `llama-3.3-70b-versatile`. The response is parsed by `mapNLPToPrescription()` to fill prescription fields.

The Groq API key is currently hardcoded in `server.js` — move it to a `.env` file if extending this project.

## Key Constraints

- **No TypeScript** — plain JavaScript/JSX throughout
- **No state management library** — `useState`/`useRef`/`useCallback` only
- **No CSS modules or Tailwind** — all styles are inline objects
- **Biometric auth is simulated** — no real facial recognition; camera feed is decorative
- **Patient/staff/medication data is hardcoded** in the frontend (not fetched from the database)
