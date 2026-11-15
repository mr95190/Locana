"""Assemble les pages statiques à partir des gabarits partagés."""
import sys, os
ROOT = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))

NAV = [
    ('index.html', 'Accueil', 'home'),
    ('annuaire.html', 'Trouver un pro', 'annuaire'),
    ('services.html', 'Services', 'services'),
    ('agenda.html', 'Vie locale', 'agenda'),
    ('a-propos.html', 'À propos', 'a-propos'),
    ('contact.html', 'Contact', 'contact'),
]

BRAND_SVG = '''<svg class="brand__mark" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#FFB703"/><path d="M20 31 C12 26 12 15 20 9 C28 15 28 26 20 31 Z" fill="#2D6A4F"/><path d="M20 30 V16" stroke="#FFF8E7" stroke-width="1.6" stroke-linecap="round"/></svg>'''

def head(title, desc):
    return f'''<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta name="theme-color" content="#2D6A4F">
  <link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/css/fonts.css">
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="stylesheet" href="assets/css/pages.css">
  <link rel="stylesheet" href="assets/css/app.css">
  <script>document.documentElement.classList.add('js');</script>
</head>'''

def nav(page):
    links = '\n'.join(
        f'          <a class="nav__link" href="{h}"{" aria-current=\"page\"" if k == page else ""}>{l}</a>' for h, l, k in NAV)
    mlinks = '\n'.join(
        f'      <a href="{h}"{" aria-current=\"page\"" if k == page else ""}>{l} <i data-lucide="arrow-up-right"></i></a>' for h, l, k in NAV)
    return f'''  <a class="skip-link" href="#contenu">Aller au contenu</a>

  <header class="nav" id="nav">
    <div class="container">
      <div class="nav__bar">
        <a class="brand" href="index.html" aria-label="Locana, accueil">
          {BRAND_SVG}
          <span>Locana</span>
        </a>
        <nav class="nav__links" aria-label="Navigation principale">
{links}
        </nav>
        <div class="nav__actions">
          <a class="btn btn--ghost-light btn--sm" href="connexion.html">Espace membre</a>
          <a class="btn btn--solar btn--sm magnetic" href="inscription.html">S'inscrire</a>
          <button class="nav__burger" type="button" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="mobile-menu">
            <span class="nav__burger-lines" aria-hidden="true"><span></span><span></span><span></span></span>
          </button>
        </div>
      </div>
    </div>
  </header>

  <div class="mobile-menu" id="mobile-menu" aria-hidden="true">
    <nav class="mobile-menu__links" aria-label="Navigation mobile">
{mlinks}
    </nav>
    <div class="mobile-menu__actions">
      <a class="btn btn--solar btn--lg" href="inscription.html">Inscrire mon association ou mon entreprise</a>
      <a class="btn btn--ghost-light btn--lg" href="connexion.html">Espace membre</a>
    </div>
  </div>
'''

FOOTER = f'''  <footer class="footer">
    <div class="container">
      <div class="footer__grid">
        <div class="footer__about">
          <a class="brand" href="index.html" aria-label="Locana, accueil">
            {BRAND_SVG}
            <span>Locana</span>
          </a>
          <p>La plateforme indépendante qui relie associations, commerces et producteurs de proximité. Nom de travail — pilote dans l'Oise et les territoires limitrophes.</p>
        </div>
        <div>
          <p class="footer__title">Plateforme</p>
          <ul class="footer__links">
            <li><a href="annuaire.html">Trouver un pro</a></li>
            <li><a href="services.html">Services</a></li>
            <li><a href="agenda.html">Vie locale</a></li>
            <li><a href="a-propos.html">À propos</a></li>
          </ul>
        </div>
        <div>
          <p class="footer__title">Espaces</p>
          <ul class="footer__links">
            <li><a href="inscription.html?profil=association">Association</a></li>
            <li><a href="inscription.html?profil=professionnel">Professionnel</a></li>
            <li><a href="connexion.html">Se connecter</a></li>
            <li><a href="contact.html">Contact</a></li>
          </ul>
        </div>
        <div>
          <p class="footer__title">Informations</p>
          <ul class="footer__links">
            <li><a href="#">Conditions d'utilisation <span class="pill-soon">bientôt</span></a></li>
            <li><a href="confidentialite.html">Confidentialité &amp; RGPD</a></li>
            <li><a href="#">Règles de référencement <span class="pill-soon">bientôt</span></a></li>
          </ul>
        </div>
      </div>
      <div class="footer__bottom">
        <span>© 2026 Locana — prototype</span>
        <span>Sans fil public, sans commentaires, sans publicité intrusive.</span>
      </div>
      <div class="footer__word" aria-hidden="true">Locana</div>
    </div>
  </footer>

  <div class="toast" id="toast" role="status" aria-live="polite"><i data-lucide="info"></i><span class="toast__text"></span></div>
  <div class="page-veil" aria-hidden="true"></div>
'''

