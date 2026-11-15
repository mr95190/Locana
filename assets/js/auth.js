/* ==========================================================================
   Locana — connexion, mot de passe oublié, réinitialisation, inscription
   ========================================================================== */
(function () {
  'use strict';
  var A = window.LocanaAPI;
  if (!A) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var animate = !!(window.Locana && window.Locana.animate && window.gsap);
  var params = new URLSearchParams(location.search);

  function safeNext(def) {
    var n = params.get('suite');
    return n && /^[a-z0-9\-]+\.html(#[\w\-\/]*)?$/.test(n) ? n : def;
  }
  function fadeIn(el) { if (animate) gsap.fromTo(el, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' }); }

  /* ---------- Connexion ---------- */
  var login = $('#login-form');
  if (login) {
    A.ready(function (s) {
      if (s.user) location.replace(safeNext(s.user.role === 'admin' ? 'admin.html' : 'espace.html'));
      if (!s.online) A.alert(login, 'Le serveur Locana ne répond pas : lancez « python server.py » dans le dossier du site.', 'error');
    });
    function show(view) {
      $$('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== view; });
      var shown = $('[data-view="' + view + '"]');
      fadeIn(shown);
      var first = shown.querySelector('input'); if (first) first.focus();
    }
    $$('[data-show]').forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-show')); }); });
    if (location.hash === '#oubli') show('forgot');

    login.addEventListener('submit', function (e) {
      e.preventDefault();
      A.clearErrors(login);
      var d = A.formData(login), errors = {};
      if (!d.email) errors.email = 'Indiquez votre adresse e-mail.';
      if (!d.password) errors.password = 'Indiquez votre mot de passe.';
      if (Object.keys(errors).length) return A.showErrors(login, errors);
      var btn = login.querySelector('[type=submit]');
      A.busy(btn, true);
      A.call('POST', '/api/login', { email: d.email, password: d.password }).then(function (r) {
        A.state.csrf = r.csrf;
        location.href = safeNext(r.redirect);
      }).catch(function (err) {
        A.busy(btn, false);
        A.showErrors(login, {}, err.message);
        login.querySelector('[name=password]').value = '';
      });
    });

    var forgot = $('#forgot-form');
    forgot.addEventListener('submit', function (e) {
      e.preventDefault();
      A.clearErrors(forgot);
      var email = forgot.querySelector('[name=email]').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return A.showErrors(forgot, { email: 'Indiquez une adresse e-mail valide.' });
      var btn = forgot.querySelector('[type=submit]');
      A.busy(btn, true);
      A.call('POST', '/api/password/forgot', { email: email }).then(function () {
        A.busy(btn, false);
        A.alert(forgot, 'Si un compte existe pour cette adresse, un lien de réinitialisation vient de lui être envoyé (valable 60 minutes).', 'ok');
      }).catch(function (err) { A.busy(btn, false); A.alert(forgot, err.message, 'error'); });
    });
  }

  /* ---------- Réinitialisation ---------- */
  var reset = $('#reset-form');
  if (reset) {
    var token = params.get('jeton');
    if (!token) A.alert(reset, 'Lien incomplet. Refaites une demande depuis la page de connexion.', 'error');
    reset.addEventListener('submit', function (e) {
      e.preventDefault();
      A.clearErrors(reset);
      var d = A.formData(reset), errors = {};
      if ((d.password || '').length < 10) errors.password = 'Au moins 10 caractères.';
      else if (d.password !== d.confirm) errors.confirm = 'Les deux mots de passe ne correspondent pas.';
      if (Object.keys(errors).length) return A.showErrors(reset, errors);
      var btn = reset.querySelector('[type=submit]');
      A.busy(btn, true);
      A.call('POST', '/api/password/reset', { token: token, password: d.password }).then(function () {
        A.busy(btn, false);
        reset.reset();
        A.alert(reset, 'Mot de passe enregistré. Vous pouvez vous connecter.', 'ok');
        setTimeout(function () { location.href = 'connexion.html'; }, 1800);
      }).catch(function (err) { A.busy(btn, false); A.showErrors(reset, err.errors || {}, err.message); });
    });
  }

  /* ---------- Inscription en 4 étapes ---------- */
  var reg = $('#reg-form');
  if (!reg) return;
  var current = 1;
  var STEP_FIELDS = {
    1: ['role'],
    2: ['structureName', 'category', 'description', 'registrationNumber', 'website', 'commune', 'postalCode'],
    3: ['contactName', 'contactRole', 'email', 'phone', 'password', 'confirm'],
    4: ['consent']
  };
  var LABELS = {
    structureName: 'Nom', category: 'Catégorie', description: 'Description', registrationNumber: 'N° RNA / SIREN / SIRET', website: 'Site internet',
    commune: 'Commune', postalCode: 'Code postal', contactName: 'Personne référente', contactRole: 'Fonction', email: 'E-mail', phone: 'Téléphone'
  };
  var CATS = { alimentation: 'Alimentation & produits gourmands', fleurs: 'Fleurs, plantes & saisonnier', beaute: 'Beauté & bien-être', artisanat: 'Artisanat & créations', loisirs: 'Loisirs, sport & culture', evenementiel: 'Événementiel & fournitures', services: 'Artisans & services' };

  A.ready(function (s) {
    if (s.user) location.replace(s.user.role === 'admin' ? 'admin.html' : 'espace.html');
    if (!s.online) A.alert(reg, 'Le serveur Locana ne répond pas : lancez « python server.py » dans le dossier du site.', 'error');
  });

  function role() { var r = reg.querySelector('[name=role]:checked'); return r ? r.value : null; }
  function applyRole() {
    var r = role() || 'association', idx = r === 'association' ? 0 : 1;
    $$('[data-role-text]', reg).forEach(function (el) { el.innerHTML = el.getAttribute('data-role-text').split('|')[idx]; });
    $$('[data-only]', reg).forEach(function (el) { el.hidden = el.getAttribute('data-only') !== r; });
  }
  var pre = params.get('profil');
  if (pre === 'association' || pre === 'professionnel') { reg.querySelector('[name=role][value="' + pre + '"]').checked = true; }
  applyRole();
  $$('[name=role]', reg).forEach(function (r) { r.addEventListener('change', applyRole); });

  function validate(step) {
    var d = A.formData(reg), e = {}, r = role();
    if (step === 1 && !r) e.role = 'Choisissez le type de profil à inscrire.';
    if (step === 2) {
      if (!d.structureName.trim()) e.structureName = 'Indiquez le nom.';
      if (r === 'professionnel' && !d.category) e.category = 'Choisissez votre catégorie principale.';
      if (r === 'association' && !d.description.trim()) e.description = 'Décrivez en quelques mots l’objet de l’association.';
      var num = d.registrationNumber.replace(/\s/g, '').toUpperCase();
      if (num && !/^(W\d{9}|\d{9}|\d{14})$/.test(num)) e.registrationNumber = 'Format attendu : W + 9 chiffres, 9 ou 14 chiffres.';
      if (!d.commune.trim()) e.commune = 'Indiquez la commune.';
      if (!/^\d{5}$/.test(d.postalCode.trim())) e.postalCode = 'Code postal à 5 chiffres.';
    }
    if (step === 3) {
      if (!d.contactName.trim()) e.contactName = 'Indiquez le prénom et le nom.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = 'Indiquez une adresse e-mail valide, par exemple nom@domaine.fr.';
      if (d.phone && !/^\+?\d{9,15}$/.test(d.phone.replace(/[\s.\-()]/g, ''))) e.phone = 'Numéro de téléphone invalide.';
      if (d.password.length < 10) e.password = 'Au moins 10 caractères.';
      else if (/^\d+$/.test(d.password) || /^[a-zA-Z]+$/.test(d.password)) e.password = 'Mélangez lettres et chiffres (ou symboles).';
      else if (d.password !== d.confirm) e.confirm = 'Les deux mots de passe ne correspondent pas.';
    }
    if (step === 4 && !d.consent) e.consent = 'Votre accord est nécessaire pour créer le compte.';
    return e;
  }

  function go(step) {
    current = step;
    $$('.step', reg).forEach(function (s) { s.hidden = +s.getAttribute('data-step') !== step; });
    $$('.stepper li').forEach(function (li, i) {
      li.classList.toggle('is-done', i + 1 < step);
      li.classList.toggle('is-current', i + 1 === step);
      if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    if (step === 4) buildRecap();
    var el = $('.step[data-step="' + step + '"]', reg);
    fadeIn(el);
    var first = el.querySelector('input:not([type=radio]), select, textarea');
    if (first && step !== 4) first.focus({ preventScroll: true });
    var top = $('#reg').getBoundingClientRect().top + window.scrollY - 100;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: animate ? 'smooth' : 'auto' });
  }

  function buildRecap() {
    var d = A.formData(reg), r = role();
    var rows = [['Profil', r === 'association' ? 'Association' : 'Entreprise / professionnel']];
    STEP_FIELDS[2].concat(STEP_FIELDS[3]).forEach(function (k) {
      if (k === 'password' || k === 'confirm' || !LABELS[k]) return;
      if (k === 'category' && r !== 'professionnel') return;
      var v = k === 'category' ? CATS[d[k]] : d[k];
      if (v && String(v).trim()) rows.push([LABELS[k], String(v).trim()]);
    });
    $('#recap').innerHTML = rows.map(function (x) { return '<div><dt>' + A.esc(x[0]) + '</dt><dd>' + A.esc(x[1]) + '</dd></div>'; }).join('');
  }

  reg.addEventListener('click', function (e) {
    if (e.target.closest('[data-next]')) {
      A.clearErrors(reg);
      var errs = validate(current);
      if (Object.keys(errs).length) return A.showErrors(reg, errs);
      go(current + 1);
    }
    if (e.target.closest('[data-prev]')) { A.clearErrors(reg); go(current - 1); }
  });
  // Entrée dans un champ = étape suivante (sauf zone de texte)
  reg.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && current < 4 && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); var b = $('.step[data-step="' + current + '"] [data-next]', reg); if (b) b.click(); }
  });

  reg.addEventListener('submit', function (e) {
    e.preventDefault();
    A.clearErrors(reg);
    var errs = validate(4);
    if (Object.keys(errs).length) return A.showErrors(reg, errs);
    var d = A.formData(reg);
    delete d.confirm;
    d.role = role();
    d.consent = true;
    var btn = reg.querySelector('[type=submit]');
    A.busy(btn, true);
    A.call('POST', '/api/register', d).then(function () {
      reg.hidden = true;
      $$('.stepper li').forEach(function (li) { li.classList.add('is-done'); li.classList.remove('is-current'); });
      var done = $('#reg-done');
      done.hidden = false;
      done.focus();
      fadeIn(done);
      if (animate) {
        $$('.success__ring, .success__check', done).forEach(function (p, i) {
          var len = p.getTotalLength();
          gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.8, delay: i * 0.3, ease: 'power2.out' });
        });
      }
    }).catch(function (err) {
      A.busy(btn, false);
      if (err.errors) {
        // revenir à la première étape qui contient une erreur
        for (var s = 1; s <= 4; s++) {
          if (STEP_FIELDS[s].some(function (f) { return err.errors[f]; })) { go(s); break; }
        }
        setTimeout(function () { A.showErrors(reg, err.errors, err.message); }, 50);
      } else A.alert(reg, err.message, 'error');
    });
  });
})();
