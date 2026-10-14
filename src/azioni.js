/**
 * PRESENZE GAMA — Tutto quello che SCRIVE
 * ---------------------------------------------------------------------------
 * Non ci si fida di quello che arriva dal telefono: ogni azione ricontrolla
 * chi la chiede e su chi agisce, come faceva appAzione nella versione Google.
 */
import { CFG } from './config.js';
import * as D from './date.js';
import * as Q from './dati.js';
import { nomePulito, nomeUtente } from './nomi.js';
import { datiAppello } from './viste.js';

export function esegui(db, utente, azione, carico, { urlPubblico = '', adesso = new Date() } = {}) {
  const c = carico && typeof carico === 'object' ? carico : {};
  switch (azione) {
    case 'salvaAppello':    return salvaAppello(db, utente, c, adesso);
    case 'salvaExtra':      return salvaExtra(db, utente, c, adesso);
    case 'nuovoDipendente': return nuovoDipendente(db, utente, c);
    case 'cambiaAttivo':    return cambiaAttivo(db, utente, c);
    case 'cambiaSquadra':   return cambiaSquadra(db, utente, c);
    case 'nuovoUtente':     return nuovoUtente(db, utente, c, urlPubblico);
    case 'aggiornaUtente':  return aggiornaUtente(db, utente, c);
    case 'rigeneraLink':    return rigeneraLink(db, utente, c, urlPubblico);
    default:                return { ok: false, errore: 'Azione sconosciuta.' };
  }
}

// ---------------------------------------------------------------- appello

/** Un socio sistema solo gli ultimi giorni; i mesi gia' chiusi li tocca l'amministratore. */
export function troppoVecchioPer(db, utente, data, adesso) {
  if (utente.admin) return '';
  const limite = D.aggiungiGiorni(D.oggi(adesso), -(CFG.GIORNI_RECUPERO - 1));
  if (data >= limite) return '';
  const admin = Q.nomiAmministratori(db)[0] || 'l\'amministratore';
  return 'Si possono sistemare solo gli ultimi ' + CFG.GIORNI_RECUPERO + ' giorni. Per ' + D.umana(data) + ' chiedi a ' + admin + '.';
}

function salvaAppello(db, utente, c, adesso) {
  if (!D.codiceValido(c.d)) return { ok: false, errore: 'Data non valida.' };
  const data = D.daCodice(c.d);
  if (data > D.oggi(adesso)) return { ok: false, errore: 'Quel giorno deve ancora venire.' };
  const vecchio = troppoVecchioPer(db, utente, data, adesso);
  if (vecchio) return { ok: false, errore: vecchio };

  // Se la pagina dice su quale versione della giornata ha lavorato e nel frattempo
  // qualcuno ha salvato, non si sovrascrive: si rimanda indietro la versione nuova.
  // (Le giornate inviate dalla coda "senza campo" non mandano l'impronta: vince l'ultima.)
  const miei = Q.dipendentiDi(db, utente);
  if (typeof c.impronta === 'string') {
    const ora = Q.improntaGiorno(db, D.chiave(data), miei.map((d) => d.id)).impronta;
    if (ora !== c.impronta) {
      const fresco = datiAppello(db, data, utente);
      return {
        ok: false, conflitto: true, dati: fresco,
        errore: 'Nel frattempo ' + (fresco.giaFatto || 'qualcuno') + ' ha salvato questa giornata: ecco la versione aggiornata. Controlla e conferma di nuovo.'
      };
    }
  }

  const validi = new Set(miei.map((d) => d.nome));
  const stati = {};
  for (const [nome, cod] of Object.entries(c.stati || {})) {
    if (validi.has(nome) && CFG.CODICI[String(cod)]) stati[nome] = String(cod);
  }
  if (!Object.keys(stati).length) return { ok: false, errore: 'Non è arrivato nessun nome della tua squadra.' };

  Q.salvaPresenze(db, D.chiave(data), stati, utente.nome);

  let ore = 0, presenti = 0;
  for (const cod of Object.values(stati)) {
    if (CFG.CODICI[cod].riga === 'ord.') { ore += CFG.CODICI[cod].ore; presenti++; }
  }
  return { ok: true, messaggio: presenti + ' al lavoro, ' + ore + ' ore registrate.' };
}

// ---------------------------------------------------------------- compensi extra

function salvaExtra(db, utente, c, adesso) {
  const nome = String(c.dipendente || '').trim();
  const importo = Math.round(Number(c.importo) * 100) / 100;
  const nota = String(c.nota || '').trim().slice(0, 200);

  if (!Q.dipendentiDi(db, utente).some((d) => d.nome === nome)) {
    return { ok: false, errore: 'Dipendente non trovato nella tua squadra.' };
  }
  if (!(importo > 0) || importo > 100000) return { ok: false, errore: 'La cifra non è valida.' };

  Q.salvaExtra(db, D.meseChiave(adesso.getFullYear(), adesso.getMonth()), nome, importo, nota, utente.nome);
  return { ok: true, messaggio: nome + ': ' + importo.toFixed(2).replace('.', ',') + ' € registrati.' };
}

// ---------------------------------------------------------------- organico

