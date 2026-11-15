/* ==========================================================================
   Locana — client de l'API (session, CSRF, formulaires, navigation connectée)
   ========================================================================== */
(function () {
  'use strict';

  var state = { user: null, csrf: null, counts: {}, online: true, loaded: false };
  var waiters = [];

  function call(method, path, body) {
    var headers = { 'Accept': 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (state.csrf) headers['X-CSRF-Token'] = state.csrf;
    return fetch(path, { method: method, headers: headers, credentials: 'same-origin', body: body !== undefined ? JSON.stringify(body) : undefined })
      .then(function (r) {
        var isJson = (r.headers.get('Content-Type') || '').indexOf('application/json') > -1;
        return (isJson ? r.json() : r.text()).then(function (data) {
          if (!r.ok) {
            var err = new Error((data && data.error) || 'Une erreur est survenue.');
            err.status = r.status; err.errors = data && data.errors;
            throw err;
          }
          return data;
        });
      }, function () {
        var err = new Error('Le serveur Locana ne répond pas. Vérifiez qu’il est bien lancé (python server.py).');
        err.status = 0;
        throw err;
      });
  }

  function loadSession() {
    return call('GET', '/api/session').then(function (s) {
      state.user = s.user; state.csrf = s.csrf || null; state.counts = s.counts || {}; state.online = true;
    }, function () {
      state.online = false; state.user = null;
    }).then(function () {
      state.loaded = true;
      updateNav();
      waiters.forEach(function (fn) { fn(state); });
      waiters = [];
      return state;
    });
  }

  function ready(fn) { state.loaded ? fn(state) : waiters.push(fn); }

  function logout() {
    return call('POST', '/api/logout', {}).catch(function () {}).then(function () { location.href = 'index.html'; });
  }

  /* Navigation : « Espace membre » devient « Mon espace » une fois connecté */
  function updateNav() {
    if (!state.user) return;
    var isAdmin = state.user.role === 'admin';
    var target = isAdmin ? 'admin.html' : 'espace.html';
    var label = isAdmin ? 'Administration' : 'Mon espace';
    document.querySelectorAll('a[href="connexion.html"]').forEach(function (a) {
      if (a.closest('.auth')) return;
      a.setAttribute('href', target);
      a.textContent = label;
    });
    document.querySelectorAll('.nav__actions a[href^="inscription.html"], .mobile-menu__actions a[href^="inscription.html"]').forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = a.className.replace('magnetic', ''); b.textContent = 'Déconnexion';
      b.addEventListener('click', logout);
      a.replaceWith(b);
    });
  }

  /* Formulaires : erreurs par champ, alerte globale, bouton en cours */
  function clearErrors(form) {
    form.querySelectorAll('.field.is-invalid').forEach(function (f) { f.classList.remove('is-invalid'); });
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    var alert = form.querySelector('.form-alert');
    if (alert) alert.classList.remove('is-visible');
  }

  function showErrors(form, errors, message) {
    var first = null;
    Object.keys(errors || {}).forEach(function (name) {
      var input = form.querySelector('[name="' + name + '"]');
      if (!input) return;
      var field = input.closest('.field');
      if (field) {
        field.classList.add('is-invalid');
        var err = field.querySelector('.field__error');
        if (err) {
          if (!err.id) err.id = 'err-' + name + '-' + Math.random().toString(36).slice(2, 7);
          err.querySelector('span') ? (err.querySelector('span').textContent = errors[name]) : (err.textContent = errors[name]);
          input.setAttribute('aria-describedby', err.id);
        }
      }
      input.setAttribute('aria-invalid', 'true');
      if (!first) first = input;
    });
    if (message) alertBox(form, message, 'error');
    if (first) first.focus();
    return first;
  }

  function alertBox(form, message, kind) {
    var alert = form.querySelector('.form-alert');
    if (!alert) return;
    alert.className = 'form-alert form-alert--' + (kind || 'error') + ' is-visible';
    alert.querySelector('span').textContent = message;
    alert.setAttribute('role', kind === 'ok' ? 'status' : 'alert');
  }

  function busy(btn, on) {
    if (!btn) return;
    btn.classList.toggle('is-loading', on);
    btn.disabled = !!on;
  }

  function formData(form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else out[el.name] = el.value;
    });
    return out;
  }

  /* Dates en français */
  var fmtDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  var fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
  var fmtShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  function date(iso) { return iso ? fmtDay.format(new Date(iso)) : '—'; }
  function time(iso) { return iso ? fmtTime.format(new Date(iso)) : ''; }
  function ago(iso) {
    if (!iso) return '';
    var d = new Date(iso), diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'à l’instant';
    if (diff < 3600) return 'il y a ' + Math.floor(diff / 60) + ' min';
    if (diff < 86400 && new Date().getDate() === d.getDate()) return fmtTime.format(d);
    if (diff < 172800) return 'hier';
    return fmtShort.format(d);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function initials(s) {
    var w = String(s || '?').replace(/['’]/g, ' ').split(/\s+/).filter(function (x) { return x.length > 2; });
    return ((w[0] || s || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase();
  }

  /* Afficher/masquer le mot de passe */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('.pw-toggle');
    if (!t) return;
    var input = t.parentElement.querySelector('input');
    var show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    t.setAttribute('aria-pressed', String(show));
    t.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  });

  /* Indicateur de robustesse */
  document.addEventListener('input', function (e) {
    var input = e.target;
    if (!input.matches('[data-meter]')) return;
    var meter = document.getElementById(input.getAttribute('data-meter'));
    if (!meter) return;
    var v = input.value, score = 0;
    if (v.length >= 10) score++;
    if (v.length >= 14) score++;
    if (/[a-z]/i.test(v) && /\d/.test(v)) score++;
    if (/[^a-z0-9]/i.test(v)) score++;
    var bar = meter.querySelector('span');
    bar.style.transform = 'scaleX(' + Math.max(0.08, score / 4) + ')';
    bar.style.backgroundColor = ['#B42318', '#C1440E', '#FFB703', '#52B788', '#2D6A4F'][score];
  });

  /* Conversation : affichage des bulles + zone de saisie */
  function Chat(list, mine, emptyHtml) {
    var lastId = 0, lastDay = '';
    var dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    function reset() { list.innerHTML = ''; lastId = 0; lastDay = ''; }
    function add(messages) {
      if (!messages.length) {
        if (!lastId && emptyHtml) list.innerHTML = emptyHtml;
        if (window.LocanaIcons) window.LocanaIcons.render(list);
        return;
      }
      if (!lastId) list.innerHTML = '';
      var nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
      messages.forEach(function (m) {
        if (m.id <= lastId) return;
        var d = new Date(m.createdAt), key = d.toDateString();
        if (key !== lastDay) {
          lastDay = key;
          var sep = document.createElement('p');
          sep.className = 'chat__day';
          sep.textContent = key === new Date().toDateString() ? 'Aujourd’hui' : dayFmt.format(d);
          list.appendChild(sep);
        }
        var b = document.createElement('div');
        b.className = 'bubble ' + (m.sender === mine ? 'bubble--me' : 'bubble--them');
        var p = document.createElement('div');
        p.textContent = m.body;
        var t = document.createElement('time');
        t.dateTime = m.createdAt;
        t.textContent = time(m.createdAt) + (m.sender === mine && m.readAt ? ' · lu' : '');
        b.appendChild(p); b.appendChild(t);
        list.appendChild(b);
        if (window.gsap && window.Locana && window.Locana.animate) gsap.from(b, { y: 10, opacity: 0, duration: 0.3, ease: 'power2.out' });
        lastId = m.id;
      });
      if (nearBottom || messages.length > 1) list.scrollTop = list.scrollHeight;
    }
    return { reset: reset, add: add, lastId: function () { return lastId; } };
  }

  function composer(form, onSend) {
    var ta = form.querySelector('textarea');
    function fit() { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; }
    ta.addEventListener('input', fit);
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = ta.value.trim();
      if (!body) return ta.focus();
      var btn = form.querySelector('[type=submit]');
      busy(btn, true);
      onSend(body).then(function () { ta.value = ''; fit(); }, function (err) {
        if (window.Locana && window.Locana.toast) window.Locana.toast(err.message);
      }).then(function () { busy(btn, false); ta.focus(); });
    });
  }

  window.LocanaAPI = {
    Chat: Chat, composer: composer,
    state: state, call: call, ready: ready, reload: loadSession, logout: logout,
    clearErrors: clearErrors, showErrors: showErrors, alert: alertBox, busy: busy, formData: formData,
    date: date, time: time, ago: ago, esc: esc, initials: initials,
    toast: function (m) { if (window.Locana && window.Locana.toast) window.Locana.toast(m); }
  };

  loadSession();
})();
