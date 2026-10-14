/**
 * PRESENZE GAMA — Il foglio del mese (.xlsx)
 * ---------------------------------------------------------------------------
 * Ricalca il vostro "Foglio presenze.xlsx" (scheda AGOSTO): un blocco di 11
 * righe per dipendente — nome in grande, riga dei giorni, lettere, ord. / fer /
 * fes — con la squadra nel riquadro azzurro dove prima stava il cantiere.
 * In piu' una seconda scheda RIEPILOGO con i totali e i compensi extra.
 */
import ExcelJS from 'exceljs';
import { CFG } from './config.js';
import * as D from './date.js';
import * as Q from './dati.js';
import { dipendentiDelPeriodo } from './viste.js';

const RIGHE_BLOCCO = 11;
const BLOCCHI_PER_PAGINA = 3;
const ULTIMA_COL = 32;          // AF: 31 giorni dopo la colonna A
const SOTTILE = { style: 'thin' };
const CARATTERE = { name: 'Calibri', size: 11 };
const CARATTERE_NOME = { name: 'Calibri', size: 16, bold: true };

export function nomeScheda(anno, mese0) {
  return CFG.MESI[mese0] + ' ' + anno;
}

/** Costruisce il file e restituisce il contenuto (Buffer). */
export async function foglioMese(db, anno, mese0) {
  const giorni = new Date(anno, mese0 + 1, 0).getDate();
  const dal = new Date(anno, mese0, 1), al = new Date(anno, mese0, giorni);
  const tutti = { admin: true };                       // il foglio e' unico per tutta l'azienda
  const elenco = dipendentiDelPeriodo(db, tutti, dal, al);

  const indice = new Map();                            // id -> giorno -> codice
  for (const p of Q.presenzeIntervallo(db, dal, al)) {
    if (!indice.has(p.dipendenteId)) indice.set(p.dipendenteId, {});
    indice.get(p.dipendenteId)[D.daChiave(p.data).getDate()] = p.codice;
  }

  const lettere = [];
  for (let g = 1; g <= giorni; g++) lettere.push(CFG.LETTERE_GIORNO[new Date(anno, mese0, g).getDay()]);

  const wb = new ExcelJS.Workbook();
  wb.creator = CFG.NOME_APP;
  wb.created = new Date();

  // ---------------------------------------------------------------- scheda del mese
  const ws = wb.addWorksheet(nomeScheda(anno, mese0), {
    pageSetup: {
      paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
    },
    properties: { defaultRowHeight: 15 }
  });
  ws.getColumn(1).width = 3.71;
  for (let c = 2; c <= ULTIMA_COL; c++) ws.getColumn(c).width = 4;

  elenco.forEach((dip, n) => {
    const r = 1 + n * RIGHE_BLOCCO + 1;                // si lascia una riga vuota in cima, come nel vostro
    const codici = indice.get(dip.id) || {};

    // riga del nome + squadra nel riquadro azzurro (I:Q)
    const rigaNome = ws.getRow(r);
    rigaNome.height = 21;
    rigaNome.getCell(1).value = dip.nome;
    rigaNome.getCell(1).font = CARATTERE_NOME;
    if (dip.squadra) {
      ws.mergeCells(r, 9, r, 17);
      const sq = rigaNome.getCell(9);
      sq.value = dip.squadra;
      sq.font = CARATTERE_NOME;
      sq.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B0F0' } };
      sq.border = { bottom: SOTTILE };
    }

    const valori = { 'ord.': [], fer: [], fes: [] };
    for (let g = 1; g <= giorni; g++) {
      const def = CFG.CODICI[codici[g]];
      for (const et of Object.keys(valori)) valori[et].push(def && def.riga === et ? def.ore : null);
    }

    const contenuto = [
      ['gg.', ...Array.from({ length: giorni }, (_, i) => i + 1)],
      [null, ...lettere],
      ['ord.', ...valori['ord.']],
      [],
      ['fer', ...valori.fer],
      [],
      ['fes', ...valori.fes],
      []
    ];

    contenuto.forEach((celle, i) => {
      const riga = ws.getRow(r + 1 + i);
      for (let c = 1; c <= ULTIMA_COL; c++) {
        const cella = riga.getCell(c);
        const v = celle[c - 1];
        if (v !== undefined && v !== null) cella.value = v;
        cella.font = CARATTERE;
        if (c > 1) cella.alignment = { horizontal: 'center' };
        // la griglia del vostro foglio: righe chiuse sopra gg., ord., fer, fes e in fondo
        cella.border = {
          left: SOTTILE, right: SOTTILE,
          top: [0, 2, 4, 6].includes(i) ? SOTTILE : undefined,
          bottom: [1, 7].includes(i) ? SOTTILE : undefined
        };
      }
    });

    // un foglio stampato non deve mai tagliare un dipendente a meta'
    if ((n + 1) % BLOCCHI_PER_PAGINA === 0 && n < elenco.length - 1) {
      ws.getRow(r + RIGHE_BLOCCO - 2).addPageBreak();
    }
  });

  if (!elenco.length) ws.getCell('A2').value = 'Nessun dipendente con presenze in questo mese.';

  // ---------------------------------------------------------------- scheda dei totali
  const extra = Q.extraDelMese(db, D.meseChiave(anno, mese0));
  const rs = wb.addWorksheet('RIEPILOGO', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });
  rs.columns = [
    { header: 'Dipendente', key: 'nome', width: 24 },
    { header: 'Squadra', key: 'squadra', width: 14 },
    { header: 'Giorni', key: 'gg', width: 9 },
    { header: 'Ore ord.', key: 'ore', width: 10 },
    { header: 'di cui mezze giornate', key: 'mezze', width: 12 },
    { header: 'Ferie (gg)', key: 'fer', width: 10 },
    { header: 'Festivi (gg)', key: 'fes', width: 11 },
    { header: 'Compensi extra €', key: 'extra', width: 15 },
    { header: 'Note sugli extra', key: 'note', width: 40 }
  ];
  const totali = { gg: 0, ore: 0, mezze: 0, fer: 0, fes: 0, extra: 0 };
  for (const dip of elenco) {
    const codici = Object.values(indice.get(dip.id) || {});
    const riga = {
      nome: dip.nome,
      squadra: dip.squadra ? dip.squadra.charAt(0) + dip.squadra.slice(1).toLowerCase() : '',
      gg: codici.filter((c) => c === 'ORD' || c === 'MEZ').length,
      ore: codici.reduce((s, c) => s + (CFG.CODICI[c] && CFG.CODICI[c].riga === 'ord.' ? CFG.CODICI[c].ore : 0), 0),
      mezze: codici.filter((c) => c === 'MEZ').length,
      fer: codici.filter((c) => c === 'FER').length,
      fes: codici.filter((c) => c === 'FES').length,
      extra: extra[dip.nome] ? extra[dip.nome].totale : 0,
      note: extra[dip.nome] ? extra[dip.nome].note.join('; ') : ''
    };
    for (const k of Object.keys(totali)) totali[k] += riga[k];
    rs.addRow(riga);
  }
  const rigaTot = rs.addRow({ nome: 'TOTALE', ...totali, extra: Math.round(totali.extra * 100) / 100 });
  rigaTot.font = { bold: true };
  rs.getRow(1).font = { bold: true };
  rs.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  rs.getRow(1).height = 32;
  rs.getColumn('extra').numFmt = '#,##0.00 "€"';
  rs.views = [{ state: 'frozen', ySplit: 1 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}
