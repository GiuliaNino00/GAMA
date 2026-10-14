/**
 * PRESENZE GAMA — Configurazione
 * ---------------------------------------------------------------------------
 * CFG: le regole dell'azienda (squadre, codici, orari). Si cambiano qui.
 * ENV: le impostazioni del server, lette dalle variabili d'ambiente (file .env).
 */

export const CFG = {
  NOME_APP: 'Presenze GAMA',

  // Ogni socio segue una squadra e vede SOLO i suoi uomini.
  // Chi e' amministratore vede e modifica tutto.
  SQUADRE: ['MURATORI', 'CARPENTIERI'],

  // riga = in quale riga del foglio mensile finisce (ord. / fer / fes)
  CODICI: {
    ORD: { etichetta: '8 ore',          breve: '8 ore',   riga: 'ord.', ore: 8, emoji: '✅' },
    MEZ: { etichetta: 'mezza giornata', breve: '4 ore',   riga: 'ord.', ore: 4, emoji: '🕓' },
    FER: { etichetta: 'ferie',          breve: 'ferie',   riga: 'fer',  ore: 8, emoji: '🏖️' },
    FES: { etichetta: 'festivo',        breve: 'festivo', riga: 'fes',  ore: 8, emoji: '🎉' },
    ASS: { etichetta: 'assente',        breve: 'assente', riga: null,   ore: 0, emoji: '⬜' }
  },

  // Toccando un nome: 8 ore -> assente -> 4 ore -> di nuovo 8 ore.
  CICLO: ['ORD', 'ASS', 'MEZ'],

  ORA_APPELLO: 18,          // promemoria dell'appello (giorni lavorativi)
  ORA_RIEPILOGO: 20,        // riepilogo della settimana, la domenica
  ORA_MESE: 8,              // il primo del mese: mese chiuso, foglio pronto
  ORA_BACKUP: 2,            // copia di sicurezza del database, ogni notte
  BACKUP_DA_TENERE: 30,     // quante copie notturne conservare

  // I soci compilano e correggono tutti i giorni del mese in corso e, fino a
  // questo giorno del mese compreso, anche quelli del mese prima.
  GIORNO_CHIUSURA_MESE_PRIMA: 15,
  APPELLO_ANCHE_SABATO: true,
  APPELLO_ANCHE_DOMENICA: false,

  // A chi va il foglio del mese (pulsante "Invia" dell'amministratore)
  AGENZIA: { nome: 'Gama srl', email: 'gamasrl2026@gmail.com' },

  MESI: ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO',
         'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'],
  LETTERE_GIORNO: ['D', 'L', 'M', 'M', 'G', 'V', 'S'],
  NOMI_GIORNO: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
};

/** Impostazioni del server. Lette ogni volta, cosi' i test possono cambiarle. */
export function env() {
  return {
    PORTA: Number(process.env.PORTA || 3000),
    // L'indirizzo con cui il server si vede da fuori, es. https://presenze.gama.it
    URL_PUBBLICO: String(process.env.URL_PUBBLICO || 'http://localhost:3000').replace(/\/+$/, ''),
    CARTELLA_DATI: process.env.CARTELLA_DATI || './dati',
    // Facoltativo: se c'e', i promemoria arrivano anche su Telegram (gratis).
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || ''
  };
}
