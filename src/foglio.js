/**
 * PRESENZE GAMA — Il foglio del mese (.xlsx)
 * ---------------------------------------------------------------------------
 * Ricalca il vostro "Foglio presenze.xlsx" (scheda AGOSTO): un blocco per
 * dipendente — nome in grande, riga dei giorni, lettere, ord. / fer / fes /
 * pioggia / malattia — con il cantiere del mese nel riquadro azzurro (la squadra se manca).
 * Sabati e domeniche restano vuoti e grigi: il sabato si paga a trasferta.
 * Poi la scheda RIEPILOGO con i totali e la scheda TRASFERTE con i sabati.
 * I conti li fa totali.js, gli stessi del PDF.
 */
import ExcelJS from 'exceljs';
import { CFG } from './config.js';
import { totaliMese, etichettaSquadra } from './totali.js';

const RIGHE_BLOCCO = 15;
const BLOCCHI_PER_PAGINA = 3;
const ULTIMA_COL = 32;          // AF: 31 giorni dopo la colonna A
const SOTTILE = { style: 'thin' };
const CARATTERE = { name: 'Calibri', size: 11 };
const CARATTERE_NOME = { name: 'Calibri', size: 16, bold: true };
const GRIGIO = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E9EC' } };
const EURO = '#,##0.00 "€"';

export function nomeScheda(anno, mese0) {
  return CFG.MESI[mese0] + ' ' + anno;
}

/** Costruisce il file e restituisce il contenuto (Buffer). */
export async function foglioMese(db, anno, mese0) {
  const T = totaliMese(db, anno, mese0);
  const { giorni, lettere, finesettimana } = T;

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
  ws.getColumn(1).width = 7;
  for (let c = 2; c <= ULTIMA_COL; c++) ws.getColumn(c).width = 4;

  T.persone.forEach((dip, n) => {
    const r = 1 + n * RIGHE_BLOCCO + 1;                // si lascia una riga vuota in cima, come nel vostro

    // riga del nome + cantiere (o squadra) nel riquadro azzurro (I:Q)
    const rigaNome = ws.getRow(r);
    rigaNome.height = 21;
    rigaNome.getCell(1).value = dip.nome;
    rigaNome.getCell(1).font = CARATTERE_NOME;
    const riquadro = dip.cantiere || dip.squadra;
    if (riquadro) {
      ws.mergeCells(r, 9, r, 17);
      const sq = rigaNome.getCell(9);
      sq.value = riquadro;
      sq.font = CARATTERE_NOME;
      sq.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B0F0' } };
      sq.border = { bottom: SOTTILE };
    }

    const valori = { 'ord.': [], fer: [], fes: [], pioggia: [], malattia: [] };
    for (let g = 1; g <= giorni; g++) {
      const v = dip.voci[g];
      const def = v && CFG.CODICI[v.codice];
      for (const et of Object.keys(valori)) valori[et].push(def && def.riga === et ? v.ore : null);
    }

    const contenuto = [
      ['gg.', ...Array.from({ length: giorni }, (_, i) => i + 1)],
      [null, ...lettere],
      ['ord.', ...valori['ord.']],
      [],
      ['fer', ...valori.fer],
      [],
      ['fes', ...valori.fes],
      [],
      ['pioggia', ...valori.pioggia],
      [],
      ['malattia', ...valori.malattia],
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
        if (c > 1 && i > 0 && finesettimana[c - 2]) cella.fill = GRIGIO;
        // la griglia del vostro foglio: righe chiuse sopra gg., ord., fer, fes, pioggia, malattia e in fondo
        cella.border = {
          left: SOTTILE, right: SOTTILE,
          top: [0, 2, 4, 6, 8, 10].includes(i) ? SOTTILE : undefined,
          bottom: [1, 11].includes(i) ? SOTTILE : undefined
        };
      }
    });

    // un foglio stampato non deve mai tagliare un dipendente a meta'
    if ((n + 1) % BLOCCHI_PER_PAGINA === 0 && n < T.persone.length - 1) {
      ws.getRow(r + RIGHE_BLOCCO - 2).addPageBreak();
    }
  });

  if (!T.persone.length) ws.getCell('A2').value = 'Nessun dipendente con presenze in questo mese.';

  // ---------------------------------------------------------------- scheda dei totali
  const rs = wb.addWorksheet('RIEPILOGO', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });
  rs.columns = [
    { header: 'Dipendente', key: 'nome', width: 24 },
    { header: 'Squadra', key: 'squadra', width: 14 },
    { header: 'Cantiere', key: 'cantiere', width: 24 },
    { header: 'Giorni', key: 'gg', width: 9 },
    { header: 'Ore ord.', key: 'ore', width: 10 },
    { header: 'di cui mezze giornate', key: 'mezze', width: 12 },
    { header: 'Ferie (gg)', key: 'fer', width: 10 },
    { header: 'Festivi (gg)', key: 'fes', width: 11 },
    { header: 'Pioggia (gg)', key: 'pio', width: 11 },
    { header: 'Malattia (gg)', key: 'mal', width: 11 },
    { header: 'Compensi extra €', key: 'extra', width: 15 },
    { header: 'Note sugli extra', key: 'note', width: 40 }
  ];
  for (const p of T.persone) {
    rs.addRow({ nome: p.nome, squadra: etichettaSquadra(p.squadra), cantiere: p.cantiere, ...p.riga });
  }
  const rigaTot = rs.addRow({ nome: 'TOTALE', ...T.totali });
  rigaTot.font = { bold: true };
  intestazione(rs);
  rs.getColumn('extra').numFmt = EURO;

  // ---------------------------------------------------------------- scheda delle trasferte (i sabati)
  const ts = wb.addWorksheet('TRASFERTE', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });
  ts.columns = [
    { header: 'Dipendente', key: 'nome', width: 24 },
    { header: 'Cantiere', key: 'cantiere', width: 24 },
    { header: 'Sabati in trasferta', key: 'sabati', width: 12 },
    { header: 'Trasferte €', key: 'euro', width: 14 }
  ];
  for (const t of T.trasferte) ts.addRow(t);
  const totT = ts.addRow({ nome: 'TOTALE', sabati: T.totTrasferte.sabati, euro: T.totTrasferte.euro });
  totT.font = { bold: true };
  intestazione(ts);
  ts.getColumn('euro').numFmt = EURO;

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function intestazione(foglio) {
  foglio.getRow(1).font = { bold: true };
  foglio.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  foglio.getRow(1).height = 32;
  foglio.views = [{ state: 'frozen', ySplit: 1 }];
}
