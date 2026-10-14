/**
 * PRESENZE GAMA — Importazione dal Foglio Google
 * ---------------------------------------------------------------------------
 * 1. Nel Foglio Google: File > Scarica > Microsoft Excel (.xlsx)
 * 2. Sul server:        npm run importa -- "Presenze GAMA.xlsx"
 *
 * Legge le schede Dipendenti, Utenti, Presenze, Presenze archivio ed Extra.
 * Si puo' rilanciare quante volte si vuole: non crea doppioni e non sovrascrive
 * una giornata gia' corretta nell'app con una versione piu' vecchia del foglio.
 *
 * Persone (dipendenti e utenti): dopo la prima importazione comanda l'app.
 * Rilanciando arrivano solo le persone NUOVE e si riempiono i campi vuoti;
 * squadra, ruolo e "attivo" decisi nell'app non vengono mai toccati.
 */
import './fuso.js';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CFG, env } from './config.js';
import { apri, percorsoDb } from './db.js';
import * as D from './date.js';
import * as Q from './dati.js';

/** Il valore "vero" di una cella: testo, numero o data, qualunque forma abbia nel file. */
function valore(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return valore(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return valore(v.text);
    return '';
  }
  return v;
}

/** Le date/ore lette da Excel arrivano "in UTC" ma sono l'ora scritta nel foglio. */
function timbroDaFoglio(v) {
  const x = valore(v);
  if (x instanceof Date && !isNaN(x)) {
    const due = (n) => String(n).padStart(2, '0');
    return x.getUTCFullYear() + '-' + due(x.getUTCMonth() + 1) + '-' + due(x.getUTCDate()) + ' ' +
           due(x.getUTCHours()) + ':' + due(x.getUTCMinutes()) + ':' + due(x.getUTCSeconds());
  }
  const t = String(x || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 19).replace('T', ' ') : '';
}

function righe(wb, nome) {
  const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === nome.toLowerCase());
  if (!ws) return null;
  const intest = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, n) => { intest[n] = String(valore(c.value)).trim().toUpperCase(); });
  const out = [];
  ws.eachRow((riga, n) => {
    if (n === 1) return;
    const o = {};
    riga.eachCell({ includeEmpty: true }, (c, col) => { if (intest[col]) o[intest[col]] = valore(c.value); });
    if (Object.values(o).some((v) => String(v).trim() !== '')) out.push(o);
  });
  return out;
}

