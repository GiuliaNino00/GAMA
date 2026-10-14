/**
 * PRESENZE GAMA — Database (SQLite, un solo file)
 * ---------------------------------------------------------------------------
 * Tutto l'archivio sta in dati/presenze.sqlite. Copiare quel file = avere
 * una copia completa di tutto. Le copie notturne finiscono in dati/backup/.
 *
 * Le presenze hanno come chiave (giorno, dipendente): salvare due volte lo
 * stesso giorno CORREGGE la riga, non ne aggiunge un'altra. Il problema dei
 * doppioni del Foglio Google qui non puo' esistere.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { chiave } from './date.js';

const MIGRAZIONI = [
  // 1 — struttura iniziale
  `
  CREATE TABLE utenti (
    id               INTEGER PRIMARY KEY,
    nome             TEXT NOT NULL,
    squadra          TEXT NOT NULL DEFAULT '',
    admin            INTEGER NOT NULL DEFAULT 0,
    attivo           INTEGER NOT NULL DEFAULT 1,
    chiave           TEXT NOT NULL UNIQUE,
    telegram_chat_id TEXT NOT NULL DEFAULT '',
    ultimo_accesso   TEXT,
    creato           TEXT NOT NULL
  );
  CREATE TABLE dipendenti (
    id            INTEGER PRIMARY KEY,
    nome          TEXT NOT NULL UNIQUE COLLATE NOCASE,
    nome_completo TEXT NOT NULL DEFAULT '',
    squadra       TEXT NOT NULL DEFAULT '',
    attivo        INTEGER NOT NULL DEFAULT 1,
    ordine        INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE presenze (
    data          TEXT NOT NULL,
    dipendente_id INTEGER NOT NULL REFERENCES dipendenti(id),
    codice        TEXT NOT NULL,
    ore           REAL NOT NULL,
    inserito_da   TEXT NOT NULL DEFAULT '',
    aggiornato    TEXT NOT NULL,
    PRIMARY KEY (data, dipendente_id)
  ) WITHOUT ROWID;
  CREATE TABLE extra (
    id            INTEGER PRIMARY KEY,
    mese          TEXT NOT NULL,
    dipendente_id INTEGER NOT NULL REFERENCES dipendenti(id),
    importo       REAL NOT NULL,
    nota          TEXT NOT NULL DEFAULT '',
    inserito_da   TEXT NOT NULL DEFAULT '',
    creato        TEXT NOT NULL
  );
  CREATE INDEX extra_mese ON extra(mese);
  CREATE TABLE iscrizioni_push (
    id          INTEGER PRIMARY KEY,
    utente_id   INTEGER NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
    endpoint    TEXT NOT NULL UNIQUE,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    dispositivo TEXT NOT NULL DEFAULT '',
    creato      TEXT NOT NULL
  );
  CREATE TABLE impostazioni (chiave TEXT PRIMARY KEY, valore TEXT NOT NULL);
  CREATE TABLE lavori (nome TEXT PRIMARY KEY, ultimo TEXT NOT NULL);
  CREATE TABLE registro (
    id     INTEGER PRIMARY KEY,
    quando TEXT NOT NULL,
    tipo   TEXT NOT NULL,
    testo  TEXT NOT NULL
  );
  `
];

/** Apre (o crea) il database e lo porta all'ultima versione della struttura. */
export function apri(percorso) {
  if (percorso !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(percorso)), { recursive: true });
  const db = new Database(percorso);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  const versione = db.pragma('user_version', { simple: true });
  for (let v = versione; v < MIGRAZIONI.length; v++) {
    db.transaction(() => {
      db.exec(MIGRAZIONI[v]);
      db.pragma('user_version = ' + (v + 1));
    })();
  }
  return db;
}

/** Percorso del database dentro la cartella dati. */
export function percorsoDb(cartellaDati) {
  return path.join(cartellaDati, 'presenze.sqlite');
}

/**
 * Copia di sicurezza: un file completo e coerente anche mentre l'app lavora.
 * Tiene solo le ultime `daTenere` copie.
 */
export async function backup(db, cartellaDati, daTenere = 30, giorno = new Date()) {
  const cartella = path.join(cartellaDati, 'backup');
  fs.mkdirSync(cartella, { recursive: true });
  const file = path.join(cartella, 'presenze-' + chiave(giorno) + '.sqlite');
  await db.backup(file);

  const copie = fs.readdirSync(cartella).filter((f) => /^presenze-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort();
  for (const vecchia of copie.slice(0, Math.max(0, copie.length - daTenere))) {
    fs.unlinkSync(path.join(cartella, vecchia));
  }
  return file;
}
