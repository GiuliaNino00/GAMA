/**
 * PRESENZE GAMA — Il server
 * ---------------------------------------------------------------------------
 * Avvio:   npm start          (legge il file .env se c'e')
 *
 * Ogni utente entra con il suo link personale: https://<server>/u/<chiave>/
 * Tutto quello che sta sotto quel link (pagina, dati, foglio) e' suo e solo suo.
 */
import './fuso.js';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { env } from './config.js';
import { apri, percorsoDb } from './db.js';
import * as Q from './dati.js';
import * as V from './viste.js';
import { esegui } from './azioni.js';
import { foglioMese, nomeScheda } from './foglio.js';
import { creaNotifiche } from './notifiche.js';
import { creaOrologio } from './orologio.js';
import { paginaApp, paginaBenvenuto, paginaLinkNonValido, manifest } from './pagina.js';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const PUBBLICA = path.join(QUI, '..', 'public');
export const VERSIONE = JSON.parse(fs.readFileSync(path.join(QUI, '..', 'package.json'), 'utf8')).version;

/**
 * Impronta dei file dell'app: cambia da sola appena cambia anche una virgola di
 * app.js, app.css o sw.js. I telefoni la usano per sapere quando riscaricarli,
 * senza dover ricordarsi di cambiare il numero di versione.
 */
export const IMPRONTA = crypto.createHash('sha256')
  .update(['app.js', 'app.css', 'sw.js'].map((f) => fs.readFileSync(path.join(PUBBLICA, f))).join('\n'))
  .digest('hex').slice(0, 12);

const SICUREZZA = {
  'Referrer-Policy': 'no-referrer',            // il link personale non deve finire in giro
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:", "connect-src 'self'", "manifest-src 'self'", "worker-src 'self'",
    "base-uri 'none'", "frame-ancestors 'none'", "form-action 'none'"
  ].join('; ')
};

/**
 * I file dell'app compressi una volta sola all'avvio (brotli e gzip): al telefono
 * arrivano 4-5 volte piu' leggeri, e con l'impronta nell'indirizzo restano in
 * memoria sul telefono finche' non cambiano.
 */
function compressi(nomi) {
  const tipi = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
  const out = new Map();
  for (const nome of nomi) {
    const grezzo = fs.readFileSync(path.join(PUBBLICA, nome));
    out.set('/' + nome, {
      tipo: tipi[path.extname(nome)],
      grezzo,
      br: zlib.brotliCompressSync(grezzo, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }),
      gz: zlib.gzipSync(grezzo, { level: 9 })
    });
  }
  return out;
}

/** Manda testo compresso se il telefono lo accetta. */
function inviaCompresso(req, res, corpo) {
  const accetta = req.get('accept-encoding') || '';
  res.set('Vary', 'Accept-Encoding');
  if (/\bbr\b/.test(accetta)) return res.set('Content-Encoding', 'br').send(zlib.brotliCompressSync(Buffer.from(corpo), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }));
  if (/\bgzip\b/.test(accetta)) return res.set('Content-Encoding', 'gzip').send(zlib.gzipSync(Buffer.from(corpo)));
  return res.send(corpo);
}

/**
 * Freno per chi prova link a caso: dopo troppi tentativi SBAGLIATI da uno stesso
 * indirizzo, i suoi tentativi sbagliati ricevono un'attesa. Chi ha un link valido
 * entra sempre: cosi' nessuno puo' chiudere fuori gli altri.
 */
function frenoTentativi({ massimo = 30, finestraMs = 10 * 60 * 1000 } = {}) {
  const conti = new Map();
  return {
    bloccato(ip) {
      const c = conti.get(ip);
      return !!c && c.n >= massimo && Date.now() - c.da < finestraMs;
    },
    sbagliato(ip) {
      const c = conti.get(ip);
      if (!c || Date.now() - c.da >= finestraMs) conti.set(ip, { n: 1, da: Date.now() });
      else c.n++;
      if (conti.size > 5000) conti.clear();
    }
  };
}

