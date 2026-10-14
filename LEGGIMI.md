# Presenze GAMA 2 — l'app sul vostro server

L'appello serale e i riepiloghi delle presenze, come nella versione Telegram, ma
come **app vera sul telefono** e con i dati **sul vostro server**: niente Google,
niente Telegram obbligatorio, niente Meta, **nessun costo**.

- Per ora la usano **i soci e l'amministratore** (i dipendenti no).
- Ogni socio vede **solo la sua squadra**; l'amministratore vede e modifica tutto.
- Si installa sulla schermata Home con un tocco e manda **notifiche gratuite**:
  alle 18:00 se l'appello non è fatto, la domenica sera il riepilogo, il primo del mese il mese chiuso.
- Senza campo l'appello **resta sul telefono** e parte da solo appena torna la rete.
- Si apre su una **plancia**: lo stato dell'appello di oggi, le ultime due settimane giorno per giorno
  (un tocco su un giorno rosso apre il suo appello), le ore della settimana e del mese.
- **Tema scuro** automatico quando il telefono è in modalità scura; pulsanti grandi, pensati anche per l'aperto.
- **Leggera e veloce**: la prima apertura scarica circa 23 KB; poi stile e codice restano sul telefono.
- Se due persone toccano la stessa giornata, chi conferma per secondo **vede prima la versione nuova**:
  nessuno sovrascrive il lavoro dell'altro senza accorgersene.
- Il **foglio del mese** si scarica in Excel con l'impaginazione del vostro `Foglio presenze.xlsx`
  (un blocco per dipendente, squadra nel riquadro azzurro) più una scheda RIEPILOGO con totali ed extra.

---

## 1. Prova sul tuo PC (10 minuti)

