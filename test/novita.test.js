// Versione 2.3: pioggia, sabato a trasferta, cantieri del mese con la conferma, documento PDF.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { banco, ADESSO, compilaMese, confermaMese, notificheFinte } from './aiuto.js';
import * as Q from '../src/dati.js';
import * as V from '../src/viste.js';
import * as D from '../src/date.js';
import { esegui } from '../src/azioni.js';
import { foglioMese } from '../src/foglio.js';
import { documentoMese } from '../src/documento.js';
import { totaliMese } from '../src/totali.js';
import { creaOrologio } from '../src/orologio.js';

const ctx = { urlPubblico: 'https://x', adesso: ADESSO };     // mercoledi' 16 settembre 2026
const leggi = async (buf) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); return wb; };
const rigaDi = (foglio, nome) => { let t = null; foglio.eachRow((r) => { if (r.getCell(1).value === nome) t = r; }); return t; };

// ---------------------------------------------------------------- pioggia

test('pioggia: si segna, conta come giorno fatto, non come lavoro ne\' assenza', async () => {
  const { db, matteo, giuliano } = banco();
  const r = esegui(db, matteo, 'salvaAppello', { d: '20260914', stati: { 'PIPERIS P.': 'PIO', 'PIPERIS G.': 'PIO', 'ZUCCARO D.': 'ORD' } }, ctx);
  assert.deepEqual(r, { ok: true, messaggio: '1 al lavoro, 8 ore registrate.' });
  assert.equal(Q.presenzeDelGiorno(db, '2026-09-14')['PIPERIS P.'].codice, 'PIO');
  assert.equal(V.carica(db, matteo, 'giorni', null, ctx).dati.find((g) => g.codice === '20260914').fatto, true);

  const s = V.carica(db, matteo, 'settimana', null, ctx).dati;
  assert.deepEqual(s.righe.map((x) => [x.nome, x.gg, x.ore, x.pio]),
    [['PIPERIS P.', 0, 0, 1], ['PIPERIS G.', 0, 0, 1], ['ZUCCARO D.', 1, 8, 0]]);

  esegui(db, giuliano, 'salvaAppello', { d: '20260901', stati: { 'PIPERIS P.': 'PIO' } }, ctx);
  const wb = await leggi(await foglioMese(db, 2026, 8));
  const ws = wb.getWorksheet('SETTEMBRE 2026');
  assert.equal(ws.getCell('A11').value, 'pioggia');
  assert.deepEqual([ws.getCell('B11').value, ws.getCell('B5').value], [8, null], 'il 1° nella riga pioggia, non in ord.');
  assert.equal(ws.getCell('O11').value, 8, 'e il 14');
  assert.equal(rigaDi(wb.getWorksheet('RIEPILOGO'), 'PIPERIS P.').getCell(9).value, 2, 'colonna Pioggia (gg)');
});

// ---------------------------------------------------------------- sabato

test('sabato: niente ore, trasferte in euro con gli stessi controlli dell\'appello', () => {
  const { db, matteo } = banco();
  const noOre = esegui(db, matteo, 'salvaAppello', { d: '20260912', stati: { 'PIPERIS P.': 'ORD' } }, ctx);
  assert.equal(noOre.ok, false);
  assert.match(noOre.errore, /trasferte/);
  assert.equal(esegui(db, matteo, 'salvaSabato', { d: '20260914', importi: { 'PIPERIS P.': 50 } }, ctx).ok, false, 'solo di sabato');
  assert.equal(esegui(db, matteo, 'salvaSabato', { d: '20260919', importi: { 'PIPERIS P.': 50 } }, ctx).ok, false, 'non nel futuro');
  for (const sbagliata of [-5, 'tanto', 20000, true]) {
    assert.equal(esegui(db, matteo, 'salvaSabato', { d: '20260912', importi: { 'PIPERIS P.': sbagliata } }, ctx).ok, false, String(sbagliata));
  }
  assert.equal(esegui(db, matteo, 'salvaSabato', { d: '20260912', importi: { "D'AMORE E.": 50 } }, ctx).ok, false, 'non la squadra di un altro');

  const ok = esegui(db, matteo, 'salvaSabato', { d: '20260912', importi: { 'PIPERIS P.': '50,5', 'PIPERIS G.': 0, 'ZUCCARO D.': 70 } }, ctx);
  assert.deepEqual(ok, { ok: true, messaggio: '2 in trasferta, 120,50 €.' });
  assert.deepEqual(Q.sabatoDelGiorno(db, '2026-09-12')['PIPERIS P.'].importo, 50.5);
  assert.equal(V.carica(db, matteo, 'giorni', null, ctx).dati.find((g) => g.codice === '20260912').fatto, true, 'il sabato e\' compilato');
  assert.equal(Q.presenzeDelGiorno(db, '2026-09-12')['PIPERIS P.'], undefined, 'e non ha ore');
});

