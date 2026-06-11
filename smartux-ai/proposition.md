---
title: SmartUX-AI — Proposition d'évolution multi-établissement
date: 2026-03-08
tags:
  - project/smartux-ai
  - roadmap
  - product
project: "[[SmartUX-AI]]"
status: proposition
---

# SmartUX-AI — Proposition d'évolution multi-établissement

Ce document recense les améliorations nécessaires pour faire passer SmartUX-AI d'un prototype mono-hôpital à un produit déployable dans plusieurs établissements de santé. Chaque section identifie l'état actuel, le problème que cela pose à l'échelle, et les actions concrètes à mener.

---

## 1. Infrastructure & Architecture multi-établissement

### Etat actuel

- Serveur Express unique sur `localhost:3001`, base SQLite fichier unique (`sillage.db`)
- Toutes les données (patients, personnel, médicaments) sont des tableaux JS statiques dans `src/database.js`
- Aucune séparation entre établissements — un seul contexte global

### Problèmes à l'échelle

Un deuxième hôpital ne peut pas être branché sans dupliquer et modifier le code. Les données d'un établissement sont mélangées à celles d'un autre si le serveur est partagé.

### Actions

- **Multi-tenant par `hospital_id`** : ajouter une colonne `hospital_id` sur chaque table et filtrer toutes les requêtes par établissement connecté
- **Migrer SQLite vers PostgreSQL** : SQLite ne supporte pas la concurrence multi-utilisateurs ; PostgreSQL avec schémas séparés par établissement ou row-level security
- ~~**Variables d'environnement** : déplacer la clé Groq, le port, la chaîne de connexion DB dans un fichier `.env` — ne jamais hardcoder en clair dans `server.js`~~ **Fait** — `GROQ_API_KEY`, `PORT`, `DB_PATH` dans `.env`, validation au démarrage
- **Configuration par établissement** : fichier `hospital.config.json` par instance (nom, logo, services, formulaire médicamenteux local)

> [!done] Résolu
> La clé API Groq, le port et le chemin DB sont dans `.env` (fichier ignoré par git). `server.js` valide la présence de `GROQ_API_KEY` au démarrage et refuse de lancer le serveur si elle est absente. Un `.env.example` documente les variables attendues.

---

## 2. Authentification & Gestion des identités

### Etat actuel

- Mots de passe en clair dans le tableau `DB_STAFF` (`"sophie2024"`, `"admin"`)
- Biométrie simulée : la caméra s'ouvre mais aucune vraie reconnaissance faciale n'est effectuée
- Pas de session persistante — rechargement = déconnexion
- Pas de MFA

### Problèmes à l'échelle

Chaque hôpital a son propre annuaire (Active Directory, LDAP). Gérer les comptes manuellement dans le code est impossible à maintenir.

### Actions

- **Connexion LDAP / Active Directory** : authentifier les utilisateurs via l'annuaire existant de l'hôpital (bibliothèque `ldapjs`)
- **SSO via SAML 2.0 ou OpenID Connect** : intégration avec les fournisseurs d'identité hospitaliers (ex. Imprivata, Microsoft Entra ID)
- **JWT avec refresh token** : remplacer l'état React par des tokens signés, persistés en `httpOnly cookie`
- **MFA obligatoire** pour les niveaux d'accès 4-5 (médecins, chirurgiens)
- **Vraie biométrie** : intégration SDK lecteur d'empreinte ou reconnaissance faciale certifiée (Imprivata OneSign, Aware)
- **Gestion des sessions** : timeout automatique après inactivité (15 min), révocation centralisée

> [!important] Exigence réglementaire
> L'accès aux données de santé doit être traçable nominativement. Un mot de passe partagé ou hardcodé invalide toute conformité HDS et RGPD.

---

## 3. Base de données & Interopérabilité

### Etat actuel

- Patients, personnel, médicaments : tableaux JS statiques (6 patients, 16 personnels, 45 médicaments)
- Prescriptions seules persistent via SQLite
- Aucune connexion avec les systèmes hospitaliers existants (DPI, SIH, pharmacie, PACS)

### Problèmes à l'échelle

Chaque hôpital possède déjà un DPI (Dossier Patient Informatisé) — Crossway, Dx Care, Easily, etc. Dupliquer les données patient dans SmartUX est inutile et risqué (désynchronisation, erreur).

### Actions

