# Red Packet Monitor 🚀

Red Packet Monitor est un robot d'automatisation complet (Dashboard + Moteur d'exécution) conçu pour **scraper automatiquement les codes Binance Red Packet sur Twitter** (via Nitter) et les **réclamer en temps réel** directement sur votre compte Binance grâce à Playwright.

Le projet a été pensé pour la stabilité absolue : fonctionnement sans API payantes (Twitter ou Binance), système d'auto-guérison du navigateur en cas de crash, et interface premium pour tout surveiller depuis votre navigateur.

---

## 🌟 Fonctionnalités Principales

- **Scraping 100% Gratuit** : Utilisation d'instances Nitter publiques pour surveiller les flux Twitter sans clé d'API et sans limites de requêtes.
- **Claim Automatique (Playwright)** : Utilise votre session locale Google Chrome existante pour réclamer les codes sur Binance. Aucun besoin de fournir de clés d'API risquées, le bot navigue comme un humain.
- **Déduplication Atomique** : Le scraper est protégé contre le traitement de doublons. Un code traité n'est jamais retenté.
- **Interface Premium (Command Center)** : Dashboard immersif et moderne, statistiques en temps réel, animations glow, et terminal de logs complet.
- **Gestionnaire de Tâches** : Paramétrez facilement la fréquence de balayage et l'âge maximum des tweets ciblés.
- **Zone de Danger** : Purge de la base de données intégrée pour empêcher l'accumulation de milliers de codes obsolètes.

---

## 🛠️ Prérequis

Avant de lancer le projet, assurez-vous de disposer des éléments suivants :

1. **Node.js** (v18 ou supérieur) et `pnpm` (ou `npm`).
2. **Google Chrome** installé sur votre machine (chemin par défaut ciblé : `C:\Program Files\Google\Chrome\Application\chrome.exe`).
3. Un **Profil Chrome Authentifié sur Binance** :
   Le robot utilise un dossier de profil Google Chrome pour conserver la session Binance ouverte. Par défaut, le bot pointe vers : `C:\Users\pc\Documents\chrome-bot-profile`.
   - *Vous devez ouvrir Chrome avec ce dossier de données utilisateur au moins une fois, vous connecter à Binance manuellement et cocher "Se souvenir de moi".*

---

## 🚀 Installation & Lancement

1. **Cloner le projet et installer les dépendances :**
   ```bash
   pnpm install
   ```

2. **Configurer l'environnement :**
   Créez un fichier `.env` à la racine (ou utilisez `.env.example`). *Note : l'API Binance n'est plus utilisée pour les claims grâce à Playwright, mais ces variables sont conservées pour des raisons de rétrocompatibilité.*

3. **Lancer le serveur de développement :**
   ```bash
   pnpm run dev
   ```

4. **Accéder au Command Center :**
   Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

---

## ⚙️ Comment utiliser le Dashboard ?

Une fois sur l'interface :

1. **Onglet Paramètres (Settings) :**
   - Ajoutez des comptes Twitter (sans le `@`) à surveiller (ex: `BinanceAfr`, `CryptoWhale`).
   - Ajustez la fréquence de Scraping (en minutes) et la limite d'âge des tweets (ex: ne scanner que les tweets de moins de 10 minutes).
   - *Attention : Ne mettez pas une fréquence trop agressive (ex: 1 minute) si vous avez des dizaines de comptes, pour ne pas saturer les instances Nitter.*

2. **Dashboard :**
   - Activez l'interrupteur "Scraping Automatique" en haut à droite.
   - Le statut du bot va s'animer ("Robot en veille" ➔ "Scraping en cours...").
   - Les codes trouvés s'afficheront dans la grille avec le statut *En attente*. Le module Playwright prendra ensuite le relais un par un pour réclamer les paquets et mettra à jour l'interface avec les montants gagnés !

3. **Onglet Logs :**
   - Consultez le Terminal serveur en temps réel pour voir si un Nitter tombe en erreur, ou suivre les requêtes de Playwright.

---

## 🏗️ Architecture du Projet

- `src/app/` : Routes Next.js App Router (Dashboard, UI).
- `src/lib/scraper.js` : Moteur de parsing Nitter (Extraction HTML et Regex ultra-tolérante).
- `src/lib/playwright-binance.js` : Pilote d'automatisation Chrome. Gère les fermetures de processus zombies et l'auto-réparation de session.
- `src/lib/db.js` : Interface avec le fichier local `data/database.json`.
- `data/database.json` : Base de données locale pour stocker les comptes cibles, les paramètres et l'historique des codes.

---

## ⚠️ Notes de Sécurité et Limites

- **Le fichier `database.json` n'est pas versionné** pour éviter d'exposer les données. Ne le supprimez pas si vous souhaitez conserver l'historique de vos paramètres et comptes, mais n'hésitez pas à utiliser le bouton **"Purger les vieux codes"** (Danger Zone) dans les Paramètres pour le nettoyer.
- Lors du lancement de l'étape de *Claiming*, vous pourrez voir une fenêtre Chrome s'ouvrir et s'automatiser si le processus ne tourne pas en mode *headless*. **Ne touchez pas à la fenêtre pendant que le bot travaille**.

Développé pour maximiser le temps de réaction sur Binance. Enjoy les airdrops ! 💸
