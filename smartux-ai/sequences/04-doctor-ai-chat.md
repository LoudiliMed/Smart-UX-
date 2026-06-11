# Sequence utilisateur -- Doctor AI (ChatPanel)

## Acteurs

- Utilisateur (personnel hospitalier)
- ChatPanel (drawer lateral droit, 380px)
- Serveur (`POST /api/claude-stream`)
- Groq API (SSE streaming, llama-3.3-70b)

## Resume

Assistant conversationnel IA contextuel. L'utilisateur pose des questions cliniques
en texte ou par dictee vocale. L'IA repond en streaming (mot par mot) avec le contexte
complet de tous les patients de la base.

---

## Sequence : Question texte avec reponse streaming

```
Utilisateur              ChatPanel               Serveur              Groq
    |                       |                       |                    |
    |-- clique "Doctor AI"  |                       |                    |
    |   dans le header ---->|                       |                    |
    |                       |-- ouvre drawer 380px  |                    |
    |                       |                       |                    |
    |-- tape une question   |                       |                    |
    |   "Quelles sont les   |                       |                    |
    |   allergies du        |                       |                    |
    |   patient H-1 ?" --->|                       |                    |
    |                       |                       |                    |
    |-- clique "Envoyer" -->|                       |                    |
    |                       |-- construit messages: |                    |
    |                       |   [system: prompt +   |                    |
    |                       |    context patients + |                    |
    |                       |    focus H-{id},      |                    |
    |                       |    ...historique,      |                    |
    |                       |    user: question]    |                    |
    |                       |                       |                    |
    |                       |-- POST                |                    |
    |                       |   /api/claude-stream->|                    |
    |                       |                       |-- stream: true --->|
    |                       |                       |                    |
    |                       |                       |<-- data: token1 --|
    |                       |<-- SSE: "Analyse" ----|                    |
    |<-- affiche "Analyse"  |                       |                    |
    |                       |                       |<-- data: token2 --|
    |                       |<-- SSE: " assistee" --|                    |
    |<-- affiche " assistee"|                       |                    |
    |                       |                       |                    |
    |   ... (token par      |                       |<-- data: tokenN --|
    |        token) ...     |<-- SSE: tokenN -------|                    |
    |                       |                       |                    |
    |                       |                       |<-- data: [DONE] --|
    |                       |<-- fin du stream -----|                    |
    |                       |                       |                    |
    |<-- reponse complete --|                       |                    |
    |   avec disclaimer     |                       |                    |
```

## Sequence : Question par dictee vocale

```
Utilisateur              ChatPanel
    |                       |
    |-- clique micro ------>|
    |   (entre input        |-- SpeechRecognition
    |    et "Envoyer")      |   lang: fr-FR
    |                       |   start()
    |                       |
    |-- parle :             |
    |   "Quel traitement    |
    |   pour H-3 ?" ------>|-- onresult: transcript
    |                       |   -> remplit le champ
    |                       |
    |                       |-- onend: arret auto
    |                       |
    |   (suite: envoi       |
    |    automatique ou     |
    |    clic "Envoyer")    |
```

## Contexte envoye a l'IA

```
ChatPanel                buildAllPatientsContext
    |                       |
    |-- appelle ----------->|
    |                       |-- pour chaque patient :
    |                       |   ## Patient H-{id}
    |                       |   - constantes (dernieres)
    |                       |   - allergies (KNOWN_ALLERGIES)
    |                       |   - note clinique recente
    |                       |   - imagerie (DB_IMAGERIE)
    |                       |   - prescriptions actives
    |                       |
    |<-- texte context -----|
    |                       |
    |-- ajoute focusLine :  |
    |   "Le personnel a     |
    |   selectionne H-{id}" |
    |   (ou "aucun patient  |
    |   selectionne")       |
```

## Sequence : Changement de patient selectionne

```
Utilisateur              ChatPanel
    |                       |
    |-- selectionne un      |
    |   autre patient ----->|
    |                       |-- efface l'historique
    |                       |   de conversation
    |                       |
    |                       |-- met a jour focusLine
    |                       |   avec nouveau H-{id}
    |                       |
    |<-- chat vide, pret ---|
    |   pour nouvelles      |
    |   questions           |
```

## Sequence : Erreur serveur

```
Utilisateur              ChatPanel               Serveur
    |                       |                       |
    |-- envoie question --->|                       |
    |                       |-- POST /api/claude -->|
    |                       |   stream              |
    |                       |                       |
    |                       |<-- [ERROR] message ---|
    |                       |   ou fetch echoue     |
    |                       |                       |
    |<-- bulle rouge :      |                       |
    |   "Impossible de      |                       |
    |   contacter le        |                       |
    |   serveur..." --------|                       |
```

## Regles de securite

- Anonymisation : les prompts utilisent `H-{patient_id}`, jamais le nom reel
- Regle 7 du system prompt : "Ne cite JAMAIS le nom d'un patient"
- Disclaimer auto-prepend si l'IA l'omet
- L'IA ne diagnostique pas -- elle propose des hypotheses
