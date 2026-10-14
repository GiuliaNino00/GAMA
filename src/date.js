/**
 * Date: tutte in ora italiana (vedi fuso.js), a mezzanotte, senza sorprese.
 * Nel database una data e' sempre il testo "2026-09-15": niente oggetti Data
 * da interpretare, niente fusi orari, niente doppioni.
 */
import { CFG } from './config.js';

const due = (n) => String(n).padStart(2, '0');

/** "2026-09-15" */
export function chiave(d) {
  return d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate());
}

export function daChiave(s) {
  const [a, m, g] = String(s).split('-').map(Number);
  return new Date(a, m - 1, g);
}

/** "martedì 15 settembre" */
export function umana(d) {
  return CFG.NOMI_GIORNO[d.getDay()] + ' ' + d.getDate() + ' ' + CFG.MESI[d.getMonth()].toLowerCase();
}

/** "20260915": la forma usata negli indirizzi e nelle chiamate dalla pagina. */
export function codice(d) {
  return d.getFullYear() + due(d.getMonth() + 1) + due(d.getDate());
}

export function daCodice(c) {
  const s = String(c);
  return new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)));
}

/** Vero solo per date che esistono davvero (no 20260231, no 99999999). */
export function codiceValido(c) {
  if (!/^\d{8}$/.test(String(c))) return false;
  const d = daCodice(c);
  return codice(d) === String(c) && d.getFullYear() >= 2020 && d.getFullYear() <= 2100;
}

/** Oggi a mezzanotte. `adesso` si puo' passare per i test. */
export function oggi(adesso = new Date()) {
  return new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate());
}

export function aggiungiGiorni(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** "2026-09" */
export function meseChiave(anno, mese0) {
  return anno + '-' + due(mese0 + 1);
}

/** Data e ora leggibili per i registri: "2026-09-15 18:02:11" */
export function timbro(d = new Date()) {
  return chiave(d) + ' ' + due(d.getHours()) + ':' + due(d.getMinutes()) + ':' + due(d.getSeconds());
}

/**
 * Il primo giorno che un socio puo' ancora compilare o correggere: il 1° del mese
 * in corso, oppure il 1° del mese prima fino al giorno CFG.GIORNO_CHIUSURA_MESE_PRIMA.
 */
export function inizioRecupero(adesso = new Date()) {
  const o = oggi(adesso);
  const inizio = new Date(o.getFullYear(), o.getMonth() - (o.getDate() <= CFG.GIORNO_CHIUSURA_MESE_PRIMA ? 1 : 0), 1);
  const primo = primoGiorno();
  return primo && primo > inizio ? primo : inizio;
}

/** Dal file .env (PRIMO_GIORNO=2026-10-01): da quando si usa l'app. Prima non si chiede di compilare niente. */
export function primoGiorno() {
  const v = String(process.env.PRIMO_GIORNO || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? daChiave(v) : null;
}

/** Si fa l'appello in questo giorno? (Prima di PRIMO_GIORNO no: l'app non c'era.) */
export function giornoDiLavoro(d) {
  const primo = primoGiorno();
  if (primo && d < primo) return false;
  const dow = d.getDay();
  if (dow === 0) return CFG.APPELLO_ANCHE_DOMENICA;
  if (dow === 6) return CFG.APPELLO_ANCHE_SABATO;
  return true;
}

/** Lo stato di partenza dell'appello: domenica tutti assenti, gli altri giorni 8 ore. */
export function statoPredefinito(d) {
  return d.getDay() === 0 ? 'ASS' : 'ORD';
}

/**
 * Riporta a "2026-09-15" qualunque cosa arrivi da un foglio di calcolo:
 * testo "2026-09-15", "15/09/2026", oppure una data di Excel.
 * Le date lette da un .xlsx arrivano a mezzanotte UTC: si usano le componenti UTC.
 */
export function normalizzaData(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date && !isNaN(v)) {
    return v.getUTCFullYear() + '-' + due(v.getUTCMonth() + 1) + '-' + due(v.getUTCDate());
  }
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + due(m[2]) + '-' + due(m[3]);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return m[3] + '-' + due(m[2]) + '-' + due(m[1]);
  return '';
}

/** Come sopra ma per il mese: "2026-09". */
export function normalizzaMese(v) {
  const d = normalizzaData(v);
  if (d) return d.slice(0, 7);
  const m = String(v || '').trim().match(/^(\d{4})-(\d{1,2})$/);
  return m ? m[1] + '-' + due(m[2]) : '';
}
