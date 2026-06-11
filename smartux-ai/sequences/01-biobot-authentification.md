# Sequence utilisateur -- BioBot (Authentification)

## Acteurs

- Utilisateur (personnel hospitalier)
- BioBot (ecran de connexion)
- Serveur (`POST /api/auth`)
- SQLite (`staff_credentials`)

## Methodes d'authentification

BioBot propose trois methodes : Biometrie, Badge RFID, Mot de passe.
Seule la methode Mot de passe est fonctionnelle. Les deux autres sont simulees.

---

## Sequence : Connexion par mot de passe

```
Utilisateur              BioBot                  Serveur              SQLite
    |                       |                       |                    |
    |-- selectionne         |                       |                    |
    |   "Mot de passe" ---->|                       |                    |
    |                       |                       |                    |
    |-- saisit login ------>|                       |                    |
    |   (nom, prenom        |                       |                    |
    |    ou matricule)      |                       |                    |
    |                       |                       |                    |
    |-- saisit mot -------->|                       |                    |
    |   de passe            |                       |                    |
    |                       |                       |                    |
    |-- clique "Connexion"->|                       |                    |
    |                       |-- POST /api/auth ---->|                    |
    |                       |   {login, password}   |                    |
    |                       |                       |-- SELECT           |
    |                       |                       |   password_hash -->|
    |                       |                       |   WHERE staff_id   |
    |                       |                       |<-- hash -----------|
    |                       |                       |                    |
    |                       |                       |-- scrypt.verify    |
    |                       |                       |   (password, hash) |
    |                       |                       |                    |
    |                       |<-- {user: staff} -----|                    |
    |                       |                       |                    |
    |                       |-- sessionStorage      |                    |
    |                       |   .setItem(user)      |                    |
    |                       |                       |                    |
    |                       |-- demarre timer       |                    |
    |                       |   inactivite 15 min   |                    |
    |                       |                       |                    |
    |<-- affiche interface -|                       |                    |
    |   principale          |                       |                    |
```

## Sequence : Echec de connexion

```
Utilisateur              BioBot                  Serveur
    |                       |                       |
    |-- saisit identifiants |                       |
    |   incorrects -------->|                       |
    |                       |-- POST /api/auth ---->|
    |                       |                       |
    |                       |<-- 401 {error} -------|
    |                       |                       |
    |<-- affiche message ---|                       |
    |   "Identifiant        |                       |
    |    inconnu." ou       |                       |
    |   "Mot de passe       |                       |
    |    incorrect."        |                       |
```

## Sequence : Deconnexion automatique (inactivite)

```
Utilisateur              SmartUXBots
    |                       |
    |   (aucune activite    |
    |    pendant 15 min)    |
    |                       |
    |                       |-- clearTimeout
    |                       |-- sessionStorage
    |                       |   .removeItem(user)
    |                       |-- setAuthenticatedUser(null)
    |                       |
    |<-- retour ecran ------|
    |   de connexion        |
```

## Sequence : Rechargement de page

```
Utilisateur              SmartUXBots
    |                       |
    |-- recharge la page -->|
    |                       |
    |                       |-- sessionStorage
    |                       |   .getItem("sillage_user")
    |                       |
    |                       |-- si present :
    |                       |   JSON.parse -> user
    |                       |   -> interface principale
    |                       |
    |                       |-- si absent :
    |                       |   -> ecran de connexion
```

## Compte de demo

Login : `admin` | Mot de passe : `admin`
