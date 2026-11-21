/**
 * Service worker — Portail LAM
 *
 * Son seul rôle : que le portail S'OUVRE sans réseau, et sache le dire.
 *
 * **Aucun outil LAM ne fonctionne sans réseau** — la vente, le comptage et la
 * carte sont des Web Apps Apps Script, les classeurs et l'agenda sont chez
 * Google. Le worker ne rend donc qu'un service : afficher la page, ses tuiles
 * éteintes et le motif de leur extinction, plutôt qu'un écran blanc qui
 * n'apprend rien.
 *
 * ORIGINE PROPRE : `lam-bergerac.github.io` n'héberge que ce portail. La liste
 * blanche ci-dessous n'est donc pas indispensable aujourd'hui ; elle est gardée
 * par principe — un worker n'a aucune raison d'intercepter ce qu'il n'a pas
 * publié, et elle protégera si un second outil LAM s'installe un jour à côté.
 *
 * À CHAQUE PUBLICATION D'UNE NOUVELLE VERSION DE LA PAGE, incrémenter VERSION.
 * Sans cela, les téléphones qui ont déjà installé le portail continueront de
 * servir l'ancienne indéfiniment : c'est le seul piège de ce fichier.
 */

var VERSION = 'v6';   // v6 : date ajoutée au numéro dans le titre (21/11/2026)
                      // v5 : numéro de version déplacé dans le titre (21/11/2026)
                      //      — le reporter AUSSI dans le titre de index.html
                      // v4 : numéro de version affiché en bas de page (21/11/2026)
                      // v3 : origine propre lam-bergerac.github.io (26/08/2026)
                      // v2 : bouton d'installation, consigne iPhone, icônes 192/512 (26/08/2026)
                      // v1 : création du portail (26/08/2026)
var CACHE = 'lam-portail-' + VERSION;

var FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icone.svg',
  'icone-maskable.svg',
  'icone-192.png',
  'icone-512.png',
  'icone-maskable-512.png',
  'apple-touch-icon.png'
];

// Chemins absolus de nos fichiers, calculés une fois : c'est la liste blanche
// des requêtes que ce worker s'autorise à intercepter.
var NOTRES = FICHIERS.map(function (f) {
  return new URL(f, self.location.href).pathname;
});

self.addEventListener('install', function (e) {
  // skipWaiting : la nouvelle version prend la main au prochain chargement plutôt
  // qu'après fermeture de tous les onglets. Sur un téléphone, « tous les onglets »
  // peut vouloir dire jamais.
  e.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(FICHIERS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (noms) {
        return Promise.all(noms.map(function (nom) {
          // Ne supprimer que NOS anciens caches : un worker n'a aucune raison de
          // vider un cache qu'il n'a pas rempli. `caches` est partagé par toute
          // l'origine, et cette étourderie est un classique — elle éteint le mode
          // hors ligne d'une appli voisine sans que rien ne le signale.
          if (nom !== CACHE && nom.indexOf('lam-portail-') === 0) return caches.delete(nom);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var requete = e.request;

  if (requete.method !== 'GET') return;

  var url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  // Un fichier qui ne serait pas le nôtre : on laisse passer, sans respondWith.
  // S'il appartenait un jour à une autre appli de cette origine, son propre
  // worker ferait son travail sans que celui-ci s'en mêle.
  if (NOTRES.indexOf(url.pathname) === -1) return;

  // Réseau d'abord, cache en secours : en ligne, on a toujours la dernière
  // version publiée ; hors ligne, le portail s'ouvre quand même.
  e.respondWith(
    fetch(requete)
      .then(function (reponse) {
        if (reponse && reponse.status === 200 && reponse.type === 'basic') {
          var copie = reponse.clone();
          caches.open(CACHE).then(function (cache) { cache.put(requete, copie); });
        }
        return reponse;
      })
      .catch(function () {
        return caches.match(requete).then(function (enCache) {
          if (enCache) return enCache;
          if (requete.mode === 'navigate') return caches.match('index.html');
          return Response.error();
        });
      })
  );
});
