/* ==========================================================================
   Locana — Contact : choix du profil, validation, état de confirmation
   ========================================================================== */
(function () {
  'use strict';
  var form = document.getElementById('contact-form');
  if (!form) return;
  var L = window.Locana || {};
  var animate = !!(L.animate && window.gsap);
  var card = document.getElementById('form-card');
  var routes = Array.prototype.slice.call(document.querySelectorAll('[data-route]'));
  var structureLabel = form.querySelector('[data-structure-label]');
  var LABELS = { association: "Nom de l'association", professionnel: "Nom de l'entreprise", collectivite: 'Commune ou organisme', autre: 'Structure ou média' };
  var submitted = false;

  function setRoute(key) {
    routes.forEach(function (r) { r.setAttribute('aria-pressed', String(r.getAttribute('data-route') === key)); });
    form.elements.profil.value = key;
    structureLabel.textContent = LABELS[key] || LABELS.autre;
    if (animate) gsap.fromTo(structureLabel, { opacity: 0, y: -4 }, { opacity: 1, y: 0, duration: 0.3 });
  }
  routes.forEach(function (r) { r.addEventListener('click', function () { setRoute(r.getAttribute('data-route')); }); });

  // Préremplissage depuis l'URL (?profil=professionnel&objet=recommander)
  var p = new URLSearchParams(location.search);
  if (LABELS[p.get('profil')]) setRoute(p.get('profil'));
  var objets = { recommander: 'Recommander un professionnel', pilote: 'Rejoindre le pilote', evenement: 'Proposer un événement' };
  if (objets[p.get('objet')]) form.elements.objet.value = objets[p.get('objet')];

  // Compteur de caractères
  var counter = form.querySelector('[data-counter]');
  form.elements.message.addEventListener('input', function () { counter.textContent = this.value.length; });

  // Validation
  var rules = {
    nom: function (v) { return v.trim().length >= 2; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    structure: function (v) { return v.trim().length >= 2; },
    commune: function (v) { return v.trim().length >= 2; },
    objet: function (v) { return !!v; },
    message: function (v) { return v.trim().length >= 20; },
    rgpd: function (v, el) { return el.checked; }
  };
  function check(name) {
    var el = form.elements[name];
    var ok = rules[name](el.value, el);
    var field = el.closest('.field');
    field.classList.toggle('is-invalid', !ok);
    el.setAttribute('aria-invalid', String(!ok));
    var err = field.querySelector('.field__error');
    if (err) {
      if (!err.id) err.id = 'err-' + name;
      if (!ok) el.setAttribute('aria-describedby', err.id); else el.removeAttribute('aria-describedby');
    }
    return ok;
  }
  Object.keys(rules).forEach(function (name) {
    var el = form.elements[name];
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'blur', function () { if (submitted) check(name); });
    el.addEventListener('input', function () { if (submitted && el.closest('.field').classList.contains('is-invalid')) check(name); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    submitted = true;
    var firstBad = null;
    Object.keys(rules).forEach(function (name) { if (!check(name) && !firstBad) firstBad = form.elements[name]; });
    if (firstBad) {
      firstBad.focus();
      if (animate) gsap.fromTo(firstBad.closest('.field'), { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
      if (L.toast) L.toast('Quelques champs sont à compléter.');
      return;
    }
    card.classList.add('is-sent');
    var ok = card.querySelector('.form-success');
    ok.focus();
    if (animate) {
      var ring = ok.querySelector('.success__ring'), tick = ok.querySelector('.success__check');
      [ring, tick].forEach(function (path) {
        var len = path.getTotalLength();
        gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.out', delay: path === tick ? 0.35 : 0 });
      });
      gsap.from(Array.prototype.slice.call(ok.children).slice(1), { y: 16, opacity: 0, duration: 0.54, stagger: 0.12, ease: 'power2.out', delay: 0.3 });
    }
    if (L.refresh) L.refresh();
  });

  card.querySelector('[data-reset-form]').addEventListener('click', function () {
    var current = form.elements.profil.value;
    form.reset();
    form.elements.profil.value = current;
    submitted = false;
    counter.textContent = '0';
    Array.prototype.forEach.call(form.querySelectorAll('.is-invalid'), function (f) { f.classList.remove('is-invalid'); });
    setRoute(form.elements.profil.value || 'association');
    card.classList.remove('is-sent');
    form.elements.nom.focus();
    if (L.refresh) L.refresh();
  });
})();
