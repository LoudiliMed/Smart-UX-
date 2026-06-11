# Sequence utilisateur -- RxTab (Actes & Ordres)

## Acteurs

- Utilisateur (medecin, pharmacien, infirmier)
- RxTab (composant Kanban)
- Serveur (`GET /api/prescriptions`, `PATCH /api/prescriptions/:id`)
- SQLite (`prescriptions`)

## Resume

Tableau Kanban affichant toutes les prescriptions, triees par urgence et delai.
L'utilisateur peut valider, annuler ou exporter chaque prescription.

---

## Sections du Kanban

```
+---------------------------+
| Expirent < 30 min (orange)|  <- prescriptions dont le delai expire bientot
+---------------------------+
| Taches urgentes (rouge)   |  <- priorite URGENTE ou STAT
+---------------------------+
| Taches a faire (ambre)    |  <- priorite normale, en attente
+---------------------------+
| Historique                 |
|  - Delai depasse (rouge)  |  <- validees apres expiration
|  - Dans les delais (vert) |  <- validees a temps
|  - Annulees (gris)        |
+---------------------------+
```

## Sequence : Chargement initial

```
SmartUXBots              Serveur              SQLite
    |                       |                    |
    |-- GET                 |                    |
    |   /api/prescriptions->|                    |
    |                       |-- SELECT * FROM    |
    |                       |   prescriptions -->|
    |                       |<-- rows -----------|
    |<-- [{rx1}, {rx2}...] -|                    |
    |                       |                    |
    |-- setState            |                    |
    |   (prescriptions)     |                    |
    |                       |                    |
    |-- passe au RxTab      |                    |
    |   via props           |                    |
```

## Sequence : Validation d'une prescription

```
Utilisateur              RxTab                   Serveur              SQLite
    |                       |                       |                    |
    |-- clique "Valider"    |                       |                    |
    |   sur une carte ----->|                       |                    |
    |                       |-- PATCH               |                    |
    |                       |   /api/prescriptions  |                    |
    |                       |   /{id} ------------>|                    |
    |                       |   {is_validated:true, |-- UPDATE           |
    |                       |    validated_at:now}  |   prescriptions -->|
    |                       |                       |<-- OK ------------|
    |                       |<-- {success:true} ----|                    |
    |                       |                       |                    |
    |<-- carte se deplace   |                       |                    |
    |   vers "Historique    |                       |                    |
    |   -> Dans les delais" |                       |                    |
    |   (ou "Delai depasse" |                       |                    |
    |    si hors delai)     |                       |                    |
```

## Sequence : Annulation d'une prescription

```
Utilisateur              RxTab                   Serveur              SQLite
    |                       |                       |                    |
    |-- clique "Annuler"    |                       |                    |
    |   sur une carte ----->|                       |                    |
    |                       |-- PATCH               |                    |
    |                       |   /api/prescriptions  |                    |
    |                       |   /{id} ------------>|                    |
    |                       |   {is_cancelled:true} |-- UPDATE           |
    |                       |                       |   prescriptions -->|
    |                       |                       |<-- OK ------------|
    |                       |<-- {success:true} ----|                    |
    |                       |                       |                    |
    |<-- carte se deplace   |                       |                    |
    |   vers "Historique    |                       |                    |
    |   -> Annulees"        |                       |                    |
```

## Sequence : Export PDF

```
Utilisateur              RxTab
    |                       |
    |-- clique              |
    |   "Exporter PDF" ---->|
    |   sur une carte       |-- exportPDF(prescription)
    |                       |   -> genere le document
    |<-- telechargement ----|
```

## Informations affichees par carte

```
+-------------------------------------------+
| [URGENTE]  Doliprane 500mg                |
| Voie: per os | Frequence: /6h             |
| Patient: Jean Dupont | Chambre: 301       |
| Delai restant: 1h23                       |
| [!] Allergie signalee: Penicilline        |
|                                           |
|        [Valider]  [Annuler]  [PDF]        |
+-------------------------------------------+
```

## Badge de notification

L'onglet "Actes & Ordres" affiche un badge dans le header :
- Nombre de prescriptions urgentes (URGENTE/STAT) non validees
- Nombre total de prescriptions en attente
