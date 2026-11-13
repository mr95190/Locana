/* ==========================================================================
   Locana — Trouver un pro
   Recherche par commune et rayon, filtres, tri par distance, carte SVG, fiche.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.LOCANA_DATA;
  var L = window.Locana || {};
  if (!D || !document.getElementById('results')) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var animate = !!(L.animate && window.gsap);
  var toast = L.toast || function (m) { window.alert(m); };
  var renderIcons = function (root) { if (window.LocanaIcons) window.LocanaIcons.render(root); };
  var CAT = {}; D.categories.forEach(function (c) { CAT[c.id] = c; });

  var state = { q: '', city: null, radius: 30, cat: '', partner: false, national: true, sort: 'distance', view: 'list' };

  /* ---------- Utilitaires ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'\-]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function km(a, b) {
    var R = 6371, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function fmtKm(d) { return (d < 10 ? d.toFixed(1) : Math.round(d).toString()).replace('.', ',') + ' km'; }
  function initials(name) {
    var w = name.replace(/['’]/g, ' ').split(/\s+/).filter(function (x) { return x.length > 2 && !/^(des|les|du|de|la|le|et)$/i.test(x); });
    return ((w[0] || name)[0] + (w[1] ? w[1][0] : '')).toUpperCase();
  }
  function findCommune(text) {
    var t = norm(text.replace(/\(.*?\)/g, ''));
    var cp = (text.match(/\b\d{5}\b/) || [])[0];
    if (cp) { var byCp = D.communes.filter(function (c) { return c.cp === cp; })[0]; if (byCp) return byCp; }
    if (!t) return null;
    var exact = D.communes.filter(function (c) { return norm(c.n) === t; })[0];
    if (exact) return exact;
    return D.communes.filter(function (c) { return norm(c.n).indexOf(t) === 0; })[0] || null;
  }

  /* ---------- Éléments ---------- */
  var form = $('#dir-search');
  var inQ = form.elements.q, inCity = form.elements.ville, inRadius = form.elements.rayon;
  var errBox = $('#city-error');
  var results = $('#results'), countEl = $('#dir-count'), resetBtn = $('#dir-reset');
  var layout = $('#dir-layout');
  var svg = $('#dmap-svg'), mapEmpty = $('#dmap-empty'), mapOverlay = $('#dmap-overlay'), tip = $('#dmap-tip');
  var dialog = $('#sheet'), sheetContent = $('#sheet-content');

  $('#communes').innerHTML = D.communes.map(function (c) { return '<option value="' + esc(c.n + ' (' + c.cp + ')') + '"></option>'; }).join('');

  /* ---------- Lecture de l'URL ---------- */
  (function readUrl() {
    var p = new URLSearchParams(location.search);
    state.q = p.get('q') || '';
    var r = parseInt(p.get('rayon'), 10);
    if ([10, 20, 30, 50, 100].indexOf(r) > -1) state.radius = r;
    var cat = p.get('categorie');
    if (cat && CAT[cat]) state.cat = cat;
    state.partner = p.get('partenaires') === '1';
    var v = p.get('ville');
    if (v) {
      var c = findCommune(v);
      if (c) state.city = c; else showError('« ' + v + ' » ne fait pas partie des communes de la démonstration. Essayez Senlis, Beauvais ou Cergy.');
      inCity.value = c ? c.n + ' (' + c.cp + ')' : v;
    }
    inQ.value = state.q;
    inRadius.value = String(state.radius);
    $('#f-partner').checked = state.partner;
  })();

  function writeUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.city && state.city.cp) p.set('ville', state.city.n);
    p.set('rayon', state.radius);
    if (state.cat) p.set('categorie', state.cat);
    if (state.partner) p.set('partenaires', '1');
    history.replaceState(null, '', location.pathname + '?' + p.toString() + location.hash);
  }

  function showError(msg) {
    if (!msg) { errBox.hidden = true; inCity.removeAttribute('aria-invalid'); return; }
    $('span', errBox).textContent = msg;
    errBox.hidden = false;
    inCity.setAttribute('aria-invalid', 'true');
  }

  /* ---------- Filtrage ---------- */
  function matchesQuery(p) {
    if (!state.q) return true;
    var hay = norm([p.name, p.town, p.desc, p.subs.join(' '), p.products.join(' '), p.cats.map(function (c) { return CAT[c].full; }).join(' ')].join(' '));
    return norm(state.q).split(' ').every(function (tok) {
      if (tok.length > 4 && /[sx]$/.test(tok)) tok = tok.slice(0, -1);
      return hay.indexOf(tok) > -1;
    });
  }

  function compute(ignoreCat) {
    var center = state.city;
    var out = [];
    D.pros.forEach(function (p) {
      if (!ignoreCat && state.cat && p.cats.indexOf(state.cat) < 0) return;
      if (state.partner && !p.offer) return;
      if (!matchesQuery(p)) return;
      var item = { p: p, d: null, far: false };
      if (center) {
        item.d = km(center, p);
        var inRadius = item.d <= state.radius;
        if (p.type === 'service') {
          if (!inRadius || item.d > p.zone) return;
        } else if (!inRadius) {
          if (!(p.national && state.national)) return;
          item.far = true;
        }
      }
      out.push(item);
    });
    var byName = function (a, b) { return a.p.name.localeCompare(b.p.name, 'fr'); };
    out.sort(function (a, b) {
      if (state.sort === 'name') return byName(a, b);
      if (state.sort === 'offer') return ((b.p.offer ? b.p.offer.asso : -1) - (a.p.offer ? a.p.offer.asso : -1)) || byName(a, b);
      if (a.far !== b.far) return a.far ? 1 : -1;
      if (a.d != null && b.d != null) return a.d - b.d;
      return byName(a, b);
    });
    return out;
  }

  /* ---------- Barre de catégories ---------- */
  function renderCatbar() {
    var base = compute(true);
    var count = function (id) { return base.filter(function (it) { return !id || it.p.cats.indexOf(id) > -1; }).length; };
    var html = '<button class="catbtn" type="button" data-cat="" aria-pressed="' + (!state.cat) + '"><i data-lucide="layers"></i>Toutes <span class="catbtn__n">' + count('') + '</span></button>';
    D.categories.forEach(function (c) {
      html += '<button class="catbtn" type="button" data-cat="' + c.id + '" aria-pressed="' + (state.cat === c.id) + '"><i data-lucide="' + c.icon + '"></i>' + esc(c.label) + ' <span class="catbtn__n">' + count(c.id) + '</span></button>';
    });
    var bar = $('#catbar');
    bar.innerHTML = html;
    renderIcons(bar);
  }

  /* ---------- Cartes de résultats ---------- */
  function card(it) {
    var p = it.p, c = CAT[p.cats[0]];
    var otherDept = state.city && state.city.d && p.dept !== state.city.d;
    var zone = p.type === 'service'
      ? '<i data-lucide="radar"></i>Intervient dans un rayon de ' + p.zone + ' km'
      : (p.national ? '<i data-lucide="truck"></i>Livraison France entière' : '<i data-lucide="radar"></i>Livraison ou retrait dans ' + p.zone + ' km');
    var offer = p.offer
      ? '<span class="pro__offer"><i data-lucide="ticket-percent"></i>' + (p.offer.family ? '−' + p.offer.family + ' % familles · ' : '') + p.offer.asso + ' % reversés à l’association</span>'
      : '';
    var dist = it.d == null ? '' :
      '<span class="pro__dist">' + fmtKm(it.d) + '<small>' + (it.far ? 'livre partout en France' : 'à vol d’oiseau') + '</small></span>';
    return '<article class="pro" data-id="' + p.id + '">' +
      '<div class="pro__logo" style="background:' + c.color[0] + ';color:' + c.color[1] + '" aria-hidden="true">' + esc(initials(p.name)) + '</div>' +
      '<div class="pro__main">' +
        '<h3 class="pro__name"><button type="button" data-open="' + p.id + '">' + esc(p.name) + '</button></h3>' +
        '<p class="pro__place"><i data-lucide="map-pin"></i>' + esc(p.town) + ' (' + esc(p.dept) + ')' + (otherDept ? ' <span class="badge badge--registered">Département voisin</span>' : '') + '</p>' +
        '<div class="pro__cats">' + p.subs.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') + '</div>' +
        '<p class="pro__zone">' + zone + '</p>' + offer +
      '</div>' +
      '<div class="pro__side">' + dist +
        '<div class="pro__badges"><span class="badge badge--verified"><i data-lucide="badge-check"></i>Vérifié</span>' +
        (p.offer ? '<span class="badge badge--partner"><i data-lucide="handshake"></i>Partenaire</span>' : '') + '</div>' +
      '</div>' +
    '</article>';
  }

  function emptyState() {
    var hasFilters = state.cat || state.partner || state.q;
    return '<div class="empty">' +
      '<span class="empty__icon"><i data-lucide="search"></i></span>' +
      '<h3 class="empty__title">Aucun professionnel ne correspond</h3>' +
      '<p>' + (state.city ? 'Élargissez le rayon de recherche' + (hasFilters ? ' ou retirez un filtre' : '') + '. ' : '') + 'Vous connaissez un professionnel qui devrait figurer ici&nbsp;? Recommandez-le.</p>' +
      '<div class="empty__actions">' +
        (state.city && state.radius < 100 ? '<button class="btn" type="button" data-widen><i data-lucide="radar"></i>Passer à ' + nextRadius() + ' km</button>' : '') +
        (hasFilters ? '<button class="btn btn--ghost" type="button" data-clear>Retirer les filtres</button>' : '') +
        '<a class="btn btn--solar" href="contact.html?objet=recommander"><i data-lucide="message-square-quote"></i>Recommander un pro</a>' +
      '</div></div>';
  }
  function nextRadius() { var r = [10, 20, 30, 50, 100]; return r[Math.min(r.indexOf(state.radius) + 1, r.length - 1)]; }

  function summary(list) {
    var near = list.filter(function (i) { return !i.far; }).length, far = list.length - near;
    var plural = function (n, w) { return n + ' ' + w + (n > 1 ? 's' : ''); };
    if (!state.city) return '<b>' + plural(list.length, 'professionnel') + '</b> · indiquez une commune pour trier par distance';
    var txt = '<b>' + plural(near, 'professionnel') + '</b> dans un rayon de ' + state.radius + ' km autour de ' + esc(state.city.n);
    if (far) txt += ' · <b>' + far + '</b> autre' + (far > 1 ? 's' : '') + ' livrant partout en France';
    return txt;
  }

  var renderTimer;
  function render(withSkeleton) {
    var list = compute(false);
    renderCatbar();
    countEl.innerHTML = summary(list);
    resetBtn.hidden = !(state.cat || state.partner || state.q || !state.national);
    writeUrl();

    var paint = function () {
      results.innerHTML = list.length ? list.map(card).join('') : emptyState();
      renderIcons(results);
      if (animate) {
        gsap.from($$('.pro, .empty', results).slice(0, 8), { y: 16, opacity: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out', clearProps: 'transform,opacity' });
      }
      renderMap(list);
      if (L.refresh) L.refresh();
    };
    clearTimeout(renderTimer);
    if (withSkeleton && animate) {
      results.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
      renderTimer = setTimeout(paint, 280);
    } else paint();
  }

  /* ---------- Carte ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  function renderMap(list) {
    svg.innerHTML = '';
    tip.classList.remove('is-visible');
    if (!state.city) { mapEmpty.hidden = false; mapOverlay.hidden = true; return; }
    mapEmpty.hidden = true;
    var c = state.city, R = state.radius, S = R * 1.18;
    var cosLat = Math.cos(c.lat * Math.PI / 180);
    var proj = function (pt) { return { x: (pt.lng - c.lng) * cosLat * 111.32, y: -(pt.lat - c.lat) * 110.57 }; };
    svg.setAttribute('viewBox', [-S, -S, 2 * S, 2 * S].join(' '));
    var fs = S / 24, k = S / 380;
    var h = '';
    [R, R / 2].forEach(function (r) {
      h += '<circle class="dmap__ring" cx="0" cy="0" r="' + r + '"/>';
      h += '<text class="dmap__ringlabel" x="0" y="' + (-r - fs * 0.5) + '" font-size="' + fs + '" text-anchor="middle">' + (r % 1 ? r.toFixed(0) : r) + ' km</text>';
    });
    D.communes.forEach(function (t) {
      if (t === c) return;
      var q = proj(t);
      if (Math.abs(q.x) > S * 0.95 || Math.abs(q.y) > S * 0.95) return;
      h += '<circle class="dmap__town" cx="' + q.x + '" cy="' + q.y + '" r="' + (S * 0.008) + '"/>' +
           '<text class="dmap__townlabel" x="' + (q.x + S * 0.015) + '" y="' + (q.y + fs * 0.3) + '" font-size="' + (fs * 0.85) + '">' + esc(t.n) + '</text>';
    });
    var near = list.filter(function (i) { return !i.far; });
    near.slice().reverse().forEach(function (it) {
      var q = proj(it.p);
      var fill = it.p.offer ? '#2D6A4F' : '#219EBC';
      h += '<g class="dmap__pin" data-pin="' + it.p.id + '" transform="translate(' + q.x + ' ' + q.y + ')">' +
             '<g class="pin-inner" transform="scale(' + k + ')"><path class="pin-body" d="M0 0 C-12 -16 -16 -22 -16 -30 A16 16 0 0 1 16 -30 C16 -22 12 -16 0 0Z" fill="' + fill + '"/><circle cx="0" cy="-30" r="6" fill="#FFF8E7"/></g>' +
           '</g>';
    });
    h += '<circle class="dmap__pulse" cx="0" cy="0" r="' + (S * 0.03) + '" fill="#FFB703" fill-opacity=".35"/>' +
         '<circle cx="0" cy="0" r="' + (S * 0.018) + '" fill="#FFB703" stroke="#FFF8E7" stroke-width="' + (S * 0.008) + '"/>';
    svg.innerHTML = h;

    var far = list.length - near.length;
    mapOverlay.hidden = false;
    mapOverlay.innerHTML = '<span><i class="lg-dot" style="background:#FFB703"></i> ' + esc(c.n) + '</span><span><i class="lg-dot" style="background:#2D6A4F"></i> Partenaire <i class="lg-dot" style="background:#219EBC;margin-left:8px"></i> Vérifié</span>' +
      (far ? '<span>+' + far + ' hors carte</span>' : '');

    if (animate && near.length) {
      gsap.from($$('.pin-inner', svg), { scale: 0, transformOrigin: '50% 100%', duration: 0.5, stagger: 0.04, ease: 'back.out(2.2)' });
    }
    if (animate) {
      gsap.from($$('.dmap__ring', svg), { scale: 0.6, opacity: 0, transformOrigin: '50% 50%', duration: 0.7, stagger: 0.1, ease: 'power3.out' });
      gsap.to($('.dmap__pulse', svg), { scale: 2.4, opacity: 0, transformOrigin: '50% 50%', duration: 1.8, repeat: -1, ease: 'power1.out' });
    }
  }

  function hot(id, on) {
    var pin = $('[data-pin="' + id + '"]', svg), cardEl = $('.pro[data-id="' + id + '"]', results);
    if (pin) pin.classList.toggle('is-hot', on);
    if (cardEl) cardEl.classList.toggle('is-hot', on);
  }

  svg.addEventListener('pointerover', function (e) {
    var pin = e.target.closest('[data-pin]');
    if (!pin) return;
    var id = pin.getAttribute('data-pin');
    var it = compute(false).filter(function (i) { return i.p.id === id; })[0];
    if (!it) return;
    hot(id, true);
    var r = pin.getBoundingClientRect(), m = $('#dmap').getBoundingClientRect();
    tip.textContent = it.p.name + ' · ' + fmtKm(it.d);
    tip.style.left = (r.left + r.width / 2 - m.left) + 'px';
    tip.style.top = (r.top - m.top) + 'px';
    tip.classList.add('is-visible');
  });
  svg.addEventListener('pointerout', function (e) {
    var pin = e.target.closest('[data-pin]');
    if (!pin) return;
    hot(pin.getAttribute('data-pin'), false);
    tip.classList.remove('is-visible');
  });
  svg.addEventListener('click', function (e) {
    var pin = e.target.closest('[data-pin]');
    if (pin) openSheet(pin.getAttribute('data-pin'), null);
  });
  results.addEventListener('pointerover', function (e) {
    var c = e.target.closest('.pro'); if (c) hot(c.getAttribute('data-id'), true);
  });
  results.addEventListener('pointerout', function (e) {
    var c = e.target.closest('.pro'); if (c && !c.contains(e.relatedTarget)) hot(c.getAttribute('data-id'), false);
  });

  /* ---------- Fiche professionnelle ---------- */
  function openSheet(id, opener) {
    var p = D.pros.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var c = CAT[p.cats[0]];
    var d = state.city ? km(state.city, p) : null;
    var zone = p.type === 'service'
      ? 'Intervient dans un rayon de ' + p.zone + ' km autour de ' + p.town + '.'
      : (p.national ? 'Livraison partout en France. Retrait ou livraison locale dans ' + p.zone + ' km.' : 'Livraison ou retrait dans un rayon de ' + p.zone + ' km autour de ' + p.town + '.');
    var o = p.offer;
    sheetContent.innerHTML =
      '<div class="sheet__cover"><svg viewBox="0 0 760 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0 40 C140 10 260 50 400 30 S640 10 760 30 V90 H0Z" fill="#82CBA3"/><path d="M0 70 C180 50 360 80 540 62 S700 55 760 60 V90 H0Z" fill="#FFF8E7"/></svg>' +
        '<button class="sheet__close" type="button" data-close aria-label="Fermer la fiche"><i data-lucide="x"></i></button></div>' +
      '<div class="sheet__body">' +
        '<div class="sheet__head"><div class="sheet__logo" style="background:' + c.color[0] + ';color:' + c.color[1] + '" aria-hidden="true">' + esc(initials(p.name)) + '</div>' +
          '<div><h2 class="sheet__name" id="sheet-name">' + esc(p.name) + '</h2>' +
          '<div class="sheet__meta"><span><i data-lucide="map-pin"></i> ' + esc(p.town) + ' (' + esc(p.dept) + ')</span>' +
          (d != null ? '<span class="distance"><i data-lucide="navigation"></i>' + fmtKm(d) + '</span>' : '') +
          '<span class="badge badge--verified"><i data-lucide="badge-check"></i>Vérifié</span>' + (o ? '<span class="badge badge--partner"><i data-lucide="handshake"></i>Partenaire associatif</span>' : '') + '</div></div></div>' +
        '<p>' + esc(p.desc) + '</p>' +
        '<div class="sheet__grid">' +
          '<div style="display:grid;gap:16px">' +
            '<div class="sheet__block"><span class="sheet__label">Produits et services</span><ul class="sheet__list">' + p.products.map(function (x) { return '<li><i data-lucide="check"></i>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
            '<div class="sheet__block"><span class="sheet__label">Catégories</span><div class="pro__cats">' + p.cats.map(function (k) { return '<span>' + esc(CAT[k].full) + '</span>'; }).join('') + p.subs.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') + '</div></div>' +
            '<div class="sheet__block"><span class="sheet__label">Zone de livraison ou d’intervention</span><p style="font-size:.92rem">' + zone + '</p></div>' +
          '</div>' +
          (o
            ? '<div class="offerbox"><span class="sheet__label" style="color:var(--solar)">Offre partenaire</span>' +
                '<div class="offerbox__rates"><div class="offerbox__rate"><strong>' + (o.family ? '−' + o.family + ' %' : '—') + '</strong><span>Réduction familles</span></div>' +
                '<div class="offerbox__rate"><strong>' + o.asso + ' %</strong><span>Reversés à l’association</span></div></div>' +
                '<div class="offerbox__cond"><span><b>Valable jusqu’au</b> ' + esc(o.until) + '</span><span>' + esc(o.terms) + '</span><span>Présentez le code de votre association lors de la commande.</span></div>' +
                '<p style="font-size:.78rem;opacity:.7">La rémunération éventuelle de la plateforme est distincte et affichée à part.</p></div>'
            : '<div class="sheet__block" style="align-content:center;text-align:center;justify-items:center"><span class="empty__icon" style="width:56px;height:56px"><i data-lucide="handshake"></i></span><strong>Pas encore d’offre partenaire</strong><p style="font-size:.88rem;color:var(--ink-soft)">Ce professionnel est vérifié mais ne propose pas encore d’offre aux associations.</p></div>') +
        '</div>' +
        '<div class="sheet__actions">' +
          '<button class="btn" type="button" data-demo="Fiche de démonstration : les coordonnées fictives ne sont pas affichées."><i data-lucide="phone"></i>Contacter</button>' +
          '<button class="btn btn--solar" type="button" data-demo="Les demandes de partenariat seront disponibles depuis l’espace association."><i data-lucide="send"></i>Proposer un partenariat</button>' +
          '<button class="btn btn--ghost" type="button" data-share="' + p.id + '"><i data-lucide="link"></i>Copier le lien</button>' +
        '</div>' +
        '<p class="demo-note" style="margin-top:0"><i data-lucide="info"></i><span>Professionnel fictif, présenté pour la démonstration.</span></p>' +
      '</div>';
    renderIcons(sheetContent);
    dialog._opener = opener;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    sheetContent.scrollTop = 0;
    if (L.lenis) L.lenis.stop();
    history.replaceState(null, '', location.pathname + location.search + '#pro=' + p.id);
    // On anime le contenu, jamais la <dialog> elle-même : GSAP la déplacerait
    // brièvement dans le DOM pour mesurer sa transformation, ce qui ferme le mode modal.
    if (animate) gsap.fromTo(sheetContent, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' });
  }

  function closeSheet() {
    var done = function () {
      if (dialog.open) dialog.close();
      if (L.lenis) L.lenis.start();
      history.replaceState(null, '', location.pathname + location.search);
      if (dialog._opener) dialog._opener.focus();
    };
    if (animate) gsap.to(sheetContent, { opacity: 0, y: 24, duration: 0.25, ease: 'power2.in', onComplete: done });
    else done();
  }

  dialog.addEventListener('cancel', function (e) { e.preventDefault(); closeSheet(); });
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog || e.target.closest('[data-close]')) { closeSheet(); return; }
    var demo = e.target.closest('[data-demo]');
    if (demo) toast(demo.getAttribute('data-demo'));
    var share = e.target.closest('[data-share]');
    if (share) {
      var url = location.origin + location.pathname + '#pro=' + share.getAttribute('data-share');
      var ok = function () { toast('Lien de la fiche copié.'); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(ok, ok); else ok();
    }
  });

  results.addEventListener('click', function (e) {
    var open = e.target.closest('[data-open]');
    if (open) { openSheet(open.getAttribute('data-open'), open); return; }
    if (e.target.closest('[data-widen]')) { state.radius = nextRadius(); inRadius.value = String(state.radius); render(true); return; }
    if (e.target.closest('[data-clear]')) { clearFilters(); }
  });

  /* ---------- Contrôles ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    state.q = inQ.value.trim();
    state.radius = parseInt(inRadius.value, 10);
    var v = inCity.value.trim();
    if (!v) { state.city = null; showError(''); }
    else if (!(state.city && state.city.cp == null && /^Ma position/.test(v))) {
      var c = findCommune(v);
      if (!c) {
        showError('« ' + v + ' » ne fait pas partie des communes de la démonstration. Essayez Senlis, Beauvais ou Cergy.');
        inCity.focus();
        return;
      }
      showError('');
      state.city = c;
      inCity.value = c.n + ' (' + c.cp + ')';
    }
    render(true);
    if (L.scrollTo && window.innerWidth < 1025) L.scrollTo($('.dir'));
  });
  inRadius.addEventListener('change', function () { if (state.city) { state.radius = parseInt(inRadius.value, 10); render(true); } });
  inCity.addEventListener('change', function () {
    var c = findCommune(inCity.value);
    if (c && inCity.value.indexOf('(') > -1) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit'));
  });

  $('#catbar').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]');
    if (!b) return;
    state.cat = b.getAttribute('data-cat');
    render(true);
  });
  $('#f-partner').addEventListener('change', function (e) { state.partner = e.target.checked; render(true); });
  $('#f-national').addEventListener('change', function (e) { state.national = e.target.checked; render(true); });
  $('#f-sort').addEventListener('change', function (e) { state.sort = e.target.value; render(false); });

  function clearFilters() {
    state.cat = ''; state.partner = false; state.national = true; state.q = '';
    inQ.value = ''; $('#f-partner').checked = false; $('#f-national').checked = true;
    render(true);
  }
  resetBtn.addEventListener('click', clearFilters);

  $$('.viewtoggle button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.view = b.getAttribute('data-view');
      layout.setAttribute('data-view', state.view);
      $$('.viewtoggle button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      if (L.refresh) L.refresh();
    });
  });

  $('#geo-btn').addEventListener('click', function () {
    if (!navigator.geolocation) { showError('La géolocalisation n’est pas disponible sur ce navigateur.'); return; }
    var btn = this;
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false;
      state.city = { n: 'votre position', lat: pos.coords.latitude, lng: pos.coords.longitude, d: null, cp: null };
      inCity.value = 'Ma position';
      showError('');
      render(true);
    }, function () {
      btn.disabled = false;
      showError('Position indisponible. Saisissez plutôt une commune ou un code postal.');
    }, { timeout: 8000, maximumAge: 600000 });
  });

  /* ---------- Démarrage ---------- */
  render(false);
  var deep = (location.hash.match(/^#pro=([\w-]+)/) || [])[1];
  if (deep) setTimeout(function () { openSheet(deep, null); }, animate ? 900 : 0);
})();
