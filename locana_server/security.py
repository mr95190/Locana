"""Mots de passe, jetons, limitation de débit et validation des champs."""
import base64
import hashlib
import hmac
import re
import secrets
import threading
import time
import unicodedata
from collections import defaultdict, deque

# ---------- Mots de passe (scrypt, sel aléatoire) ----------
_N, _R, _P = 2 ** 14, 8, 1


def hash_password(password):
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode('utf-8'), salt=salt, n=_N, r=_R, p=_P, dklen=32, maxmem=64 * 1024 * 1024)
    return 'scrypt${}${}${}${}${}'.format(_N, _R, _P, base64.b64encode(salt).decode(), base64.b64encode(dk).decode())


def verify_password(password, stored):
    try:
        algo, n, r, p, salt, dk = stored.split('$')
        if algo != 'scrypt':
            return False
        test = hashlib.scrypt(password.encode('utf-8'), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p),
                              dklen=32, maxmem=64 * 1024 * 1024)
        return hmac.compare_digest(test, base64.b64decode(dk))
    except (ValueError, TypeError):
        return False


# Hachage factice pour garder un temps de réponse constant quand l'e-mail n'existe pas.
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


# ---------- Jetons ----------
def new_token():
    return secrets.token_urlsafe(32)


def token_hash(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


# ---------- Limitation de débit (en mémoire) ----------
class RateLimiter:
    def __init__(self):
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key, limit, window_seconds):
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > window_seconds:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True

    def reset(self, key):
        with self._lock:
            self._hits.pop(key, None)


limiter = RateLimiter()


# ---------- Validation ----------
class ValidationError(Exception):
    def __init__(self, errors):
        super().__init__('validation')
        self.errors = errors  # {champ: message}


EMAIL_RE = re.compile(r'^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[A-Za-z]{2,24}$')


def text(value, max_len, required=False, field='', errors=None, label='Ce champ'):
    v = ' '.join(str(value or '').split()) if max_len <= 200 else str(value or '').strip()
    v = v.replace('\x00', '')
    if required and not v:
        errors[field] = f'{label} est obligatoire.'
    elif len(v) > max_len:
        errors[field] = f'{max_len} caractères maximum.'
    return v


def email(value, field, errors, required=True):
    v = str(value or '').strip().lower()
    if not v and not required:
        return ''
    if not EMAIL_RE.match(v):
        errors[field] = 'Indiquez une adresse e-mail valide, par exemple nom@domaine.fr.'
    return v


def postal_code(value, field, errors):
    v = re.sub(r'\s', '', str(value or ''))
    if not re.fullmatch(r'\d{5}', v):
        errors[field] = 'Indiquez un code postal à 5 chiffres.'
    return v


def phone(value, field, errors):
    v = str(value or '').strip()
    if not v:
        return ''
    digits = re.sub(r'[\s.\-()]', '', v)
    if not re.fullmatch(r'\+?\d{9,15}', digits):
        errors[field] = 'Indiquez un numéro de téléphone valide.'
    return v[:30]


def registration_number(value, field, errors):
    v = re.sub(r'\s', '', str(value or '')).upper()
    if not v:
        return ''
    if not re.fullmatch(r'W\d{9}|\d{9}|\d{14}', v):
        errors[field] = 'Format attendu : RNA (W + 9 chiffres), SIREN (9 chiffres) ou SIRET (14 chiffres).'
    return v


def website(value, field, errors):
    v = str(value or '').strip()
    if not v:
        return ''
    if not re.match(r'^https?://', v, re.I):
        v = 'https://' + v
    if len(v) > 200 or not re.fullmatch(r'https?://[^\s<>"]+\.[^\s<>"]+', v, re.I):
        errors[field] = 'Indiquez une adresse de site valide.'
    return v


def password_ok(value, field, errors, min_len):
    v = str(value or '')
    if len(v) < min_len:
        errors[field] = f'Le mot de passe doit contenir au moins {min_len} caractères.'
    elif len(v) > 200:
        errors[field] = '200 caractères maximum.'
    elif v.isdigit() or v.isalpha():
        errors[field] = 'Mélangez lettres et chiffres (ou symboles).'
    return v


def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