test('sabato: il valore consigliato e\' l\'ultima trasferta maggiore di zero', () => {
  const { db, giuliano, matteo } = banco();
  esegui(db, giuliano, 'salvaSabato', { d: '20260829', importi: { 'PIPERIS P.': 60, 'PIPERIS G.': 40 } }, ctx);
  esegui(db, giuliano, 'salvaSabato', { d: '20260905', importi: { 'PIPERIS P.': 0, 'PIPERIS G.': 45 } }, ctx);
  const a = V.carica(db, matteo, 'appello', '20260912', ctx).dati;
  assert.equal(a.sabato, true);
  assert.deepEqual(a.righe.map((r) => [r.nome, r.importo, r.suggerito]),
    [['PIPERIS P.', null, 60], ['PIPERIS G.', null, 45], ['ZUCCARO D.', null, null]]);
  // salvato: riapre con le cifre salvate, e il consiglio resta quello dei sabati prima
  esegui(db, matteo, 'salvaSabato', { d: '20260912', importi: { 'PIPERIS P.': 55, 'PIPERIS G.': 0, 'ZUCCARO D.': 0 } }, ctx);
  const b = V.carica(db, matteo, 'appello', '20260912', ctx).dati;
  assert.deepEqual(b.righe.map((r) => [r.importo, r.suggerito]), [[55, 60], [0, 45], [0, null]]);
  assert.equal(b.giaFatto, 'Matteo');
});

test('sabato: chi salva per secondo vede la versione nuova (impronta)', () => {
  const { db, matteo } = banco();
  const vecchia = V.carica(db, matteo, 'appello', '20260912', ctx).dati.impronta;
  esegui(db, matteo, 'salvaSabato', { d: '20260912', importi: { 'PIPERIS P.': 50 } }, ctx);
  const r = esegui(db, matteo, 'salvaSabato', { d: '20260912', importi: { 'PIPERIS P.': 80 }, impronta: vecchia }, ctx);
  assert.equal(r.conflitto, true);
  assert.equal(r.dati.righe[0].importo, 50);
});

test('report: i sabati non sono nella griglia ne\' nelle ore, ma nella tabella TRASFERTE', async () => {
  const { db, giuliano } = banco();
  compilaMese(db, 2026, 7);                                        // agosto 2026: 5 sabati a 0
  esegui(db, giuliano, 'salvaSabato', { d: '20260801', importi: { 'PIPERIS P.': 50, "D'AMORE E.": 70 } }, ctx);
  esegui(db, giuliano, 'salvaSabato', { d: '20260808', importi: { 'PIPERIS P.': 50 } }, ctx);
  const T = totaliMese(db, 2026, 7);
  assert.deepEqual(T.trasferte.map((t) => [t.nome, t.sabati, t.euro]), [['PIPERIS P.', 2, 100], ["D'AMORE E.", 1, 70]]);
  assert.deepEqual(T.totTrasferte, { sabati: 3, euro: 170 });

  const wb = await leggi(await foglioMese(db, 2026, 7));
  const ws = wb.getWorksheet('AGOSTO 2026');
  assert.equal(ws.getCell('B5').value, null, 'il 1° agosto (sabato) e\' vuoto nella griglia');
  assert.equal(ws.getCell('D5').value, 8, 'il 3 agosto (lunedi\') ha le ore');
  const p = rigaDi(wb.getWorksheet('RIEPILOGO'), 'PIPERIS P.');
  assert.deepEqual([p.getCell(4).value, p.getCell(5).value], [21, 168], 'solo i 21 giorni dal lunedi\' al venerdi\'');
  const ts = wb.getWorksheet('TRASFERTE');
  assert.deepEqual(ts.getRow(1).values.slice(1), ['Dipendente', 'Cantiere', 'Sabati in trasferta', 'Trasferte €']);
  assert.deepEqual(rigaDi(ts, 'PIPERIS P.').values.slice(1).filter((v) => v !== ''), ['PIPERIS P.', 2, 100]);
  assert.deepEqual([rigaDi(ts, 'TOTALE').getCell(3).value, rigaDi(ts, 'TOTALE').getCell(4).value], [3, 170]);
  assert.equal(rigaDi(ts, 'ZUCCARO D.'), null, 'chi non ha trasferte non c\'e\'');

  const m = V.carica(db, giuliano, 'mese', '202608', ctx).dati;
  assert.equal(m.trasferteTotali, 170, 'anche nel riepilogo dell\'app, a parte');
  assert.equal(m.righe.find((x) => x.nome === 'PIPERIS P.').trasferte, 100);
});

