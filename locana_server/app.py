"""Serveur HTTP Locana : fichiers du site + API JSON (comptes, validation, messagerie, RGPD)."""
import json
import mimetypes
import re
import threading
import unicodedata
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from . import config, db, mailer, security as sec

ROOT = config.ROOT
MAX_BODY = 64 * 1024
SESSION_COOKIE = 'locana_session'
CATEGORIES = {'alimentation', 'fleurs', 'beaute', 'artisanat', 'loisirs', 'evenementiel', 'services'}

mimetypes.add_type('font/woff2', '.woff2')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('application/javascript', '.js')

CSP = ("default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
       "font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'")


class HttpError(Exception):
    def __init__(self, status, message, errors=None):
        super().__init__(message)
        self.status, self.message, self.errors = status, message, errors


# ======================================================================
# Requête / réponse
# ======================================================================
class Request:
    def __init__(self, handler, method):
        self.h = handler
        self.method = method
        url = urlparse(handler.path)
        self.path = url.path
        self.query = {k: v[0] for k, v in parse_qs(url.query).items()}
        self.ip = handler.client_address[0]
        self.conn = None
        self.user = None
        self.session = None
        self._body = None

    def json(self):
        if self._body is None:
            length = int(self.h.headers.get('Content-Length') or 0)
            if length > MAX_BODY:
                raise HttpError(413, 'Requête trop volumineuse.')
            raw = self.h.rfile.read(length) if length else b''
            try:
                self._body = json.loads(raw or b'{}')
            except ValueError:
                raise HttpError(400, 'Format de requête invalide.')
            if not isinstance(self._body, dict):
                raise HttpError(400, 'Format de requête invalide.')
        return self._body


def strip_html(s):
    return s.replace('<', '‹').replace('>', '›')


# ======================================================================
# Sessions
# ======================================================================
def load_session(req):
    cookie = SimpleCookie(req.h.headers.get('Cookie', ''))
    if SESSION_COOKIE not in cookie:
        return
    th = sec.token_hash(cookie[SESSION_COOKIE].value)
    row = req.conn.execute(
        'SELECT s.token_hash, s.csrf, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?',
        (th,)).fetchone()
    if not row or row['expires_at'] < db.iso() or row['status'] == 'suspended':
        return
    req.session = {'token_hash': row['token_hash'], 'csrf': row['csrf']}
    req.user = row


def create_session(req, user_id):
    token = sec.new_token()
    csrf = sec.new_token()
    req.conn.execute('INSERT INTO sessions (token_hash, user_id, csrf, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
                     (sec.token_hash(token), user_id, csrf, db.iso(), db.in_future(days=config.SESSION_DAYS)))
    req.conn.execute('UPDATE users SET last_login_at = ? WHERE id = ?', (db.iso(), user_id))
    return token, csrf


def session_cookie(token, max_age):
    attrs = f'{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}'
    if config.SECURE_COOKIES:
        attrs += '; Secure'
    return attrs


def check_origin(req):
    """Les requêtes qui modifient des données doivent venir du site lui-même."""
    host = req.h.headers.get('Host', '')
    origin = req.h.headers.get('Origin') or req.h.headers.get('Referer') or ''
    if origin and urlparse(origin).netloc != host:
        raise HttpError(403, 'Origine de la requête refusée.')
    if req.session and req.h.headers.get('X-CSRF-Token') != req.session['csrf']:
        raise HttpError(403, 'Jeton de sécurité invalide. Rechargez la page.')


def need(req, role):
    if not req.user:
        raise HttpError(401, 'Connexion requise.')
    if role == 'admin' and req.user['role'] != 'admin':
        raise HttpError(403, 'Accès réservé à l’administration.')
    if role == 'member' and req.user['role'] == 'admin':
        raise HttpError(403, 'Cet espace est réservé aux membres.')


def limit(key, n, seconds, message='Trop de tentatives. Réessayez dans quelques minutes.'):
    if not sec.limiter.allow(key, n, seconds):
        raise HttpError(429, message)


# ======================================================================
# Sérialisation
# ======================================================================
def public_user(conn, u):
    p = conn.execute('SELECT * FROM profiles WHERE user_id = ?', (u['id'],)).fetchone()
    data = {
        'id': u['id'], 'email': u['email'], 'role': u['role'], 'status': u['status'], 'statusNote': u['status_note'],
        'statusChangedAt': u['status_changed_at'], 'createdAt': u['created_at'], 'lastLoginAt': u['last_login_at'],
        'consentAt': u['consent_at'], 'consentVersion': u['consent_version'],
    }
    if p:
        data['profile'] = {
            'structureName': p['structure_name'], 'description': p['description'], 'registrationNumber': p['registration_number'],
            'category': p['category'], 'commune': p['commune'], 'postalCode': p['postal_code'], 'website': p['website'],
            'contactName': p['contact_name'], 'contactRole': p['contact_role'], 'phone': p['phone'], 'partnerCode': p['partner_code'],
            'updatedAt': p['updated_at'],
        }
    return data


