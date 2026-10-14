// Importazione dal file scaricato dal Foglio Google: date in ogni forma,
// doppioni, storico, e nessun doppione se si reimporta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import '../src/fuso.js';
import { apri } from '../src/db.js';
import * as Q from '../src/dati.js';
import { importa } from '../src/importa.js';

/** Un file come quello che esce da "File > Scarica > Excel" del Foglio Google attuale. */
async function fileCome_Google() {
  const wb = new ExcelJS.Workbook();
  const dip = wb.addWorksheet('Dipendenti');
  dip.addRows([
    ['NOME', 'NOME_COMPLETO', 'ATTIVO', 'ORDINE', 'SQUADRA'],
    ['PIPERIS P.', 'PIPERIS PAOLO', 'SI', 1, 'MURATORI'],
    ["D'AMORE E.", "D'AMORE EMANUELE", 'SI', 2, 'carpentieri'],
    ['STRIPPOLI F.', 'STRIPPOLI FERDINANDO', 'NO', 3, '']
  ]);
  const ute = wb.addWorksheet('Utenti');
  ute.addRows([
    ['CHAT_ID', 'NOME', 'ATTIVO', 'SQUADRA', 'RUOLO'],
    ['111', 'Giuliano', 'SI', '', 'ADMIN'],
    ['333', 'Matteo', 'SI', 'MURATORI', ''],
    ['444', 'Antonio', 'SI', 'CARPENTIERI', '']
  ]);
  const pres = wb.addWorksheet('Presenze');
  pres.addRows([
    ['DATA', 'DIPENDENTE', 'CODICE', 'ORE', 'INSERITO_DA', 'TIMESTAMP'],
    ['2026-09-15', 'PIPERIS P.', 'ORD', 8, 'Matteo', new Date(Date.UTC(2026, 8, 15, 18, 10))],
    // stessa giornata corretta piu' tardi: deve vincere questa
    [new Date(Date.UTC(2026, 8, 15)), 'PIPERIS P.', 'MEZ', 4, 'Matteo', new Date(Date.UTC(2026, 8, 15, 19, 30))],
    ['16/09/2026', "D'AMORE E.", 'ASS', 0, 'Antonio', new Date(Date.UTC(2026, 8, 16, 18, 0))],
    ['2026-09-16', 'VECCHIO OPERAIO', 'ORD', 8, 'Matteo', ''],
    ['2026-09-16', 'PIPERIS P.', 'BOH', 8, 'Matteo', ''],
    ['', 'PIPERIS P.', 'ORD', 8, 'Matteo', '']
  ]);
  const arch = wb.addWorksheet('Presenze archivio');
  arch.addRows([
    ['DATA', 'DIPENDENTE', 'CODICE', 'ORE', 'INSERITO_DA', 'TIMESTAMP'],
    ['2026-07-01', 'PIPERIS P.', 'FER', 8, 'Matteo', new Date(Date.UTC(2026, 6, 1, 18, 0))]
  ]);
  const ext = wb.addWorksheet('Extra');
  ext.addRows([
    ['MESE', 'DIPENDENTE', 'IMPORTO', 'NOTA', 'INSERITO_DA', 'TIMESTAMP'],
    ['2026-09', 'PIPERIS P.', 150, 'sabato', 'Matteo', new Date(Date.UTC(2026, 8, 12, 10, 0))],
    [new Date(Date.UTC(2026, 8, 1)), "D'AMORE E.", 80, '', 'Antonio', new Date(Date.UTC(2026, 8, 13, 9, 0))]
  ]);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gama-')), 'Presenze GAMA.xlsx');
  await wb.xlsx.writeFile(file);
  return file;
}

test('importa tutto, una volta sola, e rispetta le correzioni fatte dopo nell\'app', async () => {
  const db = apri(':memory:');
  const file = await fileCome_Google();

  const r = await importa(db, file);
  assert.equal(r.dipendenti, 3);
  assert.equal(r.dipendentiCreatiDaStorico, 1, 'VECCHIO OPERAIO compare solo nello storico');
  assert.equal(r.utentiNuovi, 3);
  assert.equal(r.extra, 2);
  assert.deepEqual(r.schedeMancanti, []);

  assert.equal(Q.dipendentePerNome(db, "D'AMORE E.").squadra, 'CARPENTIERI');
  assert.equal(Q.dipendentePerNome(db, 'STRIPPOLI F.').attivo, false);
  assert.equal(Q.dipendentePerNome(db, 'VECCHIO OPERAIO').attivo, false);
  assert.equal(Q.presenzeDelGiorno(db, '2026-09-15')['PIPERIS P.'].codice, 'MEZ', 'vince la correzione piu\' recente');
  assert.equal(Q.presenzeDelGiorno(db, '2026-09-16')["D'AMORE E."].codice, 'ASS', 'data scritta come 16/09/2026');
  assert.equal(Q.presenzeDelGiorno(db, '2026-07-01')['PIPERIS P.'].codice, 'FER', 'anche l\'archivio');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM presenze').get().n, 4);
  assert.deepEqual(Q.extraDelMese(db, '2026-09'), { 'PIPERIS P.': { totale: 150, note: ['sabato'] }, "D'AMORE E.": { totale: 80, note: [] } });

  const giuliano = Q.utentePerNome(db, 'Giuliano');
  assert.equal(giuliano.admin, true);
  assert.equal(giuliano.telegram, '111');
  assert.equal(Q.utentePerNome(db, 'Matteo').squadra, 'MURATORI');

  // nell'app si corregge il 15: una reimportazione non deve rimettere il valore vecchio
  Q.salvaPresenze(db, '2026-09-15', { 'PIPERIS P.': 'ORD' }, 'Matteo');
  const chiaveGiuliano = giuliano.chiave;
  const r2 = await importa(db, file);
  assert.equal(r2.utentiNuovi, 0);
  assert.equal(r2.extra, 0, 'nessun compenso doppio');
  assert.equal(r2.extraGiaPresenti, 2);
  assert.equal(Q.presenzeDelGiorno(db, '2026-09-15')['PIPERIS P.'].codice, 'ORD', 'la correzione fatta nell\'app resta');
  assert.equal(Q.utentePerNome(db, 'Giuliano').chiave, chiaveGiuliano, 'i link personali non cambiano');
});

