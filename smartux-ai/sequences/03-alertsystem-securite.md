# Sequence utilisateur -- AlertSystem (Alertes de securite)

## Acteurs

- AlertSystem (composant integre dans NLPBot)
- Serveur (`POST /api/claude`)
- Groq API (LLM llama-3.3-70b)

## Resume

Le systeme d'alertes se declenche automatiquement quand l'utilisateur saisit
un medicament pour un patient selectionne. Il interroge l'IA avec le dossier
complet du patient pour detecter les interactions, allergies et contre-indications.

---

## Sequence : Declenchement et affichage des alertes

```
Utilisateur              NLPBot          AlertSystem              Serveur         Groq
    |                       |                  |                      |              |
    |-- selectionne         |                  |                      |              |
    |   un patient -------->|                  |                      |              |
    |                       |                  |                      |              |
    |-- tape un nom de      |                  |                      |              |
    |   medicament -------->|                  |                      |              |
    |                       |-- currentDraft   |                      |              |
    |                       |   change ------->|                      |              |
    |                       |                  |                      |              |
    |                       |                  |-- debounce 1.2s      |              |
    |                       |                  |   (evite appels      |              |
    |                       |                  |    pendant la saisie)|              |
    |                       |                  |                      |              |
    |                       |                  |-- buildDossierContext |              |
    |                       |                  |   (patient,          |              |
    |                       |                  |    prescriptions)    |              |
    |                       |                  |                      |              |
    |                       |                  |-- POST /api/claude ->|              |
    |                       |                  |   system: prompt     |-- completions|
    |                       |                  |     ALERT            |   llama-3.3->|
    |                       |                  |   user: dossier +    |              |
    |                       |                  |     medicament       |<-- reponse --|
    |                       |                  |<-- {content} --------|              |
    |                       |                  |                      |              |
    |                       |                  |-- parseAlertResponse |              |
    |                       |                  |   extrait lignes:    |              |
    |                       |                  |   **CRITIQUE|...**   |              |
    |                       |                  |                      |              |
    |<-- affiche bannieres -|<-----------------|                      |              |
    |   d'alerte            |                  |                      |              |
```

## Niveaux de severite

```
 CRITIQUE (rouge)
 +----------------------------------------------------+
 | Contre-indication absolue / allergie connue         |
 | Bouton obligatoire : "J'ai pris connaissance"       |
 | Non dismissible sans acquittement                   |
 +----------------------------------------------------+

 MODERE (ambre)
 | Interaction moderee / precaution d'emploi           |  [x]
 | Dismissible via bouton x                            |
 +----------------------------------------------------+

 FAIBLE (gris)
 | Information, pas de risque immediat                  |  [x]
 | Dismissible via bouton x                            |
 +----------------------------------------------------+

 Bandeau disclaimer (toujours present) :
 "Analyse assistee par IA -- verification clinique recommandee"
```

## Sequence : Gestion de concurrence (requestIdRef)

```
Utilisateur              AlertSystem
    |                       |
    |-- tape "Dolip" ------>|-- requestId = 1
    |                       |   debounce 1.2s...
    |                       |
    |-- tape "Doliprane" -->|-- requestId = 2
    |   (avant fin debounce)|   annule debounce 1
    |                       |   debounce 1.2s...
    |                       |
    |                       |-- envoie requete (id=2)
    |                       |
    |                       |-- reponse arrive (id=2)
    |                       |   requestIdRef === 2
    |                       |   -> affiche les alertes
    |                       |
    |   (si reponse id=1    |
    |    arrivait en retard |
    |    -> ignoree car     |
    |    requestIdRef != 1) |
```

## Sequence : Changement de patient

```
Utilisateur              AlertSystem
    |                       |
    |-- change le patient   |
    |   selectionne ------->|
    |                       |-- efface les alertes
    |                       |   precedentes
    |                       |
    |                       |-- si medicament present :
    |                       |   relance la verification
    |                       |   avec le nouveau dossier
```
