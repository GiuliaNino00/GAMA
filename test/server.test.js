// Il server dall'esterno: link personali, pagine, chiamate, foglio, sicurezza.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { banco, ADESSO } from './aiuto.js';
import { creaApp } from '../src/server.js';
import { creaNotifiche } from '../src/notifiche.js';

let server, base, B;
const spediti = [];

before(async () => {
  B = banco();
  const notifiche = creaNotifiche(B.db, { urlPubblico: 'https://x.it', trasportoPush: async (s, p) => { spediti.push(JSON.parse(p)); } });
  const app = creaApp({ db: B.db, notifiche, urlPubblico: 'https://x.it', adesso: () => ADESSO });
  await new Promise((ok) => { server = app.listen(0, ok); });
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => server.close());

const link = (u) => base + '/u/' + u.chiave + '/';
const post = (u, percorso, corpo) => fetch(link(u) + percorso, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo)
}).then((r) => r.json());

test('pagine di cortesia e link sbagliati', async () => {
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/salute')).status, 200);
  const r = await fetch(base + '/u/questolinknonesistedavvero/');
  assert.equal(r.status, 404);
  assert.match(await r.text(), /Link non valido/);
  const api = await fetch(base + '/u/questolinknonesistedavvero/api/carica', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(api.status, 401);
});

test('il link senza barra finale viene corretto', async () => {
  const r = await fetch(base + '/u/' + B.matteo.chiave, { redirect: 'manual' });
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), '/u/' + B.matteo.chiave + '/');
});

test('la pagina arriva gia\' piena, con le protezioni giuste', async () => {
  const r = await fetch(link(B.matteo));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  const html = await r.text();
  const avvio = JSON.parse(html.match(/<script type="application\/json" id="avvio">([\s\S]*?)<\/script>/)[1]);
  assert.equal(avvio.utente, 'Matteo');
  assert.equal(avvio.ambito, 'Muratori');
  assert.equal(avvio.appello.righe.length, 3);
  assert.ok(avvio.vapid.length > 60);
  assert.ok(!html.includes("D'AMORE"), 'nella pagina di Matteo non c\'e\' nessun carpentiere');
});

test('manifest e service worker stanno sotto il link personale', async () => {
  const m = await (await fetch(link(B.matteo) + 'manifest.webmanifest')).json();
  assert.equal(m.scope, './');
  assert.equal(m.start_url, './');
  assert.equal(m.display, 'standalone');
  const sw = await fetch(link(B.matteo) + 'sw.js');
  assert.match(sw.headers.get('content-type'), /javascript/);
  const testoSw = await sw.text();
  assert.match(testoSw, /const VERSIONE = '[0-9a-f]{12}'/, 'impronta dei file, non numero a mano');
  const html = await (await fetch(link(B.matteo))).text();
  const impronta = testoSw.match(/const VERSIONE = '([0-9a-f]{12})'/)[1];
  assert.ok(html.includes('app.js?v=' + impronta), 'pagina e service worker usano la stessa impronta');
});

test('leggere e scrivere passando dal server', async () => {
  const salva = await post(B.matteo, 'api/azione', { azione: 'salvaAppello', carico: { d: '20260916', stati: { 'PIPERIS P.': 'MEZ', 'PIPERIS G.': 'ORD' } } });
  assert.deepEqual(salva, { ok: true, messaggio: '2 al lavoro, 12 ore registrate.' });
  const a = await post(B.matteo, 'api/carica', { vista: 'appello', parametro: '20260916' });
  assert.equal(a.dati.giaFatto, 'Matteo');
  assert.equal(a.dati.righe[0].stato, 'MEZ');
  const non = await post(B.matteo, 'api/carica', { vista: 'utenti' });
  assert.equal(non.ok, false);
  const bad = await fetch(link(B.matteo) + 'api/azione', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{rotto' });
  assert.equal(bad.status, 400);
});

test('il foglio del mese lo scarica solo l\'amministratore', async () => {
  assert.equal((await fetch(link(B.matteo) + 'foglio/202609.xlsx')).status, 403);
  assert.equal((await fetch(link(B.giuliano) + 'foglio/202613.xlsx')).status, 400);
  const r = await fetch(link(B.giuliano) + 'foglio/202609.xlsx');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /Presenze SETTEMBRE 2026\.xlsx/);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await r.arrayBuffer()));
  assert.equal(wb.worksheets[0].name, 'SETTEMBRE 2026');
});

