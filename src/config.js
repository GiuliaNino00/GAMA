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

  // riga = in quale riga del foglio mensile finisce (ord. / fer / fes / pioggia / malattia)
  CODICI: {
    ORD: { etichetta: '8 ore',          breve: '8 ore',   riga: 'ord.', ore: 8, emoji: '✅' },
    // le 4 ore si scelgono da "altre ore" ma restano la mezza giornata (vedi Q.voce)
    MEZ: { etichetta: 'mezza giornata', breve: '4 ore',   riga: 'ord.', ore: 4, emoji: '🕓' },
    // le ore le sceglie chi fa l'appello (vedi ORE_A_SCELTA): ore qui non c'e'
    ALT: { etichetta: 'altre ore',      breve: 'altre ore', riga: 'ord.', ore: null, emoji: '⏱️' },
    FER: { etichetta: 'ferie',          breve: 'ferie',   riga: 'fer',  ore: 8, emoji: '🏖️' },
    FES: { etichetta: 'festivo',        breve: 'festivo', riga: 'fes',  ore: 8, emoji: '🎉' },
    // la pioggia non e' lavoro e non e' assenza: ha la sua riga e il suo totale
    PIO: { etichetta: 'pioggia',        breve: 'pioggia', riga: 'pioggia', ore: 8, emoji: '🌧️' },
    // la malattia, come ferie e pioggia: giorno compilato, riga e totale suoi
    MAL: { etichetta: 'malattia',       breve: 'malattia', riga: 'malattia', ore: 8, emoji: '🤒' },
    ASS: { etichetta: 'assente',        breve: 'assente', riga: null,   ore: 0, emoji: '⬜' }
  },

  // Toccando un nome: 8 ore -> assente -> malattia -> pioggia -> altre ore (si sceglie quante) -> di nuovo 8 ore.
  CICLO: ['ORD', 'ASS', 'MAL', 'PIO', 'ALT'],

  // Le ore che si possono scegliere con "altre ore": da 1 a 12, tranne 8 (la giornata intera).
  // Il 4 c'e': nel database diventa la mezza giornata (MEZ).
  ORE_A_SCELTA: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12],

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

  // Il sabato non si segna a ore: si segna la trasferta in euro di ognuno.
  TRASFERTA_MAX: 10000,

  // I cantieri del mese: l'agenzia li conferma. L'avviso parte negli ultimi giorni
  // del mese prima (per il mese nuovo) e continua finche' non sono confermati.
  GIORNI_PRIMA_CANTIERI: 3,
  ORA_CANTIERI: 9,

  // A chi va il documento del mese (bozza di mail di amministratore e agenzia)
  COMMERCIALISTA: { nome: 'Studio Corvasce', email: 'studiocorvasceconsulenza@gmail.com' },
  NOME_DITTA: 'GAMA',

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
