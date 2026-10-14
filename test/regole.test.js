// Le regole di squadra, l'appello, gli extra, l'organico e gli utenti.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { banco, ADESSO, compilaMese } from './aiuto.js';
import * as Q from '../src/dati.js';
import * as V from '../src/viste.js';
import { esegui } from '../src/azioni.js';
import { nomePulito, nomeBreve } from '../src/nomi.js';
import * as D from '../src/date.js';

const ctx = { urlPubblico: 'https://presenze.esempio.it', adesso: ADESSO };
const nomi = (r) => r.dati.righe.map((x) => x.nome);
const appello = (db, u, cod = '20260916') => V.carica(db, u, 'appello', cod, ctx);

test('chi vede chi: un socio vede solo la sua squadra, l\'amministratore tutti', () => {
  const { db, giuliano, matteo, antonio } = banco();
  assert.deepEqual(nomi(appello(db, matteo)), ['PIPERIS P.', 'PIPERIS G.', 'ZUCCARO D.']);
  assert.deepEqual(nomi(appello(db, antonio)), ["D'AMORE E.", 'ATTIMONELLI D.']);
  // l'amministratore: prima i muratori, poi i carpentieri, poi chi non ha squadra
  assert.deepEqual(nomi(appello(db, giuliano)),
    ['PIPERIS P.', 'PIPERIS G.', 'ZUCCARO D.', "D'AMORE E.", 'ATTIMONELLI D.', 'STRIPPOLI F.']);
  assert.equal(V.carica(db, matteo, 'utenti', null, ctx).ok, false, 'un socio non vede la lista degli utenti');
});

test('salvare due volte lo stesso giorno corregge, non duplica', () => {
  const { db, matteo } = banco();
  const stati = { 'PIPERIS P.': 'ORD', 'PIPERIS G.': 'ASS', 'ZUCCARO D.': 'ORD' };
  assert.equal(esegui(db, matteo, 'salvaAppello', { d: '20260916', stati }, ctx).ok, true);
  assert.equal(esegui(db, matteo, 'salvaAppello', { d: '20260916', stati: { ...stati, 'PIPERIS G.': 'MEZ' } }, ctx).ok, true);
  const righe = db.prepare("SELECT COUNT(*) AS n FROM presenze WHERE data = '2026-09-16'").get().n;
  assert.equal(righe, 3);
  assert.equal(Q.presenzeDelGiorno(db, '2026-09-16')['PIPERIS G.'].codice, 'MEZ');
});

test('un socio non puo\' scrivere fuori dalla sua squadra', () => {
  const { db, matteo } = banco();
  const r = esegui(db, matteo, 'salvaAppello',
    { d: '20260916', stati: { 'PIPERIS P.': 'ORD', "D'AMORE E.": 'ASS', 'STRIPPOLI F.': 'ORD' } }, ctx);
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(Q.presenzeDelGiorno(db, '2026-09-16')), ['PIPERIS P.']);
  assert.equal(esegui(db, matteo, 'salvaAppello', { d: '20260916', stati: { "D'AMORE E.": 'ASS' } }, ctx).ok, false);
});

test('giornate fatte: per il socio la sua squadra, per l\'amministratore tutte le squadre', () => {
  const { db, giuliano, matteo, antonio } = banco();
  esegui(db, matteo, 'salvaAppello', { d: '20260916', stati: { 'PIPERIS P.': 'ORD' } }, ctx);
  const fatto = (u) => V.carica(db, u, 'giorni', null, ctx).dati.find((g) => g.codice === '20260916').fatto;
  assert.equal(fatto(matteo), true);
  assert.equal(fatto(antonio), false);
  assert.equal(fatto(giuliano), false, 'manca la squadra di Antonio');
  assert.equal(appello(db, antonio).dati.giaFatto, '', 'Antonio non deve trovarlo "già compilato"');
  esegui(db, antonio, 'salvaAppello', { d: '20260916', stati: { "D'AMORE E.": 'ORD' } }, ctx);
  assert.equal(fatto(giuliano), true, 'chi non ha squadra non blocca la giornata');
  assert.equal(appello(db, matteo).dati.giaFatto, 'Matteo');
});