test('un file senza le schede giuste lo dice, senza rompere niente', async () => {
  const db = apri(':memory:');
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Foglio1').addRow(['niente']);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gama-')), 'vuoto.xlsx');
  await wb.xlsx.writeFile(file);
  const r = await importa(db, file);
  assert.deepEqual(r.schedeMancanti, ['Dipendenti', 'Utenti', 'Presenze', 'Extra']);
});

test('reimportare non disfa le decisioni prese nell\'app', async () => {
  const db = apri(':memory:');
  const file = await fileCome_Google();
  await importa(db, file);
  const matteo = Q.utentePerNome(db, 'Matteo');
  Q.aggiornaUtente(db, matteo.id, { attivo: false });               // Matteo disattivato nell'app
  Q.cambiaSquadra(db, 'PIPERIS P.', 'CARPENTIERI');                    // spostato nell'app
  Q.cambiaAttivo(db, 'STRIPPOLI F.', true);                            // riattivato nell'app
  const admin = Q.creaUtente(db, { nome: 'Capo', admin: true });       // creato da riga di comando
  await importa(db, file);
  assert.equal(Q.utentePerId(db, matteo.id).attivo, false, 'resta disattivato');
  assert.equal(Q.utentePerChiave(db, matteo.chiave), null, 'e il suo link resta morto');
  assert.equal(Q.dipendentePerNome(db, 'PIPERIS P.').squadra, 'CARPENTIERI');
  assert.equal(Q.dipendentePerNome(db, 'STRIPPOLI F.').attivo, true);
  assert.equal(Q.utentePerId(db, admin.id).admin, true);
});

test('squadre scritte male: la persona entra senza squadra e lo si segnala', async () => {
  const db = apri(':memory:');
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Dipendenti').addRows([['NOME', 'NOME_COMPLETO', 'ATTIVO', 'ORDINE', 'SQUADRA'], ['ROSSI M.', 'ROSSI MARIO', 'SI', 1, 'MURATORE']]);
  wb.addWorksheet('Utenti').addRows([['CHAT_ID', 'NOME', 'ATTIVO', 'SQUADRA', 'RUOLO'], ['', 'Pippo', 'SI', 'muratori ', '']]);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gama-')), 'sq.xlsx');
  await wb.xlsx.writeFile(file);
  const r = await importa(db, file);
  assert.deepEqual(r.squadreSconosciute, ['MURATORE']);
  assert.equal(Q.dipendentePerNome(db, 'ROSSI M.').squadra, '');
  assert.equal(Q.utentePerNome(db, 'Pippo').squadra, 'MURATORI', 'spazi e minuscole vanno bene');
});

test('due compensi uguali nello stesso mese restano due, anche reimportando', async () => {
  const db = apri(':memory:');
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Dipendenti').addRows([['NOME', 'NOME_COMPLETO', 'ATTIVO', 'ORDINE', 'SQUADRA'], ['ROSSI M.', 'ROSSI MARIO', 'SI', 1, 'MURATORI']]);
  wb.addWorksheet('Extra').addRows([
    ['MESE', 'DIPENDENTE', 'IMPORTO', 'NOTA', 'INSERITO_DA', 'TIMESTAMP'],
    ['2026-09', 'ROSSI M.', 50, 'sabato', 'Matteo', ''],
    ['2026-09', 'ROSSI M.', 50, 'sabato', 'Matteo', '']
  ]);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gama-')), 'ex.xlsx');
  await wb.xlsx.writeFile(file);
  assert.equal((await importa(db, file)).extra, 2);
  assert.equal(Q.extraDelMese(db, '2026-09')['ROSSI M.'].totale, 100);
  const r2 = await importa(db, file);
  assert.deepEqual([r2.extra, r2.extraGiaPresenti], [0, 2]);
  assert.equal(Q.extraDelMese(db, '2026-09')['ROSSI M.'].totale, 100);
});
