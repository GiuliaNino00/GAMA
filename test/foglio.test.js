// Il file .xlsx del mese: stessa impaginazione del "Foglio presenze.xlsx" aziendale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { banco, ADESSO } from './aiuto.js';
import { esegui } from '../src/azioni.js';
import { foglioMese } from '../src/foglio.js';

const ctx = { urlPubblico: 'https://x', adesso: ADESSO };

async function leggi(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

test('blocchi da 11 righe, giorni, lettere, ore al posto giusto', async () => {
  const { db, giuliano } = banco();   // giorni di inizio mese: li puo' scrivere solo l'amministratore
  esegui(db, giuliano, 'salvaAppello', { d: '20260901', stati: { 'PIPERIS P.': 'ORD', 'PIPERIS G.': 'MEZ', 'ZUCCARO D.': 'ASS' } }, ctx);
  esegui(db, giuliano, 'salvaAppello', { d: '20260902', stati: { 'PIPERIS P.': 'FER' } }, ctx);
  esegui(db, giuliano, 'salvaAppello', { d: '20260902', stati: { "D'AMORE E.": 'FES' } }, ctx);

  const wb = await leggi(await foglioMese(db, 2026, 8));
  assert.deepEqual(wb.worksheets.map((w) => w.name), ['SETTEMBRE 2026', 'RIEPILOGO']);
  const ws = wb.getWorksheet('SETTEMBRE 2026');

  // primo blocco: PIPERIS P. alla riga 2
  assert.equal(ws.getCell('A2').value, 'PIPERIS P.');
  assert.equal(ws.getCell('A2').font.size, 16);
  assert.equal(ws.getCell('A2').font.bold, true);
  assert.equal(ws.getCell('I2').value, 'MURATORI', 'la squadra dove stava il cantiere');
  assert.equal(ws.getCell('I2').fill.fgColor.argb, 'FF00B0F0');
  assert.equal(ws.getCell('A3').value, 'gg.');
  assert.equal(ws.getCell('B3').value, 1);
  assert.equal(ws.getCell('AE3').value, 30, 'settembre ha 30 giorni');
  assert.equal(ws.getCell('AF3').value, null, 'niente 31 settembre');
  assert.equal(ws.getCell('B4').value, 'M', 'il 1 settembre 2026 e\' martedi\'');
  assert.equal(ws.getCell('G4').value, 'D', 'il 6 settembre e\' domenica');
  assert.equal(ws.getCell('A5').value, 'ord.');
  assert.equal(ws.getCell('B5').value, 8);
  assert.equal(ws.getCell('A7').value, 'fer');
  assert.equal(ws.getCell('C7').value, 8, 'ferie del 2 settembre');
  assert.equal(ws.getCell('A9').value, 'fes');
  assert.equal(ws.getCell('B3').border.top.style, 'thin');

  // secondo blocco: PIPERIS G. alla riga 13 con la mezza giornata
  assert.equal(ws.getCell('A13').value, 'PIPERIS G.');
  assert.equal(ws.getCell('B16').value, 4);
  // terzo: ZUCCARO assente => nessuna ora
  assert.equal(ws.getCell('A24').value, 'ZUCCARO D.');
  assert.equal(ws.getCell('B27').value, null);
  // quarto: il primo carpentiere, con il festivo
  assert.equal(ws.getCell('A35').value, "D'AMORE E.");
  assert.equal(ws.getCell('I35').value, 'CARPENTIERI');
  assert.equal(ws.getCell('C42').value, 8);
  // ultimo: chi non ha squadra, senza riquadro azzurro
  assert.equal(ws.getCell('A57').value, 'STRIPPOLI F.');
  assert.equal(ws.getCell('I57').value, null);
  assert.equal(ws.pageSetup.orientation, 'landscape');
});

test('scheda RIEPILOGO: totali per dipendente e compensi extra', async () => {
  const { db, giuliano } = banco();
  esegui(db, giuliano, 'salvaAppello', { d: '20260901', stati: { 'PIPERIS P.': 'ORD', 'PIPERIS G.': 'MEZ' } }, ctx);
  esegui(db, giuliano, 'salvaAppello', { d: '20260902', stati: { 'PIPERIS P.': 'ORD', 'PIPERIS G.': 'FER' } }, ctx);
  esegui(db, giuliano, 'salvaExtra', { dipendente: 'PIPERIS P.', importo: 100, nota: 'sabato' }, ctx);
  esegui(db, giuliano, 'salvaExtra', { dipendente: 'PIPERIS P.', importo: 50, nota: 'trasferta' }, ctx);

  const rs = (await leggi(await foglioMese(db, 2026, 8))).getWorksheet('RIEPILOGO');
  assert.equal(rs.getCell('A1').value, 'Dipendente');
  const riga = (nome) => { let t = null; rs.eachRow((r) => { if (r.getCell(1).value === nome) t = r; }); return t; };
  const p = riga('PIPERIS P.');
  assert.deepEqual([p.getCell(3).value, p.getCell(4).value, p.getCell(8).value, p.getCell(9).value], [2, 16, 150, 'sabato; trasferta']);
  const g = riga('PIPERIS G.');
  assert.deepEqual([g.getCell(3).value, g.getCell(4).value, g.getCell(5).value, g.getCell(6).value], [1, 4, 1, 1]);
  const tot = riga('TOTALE');
  assert.deepEqual([tot.getCell(4).value, tot.getCell(8).value], [20, 150]);
});

test('chi e\' uscito a meta\' mese c\'e\', chi non ha mai lavorato ed e\' uscito no', async () => {
  const { db, giuliano } = banco();
  esegui(db, giuliano, 'salvaAppello', { d: '20260901', stati: { 'ZUCCARO D.': 'ORD' } }, ctx);
  esegui(db, giuliano, 'cambiaAttivo', { nome: 'ZUCCARO D.', attivo: false }, ctx);
  esegui(db, giuliano, 'cambiaAttivo', { nome: 'STRIPPOLI F.', attivo: false }, ctx);
  const ws = (await leggi(await foglioMese(db, 2026, 8))).getWorksheet('SETTEMBRE 2026');
  const nomi = [];
  ws.eachRow((r) => { const v = r.getCell(1).value; if (v && !['gg.', 'ord.', 'fer', 'fes'].includes(v)) nomi.push(v); });
  assert.ok(nomi.includes('ZUCCARO D.'));
  assert.ok(!nomi.includes('STRIPPOLI F.'));
});
