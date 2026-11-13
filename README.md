# Locana

Plateforme associative et commerces locaux (nom de travail). Prototype visuel du site public, direction artistique « Solarpunk Utópico ».

## Lancer en local

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000.

## Structure

- `index.html` : page d'accueil
- `annuaire.html` : Trouver un pro (recherche par commune et rayon, filtres, carte, fiche)
- `services.html`, `a-propos.html`, `contact.html`
- `assets/css/style.css` : tokens du style guide, composants et sections
- `assets/css/pages.css` : composants des pages intérieures
- `assets/js/annuaire-data.js` : données de démonstration (professionnels fictifs, communes)
- `assets/js/annuaire.js`, `assets/js/contact.js` : logique propre à ces pages
- `assets/js/main.js` : animations GSAP + ScrollTrigger, défilement fluide Lenis, interactions
- `assets/js/icons.js` : sous-ensemble d'icônes Lucide (ISC)
- `assets/vendor/` : GSAP 3.12.5, ScrollTrigger, Lenis 1.1.13 (embarqués localement)

Les animations respectent `prefers-reduced-motion`.
