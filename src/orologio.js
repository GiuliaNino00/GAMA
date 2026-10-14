/**
 * PRESENZE GAMA — L'orologio: quello che succede da solo
 * ---------------------------------------------------------------------------
 *   18:00 nei giorni di lavoro  → promemoria dell'appello a chi non l'ha fatto
 *   domenica 20:00              → riepilogo della settimana
 *   il 1° del mese alle 8:00    → mese chiuso: foglio pronto, oppure l'elenco dei giorni
 *                                 ancora vuoti a chi li deve compilare
 *   appena il mese scorso e' completo → all'amministratore: foglio pronto (una volta sola)
 *   ogni notte alle 2:00        → copia di sicurezza del database
 *
 * Ogni lavoro gira al massimo una volta al giorno. Se il server era spento
 * all'ora giusta, recupera appena riparte (entro la sua finestra).
 */
import { CFG } from './config.js';
import * as D from './date.js';
import * as Q from './dati.js';
import { datiSettimana } from './viste.js';
import { backup } from './db.js';

export const LAVORI = [
  { nome: 'appello',   ora: CFG.ORA_APPELLO,   finestraOre: 3,  giorno: (d) => D.giornoDiLavoro(d) },
  { nome: 'settimana', ora: CFG.ORA_RIEPILOGO, finestraOre: 3,  giorno: (d) => d.getDay() === 0 },
  { nome: 'mese',      ora: CFG.ORA_MESE,      finestraOre: 12, giorno: (d) => d.getDate() === 1 },
  { nome: 'backup',    ora: CFG.ORA_BACKUP,    finestraOre: 20, giorno: () => true }
];

/** Quali lavori vanno fatti adesso, sapendo quando e' stato fatto l'ultimo. */
export function lavoriDovuti(adesso, ultimi) {
  const oggi = D.oggi(adesso), g = D.chiave(oggi);
  return LAVORI.filter((l) => {
    if (!l.giorno(oggi) || ultimi[l.nome] === g) return false;
    const inizio = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate(), l.ora, 0, 0);
    return adesso >= inizio && adesso.getTime() < inizio.getTime() + l.finestraOre * 3600e3;
  }).map((l) => l.nome);
}

/** Il mese prima di `ora`: { anno, mese0, cod: "202609", nome: "settembre" }. */
function meseScorso(ora) {
  const d = new Date(ora.getFullYear(), ora.getMonth() - 1, 1);
  return { anno: d.getFullYear(), mese0: d.getMonth(), cod: String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0'),
           nome: CFG.MESI[d.getMonth()].toLowerCase() };
}

