// Banco di prova: un database in memoria con due squadre, un dipendente senza
// squadra, i due soci e l'amministratore — come nella realta'.
import '../src/fuso.js';
import { apri } from '../src/db.js';
import * as Q from '../src/dati.js';

export const DIPENDENTI = [
  ['PIPERIS P.', 'PIPERIS PAOLO', 'MURATORI'],
  ['PIPERIS G.', 'PIPERIS GAETANO', 'MURATORI'],
  ['ZUCCARO D.', 'ZUCCARO DANIELE', 'MURATORI'],
  ["D'AMORE E.", "D'AMORE EMANUELE", 'CARPENTIERI'],
  ['ATTIMONELLI D.', 'ATTIMONELLI DOMENICO', 'CARPENTIERI'],
  ['STRIPPOLI F.', 'STRIPPOLI FERDINANDO', '']
];

// mercoledi' 16 settembre 2026, ore 19
export const ADESSO = new Date(2026, 8, 16, 19, 0, 0);

export function banco() {
  const db = apri(':memory:');
  const ins = db.prepare('INSERT INTO dipendenti (nome, nome_completo, squadra, attivo, ordine) VALUES (?, ?, ?, 1, ?)');
  DIPENDENTI.forEach(([n, c, s], i) => ins.run(n, c, s, i + 1));
  const giuliano = Q.creaUtente(db, { nome: 'Giuliano', admin: true });
  const matteo = Q.creaUtente(db, { nome: 'Matteo', squadra: 'MURATORI' });
  const antonio = Q.creaUtente(db, { nome: 'Antonio', squadra: 'CARPENTIERI' });
  return { db, giuliano, matteo, antonio };
}

/** Notifiche finte: registrano cosa sarebbe partito, senza mandare niente. */
export function notificheFinte() {
  const inviate = [];
  return {
    inviate,
    chiavePubblica: 'BFinta',
    iscrivi: () => true,
    togli: () => true,
    attive: () => 0,
    async invia(utente, messaggio) { inviate.push({ a: utente.nome, ...messaggio }); return { push: 1, falliti: 0, telegram: false }; }
  };
}