export async function importa(db, file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const rapporto = { dipendenti: 0, dipendentiNuovi: 0, dipendentiCreatiDaStorico: 0, utentiNuovi: 0, utentiAggiornati: 0,
                     presenze: 0, presenzeIgnorate: 0, extra: 0, extraGiaPresenti: 0, schedeMancanti: [], squadreSconosciute: [] };
  /** Solo le squadre previste: un errore di battitura non deve creare una squadra fantasma. */
  const squadraValida = (v) => {
    const sq = Q.squadraDi(v);
    if (sq && !CFG.SQUADRE.includes(sq)) {
      if (!rapporto.squadreSconosciute.includes(sq)) rapporto.squadreSconosciute.push(sq);
      return '';
    }
    return sq;
  };

  const dip = righe(wb, 'Dipendenti');
  const ute = righe(wb, 'Utenti');
  const pres = [...(righe(wb, 'Presenze') || []), ...(righe(wb, 'Presenze archivio') || [])];
  const ext = righe(wb, 'Extra');
  if (!dip) rapporto.schedeMancanti.push('Dipendenti');
  if (!ute) rapporto.schedeMancanti.push('Utenti');
  if (!righe(wb, 'Presenze')) rapporto.schedeMancanti.push('Presenze');
  if (!ext) rapporto.schedeMancanti.push('Extra');

  const idDi = (nome) => {
    const n = String(nome || '').trim();
    if (!n) return null;
    const d = Q.dipendentePerNome(db, n);
    if (d) return d.id;
    // compare nello storico ma non piu' nell'elenco: lo si tiene, non attivo
    const ordine = (db.prepare('SELECT MAX(ordine) AS m FROM dipendenti').get().m || 0) + 1;
    rapporto.dipendentiCreatiDaStorico++;
    return db.prepare('INSERT INTO dipendenti (nome, nome_completo, squadra, attivo, ordine) VALUES (?, ?, ?, 0, ?)')
      .run(n, '', '', ordine).lastInsertRowid;
  };

  db.transaction(() => {
    // ---- dipendenti
    for (const r of dip || []) {
      const nome = String(r.NOME || '').trim();
      if (!nome) continue;
      const campi = {
        completo: String(r.NOME_COMPLETO || '').trim(),
        squadra: squadraValida(r.SQUADRA),
        attivo: String(r.ATTIVO).trim().toUpperCase() !== 'NO' ? 1 : 0,
        ordine: Number(r.ORDINE) || 0
      };
      const c = Q.dipendentePerNome(db, nome);
      if (c) {
        // gia' presente: si riempiono solo i campi vuoti, il resto lo decide l'app
        db.prepare('UPDATE dipendenti SET nome_completo = ?, squadra = ? WHERE id = ?')
          .run(c.completo || campi.completo, c.squadra || campi.squadra, c.id);
      } else {
        db.prepare('INSERT INTO dipendenti (nome, nome_completo, squadra, attivo, ordine) VALUES (?, ?, ?, ?, ?)')
          .run(nome, campi.completo, campi.squadra, campi.attivo, campi.ordine);
        rapporto.dipendentiNuovi++;
      }
      rapporto.dipendenti++;
    }

    // ---- utenti (soci e amministratore)
    for (const r of ute || []) {
      const nome = String(r.NOME || '').trim();
      if (!nome) continue;
      const campi = {
        squadra: squadraValida(r.SQUADRA),
        admin: String(r.RUOLO || '').trim().toUpperCase() === 'ADMIN',
        attivo: String(r.ATTIVO).trim().toUpperCase() !== 'NO',
        telegram: String(r.CHAT_ID || '').trim()
      };
      const c = Q.utentePerNome(db, nome);
      if (c) {
        // gia' presente: ruolo, attivo e link restano quelli dell'app; si riempie solo il vuoto
        const vuoti = {};
        if (!c.telegram && campi.telegram) vuoti.telegram = campi.telegram;
        if (!c.squadra && !c.admin && campi.squadra) vuoti.squadra = campi.squadra;
        if (Object.keys(vuoti).length) Q.aggiornaUtente(db, c.id, vuoti);
        rapporto.utentiAggiornati++;
      } else {
        const nuovo = Q.creaUtente(db, { nome, squadra: campi.squadra, admin: campi.admin, telegram: campi.telegram });
        if (!campi.attivo) Q.aggiornaUtente(db, nuovo.id, { attivo: false });
        rapporto.utentiNuovi++;
      }
    }

    // ---- presenze: si applicano dalla piu' vecchia alla piu' recente
    const scrivi = db.prepare(
      'INSERT INTO presenze (data, dipendente_id, codice, ore, inserito_da, aggiornato) VALUES (?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(data, dipendente_id) DO UPDATE SET codice = excluded.codice, ore = excluded.ore, ' +
      'inserito_da = excluded.inserito_da, aggiornato = excluded.aggiornato WHERE excluded.aggiornato >= presenze.aggiornato');
    const ordinate = pres.map((r, i) => ({ r, i, ts: timbroDaFoglio(r.TIMESTAMP) || '2000-01-01 00:00:00' }))
      .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.i - b.i));
    for (const { r, ts } of ordinate) {
      const data = D.normalizzaData(r.DATA);
      const cod = String(r.CODICE || '').trim().toUpperCase();
      if (!data || !CFG.CODICI[cod]) { rapporto.presenzeIgnorate++; continue; }
      const id = idDi(r.DIPENDENTE);
      if (!id) { rapporto.presenzeIgnorate++; continue; }
      const esito = scrivi.run(data, id, cod, CFG.CODICI[cod].ore, String(r.INSERITO_DA || '').trim(), ts);
      if (esito.changes) rapporto.presenze++; else rapporto.presenzeIgnorate++;
    }

    // ---- compensi extra, senza doppioni se si reimporta: per ogni riga uguale si
    // confronta QUANTE volte compare nel foglio e quante nel database (due 50 € uguali
    // nello stesso mese restano due)
    const quanteNelDb = db.prepare('SELECT COUNT(*) AS n FROM extra WHERE mese = ? AND dipendente_id = ? AND importo = ? AND nota = ? AND inserito_da = ? AND creato = ?');
    const nuovoExtra = db.prepare('INSERT INTO extra (mese, dipendente_id, importo, nota, inserito_da, creato) VALUES (?, ?, ?, ?, ?, ?)');
    const gruppi = new Map();
    for (const r of ext || []) {
      const mese = D.normalizzaMese(r.MESE);
      const importo = Math.round(Number(r.IMPORTO) * 100) / 100;
      if (!mese || !(importo > 0)) continue;
      const id = idDi(r.DIPENDENTE);
      if (!id) continue;
      const riga = [mese, id, importo, String(r.NOTA || '').trim(), String(r.INSERITO_DA || '').trim(), timbroDaFoglio(r.TIMESTAMP)];
      const k = JSON.stringify(riga);
      if (!gruppi.has(k)) gruppi.set(k, { riga, n: 0 });
      gruppi.get(k).n++;
    }
    for (const { riga, n } of gruppi.values()) {
      const gia = quanteNelDb.get(...riga).n;
      rapporto.extraGiaPresenti += Math.min(gia, n);
      for (let i = gia; i < n; i++) { nuovoExtra.run(...riga); rapporto.extra++; }
    }
  })();

  Q.registra(db, 'IMPORTAZIONE', path.basename(file) + ' ' + JSON.stringify(rapporto));
  return rapporto;
}

