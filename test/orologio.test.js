// I promemoria automatici: quando partono, a chi, e mai due volte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { banco, notificheFinte } from './aiuto.js';
import { lavoriDovuti, creaOrologio } from '../src/orologio.js';
import { esegui } from '../src/azioni.js';
import * as Q from '../src/dati.js';

const ora = (g, h, m = 0) => new Date(2026, 8, g, h, m);   // settembre 2026

test('quando partono i lavori', () => {
  // la copia notturna e' gia' stata fatta, cosi' si guarda solo il resto
  const b = (g) => ({ backup: '2026-09-' + String(g).padStart(2, '0') });
  assert.deepEqual(lavoriDovuti(ora(16, 17, 59), b(16)), []);
  assert.deepEqual(lavoriDovuti(ora(16, 18, 0), b(16)), ['appello']);
  assert.deepEqual(lavoriDovuti(ora(16, 20, 30), b(16)), ['appello'], 'server riacceso: recupera entro 3 ore');
  assert.deepEqual(lavoriDovuti(ora(16, 21, 1), b(16)), [], 'troppo tardi per il promemoria');
  assert.deepEqual(lavoriDovuti(ora(16, 18, 5), { ...b(16), appello: '2026-09-16' }), [], 'gia\' fatto oggi');
  assert.deepEqual(lavoriDovuti(ora(13, 18, 5), b(13)), [], 'domenica niente appello');
  assert.deepEqual(lavoriDovuti(ora(13, 20, 10), b(13)), ['settimana']);
  assert.deepEqual(lavoriDovuti(ora(12, 18, 10), b(12)), ['appello'], 'il sabato si');
  assert.deepEqual(lavoriDovuti(new Date(2026, 9, 1, 8, 30), { backup: '2026-10-01' }), ['mese']);
  // la copia notturna: alle 2, oppure appena il server riparte se era spento
  assert.deepEqual(lavoriDovuti(ora(16, 1, 59), {}), []);
  assert.deepEqual(lavoriDovuti(ora(16, 2, 30), {}), ['backup']);
  assert.deepEqual(lavoriDovuti(ora(16, 15, 0), {}), ['backup'], 'recupero dopo uno spegnimento');
});

test('alle 18 il promemoria va solo a chi non ha ancora fatto l\'appello', async () => {
  const { db, matteo, antonio } = banco();
  // giornate precedenti tutte compilate, cosi' contano solo quelle di oggi
  for (let g = 3; g <= 15; g++) {
    const d = '202609' + String(g).padStart(2, '0');
    esegui(db, matteo, 'salvaAppello', { d, stati: { 'PIPERIS P.': 'ORD' } }, { adesso: ora(16, 19) });
    esegui(db, antonio, 'salvaAppello', { d, stati: { "D'AMORE E.": 'ORD' } }, { adesso: ora(16, 19) });
  }
  esegui(db, antonio, 'salvaAppello', { d: '20260916', stati: { "D'AMORE E.": 'ORD' } }, { adesso: ora(16, 19) });

  const notifiche = notificheFinte();
  const orologio = creaOrologio(db, { notifiche, adesso: () => ora(16, 18, 1) });
  await orologio.giro();
  const destinatari = notifiche.inviate.map((n) => n.a).sort();
  assert.deepEqual(destinatari, ['Giuliano', 'Matteo'], 'Antonio ha gia\' fatto; Giuliano vede che manca Matteo');
  const m = notifiche.inviate.find((n) => n.a === 'Matteo');
  assert.equal(m.percorso, 'appello/20260916');
  assert.equal(m.titolo, '📋 Appello di oggi');

  await orologio.giro();
  assert.equal(notifiche.inviate.length, 2, 'un secondo giro non rimanda niente');
});

test('a chi non ha nessuno da segnare non arriva niente', async () => {
  const { db, matteo } = banco();
  Q.aggiornaUtente(db, matteo.id, { squadra: '' });
  const notifiche = notificheFinte();
  await creaOrologio(db, { notifiche, adesso: () => ora(16, 18, 1) }).giro();
  assert.ok(!notifiche.inviate.some((n) => n.a === 'Matteo'));
});

test('la domenica il riepilogo, il primo del mese il foglio pronto per l\'amministratore', async () => {
  const { db } = banco();
  const n1 = notificheFinte();
  await creaOrologio(db, { notifiche: n1, adesso: () => ora(20, 20, 5) }).giro();
  assert.equal(n1.inviate.length, 3);
  assert.ok(n1.inviate.every((n) => n.percorso === 'settimana'));

  const n2 = notificheFinte();
  await creaOrologio(db, { notifiche: n2, adesso: () => new Date(2026, 9, 1, 8, 5) }).giro();
  const admin = n2.inviate.find((n) => n.a === 'Giuliano');
  assert.equal(admin.percorso, 'mese/202609');
  assert.match(admin.testo, /pronto da scaricare/);
  assert.match(n2.inviate.find((n) => n.a === 'Matteo').testo, /riepilogo/);
});

test('due giri sovrapposti (notifiche lente) non mandano niente due volte', async () => {
  const { db } = banco();
  const inviate = [];
  const lente = { async invia(u, m) { await new Promise((ok) => setTimeout(ok, 50)); inviate.push(u.nome + ':' + m.percorso); return {}; } };
  const orologio = creaOrologio(db, { notifiche: lente, adesso: () => new Date(2026, 9, 1, 18, 30) });
  await Promise.all([orologio.giro(), orologio.giro(), orologio.giro()]);
  const mese = inviate.filter((x) => x.includes('mese/'));
  assert.equal(mese.length, 3, 'una notifica "mese chiuso" a testa, non di piu\'');
  assert.equal(new Set(inviate).size, inviate.length);
});
