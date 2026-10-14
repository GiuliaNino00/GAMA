/**
 * PRESENZE GAMA — Notifiche sul telefono (gratis)
 * ---------------------------------------------------------------------------
 * Le "notifiche web" passano dai servizi del telefono stesso (Chrome su Android,
 * Safari su iPhone): non costano nulla e non serve nessun account. Le chiavi
 * che le firmano (VAPID) nascono da sole al primo avvio e restano nel database.
 *
 * Facoltativo: se nel file .env c'e' TELEGRAM_TOKEN e un utente ha il suo
 * codice Telegram, lo stesso promemoria arriva anche li'. Anche questo e' gratis.
 */
import webpush from 'web-push';
import * as Q from './dati.js';

export function chiaviVapid(db) {
  let pubblica = Q.leggiImpostazione(db, 'vapid_pubblica');
  let privata = Q.leggiImpostazione(db, 'vapid_privata');
  if (!pubblica || !privata) {
    const k = webpush.generateVAPIDKeys();
    pubblica = k.publicKey; privata = k.privateKey;
    Q.scriviImpostazione(db, 'vapid_pubblica', pubblica);
    Q.scriviImpostazione(db, 'vapid_privata', privata);
  }
  return { pubblica, privata };
}

async function telegramVero(token, payload) {
  const r = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  return r.ok;
}

/**
 * `trasportoPush` e `trasportoTelegram` si possono sostituire nei test:
 * cosi' si prova tutto senza mandare niente a nessuno.
 */
export function creaNotifiche(db, {
  urlPubblico, telegramToken = '',
  trasportoPush = webpush.sendNotification.bind(webpush),
  trasportoTelegram = telegramVero
}) {
  const vapid = chiaviVapid(db);
  const dettagli = {
    // Il servizio delle notifiche vuole sapere chi le manda: l'indirizzo del sito o una email.
    subject: urlPubblico.startsWith('https://') ? urlPubblico : 'mailto:presenze@localhost.localdomain',
    publicKey: vapid.pubblica,
    privateKey: vapid.privata
  };

  function iscrivi(utente, sub, dispositivo = '') {
    if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) ||
        !sub.keys || typeof sub.keys.p256dh !== 'string' || typeof sub.keys.auth !== 'string') {
      return false;
    }
    const prima = db.prepare('SELECT utente_id FROM iscrizioni_push WHERE endpoint = ?').get(sub.endpoint);
    db.prepare(
      'INSERT INTO iscrizioni_push (utente_id, endpoint, p256dh, auth, dispositivo, creato) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(endpoint) DO UPDATE SET utente_id = excluded.utente_id, p256dh = excluded.p256dh, auth = excluded.auth, dispositivo = excluded.dispositivo')
      .run(utente.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth, String(dispositivo).slice(0, 120), new Date().toISOString());
    // l'app si riallinea a ogni apertura: nel registro si scrive solo quando cambia qualcosa
    if (!prima || prima.utente_id !== utente.id) {
      Q.registra(db, 'NOTIFICHE', utente.nome + ' ha attivato le notifiche (' + String(dispositivo).slice(0, 60) + ')');
    }
    return true;
  }

  function togli(utente, endpoint) {
    return db.prepare('DELETE FROM iscrizioni_push WHERE utente_id = ? AND endpoint = ?').run(utente.id, String(endpoint)).changes > 0;
  }

  function attive(utente) {
    return db.prepare('SELECT COUNT(*) AS n FROM iscrizioni_push WHERE utente_id = ?').get(utente.id).n;
  }

  /** Manda un promemoria a un utente su tutti i suoi telefoni. `percorso` = schermata da aprire. */
  async function invia(utente, { titolo, testo, percorso = '' }) {
    const link = Q.linkUtente(urlPubblico, utente) + (percorso ? '#' + percorso : '');
    const payload = JSON.stringify({ titolo, testo, url: link, tag: percorso.split('/')[0] || 'gama' });
    const esito = { push: 0, falliti: 0, telegram: false };

    const iscrizioni = db.prepare('SELECT * FROM iscrizioni_push WHERE utente_id = ?').all(utente.id);
    // tutti i telefoni insieme, ognuno con un tempo massimo: uno lento non ferma gli altri
    const risultati = await Promise.allSettled(iscrizioni.map((s) =>
      trasportoPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload,
        { vapidDetails: dettagli, TTL: 6 * 3600, urgency: 'high', timeout: 15000 })));
    risultati.forEach((r, i) => {
      if (r.status === 'fulfilled') { esito.push++; return; }
      esito.falliti++;
      const err = r.reason;
      // 404/410: il telefono ha tolto il permesso o l'app e' stata disinstallata
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        db.prepare('DELETE FROM iscrizioni_push WHERE id = ?').run(iscrizioni[i].id);
      } else {
        Q.registra(db, 'ERRORE', 'notifica a ' + utente.nome + ': ' + ((err && err.message) || err));
      }
    });

    if (telegramToken && utente.telegram) {
      try {
        esito.telegram = await trasportoTelegram(telegramToken, {
          chat_id: utente.telegram,
          text: titolo + '\n' + testo,
          reply_markup: link.startsWith('https://')
            ? { inline_keyboard: [[{ text: '📋 Apri Presenze', url: link }]] }
            : undefined
        });
      } catch (err) {
        Q.registra(db, 'ERRORE', 'telegram a ' + utente.nome + ': ' + ((err && err.message) || err));
      }
    }
    return esito;
  }

  return { chiavePubblica: vapid.pubblica, iscrivi, togli, attive, invia };
}
