/**
 * PRESENZE GAMA — Il documento del mese in PDF (per il commercialista)
 * ---------------------------------------------------------------------------
 * A4 orizzontale, tre parti:
 *   1. la griglia del mese: una riga per dipendente, raggruppati per cantiere,
 *      un quadretto per giorno (8, 4, ore, F ferie, FS festivo, P pioggia, — assente);
 *      sabati e domeniche grigi e vuoti: il sabato si paga a trasferta;
 *   2. il RIEPILOGO con i totali di ognuno;
 *   3. le TRASFERTE: la somma dei sabati di ognuno.
 * I numeri arrivano da totali.js, gli stessi del foglio Excel.
 */
import PDFDocument from 'pdfkit';
import { CFG } from './config.js';
import * as D from './date.js';
import { totaliMese, etichettaSquadra } from './totali.js';
import { nomeScheda } from './foglio.js';

const MARGINE = 28;
const ALTO = 14;                      // altezza di una riga
const COLORE = { testo: '#1d2733', tenue: '#5b6675', bordo: '#c9ced6', grigio: '#e7e9ec', testa: '#dfeaf6', gruppo: '#f3f6fa' };
const SIGLA = { ORD: '8', MEZ: '4', FER: 'F', FES: 'FS', PIO: 'P', ASS: '—' };