export function creaOrologio(db, { notifiche, cartellaDati, adesso = () => new Date() }) {
  const conDipendenti = () => Q.utentiAttivi(db).filter((u) => Q.dipendentiDi(db, u).length);

  const lavori = {
    async appello(ora) {
      const oggi = D.oggi(ora);
      const invii = [];
      for (const u of conDipendenti()) {
        const vuoti = Q.giorniDaSistemare(db, u, ora);
        const oggiVuoto = vuoti.some((d) => D.chiave(d) === D.chiave(oggi));
        const altri = vuoti.length - (oggiVuoto ? 1 : 0);
        if (oggiVuoto) {
          invii.push(notifiche.invia(u, {
            titolo: '📋 Appello di oggi',
            testo: 'Tocca per segnare chi ha lavorato oggi.' + (altri ? ' Ci sono anche ' + altri + ' giorni arretrati.' : ''),
            percorso: 'appello/' + D.codice(oggi)
          }));
        } else if (altri) {
          invii.push(notifiche.invia(u, {
            titolo: '📅 Giorni da sistemare',
            testo: 'Oggi è fatto, ma ci sono ' + altri + ' giornate senza presenze.',
            percorso: 'giorni'
          }));
        }
      }
      await Promise.allSettled(invii);
    },

    async settimana(ora) {
      await Promise.allSettled(conDipendenti().map((u) => {
        const r = datiSettimana(db, u, ora);
        return notifiche.invia(u, {
          titolo: '📊 La settimana',
          testo: r.oreTotali + ' ore registrate' +
            (r.mancanti.length ? '. Mancano i giorni ' + r.mancanti.join(', ') + '.' : ', tutto compilato.'),
          percorso: 'settimana'
        });
      }));
    },

    async mese(ora) {
      const { anno, mese0, cod, nome } = meseScorso(ora);
      const manca = Q.mancantiPerIlFoglio(db, anno, mese0);
      if (!manca.length) Q.scriviImpostazione(db, 'foglio_pronto_' + cod, D.timbro(ora));
      await Promise.allSettled(conDipendenti().map((u) => {
        const suoi = u.admin ? manca : Q.giorniMancantiDelMese(db, u, anno, mese0);
        let titolo, testo;
        if (!suoi.length) {
          titolo = '📄 Mese di ' + nome + ' chiuso';
          testo = u.admin ? 'Il foglio presenze è pronto da scaricare per l\'agenzia.' : 'Guarda il riepilogo del mese.';
        } else if (u.admin) {
          titolo = '📄 ' + CFG.MESI[mese0].charAt(0) + nome.slice(1) + ' non è completo';
          testo = 'Mancano i giorni ' + suoi.join(', ') + ': il foglio per l\'agenzia sarà pronto quando sarà tutto compilato.';
        } else {
          titolo = '📅 Mancano dei giorni di ' + nome;
          testo = 'Giorni ' + suoi.join(', ') + ': compilali entro il ' + CFG.GIORNO_CHIUSURA_MESE_PRIMA + '.';
        }
        return notifiche.invia(u, { titolo, testo, percorso: 'mese/' + cod });
      }));
    },

    async backup(ora) {
      if (cartellaDati) await backup(db, cartellaDati, CFG.BACKUP_DA_TENERE, ora);
      Q.sfoltisciRegistro(db);
    }
  };

  /**
   * Il mese scorso era incompleto il 1° e adesso e' tutto compilato: si avvisa
   * l'amministratore, una volta sola. Prima delle 8 del 1° ci pensa il lavoro "mese".
   */
  async function foglioPronto(ora) {
    if (ora.getDate() === 1 && ora.getHours() < CFG.ORA_MESE) return;
    const { anno, mese0, cod, nome } = meseScorso(ora);
    const chiave = 'foglio_pronto_' + cod;
    if (Q.leggiImpostazione(db, chiave) || Q.mancantiPerIlFoglio(db, anno, mese0).length) return;
    Q.scriviImpostazione(db, chiave, D.timbro(ora));
    Q.registra(db, 'OROLOGIO', 'foglio di ' + nome + ' completo');
    await Promise.allSettled(Q.utentiAttivi(db).filter((u) => u.admin).map((u) => notifiche.invia(u, {
      titolo: '📄 Foglio di ' + nome + ' pronto',
      testo: 'Tutti i giorni sono compilati: puoi scaricarlo e mandarlo a ' + CFG.AGENZIA.nome + '.',
      percorso: 'mese/' + cod
    })));
  }

  let inCorso = false;

  async function giro() {
    if (inCorso) return;                    // un giro alla volta: niente promemoria doppi
    inCorso = true;
    try {
      const ora = adesso();
      const ultimi = Object.fromEntries(db.prepare('SELECT nome, ultimo FROM lavori').all().map((r) => [r.nome, r.ultimo]));
      const dovuti = lavoriDovuti(ora, ultimi);
      // si segnano TUTTI prima di eseguirli: se qualcosa va storto non si manda dieci volte
      const segna = db.prepare('INSERT INTO lavori (nome, ultimo) VALUES (?, ?) ON CONFLICT(nome) DO UPDATE SET ultimo = excluded.ultimo');
      db.transaction(() => { for (const nome of dovuti) segna.run(nome, D.chiave(ora)); })();
      for (const nome of dovuti) {
        try {
          await lavori[nome](ora);
          Q.registra(db, 'OROLOGIO', nome + ' eseguito');
        } catch (err) {
          Q.registra(db, 'ERRORE', 'orologio ' + nome + ': ' + ((err && err.stack) || err));
        }
      }
      try {
        await foglioPronto(ora);
      } catch (err) {
        Q.registra(db, 'ERRORE', 'orologio foglio pronto: ' + ((err && err.stack) || err));
      }
    } finally {
      inCorso = false;
    }
  }

  return {
    giro,
    lavori,
    avvia() {
      giro();
      const t = setInterval(giro, 60 * 1000);
      t.unref();
      return t;
    }
  };
}