// ---------------------------------------------------------------- cantieri

test('cantieri: li gestiscono amministratore e agenzia; il mese dopo eredita, il mese prima non cambia', () => {
  const { db, giuliano, matteo } = banco();
  const ag = Q.creaUtente(db, { nome: 'Studio Paghe', agenzia: true });
  assert.equal(esegui(db, matteo, 'nuovoCantiere', { nome: 'Via Roma' }, ctx).ok, false, 'il socio no');
  const roma = esegui(db, ag, 'nuovoCantiere', { nome: 'Via Roma - Bari' }, ctx);
  const scuola = esegui(db, giuliano, 'nuovoCantiere', { nome: 'Scuola Molfetta' }, ctx);
  assert.equal(esegui(db, giuliano, 'nuovoCantiere', { nome: 'via roma - bari' }, ctx).ok, false, 'niente doppioni');
  assert.equal(esegui(db, matteo, 'assegnaCantiere', { nome: 'PIPERIS P.', mese: '2026-09', cantiere: roma.id }, ctx).ok, false);

  assert.equal(esegui(db, ag, 'assegnaCantiere', { nome: 'PIPERIS P.', mese: '2026-09', cantiere: roma.id }, ctx).ok, true);
  assert.equal(esegui(db, ag, 'assegnaCantiere', { nome: 'PIPERIS P.', mese: '2026-11', cantiere: roma.id }, ctx).ok, false, 'al massimo il mese prossimo');
  const ott = Q.cantieriDelMese(db, '2026-10').get(Q.dipendentePerNome(db, 'PIPERIS P.').id);
  assert.deepEqual([ott.nome, ott.ereditato], ['Via Roma - Bari', true], 'ottobre eredita da settembre');

  assert.equal(esegui(db, ag, 'assegnaCantiere', { nome: 'PIPERIS P.', mese: '2026-10', cantiere: scuola.id }, ctx).ok, true, 'si prepara ottobre');
  const id = Q.dipendentePerNome(db, 'PIPERIS P.').id;
  assert.equal(Q.cantieriDelMese(db, '2026-09').get(id).nome, 'Via Roma - Bari', 'settembre non cambia');
  assert.equal(Q.cantieriDelMese(db, '2026-10').get(id).nome, 'Scuola Molfetta');

  esegui(db, giuliano, 'attivaCantiere', { id: roma.id, attivo: false }, ctx);
  assert.equal(esegui(db, ag, 'assegnaCantiere', { nome: 'PIPERIS G.', mese: '2026-09', cantiere: roma.id }, ctx).ok, false, 'un cantiere spento non si sceglie');
  assert.equal(V.carica(db, matteo, 'cantieri', '2026-09', ctx).ok, false, 'il socio non apre la schermata');
  assert.equal(V.carica(db, matteo, 'dipendenti', null, ctx).dati.find((x) => x.nome === 'PIPERIS P.').cantiere, 'Via Roma - Bari', 'ma lo vede');
});

test('cantieri nel report: riquadro azzurro, colonna nel RIEPILOGO e nelle TRASFERTE', async () => {
  const { db, giuliano } = banco();
  const roma = Q.aggiungiCantiere(db, 'Via Roma - Bari').id;
  Q.assegnaCantiere(db, Q.dipendentePerNome(db, 'PIPERIS P.').id, '2026-09', roma, 'prova');
  esegui(db, giuliano, 'salvaAppello', { d: '20260901', stati: { 'PIPERIS P.': 'ORD' } }, ctx);
  esegui(db, giuliano, 'salvaSabato', { d: '20260905', importi: { 'PIPERIS P.': 40 } }, ctx);
  const wb = await leggi(await foglioMese(db, 2026, 8));
  assert.equal(wb.getWorksheet('SETTEMBRE 2026').getCell('I2').value, 'Via Roma - Bari');
  assert.equal(wb.getWorksheet('SETTEMBRE 2026').getCell('I15').value, 'MURATORI', 'senza cantiere resta la squadra');
  assert.equal(rigaDi(wb.getWorksheet('RIEPILOGO'), 'PIPERIS P.').getCell(3).value, 'Via Roma - Bari');
  assert.equal(rigaDi(wb.getWorksheet('TRASFERTE'), 'PIPERIS P.').getCell(2).value, 'Via Roma - Bari');
});

