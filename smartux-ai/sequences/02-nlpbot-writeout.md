# Sequence utilisateur -- NLPBot (Write out)

## Acteurs

- Utilisateur (medecin / prescripteur)
- NLPBot (composant Write out)
- AlertSystem (verification securite -- voir 03-alertsystem.md)
- Serveur (`POST /api/claude`, `POST /api/prescriptions`)
- Groq API (LLM llama-3.3-70b)

## Resume

L'utilisateur dicte ou tape une phrase medicale en langage naturel.
Le systeme extrait les champs structures (patient, medicament, dose, voie, frequence),
pose 3 questions de confirmation, verifie la securite, puis enregistre la prescription.

---

## Sequence : Saisie NLP complete

### Phase 1 -- Extraction NLP

```
Utilisateur              NLPBot                  Serveur              Groq
    |                       |                       |                    |
    |-- tape ou dicte       |                       |                    |
    |   "Prescrire 500mg    |                       |                    |
    |   Doliprane per os    |                       |                    |
    |   toutes les 6h       |                       |                    |
    |   pour Dupont" ------>|                       |                    |
    |                       |                       |                    |
    |-- clique "Analyser"-->|                       |                    |
    |                       |-- POST /api/claude -->|                    |
    |                       |   system: prompt NLP  |-- chat/completions |
    |                       |   user: phrase brute  |   llama-3.3-70b -->|
    |                       |                       |<-- JSON structure -|
    |                       |<-- {content} ---------|                    |
    |                       |                       |                    |
    |<-- affiche extraction |                       |                    |
    |   patient: Dupont     |                       |                    |
    |   medicament: Dolip.  |                       |                    |
    |   dose: 500mg         |                       |                    |
    |   voie: per os        |                       |                    |
    |   frequence: /6h      |                       |                    |
    |   confiance: 85%      |                       |                    |
```

### Phase 2 -- Dialogue interactif (3 questions)

```
Utilisateur              NLPBot
    |                       |
    |<-- "Quel est le       |
    |   delai imparti ?" ---|
    |                       |
    |-- "2h" -------------->|
    |                       |-- parseDelay("2h")
    |                       |   -> valide
    |                       |
    |<-- "Combien de fois   |
    |   par jour ?" --------|
    |                       |
    |-- "3" --------------->|
    |                       |-- parsePositiveInt("3")
    |                       |   -> valide
    |                       |
    |<-- "Pour combien de   |
    |   jours ?" -----------|
    |                       |
    |-- "7" --------------->|
    |                       |-- parseNbJours("7")
    |                       |   -> valide
    |                       |
    |<-- confirmation :     |
    |   "Delai: 2h          |
    |    3x/jour            |
    |    7 jours" ----------|
```

### Phase 3 -- Alertes (en parallele)

```
(Voir 03-alertsystem.md pour la sequence complete)

NLPBot detecte un medicament + un patient selectionne
  -> AlertSystem se declenche automatiquement (debounce 1.2s)
  -> Banniere(s) d'alerte affichee(s) sous l'extraction
```

### Phase 4 -- Enregistrement

```
Utilisateur              NLPBot                  Serveur              SQLite
    |                       |                       |                    |
    |-- clique              |                       |                    |
    |   "Enregistrer dans   |                       |                    |
    |   SILLAGE" ---------->|                       |                    |
    |                       |-- POST                |                    |
    |                       |   /api/prescriptions->|                    |
    |                       |   {patient_id,        |-- INSERT INTO     |
    |                       |    drug_name_free,    |   prescriptions -->|
    |                       |    dosage, route,     |                    |
    |                       |    frequency,         |<-- OK ------------|
    |                       |    nlp_raw_text,      |                    |
    |                       |    nlp_extracted_json, |                    |
    |                       |    is_validated:0}    |                    |
    |                       |<-- {success:true} ----|                    |
    |                       |                       |                    |
    |<-- "Prescription      |                       |                    |
    |   enregistree"        |                       |                    |
    |                       |                       |                    |
    |   (visible dans       |                       |                    |
    |    onglet Actes)      |                       |                    |
```

## Sequence : Dictee vocale

```
Utilisateur              NLPBot
    |                       |
    |-- clique micro ------>|
    |                       |-- SpeechRecognition
    |                       |   lang: fr-FR
    |                       |   start()
    |                       |
    |-- parle ------------->|
    |   "Prescrire..."      |-- onresult: transcript
    |                       |   -> remplit le champ texte
    |                       |
    |                       |-- onend: stop automatique
    |                       |
    |   (suite: Phase 1     |
    |    comme ci-dessus)   |
```

## Sequence : Export PDF

```
Utilisateur              NLPBot
    |                       |
    |-- clique              |
    |   "Exporter PDF" ---->|
    |                       |-- exportPDF(prescription)
    |                       |   -> genere et telecharge
    |                       |   un fichier PDF
    |<-- telechargement ----|
```