test('l\'amministratore vede se la giornata e\' completa o fatta solo in parte', () => {
  const { db, giuliano, matteo, antonio } = banco();
  esegui(db, matteo, 'salvaAppello', { d: '20260916', stati: { 'PIPERIS P.': 'ORD' } }, ctx);
  let a = appello(db, giuliano).dati;
  assert.deepEqual([a.giaFatto, a.completo], ['Matteo', false]);
  assert.equal(appello(db, matteo).dati.completo, true, 'per Matteo la sua parte e\' completa');
  esegui(db, antonio, 'salvaAppello', { d: '20260916', stati: { "D'AMORE E.": 'ORD' } }, ctx);
  a = appello(db, giuliano).dati;
  assert.deepEqual([a.giaFatto, a.completo], ['Matteo e Antonio', true]);
});

test('nella lista dipendenti dell\'amministratore chi non ha squadra sta in cima', () => {
  const { db, giuliano } = banco();
  const d = V.carica(db, giuliano, 'dipendenti', null, ctx).dati;
  assert.equal(d[0].nome, 'STRIPPOLI F.');
  assert.deepEqual(d.slice(1).map((x) => x.squadra), ['MURATORI', 'MURATORI', 'MURATORI', 'CARPENTIERI', 'CARPENTIERI']);
});

test('niente appello per i giorni futuri, niente date inventate', () => {
  const { db, matteo } = banco();
  assert.equal(appello(db, matteo, '20260917').ok, false);
  assert.equal(appello(db, matteo, '20260231').ok, false);
  assert.equal(appello(db, matteo, '99999999').ok, false);
  assert.equal(esegui(db, matteo, 'salvaAppello', { d: '20260917', stati: { 'PIPERIS P.': 'ORD' } }, ctx).ok, false);
  assert.equal(esegui(db, matteo, 'salvaAppello', { d: '20260916', stati: { 'PIPERIS P.': 'XXX' } }, ctx).ok, false);
});

test('la domenica si parte da assente, gli altri giorni da 8 ore', () => {
  const { db, matteo } = banco();
  assert.ok(appello(db, matteo, '20260913').dati.righe.every((r) => r.stato === 'ASS'));
  assert.ok(appello(db, matteo, '20260914').dati.righe.every((r) => r.stato === 'ORD'));
  assert.equal(D.giornoDiLavoro(new Date(2026, 8, 13)), false);
  assert.equal(D.giornoDiLavoro(new Date(2026, 8, 12)), true, 'il sabato si lavora');
});

test('giorni da sistemare: dal 1° del mese, fino al 15 anche il mese prima, senza domeniche', () => {
  const { db, matteo } = banco();
  const g = V.carica(db, matteo, 'giorni', null, ctx).dati;
  assert.equal(g[0].codice, '20260916');
  assert.equal(g[0].oggi, true);
  assert.ok(g.every((x) => D.daCodice(x.codice).getDay() !== 0));
  assert.equal(g.at(-1).codice, '20260901', 'il 16 settembre si parte dal 1° settembre');
  assert.equal(g.length, 14, '16 giorni meno 2 domeniche');
  const il15 = V.carica(db, matteo, 'giorni', null, { ...ctx, adesso: new Date(2026, 8, 15, 19) }).dati;
  assert.equal(il15.at(-1).codice, '20260801', 'fino al 15 c\'e\' anche agosto');
  assert.equal(il15.length, 26 + 13, 'agosto (26 giorni di lavoro) + 1-15 settembre (13)');
  assert.equal(D.inizioRecupero(new Date(2026, 0, 10)).getTime(), new Date(2025, 11, 1).getTime(), 'a gennaio si torna a dicembre');
});