- ~~**Connecteur HL7 FHIR R4**~~ **Fait** — `FhirAdapter` consomme `Patient`, `AllergyIntolerance`, `Medication`, `Observation` (vital-signs + survey), `ImagingStudy` depuis n'importe quel serveur FHIR R4
- ~~**Adaptateur SIH**~~ **Fait** — couche d'abstraction `server/adapters/` avec interface commune ; sélection via `SIH_ADAPTER=local|fhir` dans `.env` sans modifier le code applicatif
- **Intégration pharmacie** : connecter la liste des médicaments disponibles au formulaire local de l'établissement (Dispen-Sys, Pharma) — hors scope Phase 2
- **Lecture PACS** : afficher les images DICOM depuis le PACS existant (Orthanc, Synapse) plutôt que des données fictives — hors scope Phase 2
- **Synchronisation temps réel** : WebSocket ou polling sur les constantes vitales depuis les moniteurs (via HL7 v2 ou FHIR) — hors scope Phase 2

> [!done] Résolu — Adaptateur SIH
> `server/adapters/local-adapter.js` + `server/adapters/fhir-adapter.js` + fabrique `server/adapters/index.js`. Nouvelles routes API : `GET /api/patients`, `GET /api/patients/:id`, `GET /api/patients/:id/observations|constantes|imagerie`, `GET /api/medicaments`. Bascule entre sources de données sans modifier le code applicatif.

> [!note] Standard de référence
> HL7 FHIR R4 est le standard imposé par la feuille de route numérique en santé (SÉGUR du numérique). Tout nouveau logiciel connecté à un SIH certifié doit exposer ou consommer du FHIR.

---

## 4. Sécurité & Conformité RGPD

### Etat actuel

- HTTP en clair (pas de HTTPS)
- Aucun audit trail des actions utilisateur ou des recommandations IA
- Noms de patients remplacés par `H-{id}` dans les prompts IA (bonne pratique déjà en place)
- DPA (Data Processing Agreement) avec l'hôpital non encore signé
- Aucun chiffrement des données au repos

### Problèmes à l'échelle

Toute transmission de données de santé en HTTP clair est illégale. L'absence d'audit trail rend impossible la réponse à un incident ou un contrôle CNIL.

### Actions

