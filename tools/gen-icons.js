const fs = require('fs');
const lucide = require(process.argv[2]);
const html = process.argv[3].split(',').map(f => fs.readFileSync(f, 'utf8')).join('\n');
const names = [...new Set([...html.matchAll(/data-lucide=\\?"([a-z0-9-]+)\\?"/g), ...html.matchAll(/icon: '([a-z0-9-]+)'/g)].map(m => m[1]))].sort();
const pascal = n => n.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('');
const out = {}; const missing = [];
for (const n of names) { const ic = lucide.icons[pascal(n)]; if (!ic) missing.push(n); else out[n] = (ic[0] === "svg" ? ic[2] : ic); }
if (missing.length) { console.error('MISSING', missing); process.exit(1); }
const js = `/* Sous-ensemble d'icônes Lucide (ISC) généré automatiquement */
(function () {
  var ICONS = ${JSON.stringify(out)};
  var NS = 'http://www.w3.org/2000/svg';
  function render(root) {
    (root || document).querySelectorAll('[data-lucide]').forEach(function (el) {
      var node = ICONS[el.getAttribute('data-lucide')];
      if (!node || el.tagName.toLowerCase() === 'svg') return;
      var svg = document.createElementNS(NS, 'svg');
      var base = { xmlns: NS, width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' };
      Object.keys(base).forEach(function (k) { svg.setAttribute(k, base[k]); });
      svg.setAttribute('class', ('lucide lucide-' + el.getAttribute('data-lucide') + ' ' + (el.getAttribute('class') || '')).trim());
      if (el.getAttribute('style')) svg.setAttribute('style', el.getAttribute('style'));
      Array.prototype.forEach.call(el.attributes, function (a) { if (a.name.indexOf('data-') === 0 && a.name !== 'data-lucide') svg.setAttribute(a.name, a.value); });
      node.forEach(function (child) {
        var c = document.createElementNS(NS, child[0]);
        Object.keys(child[1]).forEach(function (k) { if (k !== 'key') c.setAttribute(k, child[1][k]); });
        svg.appendChild(c);
      });
      el.replaceWith(svg);
    });
  }
  window.LocanaIcons = { render: render };
  render();
})();
`;
fs.writeFileSync(process.argv[4], js);
console.log(names.length, 'icons,', js.length, 'bytes');