async function principale() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.log('Uso: npm run importa -- "file scaricato dal Foglio Google.xlsx"');
    process.exit(1);
  }
  const E = env();
  const db = apri(percorsoDb(E.CARTELLA_DATI));
  const r = await importa(db, file);
  console.log('\nImportazione finita:');
  console.log('  dipendenti letti:        ' + r.dipendenti + ' (nuovi ' + r.dipendentiNuovi + ')' + (r.dipendentiCreatiDaStorico ? '  (+' + r.dipendentiCreatiDaStorico + ' trovati solo nello storico, messi come non attivi)' : ''));
  console.log('  utenti nuovi/aggiornati: ' + r.utentiNuovi + ' / ' + r.utentiAggiornati);
  console.log('  giornate-persona:        ' + r.presenze + ' scritte, ' + r.presenzeIgnorate + ' saltate (doppioni o più vecchie)');
  console.log('  compensi extra:          ' + r.extra + ' nuovi, ' + r.extraGiaPresenti + ' già presenti');
  if (r.schedeMancanti.length) console.log('  schede non trovate:      ' + r.schedeMancanti.join(', '));
  if (r.squadreSconosciute.length) {
    console.log('  squadre sconosciute:     ' + r.squadreSconosciute.join(', ') + '  → quelle persone sono rimaste senza squadra: assegnala dall\'app');
  }
  console.log('\nLink personali (mandali uno per uno, sono come una chiave):');
  for (const u of Q.utentiAttivi(db)) {
    console.log('  ' + u.nome.padEnd(14) + (u.admin ? ' [amministratore] ' : ' [' + (u.squadra || 'senza squadra').toLowerCase() + '] ') + Q.linkUtente(E.URL_PUBBLICO, u));
  }
  if (!Q.utentiAttivi(db).some((u) => u.admin)) {
    console.log('\nATTENZIONE: nessun amministratore. Crealo con:  npm run cli -- nuovo-admin "Giuliano"');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  principale().catch((e) => { console.error('Importazione fallita:', e.message); process.exit(1); });
}
