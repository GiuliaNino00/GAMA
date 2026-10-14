/**
 * PRESENZE GAMA — Strato dati
 * ---------------------------------------------------------------------------
 * Tutto quello che legge o scrive il database passa da qui, insieme alla
 * regola delle squadre (chi vede chi). Il resto dell'app non scrive SQL.
 */
import crypto from 'node:crypto';
import { CFG } from './config.js';
import * as D from './date.js';
import { nomeBreve } from './nomi.js';

// ---------------------------------------------------------------- registro

export function registra(db, tipo, testo) {
  try {
    db.prepare('INSERT INTO registro (quando, tipo, testo) VALUES (?, ?, ?)')
      .run(D.timbro(), String(tipo), String(testo).slice(0, 500));
  } catch { /* il registro non deve mai far cadere l'app */ }
}

export function sfoltisciRegistro(db, daTenere = 3000) {
  db.prepare('DELETE FROM registro WHERE id <= (SELECT MAX(id) FROM registro) - ?').run(daTenere);
}

// ---------------------------------------------------------------- impostazioni

export function leggiImpostazione(db, k) {
  const r = db.prepare('SELECT valore FROM impostazioni WHERE chiave = ?').get(k);
  return r ? r.valore : null;
}

export function scriviImpostazione(db, k, v) {
  db.prepare('INSERT INTO impostazioni (chiave, valore) VALUES (?, ?) ' +
             'ON CONFLICT(chiave) DO UPDATE SET valore = excluded.valore').run(k, String(v));
}

// ---------------------------------------------------------------- squadre e permessi

export function squadraDi(v) {
  return String(v || '').trim().toUpperCase();
}

/**
 * Puo' questo utente vedere un dipendente di questa squadra?
 * L'amministratore vede tutti. Un socio vede SOLO la sua squadra: ne' l'altra,
 * ne' chi non ha ancora una squadra. Un socio senza squadra non vede nessuno.
 */
/** Amministratore e Agenzia vedono e correggono tutte le squadre (gli utenti li gestisce solo l'amministratore). */
export function vedeTutto(utente) {
  return !!utente && (utente.admin === true || utente.agenzia === true);
}

export function puoVedere(utente, squadra) {
  if (!utente) return false;
  if (vedeTutto(utente)) return true;
  return !!utente.squadra && squadra === utente.squadra;
}

/** "Muratori", "tutte le squadre"... */
export function descriviAmbito(utente) {
  if (!utente) return '';
  if (vedeTutto(utente)) return 'tutte le squadre';
  if (utente.squadra) return utente.squadra.charAt(0) + utente.squadra.slice(1).toLowerCase();
  return 'nessuna squadra assegnata';
}

export function nomiAmministratori(db) {
  return db.prepare('SELECT nome FROM utenti WHERE admin = 1 AND attivo = 1 ORDER BY id').all().map((r) => r.nome);
}

/** Perche' un utente non vede nessuno, detto con parole sue ('' se vede qualcuno). */
export function avvisoAmbito(db, utente) {
  if (!utente || dipendentiDi(db, utente).length) return '';
  const admin = nomiAmministratori(db).filter((n) => n !== utente.nome)[0] || "l'amministratore";
  if (vedeTutto(utente)) return 'Non c\'è ancora nessun dipendente attivo: aggiungili da 👷 Dipendenti.';
  if (!utente.squadra) {
    return 'Non hai ancora una squadra assegnata, quindi non vedi nessun dipendente. Chiedi a ' + admin + ' di assegnartela.';
  }
  return 'Nella squadra ' + utente.squadra.toLowerCase() + ' non c\'è ancora nessun dipendente. ' +
         'Chiedi a ' + admin + ' di assegnarli alla tua squadra.';
}

// ---------------------------------------------------------------- utenti dell'app

function utenteDaRiga(r) {
  if (!r) return null;
  return {
    id: r.id,
    nome: r.nome,
    squadra: r.squadra,
    admin: r.admin === 1,
    agenzia: r.agenzia === 1,
    attivo: r.attivo === 1,
    chiave: r.chiave,
    telegram: r.telegram_chat_id,
    ultimoAccesso: r.ultimo_accesso
  };
}

/** Una chiave lunga e casuale: e' quello che sta dentro il link personale. */
export function nuovaChiave() {
  return crypto.randomBytes(18).toString('base64url');
}

export function utentePerChiave(db, k) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(k || ''))) return null;
  return utenteDaRiga(db.prepare('SELECT * FROM utenti WHERE chiave = ? AND attivo = 1').get(k));
}

export function utentePerId(db, id) {
  return utenteDaRiga(db.prepare('SELECT * FROM utenti WHERE id = ?').get(id));
}

export function utentePerNome(db, nome) {
  return utenteDaRiga(db.prepare('SELECT * FROM utenti WHERE nome = ? COLLATE NOCASE').get(nome));
}