def message_out(m):
    return {'id': m['id'], 'sender': m['sender'], 'body': m['body'], 'createdAt': m['created_at'], 'readAt': m['read_at']}


# ======================================================================
# Profil : lecture du formulaire
# ======================================================================
def read_profile(body, role, errors):
    p = {
        'structure_name': sec.text(body.get('structureName'), 120, True, 'structureName', errors, 'Le nom'),
        'description': sec.text(body.get('description'), 600, role == 'association', 'description', errors, 'L’objet de l’association'),
        'registration_number': sec.registration_number(body.get('registrationNumber'), 'registrationNumber', errors),
        'commune': sec.text(body.get('commune'), 80, True, 'commune', errors, 'La commune'),
        'postal_code': sec.postal_code(body.get('postalCode'), 'postalCode', errors),
        'website': sec.website(body.get('website'), 'website', errors),
        'contact_name': sec.text(body.get('contactName'), 80, True, 'contactName', errors, 'Le nom du contact'),
        'contact_role': sec.text(body.get('contactRole'), 60, False, 'contactRole', errors),
        'phone': sec.phone(body.get('phone'), 'phone', errors),
        'category': None,
    }
    if role == 'professionnel':
        cat = str(body.get('category') or '')
        if cat not in CATEGORIES:
            errors['category'] = 'Choisissez votre catégorie principale.'
        p['category'] = cat
    return p


def partner_code(conn, name, commune):
    words = re.findall(r'[A-Z]+', sec.strip_accents(name).upper())
    stop = {'DE', 'DU', 'DES', 'LA', 'LE', 'LES', 'L', 'D', 'ET', 'A', 'AU', 'AUX'}
    words = [w for w in words if w not in stop] or ['ASSO']
    prefix = words[0][:6] if len(words[0]) >= 3 else ''.join(w[0] for w in words[:4])
    town = re.sub(r'[^A-Z]', '', sec.strip_accents(commune).upper().split('-')[0].split(' ')[0])[:8] or 'LOCAL'
    base = f'{prefix}-{town}{db.now().year % 100:02d}'
    code, i = base, 0
    while conn.execute('SELECT 1 FROM profiles WHERE partner_code = ?', (code,)).fetchone():
        i += 1
        code = base + chr(64 + i) if i < 27 else f'{base}{i}'
    return code


# ======================================================================
# Routes : session et comptes
# ======================================================================
def r_session(req):
    if not req.user:
        return {'user': None}
    u = req.user
    out = {'user': public_user(req.conn, u), 'csrf': req.session['csrf']}
    if u['role'] == 'admin':
        out['counts'] = {
            'pending': req.conn.execute("SELECT COUNT(*) FROM users WHERE status IN ('pending', 'info') AND role != 'admin'").fetchone()[0],
            'unread': req.conn.execute("SELECT COUNT(*) FROM messages WHERE sender = 'member' AND read_at IS NULL").fetchone()[0],
        }
    else:
        out['counts'] = {'unread': req.conn.execute("SELECT COUNT(*) FROM messages WHERE member_id = ? AND sender = 'admin' AND read_at IS NULL", (u['id'],)).fetchone()[0]}
    return out


def r_register(req):
    limit(f'register:{req.ip}', 5, 3600, 'Trop d’inscriptions depuis cette connexion. Réessayez plus tard.')
    body = req.json()
    errors = {}
    role = body.get('role')
    if role not in ('association', 'professionnel'):
        errors['role'] = 'Choisissez un type de profil.'
        role = 'association'
    email = sec.email(body.get('email'), 'email', errors)
    password = sec.password_ok(body.get('password'), 'password', errors, config.PASSWORD_MIN_LENGTH)
    profile = read_profile(body, role, errors)
    if body.get('consent') is not True:
        errors['consent'] = 'Votre accord est nécessaire pour créer le compte.'
    if errors:
        raise HttpError(422, 'Certains champs sont à corriger.', errors)

    existing = req.conn.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
    if existing:
        # Réponse identique pour ne pas révéler qu'un compte existe ; on prévient le titulaire.
        mailer.existing_account_attempt(email)
        sec.hash_password(password)
        return {'ok': True}

    pw_hash = sec.hash_password(password)
    req.conn.execute('BEGIN')
    try:
        cur = req.conn.execute('INSERT INTO users (email, password_hash, role, status, created_at, consent_at, consent_version) VALUES (?, ?, ?, ?, ?, ?, ?)',
                               (email, pw_hash, role, 'pending', db.iso(), db.iso(), config.CONSENT_VERSION))
        uid = cur.lastrowid
        req.conn.execute('INSERT INTO profiles (user_id, structure_name, description, registration_number, category, commune, postal_code, website, contact_name, contact_role, phone, updated_at) '
                         'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                         (uid, profile['structure_name'], profile['description'], profile['registration_number'], profile['category'],
                          profile['commune'], profile['postal_code'], profile['website'], profile['contact_name'], profile['contact_role'],
                          profile['phone'], db.iso()))
        req.conn.execute('COMMIT')
    except Exception:
        req.conn.execute('ROLLBACK')
        raise
    mailer.admin_new_registration(req.conn, uid, role, profile['structure_name'], f"{profile['commune']} ({profile['postal_code']})")
    mailer.member_registration_received(email, profile['structure_name'])
    return {'ok': True}