const euro = (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €';

/** Costruisce il PDF e restituisce il contenuto (Buffer). */
export function documentoMese(db, anno, mese0, adesso = new Date()) {
  const T = totaliMese(db, anno, mese0);
  const titolo = CFG.NOME_DITTA + ' — Presenze ' + nomeScheda(anno, mese0);
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: MARGINE, bufferPages: true,
    info: { Title: titolo, Author: CFG.NOME_APP, Creator: CFG.NOME_APP } });
  const pezzi = [];
  doc.on('data', (b) => pezzi.push(b));
  const fine = new Promise((ok) => doc.on('end', () => ok(Buffer.concat(pezzi))));

  const largo = doc.page.width - 2 * MARGINE;
  const fondo = () => doc.page.height - MARGINE - 18;

  function testata(sottotitolo) {
    doc.fillColor(COLORE.testo).font('Helvetica-Bold').fontSize(15).text(titolo, MARGINE, MARGINE, { width: largo });
    doc.font('Helvetica').fontSize(9).fillColor(COLORE.tenue).text(sottotitolo, MARGINE, MARGINE + 19, { width: largo });
    return MARGINE + 36;
  }
  function cella(x, y, w, testo, { grassetto = false, sfondo = null, allinea = 'left', colore = COLORE.testo, dim = 7.5 } = {}) {
    if (sfondo) doc.rect(x, y, w, ALTO).fill(sfondo);
    doc.rect(x, y, w, ALTO).lineWidth(0.4).strokeColor(COLORE.bordo).stroke();
    if (testo === '' || testo === null || testo === undefined) return;
    doc.fillColor(colore).font(grassetto ? 'Helvetica-Bold' : 'Helvetica').fontSize(dim)
      .text(String(testo), x + 2, y + (ALTO - dim) / 2 + 0.5, { width: w - 4, align: allinea, lineBreak: false, ellipsis: true });
  }

  // ---------------------------------------------------------------- 1. griglia del mese
  const L_NOME = 118, L_CANT = 96;
  const lGiorno = (largo - L_NOME - L_CANT) / T.giorni;
  const sottoGriglia = 'Griglia del mese · 8 = giornata · 4 = mezza giornata · numero = ore · F = ferie · FS = festivo · ' +
    'P = pioggia · — = assente · sabati e domeniche in grigio (il sabato è nelle Trasferte)';

  function testaGriglia(y) {
    cella(MARGINE, y, L_NOME, 'Dipendente', { grassetto: true, sfondo: COLORE.testa });
    cella(MARGINE + L_NOME, y, L_CANT, 'Cantiere', { grassetto: true, sfondo: COLORE.testa });
    for (let g = 1; g <= T.giorni; g++) {
      const x = MARGINE + L_NOME + L_CANT + (g - 1) * lGiorno;
      const fs = T.finesettimana[g - 1];
      cella(x, y, lGiorno, String(g), { grassetto: true, sfondo: fs ? COLORE.grigio : COLORE.testa, allinea: 'center', dim: 7 });
      cella(x, y + ALTO, lGiorno, T.lettere[g - 1], { sfondo: fs ? COLORE.grigio : COLORE.testa, allinea: 'center', dim: 6.5, colore: COLORE.tenue });
    }
    cella(MARGINE, y + ALTO, L_NOME + L_CANT, '', { sfondo: COLORE.testa });
    return y + 2 * ALTO;
  }

  let y = testaGriglia(testata(sottoGriglia));
  const perCantiere = new Map();
  for (const p of T.persone) {
    const k = p.cantiere || '';
    if (!perCantiere.has(k)) perCantiere.set(k, []);
    perCantiere.get(k).push(p);
  }
  const gruppi = [...perCantiere.entries()].sort((a, b) => (a[0] === '') - (b[0] === '') || a[0].localeCompare(b[0], 'it'));
  for (const [nomeCantiere, lista] of gruppi) {
    if (y + 2 * ALTO > fondo()) { doc.addPage(); y = testaGriglia(testata(sottoGriglia)); }
    cella(MARGINE, y, largo, nomeCantiere ? 'Cantiere: ' + nomeCantiere : 'Senza cantiere', { grassetto: true, sfondo: COLORE.gruppo });
    y += ALTO;
    for (const p of lista) {
      if (y + ALTO > fondo()) { doc.addPage(); y = testaGriglia(testata(sottoGriglia)); }
      cella(MARGINE, y, L_NOME, p.nome, { grassetto: true });
      cella(MARGINE + L_NOME, y, L_CANT, p.cantiere, { colore: COLORE.tenue });
      for (let g = 1; g <= T.giorni; g++) {
        const v = p.voci[g];
        const sigla = v ? (v.codice === 'ALT' ? String(v.ore) : SIGLA[v.codice] || '') : '';
        cella(MARGINE + L_NOME + L_CANT + (g - 1) * lGiorno, y, lGiorno, sigla,
          { sfondo: T.finesettimana[g - 1] ? COLORE.grigio : null, allinea: 'center', dim: 7 });
      }
      y += ALTO;
    }
  }
  if (!T.persone.length) doc.font('Helvetica').fontSize(10).text('Nessun dipendente con presenze in questo mese.', MARGINE, y + 6);

  // ---------------------------------------------------------------- tabelle semplici
  function tabella(sottotitolo, colonne, righe, totale) {
    doc.addPage();
    let yy = testata(sottotitolo);
    const scala = largo / colonne.reduce((s, c) => s + c.w, 0);
    const testa = (yt) => {
      let x = MARGINE;
      for (const c of colonne) { cella(x, yt, c.w * scala, c.t, { grassetto: true, sfondo: COLORE.testa, allinea: c.a || 'left', dim: 8 }); x += c.w * scala; }
      return yt + ALTO;
    };
    yy = testa(yy);
    const riga = (r, opz) => {
      if (yy + ALTO > fondo()) { doc.addPage(); yy = testa(testata(sottotitolo)); }
      let x = MARGINE;
      for (const c of colonne) { cella(x, yy, c.w * scala, r[c.k], { allinea: c.a || 'left', dim: 8, ...opz }); x += c.w * scala; }
      yy += ALTO;
    };
    righe.forEach((r, i) => riga(r, { sfondo: i % 2 ? COLORE.gruppo : null }));
    if (totale) riga(totale, { grassetto: true, sfondo: COLORE.testa });
    if (!righe.length) doc.font('Helvetica').fontSize(9).fillColor(COLORE.tenue).text('Nessuna riga in questo mese.', MARGINE, yy + 6);
  }

  // ---------------------------------------------------------------- 2. riepilogo
  const n = (v) => (v ? String(v) : '');
  tabella('Riepilogo del mese',
    [{ t: 'Dipendente', k: 'nome', w: 120 }, { t: 'Squadra', k: 'squadra', w: 62 }, { t: 'Cantiere', k: 'cantiere', w: 110 },
     { t: 'Giorni', k: 'gg', w: 38, a: 'right' }, { t: 'Ore', k: 'ore', w: 38, a: 'right' }, { t: 'Mezze', k: 'mezze', w: 38, a: 'right' },
     { t: 'Ferie', k: 'fer', w: 38, a: 'right' }, { t: 'Festivi', k: 'fes', w: 40, a: 'right' }, { t: 'Pioggia', k: 'pio', w: 42, a: 'right' },
     { t: 'Extra', k: 'extra', w: 62, a: 'right' }, { t: 'Note sugli extra', k: 'note', w: 150 }],
    T.persone.map((p) => ({
      nome: p.nome, squadra: etichettaSquadra(p.squadra), cantiere: p.cantiere,
      gg: n(p.riga.gg), ore: n(p.riga.ore), mezze: n(p.riga.mezze), fer: n(p.riga.fer), fes: n(p.riga.fes), pio: n(p.riga.pio),
      extra: p.riga.extra ? euro(p.riga.extra) : '', note: p.riga.note
    })),
    { nome: 'TOTALE', gg: n(T.totali.gg), ore: n(T.totali.ore), mezze: n(T.totali.mezze), fer: n(T.totali.fer),
      fes: n(T.totali.fes), pio: n(T.totali.pio), extra: euro(T.totali.extra) });

  // ---------------------------------------------------------------- 3. trasferte (i sabati)
  tabella('Trasferte del sabato · somma dei sabati del mese',
    [{ t: 'Dipendente', k: 'nome', w: 170 }, { t: 'Cantiere', k: 'cantiere', w: 170 },
     { t: 'Sabati in trasferta', k: 'sabati', w: 90, a: 'right' }, { t: 'Trasferte', k: 'euro', w: 100, a: 'right' }],
    T.trasferte.map((t) => ({ nome: t.nome, cantiere: t.cantiere, sabati: String(t.sabati), euro: euro(t.euro) })),
    { nome: 'TOTALE', sabati: String(T.totTrasferte.sabati), euro: euro(T.totTrasferte.euro) });

  // ---------------------------------------------------------------- piè di pagina su ogni pagina
  const pagine = doc.bufferedPageRange();
  const creato = D.timbro(adesso).slice(0, 16).replace(/^(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
  for (let i = 0; i < pagine.count; i++) {
    doc.switchToPage(pagine.start + i);
    doc.page.margins.bottom = 0;                       // se no pdfkit apre una pagina nuova per il piè di pagina
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORE.tenue)
      .text(titolo + ' · creato il ' + creato + ' · pag. ' + (i + 1) + ' di ' + pagine.count,
        MARGINE, doc.page.height - MARGINE - 8, { width: largo, align: 'right', lineBreak: false });
  }
  doc.end();
  return fine;
}
