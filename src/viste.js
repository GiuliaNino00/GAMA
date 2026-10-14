/**
 * PRESENZE GAMA — I dati che servono a ogni schermata
 * ---------------------------------------------------------------------------
 * Ogni funzione prepara gia' filtrato per l'utente quello che la pagina mostra:
 * il telefono non riceve mai nomi che non deve vedere.
 */
import { CFG } from './config.js';
import * as D from './date.js';
import * as Q from './dati.js';
import { troppoVecchioPer } from './azioni.js';

/** Chi compare in un periodo: i dipendenti visibili attivi, piu' chi ha lavorato nel periodo anche se poi e' stato disattivato. */
export function dipendentiDelPeriodo(db, utente, dal, al) {
  const conRighe = new Set(Q.presenzeIntervallo(db, dal, al).map((p) => p.dipendenteId));
  const lista = Q.dipendentiTuttiDi(db, utente).filter((d) => d.attivo || conRighe.has(d.id));
  return Q.ordinaPerSquadra(lista);
}

export function datiAppello(db, data, utente) {
  const elenco = Q.ordinaPerSquadra(Q.dipendentiDi(db, utente));
  const tutte = Q.presenzeDelGiorno(db, D.chiave(data));
  const gia = {};
  elenco.forEach((d) => { if (tutte[d.nome]) gia[d.nome] = tutte[d.nome]; });
  const toccati = Object.keys(gia);
  const chi = [...new Set(toccati.map((n) => gia[n].inseritoDa || '?'))];
  // per l'amministratore la giornata e' completa solo quando hanno compilato tutte le squadre
  const completo = toccati.length > 0 &&
    Q.giorniCompilatiPer(db, utente, data, data)[D.chiave(data)] === true;

  const { impronta, quando } = Q.improntaGiorno(db, D.chiave(data), elenco.map((d) => d.id));

  return {
    codice: D.codice(data),
    giorno: D.umana(data),
    giaFatto: chi.join(' e '),
    completo,
    impronta,
    quando,
    righe: elenco.map((d) => ({
      nome: d.nome,
      squadra: d.squadra,
      stato: gia[d.nome] ? gia[d.nome].codice : D.statoPredefinito(data)
    }))
  };
}

export function datiGiorni(db, utente, adesso = new Date()) {
  if (!Q.dipendentiDi(db, utente).length) return [];
  const oggi = D.oggi(adesso);
  const fatti = Q.giorniCompilatiPer(db, utente, D.aggiungiGiorni(oggi, -(CFG.GIORNI_RECUPERO - 1)), oggi);
  const out = [];
  for (let i = 0; i < CFG.GIORNI_RECUPERO; i++) {
    const d = D.aggiungiGiorni(oggi, -i);
    if (!D.giornoDiLavoro(d)) continue;
    out.push({ codice: D.codice(d), etichetta: D.umana(d), fatto: fatti[D.chiave(d)] === true, oggi: i === 0 });
  }
  return out;
}

/**
 * Lo stato di ogni giorno di un periodo, dal punto di vista dell'utente:
 *   fatto · parziale (solo amministratore: una squadra si', l'altra no) · mancante ·
 *   riposo (domenica senza presenze) · futuro.
 * `apribile`: si puo' aprire l'appello di quel giorno (i soci solo gli ultimi 14).
 */
export function statoGiorni(db, utente, dal, al, adesso = new Date()) {
  const oggi = D.oggi(adesso);
  const visibili = new Set(Q.dipendentiDi(db, utente).map((d) => d.id));
  const fatti = Q.giorniCompilatiPer(db, utente, dal, al);
  const conRighe = {};
  for (const p of Q.presenzeIntervallo(db, dal, al)) if (visibili.has(p.dipendenteId)) conRighe[p.data] = true;
  const limite = utente.admin ? null : D.aggiungiGiorni(oggi, -(CFG.GIORNI_RECUPERO - 1));
  const out = [];
  for (let d = new Date(dal); d <= al; d = D.aggiungiGiorni(d, 1)) {
    const k = D.chiave(d);
    let stato;
    if (d > oggi) stato = 'futuro';
    else if (fatti[k]) stato = 'fatto';
    else if (!D.giornoDiLavoro(d)) stato = 'riposo';
    else if (conRighe[k]) stato = 'parziale';
    else stato = 'mancante';
    out.push({
      codice: D.codice(d), num: d.getDate(), lettera: CFG.LETTERE_GIORNO[d.getDay()], stato,
      oggi: k === D.chiave(oggi),
      apribile: visibili.size > 0 && d <= oggi && (!limite || d >= limite)
    });
  }
  return out;
}