export function utentiAttivi(db) {
  return db.prepare('SELECT * FROM utenti WHERE attivo = 1 ORDER BY admin DESC, id').all().map(utenteDaRiga);
}

export function tuttiUtenti(db) {
  return db.prepare('SELECT * FROM utenti ORDER BY attivo DESC, admin DESC, id').all().map(utenteDaRiga);
}

export function creaUtente(db, { nome, squadra = '', admin = false, agenzia = false, telegram = '' }) {
  if (admin) agenzia = false;
  if (admin || agenzia) squadra = '';
  const info = db.prepare(
    'INSERT INTO utenti (nome, squadra, admin, agenzia, attivo, chiave, telegram_chat_id, creato) VALUES (?, ?, ?, ?, 1, ?, ?, ?)'
  ).run(nome, squadraDi(squadra), admin ? 1 : 0, agenzia ? 1 : 0, nuovaChiave(), String(telegram || ''), D.timbro());
  registra(db, 'UTENTI', 'creato ' + nome + (admin ? ' (amministratore)' : agenzia ? ' (agenzia)' : squadra ? ' (' + squadraDi(squadra) + ')' : ''));
  return utentePerId(db, info.lastInsertRowid);
}

/** Cambia squadra, ruolo, attivo, telegram. Solo i campi passati. */
export function aggiornaUtente(db, id, campi) {
  const set = [], valori = [];
  if ('squadra' in campi) { set.push('squadra = ?'); valori.push(squadraDi(campi.squadra)); }
  if ('admin' in campi) { set.push('admin = ?'); valori.push(campi.admin ? 1 : 0); }
  if ('agenzia' in campi) { set.push('agenzia = ?'); valori.push(campi.agenzia ? 1 : 0); }
  if ('attivo' in campi) { set.push('attivo = ?'); valori.push(campi.attivo ? 1 : 0); }
  if ('telegram' in campi) { set.push('telegram_chat_id = ?'); valori.push(String(campi.telegram || '')); }
  if ('nome' in campi) { set.push('nome = ?'); valori.push(campi.nome); }
  if (!set.length) return utentePerId(db, id);
  db.prepare('UPDATE utenti SET ' + set.join(', ') + ' WHERE id = ?').run(...valori, id);
  return utentePerId(db, id);
}

/** Nuovo link: quello vecchio smette subito di funzionare. */
export function rigeneraChiave(db, id) {
  db.prepare('UPDATE utenti SET chiave = ? WHERE id = ?').run(nuovaChiave(), id);
  db.prepare('DELETE FROM iscrizioni_push WHERE utente_id = ?').run(id);
  return utentePerId(db, id);
}

export function segnaAccesso(db, id) {
  db.prepare('UPDATE utenti SET ultimo_accesso = ? WHERE id = ?').run(D.timbro(), id);
}

export function linkUtente(urlPubblico, utente) {
  return urlPubblico.replace(/\/+$/, '') + '/u/' + utente.chiave + '/';
}

// ---------------------------------------------------------------- dipendenti

function dipendenteDaRiga(r) {
  return {
    id: r.id,
    nome: r.nome,
    completo: r.nome_completo,
    squadra: r.squadra,
    attivo: r.attivo === 1,
    ordine: r.ordine
  };
}

/** Tutti, anche quelli non attivi, nell'ordine del foglio. */
export function dipendentiTutti(db) {
  return db.prepare('SELECT * FROM dipendenti ORDER BY ordine, id').all().map(dipendenteDaRiga);
}

export function dipendentiAttivi(db) {
  return db.prepare('SELECT * FROM dipendenti WHERE attivo = 1 ORDER BY ordine, id').all().map(dipendenteDaRiga);
}

/** I dipendenti attivi che questo utente gestisce. */
export function dipendentiDi(db, utente) {
  return dipendentiAttivi(db).filter((d) => puoVedere(utente, d.squadra));
}

/** Tutti quelli che questo utente gestisce, anche i non attivi. */
export function dipendentiTuttiDi(db, utente) {
  return dipendentiTutti(db).filter((d) => puoVedere(utente, d.squadra));
}

/** Le squadre con nome che hanno almeno un dipendente attivo. */
export function squadreAttive(db) {
  return [...new Set(dipendentiAttivi(db).map((d) => d.squadra).filter(Boolean))];
}

/** Prima le squadre nell'ordine di CFG.SQUADRE, poi chi non ne ha; dentro, l'ordine del foglio. */
export function ordinaPerSquadra(lista) {
  const peso = (sq) => { const i = CFG.SQUADRE.indexOf(sq); return i < 0 ? 99 : i; };
  return lista.slice().sort((a, b) => (peso(a.squadra) - peso(b.squadra)) || (a.ordine - b.ordine) || (a.id - b.id));
}