test('compensi extra: ognuno solo sui suoi, cifre controllate', () => {
  const { db, giuliano, matteo, antonio } = banco();
  assert.equal(esegui(db, antonio, 'salvaExtra', { dipendente: "D'AMORE E.", importo: 120, nota: 'sabato' }, ctx).ok, true);
  assert.equal(esegui(db, matteo, 'salvaExtra', { dipendente: 'ZUCCARO D.', importo: '50.5' }, ctx).ok, true);
  assert.equal(esegui(db, matteo, 'salvaExtra', { dipendente: "D'AMORE E.", importo: 100 }, ctx).ok, false);
  assert.equal(esegui(db, matteo, 'salvaExtra', { dipendente: 'ZUCCARO D.', importo: -5 }, ctx).ok, false);
  assert.equal(esegui(db, matteo, 'salvaExtra', { dipendente: 'ZUCCARO D.', importo: 'tanto' }, ctx).ok, false);
  const meseDi = (u) => V.carica(db, u, 'mese', '202609', ctx).dati;
  assert.deepEqual(meseDi(matteo).extra.map((x) => [x.nome, x.importo]), [['ZUCCARO D.', 50.5]]);
  assert.deepEqual(meseDi(antonio).extra.map((x) => x.nome), ["D'AMORE E."]);
  assert.equal(meseDi(giuliano).extra.length, 2);
  assert.equal(meseDi(matteo).scaricabile, false);
  assert.equal(meseDi(giuliano).scaricabile, false, 'settembre non e\' completo: niente foglio');
  assert.deepEqual(V.carica(db, matteo, 'extra', null, ctx).dati.dipendenti, ['PIPERIS P.', 'PIPERIS G.', 'ZUCCARO D.']);
});

test('riepiloghi: solo la propria squadra, ore giuste, giorni mancanti', () => {
  const { db, matteo } = banco();
  esegui(db, matteo, 'salvaAppello', { d: '20260914', stati: { 'PIPERIS P.': 'ORD', 'PIPERIS G.': 'MEZ', 'ZUCCARO D.': 'ASS' } }, ctx);
  const s = V.carica(db, matteo, 'settimana', null, ctx).dati;
  assert.equal(s.titolo, '14 settembre – 20 settembre');
  assert.deepEqual(s.righe.map((r) => r.nome), ['PIPERIS P.', 'PIPERIS G.', 'ZUCCARO D.']);
  assert.equal(s.oreTotali, 12);
  assert.deepEqual(s.mancanti, [15, 16]);
});

test('chi viene disattivato a meta\' mese resta nel riepilogo del mese in cui ha lavorato', () => {
  const { db, giuliano, matteo } = banco();
  esegui(db, matteo, 'salvaAppello', { d: '20260914', stati: { 'ZUCCARO D.': 'ORD' } }, ctx);
  esegui(db, matteo, 'cambiaAttivo', { nome: 'ZUCCARO D.', attivo: false }, ctx);
  assert.ok(!nomi(appello(db, matteo)).includes('ZUCCARO D.'), 'non e\' piu\' nell\'appello');
  assert.ok(V.carica(db, matteo, 'mese', '202609', ctx).dati.righe.some((r) => r.nome === 'ZUCCARO D.' && r.ore === 8));
  assert.ok(!V.carica(db, giuliano, 'mese', '202608', ctx).dati.righe.some((r) => r.nome === 'ZUCCARO D.'),
    'nel mese in cui non ha lavorato e non e\' attivo, non compare');
});

