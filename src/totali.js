/**
 * PRESENZE GAMA — I conti del mese, una volta sola
 * ---------------------------------------------------------------------------
 * Il foglio Excel e il PDF per il commercialista leggono da qui: cosi' i due
 * documenti non possono mai dare numeri diversi.
 *
 *   persone   : una riga per dipendente (anche chi e' uscito a meta' mese), con il
 *               cantiere del mese, le voci giorno per giorno e i totali
 *   trasferte : la tabella a parte dei sabati — dipendente, cantiere, quanti sabati, euro
 */
import { CFG } from './config.js';
import * as D from './date.js';
import * as Q from './dati.js';
import { dipendentiDelPeriodo } from './viste.js';

const centesimi = (n) => Math.round(n * 100) / 100;

export function totaliMese(db, anno, mese0) {
  const giorni = new Date(anno, mese0 + 1, 0).getDate();
  const dal = new Date(anno, mese0, 1), al = new Date(anno, mese0, giorni);
  const mese = D.meseChiave(anno, mese0);
  const elenco = dipendentiDelPeriodo(db, { admin: true }, dal, al);   // il documento e' unico per tutta l'azienda
  const cantiere = Q.cantieriDelMese(db, mese);
  const extra = Q.extraDelMese(db, mese);

  const indice = new Map();                            // id -> giorno -> { codice, ore }
  for (const p of Q.presenzeIntervallo(db, dal, al)) {
    if (!indice.has(p.dipendenteId)) indice.set(p.dipendenteId, {});
    indice.get(p.dipendenteId)[D.daChiave(p.data).getDate()] = { codice: p.codice, ore: p.ore };
  }
  const sabati = new Map();                            // id -> { n, euro }
  for (const t of Q.sabatiIntervallo(db, dal, al)) {
    if (!(t.importo > 0)) continue;
    const x = sabati.get(t.dipendenteId) || { n: 0, euro: 0 };
    x.n += 1; x.euro = centesimi(x.euro + t.importo);
    sabati.set(t.dipendenteId, x);
  }

  const totali = { gg: 0, ore: 0, mezze: 0, fer: 0, fes: 0, pio: 0, extra: 0 };
  const persone = elenco.map((dip) => {
    const voci = indice.get(dip.id) || {};
    const lista = Object.values(voci);
    const conta = (c) => lista.filter((v) => v.codice === c).length;
    const riga = {
      gg: lista.filter((v) => v.codice === 'ORD' || v.codice === 'MEZ' || v.codice === 'ALT').length,
      ore: lista.reduce((s, v) => s + (CFG.CODICI[v.codice] && CFG.CODICI[v.codice].riga === 'ord.' ? v.ore : 0), 0),
      mezze: conta('MEZ'), fer: conta('FER'), fes: conta('FES'), pio: conta('PIO'),
      extra: extra[dip.nome] ? extra[dip.nome].totale : 0,
      note: extra[dip.nome] ? extra[dip.nome].note.join('; ') : ''
    };
    for (const k of Object.keys(totali)) totali[k] += riga[k];
    return {
      nome: dip.nome,
      squadra: dip.squadra,
      cantiere: cantiere.has(dip.id) ? cantiere.get(dip.id).nome : '',
      voci,
      riga,
      sabati: sabati.get(dip.id) || { n: 0, euro: 0 }
    };
  });
  totali.extra = centesimi(totali.extra);

  const trasferte = persone.filter((p) => p.sabati.euro > 0)
    .map((p) => ({ nome: p.nome, cantiere: p.cantiere, sabati: p.sabati.n, euro: p.sabati.euro }));
  const totTrasferte = {
    sabati: trasferte.reduce((s, t) => s + t.sabati, 0),
    euro: centesimi(trasferte.reduce((s, t) => s + t.euro, 0))
  };

  const lettere = [];
  for (let g = 1; g <= giorni; g++) lettere.push(CFG.LETTERE_GIORNO[new Date(anno, mese0, g).getDay()]);
  /** sabati e domeniche: nella griglia restano vuoti e grigi */
  const finesettimana = lettere.map((_, i) => [0, 6].includes(new Date(anno, mese0, i + 1).getDay()));

  return { anno, mese0, mese, giorni, lettere, finesettimana, persone, totali, trasferte, totTrasferte };
}

export const etichettaSquadra = (sq) => (sq ? sq.charAt(0) + sq.slice(1).toLowerCase() : '');