export function dipendentePerNome(db, nome) {
  const r = db.prepare('SELECT * FROM dipendenti WHERE nome = ?').get(String(nome || '').trim());
  return r ? dipendenteDaRiga(r) : null;
}

/**
 * Aggiunge un dipendente in fondo all'elenco. `completo` e' gia' ripulito
 * (vedi nomePulito). Restituisce la forma breve con cui compare sul foglio.
 */
export function aggiungiDipendente(db, completo, squadra) {
  const tutti = dipendentiTutti(db);
  const breve = nomeBreve(completo, tutti.map((d) => d.nome));

  const doppione = tutti.find((d) =>
    d.nome.toUpperCase() === breve.toUpperCase() ||
    d.nome.toUpperCase() === completo.toUpperCase() ||
    (d.completo && d.completo.toUpperCase() === completo.toUpperCase()));
  if (doppione) {
    return { ok: false, doppione, errore: doppione.nome + ' è già nell\'elenco' +
      (doppione.attivo ? '.' : ', ma non è attivo: riattivalo toccandolo.') };
  }

  const ordine = tutti.reduce((m, d) => Math.max(m, d.ordine), 0) + 1;
  db.prepare('INSERT INTO dipendenti (nome, nome_completo, squadra, attivo, ordine) VALUES (?, ?, ?, 1, ?)')
    .run(breve, completo, squadraDi(squadra), ordine);
  registra(db, 'ORGANICO', 'aggiunto ' + breve + (squadra ? ' (' + squadraDi(squadra) + ')' : ''));
  return { ok: true, nome: breve };
}

export function cambiaAttivo(db, nome, attivo) {
  const r = db.prepare('UPDATE dipendenti SET attivo = ? WHERE nome = ?').run(attivo ? 1 : 0, nome);
  if (r.changes) registra(db, 'ORGANICO', nome + (attivo ? ' riattivato' : ' disattivato'));
  return r.changes > 0;
}

export function cambiaSquadra(db, nome, squadra) {
  const r = db.prepare('UPDATE dipendenti SET squadra = ? WHERE nome = ?').run(squadraDi(squadra), nome);
  if (r.changes) registra(db, 'ORGANICO', nome + ' -> squadra ' + (squadraDi(squadra) || 'nessuna'));
  return r.changes > 0;
}

// ---------------------------------------------------------------- presenze

/**
 * Salva (o corregge) una giornata: { "ROSSI M.": "ORD", ... }.
 * Una sola transazione: o si salva tutto o niente.
 */
export function salvaPresenze(db, dataChiave, stati, inseritoDa) {
  const trova = db.prepare('SELECT id FROM dipendenti WHERE nome = ?');
  const scrivi = db.prepare(
    'INSERT INTO presenze (data, dipendente_id, codice, ore, inserito_da, aggiornato) VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(data, dipendente_id) DO UPDATE SET codice = excluded.codice, ore = excluded.ore, ' +
    'inserito_da = excluded.inserito_da, aggiornato = excluded.aggiornato');
  const quando = D.timbro();
  let quanti = 0;
  db.transaction(() => {
    for (const [nome, cod] of Object.entries(stati)) {
      const d = trova.get(nome);
      const def = CFG.CODICI[cod];
      if (!d || !def) continue;
      scrivi.run(dataChiave, d.id, cod, def.ore, inseritoDa, quando);
      quanti++;
    }
  })();
  registra(db, 'PRESENZE', dataChiave + ': ' + quanti + ' righe da ' + inseritoDa);
  return quanti;
}

/**
 * L'impronta di una giornata per un gruppo di dipendenti: cambia appena qualcuno
 * salva. Serve a non riconfermare sopra dati vecchi (vedi salvaAppello).
 */
export function improntaGiorno(db, dataChiave, ids) {
  if (!ids.length) return { impronta: '', quando: '' };
  const r = db.prepare('SELECT MAX(aggiornato) AS m, COUNT(*) AS n FROM presenze WHERE data = ? AND dipendente_id IN (' +
    ids.map(() => '?').join(',') + ')').get(dataChiave, ...ids);
  return { impronta: r.n ? r.m + '|' + r.n : '', quando: r.m ? r.m.slice(11, 16) : '' };
}

/** { "ROSSI M.": { codice, ore, inseritoDa } } per un giorno. */
export function presenzeDelGiorno(db, dataChiave) {
  const out = {};
  db.prepare('SELECT d.nome, p.codice, p.ore, p.inserito_da FROM presenze p JOIN dipendenti d ON d.id = p.dipendente_id WHERE p.data = ?')
    .all(dataChiave)
    .forEach((r) => { out[r.nome] = { codice: r.codice, ore: r.ore, inseritoDa: r.inserito_da }; });
  return out;
}