def r_login(req):
    body = req.json()
    email = str(body.get('email') or '').strip().lower()[:254]
    password = str(body.get('password') or '')[:200]
    limit(f'login:{req.ip}', 20, 900)
    limit(f'login:{email}', 6, 900, 'Trop de tentatives pour ce compte. Réessayez dans 15 minutes.')
    u = req.conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    if not u:
        sec.verify_password(password, sec.DUMMY_HASH)
        raise HttpError(401, 'Adresse e-mail ou mot de passe incorrect.')
    if not sec.verify_password(password, u['password_hash']):
        raise HttpError(401, 'Adresse e-mail ou mot de passe incorrect.')
    if u['status'] == 'suspended':
        raise HttpError(403, 'Ce compte est suspendu. Contactez l’équipe via la page Contact.')
    sec.limiter.reset(f'login:{email}')
    token, csrf = create_session(req, u['id'])
    u = req.conn.execute('SELECT * FROM users WHERE id = ?', (u['id'],)).fetchone()
    return {'user': public_user(req.conn, u), 'csrf': csrf, 'redirect': 'admin.html' if u['role'] == 'admin' else 'espace.html'}, \
        [('Set-Cookie', session_cookie(token, config.SESSION_DAYS * 86400))]


def r_logout(req):
    if req.session:
        req.conn.execute('DELETE FROM sessions WHERE token_hash = ?', (req.session['token_hash'],))
    return {'ok': True}, [('Set-Cookie', session_cookie('', 0))]


def r_forgot(req):
    limit(f'forgot:{req.ip}', 5, 3600)
    email = str(req.json().get('email') or '').strip().lower()[:254]
    u = req.conn.execute('SELECT id, email FROM users WHERE email = ?', (email,)).fetchone()
    if u:
        token = sec.new_token()
        req.conn.execute('DELETE FROM password_resets WHERE user_id = ?', (u['id'],))
        req.conn.execute('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
                         (sec.token_hash(token), u['id'], db.in_future(minutes=config.RESET_TOKEN_MINUTES)))
        mailer.password_reset(u['email'], token)
    return {'ok': True}


def r_reset(req):
    limit(f'reset:{req.ip}', 10, 3600)
    body = req.json()
    errors = {}
    password = sec.password_ok(body.get('password'), 'password', errors, config.PASSWORD_MIN_LENGTH)
    if errors:
        raise HttpError(422, 'Mot de passe trop faible.', errors)
    row = req.conn.execute('SELECT * FROM password_resets WHERE token_hash = ?', (sec.token_hash(str(body.get('token') or '')),)).fetchone()
    if not row or row['expires_at'] < db.iso():
        raise HttpError(400, 'Ce lien n’est plus valable. Faites une nouvelle demande.')
    req.conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', (sec.hash_password(password), row['user_id']))
    req.conn.execute('DELETE FROM password_resets WHERE user_id = ?', (row['user_id'],))
    req.conn.execute('DELETE FROM sessions WHERE user_id = ?', (row['user_id'],))
    return {'ok': True}


# ======================================================================
# Routes : espace membre
# ======================================================================
def r_profile_update(req):
    need(req, 'member')
    body = req.json()
    errors = {}
    p = read_profile(body, req.user['role'], errors)
    if errors:
        raise HttpError(422, 'Certains champs sont à corriger.', errors)
    req.conn.execute('UPDATE profiles SET structure_name=?, description=?, registration_number=?, category=?, commune=?, postal_code=?, website=?, '
                     'contact_name=?, contact_role=?, phone=?, updated_at=? WHERE user_id=?',
                     (p['structure_name'], p['description'], p['registration_number'], p['category'], p['commune'], p['postal_code'],
                      p['website'], p['contact_name'], p['contact_role'], p['phone'], db.iso(), req.user['id']))
    u = req.conn.execute('SELECT * FROM users WHERE id = ?', (req.user['id'],)).fetchone()
    return {'user': public_user(req.conn, u)}


