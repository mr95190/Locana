/* ==========================================================================
   Locana — administration : validation des inscriptions, messagerie, paramètres
   ========================================================================== */
(function () {
  'use strict';
  var A = window.LocanaAPI;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var animate = !!(window.Locana && window.Locana.animate && window.gsap);
  var icons = function (root) { if (window.LocanaIcons) window.LocanaIcons.render(root || document.body); };

  var STATUS = {
    pending: ['hourglass', 'En attente'], info: ['message-square-text', 'Infos demandées'], active: ['badge-check', 'Validé'],
    rejected: ['circle-x', 'Refusé'], suspended: ['pause', 'Suspendu']
  };
  var ROLE = { association: 'Association', professionnel: 'Professionnel' };
  var CATS = { alimentation: 'Alimentation', fleurs: 'Fleurs & saisonnier', beaute: 'Beauté & bien-être', artisanat: 'Artisanat', loisirs: 'Loisirs & culture', evenementiel: 'Événementiel', services: 'Artisans & services' };
  var ACTION = { approve: 'Validation', reject: 'Refus', info: 'Infos demandées', suspend: 'Suspension', reactivate: 'Réactivation', delete: 'Suppression', settings: 'Paramètres' };
  var filters = { status: 'todo', role: '', q: '' };
  var settings = null, threadId = null, chat = null, pollTimer = null;

  function statusPill(s) { var x = STATUS[s] || STATUS.pending; return '<span class="status status--' + s + '"><i data-lucide="' + x[0] + '"></i>' + x[1] + '</span>'; }

  A.ready(function (s) {
    if (!s.online) { $('#offline').hidden = false; return; }
    if (!s.user) { location.replace('connexion.html?suite=admin.html' + encodeURIComponent(location.hash)); return; }
    if (s.user.role !== 'admin') { location.replace('espace.html'); return; }
    $('#app').hidden = false;
    $$('[data-me="email"]').forEach(function (el) { el.textContent = s.user.email; });
    counts(s.counts);
    loadSettings();
    route();
    window.addEventListener('hashchange', route);
    setInterval(function () { A.reload().then(function (st) { if (st.user) counts(st.counts); }); }, 30000);
  });

  function counts(c) {
    ['pending', 'unread'].forEach(function (k) {
      var el = $('[data-badge="' + k + '"]');
      el.textContent = c[k] || 0;
      el.hidden = !c[k];
    });
  }

  /* ---------- Routage : #vue/identifiant?filtres ---------- */
  function route() {
    var raw = (location.hash || '#apercu').slice(1);
    var parts = raw.split('?'), seg = parts[0].split('/'), view = seg[0], id = seg[1];
    if (!$('[data-view="' + view + '"]')) view = 'apercu';
    $$('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== view; });
    $$('[data-view-link]').forEach(function (a) { if (a.getAttribute('data-view-link') === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    clearInterval(pollTimer);
    var shown = $('[data-view="' + view + '"]');
    if (animate) gsap.fromTo(shown.children, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.06, ease: 'power2.out', clearProps: 'transform,opacity' });
    if (view === 'apercu') loadStats();
    if (view === 'inscriptions') {
      var q = new URLSearchParams(parts[1] || '');
      if (q.get('statut')) filters.status = q.get('statut');
      if (q.get('type') !== null) filters.role = q.get('type') || '';
      syncFilters();
      loadMembers(id ? +id : null);
    }
    if (view === 'messages') loadInbox(id ? +id : null);
    if (view === 'journal') loadJournal();
    if (view === 'boite') loadOutbox();
    if (view === 'parametres') loadSettings();
  }

  /* ---------- Vue d'ensemble ---------- */
  function loadStats() {
    A.call('GET', '/api/admin/stats').then(function (s) {
      ['pending', 'unread', 'associations', 'professionnels'].forEach(function (k) { $('[data-stat="' + k + '"]').textContent = s[k]; });
      counts({ pending: s.pending, unread: s.unread });
      $('#recent').innerHTML = s.recent.length ? s.recent.map(row).join('') :
        '<div class="empty" style="padding:28px"><span class="empty__icon"><i data-lucide="inbox"></i></span><p>Aucune inscription pour l’instant. Les nouvelles demandes apparaîtront ici et vous serez prévenue par e-mail.</p></div>';
      icons($('#recent'));
    }).catch(fail);
  }

  function row(m) {
    return '<a class="row" href="#inscriptions/' + m.id + '" data-member="' + m.id + '">' +
      '<span class="row__icon' + (m.role === 'professionnel' ? ' row__icon--pro' : '') + '"><i data-lucide="' + (m.role === 'association' ? 'users-round' : 'store') + '"></i></span>' +
      '<span style="min-width:0"><strong>' + A.esc(m.structureName) + '</strong><small>' + A.esc(ROLE[m.role]) + ' · ' + A.esc(m.commune) + ' (' + A.esc(m.postalCode) + ')</small></span>' +
      '<span class="row__side">' + statusPill(m.status) + '<time datetime="' + m.createdAt + '">' + A.ago(m.createdAt) + '</time></span></a>';
  }

  /* ---------- Inscriptions ---------- */
  function syncFilters() {
    $$('[data-status]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-status') === filters.status)); });
    $('#f-role').value = filters.role;
  }
  $$('[data-status]').forEach(function (b) {
    b.addEventListener('click', function () { filters.status = b.getAttribute('data-status'); syncFilters(); loadMembers(null); });
  });
  $('#f-role').addEventListener('change', function (e) { filters.role = e.target.value; loadMembers(null); });
  var qTimer;
  $('#f-q').addEventListener('input', function (e) { clearTimeout(qTimer); qTimer = setTimeout(function () { filters.q = e.target.value.trim(); loadMembers(null); }, 250); });

  function loadMembers(openId) {
    var p = new URLSearchParams({ status: filters.status, role: filters.role, q: filters.q });
    A.call('GET', '/api/admin/members?' + p).then(function (r) {
      var rows = $('#rows');
      rows.innerHTML = r.members.length ? r.members.map(row).join('') :
        '<div class="empty"><span class="empty__icon"><i data-lucide="party-popper"></i></span><h3 class="empty__title">' + (filters.status === 'todo' ? 'Tout est à jour' : 'Aucun résultat') + '</h3><p>' +
        (filters.status === 'todo' ? 'Aucune inscription n’attend votre validation.' : 'Modifiez les filtres pour voir d’autres comptes.') + '</p></div>';
      icons(rows);
      if (animate) gsap.from(rows.children, { y: 12, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out', clearProps: 'transform,opacity' });
      if (openId) openMember(openId);
      else $('#review').setAttribute('data-open', 'false');
    }).catch(fail);
  }

  function openMember(id) {
    $$('#rows .row').forEach(function (r) { r.setAttribute('aria-current', String(+r.getAttribute('data-member') === id)); });
    A.call('GET', '/api/admin/members/' + id).then(renderDetail).catch(function (err) {
      $('#detail').innerHTML = '<div class="empty" style="border:0"><p>' + A.esc(err.message) + '</p></div>';
    });
  }

  function renderDetail(r) {
    var m = r.member, p = m.profile || {};
    var info = [
      ['Type', ROLE[m.role] + (p.category ? ' · ' + (CATS[p.category] || p.category) : '')],
      ['Commune', p.commune + ' (' + p.postalCode + ')'],
      ['Référent', p.contactName + (p.contactRole ? ' — ' + p.contactRole : '')],
      ['E-mail', m.email], ['Téléphone', p.phone || '—'], ['N° RNA / SIREN / SIRET', p.registrationNumber || '—'],
      ['Site internet', p.website || '—'], ['Code partenaire', p.partnerCode || '—'],
      ['Inscription', A.date(m.createdAt)], ['Consentement RGPD', m.consentAt ? A.date(m.consentAt) + ' (v. ' + m.consentVersion + ')' : '—']
    ];
    var actions = [];
    if (m.status === 'pending' || m.status === 'info') {
      actions.push('<button class="btn btn--solar" type="button" data-decide="approve"><i data-lucide="badge-check"></i>Valider</button>');
      actions.push('<button class="btn btn--ghost" type="button" data-open-decision="info"><i data-lucide="message-square-text"></i>Demander des infos</button>');
      actions.push('<button class="btn btn--danger-ghost" type="button" data-open-decision="reject"><i data-lucide="circle-x"></i>Refuser</button>');
    } else if (m.status === 'active') {
      actions.push('<button class="btn btn--ghost" type="button" data-open-decision="suspend"><i data-lucide="pause"></i>Suspendre</button>');
    } else if (m.status === 'suspended' || m.status === 'rejected') {
      actions.push('<button class="btn" type="button" data-decide="reactivate"><i data-lucide="rotate-ccw"></i>' + (m.status === 'rejected' ? 'Valider finalement' : 'Réactiver') + '</button>');
    }
    actions.push('<a class="btn btn--ghost" href="#messages/' + m.id + '"><i data-lucide="send"></i>Écrire</a>');
    var hist = r.history.length ? r.history.map(function (h) {
      return '<li><time datetime="' + h.at + '">' + A.date(h.at) + '</time><span><strong>' + A.esc(ACTION[h.action] || h.action) + '</strong>' + (h.note ? ' — ' + A.esc(h.note) : '') + (h.admin ? ' <small style="color:var(--ink-soft)">(' + A.esc(h.admin) + ')</small>' : '') + '</span></li>';
    }).join('') : '<li><span style="color:var(--ink-soft)">Aucune décision pour l’instant.</span></li>';

    var d = $('#detail');
    d.innerHTML =
      '<div class="detail__head"><div><button class="btn btn--ghost btn--sm back-btn" type="button" data-back-list><i data-lucide="arrow-left"></i>Liste</button>' +
      '<h2 class="detail__name">' + A.esc(p.structureName) + '</h2></div>' + statusPill(m.status) + '</div>' +
      (p.description ? '<p style="color:var(--ink-soft);white-space:pre-wrap">' + A.esc(p.description) + '</p>' : '') +
      (m.statusNote ? '<p class="callout callout--light"><i data-lucide="info"></i><span>Dernière note : ' + A.esc(m.statusNote) + '</span></p>' : '') +
      '<dl class="data-list">' + info.map(function (x) { return '<div><dt>' + A.esc(x[0]) + '</dt><dd>' + A.esc(x[1]) + '</dd></div>'; }).join('') + '</dl>' +
      '<div class="actions">' + actions.join('') + '</div>' +
      '<form class="decision" id="decision-form" hidden novalidate><label class="field"><span class="field__label" data-decision-label></span>' +
      '<textarea class="field__input field__input--area" name="note" maxlength="1000" style="min-height:100px"></textarea><span class="field__error"><i data-lucide="info"></i><span></span></span></label>' +
      '<p style="font-size:.82rem;color:var(--ink-soft)" data-decision-hint></p>' +
      '<div class="actions"><button class="btn" type="submit" data-decision-submit></button><button class="btn btn--ghost" type="button" data-cancel-decision>Annuler</button></div></form>' +
      '<h3 class="panel__title" style="font-size:1rem"><i data-lucide="scroll-text"></i>Historique</h3><ul class="history">' + hist + '</ul>' +
      '<button class="btn btn--danger-ghost btn--sm" type="button" data-delete-member style="justify-self:start"><i data-lucide="trash-2"></i>Supprimer définitivement le compte</button>';
    d.setAttribute('data-member', m.id);
    icons(d);
    $('#review').setAttribute('data-open', 'true');
    if (animate) gsap.fromTo(d.children, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.03, ease: 'power2.out', clearProps: 'transform,opacity' });
  }

  var DECISION_UI = {
    info: ['Quelles informations manquent ?', 'Le message est envoyé au membre dans sa messagerie et par e-mail.', 'Envoyer la demande'],
    reject: ['Motif du refus', 'Le membre est prévenu par e-mail. Ses données seront supprimées automatiquement dans 90 jours.', 'Confirmer le refus'],
    suspend: ['Motif de la suspension (facultatif)', 'Le membre est déconnecté et ne peut plus se connecter.', 'Suspendre le compte']
  };

  $('#detail').addEventListener('click', function (e) {
    var id = +$('#detail').getAttribute('data-member');
    var t;
    if ((t = e.target.closest('[data-decide]'))) decide(id, t.getAttribute('data-decide'), '', t);
    if ((t = e.target.closest('[data-open-decision]'))) {
      var kind = t.getAttribute('data-open-decision'), f = $('#decision-form'), ui = DECISION_UI[kind];
      f.hidden = false; f.setAttribute('data-kind', kind);
      $('[data-decision-label]', f).textContent = ui[0];
      $('[data-decision-hint]', f).textContent = ui[1];
      $('[data-decision-submit]', f).textContent = ui[2];
      $('[data-decision-submit]', f).className = 'btn' + (kind === 'reject' ? ' btn--danger' : '');
      f.querySelector('textarea').focus();
    }
    if (e.target.closest('[data-cancel-decision]')) $('#decision-form').hidden = true;
    if (e.target.closest('[data-back-list]')) { $('#review').setAttribute('data-open', 'false'); location.hash = 'inscriptions'; }
    if (e.target.closest('[data-delete-member]')) {
      confirmBox('Supprimer définitivement ce compte ?', 'Le profil, les messages et les sessions seront effacés immédiatement. Le journal ne conservera qu’une mention anonyme.', 'Supprimer').then(function (ok) {
        if (ok) decide(id, 'delete', '', null);
      });
    }
  });

  $('#detail').addEventListener('submit', function (e) {
    if (e.target.id !== 'decision-form') return;
    e.preventDefault();
    var f = e.target, kind = f.getAttribute('data-kind'), note = f.querySelector('textarea').value.trim();
    A.clearErrors(f);
    if (kind !== 'suspend' && !note) return A.showErrors(f, { note: 'Ce champ est obligatoire.' });
    decide(+$('#detail').getAttribute('data-member'), kind, note, f.querySelector('[type=submit]'));
  });

  function decide(id, decision, note, btn) {
    A.busy(btn, true);
    A.call('POST', '/api/admin/members/' + id + '/decision', { decision: decision, note: note }).then(function (r) {
      var msg = { approve: 'Inscription validée : le membre est prévenu par e-mail.', info: 'Demande d’informations envoyée.', reject: 'Refus enregistré et notifié.', suspend: 'Compte suspendu.', reactivate: 'Compte réactivé.', delete: 'Compte supprimé.' }[decision];
      A.toast(msg);
      A.reload().then(function (st) { counts(st.counts); });
      if (r.deleted) { $('#detail').innerHTML = '<div class="empty" style="border:0"><p>Compte supprimé.</p></div>'; loadMembers(null); return; }
      renderDetail(r);
      loadMembers(id);
    }).catch(fail).then(function () { A.busy(btn, false); });
  }

  /* ---------- Messagerie ---------- */
  function loadInbox(openId) {
    loadConvList(openId);
    fillNewConv();
    if (openId) openThread(openId); else { $('#inbox').setAttribute('data-open', 'false'); threadId = null; }
  }

  function loadConvList(openId) {
    return A.call('GET', '/api/admin/conversations').then(function (r) {
      var list = $('#conv-list');
      list.innerHTML = r.conversations.length ? r.conversations.map(function (c) {
        return '<a class="conv" href="#messages/' + c.memberId + '" data-conv="' + c.memberId + '"' + (c.memberId === openId ? ' aria-current="true"' : '') + '>' +
          '<strong>' + A.esc(c.structureName) + '</strong><span>' + (c.unread ? '<span class="count">' + c.unread + '</span>' : '<time>' + A.ago(c.last.createdAt) + '</time>') + '</span>' +
          '<small>' + (c.last.sender === 'admin' ? 'Vous : ' : '') + A.esc(c.last.body.slice(0, 90)) + '</small></a>';
      }).join('') : '<div class="empty" style="border:0;padding:24px"><span class="empty__icon"><i data-lucide="message-square-text"></i></span><p>Aucune conversation. Les messages des membres apparaîtront ici.</p></div>';
      icons(list);
    }).catch(fail);
  }

  function fillNewConv() {
    A.call('GET', '/api/admin/members?status=all').then(function (r) {
      var sel = $('#new-conv');
      sel.innerHTML = '<option value="">Écrire à un membre…</option>' + r.members.map(function (m) {
        return '<option value="' + m.id + '">' + A.esc(m.structureName) + ' — ' + A.esc(m.commune) + '</option>';
      }).join('');
    });
  }
  $('#new-conv').addEventListener('change', function (e) { if (e.target.value) { location.hash = 'messages/' + e.target.value; e.target.value = ''; } });

  function openThread(id) {
    threadId = id;
    $('#inbox').setAttribute('data-open', 'true');
    var box = $('#admin-chat');
    if (!chat) {
      chat = A.Chat($('.chat__list', box), 'admin', '<div class="chat__empty"><span class="empty__icon"><i data-lucide="send"></i></span><p>Aucun message échangé. Écrivez le premier : le membre sera prévenu par e-mail.</p></div>');
      A.composer($('.composer', box), function (body) {
        return A.call('POST', '/api/admin/conversations/' + threadId, { body: body }).then(function (r) { chat.add([r.message]); loadConvList(threadId); });
      });
    }
    chat.reset();
    $('.composer', box).hidden = false;
    var fetchNew = function (first) {
      return A.call('GET', '/api/admin/conversations/' + id + '?after=' + chat.lastId()).then(function (r) {
        if (first) {
          $('[data-thread="name"]').textContent = r.member.structureName;
          $('[data-thread="meta"]').textContent = ROLE[r.member.role] + ' · ' + r.member.commune;
          $('[data-thread="initials"]').textContent = A.initials(r.member.structureName);
          var link = $('[data-thread="profile"]'); link.hidden = false; link.href = '#inscriptions/' + id;
        }
        if (threadId === id) chat.add(r.messages);
        if (first) A.reload().then(function (st) { counts(st.counts); });
      }).catch(fail);
    };
    fetchNew(true);
    pollTimer = setInterval(function () { fetchNew(false); }, 10000);
    setTimeout(function () { $('#admin-compose').focus(); }, 100);
  }
  $('[data-back]').addEventListener('click', function () { location.hash = 'messages'; });

  /* ---------- Paramètres ---------- */
  function loadSettings() {
    A.call('GET', '/api/admin/settings').then(function (s) {
      settings = s;
      $$('[data-setting="notificationEmail"]').forEach(function (el) { el.textContent = s.notificationEmail; });
      $('#settings-form [name=notificationEmail]').value = s.notificationEmail;
      $('#dev-mail-note').hidden = s.smtp.configured;
      $('[data-outbox-link]').hidden = s.smtp.configured;
      $('#smtp-status').innerHTML = s.smtp.configured
        ? '<span class="status status--active"><i data-lucide="check"></i>Envoi réel activé</span><br><br>Serveur : ' + A.esc(s.smtp.host) + '<br>Expéditeur : ' + A.esc(s.smtp.from)
        : '<span class="status status--pending"><i data-lucide="hourglass"></i>Mode développement</span><br><br>Les e-mails ne partent pas encore : ils sont enregistrés dans la boîte d’envoi. Pour les envoyer réellement, renseignez un serveur SMTP dans le fichier <code>.env</code> (voir <code>.env.example</code>) puis relancez le serveur.';
      var labels = { refused_account_days: ['Demandes refusées', ' jours'], inactive_account_years: ['Comptes inactifs', ' ans'], outbox_days: ['Copies d’e-mails', ' jours'], audit_log_years: ['Journal de modération', ' ans'] };
      $('#retention').innerHTML = Object.keys(labels).map(function (k) { return '<div><span>' + labels[k][0] + '</span><strong>' + s.retention[k] + labels[k][1] + '</strong></div>'; }).join('');
      icons($('#smtp-status'));
    }).catch(fail);
  }

  $('#settings-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.currentTarget, btn = f.querySelector('[type=submit]');
    A.clearErrors(f);
    var email = f.querySelector('[name=notificationEmail]').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return A.showErrors(f, { notificationEmail: 'Indiquez une adresse e-mail valide.' });
    A.busy(btn, true);
    A.call('PUT', '/api/admin/settings', { notificationEmail: email }).then(function () {
      A.alert(f, 'Adresse enregistrée : les prochaines notifications partiront vers ' + email + '.', 'ok');
      loadSettings();
    }).catch(function (err) { A.showErrors(f, err.errors || {}, err.message); }).then(function () { A.busy(btn, false); });
  });

  $('[data-test-mail]').addEventListener('click', function (e) {
    var btn = e.currentTarget, f = $('#settings-form');
    A.busy(btn, true);
    A.call('POST', '/api/admin/settings/test-email', {}).then(function (r) {
      A.alert(f, r.mode === 'smtp' ? 'E-mail de test envoyé : vérifiez la boîte de réception (et les indésirables).' : 'Mode développement : l’e-mail de test a été enregistré dans la boîte d’envoi.', 'ok');
    }).catch(function (err) { A.alert(f, err.message, 'error'); }).then(function () { A.busy(btn, false); });
  });

  /* ---------- Journal & boîte d'envoi ---------- */
  function loadJournal() {
    A.call('GET', '/api/admin/audit').then(function (r) {
      $('#journal').innerHTML = r.entries.length ? r.entries.map(function (x) {
        return '<li><time datetime="' + x.at + '">' + A.date(x.at) + ' · ' + A.time(x.at) + '</time><strong>' + A.esc(ACTION[x.action] || x.action) + '</strong><span>' +
          (x.targetId ? '<a class="link" href="#inscriptions/' + x.targetId + '">' + A.esc(x.label) + '</a>' : A.esc(x.label || '')) + (x.note ? ' — ' + A.esc(x.note) : '') +
          (x.admin ? ' <small style="color:var(--ink-soft)">par ' + A.esc(x.admin) + '</small>' : ' <small style="color:var(--ink-soft)">automatique</small>') + '</span></li>';
      }).join('') : '<li><span style="color:var(--ink-soft)">Aucune décision enregistrée.</span></li>';
    }).catch(fail);
  }

  function loadOutbox() {
    A.call('GET', '/api/admin/outbox').then(function (r) {
      var box = $('#outbox');
      if (!r.enabled) { box.innerHTML = '<div class="empty"><p>L’envoi réel est activé : il n’y a pas de boîte d’envoi locale.</p></div>'; return; }
      box.innerHTML = r.emails.length ? r.emails.map(function (m) {
        return '<details class="mail"><summary><strong>' + A.esc(m.subject) + '</strong><span style="font-size:.8rem;color:var(--ink-soft)">' + A.esc(m.date) + '</span><small>À : ' + A.esc(m.to) + '</small></summary><pre>' + A.esc(m.body) + '</pre></details>';
      }).join('') : '<div class="empty"><span class="empty__icon"><i data-lucide="inbox"></i></span><p>Aucun e-mail pour l’instant.</p></div>';
      icons(box);
    }).catch(fail);
  }

  /* ---------- Divers ---------- */
  function confirmBox(title, text, okLabel) {
    var dlg = $('#confirm-dialog');
    $('#cf-title').textContent = title; $('#cf-text').textContent = text; $('#cf-ok').textContent = okLabel;
    dlg.showModal();
    return new Promise(function (resolve) {
      dlg.addEventListener('close', function h() { dlg.removeEventListener('close', h); resolve(dlg.returnValue === 'ok'); });
    });
  }
  function fail(err) {
    if (err.status === 401) { location.replace('connexion.html?suite=admin.html'); return; }
    A.toast(err.message);
  }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-logout]')) A.logout(); });
})();
