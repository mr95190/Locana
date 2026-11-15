"""Locana — lancement du serveur et commandes d'administration.

  python server.py                 lance le site sur http://localhost:8000
  python server.py create-admin    crée (ou met à jour) un compte administrateur
  python server.py purge           applique tout de suite les durées de conservation RGPD
"""
import argparse
import getpass
import sys

from locana_server import app, config, db, security as sec


def create_admin():
    db.init()
    print('Création d’un compte administrateur Locana\n')
    email = input('Adresse e-mail de l’administrateur : ').strip().lower()
    errors = {}
    sec.email(email, 'email', errors)
    if errors:
        sys.exit('Adresse e-mail invalide.')
    while True:
        pw = getpass.getpass(f'Mot de passe (au moins {config.PASSWORD_MIN_LENGTH} caractères, lettres et chiffres) : ')
        errors = {}
        sec.password_ok(pw, 'password', errors, config.PASSWORD_MIN_LENGTH)
        if errors:
            print(errors['password'])
            continue
        if getpass.getpass('Confirmez le mot de passe : ') != pw:
            print('Les deux saisies ne correspondent pas.')
            continue
        break
    conn = db.connect()
    existing = conn.execute('SELECT id, role FROM users WHERE email = ?', (email,)).fetchone()
    if existing and existing['role'] != 'admin':
        sys.exit('Cette adresse est déjà utilisée par un compte membre.')
    if existing:
        conn.execute('UPDATE users SET password_hash = ?, status = ? WHERE id = ?', (sec.hash_password(pw), 'active', existing['id']))
        print('\nMot de passe administrateur mis à jour.')
    else:
        conn.execute("INSERT INTO users (email, password_hash, role, status, created_at, consent_at, consent_version) VALUES (?, ?, 'admin', 'active', ?, ?, ?)",
                     (email, sec.hash_password(pw), db.iso(), db.iso(), config.CONSENT_VERSION))
        print('\nCompte administrateur créé.')
    print(f'Connectez-vous sur {config.PUBLIC_URL}/connexion.html')
    conn.close()


def main():
    parser = argparse.ArgumentParser(description='Serveur Locana')
    parser.add_argument('command', nargs='?', default='serve', choices=['serve', 'create-admin', 'purge'])
    parser.add_argument('--host', default=config.HOST)
    parser.add_argument('--port', type=int, default=config.PORT)
    args = parser.parse_args()
    if args.command == 'create-admin':
        create_admin()
    elif args.command == 'purge':
        db.init()
        print(f'{app.purge()} compte(s) supprimé(s).')
    else:
        app.serve(args.host, args.port)


if __name__ == '__main__':
    main()
