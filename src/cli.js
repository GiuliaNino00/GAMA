/**
 * PRESENZE GAMA — Comandi da terminale sul server
 * ---------------------------------------------------------------------------
 *   npm run cli -- nuovo-admin "Giuliano"
 *   npm run cli -- nuovo-socio "Matteo" MURATORI
 *   npm run cli -- nuovo-agenzia "Studio Rossi" (vede e corregge tutto, gestisce i dipendenti, non gli utenti)
 *   npm run cli -- link                      (elenca i link personali)
 *   npm run cli -- nuovo-link "Matteo"       (il vecchio smette di funzionare)
 *   npm run cli -- foglio 202609 [file.xlsx] (salva il foglio di settembre 2026, solo se completo;
 *                                             --anche-incompleto per farlo lo stesso)
 *   npm run cli -- prova-notifica "Giuliano"
 *   npm run cli -- backup
 */
import './fuso.js';
import fs from 'node:fs';
import { CFG, env } from './config.js';
import { apri, percorsoDb, backup } from './db.js';
import * as Q from './dati.js';
import { foglioMese, nomeScheda } from './foglio.js';
import { creaNotifiche } from './notifiche.js';
import { nomeUtente } from './nomi.js';

const E = env();
const db = apri(percorsoDb(E.CARTELLA_DATI));
const [comando, ...arg] = process.argv.slice(2);

function esci(msg) { console.log(msg); process.exit(1); }
function mostraLink(u) {
  console.log(u.nome + (u.admin ? ' [amministratore]' : u.agenzia ? ' [agenzia]' : ' [' + (u.squadra || 'senza squadra').toLowerCase() + ']') + '\n  ' + Q.linkUtente(E.URL_PUBBLICO, u));
}

switch (comando) {
  case 'nuovo-admin':
  case 'nuovo-agenzia':
  case 'nuovo-socio': {
    const nome = nomeUtente(arg[0]);
    if (!nome) esci('Scrivi il nome tra virgolette, per esempio: npm run cli -- ' + comando + ' "Giuliano"');
    if (Q.utentePerNome(db, nome)) esci('Esiste già un utente con questo nome: usa "link" per vedere il suo link.');
    const admin = comando === 'nuovo-admin', agenzia = comando === 'nuovo-agenzia';
    const squadra = admin || agenzia ? '' : Q.squadraDi(arg[1]);
    if (!admin && !agenzia && !CFG.SQUADRE.includes(squadra)) esci('Indica la squadra: ' + CFG.SQUADRE.join(' oppure '));
    mostraLink(Q.creaUtente(db, { nome, squadra, admin, agenzia }));
    break;
  }
  case 'link':
    Q.utentiAttivi(db).forEach(mostraLink);
    if (!Q.utentiAttivi(db).length) console.log('Nessun utente. Crea il primo con: npm run cli -- nuovo-admin "Giuliano"');
    break;
  case 'nuovo-link': {
    const u = Q.utentePerNome(db, arg[0] || '');
    if (!u) esci('Utente non trovato.');
    mostraLink(Q.rigeneraChiave(db, u.id));
    break;
  }
  case 'foglio': {
    const m = String(arg[0] || '').match(/^(\d{4})(0[1-9]|1[0-2])$/);
    if (!m) esci('Indica il mese come AAAAMM, per esempio 202609.');
    const anno = Number(m[1]), mese0 = Number(m[2]) - 1;
    const manca = Q.mancantiPerIlFoglio(db, anno, mese0);
    if (manca.length && !arg.includes('--anche-incompleto')) {
      esci('Il mese non è completo, mancano i giorni ' + manca.join(', ') + '. Per farlo lo stesso aggiungi --anche-incompleto');
    }
    const file = arg.slice(1).find((a) => a !== '--anche-incompleto') || 'Presenze ' + nomeScheda(anno, mese0) + '.xlsx';
    fs.writeFileSync(file, await foglioMese(db, anno, mese0));
    console.log('Scritto ' + file);
    break;
  }
  case 'prova-notifica': {
    const u = Q.utentePerNome(db, arg[0] || '');
    if (!u) esci('Utente non trovato.');
    const n = creaNotifiche(db, { urlPubblico: E.URL_PUBBLICO, telegramToken: E.TELEGRAM_TOKEN });
    const esito = await n.invia(u, { titolo: '🔔 Prova dal server', testo: 'Se la vedi, le notifiche funzionano.' });
    console.log('Telefoni raggiunti: ' + esito.push + ', falliti: ' + esito.falliti + (E.TELEGRAM_TOKEN ? ', Telegram: ' + (esito.telegram ? 'sì' : 'no') : ''));
    break;
  }
  case 'backup':
    console.log('Copia scritta in ' + await backup(db, E.CARTELLA_DATI, CFG.BACKUP_DA_TENERE));
    break;
  default:
    console.log([
      'Comandi:',
      '  nuovo-admin "Nome"            crea un amministratore e stampa il suo link',
      '  nuovo-socio "Nome" SQUADRA    crea un socio (' + CFG.SQUADRE.join(' / ') + ')',
      '  nuovo-agenzia "Nome"          crea un utente Agenzia (tutto tranne utenti e link)',
      '  link                          elenca i link personali',
      '  nuovo-link "Nome"             nuovo link per un utente (il vecchio smette di andare)',
      '  foglio AAAAMM [file.xlsx]     salva il foglio presenze di un mese (solo se completo)',
      '  prova-notifica "Nome"         manda una notifica di prova',
      '  backup                        copia di sicurezza del database adesso'
    ].join('\n'));
}
