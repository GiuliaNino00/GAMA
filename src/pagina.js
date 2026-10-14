/**
 * PRESENZE GAMA — Le pagine HTML servite dal server
 * ---------------------------------------------------------------------------
 * Lo scheletro dell'app (lo stile e il comportamento stanno in public/),
 * piu' le due pagine di cortesia: benvenuto e link non valido.
 */
import { CFG } from './config.js';

/** Il JSON dentro <script> non deve mai poter chiudere il tag. */
function jsonSicuro(o) {
  return JSON.stringify(o)
    .replace(/</g, '\\u003c')
    .split(String.fromCharCode(0x2028)).join('\\u2028')
    .split(String.fromCharCode(0x2029)).join('\\u2029');
}

function testa(titolo, versione, extra = '') {
  return [
    '<!DOCTYPE html><html lang="it"><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<meta name="theme-color" content="#f1f3f6" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#0b1117" media="(prefers-color-scheme: dark)">',
    '<meta name="color-scheme" content="light dark">',
    '<link rel="icon" href="/statici/icone/icona-192.png">',
    '<link rel="apple-touch-icon" href="/statici/icone/apple-touch-icon.png">',
    '<link rel="stylesheet" href="/statici/app.css?v=' + versione + '">',
    extra,
    '<title>' + titolo + '</title></head>'
  ].join('');
}

export function paginaApp(avvio, versione) {
  return testa(CFG.NOME_APP, versione, [
    '<link rel="manifest" href="manifest.webmanifest">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-title" content="Presenze">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">'
  ].join('')) + [
    '<body>',
    '<header class="testa grande" id="testa">',
      '<button class="indietro" id="indietro" type="button" aria-label="Indietro" hidden>',
        '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>',
      '<div class="tit"><h1 id="titolo">Presenze GAMA</h1><p id="sotto"></p></div>',
    '</header>',
    '<main id="schermo"><div class="scheletro"><i class="alto"></i><i class="alto"></i><i></i></div></main>',
    '<div class="fondo" id="fondo" hidden></div>',
    '<div class="velo" id="velo" hidden><div class="rotella"></div></div>',
    '<div class="avviso" id="avviso" role="status" aria-live="polite" hidden></div>',
    '<div class="successo" id="successo" role="status" aria-live="polite" hidden></div>',
    '<script type="application/json" id="avvio">' + jsonSicuro(avvio) + '</script>',
    '<script src="/statici/app.js?v=' + versione + '" defer></script>',
    '</body></html>'
  ].join('');
}

const DISEGNI = {
  cartellina: '<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><path d="M8 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H16"/><path d="M9 13l2 2 4-4"/>',
  lucchetto: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2"/>'
};

function paginaSemplice(disegno, titolo, testo, versione) {
  return testa(titolo, versione) +
    '<body class="semplice"><main><div class="segno"><svg viewBox="0 0 24 24" aria-hidden="true">' + DISEGNI[disegno] + '</svg></div>' +
    '<h1>' + titolo + '</h1><p>' + testo + '</p></main></body></html>';
}

export function paginaBenvenuto(versione) {
  return paginaSemplice('cartellina', CFG.NOME_APP,
    'Per entrare serve il <b>link personale</b> che ti ha mandato l\'amministratore. ' +
    'Aprilo dal telefono e salvalo sulla schermata Home.', versione);
}

export function paginaLinkNonValido(versione) {
  return paginaSemplice('lucchetto', 'Link non valido',
    'Questo link non funziona più: forse ne è stato creato uno nuovo. ' +
    'Chiedi all\'amministratore di mandarti il link aggiornato.', versione);
}

export function manifest() {
  return {
    name: CFG.NOME_APP,
    short_name: 'Presenze',
    description: 'Appello giornaliero e riepiloghi delle presenze',
    lang: 'it',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f1f3f6',
    theme_color: '#f1f3f6',
    icons: [
      { src: '/statici/icone/icona-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/statici/icone/icona-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/statici/icone/icona-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