def scripts(extra):
    s = '''  <script src="assets/vendor/gsap.min.js"></script>
  <script src="assets/vendor/ScrollTrigger.min.js"></script>
  <script src="assets/vendor/lenis.min.js"></script>
  <script src="assets/js/icons.js"></script>
  <script src="assets/js/main.js"></script>
  <script src="assets/js/app.js"></script>
'''
    for e in extra:
        s += f'  <script src="assets/js/{e}"></script>\n'
    return s

def sky_parts(sky='', deco=True):
    deco_svg = '''
    <svg class="ph__deco" viewBox="0 0 300 220" aria-hidden="true">
      <line x1="230" y1="214" x2="230" y2="96" stroke="#FFF8E7" stroke-width="6" stroke-linecap="round"/>
      <g class="turbine" data-origin="230 96">
        <path d="M230 96 C222 66 225 44 230 26 C235 44 238 66 230 96 Z" fill="#FFF8E7" stroke="#2D6A4F" stroke-width="2"/>
        <path d="M230 96 C222 66 225 44 230 26 C235 44 238 66 230 96 Z" fill="#FFF8E7" stroke="#2D6A4F" stroke-width="2" transform="rotate(120 230 96)"/>
        <path d="M230 96 C222 66 225 44 230 26 C235 44 238 66 230 96 Z" fill="#FFF8E7" stroke="#2D6A4F" stroke-width="2" transform="rotate(240 230 96)"/>
        <circle cx="230" cy="96" r="6" fill="#2D6A4F"/>
      </g>
      <path d="M40 214 A72 72 0 0 1 184 214 Z" fill="#E9F7F0" stroke="#2D6A4F" stroke-width="3"/>
      <path d="M76 214 A36 72 0 0 1 148 214" fill="none" stroke="#2D6A4F" stroke-width="2"/>
      <line x1="112" y1="142" x2="112" y2="214" stroke="#2D6A4F" stroke-width="2"/>
      <circle cx="96" cy="200" r="12" fill="#52B788"/><circle cx="116" cy="196" r="15" fill="#3E9C6E"/><circle cx="138" cy="202" r="10" fill="#52B788"/>
      <circle cx="112" cy="138" r="6" fill="#FFB703"/>
    </svg>''' if deco else ''
    return f'''      <div class="ph__sky {sky}" aria-hidden="true"></div>
      <div class="ph__sun" aria-hidden="true"><div class="sun__rays"></div><div class="sun__halo"></div><div class="sun__ring"></div><div class="sun__core"></div></div>
      <div class="ph__hills ph__hills--back" aria-hidden="true">
        <svg viewBox="0 0 1440 280" preserveAspectRatio="none"><path d="M0 150 C180 100 360 140 540 110 C760 74 900 140 1100 104 C1260 76 1360 100 1440 92 V280 H0Z" fill="#B9E3CB"/><path d="M0 200 C240 150 460 196 700 168 C940 140 1140 190 1440 150 V280 H0Z" fill="#82CBA3"/></svg>
      </div>{deco_svg}
      <canvas class="ph__leaves" data-leaves="0.7" aria-hidden="true"></canvas>
      <div class="ph__hills ph__hills--front" aria-hidden="true">
        <svg viewBox="0 0 1440 280" preserveAspectRatio="none"><path d="M0 236 C260 200 520 244 780 222 C1040 200 1240 236 1440 214 V280 H0Z" fill="#FFF8E7"/></svg>
      </div>'''

