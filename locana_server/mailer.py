"""Envoi des e-mails : SMTP si configuré, sinon copie dans data/outbox (mode développement)."""
import re
import smtplib
import ssl
import threading
from email.message import EmailMessage
from email.utils import formatdate, make_msgid

from . import config, db


def _build(to, subject, text):
    msg = EmailMessage()
    msg['From'] = f'Locana <{config.SMTP_FROM}>'
    msg['To'] = to
    msg['Subject'] = subject
    msg['Date'] = formatdate(localtime=True)
    msg['Message-ID'] = make_msgid(domain='locana.local')
    msg.set_content(text + '\n\n—\nLocana · plateforme associative et commerces locaux\n'
                    'Cet e-mail est envoyé automatiquement. Pour toute question, utilisez la messagerie de votre espace.\n')
    return msg


def _deliver(msg):
    if config.smtp_configured():
        ctx = ssl.create_default_context()
        if config.SMTP_SECURITY == 'ssl':
            server = smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, context=ctx, timeout=20)
        else:
            server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=20)
            if config.SMTP_SECURITY == 'starttls':
                server.starttls(context=ctx)
        try:
            if config.SMTP_USER:
                server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.send_message(msg)
        finally:
            server.quit()
    else:
        config.OUTBOX_DIR.mkdir(parents=True, exist_ok=True)
        slug = re.sub(r'[^a-z0-9]+', '-', msg['Subject'].lower())[:40].strip('-')
        name = db.now().strftime('%Y%m%d-%H%M%S-') + slug + '-' + msg['Message-ID'].strip('<>').split('@')[0][-6:] + '.eml'
        (config.OUTBOX_DIR / name).write_bytes(bytes(msg))


def send(to, subject, text, wait=False):
    """Envoie en arrière-plan (ne bloque pas la requête). wait=True pour l'e-mail de test."""
    if not to:
        return True
    msg = _build(to, subject, text)

    def run():
        try:
            _deliver(msg)
            return True
        except Exception as exc:  # pas de contenu ni d'adresse dans les journaux
            print(f'[mail] échec d’envoi : {type(exc).__name__}')
            return False

    if wait:
        return run()
    threading.Thread(target=run, daemon=True).start()
    return True


# ---------- Modèles ----------
ROLE_LABEL = {'association': 'association', 'professionnel': 'professionnel'}


def admin_new_registration(conn, user_id, role, structure, commune):
    to = db.get_setting(conn, 'notification_email')
    send(to, f'Nouvelle inscription à valider : {structure}',
         f'Bonjour,\n\nUne nouvelle demande d’inscription ({ROLE_LABEL.get(role, role)}) vient d’être déposée sur Locana.\n\n'
         f'Structure : {structure}\nCommune : {commune}\n\n'
         f'Pour l’examiner et la valider : {config.PUBLIC_URL}/admin.html#inscriptions/{user_id}\n')


def member_registration_received(to, structure):
    send(to, 'Votre demande d’inscription a bien été reçue',
         f'Bonjour,\n\nNous avons bien reçu la demande d’inscription de « {structure} » sur Locana.\n'
         'Chaque profil est examiné par l’équipe avant publication. Vous recevrez un e-mail dès qu’une décision sera prise.\n\n'
         f'Vous pouvez dès maintenant vous connecter pour suivre votre demande et échanger avec l’équipe : {config.PUBLIC_URL}/connexion.html\n')


def member_decision(to, structure, decision, note, partner_code=None):
    if decision == 'approve':
        body = (f'Bonne nouvelle : le profil « {structure} » est validé.\n\n'
                + (f'Votre code partenaire : {partner_code}\n\n' if partner_code else '')
                + f'Accédez à votre espace : {config.PUBLIC_URL}/espace.html\n')
        subject = 'Votre inscription est validée'
    elif decision == 'info':
        body = ('L’équipe a besoin d’informations complémentaires pour valider votre inscription.\n\n'
                + (f'Message de l’équipe : {note}\n\n' if note else '')
                + f'Répondez depuis la messagerie de votre espace : {config.PUBLIC_URL}/espace.html#messages\n')
        subject = 'Informations complémentaires demandées'
    elif decision == 'reject':
        body = (f'Après examen, la demande d’inscription de « {structure} » n’a pas pu être acceptée.\n\n'
                + (f'Motif : {note}\n\n' if note else '')
                + f'Vos données seront supprimées automatiquement dans {config.RETENTION["refused_account_days"]} jours. '
                  'Vous pouvez aussi supprimer votre compte immédiatement depuis votre espace.\n')
        subject = 'Votre demande d’inscription'
    elif decision == 'suspend':
        body = 'Votre compte a été suspendu par l’équipe Locana.\n' + (f'\nMotif : {note}\n' if note else '')
        subject = 'Votre compte a été suspendu'
    else:
        body = f'Votre compte est de nouveau actif : {config.PUBLIC_URL}/espace.html\n'
        subject = 'Votre compte est réactivé'
    send(to, subject, 'Bonjour,\n\n' + body)


def member_new_message(to):
    send(to, 'Nouveau message de l’équipe Locana',
         f'Bonjour,\n\nVous avez reçu un nouveau message dans votre espace Locana.\n'
         f'Pour le lire et répondre : {config.PUBLIC_URL}/espace.html#messages\n')


def admin_new_message(conn, member_id, structure):
    to = db.get_setting(conn, 'notification_email')
    send(to, f'Nouveau message de {structure}',
         f'Bonjour,\n\n« {structure} » vous a écrit dans la messagerie Locana.\n'
         f'Pour répondre : {config.PUBLIC_URL}/admin.html#messages/{member_id}\n')


def password_reset(to, token):
    send(to, 'Réinitialisation de votre mot de passe',
         f'Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable {config.RESET_TOKEN_MINUTES} minutes) :\n'
         f'{config.PUBLIC_URL}/reinitialiser.html?jeton={token}\n\n'
         'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.\n')


def existing_account_attempt(to):
    send(to, 'Tentative d’inscription avec votre adresse',
         'Bonjour,\n\nQuelqu’un a tenté de créer un compte Locana avec votre adresse e-mail, qui est déjà inscrite.\n'
         f'S’il s’agit de vous, connectez-vous ici : {config.PUBLIC_URL}/connexion.html\n'
         f'Mot de passe oublié ? {config.PUBLIC_URL}/connexion.html#oubli\n')