/** Il conto delle ore di un periodo, per gli uomini dell'utente. */
export function riassuntoPeriodo(db, dal, al, titolo, utente, adesso = new Date()) {
  const elenco = dipendentiDelPeriodo(db, utente, dal, al);
  const per = new Map(elenco.map((d) => [d.id, { nome: d.nome, squadra: d.squadra, gg: 0, ore: 0, mezze: 0, fer: 0, fes: 0 }]));

  for (const r of Q.presenzeIntervallo(db, dal, al)) {
    const p = per.get(r.dipendenteId);
    if (!p) continue;
    if (r.codice === 'ORD') { p.ore += r.ore; p.gg += 1; }
    if (r.codice === 'MEZ') { p.ore += r.ore; p.gg += 1; p.mezze += 1; }
    if (r.codice === 'FER') p.fer += 1;
    if (r.codice === 'FES') p.fes += 1;
  }

  const mancanti = [];
  if (Q.dipendentiDi(db, utente).length) {
    const fatti = Q.giorniCompilatiPer(db, utente, dal, al);
    const oggi = D.oggi(adesso);
    for (let d = new Date(dal); d <= al && d <= oggi; d = D.aggiungiGiorni(d, 1)) {
      if (D.giornoDiLavoro(d) && !fatti[D.chiave(d)]) mancanti.push(d.getDate());
    }
  }

  // i giorni di lavoro passati del periodo: il "pieno" delle barre di ciascuno
  let lavorativi = 0;
  for (let d = new Date(dal); d <= al && d <= D.oggi(adesso); d = D.aggiungiGiorni(d, 1)) if (D.giornoDiLavoro(d)) lavorativi++;

  const righe = elenco.map((d) => per.get(d.id));
  return { titolo, righe, oreTotali: righe.reduce((s, p) => s + p.ore, 0), mancanti, lavorativi, extra: [] };
}

export function datiSettimana(db, utente, adesso = new Date()) {
  const oggi = D.oggi(adesso);
  const dow = oggi.getDay();
  const lun = D.aggiungiGiorni(oggi, -(dow === 0 ? 6 : dow - 1));
  const dom = D.aggiungiGiorni(lun, 6);
  const titolo = lun.getDate() + ' ' + CFG.MESI[lun.getMonth()].toLowerCase() + ' – ' +
                 dom.getDate() + ' ' + CFG.MESI[dom.getMonth()].toLowerCase();
  return riassuntoPeriodo(db, lun, dom, titolo, utente, adesso);
}

export function datiMese(db, anno, mese0, utente, adesso = new Date()) {
  const dal = new Date(anno, mese0, 1);
  const al = new Date(anno, mese0 + 1, 0);
  const r = riassuntoPeriodo(db, dal, al, CFG.MESI[mese0].toLowerCase() + ' ' + anno, utente, adesso);

  const extra = Q.extraDelMese(db, D.meseChiave(anno, mese0));
  const miei = new Set(r.righe.map((p) => p.nome));
  r.extra = Object.keys(extra).filter((n) => miei.has(n))
    .map((n) => ({ nome: n, importo: extra[n].totale, note: extra[n].note.join('; ') }));
  r.mese = String(anno) + String(mese0 + 1).padStart(2, '0');
  r.scaricabile = !!(utente && utente.admin);
  // il calendario del mese: quante caselle vuote prima del giorno 1 (lunedi' = 0)
  r.calendario = { vuoti: (dal.getDay() + 6) % 7, giorni: statoGiorni(db, utente, dal, al, adesso) };
  return r;
}

/**
 * La schermata principale in una sola chiamata: com'e' messa oggi, le ultime due
 * settimane giorno per giorno, i numeri della settimana e del mese.
 */
export function datiHome(db, utente, adesso = new Date()) {
  const oggi = D.oggi(adesso);
  const miei = Q.dipendentiDi(db, utente);
  const app = datiAppello(db, oggi, utente);
  // si conta solo cio' che e' davvero salvato, non lo stato di partenza dell'appello
  let presenti = 0, ore = 0;
  const salvate = Q.presenzeDelGiorno(db, D.chiave(oggi));
  for (const d of miei) {
    const c = salvate[d.nome] && CFG.CODICI[salvate[d.nome].codice];
    if (c && c.riga === 'ord.') { presenti++; ore += c.ore; }
  }

  const dow = oggi.getDay();
  const lun = D.aggiungiGiorni(oggi, -(dow === 0 ? 6 : dow - 1));
  const giorni = statoGiorni(db, utente, D.aggiungiGiorni(lun, -7), D.aggiungiGiorni(lun, 6), adesso);
  const sett = riassuntoPeriodo(db, lun, D.aggiungiGiorni(lun, 6), '', utente, adesso);
  const meseDal = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
  const mese = datiMese(db, oggi.getFullYear(), oggi.getMonth(), utente, adesso);

  return {
    oggi: { codice: app.codice, giorno: app.giorno, giaFatto: app.giaFatto, completo: app.completo,
            quando: app.quando, presenti, ore, persone: miei.length },
    giorni,
    arretrati: datiGiorni(db, utente, adesso).filter((g) => !g.fatto).length,
    settimana: {
      ore: sett.oreTotali,
      fatti: giorni.slice(7).filter((g) => g.stato === 'fatto' && D.giornoDiLavoro(D.daCodice(g.codice))).length,
      lavorativi: sett.lavorativi
    },
    mese: {
      codice: mese.mese,
      nome: CFG.MESI[meseDal.getMonth()].toLowerCase(),
      ore: mese.oreTotali,
      extra: Math.round(mese.extra.reduce((t, x) => t + x.importo, 0) * 100) / 100
    }
  };
}