def r_password_change(req):
    need(req, None)
    body = req.json()
    if not sec.verify_password(str(body.get('current') or ''), req.user['password_hash']):
        raise HttpError(422, 'Mot de passe actuel incorrect.', {'current': 'Mot de passe actuel incorrect.'})
    errors = {}
    new = sec.password_ok(body.get('password'), 'password', errors, config.PASSWORD_MIN_LENGTH)
    if errors:
        raise HttpError(422, 'Mot de passe trop faible.', errors)
    req.conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', (sec.hash_password(new), req.user['id']))
    req.conn.execute('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', (req.user['id'], req.session['token_hash']))
    return {'ok': True}


def r_export(req):
    need(req, None)
    uid = req.user['id']
    data = {
        'export': {'generatedAt': db.iso(), 'service': 'Locana', 'note': 'Données personnelles vous concernant (article 15 et 20 du RGPD).'},
        'account': public_user(req.conn, req.user),
        'messages': [message_out(m) for m in req.conn.execute('SELECT * FROM messages WHERE member_id = ? ORDER BY id', (uid,))],
        'activeSessions': req.conn.execute('SELECT COUNT(*) FROM sessions WHERE user_id = ?', (uid,)).fetchone()[0],
    }
    payload = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
    return RawResponse(payload, 'application/json; charset=utf-8',
                       [('Content-Disposition', 'attachment; filename="locana-mes-donnees.json"')])


def delete_account(conn, uid, admin_id=None, reason='Suppression à la demande de l’utilisateur'):
    conn.execute("UPDATE audit_log SET target_label = 'Compte supprimé' WHERE target_user_id = ?", (uid,))
    conn.execute('DELETE FROM users WHERE id = ?', (uid,))  # profil, sessions, messages : suppression en cascade
    db.audit(conn, admin_id, 'delete', None, 'Compte supprimé', reason)


def r_delete_me(req):
    need(req, None)
    if not sec.verify_password(str(req.json().get('password') or ''), req.user['password_hash']):
        raise HttpError(422, 'Mot de passe incorrect.', {'password': 'Mot de passe incorrect.'})
    if req.user['role'] == 'admin' and req.conn.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'").fetchone()[0] <= 1:
        raise HttpError(409, 'Impossible de supprimer le dernier compte administrateur.')
    delete_account(req.conn, req.user['id'])
    return {'ok': True}, [('Set-Cookie', session_cookie('', 0))]


def r_messages(req):
    need(req, 'member')
    after = int(req.query.get('after') or 0)
    rows = req.conn.execute('SELECT * FROM messages WHERE member_id = ? AND id > ? ORDER BY id', (req.user['id'], after)).fetchall()
    req.conn.execute("UPDATE messages SET read_at = ? WHERE member_id = ? AND sender = 'admin' AND read_at IS NULL", (db.iso(), req.user['id']))
    return {'messages': [message_out(m) for m in rows]}


def read_message_body(req):
    body = sec.text(req.json().get('body'), 4000, True, 'body', errs := {}, 'Le message')
    if errs:
        raise HttpError(422, errs['body'], errs)
    return body


def r_message_send(req):
    need(req, 'member')
    limit(f'msg:{req.user["id"]}', 20, 60, 'Vous envoyez beaucoup de messages : patientez une minute.')
    body = read_message_body(req)
    cur = req.conn.execute("INSERT INTO messages (member_id, sender, author_id, body, created_at) VALUES (?, 'member', ?, ?, ?)",
                           (req.user['id'], req.user['id'], body, db.iso()))
    # Une alerte par conversation tant que les précédents messages ne sont pas lus.
    unread = req.conn.execute("SELECT COUNT(*) FROM messages WHERE member_id = ? AND sender = 'member' AND read_at IS NULL", (req.user['id'],)).fetchone()[0]
    if unread == 1:
        name = req.conn.execute('SELECT structure_name FROM profiles WHERE user_id = ?', (req.user['id'],)).fetchone()
        mailer.admin_new_message(req.conn, req.user['id'], name['structure_name'] if name else req.user['email'])
    m = req.conn.execute('SELECT * FROM messages WHERE id = ?', (cur.lastrowid,)).fetchone()
    return {'message': message_out(m)}