export function creaApp({ db, notifiche, urlPubblico, adesso = () => new Date() }) {
  const app = express();
  const freno = frenoTentativi();
  const ctx = () => ({ urlPubblico, adesso: adesso() });
  const swSorgente = fs.readFileSync(path.join(PUBBLICA, 'sw.js'), 'utf8').replace('__VERSIONE__', IMPRONTA);

  app.disable('x-powered-by');
  // dietro Caddy o un tunnel sul server stesso: l'indirizzo vero sta in X-Forwarded-For
  app.set('trust proxy', 'loopback, uniquelocal');
  app.use((req, res, next) => { res.set(SICUREZZA); next(); });
  app.use(express.json({ limit: '200kb' }));

  app.get('/', (req, res) => res.set('Cache-Control', 'no-store').type('html').send(paginaBenvenuto(IMPRONTA)));
  app.get('/salute', (req, res) => res.set('Cache-Control', 'no-store').json({ ok: true, versione: VERSIONE }));

  const STATICI = compressi(['app.js', 'app.css']);
  app.get(['/statici/app.js', '/statici/app.css'], (req, res) => {
    const f = STATICI.get(req.path.slice('/statici'.length));
    const accetta = req.get('accept-encoding') || '';
    res.set({
      'Content-Type': f.tipo,
      Vary: 'Accept-Encoding',
      // con l'impronta giusta il file non cambia mai: il telefono lo tiene per sempre
      'Cache-Control': req.query.v === IMPRONTA ? 'public, max-age=31536000, immutable' : 'no-cache'
    });
    if (/\bbr\b/.test(accetta)) return res.set('Content-Encoding', 'br').send(f.br);
    if (/\bgzip\b/.test(accetta)) return res.set('Content-Encoding', 'gzip').send(f.gz);
    return res.send(f.grezzo);
  });
  app.use('/statici', express.static(PUBBLICA, { maxAge: '30d', index: false }));

  // ---- tutto quello che sta sotto il link personale
  const u = express.Router({ mergeParams: true });

  app.use('/u/:chiave', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const utente = Q.utentePerChiave(db, req.params.chiave);
    if (!utente) {
      const api = req.path.startsWith('/api/');
      if (freno.bloccato(req.ip)) {
        return api ? res.status(429).json({ ok: false, errore: 'Troppi tentativi. Riprova più tardi.' })
                   : res.status(429).type('text').send('Troppi tentativi. Riprova più tardi.');
      }
      freno.sbagliato(req.ip);
      if (api) return res.status(401).json({ ok: false, errore: 'Link non valido: chiedi quello nuovo all\'amministratore.', linkNonValido: true });
      return res.status(404).type('html').send(paginaLinkNonValido(IMPRONTA));
    }
    req.utente = utente;
    next();
  }, u);

  u.get('/', (req, res) => {
    // serve la barra finale: senza, l'app installata non saprebbe dove sta
    const [percorso, query] = req.originalUrl.split('?');
    if (!percorso.endsWith('/')) return res.redirect(301, percorso + '/' + (query ? '?' + query : ''));
    Q.segnaAccesso(db, req.utente.id);
    const avvio = V.avvio(db, req.utente, { vapid: notifiche.chiavePubblica, adesso: adesso() });
    inviaCompresso(req, res.type('html'), paginaApp(avvio, IMPRONTA));
  });

  u.get('/manifest.webmanifest', (req, res) => res.type('application/manifest+json').send(JSON.stringify(manifest())));

  u.get('/sw.js', (req, res) => res.set('Cache-Control', 'no-cache').type('application/javascript').send(swSorgente));

  u.post('/api/carica', (req, res) => {
    const { vista, parametro } = req.body || {};
    res.json(V.carica(db, req.utente, String(vista || ''), parametro, ctx()));
  });

  u.post('/api/azione', (req, res) => {
    const { azione, carico } = req.body || {};
    Q.segnaAccesso(db, req.utente.id);
    res.json(esegui(db, req.utente, String(azione || ''), carico, ctx()));
  });

  u.post('/api/notifiche/iscrivi', (req, res) => {
    const ok = notifiche.iscrivi(req.utente, req.body && req.body.iscrizione, req.body && req.body.dispositivo);
    res.json(ok ? { ok: true, messaggio: 'Notifiche attivate su questo telefono.' } : { ok: false, errore: 'Iscrizione non valida.' });
  });

  u.post('/api/notifiche/togli', (req, res) => {
    notifiche.togli(req.utente, req.body && req.body.endpoint);
    res.json({ ok: true, messaggio: 'Notifiche spente su questo telefono.' });
  });

  u.post('/api/notifiche/prova', async (req, res, next) => {
    try {
      const esito = await notifiche.invia(req.utente, {
        titolo: '🔔 Prova riuscita', testo: 'Le notifiche di Presenze GAMA arrivano su questo telefono.', percorso: ''
      });
      res.json(esito.push || esito.telegram
        ? { ok: true, messaggio: 'Notifica inviata: dovrebbe arrivare tra pochi secondi.' }
        : { ok: false, errore: 'Nessun telefono iscritto: attiva prima le notifiche.' });
    } catch (e) { next(e); }
  });

  u.get('/foglio/:file', async (req, res, next) => {
    try {
      if (!req.utente.admin) return res.status(403).type('text').send('Solo l\'amministratore scarica il foglio del mese.');
      const m = String(req.params.file).match(/^(\d{4})(0[1-9]|1[0-2])\.xlsx$/);
      if (!m) return res.status(400).type('text').send('Mese non valido.');
      const anno = Number(m[1]), mese0 = Number(m[2]) - 1;
      const manca = Q.mancantiPerIlFoglio(db, anno, mese0);
      if (manca.length) {
        return res.status(409).type('text').send('Il foglio si prepara solo a mese completo: mancano ancora i giorni ' + manca.join(', ') + '.');
      }
      const contenuto = await foglioMese(db, anno, mese0);
      Q.registra(db, 'FOGLIO', nomeScheda(anno, mese0) + ' scaricato da ' + req.utente.nome);
      res.set('Content-Disposition', 'attachment; filename="Presenze ' + nomeScheda(anno, mese0) + '.xlsx"');
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(contenuto);
    } catch (e) { next(e); }
  });

  app.use((req, res) => res.status(404).type('text').send('Pagina non trovata.'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    Q.registra(db, 'ERRORE', req.method + ' ' + req.path.replace(/\/u\/[^/]+/, '/u/…') + ': ' + ((err && err.stack) || err));
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ ok: false, errore: 'Richiesta non valida.' });
    res.status(500).json({ ok: false, errore: 'Qualcosa è andato storto sul server. Riprova.' });
  });

  return app;
}

