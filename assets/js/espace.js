/* ==========================================================================
   Locana — espace membre (association / professionnel)
   ========================================================================== */
(function () {
  'use strict';
  var A = window.LocanaAPI;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var animate = !!(window.Locana && window.Locana.animate && window.gsap);
  var me = null, chat = null, pollTimer = null;

  var STATUS = {
    pending: { icon: 'hourglass', title: 'Votre demande est en cours de vérification', text: 'L’équipe examine votre profil. Vous recevrez un e-mail dès qu’une décision sera prise. Vous pouvez déjà échanger avec elle dans la messagerie.', step: 1 },
    info: { icon: 'message-square-text', title: 'L’équipe a besoin d’informations complémentaires', text: 'Consultez la messagerie et répondez pour que la vérification puisse se poursuivre.', step: 1 },
    active: { icon: 'badge-check', title: 'Votre profil est validé', text: 'Toutes les fonctions de votre espace sont accessibles.', step: 3 },
    rejected: { icon: 'circle-x', title: 'Votre demande n’a pas été acceptée', text: 'Vos données seront supprimées automatiquement 90 jours après la décision. Vous pouvez aussi supprimer votre compte dès maintenant, rubrique « Mes données ».', step: 2 }
  };
  var ROLE = { association: 'Association', professionnel: 'Professionnel' };

  A.ready(function (s) {
    if (!s.online) { $('#offline').hidden = false; return; }
    if (!s.user) { location.replace('connexion.html?suite=espace.html' + encodeURIComponent(location.hash)); return; }
    if (s.user.role === 'admin') { location.replace('admin.html'); return; }
    me = s.user;
    $('#app').hidden = false;
    render();
    route();
    window.addEventListener('hashchange', route);
    counts(s.counts);
    setInterval(function () { A.reload().then(function (st) { if (st.user) counts(st.counts); }); }, 30000);
  });

  function counts(c) {
    var el = $('[data-badge="unread"]');
    el.textContent = c.unread || 0;
    el.hidden = !c.unread;
  }

  /* ---------- Rendu des données du compte ---------- */
  function render() {
    var p = me.profile || {};
    var first = (p.contactName || '').split(' ')[0];
    var set = function (k, v) { $$('[data-me="' + k + '"]').forEach(function (el) { el.textContent = v; }); };
    set('initials', A.initials(p.structureName));
    set('structure', p.structureName || '');
    set('role', ROLE[me.role] || '');
    set('firstname', first);
    set('structureLine', (p.structureName || '') + ' · ' + (p.commune || '') + (p.postalCode ? ' (' + p.postalCode + ')' : ''));
    set('code', p.partnerCode || '');

    var st = STATUS[me.status] || STATUS.pending;
    var banner = $('#status-banner');
    banner.className = 'banner banner--' + me.status;
    banner.querySelector('.banner__icon').innerHTML = '<i data-lucide="' + st.icon + '"></i>';
    banner.querySelector('.banner__title').textContent = st.title;
    banner.querySelector('.banner__text').textContent = st.text + (me.statusNote && me.status !== 'active' ? ' Message de l’équipe : « ' + me.statusNote + ' »' : '');
    $$('#track li').forEach(function (li, i) { li.classList.toggle('is-done', i < st.step); });
    $('#track').hidden = me.status === 'rejected';
    $('#code-card').hidden = !(me.status === 'active' && p.partnerCode);

    // Formulaire de profil
    var form = $('#profile-form');
    ['structureName', 'category', 'description', 'registrationNumber', 'website', 'commune', 'postalCode', 'contactName', 'contactRole', 'phone'].forEach(function (k) {
      var el = form.querySelector('[name="' + k + '"]');
      if (el) el.value = p[k] || '';
    });
    $$('[data-only]', form).forEach(function (el) { el.hidden = el.getAttribute('data-only') !== me.role; });
    $('[data-me-input="email"]').value = me.email;

    // Mes données
    var rows = [
      ['Adresse e-mail', me.email], ['Type de compte', ROLE[me.role]], ['Structure', p.structureName], ['Commune', (p.commune || '') + ' ' + (p.postalCode || '')],
      ['Personne référente', p.contactName + (p.contactRole ? ' (' + p.contactRole + ')' : '')], ['Téléphone', p.phone || 'Non renseigné'],
      ['N° d’identification', p.registrationNumber || 'Non renseigné'], ['Compte créé le', A.date(me.createdAt)], ['Dernière connexion', A.date(me.lastLoginAt)],
      ['Consentement', me.consentAt ? 'Donné le ' + A.date(me.consentAt) + ' (version ' + me.consentVersion + ')' : '—']
    ];
    $('#data-list').innerHTML = rows.map(function (r) { return '<div><dt>' + A.esc(r[0]) + '</dt><dd>' + A.esc(r[1] || '—') + '</dd></div>'; }).join('');
    if (window.LocanaIcons) window.LocanaIcons.render(document.body);
  }

  /* ---------- Navigation par onglets (#tableau, #messages…) ---------- */
  function route() {
    var view = (location.hash || '#tableau').slice(1).split('/')[0];
    if (!$('[data-view="' + view + '"]')) view = 'tableau';
    $$('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== view; });
    $$('[data-view-link]').forEach(function (a) { if (a.getAttribute('data-view-link') === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var shown = $('[data-view="' + view + '"]');
    if (animate) gsap.fromTo(shown.children, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.06, ease: 'power2.out', clearProps: 'transform,opacity' });
    clearInterval(pollTimer);
    if (view === 'messages') openChat();
    window.scrollTo(0, 0);
  }

  /* ---------- Messagerie ---------- */
  function openChat() {
    if (!chat) {
      chat = A.Chat($('#member-chat .chat__list'), 'member',
        '<div class="chat__empty"><span class="empty__icon"><i data-lucide="message-square-text"></i></span><p>Aucun message pour l’instant. Posez votre question ou transmettez une information à l’équipe : elle est prévenue par e-mail.</p></div>');
      A.composer($('#member-chat .composer'), function (body) {
        return A.call('POST', '/api/messages', { body: body }).then(function (r) { chat.add([r.message]); });
      });
    }
    var fetchNew = function () {
      return A.call('GET', '/api/messages?after=' + chat.lastId()).then(function (r) {
        chat.add(r.messages);
        counts({ unread: 0 });
      }).catch(function () {});
    };
    fetchNew();
    pollTimer = setInterval(fetchNew, 10000);
    setTimeout(function () { $('#member-compose').focus(); }, 100);
  }

  /* ---------- Profil ---------- */
  $('#profile-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.currentTarget, btn = form.querySelector('[type=submit]');
    A.clearErrors(form);
    A.busy(btn, true);
    A.call('PUT', '/api/me/profile', A.formData(form)).then(function (r) {
      me = r.user; render();
      A.alert(form, 'Modifications enregistrées.', 'ok');
    }).catch(function (err) { A.showErrors(form, err.errors || {}, err.message); })
      .then(function () { A.busy(btn, false); });
  });

  $('#password-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.currentTarget, btn = form.querySelector('[type=submit]');
    A.clearErrors(form);
    var d = A.formData(form);
    if (d.password.length < 10) return A.showErrors(form, { password: 'Au moins 10 caractères.' });
    A.busy(btn, true);
    A.call('PUT', '/api/me/password', d).then(function () {
      form.reset();
      A.alert(form, 'Mot de passe mis à jour. Vos autres sessions ont été déconnectées.', 'ok');
    }).catch(function (err) { A.showErrors(form, err.errors || {}, err.message); })
      .then(function () { A.busy(btn, false); });
  });

  /* ---------- Code partenaire ---------- */
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-copy-code]')) {
      var code = (me.profile || {}).partnerCode;
      var done = function () { A.toast('Code ' + code + ' copié.'); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code).then(done, done); else done();
    }
    if (e.target.closest('[data-print]')) window.print();
    if (e.target.closest('[data-logout]')) A.logout();
  });

  /* ---------- Suppression du compte ---------- */
  var dlg = $('#delete-dialog'), delForm = $('#delete-form');
  $('[data-delete-open]').addEventListener('click', function () { A.clearErrors(delForm); delForm.reset(); dlg.showModal(); });
  dlg.querySelector('[data-close]').addEventListener('click', function () { dlg.close(); });
  delForm.addEventListener('submit', function (e) {
    e.preventDefault();
    A.clearErrors(delForm);
    var pw = delForm.querySelector('[name=password]').value;
    if (!pw) return A.showErrors(delForm, { password: 'Indiquez votre mot de passe.' });
    var btn = delForm.querySelector('[type=submit]');
    A.busy(btn, true);
    A.call('DELETE', '/api/me', { password: pw }).then(function () {
      location.href = 'index.html?compte=supprime';
    }).catch(function (err) { A.busy(btn, false); A.showErrors(delForm, err.errors || {}, err.message); });
  });
})();