# ======================================================================
# Routes : administration
# ======================================================================
def member_summary(conn, row):
    return {
        'id': row['id'], 'email': row['email'], 'role': row['role'], 'status': row['status'], 'createdAt': row['created_at'],
        'structureName': row['structure_name'], 'commune': row['commune'], 'postalCode': row['postal_code'],
        'partnerCode': row['partner_code'], 'category': row['category'],
    }


def r_admin_members(req):
    need(req, 'admin')
    status = req.query.get('status', 'todo')
    role = req.query.get('role', '')
    sql = 'SELECT u.*, p.structure_name, p.commune, p.postal_code, p.partner_code, p.category FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.role != \'admin\''
    args = []
    if status == 'todo':
        sql += " AND u.status IN ('pending', 'info')"
    elif status in ('pending', 'info', 'active', 'rejected', 'suspended'):
        sql += ' AND u.status = ?'
        args.append(status)
    if role in ('association', 'professionnel'):
        sql += ' AND u.role = ?'
        args.append(role)
    q = req.query.get('q', '').strip()
    if q:
        sql += ' AND (p.structure_name LIKE ? OR p.commune LIKE ? OR u.email LIKE ?)'
        args += [f'%{q}%'] * 3
    sql += ' ORDER BY u.created_at DESC LIMIT 500'
    return {'members': [member_summary(req.conn, r) for r in req.conn.execute(sql, args)]}


def get_member(conn, uid):
    u = conn.execute("SELECT * FROM users WHERE id = ? AND role != 'admin'", (uid,)).fetchone()
    if not u:
        raise HttpError(404, 'Compte introuvable.')
    return u


def r_admin_member(req, uid):
    need(req, 'admin')
    u = get_member(req.conn, int(uid))
    history = [dict(r) for r in req.conn.execute(
        'SELECT a.at, a.action, a.note, ad.email AS admin FROM audit_log a LEFT JOIN users ad ON ad.id = a.admin_id WHERE a.target_user_id = ? ORDER BY a.id DESC', (u['id'],))]
    return {'member': public_user(req.conn, u), 'history': history}


DECISIONS = {'approve': 'active', 'reject': 'rejected', 'info': 'info', 'suspend': 'suspended', 'reactivate': 'active'}


def r_admin_decision(req, uid):
    need(req, 'admin')
    u = get_member(req.conn, int(uid))
    body = req.json()
    decision = body.get('decision')
    if decision not in DECISIONS and decision != 'delete':
        raise HttpError(400, 'Décision inconnue.')
    note = sec.text(body.get('note'), 1000, decision in ('reject', 'info'), 'note', errs := {}, 'Le motif')
    if errs:
        raise HttpError(422, errs['note'], errs)
    p = req.conn.execute('SELECT * FROM profiles WHERE user_id = ?', (u['id'],)).fetchone()
    label = p['structure_name'] if p else u['email']
    if decision == 'delete':
        delete_account(req.conn, u['id'], req.user['id'], note or 'Suppression par l’administration')
        return {'ok': True, 'deleted': True}
    code = p['partner_code'] if p else None
    if decision == 'approve' and u['role'] == 'association' and not code:
        code = partner_code(req.conn, p['structure_name'], p['commune'])
        req.conn.execute('UPDATE profiles SET partner_code = ? WHERE user_id = ?', (code, u['id']))
    req.conn.execute('UPDATE users SET status = ?, status_note = ?, status_changed_at = ? WHERE id = ?',
                     (DECISIONS[decision], note or None, db.iso(), u['id']))
    if decision == 'suspend':
        req.conn.execute('DELETE FROM sessions WHERE user_id = ?', (u['id'],))
    if decision == 'info' and note:
        req.conn.execute("INSERT INTO messages (member_id, sender, author_id, body, created_at) VALUES (?, 'admin', ?, ?, ?)",
                         (u['id'], req.user['id'], note, db.iso()))
    db.audit(req.conn, req.user['id'], decision, u['id'], label, note or None)
    mailer.member_decision(u['email'], label, decision, note, code if decision == 'approve' else None)
    return r_admin_member(req, uid)


def r_admin_conversations(req):
    need(req, 'admin')
    rows = req.conn.execute(
        "SELECT u.id, u.role, u.status, p.structure_name, p.commune, "
        "MAX(m.id) AS last_id, SUM(CASE WHEN m.sender = 'member' AND m.read_at IS NULL THEN 1 ELSE 0 END) AS unread "
        "FROM messages m JOIN users u ON u.id = m.member_id JOIN profiles p ON p.user_id = u.id GROUP BY u.id ORDER BY last_id DESC").fetchall()
    out = []
    for r in rows:
        last = req.conn.execute('SELECT * FROM messages WHERE id = ?', (r['last_id'],)).fetchone()
        out.append({'memberId': r['id'], 'role': r['role'], 'status': r['status'], 'structureName': r['structure_name'], 'commune': r['commune'],
                    'unread': r['unread'], 'last': message_out(last)})
    return {'conversations': out}