export function presenzeIntervallo(db, dal, al) {
  return db.prepare(
    'SELECT p.data, d.nome, d.id AS dipendenteId, p.codice, p.ore, p.inserito_da AS inseritoDa ' +
    'FROM presenze p JOIN dipendenti d ON d.id = p.dipendente_id WHERE p.data BETWEEN ? AND ? ORDER BY p.data')
    .all(D.chiave(dal), D.chiave(al));
}

/**
 * I giorni "fatti" per un utente, fra `dal` e `al`: { "2026-09-15": true }.
 * Socio: fatto se ha segnato almeno uno dei suoi uomini.
 * Amministratore: fatto solo se OGNI squadra con dipendenti attivi ha compilato
 * (chi non ha squadra non conta); se nessuno ha una squadra, basta una riga.
 */
export function giorniCompilatiPer(db, utente, dal, al) {
  const attivi = dipendentiAttivi(db);
  const righe = presenzeIntervallo(db, dal, al);
  const out = {};

  if (!vedeTutto(utente)) {
    const miei = new Set(attivi.filter((d) => puoVedere(utente, d.squadra)).map((d) => d.id));
    righe.forEach((p) => { if (miei.has(p.dipendenteId)) out[p.data] = true; });
    return out;
  }

  const squadraDi = new Map(attivi.map((d) => [d.id, d.squadra]));
  const squadre = squadreAttive(db);
  const perGiorno = {};
  righe.forEach((p) => {
    if (!squadraDi.has(p.dipendenteId)) return;
    (perGiorno[p.data] = perGiorno[p.data] || new Set()).add(squadraDi.get(p.dipendenteId));
  });
  for (const [data, viste] of Object.entries(perGiorno)) {
    out[data] = squadre.length ? squadre.every((sq) => viste.has(sq)) : true;
  }
  return out;
}

/** I giorni di lavoro ancora vuoti per questo utente, da D.inizioRecupero a oggi (Date, dal piu' recente). */
export function giorniDaSistemare(db, utente, adesso = new Date()) {
  if (!dipendentiDi(db, utente).length) return [];
  const oggi = D.oggi(adesso);
  const dal = D.inizioRecupero(adesso);
  const fatti = giorniCompilatiPer(db, utente, dal, oggi);
  const out = [];
  for (let d = oggi; d >= dal; d = D.aggiungiGiorni(d, -1)) {
    if (D.giornoDiLavoro(d) && !fatti[D.chiave(d)]) out.push(d);
  }
  return out;
}

/**
 * I giorni di lavoro di un mese (anche quelli che devono ancora venire) che per
 * questo utente non sono compilati: [3, 4, 17]. Con l'amministratore vuol dire
 * "almeno una squadra non ha segnato". Vuoto = mese completo.
 */
export function giorniMancantiDelMese(db, utente, anno, mese0) {
  if (!dipendentiDi(db, utente).length) return [];
  const dal = new Date(anno, mese0, 1), al = new Date(anno, mese0 + 1, 0);
  const fatti = giorniCompilatiPer(db, utente, dal, al);
  const out = [];
  for (let d = dal; d <= al; d = D.aggiungiGiorni(d, 1)) {
    if (D.giornoDiLavoro(d) && !fatti[D.chiave(d)]) out.push(d.getDate());
  }
  return out;
}

/** Il foglio per l'agenzia si fa solo quando ogni squadra ha compilato ogni giorno di lavoro. */
export function mancantiPerIlFoglio(db, anno, mese0) {
  return giorniMancantiDelMese(db, { admin: true }, anno, mese0);
}

// ---------------------------------------------------------------- compensi extra

export function salvaExtra(db, mese, nome, importo, nota, inseritoDa) {
  const d = dipendentePerNome(db, nome);
  if (!d) return false;
  db.prepare('INSERT INTO extra (mese, dipendente_id, importo, nota, inserito_da, creato) VALUES (?, ?, ?, ?, ?, ?)')
    .run(mese, d.id, importo, nota || '', inseritoDa, D.timbro());
  registra(db, 'EXTRA', mese + ' ' + nome + ' ' + importo + ' € da ' + inseritoDa);
  return true;
}

/** { "ROSSI M.": { totale, note: [...] } } per un mese "2026-09". */
export function extraDelMese(db, mese) {
  const out = {};
  db.prepare('SELECT d.nome, e.importo, e.nota FROM extra e JOIN dipendenti d ON d.id = e.dipendente_id WHERE e.mese = ? ORDER BY e.id')
    .all(mese)
    .forEach((r) => {
      const x = (out[r.nome] = out[r.nome] || { totale: 0, note: [] });
      x.totale = Math.round((x.totale + r.importo) * 100) / 100;
      if (r.nota) x.note.push(r.nota);
    });
  return out;
}