test('conferma dei cantieri: da 3 giorni prima della fine del mese finche\' non si conferma', async () => {
  const { db, giuliano, matteo } = banco();
  const ag = Q.creaUtente(db, { nome: 'Studio Paghe', agenzia: true });
  const mesi = (d) => Q.cantieriDaConfermare(db, d).map((m) => m.mese);
  assert.deepEqual(mesi(new Date(2026, 8, 16)), ['2026-09']);
  assert.deepEqual(mesi(new Date(2026, 8, 27)), ['2026-09'], 'il 27 settembre non ancora ottobre');
  assert.deepEqual(mesi(new Date(2026, 8, 28)), ['2026-09', '2026-10'], 'dal 28 (3 giorni prima) anche ottobre');
  assert.equal(esegui(db, ag, 'confermaCantieri', { mese: '2026-09' }, { adesso: new Date(2026, 8, 28) }).ok, true);
  assert.equal(esegui(db, matteo, 'confermaCantieri', { mese: '2026-10' }, ctx).ok, false, 'il socio non conferma');
  assert.deepEqual(mesi(new Date(2026, 8, 28)), ['2026-10']);

  // l'avviso delle 9: ad amministratore e agenzia, non ai soci; poi si ferma
  const n = notificheFinte();
  await creaOrologio(db, { notifiche: n, adesso: () => new Date(2026, 8, 29, 9, 5) }).giro();
  const avvisi = n.inviate.filter((x) => x.titolo.startsWith('🏗️'));
  assert.deepEqual(avvisi.map((x) => x.a).sort(), ['Giuliano', 'Studio Paghe']);
  assert.equal(avvisi[0].percorso, 'cantieri/2026-10');
  assert.match(avvisi[0].testo, /Prima che inizi il mese/);
  esegui(db, giuliano, 'confermaCantieri', { mese: '2026-10' }, { adesso: new Date(2026, 8, 29) });
  const n2 = notificheFinte();
  await creaOrologio(db, { notifiche: n2, adesso: () => new Date(2026, 8, 30, 9, 5) }).giro();
  assert.ok(!n2.inviate.some((x) => x.titolo.startsWith('🏗️')), 'confermato: niente avviso');

  // nella plancia, la tessera solo a chi vede tutto
  assert.deepEqual(V.carica(db, ag, 'home', null, { adesso: new Date(2026, 9, 29, 10) }).dati.cantieri.map((m) => m.mese), ['2026-11']);
  assert.deepEqual(V.carica(db, matteo, 'home', null, { adesso: new Date(2026, 9, 29, 10) }).dati.cantieri, []);
});

test('conferma: si vede chi ha confermato, e se qualcuno ha cambiato dopo', () => {
  const { db, giuliano } = banco();
  const ag = Q.creaUtente(db, { nome: 'Studio Paghe', agenzia: true });
  const roma = Q.aggiungiCantiere(db, 'Via Roma - Bari').id;
  esegui(db, ag, 'confermaCantieri', { mese: '2026-09' }, ctx);
  db.prepare("UPDATE conferme_cantieri SET quando = '2026-09-10 08:00:00'").run();
  assert.deepEqual(Q.confermaDel(db, '2026-09'), { da: 'Studio Paghe', quando: '2026-09-10 08:00:00', modificatoDopo: '' });
  esegui(db, giuliano, 'assegnaCantiere', { nome: 'ZUCCARO D.', mese: '2026-09', cantiere: roma }, ctx);
  assert.equal(Q.confermaDel(db, '2026-09').modificatoDopo, 'Giuliano');
  const d = V.carica(db, ag, 'cantieri', '2026-09', ctx).dati;
  assert.equal(d.dipendenti[0].cantiere, null, 'chi non ha cantiere sta in cima');
  assert.deepEqual(d.mesi.map((m) => m.mese), ['2026-08', '2026-09', '2026-10']);
});

// ---------------------------------------------------------------- documento PDF

test('PDF: stessi blocchi dell\'Excel, tre parti, numeri da totali.js', async () => {
  const { db } = banco();
  compilaMese(db, 2026, 7);
  confermaMese(db, 2026, 7);
  const pdf = await documentoMese(db, 2026, 7, new Date(2026, 8, 2));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.match(pdf.toString('latin1'), /\/Count 3\b/, 'griglia, riepilogo, trasferte');
  assert.ok(pdf.length > 3000);
  // Excel e PDF partono dagli stessi conti
  const T = totaliMese(db, 2026, 7);
  const wb = await leggi(await foglioMese(db, 2026, 7));
  assert.equal(rigaDi(wb.getWorksheet('RIEPILOGO'), 'TOTALE').getCell(5).value, T.totali.ore);
  assert.ok(D.eSabato(new Date(2026, 7, 1)));
});