def r_admin_thread(req, uid):
    need(req, 'admin')
    u = get_member(req.conn, int(uid))
    after = int(req.query.get('after') or 0)
    rows = req.conn.execute('SELECT * FROM messages WHERE member_id = ? AND id > ? ORDER BY id', (u['id'], after)).fetchall()
    req.conn.execute("UPDATE messages SET read_at = ? WHERE member_id = ? AND sender = 'member' AND read_at IS NULL", (db.iso(), u['id']))
    p = req.conn.execute('SELECT structure_name, commune FROM profiles WHERE user_id = ?', (u['id'],)).fetchone()
    return {'member': {'id': u['id'], 'role': u['role'], 'status': u['status'], 'structureName': p['structure_name'], 'commune': p['commune']},
            'messages': [message_out(m) for m in rows]}


def r_admin_send(req, uid):
    need(req, 'admin')
    u = get_member(req.conn, int(uid))
    body = read_message_body(req)
    cur = req.conn.execute("INSERT INTO messages (member_id, sender, author_id, body, created_at) VALUES (?, 'admin', ?, ?, ?)",
                           (u['id'], req.user['id'], body, db.iso()))
    unread = req.conn.execute("SELECT COUNT(*) FROM messages WHERE member_id = ? AND sender = 'admin' AND read_at IS NULL", (u['id'],)).fetchone()[0]
    if unread == 1:
        mailer.member_new_message(u['email'])
    m = req.conn.execute('SELECT * FROM messages WHERE id = ?', (cur.lastrowid,)).fetchone()
    return {'message': message_out(m)}


def r_admin_settings(req):
    need(req, 'admin')
    return {
        'notificationEmail': db.get_setting(req.conn, 'notification_email'),
        'smtp': {'configured': config.smtp_configured(), 'host': config.SMTP_HOST or None, 'from': config.SMTP_FROM if config.smtp_configured() else None},
        'retention': config.RETENTION,
        'publicUrl': config.PUBLIC_URL,
    }


def r_admin_settings_update(req):
    need(req, 'admin')
    errors = {}
    email = sec.email(req.json().get('notificationEmail'), 'notificationEmail', errors)
    if errors:
        raise HttpError(422, errors['notificationEmail'], errors)
    old = db.get_setting(req.conn, 'notification_email')
    db.set_setting(req.conn, 'notification_email', email)
    db.audit(req.conn, req.user['id'], 'settings', None, 'Paramètres', f'Adresse de notification modifiée ({mask(old)} → {mask(email)})')
    return r_admin_settings(req)


def mask(email):
    name, _, domain = email.partition('@')
    return (name[:2] + '•••@' + domain) if domain else '•••'


def r_admin_test_email(req):
    need(req, 'admin')
    limit(f'test-email:{req.user["id"]}', 5, 600)
    to = db.get_setting(req.conn, 'notification_email')
    ok = mailer.send(to, 'Test des notifications Locana', 'Bonjour,\n\nCet e-mail confirme que les notifications Locana arrivent bien à cette adresse.\n', wait=True)
    if not ok:
        raise HttpError(502, 'L’envoi a échoué. Vérifiez la configuration SMTP dans le fichier .env.')
    return {'ok': True, 'mode': 'smtp' if config.smtp_configured() else 'outbox'}


def r_admin_audit(req):
    need(req, 'admin')
    rows = req.conn.execute('SELECT a.*, ad.email AS admin FROM audit_log a LEFT JOIN users ad ON ad.id = a.admin_id ORDER BY a.id DESC LIMIT 300')
    return {'entries': [{'at': r['at'], 'action': r['action'], 'label': r['target_label'], 'note': r['note'], 'admin': r['admin'],
                         'targetId': r['target_user_id']} for r in rows]}


def r_admin_stats(req):
    need(req, 'admin')
    c = req.conn
    q = lambda sql, *a: c.execute(sql, a).fetchone()[0]
    return {
        'pending': q("SELECT COUNT(*) FROM users WHERE status IN ('pending', 'info') AND role != 'admin'"),
        'associations': q("SELECT COUNT(*) FROM users WHERE role = 'association' AND status = 'active'"),
        'professionnels': q("SELECT COUNT(*) FROM users WHERE role = 'professionnel' AND status = 'active'"),
        'unread': q("SELECT COUNT(*) FROM messages WHERE sender = 'member' AND read_at IS NULL"),
        'recent': [member_summary(c, r) for r in c.execute(
            "SELECT u.*, p.structure_name, p.commune, p.postal_code, p.partner_code, p.category FROM users u JOIN profiles p ON p.user_id = u.id "
            "WHERE u.role != 'admin' ORDER BY u.created_at DESC LIMIT 5")],
    }


