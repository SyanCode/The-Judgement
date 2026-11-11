# ⚖️ The Judgement

Bot Discord de tribunal : le serveur juge, vote et condamne. Il gère aussi les **flops** (les fails) et les **masterclasses** (les coups d'éclat) de chaque membre.

## Commandes

### ⚖️ Tribunal
| Commande | Description |
|---|---|
| `/judge accuse motif [minutes]` | Ouvre un procès. Le serveur vote avec les boutons 🔨 Coupable / 😇 Innocent (1 à 60 min, 2 par défaut). |
| `/casier [utilisateur]` | Affiche le casier judiciaire : flops, masterclasses, procès, condamnations, acquittements. |
| `/sentence utilisateur` | Prononce une sentence aléatoire. |

**Règles d'un procès**
- Minimum **3 votes**, sinon l'affaire est classée sans suite.
- Plus de votes « coupable » : l'accusé reçoit **+1 flop** et une sentence aléatoire.
- Plus de votes « innocent » ou égalité : l'accusé est relaxé.
- L'accusé ne peut pas voter, et on ne peut pas juger un bot, soi-même, ni quelqu'un déjà en procès.

### 🏴 Flops
| Commande | Description |
|---|---|
| `/addflop utilisateur` | Ajoute un flop (voir permissions ci-dessous). |
| `/delflop utilisateur` | Retire un flop (voir permissions ci-dessous). |
| `/flops [utilisateur]` | Affiche les flops d'un utilisateur. |
| `/leaderflop` | Top 10 des flops. |

### 🎓 Masterclasses
| Commande | Description |
|---|---|
| `/addmasterclass utilisateur` | Ajoute une masterclass. |
| `/delmasterclass utilisateur` | Retire une masterclass. |
| `/masterclasses [utilisateur]` | Affiche les masterclasses d'un utilisateur. |
| `/masterboard` | Top 10 des masterclasses. |

### 👑 Administration
| Commande | Description |
|---|---|
| `/flopperms ajouter\|retirer\|liste` | **Owner uniquement.** Définit les rôles autorisés à utiliser `/addflop` et `/delflop`. |
| `/help` | Affiche la liste des commandes. |

**Qui peut utiliser `/addflop` et `/delflop` ?**
- le propriétaire du serveur ;
- les membres ayant la permission **Administrateur** ;
- les membres ayant un rôle ajouté via `/flopperms`.

## Installation

Prérequis : [Node.js](https://nodejs.org) 16.9 ou plus.

```bash
npm install
```

Crée un fichier `.env` à la racine :

```env
TOKEN=le_token_de_ton_bot
```

Puis lance le bot :

```bash
npm start
```

Les slash commands sont enregistrées automatiquement au démarrage.

## Données

Les données sont stockées dans des fichiers JSON à la racine du projet :

| Fichier | Contenu |
|---|---|
| `flops.json` | Nombre de flops par utilisateur |
| `masterclasses.json` | Nombre de masterclasses par utilisateur |
| `casier.json` | Statistiques de procès (créé automatiquement) |
| `config.json` | Rôles autorisés par serveur (créé automatiquement) |

> Les procès en cours sont gardés en mémoire : un redémarrage du bot les annule.
