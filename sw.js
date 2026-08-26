/**
 * Service worker — Portail LAM
 *
 * Son seul rôle : que le portail S'OUVRE sans réseau, et sache le dire.
 *
 * Différence importante avec le Portail EKAYE : là-bas, deux outils sur trois
 * fonctionnent hors ligne et le portail devait être aussi solide qu'eux. Ici,
 * **aucun outil LAM ne marche sans réseau** — la vente, le comptage et la carte
 * sont des Web Apps Apps Script, les classeurs et l'agenda sont chez Google.
 * Le worker ne rend donc qu'un service : afficher la page, ses tuiles éteintes
 * et le motif de leur extinction, plutôt qu'un écran blanc qui n'apprend rien.
 *
 * ORIGINE PROPRE : le portail vit sur `lam-bergerac.github.io`, à lui seul. Il a
 * d'abord été publié sous `frederic-aranaz.github.io/lam/`, où il était capté par
 * l'appli EKAYE installée — celle-ci déclare la portée « / » et réclamait donc
 * toute l'origine, au point que le navigateur refusait d'installer LAM. Le
 * déménagement règle cela, et répond surtout à une exigence de Frédéric : les
 * artisans de LAM n'ont pas à tomber sur ses outils EKAYE en raccourcissant l'URL.
 *
 * La liste blanche ci-dessous n'est donc plus indispensable — rien d'autre ne vit
 * sur cette origine. Elle est conservée : elle ne coûte rien, et elle protège si
 * un second outil LAM venait un jour s'installer à côté.
 *
 * À CHAQUE PUBLICATION D'UNE NOUVELLE VERSION DE LA PAGE, incrémenter VERSION.
 * Sans cela, les téléphones qui ont déjà installé le portail continueront de
 * servir l'ancienne indéfiniment : c'est le seul piège de ce fichier.
 */

var VERSION = 'v2';   // v2 : bouton d'installation, consigne iPhone, icônes 192/512 (26/08/2026)
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
          // Ne supprimer que NOS anciens caches. Précaution héritée de la
          // cohabitation avec EKAYE, gardée par principe : un worker n'a aucune
          // raison de vider un cache qu'il n'a pas rempli. C'est exactement le
          // défaut que le worker d'EKAYE, lui, présente encore.
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

  // Un fichier d'une autre appli du domaine (le Portail EKAYE, ses outils) : on
  // laisse passer, sans respondWith. Son propre worker fait son travail.
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