test('notifiche: iscrizione e prova', async () => {
  assert.equal((await post(B.antonio, 'api/notifiche/prova', {})).ok, false, 'senza iscrizione non parte niente');
  const isc = await post(B.antonio, 'api/notifiche/iscrivi', {
    iscrizione: { endpoint: 'https://push.esempio.com/abc', keys: { p256dh: 'p', auth: 'a' } }, dispositivo: 'Android'
  });
  assert.equal(isc.ok, true);
  assert.equal((await post(B.antonio, 'api/notifiche/prova', {})).ok, true);
  assert.equal(spediti.at(-1).titolo, '🔔 Prova riuscita');
  assert.equal((await post(B.antonio, 'api/notifiche/togli', { endpoint: 'https://push.esempio.com/abc' })).ok, true);
});

test('chi prova link a caso viene fermato, ma chi ha il link giusto entra sempre', async () => {
  let ultimo;
  for (let i = 0; i < 31; i++) ultimo = await fetch(base + '/u/tentativo' + i + 'abcdefghijkl/');
  assert.equal(ultimo.status, 429);
  const api = await fetch(base + '/u/tentativoxyzabcdefghijkl/api/carica', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(api.status, 429);
  assert.equal((await api.json()).ok, false, 'anche il 429 delle chiamate e\' JSON');
  // dallo stesso indirizzo (dietro un tunnel sono tutti uguali) i link veri funzionano
  assert.equal((await fetch(link(B.matteo))).status, 200);
  assert.equal((await post(B.antonio, 'api/carica', { vista: 'giorni' })).ok, true);
});

test('spegnimento ordinato: il database si chiude e non resta il file -wal', async () => {
  const { spawn } = await import('node:child_process');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'gama-stop-'));
  const porta = 39000 + Math.floor(Math.random() * 900);
  const p = spawn(process.execPath, ['src/server.js'], { env: { ...process.env, CARTELLA_DATI: cartella, PORTA: String(porta) }, stdio: 'pipe' });
  await new Promise((ok, ko) => {
    let uscita = '';
    p.stdout.on('data', (d) => { uscita += d; if (uscita.includes('in ascolto')) ok(); });
    setTimeout(() => ko(new Error('il server non e\' partito: ' + uscita)), 8000);
  });
  assert.equal((await fetch('http://127.0.0.1:' + porta + '/salute')).status, 200);
  const codice = await new Promise((ok) => { p.on('exit', ok); p.kill('SIGTERM'); });
  assert.equal(codice, 0);
  assert.equal(fs.existsSync(path.join(cartella, 'presenze.sqlite-wal')), false);
  assert.equal(fs.existsSync(path.join(cartella, 'presenze.sqlite')), true);
});

test('i file dell\'app arrivano compressi e restano in memoria sul telefono', async () => {
  const html = await (await fetch(link(B.matteo))).text();
  const v = html.match(/app\.js\?v=([0-9a-f]{12})/)[1];
  const r = await fetch(base + '/statici/app.js?v=' + v, { headers: { 'Accept-Encoding': 'br' } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.match(await r.text(), /PRESENZE GAMA/, 'fetch decomprime da solo: il contenuto e\' quello giusto');
  const vecchio = await fetch(base + '/statici/app.css?v=vecchio');
  assert.equal(vecchio.headers.get('cache-control'), 'no-cache', 'impronta sbagliata: niente cache lunga');
  const pagina = await fetch(link(B.matteo), { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(pagina.headers.get('vary'), 'Accept-Encoding');
});
