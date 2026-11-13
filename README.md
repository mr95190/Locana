# Locana

Plateforme associative et commerces locaux (nom de travail). Prototype visuel du site public, direction artistique « Solarpunk Utópico ».

## Lancer en local

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000.

## Structure

- `index.html` : page d'accueil
- `assets/css/style.css` : tokens du style guide, composants et sections
- `assets/js/main.js` : animations GSAP + ScrollTrigger, défilement fluide Lenis, interactions
- `assets/js/icons.js` : sous-ensemble d'icônes Lucide (ISC)
- `assets/vendor/` : GSAP 3.12.5, ScrollTrigger, Lenis 1.1.13 (embarqués localement)

Les animations respectent `prefers-reduced-motion`.
