# Locana

Plateforme associative et commerces locaux (nom de travail). Site public, espaces membres, validation des inscriptions par un administrateur et messagerie privée.

## Lancer le site

Prérequis : Python 3.10 ou plus récent (aucune bibliothèque à installer).

```bash
python server.py
```

Puis ouvrir http://localhost:8000. Arrêt : `Ctrl+C`.

Sous Windows, lancez la commande depuis le dossier du site (celui qui contient `server.py`), pas depuis `C:\WINDOWS\system32`. Selon l'installation, la commande peut être `python`, `python3` ou `py`.

## Créer le compte administrateur (une seule fois)

```bash
python server.py create-admin
```

Saisissez votre adresse et un mot de passe, puis connectez-vous sur `/connexion.html` : vous arrivez dans l'administration (`/admin.html`).

## E-mails

- À chaque inscription (et à chaque nouveau message d'un membre), une alerte part vers l'adresse de notification. Par défaut : celle définie dans `locana_server/config.py`. Elle se modifie dans **Administration → Paramètres**.
- Sans configuration SMTP, rien n'est envoyé : chaque e-mail est enregistré dans `data/outbox/` et consultable dans **Administration → Boîte d'envoi**.
- Pour envoyer réellement : copiez `.env.example` en `.env`, renseignez un service d'envoi (de préférence hébergé dans l'UE), relancez le serveur, puis utilisez « Envoyer un e-mail de test » dans les paramètres.

## RGPD : ce qui est en place

- Consentement explicite et horodaté à l'inscription, politique de confidentialité (`confidentialite.html`, à compléter : responsable du traitement, hébergeur, prestataire d'e-mails).
- Données minimales ; téléphone et e-mail jamais publiés.
- Espace « Mes données » : consultation, rectification, export JSON, suppression immédiate du compte.
- Purge automatique : demandes refusées après 90 jours, comptes inactifs après 3 ans, journal après 3 ans.
- Sécurité : mots de passe hachés (scrypt), cookie de session HttpOnly/SameSite, protection CSRF, limitation des tentatives, en-têtes de sécurité, aucune ressource tierce (polices hébergées localement), aucun cookie de mesure d'audience.
- Les données (`data/`) et les secrets (`.env`) sont exclus de Git.

Avant une mise en ligne : HTTPS obligatoire (`PUBLIC_URL=https://…`), sauvegardes chiffrées du dossier `data/`, relecture juridique de la politique de confidentialité.

## Structure

- `server.py`, `locana_server/` : serveur (Python standard + SQLite)
- `index.html` et pages publiques ; `connexion.html`, `inscription.html`, `espace.html`, `admin.html`, `confidentialite.html`
- `assets/css/` : `style.css` (tokens, accueil), `pages.css` (pages intérieures), `app.css` (espaces connectés), `fonts.css`
- `assets/js/` : `main.js` (animations), `app.js` (client de l'API), `auth.js`, `espace.js`, `admin.js`, `annuaire*.js`, `contact.js`
- `tools/pages/` : gabarits des pages intérieures. Après modification : `python tools/pages/gen.py .`
- `tools/gen-icons.js` : régénère le sous-ensemble d'icônes Lucide
