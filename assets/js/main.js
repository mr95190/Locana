/* ==========================================================================
   Locana — animations & interactions
   GSAP + ScrollTrigger + Lenis. Seuls transform et opacity sont animés
   (plus le tracé SVG des lianes).
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGSAP = !!(window.gsap && window.ScrollTrigger);
  var animate = hasGSAP && !reduceMotion;
  var lenis = null;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------------------------------------------------------------
     Utilitaires
     --------------------------------------------------------------- */
  var euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  var num2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var pct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

  var toastTimer;
  function toast(message) {
    var el = $('#toast');
    if (!el) return;
    $('.toast__text', el).textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 4200);
  }

  /* ---------------------------------------------------------------
     Smooth scroll (Lenis)
     --------------------------------------------------------------- */
  function initLenis() {
    if (!animate || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function scrollToTarget(target) {
    if (lenis) lenis.scrollTo(target, { offset: -40, duration: 1.4 });
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id.length < 2) { e.preventDefault(); return; }
    var target = null;
    try { target = document.querySelector(id); } catch (err) { return; } // routes internes (#messages/12…)
    if (!target) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(target);
  });

  /* ---------------------------------------------------------------
     Navigation : burger, masquage au scroll
     --------------------------------------------------------------- */
  var burger = $('.nav__burger');
  var menu = $('#mobile-menu');

  function openMenu() {
    document.body.classList.add('nav-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Fermer le menu');
    menu.setAttribute('aria-hidden', 'false');
    if (lenis) lenis.stop();
    if (animate) {
      gsap.fromTo($$('.mobile-menu__links a, .mobile-menu__actions .btn'),
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.54, stagger: 0.06, ease: 'power3.out', delay: 0.08 });
    }
  }
  function closeMenu() {
    if (!document.body.classList.contains('nav-open')) return;
    document.body.classList.remove('nav-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Ouvrir le menu');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
  }
  if (burger) {
    burger.addEventListener('click', function () {
      document.body.classList.contains('nav-open') ? closeMenu() : openMenu();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  function initNavHide() {
    var nav = $('#nav');
    if (!nav) return;
    if (hasGSAP) {
      ScrollTrigger.create({
        start: 0, end: 'max',
        onUpdate: function (self) {
          var hide = self.direction === 1 && self.scroll() > 240 && !document.body.classList.contains('nav-open');
          nav.classList.toggle('is-hidden', hide);
          document.documentElement.classList.toggle('nav-hidden', hide);
        }
      });
    }
    nav.addEventListener('focusin', function () { nav.classList.remove('is-hidden'); });
  }

  /* ---------------------------------------------------------------
     Transitions de page (fade + slide 300 ms)
     --------------------------------------------------------------- */
  function initPageTransitions() {
    var veil = $('.page-veil');
    function leave(url) {
      var go = function () { window.location.href = url; };
      if (!animate || !veil) return go();
      gsap.fromTo(veil, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', onComplete: go });
    }
    function navigate(url) {
      if (location.protocol === 'file:') return leave(url);
      fetch(url, { method: 'HEAD' }).then(function (r) {
        if (r.ok) leave(url);
        else toast('Cette page est en cours de conception : elle arrive dans la prochaine étape.');
      }).catch(function () { leave(url); });
    }
    window.LocanaNavigate = navigate;

    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var url = new URL(href, location.href);
      if (url.origin !== location.origin && location.protocol !== 'file:') return;
      if (url.pathname === location.pathname && url.hash) return;
      if (href === '#') { e.preventDefault(); return; }
      e.preventDefault();
      closeMenu();
      navigate(url.href);
    });

    window.addEventListener('pageshow', function () {
      if (veil && hasGSAP) gsap.set(veil, { opacity: 0, y: 24 });
    });
  }

  /* ---------------------------------------------------------------
     Recherche du hero
     --------------------------------------------------------------- */
  function initSearch() {
    var form = $('#hero-search');
    if (!form) return;
    var q = form.elements.q, city = form.elements.ville;

    $$('[data-fill]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        q.value = chip.getAttribute('data-fill');
        if (animate) gsap.fromTo(q, { opacity: 0.2 }, { opacity: 1, duration: 0.4 });
        (city.value ? form.querySelector('button[type=submit]') : city).focus();
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!city.value.trim()) {
        city.focus();
        if (animate) gsap.fromTo(city.closest('.search__field'), { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
        toast('Indiquez une commune ou un code postal pour lancer la recherche.');
        return;
      }
      var params = new URLSearchParams({ q: q.value.trim(), ville: city.value.trim(), rayon: form.elements.rayon.value });
      window.LocanaNavigate('annuaire.html?' + params.toString());
    });
  }

  /* ---------------------------------------------------------------
     Boutons d'aperçu, filtres agenda
     --------------------------------------------------------------- */
  function initPreviewButtons() {
    $$('[data-toast]').forEach(function (b) {
      b.addEventListener('click', function () { toast(b.getAttribute('data-toast')); });
    });
    var filters = $$('.agenda__filters .chip');
    filters.forEach(function (chip) {
      chip.addEventListener('click', function () {
        filters.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
      });
    });
  }

  /* ---------------------------------------------------------------
     Code partenaire : copie + QR d'aperçu
     --------------------------------------------------------------- */
  function initPartnerCode() {
    var code = $('#pass-code');
    var btn = $('#copy-code');
    if (btn && code) {
      btn.addEventListener('click', function () {
        var value = code.textContent.trim();
        var done = function () {
          var label = $('span', btn);
          label.textContent = 'Code copié';
          toast('Code ' + value + ' copié dans le presse-papiers.');
          if (animate) gsap.fromTo(btn, { scale: 0.94 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
          setTimeout(function () { label.textContent = 'Copier le code'; }, 2200);
        };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(value).then(done, done);
        else {
          var ta = document.createElement('textarea');
          ta.value = value; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); } catch (err) { /* ignore */ }
          ta.remove(); done();
        }
      });
    }

    // QR d'aperçu (décoratif, pseudo-aléatoire déterministe)
    var host = $('#pass-qr');
    if (!host) return;
    var N = 21, seed = 0, text = code ? code.textContent : 'LOCANA';
    for (var i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
    var rand = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    var inFinder = function (x, y) {
      return [[0, 0], [N - 7, 0], [0, N - 7]].some(function (p) { return x >= p[0] && x < p[0] + 7 && y >= p[1] && y < p[1] + 7; });
    };
    var cells = '';
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (inFinder(x, y)) continue;
      if (rand() > 0.52) cells += '<rect class="qr-cell" x="' + x + '" y="' + y + '" width="1" height="1" rx=".25"/>';
    }
    var finder = function (x, y) {
      return '<rect x="' + (x + 0.5) + '" y="' + (y + 0.5) + '" width="6" height="6" rx="1.6" fill="none" stroke="#2D6A4F" stroke-width="1"/>' +
             '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" rx=".8" fill="#FFB703"/>';
    };
    host.innerHTML = '<svg viewBox="0 0 ' + N + ' ' + N + '" aria-hidden="true"><g fill="#2D6A4F">' + cells + '</g>' +
      finder(0, 0) + finder(N - 7, 0) + finder(0, N - 7) + '</svg>';
  }

  /* ---------------------------------------------------------------
     Simulateur : réduction / montant payé / contribution
     --------------------------------------------------------------- */
  function initCalculator() {
    var amount = $('#amount'), rf = $('#rate-family'), ra = $('#rate-asso');
    if (!amount) return;
    var out = { family: $('#out-family'), paid: $('#out-paid'), asso: $('#out-asso') };
    var f = { family: $('#f-family'), paid: $('#f-paid'), asso: $('#f-asso') };
    var shown = { family: 6, paid: 114, asso: 5.7 };
    var clamp = function (v, min, max) { v = parseFloat(String(v).replace(',', '.')); return isNaN(v) ? 0 : Math.min(max, Math.max(min, v)); };

    function update() {
      var a = clamp(amount.value, 0, 100000);
      var pf = clamp(rf.value, 0, 50), pa = clamp(ra.value, 0, 50);
      var disc = Math.round(a * pf) / 100;
      var paid = Math.round((a - disc) * 100) / 100;
      var contrib = Math.round(paid * pa) / 100;
      var p = ((a - amount.min) / (amount.max - amount.min)) * 100;
      amount.style.setProperty('--p', p + '%');
      $('#amount-out').textContent = euro.format(a);
      f.family.textContent = num2.format(a) + ' × ' + pct.format(pf) + ' %';
      f.paid.textContent = num2.format(a) + ' − ' + num2.format(disc);
      f.asso.textContent = num2.format(paid) + ' × ' + pct.format(pa) + ' %';
      var target = { family: disc, paid: paid, asso: contrib };
      if (animate) {
        gsap.to(shown, {
          family: target.family, paid: target.paid, asso: target.asso, duration: 0.5, ease: 'power2.out', overwrite: true,
          onUpdate: render
        });
      } else { shown = target; render(); }
    }
    function render() {
      out.family.textContent = euro.format(shown.family);
      out.paid.textContent = euro.format(shown.paid);
      out.asso.textContent = euro.format(shown.asso);
    }
    [amount, rf, ra].forEach(function (el) { el.addEventListener('input', update); });
    update();
  }

  /* ---------------------------------------------------------------
     Feuilles qui virevoltent (canvas)
     --------------------------------------------------------------- */
  function initLeaves() {
    if (reduceMotion) return;
    $$('.hero__leaves, [data-leaves]').forEach(leafCanvas);
  }
  function leafCanvas(canvas) {
    var ctx = canvas.getContext('2d');
    var hero = canvas.closest('.hero, .ph') || canvas.parentElement;
    var density = parseFloat(canvas.getAttribute('data-leaves')) || 1;
    var leaves = [], W = 0, H = 0, dpr = 1, running = true, raf = 0;
    var pointer = { x: -9999, y: -9999 };
    var palette = ['#52B788', '#2D6A4F', '#FFB703', '#82CBA3', '#C1440E'];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round((W < 768 ? 10 : 22) * density);
      while (leaves.length < count) leaves.push(spawn(true));
      leaves.length = count;
    }
    function spawn(anywhere) {
      return {
        x: Math.random() * W,
        y: anywhere ? Math.random() * H : -30,
        s: 6 + Math.random() * 10,
        vy: 0.25 + Math.random() * 0.55,
        vx: 0.15 + Math.random() * 0.35,
        r: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.02,
        ph: Math.random() * Math.PI * 2,
        c: palette[Math.floor(Math.random() * palette.length)],
        a: 0.55 + Math.random() * 0.4,
        px: 0, py: 0
      };
    }
    function draw(l) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.r);
      ctx.globalAlpha = l.a;
      ctx.fillStyle = l.c;
      ctx.beginPath();
      ctx.moveTo(0, -l.s);
      ctx.quadraticCurveTo(l.s * 0.7, 0, 0, l.s);
      ctx.quadraticCurveTo(-l.s * 0.7, 0, 0, -l.s);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,248,231,.55)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, -l.s * 0.8); ctx.lineTo(0, l.s * 0.8); ctx.stroke();
      ctx.restore();
    }
    var t = 0;
    function tick() {
      raf = requestAnimationFrame(tick);
      if (!running) return;
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < leaves.length; i++) {
        var l = leaves[i];
        var dx = l.x - pointer.x, dy = l.y - pointer.y, d2 = dx * dx + dy * dy;
        if (d2 < 14400) { var f = (1 - d2 / 14400) * 1.6; l.px += (dx / Math.sqrt(d2 + 1)) * f; l.py += (dy / Math.sqrt(d2 + 1)) * f; }
        l.px *= 0.94; l.py *= 0.94;
        l.x += l.vx + Math.sin(t * 1.4 + l.ph) * 0.6 + l.px;
        l.y += l.vy + l.py;
        l.r += l.vr + Math.sin(t + l.ph) * 0.01;
        if (l.y > H + 30 || l.x > W + 30) { leaves[i] = spawn(false); leaves[i].x = Math.random() * W * 0.9 - 40; }
        draw(l);
      }
    }
    resize();
    tick();
    window.addEventListener('resize', resize);
    hero.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    });
    hero.addEventListener('pointerleave', function () { pointer.x = pointer.y = -9999; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { running = entries[0].isIntersecting && !document.hidden; }).observe(hero);
    }
    document.addEventListener('visibilitychange', function () { running = !document.hidden; });
  }

  /* ---------------------------------------------------------------
     Split des mots (manifeste)
     --------------------------------------------------------------- */
  function splitWords(el) {
    var frag = document.createDocumentFragment();
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          var s = document.createElement('span');
          s.className = 'word'; s.textContent = part;
          frag.appendChild(s);
        });
      } else if (node.nodeType === 1) {
        node.classList.add('word');
        frag.appendChild(node);
      }
    });
    el.innerHTML = '';
    el.appendChild(frag);
    return $$('.word', el);
  }

  /* ---------------------------------------------------------------
     Intro + entrée du hero
     --------------------------------------------------------------- */
  function heroIntro() {
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.nav__bar', { y: -40, opacity: 0, duration: 0.8 }, 0.5)
      .from('.hero__sky', { scale: 1.18, duration: 2, ease: 'power2.out' }, 0)
      .from('.hero__sun', { yPercent: 70, scale: 0.55, opacity: 0, duration: 1.8, ease: 'power3.out' }, 0)
      .from('.hero__layer--far svg', { yPercent: 16, duration: 1.5 }, 0.1)
      .from('.hero__layer--mid svg', { yPercent: 22, duration: 1.5 }, 0.2)
      .from('.hero__layer--near svg', { yPercent: 28, duration: 1.4 }, 0.3)
      .from('.hero__title .line__inner', { yPercent: 115, rotate: 2.5, duration: 1.15, stagger: 0.12, ease: 'power4.out' }, 0.35)
      .from(['.hero__eyebrow', '.hero__lead', '.search', '.hero__chips'], { y: 16, opacity: 0, duration: 0.54, stagger: 0.12, ease: 'power2.out' }, 0.75)
      .from('.fcard', { y: 70, opacity: 0, rotate: function (i) { return [-5, 4, -3][i]; }, duration: 1.1, stagger: 0.14 }, 0.85)
      .from('.meter__fill', { scaleX: 0, duration: 1.2, ease: 'power2.inOut' }, 1.4)
      .from('.hero__scroll', { opacity: 0, y: 12, duration: 0.6 }, 1.5);
    return tl;
  }

  function runIntro(onDone) {
    var intro = $('.intro');
    var seen = false;
    try { seen = sessionStorage.getItem('locana-intro') === '1'; } catch (e) { /* stockage indisponible */ }

    window.scrollTo(0, 0);
    if (lenis) lenis.stop();

    var finish = function () {
      if (lenis) lenis.start();
      try { sessionStorage.setItem('locana-intro', '1'); } catch (e) { /* ignore */ }
      onDone();
    };

    if (!intro || seen) {
      if (intro) intro.remove();
      var tl0 = heroIntro();
      tl0.eventCallback('onComplete', finish);
      return;
    }

    var tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: function () { intro.remove(); finish(); } });
    tl.from('.intro__core', { scale: 0, svgOrigin: '50 50', duration: 0.8, ease: 'back.out(1.8)' })
      .from('.intro__rays line', { opacity: 0, scale: 0.3, svgOrigin: '50 50', stagger: 0.04, duration: 0.45 }, 0.2)
      .to('.intro__rays', { rotation: 135, svgOrigin: '50 50', duration: 2.1, ease: 'power2.inOut' }, 0)
      .from('.intro__leaf', { scale: 0, svgOrigin: '50 66', duration: 0.6, ease: 'back.out(2.2)' }, 0.45)
      .from('.intro__word span', { yPercent: 110, duration: 0.7, stagger: 0.05, ease: 'power4.out' }, 0.55)
      .from('.intro__tag', { opacity: 0, y: 10, duration: 0.5 }, 0.95)
      .to('.intro__inner', { y: -30, opacity: 0, duration: 0.5, ease: 'power2.in' }, 1.75)
      .to(intro, { yPercent: -100, duration: 1, ease: 'power4.inOut' }, 1.95)
      .add(heroIntro(), 2.35);
  }

  /* ---------------------------------------------------------------
     Ambiance continue du hero (soleil, éoliennes, cartes)
     --------------------------------------------------------------- */
  function heroAmbient() {
    gsap.to('.sun__rays', { rotation: 360, duration: 90, repeat: -1, ease: 'none' });
    gsap.to('.sun__ring', { rotation: -360, duration: 60, repeat: -1, ease: 'none' });
    gsap.to('.sun__halo', { scale: 1.08, opacity: 0.85, duration: 3.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    $$('.turbine').forEach(function (t, i) {
      gsap.to(t, { rotation: 360, svgOrigin: t.getAttribute('data-origin'), duration: i ? 5.5 : 4, repeat: -1, ease: 'none' });
    });
    gsap.to('.hero__scroll-dot', { y: 12, opacity: 0, duration: 1.4, repeat: -1, ease: 'power2.in' });
  }

  /* Aire de jeux : balançoires et tourniquet */
  function heroPlayground() {
    gsap.fromTo('.swing-a', { rotation: -24 }, { rotation: 24, svgOrigin: '972 560', duration: 1.25, ease: 'sine.inOut', repeat: -1, yoyo: true });
    gsap.fromTo('.swing-b', { rotation: 12 }, { rotation: -12, svgOrigin: '1032 560', duration: 1.45, ease: 'sine.inOut', repeat: -1, yoyo: true });
    var back = $('.carousel__back'), front = $('.carousel__front');
    if (!back || !front) return;
    var NS = 'http://www.w3.org/2000/svg';
    var bars = ['#2D6A4F', '#219EBC', '#C1440E', '#52B788'].map(function (c) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('fill', 'none'); p.setAttribute('stroke', c); p.setAttribute('stroke-width', '4.5'); p.setAttribute('stroke-linecap', 'round');
      return p;
    });
    var theta = 0;
    heroTickers.push(function (dt) {
      theta += dt * 1.6;
      bars.forEach(function (b, i) {
        var a = theta + i * Math.PI / 2;
        var x = 1250 + 60 * Math.cos(a), y = 636 + 11 * Math.sin(a), isFront = Math.sin(a) > 0;
        b.setAttribute('d', 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + ' V' + (y - 30).toFixed(1) + ' Q' + x.toFixed(1) + ' 588 1250 588');
        b.setAttribute('opacity', isFront ? '1' : '.55');
        var parent = isFront ? front : back;
        if (b.parentNode !== parent) parent.appendChild(b);
      });
    });
    gsap.to('.carousel__ring', { strokeDashoffset: -130, duration: 2, repeat: -1, ease: 'none' });
  }

  /* Les enfants : cycle de course articulé + traversée de gauche à droite */
  var heroTickers = [];
  function heroKids() {
    var boy = $('.runner--boy'), girl = $('.runner--girl'), ball = $('.ball'), hero = $('.hero');
    if (!boy || !girl || !ball) return;

    function rig(p, hip, knee, shoulder, elbow, neck) {
      var q = function (sel, origin) {
        var el = $('.' + p + '-' + sel);
        if (!el) return function () {};
        gsap.set(el, { svgOrigin: origin });
        return gsap.quickSetter(el, 'rotation', 'deg');
      };
      return {
        legF: q('legF', hip), legB: q('legB', hip), shinF: q('shinF', knee), shinB: q('shinB', knee),
        armF: q('armF', shoulder), armB: q('armB', shoulder), foreF: q('foreF', elbow), foreB: q('foreB', elbow),
        head: q('head', neck), body: gsap.quickSetter('.' + p + '-body', 'y', 'px')
      };
    }
    // Pivots en pose de repos (coordonnées du SVG de chaque enfant)
    var B = rig('b', '0 -66', '0 -35', '0 -106', '0 -83', '0 -112');
    var G = rig('g', '0 -48', '0 -26', '0 -80', '0 -63', '0 -88');
    var tailTop = $('.g-tailTop'), tailLow = $('.g-tailLow');
    var setTailTop = tailTop ? (gsap.set(tailTop, { svgOrigin: '-12 -116' }), gsap.quickSetter(tailTop, 'rotation', 'deg')) : function () {};
    var setTailLow = tailLow ? (gsap.set(tailLow, { svgOrigin: '-14 -105' }), gsap.quickSetter(tailLow, 'rotation', 'deg')) : function () {};

    // Pose d'une foulée : phase φ en radians
    function pose(R, phi, thighAmp, armAmp, bob) {
      [['F', 0], ['B', Math.PI]].forEach(function (side) {
        var ph = phi + side[1];
        var thigh = thighAmp * Math.sin(ph);                                 // + = vers l'avant
        var knee = 12 + 80 * Math.max(0, Math.sin(ph - Math.PI - 0.5));      // talon qui remonte
        R['leg' + side[0]](-thigh);
        R['shin' + side[0]](knee);
        R['arm' + side[0]](armAmp * Math.sin(ph));                           // bras opposé à la jambe
        R['fore' + side[0]](-(68 + 16 * Math.sin(ph)));                      // coude plié vers l'avant
      });
      R.head(3 * Math.sin(phi * 2));
      R.body(-bob * Math.abs(Math.sin(phi)));
    }

    var setBoy = gsap.quickSetter(boy, 'x', 'px'), setGirl = gsap.quickSetter(girl, 'x', 'px');
    var setBall = gsap.quickSetter(ball, 'x', 'px'), setBallY = gsap.quickSetter(ball, 'y', 'px');
    var spin = $('.ball__spin'), setSpin = gsap.quickSetter(spin, 'rotation', 'deg');
    gsap.set(spin, { svgOrigin: '0 0' });

    var t = 0, travel = 0, CROSS = 12, PAUSE = 1.4;
    heroTickers.push(function (dt) {
      t += dt;
      pose(B, t * (2 * Math.PI / 0.62), 38, 42, 4);
      pose(G, t * (2 * Math.PI / 0.5) + 1, 34, 50, 3);
      setTailTop(14 * Math.sin(t * 25));
      setTailLow(-12 * Math.sin(t * 25 + 0.6));

      travel += dt;
      if (travel > CROSS + PAUSE) travel = 0;
      var p = Math.min(1, travel / CROSS);
      var W = hero.clientWidth, s = boy.clientWidth / 132;
      var start = -boy.clientWidth - 260 * s, end = W + 300 * s;
      var bx = start + (end - start) * p;
      setBoy(bx);
      setGirl(bx - 180 * s + Math.sin(t * 1.3) * 14 * s);
      var ballX = bx + boy.clientWidth * 0.8 + (14 + Math.sin(t * 4.2) * 16) * s;
      setBall(ballX);
      setBallY(-Math.abs(Math.sin(t * 6.3)) * 9 * s);
      setSpin((ballX / (Math.PI * ball.clientWidth)) * 360);
    });
  }

  function startHeroTickers() {
    var running = true;
    ScrollTrigger.create({ trigger: '.hero', start: 'top bottom', end: 'bottom top', onToggle: function (self) { running = self.isActive; } });
    document.addEventListener('visibilitychange', function () { running = !document.hidden; });
    gsap.ticker.add(function (time, deltaMs) {
      if (!running) return;
      var dt = Math.min(deltaMs, 50) / 1000;
      heroTickers.forEach(function (fn) { fn(dt); });
    });
  }

  function heroScroll() {
    var tl = gsap.timeline({
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 }
    });
    tl.to('.hero__layer--far', { yPercent: 16, ease: 'none' }, 0)
      .to('.hero__layer--mid', { yPercent: 9, ease: 'none' }, 0)
      .to('.hero__layer--near', { yPercent: -3, ease: 'none' }, 0)
      .to('.hero__sun', { yPercent: 55, scale: 0.82, ease: 'none' }, 0)
      .to('.hero__sky-warm', { opacity: 1, ease: 'none' }, 0)
      .to('.hero__content', { y: 140, opacity: 0, ease: 'none' }, 0)
      .to('.hero__scroll', { opacity: 0, ease: 'none', duration: 0.2 }, 0);
  }

  function heroPointer() {
    if (!finePointer) return;
    var hero = $('.hero');
    var cards = $$('.fcard').map(function (c) {
      return { d: parseFloat(c.getAttribute('data-depth')) || 1, x: gsap.quickTo(c, 'x', { duration: 0.9, ease: 'power3' }), y: gsap.quickTo(c, 'y', { duration: 0.9, ease: 'power3' }) };
    });
    var mid = { x: gsap.quickTo('.hero__layer--mid', 'x', { duration: 1.2, ease: 'power3' }) };
    var far = { x: gsap.quickTo('.hero__layer--far', 'x', { duration: 1.4, ease: 'power3' }) };
    var sun = { x: gsap.quickTo('.hero__sun', 'x', { duration: 1.6, ease: 'power3' }) };
    hero.addEventListener('pointermove', function (e) {
      var rx = e.clientX / window.innerWidth - 0.5, ry = e.clientY / window.innerHeight - 0.5;
      cards.forEach(function (c) { c.x(rx * 26 * c.d); c.y(ry * 18 * c.d); });
      mid.x(rx * -14); far.x(rx * -7); sun.x(rx * 18);
    });
  }

  /* ---------------------------------------------------------------
     Reveals génériques
     --------------------------------------------------------------- */
  function reveals() {
    // Éléments isolés
    if ($$('[data-reveal]').length) gsap.set('[data-reveal]', { y: 16, opacity: 0 });
    if ($$('[data-reveal]').length) ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%',
      onEnter: function (els) { gsap.to(els, { y: 0, opacity: 1, duration: 0.54, stagger: 0.12, ease: 'power2.out', overwrite: true }); }
    });

    // Groupes (enfants en cascade)
    $$('[data-reveal-group]').forEach(function (g) {
      var kids = Array.prototype.slice.call(g.children);
      gsap.from(kids, {
        y: 16, opacity: 0, duration: 0.54, stagger: 0.12, ease: 'power2.out',
        scrollTrigger: { trigger: g, start: 'top 85%' }
      });
    });

    // Titres de section : ligne de surlignage solaire
    $$('.section-title em').forEach(function (em) {
      gsap.fromTo(em, { '--hl': 0 }, {
        '--hl': 1, duration: 0.9, ease: 'power3.inOut', delay: 0.3,
        scrollTrigger: { trigger: em, start: 'top 85%' }
      });
    });
  }

  /* ---------------------------------------------------------------
     Manifeste : mots révélés au scroll + liane
     --------------------------------------------------------------- */
  function manifesto() {
    var text = $('[data-split-words]');
    if (text) {
      var words = splitWords(text);
      gsap.to(words, {
        opacity: 1, stagger: 0.08, ease: 'none',
        scrollTrigger: { trigger: text, start: 'top 78%', end: 'bottom 50%', scrub: 0.5 }
      });
    }
    var stem = $('.vine--manifesto .vine__stem');
    if (stem) {
      var len = stem.getTotalLength();
      gsap.set(stem, { strokeDasharray: len, strokeDashoffset: len });
      gsap.to(stem, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.manifesto', start: 'top 70%', end: 'bottom 60%', scrub: 0.6 } });
      $$('.vine--manifesto .vine__leaf').forEach(function (leaf, i) {
        gsap.from(leaf, { scale: 0, opacity: 0, transformOrigin: 'center', duration: 0.6, ease: 'back.out(2)',
          scrollTrigger: { trigger: '.manifesto', start: 'top ' + (60 - i * 12) + '%' } });
      });
    }
  }

  /* ---------------------------------------------------------------
     Publics : profondeur
     --------------------------------------------------------------- */
  function roles() {
    gsap.to('.role__deco', { rotation: 90, ease: 'none', scrollTrigger: { trigger: '.roles', start: 'top bottom', end: 'bottom top', scrub: true } });
    var mm = gsap.matchMedia();
    mm.add('(min-width: 1025px)', function () {
      gsap.fromTo('.role--family', { y: 60 }, { y: -20, ease: 'none', scrollTrigger: { trigger: '.roles', start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  /* ---------------------------------------------------------------
     Proximité : scène épinglée
     --------------------------------------------------------------- */
  function proximity() {
    var steps = $$('.pstep');
    function setStep(i) { steps.forEach(function (s, k) { s.classList.toggle('is-active', k === i); }); }

    function build() {
      var tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      tl.from('.map__home', { scale: 0, svgOrigin: '300 230', duration: 0.5, ease: 'back.out(2)' })
        .from('.map__border', { opacity: 0, duration: 0.4 }, '<')
        .from('.map__ring', { scale: 0, opacity: 0, svgOrigin: '300 230', duration: 0.8, stagger: 0.35 }, '+=0.2')
        .from('.map__ring-label', { opacity: 0, x: -10, duration: 0.4, stagger: 0.35 }, '<0.3')
        .from('.map__pin', {
          y: -40, opacity: 0, duration: 0.5, stagger: 0.25, ease: 'back.out(2.4)',
          transformOrigin: '50% 100%'
        }, '+=0.2')
        .from('.map__results', { y: 30, opacity: 0, duration: 0.5 }, '<')
        .from('.mres', { x: -20, opacity: 0, duration: 0.4, stagger: 0.25 }, '<0.1')
        .to({}, { duration: 0.6 });
      tl.eventCallback('onUpdate', function () {
        var p = tl.progress();
        setStep(p < 0.22 ? 0 : p < 0.5 ? 1 : 2);
      });
      return tl;
    }

    gsap.to('.map__pulse', { scale: 2.2, opacity: 0, svgOrigin: '300 230', duration: 1.8, repeat: -1, ease: 'power1.out' });

    var mm = gsap.matchMedia();
    mm.add('(min-width: 901px)', function () {
      var tl = build();
      ScrollTrigger.create({
        trigger: '.prox', start: 'top top', end: '+=180%', pin: true, scrub: 0.8, animation: tl, anticipatePin: 1
      });
    });
    mm.add('(max-width: 900px)', function () {
      var tl = build();
      tl.pause();
      ScrollTrigger.create({ trigger: '.map', start: 'top 75%', once: true, onEnter: function () { tl.play(); } });
    });
  }

  /* ---------------------------------------------------------------
     Catégories : bento en cascade
     --------------------------------------------------------------- */
  function categories() {
    gsap.set('[data-cat]', { y: 40, opacity: 0, scale: 0.97 });
    ScrollTrigger.batch('[data-cat]', {
      start: 'top 90%',
      onEnter: function (els) {
        gsap.to(els, { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.12, ease: 'power3.out', overwrite: true, clearProps: 'transform' });
      }
    });
    gsap.to('.cat__deco', { rotation: 40, ease: 'none', scrollTrigger: { trigger: '.cats', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* ---------------------------------------------------------------
     Code partenaire : tilt 3D + reflet
     --------------------------------------------------------------- */
  function partnerCode() {
    gsap.from('#pass-qr .qr-cell', {
      opacity: 0, scale: 0, transformOrigin: 'center', stagger: { amount: 0.8, from: 'random' }, duration: 0.3,
      scrollTrigger: { trigger: '#pass', start: 'top 80%' }
    });
    var pass = $('#pass');
    if (!pass || !finePointer) return;
    var rx = gsap.quickTo(pass, 'rotationX', { duration: 0.6, ease: 'power3' });
    var ry = gsap.quickTo(pass, 'rotationY', { duration: 0.6, ease: 'power3' });
    gsap.set(pass, { transformPerspective: 900 });
    pass.addEventListener('pointermove', function (e) {
      var r = pass.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      ry((x - 0.5) * 10); rx((0.5 - y) * 8);
      pass.style.setProperty('--mx', (x * 100) + '%');
      pass.style.setProperty('--my', (y * 100) + '%');
    });
    pass.addEventListener('pointerleave', function () { rx(0); ry(0); });
  }

  /* ---------------------------------------------------------------
     Confiance : ligne de progression des statuts
     --------------------------------------------------------------- */
  function trust() {
    gsap.to('.trust__line-fill', {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: '.trust__track', start: 'top 80%', end: 'bottom 55%', scrub: 0.5 }
    });
    gsap.from('.status', {
      y: 16, opacity: 0, duration: 0.54, stagger: 0.12, ease: 'power2.out',
      scrollTrigger: { trigger: '.trust__track', start: 'top 82%' }
    });
    gsap.from('.status__icon', {
      scale: 0.4, rotation: -20, duration: 0.8, stagger: 0.18, ease: 'back.out(2)',
      scrollTrigger: { trigger: '.trust__track', start: 'top 82%' }
    });
  }

  /* ---------------------------------------------------------------
     Agenda : défilement horizontal épinglé
     --------------------------------------------------------------- */
  function agenda() {
    var track = $('#agenda-track');
    if (!track) return;
    var mm = gsap.matchMedia();
    mm.add('(min-width: 901px)', function () {
      var distance = function () { return Math.max(0, track.scrollWidth - document.documentElement.clientWidth); };
      var tween = gsap.to(track, {
        x: function () { return -distance(); }, ease: 'none',
        scrollTrigger: { trigger: '.agenda', start: 'top top', end: function () { return '+=' + distance(); }, pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 }
      });
      $$('.event__art svg', track).forEach(function (svg) {
        gsap.fromTo(svg, { xPercent: 0 }, {
          xPercent: -14, ease: 'none',
          scrollTrigger: { trigger: svg.closest('.event'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true }
        });
      });
      $$('.event, .event__more', track).forEach(function (card) {
        gsap.from(card, {
          rotation: 4, y: 40, opacity: 0.3, ease: 'none',
          scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 105%', end: 'left 70%', scrub: true }
        });
      });
    });
    mm.add('(max-width: 900px)', function () {
      gsap.set('.event, .event__more', { y: 16, opacity: 0 });
      ScrollTrigger.batch('.event, .event__more', {
        start: 'top 90%',
        onEnter: function (els) { gsap.to(els, { y: 0, opacity: 1, duration: 0.54, stagger: 0.12, ease: 'power2.out' }); }
      });
    });
  }

  /* ---------------------------------------------------------------
     Parcours : liane qui pousse
     --------------------------------------------------------------- */
  function journey() {
    var path = $('.jp-draw');
    if (path) {
      var len = path.getTotalLength();
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      gsap.to(path, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.journey__wrap', start: 'top 70%', end: 'bottom 70%', scrub: 0.6 } });
    }
    var mobile = window.matchMedia('(max-width: 768px)').matches;
    $$('.jstep').forEach(function (step, i) {
      var dir = mobile ? 1 : (i % 2 ? 1 : -1);
      var st = { trigger: step, start: 'top 80%' };
      gsap.from($('.jstep__card', step), { x: 40 * dir, opacity: 0, duration: 0.7, ease: 'power3.out', scrollTrigger: st });
      gsap.from($('.jstep__node', step), { scale: 0, rotation: -45, duration: 0.6, ease: 'back.out(2.2)', scrollTrigger: st });
    });
  }

  /* ---------------------------------------------------------------
     Compteurs, CTA, footer
     --------------------------------------------------------------- */
  function counters() {
    $$('[data-count]').forEach(function (el) {
      var end = parseFloat(el.getAttribute('data-count'));
      var obj = { v: end === 0 ? 48 : 0 };
      el.textContent = obj.v;
      gsap.to(obj, {
        v: end, duration: 1.6, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
        onUpdate: function () { el.textContent = Math.round(obj.v); }
      });
    });
  }

  function cta() {
    gsap.fromTo('.cta__sun', { yPercent: 40, scale: 0.8 }, { yPercent: -18, scale: 1.05, ease: 'none', scrollTrigger: { trigger: '.cta__panel', start: 'top bottom', end: 'bottom 60%', scrub: true } });
    gsap.from('.cta__hills', { yPercent: 30, ease: 'none', scrollTrigger: { trigger: '.cta__panel', start: 'top bottom', end: 'center center', scrub: true } });
    gsap.fromTo('.footer__word', { xPercent: -6 }, { xPercent: 4, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  /* ---------------------------------------------------------------
     Micro-interactions : boutons magnétiques
     --------------------------------------------------------------- */
  function magnetic() {
    if (!finePointer) return;
    $$('.magnetic').forEach(function (el) {
      var x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
      var y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        x((e.clientX - r.left - r.width / 2) * 0.25);
        y((e.clientY - r.top - r.height / 2) * 0.3);
      });
      el.addEventListener('pointerleave', function () { x(0); y(0); });
    });
  }

  /* ---------------------------------------------------------------
     Pages intérieures : entrée du hero + parallaxe
     --------------------------------------------------------------- */
  function pageHeroIntro() {
    var ph = $('.ph');
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.nav__bar', { y: -40, opacity: 0, duration: 0.8 }, 0.1);
    if (!ph) return tl;
    tl.from('.ph__sky', { scale: 1.15, duration: 1.6, ease: 'power2.out' }, 0)
      .from('.ph__sun', { yPercent: 60, scale: 0.6, opacity: 0, duration: 1.5 }, 0)
      .from('.ph__hills svg', { yPercent: 30, duration: 1.3, stagger: 0.1 }, 0.1)
      .from('.ph__title .line__inner', { yPercent: 115, rotate: 2.5, duration: 1.1, stagger: 0.1, ease: 'power4.out' }, 0.25)
      .from('[data-ph-fade]', { y: 16, opacity: 0, duration: 0.54, stagger: 0.12, ease: 'power2.out' }, 0.6);
    return tl;
  }
  function pageHeroAmbient() {
    if (!$('.ph')) return;
    gsap.to('.ph .sun__rays', { rotation: 360, duration: 90, repeat: -1, ease: 'none' });
    gsap.to('.ph .sun__ring', { rotation: -360, duration: 60, repeat: -1, ease: 'none' });
    gsap.to('.ph .sun__halo', { scale: 1.08, opacity: 0.85, duration: 3.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    $$('.ph .turbine').forEach(function (t, i) {
      gsap.to(t, { rotation: 360, svgOrigin: t.getAttribute('data-origin'), duration: i ? 5.5 : 4, repeat: -1, ease: 'none' });
    });
  }
  function pageHeroScroll() {
    var ph = $('.ph');
    if (!ph || ph.hasAttribute('data-static')) return;
    gsap.timeline({ scrollTrigger: { trigger: ph, start: 'top top', end: 'bottom top', scrub: 0.6 } })
      .to('.ph__sun', { yPercent: 50, scale: 0.85, ease: 'none' }, 0)
      .to('.ph__hills--back', { yPercent: 14, ease: 'none' }, 0)
      .to('.ph__content', { y: 90, opacity: 0, ease: 'none' }, 0);
    if (finePointer) {
      var sx = gsap.quickTo('.ph__sun', 'x', { duration: 1.4, ease: 'power3' });
      var hx = gsap.quickTo('.ph__hills--back', 'x', { duration: 1.2, ease: 'power3' });
      ph.addEventListener('pointermove', function (e) {
        var rx = e.clientX / window.innerWidth - 0.5;
        sx(rx * 20); hx(rx * -12);
      });
    }
  }

  /* ---------------------------------------------------------------
     Composants partagés : lianes, lignes de progression, accordéons
     --------------------------------------------------------------- */
  function vines() {
    $$('[data-vine]').forEach(function (svg) {
      var paths = $$('.vine-draw', svg);
      paths.forEach(function (p) {
        var len = p.getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(p, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: svg.closest('section') || svg, start: 'top 70%', end: 'bottom 70%', scrub: 0.6 } });
      });
    });
    $$('[data-progress]').forEach(function (wrap) {
      var fill = $('[data-progress-fill]', wrap);
      if (!fill) return;
      var horizontal = fill.hasAttribute('data-horizontal');
      gsap.fromTo(fill, horizontal ? { scaleX: 0 } : { scaleY: 0 }, {
        scaleX: 1, scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: wrap, start: 'top 75%', end: 'bottom 60%', scrub: 0.5 }
      });
    });
    $$('[data-stagger]').forEach(function (list) {
      gsap.from(list.children, {
        y: 24, opacity: 0, duration: 0.6, stagger: 0.12, ease: 'power3.out',
        scrollTrigger: { trigger: list, start: 'top 85%' }
      });
    });
  }

  function accordions() {
    $$('.faq details').forEach(function (d) {
      var summary = $('summary', d), body = $('.faq__body', d);
      if (!summary || !body) return;
      summary.addEventListener('click', function (e) {
        if (!animate) return;
        e.preventDefault();
        if (d.open) {
          gsap.to(body, { opacity: 0, y: -8, duration: 0.2, ease: 'power2.in', onComplete: function () { d.open = false; ScrollTrigger.refresh(); } });
        } else {
          d.open = true;
          gsap.fromTo(body, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
          ScrollTrigger.refresh();
        }
      });
    });
  }

  /* ---------------------------------------------------------------
     Onglets accessibles (flèches gauche/droite)
     --------------------------------------------------------------- */
  function tabs() {
    $$('[data-tabs]').forEach(function (root) {
      var list = $$('[role="tab"]', root);
      function select(tab, focus) {
        list.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
          var panel = document.getElementById(t.getAttribute('aria-controls'));
          panel.hidden = !on;
          if (on && animate) gsap.from(panel.querySelectorAll('.scenario__intro > *, .scenario__steps li'), { y: 16, opacity: 0, duration: 0.45, stagger: 0.07, ease: 'power2.out' });
        });
        if (focus) tab.focus();
        if (animate) ScrollTrigger.refresh();
      }
      list.forEach(function (t, i) {
        t.addEventListener('click', function () { select(t); });
        t.addEventListener('keydown', function (e) {
          var n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (e.key === 'Home') { e.preventDefault(); select(list[0], true); }
          if (e.key === 'End') { e.preventDefault(); select(list[list.length - 1], true); }
          if (n) { e.preventDefault(); select(list[(i + n + list.length) % list.length], true); }
        });
      });
    });
  }

  /* Sous-navigation : section active */
  function subnav() {
    var links = $$('.subnav a');
    if (!links.length) return;
    links.forEach(function (a) {
      var target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      ScrollTrigger.create({
        trigger: target, start: 'top 45%', end: 'bottom 45%',
        onToggle: function (self) {
          if (!self.isActive) return;
          links.forEach(function (l) { l.classList.toggle('is-active', l === a); });
          var nav = a.parentElement;
          nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
        }
      });
    });
  }

  /* Maquettes : inclinaison 3D au survol + barres */
  function mockups() {
    if (finePointer) {
      $$('[data-tilt]').forEach(function (el) {
        gsap.set(el, { transformPerspective: 1000 });
        var rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
        var ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
        el.addEventListener('pointermove', function (e) {
          var r = el.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 7);
          rx((0.5 - (e.clientY - r.top) / r.height) * 6);
        });
        el.addEventListener('pointerleave', function () { rx(0); ry(0); });
      });
    }
    $$('.bars').forEach(function (b) {
      gsap.from(b.children, { scaleY: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: b, start: 'top 85%' } });
    });
    var blob = $('[data-blob]');
    if (blob) {
      gsap.from(blob, { scale: 0.4, opacity: 0, transformOrigin: '50% 50%', duration: 1, ease: 'back.out(1.6)', scrollTrigger: { trigger: blob, start: 'top 80%' } });
      gsap.from('[data-depts] > g', { scale: 0, opacity: 0, transformOrigin: '50% 50%', duration: 0.6, stagger: 0.1, ease: 'back.out(2)', scrollTrigger: { trigger: blob, start: 'top 75%' } });
      gsap.to('.territory__ring', { rotation: 360, transformOrigin: '50% 50%', duration: 120, repeat: -1, ease: 'none' });
    }
  }

  /* ---------------------------------------------------------------
     Démarrage
     --------------------------------------------------------------- */
  var page =document.body.getAttribute('data-page') || 'home';

  window.Locana = {
    $: $, $$: $$, toast: toast, animate: animate, reduceMotion: reduceMotion, finePointer: finePointer,
    navigate: function (url) { (window.LocanaNavigate || function (u) { location.href = u; })(url); },
    refresh: function () { if (animate) ScrollTrigger.refresh(); },
    scrollTo: function (el) { scrollToTarget(el); }
  };

  initPageTransitions();
  initSearch();
  initPreviewButtons();
  initPartnerCode();
  initCalculator();
  accordions();
  tabs();

  if (!animate) {
    var intro = $('.intro');
    if (intro) intro.remove();
    if (hasGSAP) initNavHide();
    document.dispatchEvent(new CustomEvent('locana:ready'));
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  initLenis();
  window.Locana.lenis = lenis;
  initNavHide();
  initLeaves();
  magnetic();
  reveals();
  vines();
  counters();
  subnav();
  mockups();
  manifesto();
  if ($('.cta__panel')) cta();
  else if ($('.footer__word')) gsap.fromTo('.footer__word', { xPercent: -6 }, { xPercent: 4, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  if (page === 'home') {
    heroAmbient();
    heroPlayground();
    heroKids();
    startHeroTickers();
    heroPointer();
    roles();
    proximity();
    categories();
    partnerCode();
    trust();
    agenda();
    journey();
    runIntro(function () {
      $$('.fcard').forEach(function (c, i) {
        gsap.to(c, { rotation: i % 2 ? 1.2 : -1.2, duration: 4 + i, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      });
      heroScroll();
      ScrollTrigger.refresh();
    });
  } else {
    if ($('.trust__track')) trust();
    if ($('.journey__wrap')) journey();
    pageHeroAmbient();
    pageHeroIntro().eventCallback('onComplete', function () { pageHeroScroll(); ScrollTrigger.refresh(); });
  }
  document.dispatchEvent(new CustomEvent('locana:ready'));

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