test('assunzioni: il socio assume nella sua squadra, l\'amministratore sceglie', () => {
  const { db, giuliano, matteo, antonio } = banco();
  const a = esegui(db, antonio, 'nuovoDipendente', { completo: 'verdi luigi', squadra: 'MURATORI' }, ctx);
  assert.equal(a.squadra, 'CARPENTIERI', 'Antonio non puo\' assumere per Matteo');
  assert.equal(a.nome, 'VERDI L.');
  assert.equal(esegui(db, matteo, 'nuovoDipendente', { completo: 'bianchi paolo' }, ctx).squadra, 'MURATORI');
  assert.equal(esegui(db, giuliano, 'nuovoDipendente', { completo: 'neri carlo', squadra: 'CARPENTIERI' }, ctx).squadra, 'CARPENTIERI');
  assert.equal(esegui(db, giuliano, 'nuovoDipendente', { completo: 'gialli mario', squadra: 'IDRAULICI' }, ctx).ok, false);
  assert.equal(esegui(db, matteo, 'nuovoDipendente', { completo: 'verdi luigi' }, ctx).ok, false, 'doppione');
  assert.equal(esegui(db, matteo, 'nuovoDipendente', { completo: 'rossi' }, ctx).ok, false, 'serve anche il nome');
  assert.equal(esegui(db, matteo, 'nuovoDipendente', { completo: 'r0ss1 m4rio' }, ctx).ok, false, 'niente numeri');
  // omonimo della forma breve: si tiene il nome intero
  assert.equal(esegui(db, matteo, 'nuovoDipendente', { completo: 'piperis pietro' }, ctx).nome, 'PIPERIS PIETRO');
  assert.equal(Q.dipendentePerNome(db, 'PIPERIS PIETRO').ordine, 10, 'in fondo all\'elenco');
});

test('organico: confini tra squadre e cambio squadra solo per l\'amministratore', () => {
  const { db, giuliano, matteo } = banco();
  assert.equal(esegui(db, matteo, 'cambiaAttivo', { nome: "D'AMORE E.", attivo: false }, ctx).ok, false);
  assert.equal(esegui(db, matteo, 'cambiaAttivo', { nome: 'STRIPPOLI F.', attivo: false }, ctx).ok, false);
  const r = esegui(db, giuliano, 'cambiaAttivo', { nome: 'STRIPPOLI F.', attivo: false }, ctx);
  assert.equal(r.messaggio, 'STRIPPOLI F. non è più attivo.');
  assert.equal(esegui(db, matteo, 'cambiaSquadra', { nome: 'PIPERIS P.', squadra: 'CARPENTIERI' }, ctx).ok, false);
  assert.equal(esegui(db, giuliano, 'cambiaSquadra', { nome: 'PIPERIS P.', squadra: 'CARPENTIERI' }, ctx).ok, true);
  assert.equal(esegui(db, giuliano, 'cambiaSquadra', { nome: 'PIPERIS P.', squadra: 'PITTORI' }, ctx).ok, false);
  assert.ok(V.carica(db, matteo, 'dipendenti', null, ctx).dati.every((d) => d.squadra === 'MURATORI'));
});

test('socio senza squadra: non vede nessuno e l\'app gli dice a chi chiedere', () => {
  const { db, matteo } = banco();
  Q.aggiornaUtente(db, matteo.id, { squadra: '' });
  const m = Q.utentePerId(db, matteo.id);
  assert.equal(appello(db, m).dati.righe.length, 0);
  assert.deepEqual(V.carica(db, m, 'giorni', null, ctx).dati, []);
  assert.equal(Q.giorniDaSistemare(db, m, ADESSO).length, 0);
  assert.match(V.avvio(db, m, { adesso: ADESSO }).avviso, /Chiedi a Giuliano/);
  assert.equal(esegui(db, m, 'nuovoDipendente', { completo: 'rossi mario' }, ctx).ok, false);
});

test('utenti: solo l\'amministratore li gestisce, e non si chiude fuori da solo', () => {
  const { db, giuliano, matteo } = banco();
  assert.equal(esegui(db, matteo, 'nuovoUtente', { nome: 'Pippo', squadra: 'MURATORI' }, ctx).ok, false);
  const n = esegui(db, giuliano, 'nuovoUtente', { nome: 'Luca', squadra: 'CARPENTIERI' }, ctx);
  assert.equal(n.ok, true);
  assert.match(n.link, /^https:\/\/presenze\.esempio\.it\/u\/[A-Za-z0-9_-]{24}\/$/);
  assert.equal(esegui(db, giuliano, 'nuovoUtente', { nome: 'Luca', squadra: 'MURATORI' }, ctx).ok, false, 'nome gia\' usato');
  assert.equal(esegui(db, giuliano, 'nuovoUtente', { nome: 'Senza', squadra: '' }, ctx).ok, false, 'serve la squadra');
  assert.equal(esegui(db, giuliano, 'nuovoUtente', { nome: '<b>x</b>', admin: true }, ctx).ok, false);
  assert.equal(esegui(db, giuliano, 'aggiornaUtente', { id: giuliano.id, admin: false }, ctx).ok, false);
  assert.equal(esegui(db, giuliano, 'aggiornaUtente', { id: giuliano.id, attivo: false }, ctx).ok, false);
  assert.equal(esegui(db, giuliano, 'aggiornaUtente', { id: matteo.id, squadra: 'CARPENTIERI' }, ctx).ok, true);
  assert.equal(Q.utentePerId(db, matteo.id).squadra, 'CARPENTIERI');
});