function nuovoDipendente(db, utente, c) {
  const completo = nomePulito(c.completo);
  if (!completo) return { ok: false, errore: 'Serve cognome e nome, solo lettere: per esempio ROSSI MARIO.' };

  // Un socio assume sempre nella propria squadra. L'amministratore sceglie.
  let squadra;
  if (utente.admin) {
    squadra = Q.squadraDi(c.squadra);
    if (squadra && !CFG.SQUADRE.includes(squadra)) return { ok: false, errore: 'Squadra sconosciuta.' };
  } else {
    if (!utente.squadra) return { ok: false, errore: 'Non hai ancora una squadra: chiedi all\'amministratore.' };
    squadra = utente.squadra;
  }

  const esito = Q.aggiungiDipendente(db, completo, squadra);
  if (!esito.ok) {
    // se il doppione sta in un'altra squadra, il socio non deve sapere chi e'
    if (esito.doppione && !Q.puoVedere(utente, esito.doppione.squadra)) {
      const admin = Q.nomiAmministratori(db)[0] || 'l\'amministratore';
      return { ok: false, errore: 'Esiste già un dipendente con questo nome in un\'altra squadra: chiedi a ' + admin + '.' };
    }
    return { ok: false, errore: esito.errore };
  }
  return { ok: true, messaggio: esito.nome + ' aggiunto.', nome: esito.nome, squadra };
}

/** Un socio tocca solo i suoi uomini; l'amministratore tutti. */
function gestibile(db, utente, nome) {
  return Q.dipendentiTuttiDi(db, utente).some((d) => d.nome === nome);
}

function cambiaAttivo(db, utente, c) {
  const nome = String(c.nome || '').trim();
  const attivo = c.attivo === true;
  if (!gestibile(db, utente, nome)) return { ok: false, errore: 'Non è nella tua squadra.' };
  if (!Q.cambiaAttivo(db, nome, attivo)) return { ok: false, errore: 'Dipendente non trovato.' };
  return { ok: true, messaggio: nome + (attivo ? ' è di nuovo attivo.' : ' non è più attivo.') };
}

function cambiaSquadra(db, utente, c) {
  if (!utente.admin) return { ok: false, errore: 'Solo l\'amministratore può cambiare squadra.' };
  const nome = String(c.nome || '').trim();
  const squadra = Q.squadraDi(c.squadra);
  if (squadra && !CFG.SQUADRE.includes(squadra)) return { ok: false, errore: 'Squadra sconosciuta.' };
  if (!Q.cambiaSquadra(db, nome, squadra)) return { ok: false, errore: 'Dipendente non trovato.' };
  return { ok: true, messaggio: nome + ' → ' + (squadra ? squadra.toLowerCase() : 'nessuna squadra') };
}

// ---------------------------------------------------------------- utenti (solo amministratore)

function soloAdmin(utente) {
  return utente.admin ? null : { ok: false, errore: 'Solo l\'amministratore può farlo.' };
}

function nuovoUtente(db, utente, c, urlPubblico) {
  const no = soloAdmin(utente); if (no) return no;
  const nome = nomeUtente(c.nome);
  if (!nome) return { ok: false, errore: 'Scrivi un nome (solo lettere, senza simboli).' };
  if (Q.utentePerNome(db, nome)) return { ok: false, errore: 'C\'è già qualcuno con questo nome.' };
  const admin = c.admin === true;
  const squadra = admin ? '' : Q.squadraDi(c.squadra);
  if (!admin && !CFG.SQUADRE.includes(squadra)) return { ok: false, errore: 'Scegli la squadra.' };

  const nuovo = Q.creaUtente(db, { nome, squadra, admin });
  return { ok: true, messaggio: nome + ' può usare l\'app: mandagli il suo link.', link: Q.linkUtente(urlPubblico, nuovo), id: nuovo.id };
}

function aggiornaUtente(db, utente, c) {
  const no = soloAdmin(utente); if (no) return no;
  const altro = Q.utentePerId(db, Number(c.id));
  if (!altro) return { ok: false, errore: 'Utente non trovato.' };

  const campi = {};
  if ('squadra' in c) {
    const sq = Q.squadraDi(c.squadra);
    if (sq && !CFG.SQUADRE.includes(sq)) return { ok: false, errore: 'Squadra sconosciuta.' };
    campi.squadra = sq;
  }
  if ('admin' in c) campi.admin = c.admin === true;
  if ('attivo' in c) campi.attivo = c.attivo === true;

  // Non ci si chiude fuori da soli.
  if (altro.id === utente.id && (campi.admin === false || campi.attivo === false)) {
    return { ok: false, errore: 'Non puoi togliere i permessi a te stesso.' };
  }
  const restanoAdmin = Q.utentiAttivi(db).filter((u) => u.admin && u.id !== altro.id).length;
  if (altro.admin && (campi.admin === false || campi.attivo === false) && restanoAdmin === 0) {
    return { ok: false, errore: 'Deve restare almeno un amministratore.' };
  }

  const fatto = Q.aggiornaUtente(db, altro.id, campi);
  Q.registra(db, 'UTENTI', 'modificato ' + fatto.nome + ' ' + JSON.stringify(campi) + ' da ' + utente.nome);
  return { ok: true, messaggio: fatto.nome + ' aggiornato.' };
}

function rigeneraLink(db, utente, c, urlPubblico) {
  const no = soloAdmin(utente); if (no) return no;
  const altro = Q.utentePerId(db, Number(c.id));
  if (!altro) return { ok: false, errore: 'Utente non trovato.' };
  const fatto = Q.rigeneraChiave(db, altro.id);
  Q.registra(db, 'UTENTI', 'nuovo link per ' + fatto.nome + ' da ' + utente.nome);
  return {
    ok: true,
    messaggio: 'Nuovo link per ' + fatto.nome + ': quello vecchio non funziona più.',
    link: Q.linkUtente(urlPubblico, fatto),
    propria: altro.id === utente.id
  };
}