def r_admin_outbox(req):
    need(req, 'admin')
    if config.smtp_configured():
        return {'enabled': False, 'emails': []}
    items = []
    if config.OUTBOX_DIR.exists():
        from email import policy
        from email.parser import BytesParser
        for f in sorted(config.OUTBOX_DIR.glob('*.eml'), reverse=True)[:50]:
            msg = BytesParser(policy=policy.default).parsebytes(f.read_bytes())
            items.append({'file': f.name, 'to': msg['To'], 'subject': msg['Subject'], 'date': msg['Date'],
                          'body': msg.get_body(preferencelist=('plain',)).get_content()})
    return {'enabled': True, 'emails': items}


# ======================================================================
# RGPD : purge automatique
# ======================================================================
def purge(conn=None):
    own = conn is None
    conn = conn or db.connect()
    from datetime import timedelta
    now = db.now()
    conn.execute('DELETE FROM sessions WHERE expires_at < ?', (db.iso(),))
    conn.execute('DELETE FROM password_resets WHERE expires_at < ?', (db.iso(),))
    refused = conn.execute("SELECT id FROM users WHERE status = 'rejected' AND status_changed_at < ?",
                           (db.iso(now - timedelta(days=config.RETENTION['refused_account_days'])),)).fetchall()
    for r in refused:
        delete_account(conn, r['id'], None, 'Purge automatique : demande refusée')
    inactive = conn.execute("SELECT id FROM users WHERE role != 'admin' AND COALESCE(last_login_at, created_at) < ?",
                            (db.iso(now - timedelta(days=365 * config.RETENTION['inactive_account_years'])),)).fetchall()
    for r in inactive:
        delete_account(conn, r['id'], None, 'Purge automatique : compte inactif')
    conn.execute('DELETE FROM audit_log WHERE at < ?', (db.iso(now - timedelta(days=365 * config.RETENTION['audit_log_years'])),))
    if config.OUTBOX_DIR.exists():
        limit_ts = (now - timedelta(days=config.RETENTION['outbox_days'])).timestamp()
        for f in config.OUTBOX_DIR.glob('*.eml'):
            if f.stat().st_mtime < limit_ts:
                f.unlink()
    if own:
        conn.close()
    return len(refused) + len(inactive)


def purge_loop(stop):
    while not stop.wait(24 * 3600):
        try:
            purge()
        except Exception as exc:
            print(f'[purge] erreur : {type(exc).__name__}')


# ======================================================================
# Routage
# ======================================================================
class RawResponse:
    def __init__(self, data, ctype, headers=None):
        self.data, self.ctype, self.headers = data, ctype, headers or []


ROUTES = [
    ('GET', r'/api/session', r_session),
    ('POST', r'/api/register', r_register),
    ('POST', r'/api/login', r_login),
    ('POST', r'/api/logout', r_logout),
    ('POST', r'/api/password/forgot', r_forgot),
    ('POST', r'/api/password/reset', r_reset),
    ('PUT', r'/api/me/profile', r_profile_update),
    ('PUT', r'/api/me/password', r_password_change),
    ('GET', r'/api/me/export', r_export),
    ('DELETE', r'/api/me', r_delete_me),
    ('GET', r'/api/messages', r_messages),
    ('POST', r'/api/messages', r_message_send),
    ('GET', r'/api/admin/stats', r_admin_stats),
    ('GET', r'/api/admin/members', r_admin_members),
    ('GET', r'/api/admin/members/(\d+)', r_admin_member),
    ('POST', r'/api/admin/members/(\d+)/decision', r_admin_decision),
    ('GET', r'/api/admin/conversations', r_admin_conversations),
    ('GET', r'/api/admin/conversations/(\d+)', r_admin_thread),
    ('POST', r'/api/admin/conversations/(\d+)', r_admin_send),
    ('GET', r'/api/admin/settings', r_admin_settings),
    ('PUT', r'/api/admin/settings', r_admin_settings_update),
    ('POST', r'/api/admin/settings/test-email', r_admin_test_email),
    ('GET', r'/api/admin/audit', r_admin_audit),
    ('GET', r'/api/admin/outbox', r_admin_outbox),
]
COMPILED = [(m, re.compile('^' + p + '$'), f) for m, p, f in ROUTES]