test('nuovo link: quello vecchio smette subito di funzionare', () => {
  const { db, giuliano, matteo } = banco();
  const vecchia = matteo.chiave;
  const r = esegui(db, giuliano, 'rigeneraLink', { id: matteo.id }, ctx);
  assert.equal(r.ok, true);
  assert.equal(Q.utentePerChiave(db, vecchia), null);
  assert.equal(Q.utentePerChiave(db, r.link.split('/u/')[1].replace('/', '')).nome, 'Matteo');
  esegui(db, giuliano, 'aggiornaUtente', { id: matteo.id, attivo: false }, ctx);
  assert.equal(Q.utentePerChiave(db, r.link.split('/u/')[1].replace('/', '')), null, 'utente disattivato: link morto');
});

test('nomi: pulizia e forma breve', () => {
  assert.equal(nomePulito('  rossi   mario '), 'ROSSI MARIO');
  assert.equal(nomePulito("d'amore emanuele"), "D'AMORE EMANUELE");
  assert.equal(nomePulito('rossi'), '');
  assert.equal(nomePulito('rossi <script>'), '');
  assert.equal(nomeBreve('ROSSI MARIO', []), 'ROSSI M.');
  assert.equal(nomeBreve('DE LUCA ANNA', []), 'DE LUCA A.');
  assert.equal(nomeBreve('ROSSI MARCO', ['ROSSI M.']), 'ROSSI MARCO');
});

test('i soci sistemano il mese in corso e fino al 15 il mese prima, l\'amministratore anche quelli vecchi', () => {
  const { db, giuliano, matteo } = banco();
  // ADESSO = 16 settembre: il limite e' il 1° settembre
  assert.equal(esegui(db, matteo, 'salvaAppello', { d: '20260901', stati: { 'PIPERIS P.': 'ORD' } }, ctx).ok, true);
  assert.equal(esegui(db, matteo, 'salvaAppello', { d: '20260901', stati: { 'PIPERIS P.': 'MEZ' } }, ctx).ok, true, 'anche correggere un giorno fatto');
  const vecchio = esegui(db, matteo, 'salvaAppello', { d: '20260831', stati: { 'PIPERIS P.': 'ORD' } }, ctx);
  assert.equal(vecchio.ok, false);
  assert.match(vecchio.errore, /da martedì 1 settembre in poi.*chiedi a Giuliano/);
  // il 15 settembre agosto e' ancora aperto, luglio no
  const il15 = { ...ctx, adesso: new Date(2026, 8, 15, 19) };
  assert.equal(esegui(db, matteo, 'salvaAppello', { d: '20260801', stati: { 'PIPERIS P.': 'ORD' } }, il15).ok, true);
  assert.equal(esegui(db, matteo, 'salvaAppello', { d: '20260731', stati: { 'PIPERIS P.': 'ORD' } }, il15).ok, false);
  assert.equal(appello(db, matteo, '20260831').ok, false);
  assert.equal(esegui(db, matteo, 'salvaAppello', { d: '20210104', stati: { 'PIPERIS P.': 'ORD' } }, ctx).ok, false);
  assert.equal(esegui(db, giuliano, 'salvaAppello', { d: '20260801', stati: { 'PIPERIS P.': 'FER' } }, ctx).ok, true);
  assert.equal(appello(db, giuliano, '20260801').ok, true);
});

