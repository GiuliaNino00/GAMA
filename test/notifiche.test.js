// Le notifiche: iscrizione, invio, pulizia dei telefoni spariti, Telegram facoltativo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { banco } from './aiuto.js';
import { creaNotifiche, chiaviVapid } from '../src/notifiche.js';
import * as Q from '../src/dati.js';

const sub = (n) => ({ endpoint: 'https://push.esempio.com/' + n, keys: { p256dh: 'p' + n, auth: 'a' + n } });

test('le chiavi VAPID nascono una volta sola e restano', () => {
  const { db } = banco();
  const a = chiaviVapid(db), b = chiaviVapid(db);
  assert.equal(a.pubblica, b.pubblica);
  assert.ok(a.pubblica.length > 60);
});

test('iscrizione: si accettano solo iscrizioni vere', () => {
  const { db, matteo } = banco();
  const n = creaNotifiche(db, { urlPubblico: 'https://x.it', trasportoPush: async () => {} });
  assert.equal(n.iscrivi(matteo, sub(1), 'Android'), true);
  assert.equal(n.iscrivi(matteo, sub(1), 'Android'), true, 'stessa iscrizione: nessun doppione');
  assert.equal(n.attive(matteo), 1);
  assert.equal(n.iscrivi(matteo, { endpoint: 'http://non-https' , keys: { p256dh: 'x', auth: 'y' } }), false);
  assert.equal(n.iscrivi(matteo, { endpoint: 'https://x' }), false);
  assert.equal(n.iscrivi(matteo, null), false);
});

test('invio a tutti i telefoni dell\'utente, con la schermata giusta da aprire', async () => {
  const { db, matteo } = banco();
  const spediti = [];
  const n = creaNotifiche(db, { urlPubblico: 'https://x.it', trasportoPush: async (s, payload, opz) => { spediti.push({ s, payload: JSON.parse(payload), opz }); } });
  n.iscrivi(matteo, sub(1)); n.iscrivi(matteo, sub(2));
  const esito = await n.invia(matteo, { titolo: 'T', testo: 'X', percorso: 'appello/20260916' });
  assert.equal(esito.push, 2);
  assert.equal(spediti[0].payload.url, 'https://x.it/u/' + matteo.chiave + '/#appello/20260916');
  assert.equal(spediti[0].payload.tag, 'appello');
  assert.equal(spediti[0].opz.vapidDetails.subject, 'https://x.it');
});

test('un telefono che ha tolto il permesso (410) viene dimenticato', async () => {
  const { db, matteo } = banco();
  const n = creaNotifiche(db, {
    urlPubblico: 'https://x.it',
    trasportoPush: async (s) => { if (s.endpoint.endsWith('/2')) { const e = new Error('gone'); e.statusCode = 410; throw e; } }
  });
  n.iscrivi(matteo, sub(1)); n.iscrivi(matteo, sub(2));
  const esito = await n.invia(matteo, { titolo: 'T', testo: 'X' });
  assert.deepEqual([esito.push, esito.falliti], [1, 1]);
  assert.equal(n.attive(matteo), 1);
});

test('Telegram solo se configurato e solo per chi ha il suo codice', async () => {
  const { db, matteo, antonio } = banco();
  Q.aggiornaUtente(db, matteo.id, { telegram: '333' });
  const chiamate = [];
  const n = creaNotifiche(db, {
    urlPubblico: 'https://x.it', telegramToken: 'TOKEN',
    trasportoPush: async () => {}, trasportoTelegram: async (t, p) => { chiamate.push({ t, p }); return true; }
  });
  assert.equal((await n.invia(Q.utentePerId(db, matteo.id), { titolo: 'Ciao', testo: 'prova', percorso: 'giorni' })).telegram, true);
  assert.equal(chiamate[0].p.chat_id, '333');
  assert.match(chiamate[0].p.reply_markup.inline_keyboard[0][0].url, /#giorni$/);
  await n.invia(antonio, { titolo: 'Ciao', testo: 'prova' });
  assert.equal(chiamate.length, 1, 'Antonio non ha il codice Telegram');

  const senza = creaNotifiche(db, { urlPubblico: 'https://x.it', trasportoPush: async () => {}, trasportoTelegram: async () => { throw new Error('non dovevo partire'); } });
  assert.equal((await senza.invia(Q.utentePerId(db, matteo.id), { titolo: 'a', testo: 'b' })).telegram, false);
});

test('ogni invio ha un tempo massimo e un telefono lento non blocca gli altri', async () => {
  const { db, matteo } = banco();
  const opzioniViste = [];
  const n = creaNotifiche(db, {
    urlPubblico: 'https://x.it',
    trasportoPush: (s, p, opz) => { opzioniViste.push(opz); return s.endpoint.endsWith('/1') ? new Promise(() => {}) : Promise.resolve(); }
  });
  n.iscrivi(matteo, sub(1)); n.iscrivi(matteo, sub(2));
  // il primo telefono non risponde mai: il secondo deve comunque essere servito subito
  const gara = await Promise.race([
    (async () => { n.invia(matteo, { titolo: 'T', testo: 'X' }); await new Promise((ok) => setTimeout(ok, 30)); return opzioniViste.length; })(),
    new Promise((ok) => setTimeout(() => ok(-1), 500))
  ]);
  assert.equal(gara, 2, 'i due invii partono insieme');
  assert.equal(opzioniViste[0].timeout, 15000);
});

test('riallineare la stessa iscrizione a ogni apertura non riempie il registro', () => {
  const { db, matteo } = banco();
  const n = creaNotifiche(db, { urlPubblico: 'https://x.it', trasportoPush: async () => {} });
  for (let i = 0; i < 5; i++) n.iscrivi(matteo, sub(9), 'Android');
  const righe = db.prepare("SELECT COUNT(*) AS n FROM registro WHERE tipo = 'NOTIFICHE'").get().n;
  assert.equal(righe, 1);
});