class Handler(BaseHTTPRequestHandler):
    server_version = 'Locana'
    sys_version = ''

    def log_message(self, fmt, *args):  # journal minimal : pas d'adresse IP (minimisation des données)
        if args and isinstance(args[0], str) and args[0].startswith(('POST', 'PUT', 'DELETE')):
            print(f'[{db.now():%H:%M:%S}] {args[0].split(" HTTP")[0]} {args[1] if len(args) > 1 else ""}')

    def do_GET(self): self.dispatch('GET')
    def do_HEAD(self): self.dispatch('HEAD')
    def do_POST(self): self.dispatch('POST')
    def do_PUT(self): self.dispatch('PUT')
    def do_DELETE(self): self.dispatch('DELETE')

    def security_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), interest-cohort=()')
        self.send_header('Content-Security-Policy', CSP)
        if config.SECURE_COOKIES:
            self.send_header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

    def send_json(self, status, payload, headers=()):
        data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        for k, v in headers:
            self.send_header(k, v)
        self.security_headers()
        self.end_headers()
        self.wfile.write(data)

    def dispatch(self, method):
        path = urlparse(self.path).path
        if path.startswith('/api/'):
            return self.api(method if method != 'HEAD' else 'GET')
        if method not in ('GET', 'HEAD'):
            return self.send_json(405, {'error': 'Méthode non autorisée.'})
        return self.static(path, method == 'HEAD')

    def api(self, method):
        req = Request(self, method)
        req.conn = db.connect()
        try:
            load_session(req)
            for m, rx, fn in COMPILED:
                match = rx.match(req.path)
                if match and m == method:
                    if method != 'GET':
                        check_origin(req)
                    result = fn(req, *match.groups())
                    headers = []
                    if isinstance(result, tuple):
                        result, headers = result
                    if isinstance(result, RawResponse):
                        self.send_response(200)
                        self.send_header('Content-Type', result.ctype)
                        self.send_header('Content-Length', str(len(result.data)))
                        self.send_header('Cache-Control', 'no-store')
                        for k, v in result.headers:
                            self.send_header(k, v)
                        self.security_headers()
                        self.end_headers()
                        self.wfile.write(result.data)
                        return
                    return self.send_json(200, result, headers)
            raise HttpError(404, 'Ressource introuvable.')
        except HttpError as e:
            payload = {'error': e.message}
            if e.errors:
                payload['errors'] = e.errors
            self.send_json(e.status, payload)
        except Exception as exc:
            print(f'[api] erreur interne : {type(exc).__name__}: {exc}')
            self.send_json(500, {'error': 'Erreur interne. Réessayez plus tard.'})
        finally:
            req.conn.close()

    def static(self, path, head):
        if path in ('', '/'):
            path = '/index.html'
        rel = path.lstrip('/')
        allowed = (re.fullmatch(r'[a-z0-9\-]+\.html', rel) or rel.startswith('assets/'))
        target = (ROOT / rel).resolve()
        try:
            target.relative_to(ROOT)
        except ValueError:
            allowed = False
        if not allowed or not target.is_file() or any(part.startswith('.') for part in Path(rel).parts):
            body = '<!doctype html><meta charset="utf-8"><title>Page introuvable</title><p>Page introuvable. <a href="/">Retour à l’accueil</a></p>'.encode()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.security_headers()
            self.end_headers()
            if not head:
                self.wfile.write(body)
            return
        ctype = mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
        if ctype.startswith('text/') or ctype in ('application/javascript', 'image/svg+xml', 'application/json'):
            ctype += '; charset=utf-8'
        data = target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-cache' if rel.endswith('.html') else 'public, max-age=3600')
        self.security_headers()
        self.end_headers()
        if not head:
            self.wfile.write(data)


def serve(host, port):
    db.init()
    removed = purge()
    stop = threading.Event()
    threading.Thread(target=purge_loop, args=(stop,), daemon=True).start()
    httpd = ThreadingHTTPServer((host, port), Handler)
    httpd.daemon_threads = True
    conn = db.connect()
    admins = conn.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'").fetchone()[0]
    conn.close()
    print(f'Locana est lancé sur http://{"localhost" if host in ("127.0.0.1", "0.0.0.0") else host}:{port}')
    print(f'E-mails : {"SMTP " + config.SMTP_HOST if config.smtp_configured() else "mode développement (copies dans data/outbox)"}')
    if removed:
        print(f'RGPD : {removed} compte(s) supprimé(s) par la purge automatique.')
    if not admins:
        print('Aucun compte administrateur. Créez-le avec :  python server.py create-admin')
    print('Arrêt : Ctrl+C')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nArrêt du serveur.')
    finally:
        stop.set()
        httpd.server_close()