export function datiExtra(db, utente, adesso = new Date()) {
  const extra = Q.extraDelMese(db, D.meseChiave(adesso.getFullYear(), adesso.getMonth()));
  const miei = Q.ordinaPerSquadra(Q.dipendentiDi(db, utente));
  return {
    mese: CFG.MESI[adesso.getMonth()].toLowerCase(),
    dipendenti: miei.map((d) => d.nome),
    gia: miei.filter((d) => extra[d.nome]).map((d) => ({ nome: d.nome, importo: extra[d.nome].totale }))
  };
}

export function datiDipendenti(db, utente) {
  // chi non ha squadra va in cima: e' quello che l'amministratore deve sistemare
  const lista = Q.ordinaPerSquadra(Q.dipendentiTuttiDi(db, utente));
  const senza = lista.filter((d) => !d.squadra), con = lista.filter((d) => d.squadra);
  return [...senza, ...con].map((d) => ({ nome: d.nome, attivo: d.attivo, squadra: d.squadra }));
}

/** Solo per l'amministratore: chi usa l'app, con il suo link. */
export function datiUtenti(db, urlPubblico) {
  const notifiche = new Map(db.prepare('SELECT utente_id, COUNT(*) AS n FROM iscrizioni_push GROUP BY utente_id').all()
    .map((r) => [r.utente_id, r.n]));
  return Q.tuttiUtenti(db).map((u) => ({
    id: u.id,
    nome: u.nome,
    squadra: u.squadra,
    admin: u.admin,
    attivo: u.attivo,
    link: Q.linkUtente(urlPubblico, u),
    ultimoAccesso: u.ultimoAccesso || '',
    notifiche: notifiche.get(u.id) || 0,
    telegram: !!u.telegram
  }));
}

/** Tutto quello che serve alla pagina appena si apre: la prima schermata arriva gia' piena. */
export function avvio(db, utente, { vapid = '', adesso = new Date() } = {}) {
  const oggi = D.oggi(adesso);
  return {
    utente: utente.nome,
    ambito: Q.descriviAmbito(utente),
    admin: utente.admin,
    squadra: utente.squadra,
    squadre: CFG.SQUADRE,
    ciclo: CFG.CICLO,
    codici: CFG.CODICI,
    oggi: D.codice(oggi),
    appello: datiAppello(db, oggi, utente),
    home: datiHome(db, utente, adesso),
    avviso: Q.avvisoAmbito(db, utente),
    amministratori: Q.nomiAmministratori(db),
    vapid
  };
}

/** Unico punto d'ingresso per LEGGERE, come appCarica nella versione Google. */
export function carica(db, utente, vista, parametro, { urlPubblico = '', adesso = new Date() } = {}) {
  switch (vista) {
    case 'appello': {
      if (!D.codiceValido(parametro)) return { ok: false, errore: 'Data non valida.' };
      const d = D.daCodice(parametro);
      if (d > D.oggi(adesso)) return { ok: false, errore: 'Non si può fare l\'appello di un giorno che deve ancora venire.' };
      const vecchio = troppoVecchioPer(db, utente, d, adesso);
      if (vecchio) return { ok: false, errore: vecchio };
      return { ok: true, dati: datiAppello(db, d, utente) };
    }
    case 'home':      return { ok: true, dati: datiHome(db, utente, adesso) };
    case 'giorni':    return { ok: true, dati: datiGiorni(db, utente, adesso) };
    case 'settimana': return { ok: true, dati: datiSettimana(db, utente, adesso) };
    case 'mese': {
      if (!/^\d{4}(0[1-9]|1[0-2])$/.test(String(parametro))) return { ok: false, errore: 'Mese non valido.' };
      const s = String(parametro);
      return { ok: true, dati: datiMese(db, Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, utente, adesso) };
    }
    case 'extra':      return { ok: true, dati: datiExtra(db, utente, adesso) };
    case 'dipendenti': return { ok: true, dati: datiDipendenti(db, utente) };
    case 'utenti':
      if (!utente.admin) return { ok: false, errore: 'Solo l\'amministratore vede questa schermata.' };
      return { ok: true, dati: datiUtenti(db, urlPubblico) };
    default: return { ok: false, errore: 'Schermata sconosciuta.' };
  }
}