test('assumere un doppione di un\'altra squadra non rivela chi e\'', () => {
  const { db, matteo } = banco();
  const r = esegui(db, matteo, 'nuovoDipendente', { completo: 'attimonelli domenico' }, ctx);
  assert.equal(r.ok, false);
  assert.ok(!/ATTIMONELLI/.test(r.errore), r.errore);
  assert.match(r.errore, /altra squadra/);
  const r2 = esegui(db, matteo, 'nuovoDipendente', { completo: 'strippoli ferdinando' }, ctx);
  assert.ok(!/STRIPPOLI/.test(r2.errore), 'nemmeno chi non ha squadra');
  const mio = esegui(db, matteo, 'nuovoDipendente', { completo: 'zuccaro daniele' }, ctx);
  assert.match(mio.errore, /ZUCCARO D\. è già nell'elenco/, 'il proprio doppione invece si nomina');
});

test('plancia: oggi, due settimane giorno per giorno, numeri di settimana e mese', () => {
  const { db, giuliano, matteo, antonio } = banco();
  esegui(db, matteo, 'salvaAppello', { d: '20260914', stati: { 'PIPERIS P.': 'ORD', 'PIPERIS G.': 'MEZ', 'ZUCCARO D.': 'ASS' } }, ctx);
  esegui(db, matteo, 'salvaAppello', { d: '20260916', stati: { 'PIPERIS P.': 'ORD' } }, ctx);
  esegui(db, matteo, 'salvaExtra', { dipendente: 'ZUCCARO D.', importo: 40 }, ctx);
  const h = V.carica(db, matteo, 'home', null, ctx).dati;
  assert.equal(h.giorni.length, 14);
  assert.equal(h.giorni[0].codice, '20260907', 'si parte dal lunedi\' della settimana scorsa');
  assert.equal(h.giorni[13].codice, '20260920');
  const g = (c) => h.giorni.find((x) => x.codice === c);
  assert.equal(g('20260914').stato, 'fatto');
  assert.equal(g('20260915').stato, 'mancante');
  assert.equal(g('20260913').stato, 'riposo', 'domenica');
  assert.equal(g('20260917').stato, 'futuro');
  assert.equal(g('20260917').apribile, false);
  assert.equal(g('20260916').oggi, true);
  assert.deepEqual([h.oggi.giaFatto, h.oggi.completo, h.oggi.presenti, h.oggi.ore, h.oggi.persone], ['Matteo', true, 1, 8, 3]);
  assert.deepEqual(h.settimana, { ore: 20, fatti: 2, lavorativi: 3 });
  assert.deepEqual([h.mese.codice, h.mese.ore, h.mese.extra], ['202609', 20, 40]);
  // per l'amministratore il 14 e' "in parte": i carpentieri non hanno segnato
  const ha = V.carica(db, giuliano, 'home', null, ctx).dati;
  assert.equal(ha.giorni.find((x) => x.codice === '20260914').stato, 'parziale');
  esegui(db, antonio, 'salvaAppello', { d: '20260914', stati: { "D'AMORE E.": 'ORD' } }, ctx);
  assert.equal(V.carica(db, giuliano, 'home', null, ctx).dati.giorni.find((x) => x.codice === '20260914').stato, 'fatto');
  // il 16 un socio non apre piu' i giorni del mese prima
  const vecchio = V.statoGiorni(db, matteo, new Date(2026, 7, 30), new Date(2026, 8, 1), ADESSO);
  assert.deepEqual(vecchio.map((x) => x.apribile), [false, false, true]);
});

test('calendario del mese: caselle vuote prima del giorno 1, lunedi\' per primo', () => {
  const { db, matteo } = banco();
  const m = V.carica(db, matteo, 'mese', '202609', ctx).dati;
  assert.equal(m.calendario.vuoti, 1, 'il 1 settembre 2026 e\' martedi\'');
  assert.equal(m.calendario.giorni.length, 30);
  assert.equal(V.carica(db, matteo, 'mese', '202611', ctx).dati.calendario.vuoti, 6, 'il 1 novembre 2026 e\' domenica');
});

test('niente conferme sopra dati vecchi: chi salva per secondo vede la versione nuova', () => {
  const { db, giuliano, matteo } = banco();
  const aperto = appello(db, matteo).dati;                         // Matteo apre l'appello (vuoto)
  assert.equal(aperto.impronta, '');
  esegui(db, giuliano, 'salvaAppello', { d: '20260916', stati: { 'PIPERIS P.': 'ASS' } }, ctx);   // intanto Giuliano salva
  const r = esegui(db, matteo, 'salvaAppello', { d: '20260916', stati: { 'PIPERIS P.': 'ORD', 'ZUCCARO D.': 'ORD' }, impronta: aperto.impronta }, ctx);
  assert.equal(r.ok, false);
  assert.equal(r.conflitto, true);
  assert.match(r.errore, /Nel frattempo Giuliano/);
  assert.equal(r.dati.righe.find((x) => x.nome === 'PIPERIS P.').stato, 'ASS', 'gli rimanda la versione nuova');
  assert.equal(Q.presenzeDelGiorno(db, '2026-09-16')['PIPERIS P.'].codice, 'ASS', 'e non ha sovrascritto niente');
  // con l'impronta giusta passa
  assert.equal(esegui(db, matteo, 'salvaAppello', { d: '20260916', stati: { 'PIPERIS P.': 'ORD' }, impronta: r.dati.impronta }, ctx).ok, true);
  // senza impronta (giornate inviate dalla coda "senza campo") vince l'ultima, come prima
  assert.equal(esegui(db, giuliano, 'salvaAppello', { d: '20260916', stati: { 'PIPERIS P.': 'MEZ' } }, ctx).ok, true);
});

test('foglio del mese: solo a mese completo, solo l\'amministratore, con l\'indirizzo dell\'agenzia', () => {
  const { db, giuliano, matteo } = banco();
  compilaMese(db, 2026, 7, [10, 31]);
  let m = V.carica(db, giuliano, 'mese', '202608', ctx).dati;
  assert.deepEqual(m.daCompletare, [10, 31]);
  assert.equal(m.scaricabile, false);
  // una squadra sola non basta
  Q.salvaPresenze(db, '2026-08-10', { 'PIPERIS P.': 'ORD' }, 'prova');
  Q.salvaPresenze(db, '2026-08-31', { 'PIPERIS P.': 'ORD', "D'AMORE E.": 'FER' }, 'prova');
  assert.deepEqual(Q.mancantiPerIlFoglio(db, 2026, 7), [10]);
  Q.salvaPresenze(db, '2026-08-10', { "D'AMORE E.": 'ASS' }, 'prova');
  m = V.carica(db, giuliano, 'mese', '202608', ctx).dati;
  assert.deepEqual(m.daCompletare, []);
  assert.equal(m.scaricabile, true);
  assert.deepEqual(m.agenzia, { nome: 'Gama srl', email: 'gamasrl2026@gmail.com' });
  const s = V.carica(db, matteo, 'mese', '202608', ctx).dati;
  assert.equal(s.scaricabile, false);
  assert.equal(s.agenzia, null, 'un socio non riceve l\'indirizzo');
  // il mese in corso non e' completo finche' non arriva l'ultimo giorno
  assert.ok(V.carica(db, giuliano, 'mese', '202609', ctx).dati.daCompletare.includes(30));
});

test('PRIMO_GIORNO: prima di quando si usa l\'app non si chiede niente', () => {
  const { db, matteo } = banco();
  process.env.PRIMO_GIORNO = '2026-09-10';
  try {
    const g = V.carica(db, matteo, 'giorni', null, ctx).dati;
    assert.equal(g.at(-1).codice, '20260910', 'i giorni prima del 10 non sono da sistemare');
    assert.equal(esegui(db, matteo, 'salvaAppello', { d: '20260909', stati: { 'PIPERIS P.': 'ORD' } }, ctx).ok, false);
    assert.deepEqual(Q.giorniMancantiDelMese(db, matteo, 2026, 8).slice(0, 2), [10, 11]);
    assert.equal(D.giornoDiLavoro(new Date(2026, 8, 9)), false);
  } finally {
    delete process.env.PRIMO_GIORNO;
  }
});

test('Agenzia: vede e corregge tutto, gestisce i dipendenti, ma non utenti e link', () => {
  const { db, giuliano, matteo } = banco();
  const ag = Q.creaUtente(db, { nome: 'Studio Paghe', agenzia: true });
  assert.equal(ag.agenzia, true);
  assert.equal(ag.admin, false);
  assert.equal(Q.descriviAmbito(ag), 'tutte le squadre');
  assert.equal(nomi(appello(db, ag)).length, 6, 'tutte le squadre, anche chi non ne ha');
  // presenze ed extra, anche di mesi vecchi
  assert.equal(esegui(db, ag, 'salvaAppello', { d: '20260701', stati: { 'PIPERIS P.': 'FER', "D'AMORE E.": 'ORD' } }, ctx).ok, true);
  assert.equal(esegui(db, ag, 'salvaExtra', { dipendente: "D'AMORE E.", importo: 30 }, ctx).ok, true);
  // dipendenti
  assert.equal(esegui(db, ag, 'nuovoDipendente', { completo: 'ROSSI MARIO', squadra: 'CARPENTIERI' }, ctx).ok, true);
  assert.equal(esegui(db, ag, 'cambiaSquadra', { nome: 'STRIPPOLI F.', squadra: 'MURATORI' }, ctx).ok, true);
  assert.equal(esegui(db, ag, 'cambiaAttivo', { nome: 'ZUCCARO D.', attivo: false }, ctx).ok, true);
  // utenti e link: no
  assert.equal(V.carica(db, ag, 'utenti', null, ctx).ok, false);
  assert.equal(esegui(db, ag, 'nuovoUtente', { nome: 'Intruso', admin: true }, ctx).ok, false);
  assert.equal(esegui(db, ag, 'aggiornaUtente', { id: giuliano.id, attivo: false }, ctx).ok, false);
  assert.equal(esegui(db, ag, 'aggiornaUtente', { id: ag.id, admin: true }, ctx).ok, false, 'non si promuove da solo');
  assert.equal(esegui(db, ag, 'rigeneraLink', { id: giuliano.id }, ctx).ok, false);
  assert.equal(Q.utentePerId(db, giuliano.id).chiave, giuliano.chiave, 'il link dell\'amministratore non cambia');
  // il foglio si', il pulsante "Invia all'agenzia" no
  const m = V.carica(db, ag, 'mese', '202609', ctx).dati;
  assert.ok(m.daCompletare.length > 0);
  assert.equal(m.agenzia, null);
  // nella pagina iniziale non c'e' nessun link di nessuno
  const a = V.avvio(db, ag, { adesso: ADESSO });
  assert.deepEqual([a.admin, a.agenzia, a.tutto], [false, true, true]);
  assert.ok(![giuliano, matteo].some((u) => JSON.stringify(a).includes(u.chiave)));
});

test('l\'amministratore crea un utente Agenzia; promosso ad amministratore perde il ruolo Agenzia', () => {
  const { db, giuliano } = banco();
  const r = esegui(db, giuliano, 'nuovoUtente', { nome: 'Studio Paghe', agenzia: true }, ctx);
  assert.equal(r.ok, true);
  const ag = Q.utentePerId(db, r.id);
  assert.deepEqual([ag.agenzia, ag.admin, ag.squadra], [true, false, '']);
  assert.equal(V.carica(db, giuliano, 'utenti', null, ctx).dati.find((u) => u.id === ag.id).agenzia, true);
  assert.equal(esegui(db, giuliano, 'aggiornaUtente', { id: ag.id, admin: true }, ctx).ok, true);
  assert.deepEqual([Q.utentePerId(db, ag.id).admin, Q.utentePerId(db, ag.id).agenzia], [true, false]);
});