- **HTTPS obligatoire** : certificat TLS (Let's Encrypt ou certificat interne PKI hospitalière) sur tous les endpoints
- **Audit trail complet** : table `audit_log(id, hospital_id, user_id, action, resource_type, resource_id, ai_recommendation, timestamp, ip)` — chaque action clinique et chaque recommandation IA loguée
- **Chiffrement au repos** : PostgreSQL avec chiffrement des colonnes sensibles (`pgcrypto`) ou chiffrement disque
- **Gestion des clés API** : HashiCorp Vault ou AWS Secrets Manager — plus jamais de clé en clair dans le code
- **DPA par établissement** : contrat de traitement des données à faire signer par chaque hôpital avant déploiement
- **Droit à l'effacement** : procédure d'anonymisation ou suppression sur demande RGPD
- **Politique de rétention** : configurable par établissement (ex. 10 ans pour données médicales selon loi française)

> [!warning] Obligation légale
> L'hébergement de données de santé en France requiert un hébergeur certifié HDS (Hébergeur de Données de Santé). Un serveur local non certifié ou un cloud non qualifié est hors-la-loi.

---

## 5. Circuit du médicament complet

### Etat actuel

- Prescription créée par NLP → sauvegardée en SQLite avec `is_validated = false`
- Aucun workflow de validation pharmacien
- Aucune signature électronique du médecin
- Pas d'intégration avec la préparation ou la dispensation

### Problèmes à l'échelle

Une prescription non validée et non signée n'a aucune valeur légale. Le circuit du médicament est une exigence réglementaire en milieu hospitalier (HAS, COMEDIMS).

### Actions

- **Signature électronique médecin** : intégration d'un certificat de signature (CPS — Carte de Professionnel de Santé) via `@openpgp/openpgp` ou API API-CPS de l'ANS
- **Workflow de validation pharmacien** : état `PRESCRIT → EN_VALIDATION_PHARMACIEN → VALIDEE → DISPENSEE → ADMINISTREE`
- **Notifications en temps réel** : WebSocket vers la pharmacie quand une prescription arrive en validation
- **Alertes d'interaction en temps réel** : interrogation de la base Thériaque ou Vidal (API officielle) pour remplacer les alertes IA seules
- **Traçabilité d'administration** : infirmier confirme l'acte d'administration avec horodatage et identifiant
- **Gestion des annulations** : workflow d'annulation avec motif obligatoire et notification au prescripteur

---

## 6. IA & NLP

### Etat actuel

- API Groq externe (`api.groq.com`) avec modèle `llama-3.3-70b-versatile`
- Clé API unique hardcodée — toutes les requêtes passent par Groq
- Les données patient sont envoyées à un service cloud externe
- Pas de fine-tuning sur la terminologie médicale française
- Confiance NLP estimée grossièrement par le nombre de champs extraits

### Problèmes à l'échelle

Envoyer des données de santé (même tokenisées `H-{id}`) vers un service cloud externe pose un problème RGPD tant qu'un DPA avec Groq/Meta n'est pas signé et que l'hébergement ne reste pas en zone HDS.

### Actions

- **Modèle local ou cloud souverain** : déployer un LLM on-premise (Ollama + Mistral 7B instruct ou Meditron) ou utiliser un fournisseur certifié HDS (OVHcloud AI, Scaleway)
- **Fine-tuning NLP médical français** : entraîner sur un corpus d'ordonnances et de comptes-rendus hospitaliers anonymisés pour améliorer l'extraction (patient, médicament, dose, voie, fréquence)
- **Score de confiance réel** : calculer un score basé sur les champs extraits vs. attendus, avec seuil d'alerte si confiance < 60%
- **Fallback dégradé** : si l'API IA est indisponible, proposer un formulaire manuel structuré plutôt qu'un échec silencieux
- **Cache des requêtes NLP** : éviter de rappeler l'API pour des phrases identiques (Redis TTL 1h)
- **Modèle d'alerte spécialisé** : remplacer le LLM généraliste pour les alertes par une base de règles structurée (Thériaque, Vidal) + LLM uniquement pour le texte explicatif

> [!important] Confidentialité des données IA
> Même avec tokenisation `H-{id}`, les constantes vitales, allergies et traitements transmis au prompt constituent des données de santé. Un accord de traitement conforme RGPD avec le fournisseur IA est obligatoire.

---

## 7. Réglementaire & Certification

### Etat actuel

- Prototype de recherche (CRIStAL x Centrale Lille) — pas de certification
- Disclaimer IA affiché ("Analyse assistée par IA — vérification clinique recommandée")
- Aucun marquage CE, aucune classification DM logiciel

### Ce qui est requis pour un déploiement clinique réel

- **Hébergement HDS** : certification obligatoire pour tout hébergeur de données de santé en France (référentiel ANS)
- **Marquage CE dispositif médical logiciel** : si SmartUX-AI aide à la décision thérapeutique, il tombe sous le règlement MDR 2017/745 — audit de classification (classe IIa probable pour aide à la prescription)
- **NF EN 82304-1** : norme sur la sécurité des logiciels de santé — couvre la gestion des risques, la traçabilité des exigences, les tests de validation
- **Référentiel HAS** : la HAS publie des recommandations sur les logiciels d'aide à la prescription (LAP) — obtenir le label LAP si applicable
- **Gestion des risques ISO 14971** : analyse des risques liés aux recommandations IA (faux négatifs d'alerte, mauvaise extraction NLP)
- **Validation clinique** : étude pilote avec des professionnels de santé, mesure des écarts entre recommandation IA et décision clinique réelle

> [!danger] Risque légal
> Déployer un logiciel d'aide à la prescription sans marquage CE dans un établissement de soins expose l'éditeur à une responsabilité civile et pénale en cas d'incident.

---

## 8. UX & Accessibilité

### Etat actuel

- Interface desktop uniquement (styles inline non responsive)
- Dictée vocale via `SpeechRecognition` navigateur (Chrome uniquement, non certifié médical)
- Langue unique (français)
- Pas de mode hors-ligne
- Taille de texte et densité configurables (persistées localStorage)

### Actions

- **Responsive tablette** : l'interface doit fonctionner sur tablette (usage courant en visite de salle) — refactoring des styles inline vers un système de grid adaptatif
- **Dictée vocale certifiée** : intégrer un SDK de reconnaissance vocale médicale (Nuance DAX, SpeechMatics avec modèle médical français) pour remplacer l'API navigateur
- **Mode hors-ligne** : Service Worker + IndexedDB pour continuer à saisir des prescriptions sans réseau, avec synchronisation à la reconnexion
- **Support multilingue** : i18n (react-intl) pour les établissements frontaliers ou à personnel international — a minima FR + EN
- **Accessibilité RGAA** : conformité RGAA 4.1 (équivalent WCAG 2.1 AA) — navigation clavier, contrastes, lecteurs d'écran — obligatoire pour les outils publics hospitaliers
- **Raccourcis clavier cliniques** : navigation rapide entre onglets, soumission formulaire, validation alerte sans souris

---

## 9. Refactoring technique

### Etat actuel

- Tout le frontend dans un seul fichier `SmartUX_AI_Bots.jsx` (~1700 lignes)
- JavaScript uniquement, pas de TypeScript
- Styles inline exclusivement
- Tests unitaires `@testing-library/react` sur `ChatPanel` uniquement
- Pas de CI/CD, pas de tests E2E

### Actions

- **TypeScript** : typer les entités métier (`Patient`, `Prescription`, `Staff`, `Alert`) pour éviter les erreurs silencieuses à l'exécution
- **Découpage en composants** : séparer `NLPBot`, `ChatPanel`, `AlertSystem`, `DossierPanel`, etc. en fichiers distincts sous `src/components/`
- **Système de design** : extraire la palette de couleurs et les atomes UI (`Btn`, `Badge`) dans `src/design-system/`
- **Tests E2E** : Playwright ou Cypress couvrant les parcours critiques (saisie NLP → prescription → validation pharmacien)
- **CI/CD** : pipeline GitHub Actions (lint + tests + build) sur chaque PR
- **Storybook** : documenter les composants UI pour faciliter l'intégration par d'autres établissements

---

## 10. Priorisation

Le tableau ci-dessous classe chaque initiative par impact clinique et effort d'implémentation estimé.

| Initiative                        | Impact clinique | Effort     | Priorité           |
| --------------------------------- | --------------- | ---------- | ------------------ |
| Variables d'environnement (.env)  | Moyen           | Faible     | ~~Immediate~~ Fait |
| HTTPS                             | Critique        | Faible     | Immediate          |
| Authentification LDAP/SSO         | Critique        | Moyen      | Phase 1            |
| PostgreSQL multi-tenant           | Critique        | Moyen      | Phase 1            |
| Audit trail                       | Critique        | Moyen      | Phase 1            |
| DPA & conformité RGPD             | Critique        | Faible     | Phase 1            |
| Workflow validation pharmacien    | Critique        | Elevé      | Phase 2            |
| Signature électronique CPS        | Critique        | Elevé      | Phase 2            |
| Connecteur HL7 FHIR R4            | Elevé           | Elevé      | ~~Phase 2~~ Fait   |
| Modèle IA local / cloud souverain | Elevé           | Elevé      | Phase 2            |
| Alertes Thériaque / Vidal         | Elevé           | Moyen      | Phase 2            |
| Responsive tablette               | Moyen           | Moyen      | Phase 3            |
| TypeScript + découpage composants | Moyen           | Elevé      | Phase 3            |
| Dictée vocale                     | faible          | faible     | Phase 3            |
| Marquage CE MDR                   | Critique        | Très élevé | Phase 4            |
| Certification HDS                 | Critique        | Très élevé | Phase 4            |
| Fine-tuning NLP médical           | Moyen           | Très élevé | Phase 4            |
| Mode hors-ligne                   | Faible          | Elevé      | Phase 4            |
| Tests E2E + CI/CD                 | Moyen           | Moyen      | Continu            |

> [!note] Lecture du tableau
> "Immediate" = bloquant avant tout déploiement même interne. "Phase 1" = requis avant tout pilote en établissement. "Phase 2" = requis avant mise en production clinique. "Phase 3-4" = requis pour commercialisation ou déploiement national.

---

## Synthèse

> [!abstract] Ce qui bloque un déploiement aujourd'hui
> Trois points sont bloquants avant tout déploiement, même dans un cadre pilote interne :
> 1. **Sécurité** : HTTP en clair + clé API hardcodée + mots de passe en clair
> 2. **Authentification** : mots de passe hardcodés incompatibles avec tout annuaire hospitalier
> 3. **Hébergement** : données de santé envoyées à Groq sans DPA — illégal sans accord explicite

Le prototype démontre la valeur du concept (NLP médical, alertes IA, chatbot clinique contextuel). Le chemin vers un produit déployable en établissement nécessite principalement des investissements en sécurité, conformité et interopérabilité — la logique métier et l'UX étant déjà solides.
