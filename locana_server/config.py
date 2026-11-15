"""Configuration : variables d'environnement, fichier .env facultatif, valeurs par défaut."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv():
    env = ROOT / '.env'
    if not env.exists():
        return
    for raw in env.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), value)


_load_dotenv()


def get(key, default=''):
    return os.environ.get(key, default)


DATA_DIR = Path(get('LOCANA_DATA_DIR', str(ROOT / 'data'))).resolve()
OUTBOX_DIR = DATA_DIR / 'outbox'
DB_PATH = DATA_DIR / 'locana.db'

HOST = get('LOCANA_HOST', '127.0.0.1')
PORT = int(get('LOCANA_PORT', '8000'))
PUBLIC_URL = get('PUBLIC_URL', f'http://localhost:{PORT}').rstrip('/')
SECURE_COOKIES = PUBLIC_URL.startswith('https://')

# Adresse qui reçoit une alerte à chaque inscription (modifiable ensuite dans l'espace admin).
DEFAULT_NOTIFICATION_EMAIL = get('DEFAULT_NOTIFICATION_EMAIL', 'chevallier_marine@hotmail.fr')

SMTP_HOST = get('SMTP_HOST')
SMTP_PORT = int(get('SMTP_PORT', '587') or 587)
SMTP_USER = get('SMTP_USER')
SMTP_PASSWORD = get('SMTP_PASSWORD')
SMTP_FROM = get('SMTP_FROM', SMTP_USER or 'no-reply@localhost')
SMTP_SECURITY = get('SMTP_SECURITY', 'starttls').lower()  # starttls | ssl | none

SESSION_DAYS = 7
RESET_TOKEN_MINUTES = 60
PASSWORD_MIN_LENGTH = 10
CONSENT_VERSION = '2026-11'

# Durées de conservation (RGPD) — voir aussi la politique de confidentialité.
RETENTION = {
    'refused_account_days': 90,      # demandes refusées : suppression 90 jours après la décision
    'inactive_account_years': 3,     # comptes sans connexion depuis 3 ans
    'outbox_days': 30,               # copies d'e-mails en mode développement
    'audit_log_years': 3,            # journal des décisions de modération
}


def smtp_configured():
    return bool(SMTP_HOST)
