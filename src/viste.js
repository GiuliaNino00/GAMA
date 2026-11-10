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
  const conRighe = new Set(Q.compilazioniIntervallo(db, dal, al).map((p) => p.dipendenteId));
  const lista = Q.dipendentiTuttiDi(db, utente).filter((d) => d.attivo || conRighe.has(d.id));
  return Q.ordinaPerSquadra(lista);
}

export function datiAppello(db, data, utente) {
  if (D.eSabato(data)) return datiSabato(db, data, utente);
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
      stato: gia[d.nome] ? gia[d.nome].codice : D.statoPredefinito(data),
      // le ore servono solo per "altre ore": per gli altri codici le dice il codice
      ...(gia[d.nome] && gia[d.nome].codice === 'ALT' ? { ore: gia[d.nome].ore } : {})
    }))
  };
}

/**
 * Il sabato: niente ore, la trasferta in euro di ognuno. `suggerito` e' l'ultima
 * trasferta maggiore di zero dei sabati prima: la pagina parte da li'.
 */
export function datiSabato(db, data, utente) {
  const elenco = Q.ordinaPerSquadra(Q.dipendentiDi(db, utente));
  const k = D.chiave(data);
  const tutte = Q.sabatoDelGiorno(db, k);
  const ids = elenco.map((d) => d.id);
  const consigli = Q.suggerimentiSabato(db, k, ids);
  const toccati = elenco.filter((d) => tutte[d.nome]);
  const chi = [...new Set(toccati.map((d) => tutte[d.nome].inseritoDa || '?'))];
  const completo = toccati.length > 0 && Q.giorniCompilatiPer(db, utente, data, data)[k] === true;
  const { impronta, quando } = Q.improntaSabato(db, k, ids);
  return {
    sabato: true,
    codice: D.codice(data),
    giorno: D.umana(data),
    giaFatto: chi.join(' e '),
    completo,
    impronta,
    quando,
    righe: elenco.map((d) => ({
      nome: d.nome,
      squadra: d.squadra,
      importo: tutte[d.nome] ? tutte[d.nome].importo : null,
      suggerito: consigli.has(d.id) ? consigli.get(d.id) : null
    }))
  };
}

export function datiGiorni(db, utente, adesso = new Date()) {
  if (!Q.dipendentiDi(db, utente).length) return [];
  const oggi = D.oggi(adesso);
  const dal = D.inizioRecupero(adesso);
  const fatti = Q.giorniCompilatiPer(db, utente, dal, oggi);
  const out = [];
  for (let d = oggi; d >= dal; d = D.aggiungiGiorni(d, -1)) {
    if (!D.giornoDiLavoro(d)) continue;
    out.push({ codice: D.codice(d), etichetta: D.umana(d), fatto: fatti[D.chiave(d)] === true, oggi: d.getTime() === oggi.getTime() });
  }
  return out;
}

/**
 * Lo stato di ogni giorno di un periodo, dal punto di vista dell'utente:
 *   fatto · parziale (solo amministratore: una squadra si', l'altra no) · mancante ·
 *   riposo (domenica senza presenze) · futuro.
 * `apribile`: si puo' aprire l'appello di quel giorno (i soci da D.inizioRecupero in poi).
 */