PAGES = [
    ('services', 'services.html', 'Services — Locana', "Espaces association et professionnel, offres partenaires, déclaration des ventes et suivi des contributions : ce que Locana propose.", []),
    ('a-propos', 'a-propos.html', 'À propos — Locana', "Pourquoi Locana existe, ses principes et son déploiement progressif, en commençant par l'Oise et les territoires limitrophes.", []),
    ('contact', 'contact.html', 'Contact — Locana', "Rejoindre le pilote, recommander un professionnel ou poser une question à l'équipe Locana.", ['contact.js']),
    ('annuaire', 'annuaire.html', 'Trouver un pro — Locana', "Recherchez des commerçants, artisans et producteurs autour de votre commune, triés par distance, au-delà des frontières administratives.", ['annuaire-data.js', 'annuaire.js']),
    ('connexion', 'connexion.html', 'Connexion — Locana', "Connectez-vous à votre espace association, professionnel ou administrateur.", ['auth.js']),
    ('inscription', 'inscription.html', 'Inscription — Locana', "Inscrivez gratuitement votre association ou votre entreprise sur Locana.", ['auth.js']),
    ('reinitialiser', 'reinitialiser.html', 'Nouveau mot de passe — Locana', "Choisissez un nouveau mot de passe pour votre compte Locana.", ['auth.js']),
    ('espace', 'espace.html', 'Mon espace — Locana', "Votre espace membre Locana.", ['espace.js']),
    ('admin', 'admin.html', 'Administration — Locana', "Administration de la plateforme Locana.", ['admin.js']),
    ('confidentialite', 'confidentialite.html', 'Confidentialité — Locana', "Politique de confidentialité et protection des données personnelles sur Locana.", []),
]

ASIDE = open(os.path.join(HERE, 'auth-aside.html'), encoding='utf-8').read()
ASIDE_TEXT = {
    'connexion': ('Espace membre', 'Bon retour <em>parmi nous.</em>'),
    'inscription': ('Inscription gratuite', 'Rejoignez le réseau <em>local et solidaire.</em>'),
    'reinitialiser': ('Sécurité du compte', 'Un nouveau départ <em>en toute sécurité.</em>'),
}

for key, fname, title, desc, js in PAGES:
    body = open(os.path.join(HERE, key + '.body.html'), encoding='utf-8').read()
    if key in ASIDE_TEXT:
        body = body.replace('{{AUTH_ASIDE}}', ASIDE.replace('{{EYEBROW}}', ASIDE_TEXT[key][0]).replace('{{PITCH}}', ASIDE_TEXT[key][1]))
    body = body.replace('{{SKY}}', sky_parts()).replace('{{SKY_NOON}}', sky_parts('ph__sky--noon')).replace('{{SKY_DUSK}}', sky_parts('ph__sky--dusk')).replace('{{SKY_PLAIN}}', sky_parts('', deco=False))
    hd = head(title, desc)
    if key in ('espace', 'admin', 'reinitialiser'):
        hd = hd.replace('  <meta name="theme-color"', '  <meta name="robots" content="noindex, nofollow">\n  <meta name="theme-color"')
    html = hd + f'\n<body data-page="{key}">\n' + nav(key) + '\n  <main id="contenu">\n' + body + '\n  </main>\n\n' + FOOTER + '\n' + scripts(js) + '</body>\n</html>\n'
    open(os.path.join(ROOT, fname), 'w', encoding='utf-8').write(html)
    print('wrote', fname)