Serve **Node.js 22.9 o più recente** (https://nodejs.org, versione LTS). Funziona anche su Windows.

```bash
cd presenze-gama-app
npm install
cp .env.esempio .env          # su Windows: copy .env.esempio .env
```

Nel file `.env` metti `URL_PUBBLICO=http://localhost:3000`, poi:

```bash
npm run cli -- nuovo-admin "Giuliano"     # stampa il tuo link personale
npm start
```

Apri il link nel browser del PC. Per provare con i dati veri vedi il punto 4 (importazione).

> Sul PC, con `localhost`, funzionano anche le notifiche di Chrome. Sul **telefono** servono https: punto 2.

## 2. Provarla dal telefono senza installare niente sul server

Il modo più rapido è un tunnel gratuito di Cloudflare, senza account:

```bash
cloudflared tunnel --url http://localhost:3000
```

Ti dà un indirizzo tipo `https://qualcosa.trycloudflare.com`. Mettilo in `URL_PUBBLICO` nel `.env`,
riavvia (`npm start`) e apri il tuo link (`npm run cli -- link`) dal telefono.
L'indirizzo cambia ogni volta che rilanci il tunnel: va bene per provare, non per l'uso vero.

## 3. Installazione sul server

### Con Docker (consigliato)

```bash
cp .env.esempio .env           # scrivi il tuo URL_PUBBLICO https
docker compose up -d --build
docker compose exec presenze node src/cli.js nuovo-admin "Giuliano"
```

Database e backup restano nella cartella `dati/` accanto a `docker-compose.yml`.

### Senza Docker

Node 22 sul server, il codice in `/opt/presenze-gama`, poi `npm ci --omit=dev` e il servizio
systemd incluso (`presenze-gama.service`: dentro ci sono i tre comandi per attivarlo).

### L'https (obbligatorio per i telefoni)

Scegli quello che si adatta al server:

| Il server… | Soluzione gratuita |
|---|---|
| ha un indirizzo pubblico e un dominio che punta a lui | **Caddy**: togli i commenti in `docker-compose.yml`, scrivi il dominio in `Caddyfile`. Certificato automatico. |
| sta in ufficio dietro al router, e avete un dominio su Cloudflare | **Cloudflare Tunnel** con nome: nessuna porta da aprire sul router. |
| sta in ufficio e non avete un dominio | **Tailscale Funnel** (`tailscale funnel --bg 3000`): indirizzo `https://…ts.net` stabile e gratuito. |

In tutti i casi l'app ascolta solo sulla porta 3000 del server: da fuori si entra solo in https.

## 4. Portare i dati dal Foglio Google

1. Nel Foglio Google: **File → Scarica → Microsoft Excel (.xlsx)**
2. Copia il file sul server e lancia:

```bash
npm run importa -- "Presenze GAMA.xlsx"
# con Docker:  docker compose exec presenze node src/importa.js "/dati/Presenze GAMA.xlsx"
#              (metti prima il file nella cartella dati/)
```

Importa dipendenti (con squadra), soci (con squadra, ruolo ADMIN e codice Telegram), tutte le
presenze (anche l'archivio) e i compensi extra, e alla fine stampa i link personali.

Si può **rilanciare quante volte si vuole**: non crea doppioni, non cambia i link già dati, e non
sovrascrive una giornata corretta nell'app con una versione più vecchia del foglio.

Per le **persone** (dipendenti e soci), dopo la prima importazione **comanda l'app**: rilanciando
arrivano solo le persone nuove; squadra, ruolo e "attivo" decisi nell'app non vengono mai toccati.
Se nel foglio c'è una squadra scritta male (es. "MURATORE"), quella persona entra **senza squadra**
e l'importazione te lo dice: la assegni dall'app.

## 5. Il passaggio, senza fermare niente

1. **Prova da solo.** Importa una copia dei dati e usa l'app tu. I soci continuano con Telegram.
2. **Il giorno del cambio** (meglio a inizio mese):
   - riscarica il Foglio Google e rilancia l'importazione (porta le ultime giornate);
   - da **🧑‍💼 Chi usa l'app** manda a Matteo e Antonio il loro link con **💬 WhatsApp**;
   - nell'editor Apps Script, **Attivatori** (icona della sveglia) → elimina i 4 attivatori:
     così il vecchio bot smette di mandare l'appello delle 18.
3. Il Foglio Google resta com'è, come archivio.

**Cosa dire ai soci:** "Apri il link che ti ho mandato, tocca *Metti l'app sulla schermata Home*
e segui i passi. Poi apri l'app dall'icona, tocca *Notifiche → Attiva*. Alle 18 ti arriva
l'avviso: lo tocchi, segni chi manca, *Conferma*."

## 6. Per l'amministratore

- **🧑‍💼 Chi usa l'app**: aggiungi un socio, cambia la sua squadra, manda o copia il link,
  crea un **nuovo link** se quello vecchio è finito in mani sbagliate (il vecchio smette subito),
  disattiva chi non deve più entrare. Vedi anche l'ultimo accesso e se ha le notifiche attive.
- **👷 Dipendenti**: chi è senza squadra sta in cima; con **⇄** lo assegni. Attenzione: spostando
  qualcuno di squadra, il nuovo socio vede anche i suoi giorni passati.
- I soci correggono solo gli **ultimi 14 giorni**; i giorni più vecchi (mesi già mandati all'agenzia)
  li puoi correggere solo tu.
- **📄 Riepilogo del mese → Scarica il foglio**: il file .xlsx da mandare all'agenzia.
  Compare anche chi è uscito a metà mese, con i giorni che ha lavorato.
- Il link è la chiave: chi ce l'ha entra a nome di quella persona.

Comandi utili sul server (`npm run cli -- …`, con Docker `docker compose exec presenze node src/cli.js …`):

```
nuovo-admin "Nome"          nuovo-socio "Nome" MURATORI      link
nuovo-link "Nome"           foglio 202610                    prova-notifica "Nome"
backup
```

## 7. Copie di sicurezza

Ogni notte alle 2 l'app copia il database in `dati/backup/` e tiene gli ultimi 30 giorni.
**Copia ogni tanto la cartella `dati/backup/` fuori dal server** (un disco, un altro PC):
se si rompe il server, si perde solo quello che non è stato copiato.

Per ripristinare:
1. ferma l'app (`docker compose stop` oppure `sudo systemctl stop presenze-gama`);
2. **cancella** `dati/presenze.sqlite-wal` e `dati/presenze.sqlite-shm`, se ci sono
   (altrimenti SQLite rimette sopra alla copia le modifiche che volevi annullare);
3. sostituisci `dati/presenze.sqlite` con la copia scelta e riavvia.

## 8. Aggiornare l'app

Sostituisci le cartelle `src/` e `public/` e i file `package.json` e `package-lock.json`, poi
`docker compose up -d --build` oppure `npm ci --omit=dev && sudo systemctl restart presenze-gama`.
I dati non si toccano: la struttura del database si aggiorna da sola all'avvio, e i telefoni
riscaricano l'app da soli appena cambia anche un solo file.

## 9. Se qualcosa non va

| Sintomo | Cosa fare |
|---|---|
| "Link non valido" | Il link è stato rigenerato o l'utente disattivato: mandane uno nuovo da *Chi usa l'app*. |
| Sul telefono non compare "Installa" né le notifiche | L'indirizzo non è https, oppure (iPhone) il link è aperto da dentro WhatsApp: va aperto in Safari. |
| iPhone: le notifiche non si attivano | Su iPhone si attivano solo dall'app aperta **dall'icona** sulla schermata Home (iOS 16.4 o più recente). |
| Le notifiche non arrivano più | Nell'app: *Notifiche → Riattiva su questo telefono*. Sul server: `prova-notifica "Nome"`. |
| L'app non parte: "porta già usata" | C'è già una copia accesa, o un altro programma usa la porta 3000: cambia `PORTA` nel `.env`. |
| Vuoi vedere cosa è successo | Tabella `registro` nel database, oppure i messaggi del servizio (`docker compose logs` / `journalctl -u presenze-gama`). |

## 10. Com'è fatta (per chi ci mette mano)

```
src/
  server.js     il server (Express): link personali, pagine, chiamate, foglio
  config.js     le regole: squadre, codici, orari, giorni di lavoro
  dati.js       tutto il database e la regola "chi vede chi"
  viste.js      i dati di ogni schermata, già filtrati per chi guarda
  azioni.js     tutto quello che scrive, con i controlli
  foglio.js     il file Excel del mese
  notifiche.js  notifiche web (gratuite) + Telegram facoltativo
  orologio.js   promemoria delle 18, riepilogo della domenica, mese chiuso, backup
  importa.js    importazione dal Foglio Google
  cli.js        comandi da terminale
public/         l'app sul telefono (pagina, stile, service worker, icone)
test/           le prove automatiche:  npm test
```

Database: SQLite, un solo file (`dati/presenze.sqlite`). Le presenze hanno come chiave
*(giorno, dipendente)*: correggere una giornata la sovrascrive, i doppioni non possono esistere.
