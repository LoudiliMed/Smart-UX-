# Sequence utilisateur -- Panels de consultation

## Acteurs

- Utilisateur (personnel hospitalier)
- DossierPanel, ObservationsPanel, ImageriePanel, ParametresPanel
- Donnees statiques (`database.js`)

## Resume

Quatre onglets en lecture seule (sauf Parametres) affichant les donnees cliniques
du patient selectionne. Pas d'appel serveur -- toutes les donnees viennent de
`database.js` (tableaux statiques).

---

## 1. DossierPanel (Dossier patient)

### Navigation

```
Utilisateur              Header                  DossierPanel
    |                       |                       |
    |-- clique onglet       |                       |
    |   "Dossier" --------->|                       |
    |                       |-- activeSubTab =      |
    |                       |   "dossier" --------->|
    |                       |                       |
    |<-- affiche accordeons |                       |
    |   par patient --------|<----------------------|
```

### Contenu affiche par patient

```
+-------------------------------------------+
| [v] Jean Dupont (H-1)                     |
|     Chambre: 301 | Groupe: A+             |
|     Ne le: 15/03/1955                     |
|     Allergies: Penicilline                |
|     Prescriptions actives: 3             |
+-------------------------------------------+
| [>] Marie Lambert (H-2)                  |
|     (cliquer pour derouler)               |
+-------------------------------------------+
```

Source : `DB_PATIENTS` + `KNOWN_ALLERGIES` + `prescriptions` (props)

---

## 2. ObservationsPanel (Observations cliniques)

### Navigation

```
Utilisateur              Header                  ObservationsPanel
    |                       |                       |
    |-- clique onglet       |                       |
    |   "Observations" ---->|                       |
    |                       |-- activeSubTab =      |
    |                       |   "observations" ---->|
    |                       |                       |
    |-- selectionne un      |                       |
    |   patient ----------->|                       |
    |                       |                       |
    |<-- affiche notes      |                       |
    |   + constantes -------|<----------------------|
```

### Contenu affiche

```
Notes cliniques (filtrees par categorie) :
+-------------------------------------------+
| [Entree] Admission pour douleur thoracique|
|          Dr Martin - 06/03/2026           |
+-------------------------------------------+
| [Evolution] Amelioration sous traitement  |
|             Dr Dubois - 07/03/2026        |
+-------------------------------------------+

Constantes vitales (tableau) :
+--------+------+--------+-----+-----+-----+
| Date   | Temp | TA     | FC  | FR  | SpO2|
+--------+------+--------+-----+-----+-----+
| 07/03  | 37.2 | 130/85 | 78  | 16  | 98% |
| 06/03  | 38.1 | 140/90 | 92  | 20  | 96% |
+--------+------+--------+-----+-----+-----+
```

Source : `DB_OBSERVATIONS` + `DB_CONSTANTES`

---

## 3. ImageriePanel (Imagerie medicale)

### Navigation

```
Utilisateur              Header                  ImageriePanel
    |                       |                       |
    |-- clique onglet       |                       |
    |   "Imagerie" -------->|                       |
    |                       |-- activeSubTab =      |
    |                       |   "imagerie" -------->|
    |                       |                       |
    |-- selectionne un      |                       |
    |   patient ----------->|                       |
    |                       |                       |
    |<-- affiche grille     |                       |
    |   d'examens -----------|<--------------------|
```

### Contenu affiche

```
Filtres : [Tous] [En attente] [Disponible] [Realise]

+-------------------+-------------------+
| Radio thorax      | Scanner cerebral  |
| Statut: Disponible| Statut: En attente|
| 06/03/2026        | 07/03/2026        |
| Dr Petit          | Dr Petit          |
+-------------------+-------------------+
```

Source : `DB_IMAGERIE`

---

## 4. ParametresPanel (Preferences)

### Navigation et interaction

```
Utilisateur              Header                  ParametresPanel
    |                       |                       |
    |-- clique onglet       |                       |
    |   "Parametres" ------>|                       |
    |                       |-- activeSubTab =      |
    |                       |   "parametres" ------>|
    |                       |                       |
    |<-- affiche profil     |                       |
    |   + preferences ------|<----------------------|
```

### Sequence : Modification des preferences

```
Utilisateur              ParametresPanel          SmartUXBots
    |                       |                       |
    |-- clique taille       |                       |
    |   "L" (large) ------->|                       |
    |                       |-- onFontSizeChange -->|
    |                       |                       |-- fontSize = 18px
    |                       |                       |-- document.body
    |                       |                       |   .style.fontSize
    |                       |                       |-- localStorage
    |                       |                       |   .setItem(...)
    |<-- texte agrandi -----|<----------------------|
    |                       |                       |
    |-- clique densite      |                       |
    |   "Compact" --------->|                       |
    |                       |-- onDensityChange --->|
    |                       |                       |-- density = compact
    |                       |                       |-- padding reduit
    |                       |                       |-- localStorage
    |                       |                       |   .setItem(...)
    |<-- interface compacte-|<----------------------|
```

### Contenu affiche

```
Profil utilisateur :
+-------------------------------------------+
| Dr Sophie Martin                          |
| Role: Medecin | Niveau: 4                 |
| Service: Cardiologie                      |
| Permissions: lecture dossier, prescription,|
|   validation, administration medicaments  |
+-------------------------------------------+

Preferences d'affichage :
+-------------------------------------------+
| Taille du texte :  [S]  [M]  [L]         |
| Densite :   [Compact]  [Normal]           |
| (sauvegardees automatiquement)            |
+-------------------------------------------+
```

Source : `sessionStorage.sillage_user` + `localStorage` + `ACCESS_PERMISSIONS`
