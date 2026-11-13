/* ==========================================================================
   Données de démonstration — annuaire Locana
   Professionnels FICTIFS. Communes : coordonnées approximatives (centre-ville).
   ========================================================================== */
window.LOCANA_DATA = {
  categories: [
    { id: 'alimentation', letter: 'A', label: 'Alimentation', full: 'Alimentation & produits gourmands', icon: 'croissant', color: ['#FFF0C7', '#6B4226'] },
    { id: 'fleurs', letter: 'B', label: 'Fleurs & saisonnier', full: 'Fleurs, plantes & saisonnier', icon: 'flower-2', color: ['#DDF1E5', '#2D6A4F'] },
    { id: 'beaute', letter: 'C', label: 'Beauté & bien-être', full: 'Beauté & bien-être', icon: 'sparkles', color: ['#F8E1D5', '#C1440E'] },
    { id: 'artisanat', letter: 'D', label: 'Artisanat', full: 'Artisanat & créations', icon: 'flame', color: ['#EEE8FA', '#4A3A80'] },
    { id: 'loisirs', letter: 'E', label: 'Loisirs & culture', full: 'Loisirs, sport & culture', icon: 'tent-tree', color: ['#DCEFF5', '#13627A'] },
    { id: 'evenementiel', letter: 'F', label: 'Événementiel', full: 'Événementiel & fournitures', icon: 'printer', color: ['#FFF0C7', '#6B4226'] },
    { id: 'services', letter: 'G', label: 'Artisans & services', full: 'Artisans & services', icon: 'wrench', color: ['#2D6A4F', '#FFF8E7'] }
  ],

  communes: [
    { n: 'Beauvais', cp: '60000', d: 'Oise', lat: 49.4300, lng: 2.0833 },
    { n: 'Compiègne', cp: '60200', d: 'Oise', lat: 49.4179, lng: 2.8261 },
    { n: 'Creil', cp: '60100', d: 'Oise', lat: 49.2597, lng: 2.4747 },
    { n: 'Senlis', cp: '60300', d: 'Oise', lat: 49.2069, lng: 2.5867 },
    { n: 'Chantilly', cp: '60500', d: 'Oise', lat: 49.1947, lng: 2.4711 },
    { n: 'Méru', cp: '60110', d: 'Oise', lat: 49.2364, lng: 2.1339 },
    { n: 'Chambly', cp: '60230', d: 'Oise', lat: 49.1656, lng: 2.2483 },
    { n: 'Noyon', cp: '60400', d: 'Oise', lat: 49.5817, lng: 2.9992 },
    { n: 'Clermont', cp: '60600', d: 'Oise', lat: 49.3786, lng: 2.4125 },
    { n: 'Pont-Sainte-Maxence', cp: '60700', d: 'Oise', lat: 49.3017, lng: 2.6044 },
    { n: 'Crépy-en-Valois', cp: '60800', d: 'Oise', lat: 49.2342, lng: 2.8883 },
    { n: 'Puiseux-le-Hauberger', cp: '60540', d: 'Oise', lat: 49.2253, lng: 2.2486 },
    { n: 'Nogent-sur-Oise', cp: '60180', d: 'Oise', lat: 49.2717, lng: 2.4683 },
    { n: 'Liancourt', cp: '60140', d: 'Oise', lat: 49.3306, lng: 2.4658 },
    { n: 'Breteuil', cp: '60120', d: 'Oise', lat: 49.6339, lng: 2.2958 },
    { n: 'Grandvilliers', cp: '60210', d: 'Oise', lat: 49.6625, lng: 1.9411 },
    { n: 'Cergy', cp: '95000', d: "Val-d'Oise", lat: 49.0364, lng: 2.0761 },
    { n: 'Pontoise', cp: '95300', d: "Val-d'Oise", lat: 49.0508, lng: 2.1008 },
    { n: "L'Isle-Adam", cp: '95290', d: "Val-d'Oise", lat: 49.1108, lng: 2.2228 },
    { n: 'Persan', cp: '95340', d: "Val-d'Oise", lat: 49.1528, lng: 2.2722 },
    { n: 'Beaumont-sur-Oise', cp: '95260', d: "Val-d'Oise", lat: 49.1425, lng: 2.2867 },
    { n: 'Magny-en-Vexin', cp: '95420', d: "Val-d'Oise", lat: 49.1550, lng: 1.7867 },
    { n: 'Marines', cp: '95640', d: "Val-d'Oise", lat: 49.1447, lng: 1.9833 },
    { n: 'Luzarches', cp: '95270', d: "Val-d'Oise", lat: 49.1144, lng: 2.4228 },
    { n: 'Argenteuil', cp: '95100', d: "Val-d'Oise", lat: 48.9472, lng: 2.2467 },
    { n: 'Roissy-en-France', cp: '95700', d: "Val-d'Oise", lat: 49.0036, lng: 2.5167 },
    { n: 'Amiens', cp: '80000', d: 'Somme', lat: 49.8941, lng: 2.2958 },
    { n: 'Soissons', cp: '02200', d: 'Aisne', lat: 49.3817, lng: 3.3236 },
    { n: 'Gisors', cp: '27140', d: 'Eure', lat: 49.2811, lng: 1.7764 },
    { n: 'Meaux', cp: '77100', d: 'Seine-et-Marne', lat: 48.9603, lng: 2.8789 }
  ],

  /* type : 'produit' (visible au-delà du rayon si livraison nationale) | 'service' (filtré par zone d'intervention) */
  pros: [
    { id: 'trois-chenes', name: 'Ferme des Trois Chênes', town: 'Puiseux-le-Hauberger', dept: 'Oise', lat: 49.2380, lng: 2.2290,
      cats: ['alimentation'], subs: ['Producteurs locaux', 'Fromages & produits laitiers', 'Paniers gourmands'], type: 'produit', zone: 30, national: false,
      desc: "Ferme familiale en polyculture-élevage : fromages, yaourts, colis de viande et paniers de saison. Habituée des ventes de fin d'année des écoles du secteur.",
      products: ['Fromages fermiers', 'Paniers gourmands de saison', 'Colis de viande sur commande'],
      offer: { family: 5, asso: 5, until: '31 déc. 2026', terms: 'Commande groupée à partir de 10 paniers, retrait à la ferme.' } },

    { id: 'coteaux', name: 'Pépinière des Coteaux', town: 'Marines', dept: "Val-d'Oise", lat: 49.1390, lng: 2.0120,
      cats: ['fleurs'], subs: ['Sapins de Noël', 'Plantes & arbustes', 'Bulbes & graines'], type: 'produit', zone: 40, national: false,
      desc: "Producteur de sapins Nordmann et pépiniériste. Propose chaque hiver une offre clé en main pour les ventes de sapins associatives.",
      products: ['Sapins Nordmann de 1 à 3 m', 'Arbustes et haies', 'Bulbes de printemps'],
      offer: { family: 5, asso: 5, until: '24 déc. 2026', terms: 'Bon de commande groupé, livraison sur un point de retrait unique.' } },

    { id: 'cire-meche', name: 'Atelier Cire & Mèche', town: 'Méru', dept: 'Oise', lat: 49.2420, lng: 2.1450,
      cats: ['artisanat', 'beaute'], subs: ['Bougies', 'Décorations', 'Coffrets cadeaux'], type: 'produit', zone: 20, national: true,
      desc: 'Bougies coulées à la main en cire végétale, parfums de saison et coffrets personnalisables aux couleurs de votre association.',
      products: ['Bougies parfumées', 'Coffrets cadeaux', 'Personnalisation des étiquettes'],
      offer: { family: 10, asso: 6, until: '15 janv. 2027', terms: 'À partir de 20 bougies. Expédition possible partout en France.' } },

    { id: 'rucher-vexin', name: 'Rucher du Vexin', town: 'Magny-en-Vexin', dept: "Val-d'Oise", lat: 49.1610, lng: 1.8010,
      cats: ['alimentation'], subs: ['Miel & produits de la ruche', 'Produits régionaux'], type: 'produit', zone: 25, national: true,
      desc: "Apiculteur installé dans le Vexin français : miels de printemps et d'été, pain d'épices et bougies en cire d'abeille.",
      products: ['Miels de cru', "Pain d'épices", 'Coffrets dégustation'],
      offer: { family: 0, asso: 8, until: '30 juin 2027', terms: 'Contribution reversée sur toute commande avec code association.' } },

    { id: 'remparts', name: 'Chocolaterie des Remparts', town: 'Senlis', dept: 'Oise', lat: 49.2080, lng: 2.5850,
      cats: ['alimentation'], subs: ['Chocolats', 'Biscuits, gâteaux & confiseries'], type: 'produit', zone: 30, national: true,
      desc: 'Artisan chocolatier : ballotins, sujets de Pâques et de Noël, catalogue spécial ventes scolaires avec bons de commande prêts à distribuer.',
      products: ['Ballotins assortis', 'Sujets de saison', 'Catalogue ventes scolaires'],
      offer: { family: 5, asso: 8, until: '30 avr. 2027', terms: 'Catalogue et bons de commande fournis. Livraison groupée gratuite dans 30 km.' } },

    { id: 'fleurs-oise', name: "Fleurs de l'Oise", town: 'Creil', dept: 'Oise', lat: 49.2610, lng: 2.4790,
      cats: ['fleurs', 'evenementiel'], subs: ['Fleurs & bouquets', 'Compositions florales', 'Décoration événementielle'], type: 'service', zone: 25, national: false,
      desc: 'Fleuriste créateur : bouquets, compositions et décoration de salles pour fêtes, galas et kermesses.',
      products: ['Bouquets et compositions', 'Décoration de salle', 'Fleurs pour cérémonies'],
      offer: null },

    { id: 'therain', name: 'Imprimerie du Thérain', town: 'Beauvais', dept: 'Oise', lat: 49.4350, lng: 2.0950,
      cats: ['evenementiel'], subs: ['Impression', 'Textiles & objets personnalisés', 'Goodies'], type: 'produit', zone: 50, national: true,
      desc: "Affiches, flyers, banderoles, tee-shirts et tote bags personnalisés. Tarifs dédiés aux associations et accompagnement à la mise en page.",
      products: ['Affiches et flyers', 'Tee-shirts personnalisés', 'Banderoles'],
      offer: { family: 0, asso: 5, until: '31 déc. 2027', terms: "Tarif association et contribution sur chaque commande passée avec le code." } },

    { id: 'clairiere', name: 'Savonnerie La Clairière', town: 'Chantilly', dept: 'Oise', lat: 49.1900, lng: 2.4600,
      cats: ['beaute'], subs: ['Savons & produits artisanaux', 'Cosmétiques', 'Coffrets cadeaux'], type: 'produit', zone: 20, national: true,
      desc: 'Savons saponifiés à froid et soins solides, fabriqués en petites séries. Coffrets idéaux pour les ventes de fin d’année.',
      products: ['Savons surgras', 'Shampoings solides', 'Coffrets découverte'],
      offer: { family: 10, asso: 5, until: '28 févr. 2027', terms: 'Minimum 15 coffrets par commande.' } },

    { id: 'trois-forets', name: 'Parc Aventure des Trois Forêts', town: 'Compiègne', dept: 'Oise', lat: 49.3720, lng: 2.8800,
      cats: ['loisirs'], subs: ['Parcs de loisirs', 'Activités sportives', 'Sorties & visites'], type: 'service', zone: 60, national: false,
      desc: "Parcours accrobranche, tyroliennes et course d'orientation en forêt. Billets à tarif réduit pour les familles des associations partenaires.",
      products: ['Billets famille', 'Sorties de groupe', 'Anniversaires'],
      offer: { family: 15, asso: 5, until: '31 oct. 2027', terms: 'Sur présentation du code à la caisse, hors jours fériés.' } },

    { id: 'petit-theatre', name: 'Compagnie du Petit Théâtre', town: 'Pontoise', dept: "Val-d'Oise", lat: 49.0520, lng: 2.1050,
      cats: ['loisirs'], subs: ['Spectacles', 'Animations pour enfants & familles', 'Ateliers'], type: 'service', zone: 50, national: false,
      desc: 'Spectacles jeune public, contes musicaux et ateliers théâtre, adaptés aux kermesses et aux fêtes de fin d’année.',
      products: ['Spectacles jeune public', 'Ateliers théâtre', 'Animations de kermesse'],
      offer: null },

    { id: 'sono-picardie', name: 'Sono Événements Picardie', town: 'Nogent-sur-Oise', dept: 'Oise', lat: 49.2750, lng: 2.4700,
      cats: ['evenementiel'], subs: ['Sonorisation & animation', 'Location de matériel'], type: 'service', zone: 50, national: false,
      desc: 'Location de sonorisation, éclairage, barnums et tables. Installation et animation possibles pour vos fêtes de village.',
      products: ['Sonorisation', 'Barnums et tables', 'Animation DJ'],
      offer: { family: 0, asso: 7, until: '31 déc. 2027', terms: 'Contribution sur la location, hors frais de déplacement.' } },

    { id: 'haies-martin', name: 'Jardins & Haies Martin', town: 'Chambly', dept: 'Oise', lat: 49.1690, lng: 2.2550,
      cats: ['services'], subs: ['Jardinage', 'Entretien'], type: 'service', zone: 25, national: false,
      desc: "Paysagiste : entretien d'espaces verts, taille de haies, création de potagers pédagogiques pour les écoles.",
      products: ['Entretien de jardins', 'Taille de haies', 'Potagers pédagogiques'],
      offer: null },

    { id: 'elec-services', name: "Élec'Services 60", town: 'Pont-Sainte-Maxence', dept: 'Oise', lat: 49.3050, lng: 2.6000,
      cats: ['services'], subs: ['Électricité', 'Réparation'], type: 'service', zone: 30, national: false,
      desc: 'Électricien : dépannage, mise aux normes et installations temporaires pour marchés et manifestations.',
      products: ['Dépannage', 'Branchements temporaires', 'Mise aux normes'],
      offer: { family: 5, asso: 3, until: '31 déc. 2027', terms: 'Sur devis, pour les familles adhérentes et les associations.' } },

    { id: 'biscuiterie', name: 'Biscuiterie de la Vallée', town: 'Noyon', dept: 'Oise', lat: 49.5800, lng: 2.9950,
      cats: ['alimentation'], subs: ['Biscuits, gâteaux & confiseries', 'Paniers gourmands & coffrets'], type: 'produit', zone: 40, national: true,
      desc: 'Biscuits pur beurre, sablés et boîtes métal illustrées. Un classique des ventes de Noël et des tombolas.',
      products: ['Boîtes de sablés', 'Coffrets gourmands', 'Biscuits personnalisés'],
      offer: { family: 5, asso: 10, until: '31 janv. 2027', terms: 'À partir de 30 boîtes, livraison offerte dans 40 km.' } },

    { id: 'paniers-gisors', name: 'Les Paniers de Gisors', town: 'Gisors', dept: 'Eure', lat: 49.2830, lng: 1.7800,
      cats: ['alimentation'], subs: ['Produits régionaux', 'Paniers gourmands & coffrets'], type: 'produit', zone: 35, national: false,
      desc: 'Épicerie fine normande : cidres, terrines, confitures et paniers composés à la demande.',
      products: ['Paniers garnis', 'Cidres et jus', 'Terrines artisanales'],
      offer: { family: 5, asso: 5, until: '31 déc. 2026', terms: 'Paniers composés sur commande, retrait en boutique.' } },

    { id: 'fil-argent', name: "Atelier Bijoux Fil d'Argent", town: 'Luzarches', dept: "Val-d'Oise", lat: 49.1160, lng: 2.4250,
      cats: ['artisanat'], subs: ['Bijoux', 'Créations personnalisées'], type: 'produit', zone: 20, national: true,
      desc: 'Bijoux en argent recyclé et pièces gravées : idéals pour des lots de tombola ou des cadeaux de fin d’année.',
      products: ['Bijoux gravés', 'Lots de tombola', 'Créations sur mesure'],
      offer: null },

    { id: 'photo-lumiere', name: 'Studio Photo Lumière', town: 'Cergy', dept: "Val-d'Oise", lat: 49.0400, lng: 2.0700,
      cats: ['evenementiel'], subs: ['Photographie & vidéo'], type: 'service', zone: 60, national: false,
      desc: 'Photographies de classe, de fêtes et d’événements sportifs, avec une boutique en ligne pour les familles.',
      products: ['Photos de classe', 'Reportages d’événements', 'Tirages et albums'],
      offer: { family: 0, asso: 10, until: '30 juin 2027', terms: 'Contribution sur les ventes de tirages aux familles.' } },

    { id: 'ludo-ateliers', name: 'Ateliers Créatifs du Valois', town: 'Crépy-en-Valois', dept: 'Oise', lat: 49.2360, lng: 2.8900,
      cats: ['loisirs', 'artisanat'], subs: ['Ateliers', 'Animations pour enfants & familles', 'Objets faits main'], type: 'service', zone: 35, national: false,
      desc: 'Ateliers de création (céramique, couture, peinture) pour enfants et familles, sur place ou en intervention.',
      products: ['Ateliers enfants', 'Interventions en école', 'Stages vacances'],
      offer: { family: 10, asso: 5, until: '30 juin 2027', terms: 'Sur les stages et ateliers réservés avec le code.' } },

    { id: 'saucisson-lefevre', name: 'Maison Lefèvre, charcutier', town: 'Clermont', dept: 'Oise', lat: 49.3800, lng: 2.4150,
      cats: ['alimentation'], subs: ['Saucissons & charcuterie', 'Produits régionaux'], type: 'produit', zone: 30, national: false,
      desc: 'Saucissons secs, terrines et pâtés maison. Ventes de saucissons pour associations avec étiquetage personnalisé.',
      products: ['Saucissons secs', 'Terrines', 'Étiquettes personnalisées'],
      offer: { family: 0, asso: 12, until: '31 mai 2027', terms: 'Commande minimum de 50 saucissons.' } },

    { id: 'goodies-meaux', name: 'Brie Goodies & Textiles', town: 'Meaux', dept: 'Seine-et-Marne', lat: 48.9620, lng: 2.8780,
      cats: ['evenementiel'], subs: ['Goodies', 'Textiles & objets personnalisés'], type: 'produit', zone: 50, national: true,
      desc: 'Gourdes, sacs, mugs et textiles marqués au logo de votre association, en petites et grandes séries.',
      products: ['Gourdes et mugs', 'Sacs en coton', 'Sweats et tee-shirts'],
      offer: { family: 0, asso: 5, until: '31 déc. 2027', terms: 'À partir de 25 pièces.' } }
  ]
};