export function statoGiorni(db, utente, dal, al, adesso = new Date()) {
  const oggi = D.oggi(adesso);
  const visibili = new Set(Q.dipendentiDi(db, utente).map((d) => d.id));
  const fatti = Q.giorniCompilatiPer(db, utente, dal, al);
  const conRighe = {};
  for (const p of Q.compilazioniIntervallo(db, dal, al)) if (visibili.has(p.dipendenteId)) conRighe[p.data] = true;
  const limite = Q.vedeTutto(utente) ? null : D.inizioRecupero(adesso);
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
  const per = new Map(elenco.map((d) => [d.id, { nome: d.nome, squadra: d.squadra, gg: 0, ore: 0, mezze: 0, fer: 0, fes: 0, pio: 0, sabati: 0, trasferte: 0 }]));

  for (const r of Q.presenzeIntervallo(db, dal, al)) {
    const p = per.get(r.dipendenteId);
    if (!p) continue;
    if (r.codice === 'ORD' || r.codice === 'ALT') { p.ore += r.ore; p.gg += 1; }
    if (r.codice === 'MEZ') { p.ore += r.ore; p.gg += 1; p.mezze += 1; }
    if (r.codice === 'FER') p.fer += 1;
    if (r.codice === 'FES') p.fes += 1;
    if (r.codice === 'PIO') p.pio += 1;
  }
  // le trasferte del sabato: a parte, mai mescolate alle ore
  for (const t of Q.sabatiIntervallo(db, dal, al)) {
    const p = per.get(t.dipendenteId);
    if (!p || !(t.importo > 0)) continue;
    p.sabati += 1;
    p.trasferte = Math.round((p.trasferte + t.importo) * 100) / 100;
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
  for (let d = new Date(dal); d <= al && d <= D.oggi(adesso); d = D.aggiungiGiorni(d, 1)) if (D.giornoDiLavoro(d) && !D.eSabato(d)) lavorativi++;

  const righe = elenco.map((d) => per.get(d.id));
  return {
    titolo, righe, oreTotali: righe.reduce((s, p) => s + p.ore, 0), mancanti, lavorativi, extra: [],
    trasferteTotali: Math.round(righe.reduce((s, p) => s + p.trasferte, 0) * 100) / 100
  };
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
  // il documento del mese (PDF + Excel): amministratore e Agenzia, solo a mese tutto
  // compilato e con i cantieri confermati; tutti e due preparano la mail al commercialista
  const tutto = Q.vedeTutto(utente);
  const pronto = tutto ? Q.prontoPerIlFoglio(db, anno, mese0) : null;
  r.daCompletare = pronto ? pronto.mancanti : [];
  r.cantieriConfermati = pronto ? pronto.confermati : null;
  r.senzaCantiere = pronto ? pronto.senzaCantiere : [];
  r.motivo = pronto ? Q.motivoFoglio(pronto, CFG.MESI[mese0].toLowerCase()) : '';
  r.scaricabile = !!(pronto && pronto.ok);
  r.commercialista = tutto ? CFG.COMMERCIALISTA : null;
  r.ditta = CFG.NOME_DITTA;
  const cantiere = Q.cantieriDelMese(db, D.meseChiave(anno, mese0));
  const idDi = new Map(Q.dipendentiTutti(db).map((d) => [d.nome, d.id]));
  r.righe.forEach((p) => { const c = cantiere.get(idDi.get(p.nome)); p.cantiere = c ? c.nome : ''; });
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
  const trasferte = D.eSabato(oggi) ? Q.sabatoDelGiorno(db, D.chiave(oggi)) : {};
  let inTrasferta = 0, euro = 0;
  for (const d of miei) {
    if (trasferte[d.nome] && trasferte[d.nome].importo > 0) { inTrasferta++; euro += trasferte[d.nome].importo; }
  }
  for (const d of miei) {
    const c = salvate[d.nome] && CFG.CODICI[salvate[d.nome].codice];
    if (c && c.riga === 'ord.') { presenti++; ore += salvate[d.nome].ore; }
  }

  const dow = oggi.getDay();
  const lun = D.aggiungiGiorni(oggi, -(dow === 0 ? 6 : dow - 1));
  const giorni = statoGiorni(db, utente, D.aggiungiGiorni(lun, -7), D.aggiungiGiorni(lun, 6), adesso);
  const sett = riassuntoPeriodo(db, lun, D.aggiungiGiorni(lun, 6), '', utente, adesso);
  const meseDal = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
  const mese = datiMese(db, oggi.getFullYear(), oggi.getMonth(), utente, adesso);

  return {
    oggi: { codice: app.codice, giorno: app.giorno, giaFatto: app.giaFatto, completo: app.completo,
            quando: app.quando, presenti, ore, persone: miei.length,
            sabato: !!app.sabato, inTrasferta, euro: Math.round(euro * 100) / 100 },
    // amministratore e agenzia: i cantieri del mese (o del prossimo) da confermare
    cantieri: Q.vedeTutto(utente) ? Q.cantieriDaConfermare(db, adesso) : [],
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

export function datiDipendenti(db, utente, adesso = new Date()) {
  // chi non ha squadra va in cima: e' quello che l'amministratore deve sistemare
  const lista = Q.ordinaPerSquadra(Q.dipendentiTuttiDi(db, utente));
  const senza = lista.filter((d) => !d.squadra), con = lista.filter((d) => d.squadra);
  const cantiere = Q.cantieriDelMese(db, D.meseDi(D.oggi(adesso)));
  return [...senza, ...con].map((d) => ({
    nome: d.nome, attivo: d.attivo, squadra: d.squadra,
    cantiere: cantiere.has(d.id) ? cantiere.get(d.id).nome : ''
  }));
}

/**
 * La schermata Cantieri di un mese (amministratore e agenzia): l'elenco dei cantieri,
 * ogni dipendente attivo con il suo cantiere (chi non ce l'ha in cima), la conferma.
 */
export function datiCantieri(db, utente, mese, adesso = new Date()) {
  const o = D.oggi(adesso);
  const { anno, mese0 } = D.daMeseChiave(mese);
  const assegnati = Q.cantieriDelMese(db, mese);
  const lista = Q.ordinaPerSquadra(Q.dipendentiAttivi(db)).map((d) => ({
    nome: d.nome, squadra: d.squadra,
    cantiere: assegnati.has(d.id) ? assegnati.get(d.id) : null
  }));
  const mesi = [-1, 0, 1].map((n) => D.meseDi(new Date(o.getFullYear(), o.getMonth() + n, 1)));
  return {
    mese,
    nome: CFG.MESI[mese0].toLowerCase(),
    titolo: CFG.MESI[mese0].toLowerCase() + ' ' + anno,
    mesi: mesi.map((m) => ({ mese: m, nome: CFG.MESI[D.daMeseChiave(m).mese0].toLowerCase() })),
    elenco: Q.cantieri(db),
    dipendenti: [...lista.filter((x) => !x.cantiere), ...lista.filter((x) => x.cantiere)],
    conferma: Q.confermaDel(db, mese)
  };
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
    agenzia: u.agenzia,
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
    agenzia: utente.agenzia,
    tutto: Q.vedeTutto(utente),
    squadra: utente.squadra,
    squadre: CFG.SQUADRE,
    ciclo: CFG.CICLO,
    oreAScelta: CFG.ORE_A_SCELTA,
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
    case 'dipendenti': return { ok: true, dati: datiDipendenti(db, utente, adesso) };
    case 'cantieri': {
      if (!Q.vedeTutto(utente)) return { ok: false, errore: 'I cantieri li gestiscono l\'amministratore e l\'agenzia.' };
      const o = D.oggi(adesso);
      const m = parametro ? String(parametro) : D.meseDi(o);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return { ok: false, errore: 'Mese non valido.' };
      return { ok: true, dati: datiCantieri(db, utente, m, adesso) };
    }
    case 'utenti':
      if (!utente.admin) return { ok: false, errore: 'Solo l\'amministratore vede questa schermata.' };
      return { ok: true, dati: datiUtenti(db, urlPubblico) };
    default: return { ok: false, errore: 'Schermata sconosciuta.' };
  }
}