// ---------------------------------------------------------------- avvio vero

function principale() {
  const E = env();
  const db = apri(percorsoDb(E.CARTELLA_DATI));
  const notifiche = creaNotifiche(db, { urlPubblico: E.URL_PUBBLICO, telegramToken: E.TELEGRAM_TOKEN });
  const orologio = creaOrologio(db, { notifiche, cartellaDati: E.CARTELLA_DATI });

  const app = creaApp({ db, notifiche, urlPubblico: E.URL_PUBBLICO });
  const server = app.listen(E.PORTA, (err) => {
    // Express 5 passa qui anche l'errore: senza questo controllo, con la porta
    // gia' occupata scriverebbe "in ascolto" e poi si spegnerebbe in silenzio.
    if (err) {
      console.error('Non riesco ad ascoltare sulla porta ' + E.PORTA + ': ' + (err.code === 'EADDRINUSE'
        ? 'è già usata da un altro programma (forse un\'altra copia di Presenze GAMA già accesa).'
        : err.message));
      process.exit(1);
    }
    orologio.avvia();
    const utenti = Q.utentiAttivi(db);
    console.log('Presenze GAMA ' + VERSIONE + ' in ascolto sulla porta ' + E.PORTA + ' — indirizzo pubblico: ' + E.URL_PUBBLICO);
    console.log('Dati in ' + path.resolve(E.CARTELLA_DATI) + ' — utenti attivi: ' + utenti.length);
    if (!utenti.length) {
      console.log('Nessun utente: crea il primo amministratore con   npm run cli -- nuovo-admin "Giuliano"');
    }
    if (!E.URL_PUBBLICO.startsWith('https://')) {
      console.log('ATTENZIONE: URL_PUBBLICO non è https. Sui telefoni notifiche e installazione funzionano solo in https.');
    }
  });

  // Spegnimento ordinato (docker stop, systemctl stop, Ctrl+C): si chiude il
  // database, cosi' il file presenze.sqlite resta completo e autosufficiente.
  let inChiusura = false;
  const chiudi = (segnale) => {
    if (inChiusura) return;
    inChiusura = true;
    console.log('Ricevuto ' + segnale + ': chiudo.');
    server.close(() => { try { db.close(); } catch { /* gia' chiuso */ } process.exit(0); });
    setTimeout(() => { try { db.close(); } catch { /* gia' chiuso */ } process.exit(0); }, 4000).unref();
  };
  process.on('SIGTERM', () => chiudi('SIGTERM'));
  process.on('SIGINT', () => chiudi('SIGINT'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) principale();
