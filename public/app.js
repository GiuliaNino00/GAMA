/*
 * PRESENZE GAMA — L'app sul telefono
 * ---------------------------------------------------------------------------
 * Schermata principale a "plancia": com'e' messa oggi, le ultime due settimane
 * giorno per giorno, le ore della settimana e del mese. Da li' si va dappertutto.
 *
 * Comportamenti da non rompere:
 *  - il tasto "indietro" del telefono torna alla schermata precedente;
 *  - senza campo l'appello resta sul telefono e parte da solo appena possibile;
 *  - l'appello di oggi si apre subito con i dati che l'app ha gia', poi si
 *    riallinea col server; se nel frattempo qualcuno ha salvato, il server
 *    non lascia confermare sopra dati vecchi (impronta della giornata);
 *  - lo stato delle notifiche si chiede al telefono, non a un appunto salvato.
 */
(function () {
  'use strict';

  var S = JSON.parse(document.getElementById('avvio').textContent);
  var BASE = location.pathname.replace(/[^/]*$/, '');      // "/u/<chiave>/"
  var MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
              'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  var GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

  // ------------------------------------------------------------------ icone (disegnate apposta, a tratto)
  var ICONE = {
    indietro: '<path d="M15 18l-6-6 6-6"/>',
    avanti: '<path d="M9 6l6 6-6 6"/>',
    appello: '<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><path d="M8 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H16"/><path d="M9 13l2 2 4-4"/>',
    calendario: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    euro: '<path d="M17.5 7A6.5 6.5 0 1 0 17.5 17"/><path d="M4.5 10.5h9M4.5 13.5h9"/>',
    grafico: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
    foglio: '<path d="M14 3H7.5A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    persone: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
    scudo: '<path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z"/><path d="M9.5 12l2 2 3.5-3.5"/>',
    campana: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    campanaNo: '<path d="M8.5 5.5A6 6 0 0 1 18 11v5l1.5 2H9"/><path d="M6 11v5l-1.5 2H9"/><path d="M10 20.5a2 2 0 0 0 4 0M3 3l18 18"/>',
    scarica: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    spunta: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    orologio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    meno: '<path d="M7 12h10"/>',
    messaggio: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4z"/>',
    copia: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15"/>',
    rinnova: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
    piu: '<path d="M12 5v14M5 12h14"/>',
    scambia: '<path d="M7 7h12M16 4l3 3-3 3"/><path d="M17 17H5M8 14l-3 3 3 3"/>',
    telefono: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>',
    avviso: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    nuvola: '<path d="M3 3l18 18"/><path d="M8.5 19h8.5a4 4 0 0 0 1.4-7.7M6.2 9.4A5 5 0 0 0 7 19"/>',
    persona: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    matita: '<path d="M4 20h4l11-11-4-4L4 16z"/><path d="M14 6l4 4"/>',
    chiudi: '<path d="M18 6L6 18M6 6l12 12"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
    invia: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
    malattia: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    pioggia: '<path d="M7 15a4 4 0 0 1 .4-8A5.5 5.5 0 0 1 18 8.6 3.3 3.3 0 0 1 17.5 15z"/><path d="M8.5 18.5l-1 2M12.5 18.5l-1 2M16.5 18.5l-1 2"/>',
    cantiere: '<path d="M3 21h18"/><path d="M5 21V9.5L12 4l7 5.5V21"/><path d="M9.5 21v-5.5h5V21"/>',
    camion: '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3.5V16h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    condividi: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 12H5.5A1.5 1.5 0 0 0 4 13.5v6A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5H18"/>'
  };
  function ico(n, cls) { return '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONE[n] + '</svg>'; }

  // ------------------------------------------------------------------ strumenti
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function testo(v) { var d = document.createElement('div'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }
  function euro(n) { return Number(n).toFixed(2).replace('.', ',').replace(',00', '') + ' €'; }
  function bottone(cls, html, quando) {
    var b = el('button', cls, html); b.type = 'button';
    if (quando) b.addEventListener('click', quando);
    return b;
  }
  function nota(colore, icona, html) { return el('div', 'nota ' + colore, ico(icona) + '<div class="corpo">' + html + '</div>'); }
  function sezione(t) { return el('h2', 'sezione', testo(t)); }
  function etichettaSq(sq) { return sq ? sq.charAt(0) + sq.slice(1).toLowerCase() : 'senza squadra'; }
  function maiuscola(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }
  function copia(x) { return JSON.parse(JSON.stringify(x)); }
  function nomeAdmin() {
    var altri = (S.amministratori || []).filter(function (n) { return n !== S.utente; });
    return altri.length ? altri.join(' o ') : "l'amministratore";
  }
  /** "PIPERIS P." -> PP, "ACQUAVIVA MARCO" -> AM */
  function iniziali(nome) {
    var p = String(nome).replace(/\./g, '').trim().split(/\s+/);
    return ((p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : (p[0] || '').charAt(1))).toUpperCase();
  }
  function avatar(nome) { return '<span class="avatar">' + testo(iniziali(nome)) + '</span>'; }
  function saluto() { var h = new Date().getHours(); return h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'; }
  function oggiLungo() { var d = new Date(); return maiuscola(GIORNI[d.getDay()]) + ' ' + d.getDate() + ' ' + MESI[d.getMonth()]; }
  function vibra(schema) { try { if (navigator.vibrate) navigator.vibrate(schema || 8); } catch (e) { /* non importa */ } }
  function memoria(k, v) {                       // localStorage, se il telefono lo permette (una per link)
    var chiave = 'gama-' + BASE + '-' + k;
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(chiave) || 'null');
      if (v === null) localStorage.removeItem(chiave); else localStorage.setItem(chiave, JSON.stringify(v));
    } catch (e) { return null; }
    return null;
  }

  var timerVelo;
  function velo(on) {
    clearTimeout(timerVelo);
    if (on) timerVelo = setTimeout(function () { $('velo').hidden = false; }, 250);
    else $('velo').hidden = true;
  }
  var timerAvviso;
  function avvisa(msg, male) {
    var a = $('avviso');
    a.innerHTML = ico(male ? 'avviso' : 'info') + '<span>' + testo(msg) + '</span>';
    a.className = 'avviso' + (male ? ' male' : ''); a.hidden = false;
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(function () { a.hidden = true; }, male ? 5200 : 2800);
  }
  /** La conferma grande dopo un salvataggio: un segno di spunta che si disegna. */
  function mostraSuccesso(titolo, sotto) {
    var o = $('successo');
    o.innerHTML = '<div class="cerchio"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
      '<h2>' + testo(titolo) + '</h2>' + (sotto ? '<p>' + testo(sotto) + '</p>' : '');
    o.hidden = false;
    vibra([14, 70, 14]);
    return new Promise(function (ok) { setTimeout(function () { o.hidden = true; ok(); }, 1250); });
  }

  // ------------------------------------------------------------------ chiamate al server
  function chiama(percorso, corpo) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    return fetch(BASE + percorso, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo || {}), signal: ctrl ? ctrl.signal : undefined, cache: 'no-store'
    }).then(function (r) {
      clearTimeout(t);
      // Server spento per un aggiornamento (502), tunnel giu' (530), troppi tentativi (429),
      // wifi con pagina di accesso: sono tutti "riprova piu' tardi", non "dato sbagliato".
      var riprova = r.status >= 500 || r.status === 429;
      return r.json().then(function (j) {
        if (riprova && j) j.rete = true;
        return j;
      }, function () {
        return { ok: false, errore: 'Il server non risponde come dovrebbe (' + r.status + '). Riprova tra poco.', rete: true };
      });
    }, function () {
      clearTimeout(t);
      return { ok: false, errore: 'Niente collegamento: controlla di avere campo e riprova.', rete: true };
    });
  }

  /** Lettura: senza velo (c'e' la sagoma della schermata). */
  function carica(vista, parametro, zitto) {
    return chiama('api/carica', { vista: vista, parametro: parametro }).then(function (r) {
      if (!r.ok) { if (!zitto) avvisa(r.errore || 'Non riesco a leggere i dati.', 1); return null; }
      return r.dati;
    });
  }
  /** Scrittura: con il velo, cosi' non si tocca due volte. */
  function azione(nome, carico) {
    velo(true);
    return chiama('api/azione', { azione: nome, carico: carico }).then(function (r) { velo(false); return r; });
  }

  // ------------------------------------------------------------------ navigazione
  // Ogni schermata e' una voce della cronologia: il tasto indietro del telefono funziona.
  var VISTE = {};
  var turno = 0;                 // risposte arrivate tardi, per una schermata gia' lasciata, si ignorano
  var direzione = null;          // l'animazione da usare al prossimo disegno

  function intesta(t, s, conIndietro) {
    var h = $('testa');
    h.classList.remove('grande');
    $('titolo').textContent = t; $('sotto').textContent = s || '';
    $('indietro').hidden = !conIndietro;
    ombraTesta();
  }
  function intestaGrande(t, s) {
    var h = $('testa');
    h.classList.add('grande'); h.classList.remove('ombreggiata');
    $('titolo').textContent = t; $('sotto').textContent = s || '';
    $('indietro').hidden = true;
  }
  function ombraTesta() {
    var h = $('testa');
    h.classList.toggle('ombreggiata', !h.classList.contains('grande') && window.scrollY > 4);
  }
  window.addEventListener('scroll', ombraTesta, { passive: true });

  function schermo() {
    var s = $('schermo');
    s.innerHTML = '';
    window.scrollTo(0, 0);
    if (direzione) {
      s.classList.remove('entra-avanti', 'entra-indietro');
      void s.offsetWidth;
      s.classList.add('entra-' + direzione);
      direzione = null;
    }
    return s;
  }
  function sagoma(forma) {
    var pezzi = forma === 'riepilogo' ? '<i class="alto"></i><i></i><i></i><i></i>' : '<i></i><i></i><i></i><i></i><i></i>';
    $('schermo').innerHTML = '<div class="scheletro">' + pezzi + '</div>';
  }
  function fondo(html) {
    var f = $('fondo');
    if (!html) { f.hidden = true; f.innerHTML = ''; document.body.classList.remove('con-fondo'); return null; }
    f.innerHTML = '<div>' + html + '</div>'; f.hidden = false; document.body.classList.add('con-fondo');
    return f;
  }

  function mostra(stato, dir) {
    var v = (stato && VISTE[stato.vista]) ? stato : { vista: 'home' };
    turno++;
    direzione = dir || null;
    VISTE[v.vista](v.param);
  }
  function vai(vista, param) {
    var d = ((history.state && history.state.d) || 0) + 1;
    history.pushState({ vista: vista, param: param, d: d }, '', location.pathname);
    mostra({ vista: vista, param: param }, 'avanti');
  }
  function tornaHome() {
    var d = (history.state && history.state.d) || 0;
    if (d > 0) history.go(-d); else mostra({ vista: 'home' }, 'indietro');
  }
  function suHome() { return !history.state || history.state.vista === 'home'; }
  window.addEventListener('popstate', function (e) { mostra(e.state, 'indietro'); });
  $('indietro').addEventListener('click', function () {
    if (history.state && history.state.d > 0) history.back(); else mostra({ vista: 'home' }, 'indietro');
  });

  /** "#appello/20261013", "#mese/202609", "#giorni"... arrivano dalle notifiche. */
  function apriPercorso(percorso) {
    var p = String(percorso || '').replace(/^#/, '').split('/');
    if (p[0] && VISTE[p[0]] && p[0] !== 'home') vai(p[0], p[1] || undefined);
  }
  // anche ad app gia' aperta (un link con "#..." aperto nella stessa scheda)
  window.addEventListener('hashchange', function () {
    var h = location.hash;
    if (!h) return;
    history.replaceState(history.state, '', location.pathname);
    apriPercorso(h);
  });

  // ------------------------------------------------------------------ home
  VISTE.home = function () {
    intestaGrande(saluto() + ', ' + S.utente, oggiLungo() + ' · ' + S.ambito);
    fondo(null);
    var s = schermo(), H = S.home;

    var attesa = inSospeso();
    if (attesa.length) {
      var n = nota('giallo', 'nuvola', attesa.length === 1
        ? '<b>1 giornata in attesa di invio.</b> È salvata sul telefono e parte da sola appena possibile.'
        : '<b>' + attesa.length + ' giornate in attesa di invio.</b> Sono salvate sul telefono e partono da sole appena possibile.');
      n.querySelector('.corpo').appendChild(bottone('mini', ico('invia') + 'Invia ora', function () { inviaSospese(true); }));
      s.appendChild(n);
    }

    (H.cantieri || []).slice(0, 1).forEach(function (m) {
      var n = nota('giallo', 'avviso', '<b>Cantieri di ' + testo(m.nome) + ' da confermare.</b> ' +
        (m.iniziato ? 'Il mese è iniziato: controlla dove lavora ognuno e conferma.' : 'Prepara il mese: controlla dove lavora ognuno e conferma.'));
      n.querySelector('.corpo').appendChild(bottone('mini', ico('cantiere') + 'Apri i cantieri', function () { vai('cantieri', m.mese); }));
      s.appendChild(n);
    });

    if (S.avviso) {
      s.appendChild(nota('giallo', 'avviso', testo(S.avviso)));
    } else {
      s.appendChild(cartaOggi(H.oggi));
      s.appendChild(striscia(H));
      s.appendChild(numeri(H));
    }

    s.appendChild(sezione('Altro'));
    var t = el('div', 'tessere');
    var tessere = [
      ['euro', 'ambra', 'Compenso extra', 'una cifra in più a qualcuno', function () { vai('extra'); }],
      ['persone', '', 'Dipendenti', 'chi entra, chi esce', function () { vai('dipendenti'); }]
    ];
    if (S.tutto) tessere.push(['cantiere', '', 'Cantieri', 'chi lavora dove, ogni mese', function () { vai('cantieri'); }]);
    if (S.admin) tessere.push(['scudo', '', 'Chi usa l’app', 'soci, agenzia e link', function () { vai('utenti'); }]);
    tessere.push([iscritto ? 'campana' : 'campanaNo', iscritto ? 'verde' : '', 'Notifiche', statoNotificheTesto(), function () { vai('notifiche'); }]);
    tessere.forEach(function (x, i) {
      var larga = tessere.length % 2 === 1 && i === tessere.length - 1;
      t.appendChild(bottone('tessera' + (larga ? ' larga' : ''),
        '<span class="icona ' + x[1] + '">' + ico(x[0]) + '</span><span class="testo"><span class="t">' + x[2] + '</span>' +
        '<span class="s">' + testo(x[3]) + '</span></span>', x[4]));
    });
    s.appendChild(t);

    if (!installata()) {
      s.appendChild(bottone('invito', ico('telefono') + '<span><b>Metti l’app sulla schermata Home</b>così la apri con un tocco, come WhatsApp</span>',
        function () { vai('installa'); }));
    }
    aggiornaHomeDiNascosto();
  };

  function cartaOggi(o) {
    if (o.sabato) return cartaSabato(o);
    var fatto = !!o.giaFatto && o.completo, parte = !!o.giaFatto && !o.completo;
    var c = el('section', 'oggi-carta' + (fatto ? ' fatto' : ''));
    c.innerHTML =
      '<span class="chip"><span class="pallino"></span>' + (fatto ? 'Fatto' : parte ? 'Fatto in parte' : 'Da fare') + '</span>' +
      '<h2>Appello di oggi</h2>' +
      '<p class="dettaglio">' + (fatto
        ? '<span class="num">' + o.presenti + '</span> al lavoro · <span class="num">' + o.ore + '</span> ore'
        : parte ? 'Ha compilato ' + testo(o.giaFatto) + ': manca ancora l’altra squadra.'
        : o.persone + (o.persone === 1 ? ' persona' : ' persone') + ' da segnare') + '</p>' +
      (fatto && o.quando ? '<p class="quando">Salvato alle ' + testo(o.quando) + ' da ' + testo(o.giaFatto) + '</p>' : '');
    c.appendChild(bottone('vai', fatto ? ico('matita') + 'Rivedi o correggi' : ico('appello') + (parte ? 'Apri l’appello' : 'Fai l’appello'),
      function () { vai('appello', S.oggi); }));
    return c;
  }

  function cartaSabato(o) {
    var fatto = !!o.giaFatto && o.completo, parte = !!o.giaFatto && !o.completo;
    var c = el('section', 'oggi-carta' + (fatto ? ' fatto' : ''));
    c.innerHTML =
      '<span class="chip"><span class="pallino"></span>' + (fatto ? 'Fatto' : parte ? 'Fatto in parte' : 'Da fare') + '</span>' +
      '<h2>Trasferte di oggi</h2>' +
      '<p class="dettaglio">' + (fatto
        ? '<span class="num">' + o.inTrasferta + '</span> in trasferta · <span class="num">' + euro(o.euro) + '</span>'
        : parte ? 'Ha compilato ' + testo(o.giaFatto) + ': manca ancora l’altra squadra.'
        : 'Sabato: si segna la trasferta di chi lavora') + '</p>' +
      (fatto && o.quando ? '<p class="quando">Salvato alle ' + testo(o.quando) + ' da ' + testo(o.giaFatto) + '</p>' : '');
    c.appendChild(bottone('vai', fatto ? ico('matita') + 'Rivedi o correggi' : ico('camion') + 'Segna le trasferte',
      function () { vai('appello', S.oggi); }));
    return c;
  }

  function giornoBottone(g) {
    var b = bottone('giorno ' + g.stato + (g.oggi ? ' oggi' : ''),
      '<span class="l">' + g.lettera + '</span><span class="n">' + g.num + '</span>',
      function () { vibra(); vai('appello', g.codice); });
    var parole = { fatto: 'fatto', parziale: 'fatto in parte', mancante: 'da fare', riposo: 'riposo', futuro: 'deve ancora venire' };
    b.setAttribute('aria-label', g.num + ': ' + parole[g.stato]);
    if (!g.apribile) b.disabled = true;
    return b;
  }

  function striscia(H) {
    var c = el('section', 'carta striscia');
    var capo = el('div', 'capo', '<b>Ultime due settimane</b>');
    if (H.arretrati) {
      capo.appendChild(bottone(null, H.arretrati + ' da sistemare ›', function () { vai('giorni'); }));
    } else {
      capo.appendChild(el('span', 'ok', 'tutto in regola'));
    }
    c.appendChild(capo);
    for (var w = 0; w < 2; w++) {
      var riga = el('div', 'settimana');
      H.giorni.slice(w * 7, w * 7 + 7).forEach(function (g) { riga.appendChild(giornoBottone(g)); });
      c.appendChild(riga);
    }
    c.appendChild(el('div', 'legenda',
      '<span><i style="background:var(--verde)"></i>fatto</span>' +
      (S.tutto ? '<span><i style="background:var(--ambra)"></i>in parte</span>' : '') +
      '<span><i style="box-shadow:inset 0 0 0 2px var(--rosso)"></i>da fare</span>'));
    return c;
  }

  function numeri(H) {
    var n = el('div', 'numeri');
    n.appendChild(bottone('numero',
      '<span class="et">Questa settimana ' + ico('avanti', 'i-xs') + '</span>' +
      '<span class="grande">' + H.settimana.ore + '<small>ore</small></span>' +
      '<span class="sub">' + H.settimana.fatti + ' di ' + H.settimana.lavorativi + ' giorni fatti</span>',
      function () { vai('settimana'); }));
    n.appendChild(bottone('numero',
      '<span class="et">' + maiuscola(H.mese.nome) + ' ' + ico('avanti', 'i-xs') + '</span>' +
      '<span class="grande">' + H.mese.ore + '<small>ore</small></span>' +
      '<span class="sub">' + (H.mese.extra ? euro(H.mese.extra) + ' di extra' : 'nessun extra') + '</span>',
      function () { vai('mese', H.mese.codice); }));
    return n;
  }

  /** Rilegge in silenzio la plancia (l'altro socio o l'amministratore possono aver salvato). */
  var ultimoAggiornamento = Date.now();
  function aggiornaHomeDiNascosto(subito) {
    if (!subito && Date.now() - ultimoAggiornamento < 15000) return Promise.resolve();
    ultimoAggiornamento = Date.now();
    var prima = JSON.stringify(S.home);
    return carica('home', null, true).then(function (d) {
      if (!d) return;
      S.home = d;
      if (JSON.stringify(d) !== prima && suHome()) { turno++; VISTE.home(); }
    });
  }

  // ------------------------------------------------------------------ appello
  VISTE.appello = function (codice) {
    codice = codice || S.oggi;
    var mio = turno;
    intesta('Appello', '', true);
    // oggi si apre subito con quello che l'app sa gia', poi si controlla col server
    var gia = codice === S.oggi && S.appelloOggi && S.appelloOggi.righe ? copia(S.appelloOggi) : null;
    if (gia) { S.appello = gia; S.appello.toccato = false; disegnaAppello(); }
    else { fondo(null); sagoma('lista'); }

    carica('appello', codice).then(function (d) {
      if (mio !== turno) return;                                   // l'utente e' gia' altrove
      if (!d) { if (!gia) tornaHome(); return; }
      if (codice === S.oggi) S.appelloOggi = copia(d);
      if (gia && S.appello.codice === d.codice) {
        if (d.impronta === S.appello.impronta) return;             // niente di nuovo
        if (S.appello.toccato) { bandaAggiornata(d); return; }     // non si cancellano i tocchi fatti
      }
      S.appello = d; S.appello.toccato = false; disegnaAppello();
    });
  };

  function bandaAggiornata(d) {
    var s = $('schermo');
    if (s.querySelector('.banda.nuova')) return;
    var b = el('div', 'banda nuova', ico('rinnova') + '<span>Nel frattempo ' + testo(d.giaFatto || 'qualcuno') + ' ha salvato questa giornata.</span>');
    b.appendChild(bottone('mini', 'Mostra', function () { S.appello = d; S.appello.toccato = false; disegnaAppello(); }));
    var dopo = s.querySelector('.contatori');
    s.insertBefore(b, dopo ? dopo.nextSibling : s.firstChild);
  }

  var PILLOLE = { ORD: ['spunta', '8 ore'], MEZ: ['orologio', '4 ore'], ASS: ['meno', 'Assente'], FER: ['calendario', 'Ferie'], FES: ['calendario', 'Festivo'], PIO: ['pioggia', 'Pioggia'], MAL: ['malattia', 'Malattia'] };
  function pillola(r) { return r.stato === 'ALT' ? ['orologio', r.ore + ' ore'] : PILLOLE[r.stato] || PILLOLE.ASS; }

  /**
   * "Altre ore": un pannello dal basso con le ore da scegliere (niente 4 e 8, che hanno il
   * loro tocco). Risponde con il numero scelto, o null se si chiude senza scegliere.
   */
  function scegliOre(nome, attuali) {
    return new Promise(function (fine) {
      var prima = document.activeElement;
      var fondale = el('div', 'pannello-ore');
      var p = el('div', 'pannello', '<h2 id="pannelloTit">Quante ore?</h2><p>' + testo(nome) + '</p>');
      p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-labelledby', 'pannelloTit');
      var griglia = el('div', 'ore-griglia');
      function chiudi(ore) {
        document.removeEventListener('keydown', tasto);
        fondale.remove();
        if (prima && prima.focus) prima.focus();
        fine(ore);
      }
      function tasto(e) { if (e.key === 'Escape') chiudi(null); }
      (S.oreAScelta || []).forEach(function (n) {
        var b = bottone(n === attuali ? 'scelta' : null, '<b>' + n + '</b>', function () { vibra(); chiudi(n); });
        b.setAttribute('aria-label', n + (n === 1 ? ' ora' : ' ore'));
        griglia.appendChild(b);
      });
      p.appendChild(griglia);
      p.appendChild(bottone('annulla', 'Annulla · torna a 8 ore', function () { chiudi(null); }));
      fondale.appendChild(p);
      fondale.addEventListener('click', function (e) { if (e.target === fondale) chiudi(null); });
      document.addEventListener('keydown', tasto);
      document.body.appendChild(fondale);
      griglia.querySelector('button').focus();
    });
  }

  function disegnaAppello() {
    var A = S.appello;
    if (A.sabato) { disegnaSabato(); return; }
    intesta('Appello', maiuscola(A.giorno), true);
    var s = schermo();
    if (!A.righe.length) { fondo(null); s.appendChild(nota('giallo', 'avviso', testo(S.avviso || 'Nessun dipendente da segnare.'))); return; }

    s.appendChild(el('div', 'contatori',
      '<span class="contatore verde">' + ico('spunta', 'i-s') + '<b id="cOrd">0</b> 8 ore</span>' +
      '<span class="contatore ambra" id="cMezBox" hidden>' + ico('orologio', 'i-s') + '<b id="cMez">0</b> 4 ore</span>' +
      '<span class="contatore rosso" id="cMalBox" hidden>' + ico('malattia', 'i-s') + '<b id="cMal">0</b> malattia</span>' +
      '<span class="contatore verde" id="cAltBox" hidden>' + ico('orologio', 'i-s') + '<b id="cAlt">0</b> altre</span>' +
      '<span class="contatore blu" id="cPioBox" hidden>' + ico('pioggia', 'i-s') + '<b id="cPio">0</b> pioggia</span>' +
      '<span class="contatore grigio">' + ico('meno', 'i-s') + '<b id="cAss">0</b> assenti</span>'));

    if (A.giaFatto) {
      s.appendChild(el('div', 'banda', ico('info') + '<span>' + (A.completo
        ? 'Già salvato da ' + testo(A.giaFatto) + (A.quando ? ' alle ' + testo(A.quando) : '') + '. Puoi correggere e confermare di nuovo.'
        : 'Compilato in parte da ' + testo(A.giaFatto) + ': le altre squadre mancano ancora.') + '</span>'));
    }
    s.appendChild(el('p', 'aiuto', 'Sono tutti a <b>8 ore</b>. Tocca un nome per cambiarlo: <b>8 ore → assente → malattia → pioggia → altre ore</b> (4 ore e le altre si scelgono lì).'));

    var lista = el('div', 'lista');
    var squadre = {};
    A.righe.forEach(function (r) { squadre[r.squadra || ''] = true; });
    var piuSquadre = Object.keys(squadre).length > 1, ultima = null;

    A.righe.forEach(function (r) {
      if (piuSquadre && (r.squadra || '') !== ultima) {
        ultima = r.squadra || '';
        lista.appendChild(el('div', 'gruppo', ultima ? testo(ultima) : 'Senza squadra'));
      }
      var b = bottone('riga');
      function dipingi() {
        var p = pillola(r);
        b.setAttribute('data-s', r.stato);
        b.setAttribute('aria-label', r.nome + ': ' + p[1]);
        b.innerHTML = avatar(r.nome) + '<span class="nome">' + testo(r.nome) + '</span><span class="pill">' + ico(p[0], 'i-xs') + p[1] + '</span>';
      }
      dipingi();
      function cambia(stato, ore) {
        r.stato = stato;
        if (stato === 'ALT') r.ore = ore; else delete r.ore;
        A.toccato = true;
        vibra();
        dipingi();
        b.classList.remove('colpo'); void b.offsetWidth; b.classList.add('colpo');
        conta();
      }
      b.addEventListener('click', function () {
        var i = S.ciclo.indexOf(r.stato);
        var dopo = S.ciclo[(i + 1) % S.ciclo.length];
        if (dopo !== 'ALT') return cambia(dopo);
        // dopo le 4 ore si scelgono le ore; chi chiude senza scegliere torna a 8 ore
        scegliOre(r.nome, r.stato === 'MEZ' ? 4 : r.ore).then(function (ore) { if (ore) cambia('ALT', ore); else cambia(S.ciclo[0]); });
      });
      lista.appendChild(b);
    });
    s.appendChild(lista);

    var sc = el('div', 'scorciatoie');
    sc.appendChild(bottone(null, ico('spunta', 'i-s') + 'Tutti a 8 ore', function () { A.righe.forEach(function (r) { r.stato = 'ORD'; }); A.toccato = true; disegnaAppello(); }));
    sc.appendChild(bottone(null, ico('meno', 'i-s') + 'Tutti assenti', function () { A.righe.forEach(function (r) { r.stato = 'ASS'; }); A.toccato = true; disegnaAppello(); }));
    s.appendChild(sc);
    var sc2 = el('div', 'scorciatoie');
    sc2.appendChild(bottone(null, ico('pioggia', 'i-s') + 'Tutti: pioggia', function () { A.righe.forEach(function (r) { r.stato = 'PIO'; delete r.ore; }); A.toccato = true; disegnaAppello(); }));
    s.appendChild(sc2);

    fondo('<button class="grosso" id="salva" type="button">' + ico('spunta') + '<span>Conferma</span><span class="ore" id="oreSalva"></span></button>');
    conta();
    $('salva').addEventListener('click', salvaAppello);
  }

  // ------------------------------------------------------------------ il sabato: trasferte in euro
  function euroDa(v) {
    var t = String(v == null ? '' : v).replace(/\s|€/g, '').replace(',', '.');
    if (t === '') return 0;
    var n = Math.round(Number(t) * 100) / 100;
    return isFinite(n) && n >= 0 ? n : NaN;
  }
  function disegnaSabato() {
    var A = S.appello;
    intesta('Trasferte', maiuscola(A.giorno), true);
    var s = schermo();
    if (!A.righe.length) { fondo(null); s.appendChild(nota('giallo', 'avviso', testo(S.avviso || 'Nessun dipendente da segnare.'))); return; }
    A.righe.forEach(function (r) {
      if (r.valore === undefined) r.valore = r.importo != null ? r.importo : (r.suggerito != null ? r.suggerito : 0);
    });
    s.appendChild(el('div', 'contatori',
      '<span class="contatore verde">' + ico('camion', 'i-s') + '<b id="tN">0</b> in trasferta</span>' +
      '<span class="contatore ambra">' + ico('euro', 'i-s') + '<b id="tE">0</b> €</span>'));
    if (A.giaFatto) {
      s.appendChild(el('div', 'banda', ico('info') + '<span>' + (A.completo
        ? 'Già salvato da ' + testo(A.giaFatto) + (A.quando ? ' alle ' + testo(A.quando) : '') + '. Puoi correggere e confermare di nuovo.'
        : 'Compilato in parte da ' + testo(A.giaFatto) + ': le altre squadre mancano ancora.') + '</span>'));
    }
    s.appendChild(el('p', 'aiuto', 'Il sabato non si segnano le ore: scrivi la <b>trasferta</b> di chi ha lavorato, <b>0</b> per chi non c’era. ' +
      'Il numero già scritto è quello dell’ultima volta.'));

    var lista = el('div', 'lista'), squadre = {}, ultima = null;
    A.righe.forEach(function (r) { squadre[r.squadra || ''] = true; });
    var piuSquadre = Object.keys(squadre).length > 1;
    A.righe.forEach(function (r) {
      if (piuSquadre && (r.squadra || '') !== ultima) {
        ultima = r.squadra || '';
        lista.appendChild(el('div', 'gruppo', ultima ? testo(ultima) : 'Senza squadra'));
      }
      var riga = el('label', 'riga statica trasferta');
      riga.innerHTML = avatar(r.nome) + '<span class="nome">' + testo(r.nome) +
        (r.suggerito != null ? '<small>ultima volta ' + euro(r.suggerito) + '</small>' : '') + '</span>';
      var campo = el('span', 'euro-campo', '<span>€</span>');
      var inp = el('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.autocomplete = 'off';
      inp.value = String(r.valore).replace('.', ',');
      inp.setAttribute('aria-label', 'Trasferta di ' + r.nome);
      inp.addEventListener('focus', function () { inp.select(); });
      inp.addEventListener('input', function () { r.valore = inp.value; A.toccato = true; contaSabato(); });
      campo.appendChild(inp); riga.appendChild(campo);
      riga.setAttribute('data-s', euroDa(r.valore) > 0 ? 'ORD' : 'ASS');
      r.el = riga;
      lista.appendChild(riga);
    });
    s.appendChild(lista);
    var sc = el('div', 'scorciatoie');
    sc.appendChild(bottone(null, ico('rinnova', 'i-s') + 'Come l’ultima volta', function () {
      A.righe.forEach(function (r) { r.valore = r.suggerito != null ? r.suggerito : 0; }); A.toccato = true; disegnaSabato();
    }));
    sc.appendChild(bottone(null, ico('meno', 'i-s') + 'Nessuno ha lavorato', function () {
      A.righe.forEach(function (r) { r.valore = 0; }); A.toccato = true; disegnaSabato();
    }));
    s.appendChild(sc);
    fondo('<button class="grosso" id="salva" type="button">' + ico('spunta') + '<span>Conferma</span><span class="ore" id="oreSalva"></span></button>');
    contaSabato();
    $('salva').addEventListener('click', salvaSabato);
  }
  function contaSabato() {
    var n = 0, tot = 0;
    S.appello.righe.forEach(function (r) {
      var v = euroDa(r.valore);
      if (v > 0) { n++; tot += v; }
      if (r.el) r.el.setAttribute('data-s', v > 0 ? 'ORD' : isNaN(v) ? 'MEZ' : 'ASS');
    });
    if ($('tN')) { $('tN').textContent = n; $('tE').textContent = String(Math.round(tot * 100) / 100).replace('.', ','); }
    if ($('oreSalva')) $('oreSalva').textContent = '· ' + euro(tot);
  }
  function salvaSabato() {
    var A = S.appello, importi = {}, sbagliato = null;
    A.righe.forEach(function (r) { var v = euroDa(r.valore); if (isNaN(v)) sbagliato = sbagliato || r.nome; importi[r.nome] = v; });
    if (sbagliato) { avvisa('La cifra di ' + sbagliato + ' non è valida.', 1); return; }
    var b = $('salva'); b.disabled = true;
    azione('salvaSabato', { d: A.codice, importi: importi, impronta: A.impronta || '' }).then(function (r) {
      b.disabled = false;
      if (r.conflitto) {
        avvisa(r.errore, 1);
        S.appello = r.dati; S.appello.toccato = false;
        if (A.codice === S.oggi) S.appelloOggi = copia(r.dati);
        disegnaAppello();
        return;
      }
      if (!r.ok && r.rete) {
        metteInSospeso({ d: A.codice, giorno: A.giorno, sabato: true, importi: importi });
        avvisa('Non riesco a inviarlo adesso: il sabato è salvato sul telefono e parte da solo appena possibile.');
        if (A.codice === S.oggi) { S.home.oggi.giaFatto = S.utente; S.home.oggi.completo = !S.tutto; }
        setTimeout(tornaHome, 1800);
        return;
      }
      if (!r.ok) { avvisa(r.errore, 1); return; }
      togliDaSospese(function (x) { return x.d === A.codice; });
      var fatto = mostraSuccesso('Trasferte salvate', maiuscola(A.giorno) + ' · ' + r.messaggio);
      var dati = Promise.all([aggiornaHomeDiNascosto(true), carica('appello', S.oggi, true)]).then(function (x) {
        if (x[1]) S.appelloOggi = copia(x[1]);
      });
      Promise.all([fatto, dati]).then(tornaHome);
    });
  }

  function conta() {
    var c = { ORD: 0, MEZ: 0, ALT: 0, ASS: 0, PIO: 0, MAL: 0 }, ore = 0;
    S.appello.righe.forEach(function (r) {
      var def = S.codici[r.stato];
      if (c[r.stato] !== undefined) c[r.stato]++;
      if (def && def.riga === 'ord.') ore += r.stato === 'ALT' ? r.ore : def.ore;
    });
    if ($('cOrd')) {
      $('cOrd').textContent = c.ORD; $('cMez').textContent = c.MEZ; $('cMezBox').hidden = !c.MEZ; $('cAss').textContent = c.ASS;
      $('cMal').textContent = c.MAL; $('cMalBox').hidden = !c.MAL;
      $('cAlt').textContent = c.ALT; $('cAltBox').hidden = !c.ALT;
      $('cPio').textContent = c.PIO; $('cPioBox').hidden = !c.PIO;
    }
    if ($('oreSalva')) $('oreSalva').textContent = '· ' + ore + ' ore';
  }

  function salvaAppello() {
    var b = $('salva'); b.disabled = true;
    var A = S.appello, stati = {};
    A.righe.forEach(function (r) { stati[r.nome] = r.stato === 'ALT' ? { codice: 'ALT', ore: r.ore } : r.stato; });
    azione('salvaAppello', { d: A.codice, stati: stati, impronta: A.impronta || '' }).then(function (r) {
      b.disabled = false;
      if (r.conflitto) {
        // qualcuno ha salvato mentre si lavorava: si mostra la versione nuova, nessuno perde niente
        avvisa(r.errore, 1);
        S.appello = r.dati; S.appello.toccato = false;
        if (A.codice === S.oggi) S.appelloOggi = copia(r.dati);
        disegnaAppello();
        return;
      }
      if (!r.ok && r.rete) {
        metteInSospeso({ d: A.codice, giorno: A.giorno, stati: stati });
        avvisa('Non riesco a inviarla adesso: la giornata è salvata sul telefono e parte da sola appena possibile.');
        if (A.codice === S.oggi) { S.home.oggi.giaFatto = S.utente; S.home.oggi.completo = !S.tutto; }
        setTimeout(tornaHome, 1800);
        return;
      }
      if (!r.ok) { avvisa(r.errore, 1); return; }
      togliDaSospese(function (x) { return x.d === A.codice; });   // la versione appena salvata vince
      var fatto = mostraSuccesso('Giornata salvata', maiuscola(A.giorno) + ' · ' + r.messaggio);
      var dati = Promise.all([aggiornaHomeDiNascosto(true), carica('appello', S.oggi, true)]).then(function (x) {
        if (x[1]) S.appelloOggi = copia(x[1]);
      });
      Promise.all([fatto, dati]).then(tornaHome);
    });
  }

  // ------------------------------------------------------------------ giornate salvate senza campo
  function inSospeso() { return memoria('in-sospeso') || []; }
  function metteInSospeso(g) {
    g.id = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    var lista = inSospeso().filter(function (x) { return x.d !== g.d; });   // la piu' recente vince
    lista.push(g); memoria('in-sospeso', lista);
  }
  /** Toglie dalla coda solo le voci indicate, rileggendo la coda di adesso. */
  function togliDaSospese(daTogliere) {
    var lista = inSospeso().filter(function (x) { return !daTogliere(x); });
    memoria('in-sospeso', lista.length ? lista : null);
  }
  var invioInCorso = false;
  function inviaSospese(aMano) {
    var lista = inSospeso();
    if (!lista.length || invioInCorso) return;
    invioInCorso = true;
    var chiuse = {}, rimaste = 0, inviate = 0;          // chiuse = inviate o rifiutate per un motivo vero
    lista.reduce(function (p, g) {
      return p.then(function () {
        var carico = g.sabato ? { azione: 'salvaSabato', carico: { d: g.d, importi: g.importi } }
          : { azione: 'salvaAppello', carico: { d: g.d, stati: g.stati } };
        return chiama('api/azione', carico).then(function (r) {
          if (r.ok) { inviate++; chiuse[g.id] = true; }
          else if (r.rete) rimaste++;
          else { chiuse[g.id] = true; avvisa('Non ho potuto inviare ' + g.giorno + ': ' + r.errore, 1); }
        });
      });
    }, Promise.resolve()).then(function () {
      invioInCorso = false;
      // si rilegge la coda: le giornate aggiunte mentre si inviava restano
      togliDaSospese(function (x) { return chiuse[x.id]; });
      if (inviate) {
        avvisa(inviate === 1 ? 'Inviata la giornata salvata senza campo.' : 'Inviate ' + inviate + ' giornate salvate senza campo.');
        aggiornaHomeDiNascosto(true).then(function () { if (suHome()) { turno++; VISTE.home(); } });
      } else if (aMano && rimaste) {
        avvisa('Ancora niente collegamento: riprovo da solo appena possibile.', 1);
      }
    });
  }
  window.addEventListener('online', function () { inviaSospese(false); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    inviaSospese(false);
    if (suHome()) aggiornaHomeDiNascosto();
  });

  // ------------------------------------------------------------------ giorni da sistemare
  VISTE.giorni = function () {
    var mio = turno;
    intesta('Giorni', 'da compilare e correggere', true); fondo(null); sagoma('lista');
    carica('giorni').then(function (d) {
      if (mio !== turno) return;
      if (!d) { tornaHome(); return; }
      var da = d.filter(function (x) { return !x.fatto; }).length;
      intesta('Giorni', da ? (da === 1 ? '1 da sistemare' : da + ' da sistemare') : 'tutto in regola', true);
      var s = schermo();
      if (!d.length) { s.appendChild(nota('giallo', 'avviso', testo(S.avviso || 'Nessun dipendente da segnare.'))); return; }
      s.appendChild(el('p', 'aiuto', 'Tocca un giorno per aprire il suo appello.'));
      var lista = el('div', 'lista');
      d.forEach(function (g) {
        var b = bottone('riga',
          '<span class="avatar">' + ico(g.fatto ? 'spunta' : 'avviso', 'i-s') + '</span>' +
          '<span class="nome">' + testo(maiuscola(g.etichetta)) + (g.oggi ? '<small>oggi</small>' : '') + '</span>' +
          '<span class="pill">' + (g.fatto ? 'fatto' : 'da fare') + '</span>' + ico('avanti', 'i-s freccia'),
          function () { vai('appello', g.codice); });
        b.setAttribute('data-s', g.fatto ? 'ORD' : 'ASS');
        if (!g.fatto) { b.style.outline = '1.5px solid var(--rosso)'; }
        lista.appendChild(b);
      });
      s.appendChild(lista);
    });
  };

  // ------------------------------------------------------------------ riepiloghi
  function cartaTotale(d, etichetta) {
    var gg = d.righe.reduce(function (t, p) { return t + p.gg; }, 0);
    var extra = (d.extra || []).reduce(function (t, x) { return t + x.importo; }, 0);
    return el('section', 'carta totale',
      '<div class="et">' + testo(etichetta) + '</div>' +
      '<div class="cifra">' + d.oreTotali + '<small>ore</small></div>' +
      '<div class="righe"><span><b>' + gg + '</b> giornate</span>' +
      (extra ? '<span><b>' + euro(extra) + '</b> di extra</span>' : '') +
      (d.trasferteTotali ? '<span><b>' + euro(d.trasferteTotali) + '</b> di trasferte</span>' : '') +
      (d.mancanti && d.mancanti.length ? '<span style="color:var(--rosso)"><b style="color:inherit">' + d.mancanti.length + '</b> ' + (S.tutto ? 'da completare' : d.mancanti.length === 1 ? 'giorno vuoto' : 'giorni vuoti') + '</span>' : '') +
      '</div>');
  }

  function cartaPersone(d) {
    var c = el('section', 'carta');
    var pieno = Math.max(d.lavorativi || 1, 1);
    d.righe.forEach(function (p) {
      var interi = p.gg - p.mezze;
      var pct = function (n) { return Math.min(100, Math.round(n / pieno * 100)) + '%'; };
      var r = el('div', 'persona' + (p.gg || p.fer || p.fes ? '' : ' vuota-p'),
        avatar(p.nome) +
        '<span class="chi">' + testo(p.nome) + (S.tutto && p.squadra ? ' <small>· ' + testo(etichettaSq(p.squadra)) + '</small>' : '') +
        (p.cantiere ? ' <small>· ' + testo(p.cantiere) + '</small>' : '') + '</span>' +
        '<span class="val">' + p.gg + ' gg <small>· ' + p.ore + ' h</small></span>' +
        '<span class="barra"><i style="width:' + pct(interi) + '"></i><i class="mezza" style="width:' + pct(p.mezze) + '"></i>' +
        '<i class="ferie" style="width:' + pct(p.fer) + '"></i></span>');
      if (p.mezze || p.fer || p.fes || p.pio || p.mal || p.trasferte) {
        var ch = el('span', 'chips');
        if (p.mezze) ch.appendChild(el('span', null, p.mezze + (p.mezze === 1 ? ' mezza giornata' : ' mezze giornate')));
        if (p.fer) ch.appendChild(el('span', 'fer', p.fer + ' ferie'));
        if (p.fes) ch.appendChild(el('span', 'fer', p.fes + ' festivi'));
        if (p.pio) ch.appendChild(el('span', 'fer', p.pio + (p.pio === 1 ? ' giorno di pioggia' : ' giorni di pioggia')));
        if (p.mal) ch.appendChild(el('span', 'fer', p.mal + (p.mal === 1 ? ' giorno di malattia' : ' giorni di malattia')));
        if (p.trasferte) ch.appendChild(el('span', null, euro(p.trasferte) + ' di trasferte (' + p.sabati + (p.sabati === 1 ? ' sabato)' : ' sabati)')));
        r.appendChild(ch);
      }
      c.appendChild(r);
    });
    return c;
  }

  function cartaExtra(d) {
    var c = el('section', 'carta');
    d.extra.forEach(function (x) {
      c.appendChild(el('div', 'voce-extra', avatar(x.nome) +
        '<span class="chi">' + testo(x.nome) + (x.note ? '<small>' + testo(x.note) + '</small>' : '') + '</span>' +
        '<span class="euro">' + euro(x.importo) + '</span>'));
    });
    return c;
  }

  function mancanti(d) {
    if (!d.mancanti || !d.mancanti.length) return null;
    return nota('rosso', 'avviso', (S.tutto ? 'Giorni da completare' : 'Giorni senza presenze') + ': <b>' + d.mancanti.join(', ') +
      '</b>. ' + (S.tutto ? 'Almeno una squadra non ha ancora segnato le presenze.' : 'Le ore di quei giorni non ci sono ancora.'));
  }

  VISTE.settimana = function () {
    var mio = turno;
    intesta('Settimana', '', true); fondo(null); sagoma('riepilogo');
    carica('settimana').then(function (d) {
      if (mio !== turno) return;
      if (!d) { tornaHome(); return; }
      intesta('Settimana', d.titolo, true);
      var s = schermo();
      if (!d.righe.length) { s.appendChild(nota('giallo', 'avviso', testo(S.avviso || 'Nessun dipendente nella tua squadra.'))); return; }
      s.appendChild(cartaTotale(d, 'Ore lavorate questa settimana'));
      var m = mancanti(d); if (m) s.appendChild(m);
      s.appendChild(sezione('Per persona'));
      s.appendChild(cartaPersone(d));
    });
  };

  VISTE.mese = function (param) {
    var mio = turno;
    var scelto = param || S.oggi.slice(0, 6);
    intesta('Mese', '', true); fondo(null); sagoma('riepilogo');
    carica('mese', scelto).then(function (d) {
      if (mio !== turno) return;
      if (!d) { tornaHome(); return; }
      intesta('Mese', maiuscola(d.titolo), true);
      var s = schermo();

      var p = el('div', 'pillole');
      var anno = Number(S.oggi.slice(0, 4)), mese = Number(S.oggi.slice(4, 6));
      for (var i = 0; i < 6; i++) {
        (function () {
          var m = mese - i, a = anno;
          while (m < 1) { m += 12; a -= 1; }
          var cod = String(a) + ('0' + m).slice(-2);
          var b = bottone(null, MESI[m - 1] + (a !== anno ? ' ' + a : ''), function () {
            history.replaceState({ vista: 'mese', param: cod, d: (history.state && history.state.d) || 1 }, '', location.pathname);
            turno++; VISTE.mese(cod);
          });
          b.setAttribute('aria-pressed', cod === scelto ? 'true' : 'false');
          p.appendChild(b);
        })();
      }
      s.appendChild(p);

      if (!d.righe.length) { s.appendChild(nota('giallo', 'avviso', testo(S.avviso || 'Nessun dipendente nella tua squadra.'))); return; }
      s.appendChild(cartaTotale(d, 'Ore lavorate a ' + MESI[Number(d.mese.slice(4)) - 1]));

      // il calendario del mese: un tocco su un giorno apre il suo appello
      var cal = el('section', 'carta calendario');
      cal.appendChild(el('div', 'intest', '<span>L</span><span>M</span><span>M</span><span>G</span><span>V</span><span>S</span><span>D</span>'));
      var celle = [];
      for (var v = 0; v < d.calendario.vuoti; v++) celle.push(null);
      d.calendario.giorni.forEach(function (g) { celle.push(g); });
      for (var w = 0; w < celle.length; w += 7) {
        var riga = el('div', 'settimana');
        celle.slice(w, w + 7).forEach(function (g) { riga.appendChild(g ? giornoBottone(g) : el('span')); });
        cal.appendChild(riga);
      }
      s.appendChild(cal);
      var m = mancanti(d); if (m) s.appendChild(m);

      if (d.scaricabile) {
        var pdf = el('a', 'scarica', '<span class="icona">' + ico('foglio') + '</span><span><b>Documento PDF</b>' +
          '<span>' + testo(maiuscola(d.titolo)) + ': griglia, riepilogo e trasferte</span></span>' + ico('scarica', 'dx'));
        pdf.href = BASE + 'foglio/' + d.mese + '.pdf';
        pdf.setAttribute('download', '');
        s.appendChild(pdf);
        if (d.commercialista) s.appendChild(bottoneMail(d, pdf.href));
        var xls = el('a', 'scarica', '<span class="icona">' + ico('grafico') + '</span><span><b>Excel per le modifiche</b>' +
          '<span>Lo stesso mese in Excel, da ritoccare se serve</span></span>' + ico('scarica', 'dx'));
        xls.href = BASE + 'foglio/' + d.mese + '.xlsx';
        xls.setAttribute('download', '');
        xls.style.marginTop = '10px';
        s.appendChild(xls);
      } else if (S.tutto) {
        var nm = nota('grigio', 'info', 'Il documento del mese (PDF ed Excel) si scarica quando tutte le squadre hanno compilato tutti i giorni ' +
          'e i cantieri del mese sono confermati. ' + testo(d.motivo || '') +
          (d.senzaCantiere && d.senzaCantiere.length ? ' Senza cantiere: <b>' + d.senzaCantiere.map(testo).join(', ') + '</b>.' : ''));
        if (d.cantieriConfermati === false) {
          nm.querySelector('.corpo').appendChild(bottone('mini', ico('cantiere') + 'Vai ai cantieri', function () {
            vai('cantieri', d.mese.slice(0, 4) + '-' + d.mese.slice(4));
          }));
        }
        s.appendChild(nm);
      }

      s.appendChild(sezione('Per persona'));
      s.appendChild(cartaPersone(d));
      if (d.extra && d.extra.length) { s.appendChild(sezione('Compensi extra')); s.appendChild(cartaExtra(d)); }
      if (!S.tutto) {
        s.appendChild(nota('grigio', 'info', 'Il documento del mese lo prepara ' + testo(nomeAdmin()) + ' con l’agenzia. Se qualcosa non torna, diglielo prima che parta.'));
      }
    });
  };

  /**
   * "Prepara mail per Studio Corvasce": nessuna mail parte dal server.
   * - Telefono: si apre Condividi con il PDF gia' allegato; si sceglie Gmail (bozza pronta),
   *   l'indirizzo e' gia' copiato e si incolla.
   * - Computer: si scarica il PDF e si apre Gmail (quello in cui si e' entrati) con la bozza
   *   gia' indirizzata, oggetto e testo: resta da trascinare dentro il PDF appena scaricato.
   * Il file si prepara subito: Safari apre Condividi solo se lo si chiama al tocco, senza attese.
   */
  function bottoneMail(d, href) {
    var c = d.commercialista, nomeFile = 'Presenze ' + d.titolo.toUpperCase() + '.pdf';
    var oggetto = 'Presenze ' + d.titolo.toUpperCase() + ' - ' + (d.ditta || 'GAMA');
    var corpo = 'Buongiorno,\nin allegato il documento presenze di ' + d.titolo + ' (griglia del mese, riepilogo e trasferte).\n\n' +
      'Cordiali saluti,\n' + S.utente;
    var telefono = iPhone() || /android/i.test(navigator.userAgent);
    var file = null;
    fetch(href, { cache: 'no-store' }).then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) {
      if (b && window.File) file = new File([b], nomeFile, { type: 'application/pdf' });
    }, function () { /* senza campo: al tocco si scarica e basta */ });

    var b = bottone('scarica', '<span class="icona">' + ico('invia') + '</span><span><b>Prepara mail per ' + testo(c.nome) + '</b>' +
      '<span>' + testo(c.email) + (telefono ? ' · si apre Condividi con il PDF' : ' · si apre Gmail con la bozza') + '</span></span>' + ico('avanti', 'dx'), function () {
      try { if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(c.email).catch(function () {}); } catch (e) { /* non importa */ }
      if (telefono && file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: oggetto, text: corpo }).catch(function (e) {
          if (!e || e.name !== 'AbortError') avvisa('Condividi non si è aperto: scarica il PDF e mandalo a ' + c.email + '.', 1);
        });
        avvisa('Scegli Gmail e come destinatario incolla ' + c.email + ' (è già copiato).');
        return;
      }
      var giu = el('a'); giu.href = href; giu.setAttribute('download', nomeFile);
      document.body.appendChild(giu); giu.click(); giu.remove();
      window.open('https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(c.email) +
        '&su=' + encodeURIComponent(oggetto) + '&body=' + encodeURIComponent(corpo), '_blank', 'noopener');
      avvisa('PDF scaricato e bozza aperta in Gmail: trascina dentro il file ' + nomeFile + '.');
    });
    b.style.marginTop = '10px';
    return b;
  }

  // ------------------------------------------------------------------ compenso extra
  VISTE.extra = function () {
    var mio = turno;
    intesta('Compenso extra', '', true); fondo(null); sagoma('lista');
    carica('extra').then(function (d) {
      if (mio !== turno) return;
      if (!d) { tornaHome(); return; }
      intesta('Compenso extra', 'mese di ' + d.mese, true);
      var s = schermo();
      if (!d.dipendenti.length) { s.appendChild(nota('giallo', 'avviso', testo(S.avviso || 'Nessun dipendente nella tua squadra.'))); return; }
      s.appendChild(el('p', 'aiuto', 'A chi va il compenso? Poi scrivi la cifra.'));
      var lista = el('div', 'lista');
      d.dipendenti.forEach(function (nome) {
        var gia = d.gia.filter(function (x) { return x.nome === nome; })[0];
        var b = bottone('riga', avatar(nome) + '<span class="nome">' + testo(nome) + '</span>' +
          (gia ? '<span class="pill">' + euro(gia.importo) + '</span>' : '') + ico('avanti', 'i-s freccia'),
          function () { vai('moduloExtra', nome); });
        if (gia) b.setAttribute('data-s', 'MEZ');
        lista.appendChild(b);
      });
      s.appendChild(lista);
    });
  };

  VISTE.moduloExtra = function (nome) {
    if (!nome) { tornaHome(); return; }
    intesta('Compenso extra', nome, true);
    var s = schermo();
    var c = el('div', 'campo', '<label for="cifra">Quanto in più a ' + testo(nome) + '?</label>' +
      '<div class="importo"><span>€</span><input id="cifra" type="text" inputmode="decimal" autocomplete="off" placeholder="0"></div>');
    s.appendChild(c);
    var r = el('div', 'rapidi');
    function evidenzia() {
      var v = Number(String($('cifra').value).replace(',', '.'));
      Array.prototype.forEach.call(r.children, function (b) { b.setAttribute('aria-pressed', Number(b.dataset.v) === v ? 'true' : 'false'); });
    }
    [50, 100, 150, 200].forEach(function (v) {
      var b = bottone(null, v + ' €', function () { $('cifra').value = v; vibra(); evidenzia(); });
      b.dataset.v = v;
      r.appendChild(b);
    });
    s.appendChild(r);
    s.appendChild(el('div', 'campo', '<label for="nota">Nota (facoltativa)</label>' +
      '<input id="nota" type="text" maxlength="200" placeholder="es. ore extra sabato">'));
    fondo('<button class="grosso" id="salvaExtra" type="button">' + ico('euro') + 'Registra il compenso</button>');
    $('cifra').focus();
    $('cifra').addEventListener('input', evidenzia);
    $('salvaExtra').addEventListener('click', function () {
      var v = Number(String($('cifra').value).replace(/\s|€/g, '').replace(',', '.'));
      if (!(v > 0)) { avvisa('Scrivi una cifra maggiore di zero.', 1); return; }
      var b = this; b.disabled = true;
      azione('salvaExtra', { dipendente: nome, importo: v, nota: $('nota').value }).then(function (x) {
        b.disabled = false;
        if (!x.ok) { avvisa(x.errore, 1); return; }
        Promise.all([mostraSuccesso('Compenso registrato', nome + ' · ' + euro(v)), aggiornaHomeDiNascosto(true)]).then(tornaHome);
      });
    });
  };

  // ------------------------------------------------------------------ dipendenti
  VISTE.dipendenti = function () {
    var mio = turno;
    intesta('Dipendenti', '', true); fondo(null); sagoma('lista');
    carica('dipendenti').then(function (d) {
      if (mio !== turno) return;
      if (!d) { tornaHome(); return; }
      S.organico = d; disegnaOrganico();
    });
  };

  function disegnaOrganico() {
    var d = S.organico;
    var attivi = d.filter(function (x) { return x.attivo; }).length;
    intesta('Dipendenti', attivi + ' attivi su ' + d.length + (S.tutto ? '' : ' · ' + S.ambito), true);
    var s = schermo();
    if (!S.tutto) {
      s.appendChild(nota('grigio', 'info', 'Qui vedi solo la squadra <b>' + testo(S.ambito) + '</b>. ' +
        'Per cambiare squadra o ruolo a una persona contatta ' + testo(nomeAdmin()) + '.'));
    }
    if (!d.length && S.avviso) s.appendChild(nota('giallo', 'avviso', testo(S.avviso)));
    if (S.tutto && d.some(function (x) { return x.attivo && !x.squadra; })) {
      s.appendChild(nota('giallo', 'avviso', 'Chi è <b>senza squadra</b> non compare nell’appello di nessun socio: tocca la sua etichetta per assegnarlo.'));
    }
    s.appendChild(el('p', 'aiuto', 'L’interruttore dice se lavora con voi. Chi non è attivo esce dall’appello, ma le sue presenze passate restano.'));

    var lista = el('div', 'lista'), ultima = null;
    d.forEach(function (x) {
      if (S.tutto && (x.squadra || '') !== ultima) {
        ultima = x.squadra || '';
        lista.appendChild(el('div', 'gruppo', ultima ? testo(ultima) : 'Senza squadra'));
      }
      var r = el('div', 'riga statica' + (x.attivo ? '' : ' spenta'));
      r.setAttribute('data-s', x.attivo ? 'ORD' : 'ASS');
      r.innerHTML = avatar(x.nome);
      var nomeEl = el('div', 'nome', testo(x.nome));
      if (x.attivo) {
        nomeEl.appendChild(el('br'));
        var cb = bottone('cambia' + (x.cantiere ? '' : ' vuota'), ico('cantiere', 'i-xs') + testo(x.cantiere || 'senza cantiere'), function () {
          if (!S.tutto) { avvisa('Il cantiere lo assegnano ' + testo(nomeAdmin()) + ' e l’agenzia.'); return; }
          sceltaCantiere(x.nome, null, function (r) { if (r.ok) { x.cantiere = r.cantiere; disegnaOrganico(); } });
        });
        nomeEl.appendChild(cb);
      }
      if (S.tutto) {
        nomeEl.appendChild(el('br'));
        nomeEl.appendChild(bottone('cambia' + (x.squadra ? '' : ' vuota'), ico('scambia', 'i-xs') + testo(etichettaSq(x.squadra)), function () {
          var i = S.squadre.indexOf(x.squadra);
          var prossima = i < 0 ? S.squadre[0] : (i + 1 < S.squadre.length ? S.squadre[i + 1] : '');
          azione('cambiaSquadra', { nome: x.nome, squadra: prossima }).then(function (e) {
            if (!e.ok) { avvisa(e.errore, 1); return; }
            x.squadra = prossima; vibra(); avvisa(e.messaggio); disegnaOrganico();
          });
        }));
      }
      r.appendChild(nomeEl);
      var sw = bottone('interruttore', '', function () {
        azione('cambiaAttivo', { nome: x.nome, attivo: !x.attivo }).then(function (e) {
          if (!e.ok) { avvisa(e.errore, 1); return; }
          x.attivo = !x.attivo; vibra(); avvisa(e.messaggio); disegnaOrganico();
        });
      });
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-checked', x.attivo ? 'true' : 'false');
      sw.setAttribute('aria-label', x.nome + (x.attivo ? ': attivo' : ': non attivo'));
      r.appendChild(sw);
      lista.appendChild(r);
    });
    s.appendChild(lista);
    fondo('<button class="grosso blu" id="nuovo" type="button">' + ico('piu') + 'Aggiungi un dipendente</button>');
    $('nuovo').addEventListener('click', function () { vai('nuovoDipendente'); });
  }

  // ------------------------------------------------------------------ cantieri (amministratore e agenzia)
  function meseOggi() { return S.oggi.slice(0, 4) + '-' + S.oggi.slice(4, 6); }

  /** Il pannello dal basso con l'elenco dei cantieri attivi: sceglie e salva subito. */
  function sceltaCantiere(nome, mese, fatto) {
    mese = mese || meseOggi();
    carica('cantieri', mese).then(function (d) {
      if (!d) return;
      var attivi = d.elenco.filter(function (c) { return c.attivo; });
      var io = d.dipendenti.filter(function (x) { return x.nome === nome; })[0];
      var attuale = io && io.cantiere ? io.cantiere.id : null;
      var prima = document.activeElement;
      var fondale = el('div', 'pannello-ore');
      var p = el('div', 'pannello', '<h2 id="pannelloTit">Cantiere di ' + testo(d.nome) + '</h2><p>' + testo(nome) + '</p>');
      p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); p.setAttribute('aria-labelledby', 'pannelloTit');
      function chiudi() { document.removeEventListener('keydown', tasto); fondale.remove(); if (prima && prima.focus) prima.focus(); }
      function tasto(e) { if (e.key === 'Escape') chiudi(); }
      function scegli(id) {
        chiudi();
        azione('assegnaCantiere', { nome: nome, mese: mese, cantiere: id }).then(function (r) {
          if (!r.ok) { avvisa(r.errore, 1); return; }
          vibra(); avvisa(r.messaggio);
          var ora = r.dati.dipendenti.filter(function (x) { return x.nome === nome; })[0];
          fatto({ ok: true, cantiere: ora && ora.cantiere ? ora.cantiere.nome : '', dati: r.dati });
        });
      }
      var lista = el('div', 'lista-cantieri');
      if (!attivi.length) lista.appendChild(el('p', 'aiuto', 'Non c’è ancora nessun cantiere: aggiungilo dalla schermata <b>Cantieri</b>.'));
      attivi.forEach(function (c) {
        var b = bottone(c.id === attuale ? 'scelta' : null, ico('cantiere', 'i-s') + testo(c.nome), function () { scegli(c.id); });
        lista.appendChild(b);
      });
      p.appendChild(lista);
      p.appendChild(bottone('annulla', 'Annulla', chiudi));
      fondale.appendChild(p);
      fondale.addEventListener('click', function (e) { if (e.target === fondale) chiudi(); });
      document.addEventListener('keydown', tasto);
      document.body.appendChild(fondale);
      var primo = lista.querySelector('button'); if (primo) primo.focus();
    });
  }

  VISTE.cantieri = function (mese) {
    if (!S.tutto) { tornaHome(); return; }
    mese = mese || meseOggi();
    var mio = turno;
    intesta('Cantieri', '', true); fondo(null); sagoma('lista');
    carica('cantieri', mese).then(function (d) {
      if (mio !== turno) return;
      if (!d) { tornaHome(); return; }
      disegnaCantieri(d);
    });
  };

  function disegnaCantieri(d) {
    intesta('Cantieri', maiuscola(d.titolo), true);
    var s = schermo();

    var p = el('div', 'pillole');
    d.mesi.forEach(function (m) {
      var b = bottone(null, maiuscola(m.nome), function () {
        history.replaceState({ vista: 'cantieri', param: m.mese, d: (history.state && history.state.d) || 1 }, '', location.pathname);
        turno++; VISTE.cantieri(m.mese);
      });
      b.setAttribute('aria-pressed', m.mese === d.mese ? 'true' : 'false');
      p.appendChild(b);
    });
    s.appendChild(p);

    var senza = d.dipendenti.filter(function (x) { return !x.cantiere; }).length;
    if (d.conferma) {
      var quando = d.conferma.quando.slice(8, 10) + '/' + d.conferma.quando.slice(5, 7) + ' alle ' + d.conferma.quando.slice(11, 16);
      s.appendChild(nota(d.conferma.modificatoDopo ? 'giallo' : 'verde', d.conferma.modificatoDopo ? 'avviso' : 'spunta',
        'Confermati da <b>' + testo(d.conferma.da) + '</b> il ' + testo(quando) + '.' +
        (d.conferma.modificatoDopo ? ' Poi ' + testo(d.conferma.modificatoDopo) + ' ha cambiato qualcosa: controlla e conferma di nuovo.' : '')));
    } else {
      s.appendChild(nota('giallo', 'avviso', '<b>Da confermare.</b> Controlla dove lavora ognuno a ' + testo(d.nome) +
        ' e conferma in fondo. Chi non è cambiato tiene il cantiere del mese prima.'));
    }
    if (senza) s.appendChild(nota('rosso', 'avviso', '<b>' + senza + (senza === 1 ? ' persona' : ' persone') + ' senza cantiere</b>: sono in cima.'));

    s.appendChild(sezione('Chi lavora dove'));
    var lista = el('div', 'lista');
    d.dipendenti.forEach(function (x) {
      var b = bottone('riga',
        avatar(x.nome) + '<span class="nome">' + testo(x.nome) +
        '<small>' + (x.cantiere ? testo(x.cantiere.nome) + (x.cantiere.ereditato ? ' · come il mese prima' : '') : 'senza cantiere') + '</small></span>' +
        ico('avanti', 'i-s freccia'),
        function () { sceltaCantiere(x.nome, d.mese, function (r) { if (r.ok) disegnaCantieri(r.dati); }); });
      b.setAttribute('data-s', x.cantiere ? 'ORD' : 'ASS');
      lista.appendChild(b);
    });
    s.appendChild(lista);

    s.appendChild(sezione('Elenco dei cantieri'));
    var el2 = el('div', 'lista');
    d.elenco.forEach(function (c) {
      var r = el('div', 'riga statica' + (c.attivo ? '' : ' spenta'));
      r.setAttribute('data-s', c.attivo ? 'ORD' : 'ASS');
      r.innerHTML = '<span class="avatar">' + ico('cantiere', 'i-s') + '</span><span class="nome">' + testo(c.nome) + '</span>';
      var sw = bottone('interruttore', '', function () {
        azione('attivaCantiere', { id: c.id, attivo: !c.attivo }).then(function (e) {
          if (!e.ok) { avvisa(e.errore, 1); return; }
          vibra(); avvisa(e.messaggio); turno++; VISTE.cantieri(d.mese);
        });
      });
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-checked', c.attivo ? 'true' : 'false');
      sw.setAttribute('aria-label', c.nome + (c.attivo ? ': attivo' : ': non attivo'));
      r.appendChild(sw);
      el2.appendChild(r);
    });
    s.appendChild(el2);
    s.appendChild(el('div', 'campo', '<label for="nuovoCantiere">Nuovo cantiere</label>' +
      '<input id="nuovoCantiere" type="text" maxlength="60" placeholder="es. Via Roma - Bari" autocomplete="off">'));
    s.appendChild(bottone('grosso blu', ico('piu') + 'Aggiungi il cantiere', function () {
      var v = String($('nuovoCantiere').value || '').trim();
      if (v.length < 2) { avvisa('Scrivi il nome del cantiere.', 1); return; }
      azione('nuovoCantiere', { nome: v }).then(function (e) {
        if (!e.ok) { avvisa(e.errore, 1); return; }
        vibra(); avvisa(e.messaggio); turno++; VISTE.cantieri(d.mese);
      });
    }));

    fondo('<button class="grosso" id="conferma" type="button">' + ico('spunta') + 'Conferma i cantieri di ' + testo(d.nome) + '</button>');
    $('conferma').addEventListener('click', function () {
      var b = this; b.disabled = true;
      azione('confermaCantieri', { mese: d.mese }).then(function (e) {
        b.disabled = false;
        if (!e.ok) { avvisa(e.errore, 1); return; }
        mostraSuccesso('Cantieri confermati', maiuscola(d.titolo)).then(function () {
          disegnaCantieri(e.dati);
          aggiornaHomeDiNascosto(true);
        });
      });
    });
  }

  function scelte(opzioni, scelta, quando) {
    var p = el('div', 'scelte');
    opzioni.forEach(function (o) {
      var b = bottone(null, ico(o.icona || 'persone') + testo(o.etichetta), function () {
        Array.prototype.forEach.call(p.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        vibra(); quando(o.valore);
      });
      b.setAttribute('aria-pressed', o.valore === scelta ? 'true' : 'false');
      p.appendChild(b);
    });
    return p;
  }

  VISTE.nuovoDipendente = function () {
    intesta('Nuovo dipendente', S.tutto ? '' : S.ambito, true);
    var s = schermo();
    s.appendChild(el('div', 'campo', '<label for="nuovoNome">Cognome e nome</label>' +
      '<input id="nuovoNome" type="text" placeholder="ROSSI MARIO" autocapitalize="characters" autocomplete="off">'));
    s.appendChild(el('p', 'aiuto', 'Sul foglio comparirà nella forma breve, per esempio <b>ROSSI M.</b>' +
      (S.tutto ? '' : ' Entra nella squadra <b>' + testo(S.ambito) + '</b>.')));
    var sqScelta = S.tutto ? S.squadre[0] : S.squadra;
    if (S.tutto) {
      s.appendChild(sezione('In quale squadra'));
      s.appendChild(scelte(S.squadre.map(function (sq) { return { etichetta: etichettaSq(sq), valore: sq }; }), sqScelta,
        function (v) { sqScelta = v; }));
    }
    fondo('<button class="grosso" id="salvaDip" type="button">' + ico('piu') + 'Aggiungi</button>');
    $('nuovoNome').focus();
    $('salvaDip').addEventListener('click', function () {
      var v = String($('nuovoNome').value || '').trim();
      if (v.length < 4 || v.indexOf(' ') < 0) { avvisa('Serve cognome e nome, per esempio ROSSI MARIO.', 1); return; }
      var b = this; b.disabled = true;
      azione('nuovoDipendente', { completo: v, squadra: sqScelta }).then(function (r) {
        b.disabled = false;
        if (!r.ok) { avvisa(r.errore, 1); return; }
        mostraSuccesso('Aggiunto', r.nome + (r.squadra ? ' · ' + etichettaSq(r.squadra) : '')).then(function () { history.back(); });
      });
    });
  };

  // ------------------------------------------------------------------ chi usa l'app (amministratore)
  function conConferma(b, etichettaConferma, quando) {
    var originale = b.innerHTML, armato = false, t;
    b.addEventListener('click', function () {
      if (!armato) {
        armato = true; b.innerHTML = etichettaConferma; b.classList.add('attenzione'); vibra();
        t = setTimeout(function () { armato = false; b.innerHTML = originale; b.classList.remove('attenzione'); }, 3500);
        return;
      }
      clearTimeout(t); armato = false; b.innerHTML = originale; b.classList.remove('attenzione');
      quando();
    });
    return b;
  }

  function copiaLink(link) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(link).then(function () { avvisa('Link copiato: incollalo in un messaggio.'); },
        function () { mostraLink(link); });
    }
    mostraLink(link);
    return Promise.resolve();
  }
  function mostraLink(link) {
    var s = $('schermo');
    var box = el('div', 'campo', '<label>Link personale: tieni premuto per copiarlo</label>');
    var i = el('input'); i.value = link; i.readOnly = true;
    box.appendChild(i); s.insertBefore(box, s.firstChild); i.select();
  }
  function whatsapp(nome, link) {
    var msg = 'Ciao ' + nome + ', questo è il tuo link personale per Presenze GAMA: ' + link +
      '\nAprilo dal telefono e mettilo sulla schermata Home. Non darlo a nessuno.';
    location.href = 'https://wa.me/?text=' + encodeURIComponent(msg);
  }

  VISTE.utenti = function () {
    if (!S.admin) { tornaHome(); return; }
    var mio = turno;
    intesta('Chi usa l’app', '', true); fondo(null); sagoma('lista');
    carica('utenti').then(function (lista) {
      if (mio !== turno) return;
      if (!lista) { tornaHome(); return; }
      intesta('Chi usa l’app', lista.filter(function (u) { return u.attivo; }).length + ' attivi', true);
      var s = schermo();
      s.appendChild(el('p', 'aiuto', 'Ognuno entra con il suo <b>link personale</b>. Se un link finisce nelle mani sbagliate, crea un <b>nuovo link</b>: quello vecchio smette subito di funzionare.'));

      lista.forEach(function (u) {
        var c = el('section', 'carta utente' + (u.attivo ? '' : ' spento'));
        var ruolo = u.admin ? 'Amministratore' : u.agenzia ? 'Agenzia' : (u.squadra ? etichettaSq(u.squadra) : 'senza squadra');
        c.appendChild(el('div', 'u-testa', avatar(u.nome) +
          '<span class="u-nome">' + testo(u.nome) + (u.nome === S.utente ? ' <small>sei tu</small>' : '') + '</span>' +
          '<span class="badge' + (u.admin || u.agenzia ? ' admin' : '') + '">' + testo(ruolo) + '</span>'));
        c.appendChild(el('div', 'u-info',
          (u.attivo ? '' : '<span>' + ico('chiudi', 'i-xs') + 'non attivo</span>') +
          '<span>' + ico('orologio', 'i-xs') + (u.ultimoAccesso ? 'ultimo accesso ' + testo(u.ultimoAccesso.slice(8, 10) + '/' + u.ultimoAccesso.slice(5, 7) + ' ' + u.ultimoAccesso.slice(11, 16)) : 'non ha ancora aperto l’app') + '</span>' +
          '<span>' + ico(u.notifiche ? 'campana' : 'campanaNo', 'i-xs') + (u.notifiche ? 'notifiche su ' + u.notifiche + (u.notifiche === 1 ? ' telefono' : ' telefoni') : 'notifiche spente') + '</span>'));

        var az = el('div', 'u-azioni');
        if (u.attivo) {
          az.appendChild(bottone('mini', ico('messaggio') + 'WhatsApp', function () { whatsapp(u.nome, u.link); }));
          az.appendChild(bottone('mini', ico('copia') + 'Copia link', function () { copiaLink(u.link); }));
          if (!u.admin && !u.agenzia) {
            az.appendChild(bottone('mini', ico('scambia') + testo(etichettaSq(u.squadra)), function () {
              var i = S.squadre.indexOf(u.squadra);
              var prossima = S.squadre[(i + 1) % S.squadre.length];
              azione('aggiornaUtente', { id: u.id, squadra: prossima }).then(function (r) {
                avvisa(r.ok ? r.messaggio : r.errore, !r.ok); if (r.ok) { turno++; VISTE.utenti(); }
              });
            }));
          }
          az.appendChild(conConferma(bottone('mini', ico('rinnova') + 'Nuovo link'), ico('avviso') + 'Tocca ancora: il vecchio smette', function () {
            azione('rigeneraLink', { id: u.id }).then(function (r) {
              if (!r.ok) { avvisa(r.errore, 1); return; }
              if (r.propria) { avvisa('Il tuo link è cambiato: ti porto su quello nuovo.'); setTimeout(function () { location.href = r.link; }, 1200); return; }
              avvisa(r.messaggio); turno++; VISTE.utenti();
            });
          }));
        }
        if (u.nome !== S.utente) {
          az.appendChild(conConferma(bottone('mini', ico(u.attivo ? 'chiudi' : 'spunta') + (u.attivo ? 'Disattiva' : 'Riattiva')), ico('avviso') + 'Tocca ancora per confermare', function () {
            azione('aggiornaUtente', { id: u.id, attivo: !u.attivo }).then(function (r) {
              avvisa(r.ok ? r.messaggio : r.errore, !r.ok); if (r.ok) { turno++; VISTE.utenti(); }
            });
          }));
        }
        c.appendChild(az);
        s.appendChild(c);
      });

      fondo('<button class="grosso blu" id="nuovoUtente" type="button">' + ico('piu') + 'Aggiungi una persona (socio o agenzia)</button>');
      $('nuovoUtente').addEventListener('click', function () { vai('nuovoUtente'); });
    });
  };

  VISTE.nuovoUtente = function () {
    if (!S.admin) { tornaHome(); return; }
    intesta('Nuova persona', '', true);
    var s = schermo();
    s.appendChild(el('div', 'campo', '<label for="nomeUtente">Nome</label><input id="nomeUtente" type="text" placeholder="Matteo" autocomplete="off">'));
    s.appendChild(sezione('Cosa vede'));
    var scelta = S.squadre[0];
    var opzioni = S.squadre.map(function (sq) { return { etichetta: etichettaSq(sq), valore: sq }; });
    opzioni.push({ etichetta: 'Agenzia', valore: '__AGENZIA__', icona: 'foglio' });
    opzioni.push({ etichetta: 'Amministratore', valore: '__ADMIN__', icona: 'scudo' });
    s.appendChild(scelte(opzioni, scelta, function (v) { scelta = v; }));
    s.appendChild(el('p', 'aiuto', 'Un socio vede solo la <b>sua squadra</b>. L’<b>agenzia</b> vede e corregge tutte le squadre, gestisce i dipendenti e scarica il foglio, ma non vede utenti e link. L’amministratore vede e modifica tutto.'));
    fondo('<button class="grosso" id="salvaUtente" type="button">' + ico('piu') + 'Crea il suo link</button>');
    $('nomeUtente').focus();
    $('salvaUtente').addEventListener('click', function () {
      var nome = String($('nomeUtente').value || '').trim();
      if (nome.length < 2) { avvisa('Scrivi il nome.', 1); return; }
      var b = this; b.disabled = true;
      var carico = scelta === '__ADMIN__' ? { nome: nome, admin: true }
        : scelta === '__AGENZIA__' ? { nome: nome, agenzia: true } : { nome: nome, squadra: scelta };
      azione('nuovoUtente', carico).then(function (r) {
        b.disabled = false;
        if (!r.ok) { avvisa(r.errore, 1); return; }
        intesta('Nuova persona', nome, true);
        var s2 = schermo();
        s2.appendChild(el('section', 'carta stato-grande ok', '<div class="cerchio">' + ico('spunta') + '</div>' +
          '<h2>' + testo(nome) + ' può entrare</h2><p>Mandagli il suo link personale.</p>'));
        var az = el('div', 'azioni');
        az.appendChild(bottone('azione', '<span class="icona">' + ico('messaggio') + '</span><span class="testo">Manda il link su WhatsApp<small>si apre WhatsApp con il messaggio già scritto</small></span>',
          function () { whatsapp(nome, r.link); }));
        az.appendChild(bottone('azione', '<span class="icona">' + ico('copia') + '</span><span class="testo">Copia il link<small>per mandarlo in un altro modo</small></span>',
          function () { copiaLink(r.link); }));
        s2.appendChild(az);
        fondo('<button class="grosso blu" id="fatto" type="button">Fatto</button>');
        $('fatto').addEventListener('click', function () { history.back(); });
      });
    });
  };

  // ------------------------------------------------------------------ installazione sulla schermata Home
  var richiestaInstallazione = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); richiestaInstallazione = e; });

  function installata() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function iPhone() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }

  VISTE.installa = function () {
    intesta('Schermata Home', 'un tocco e sei dentro', true); fondo(null);
    var s = schermo();
    if (installata()) {
      s.appendChild(el('section', 'carta stato-grande ok', '<div class="cerchio">' + ico('spunta') + '</div><h2>Già installata</h2><p>Aprila sempre dall’icona Presenze.</p>'));
      return;
    }
    s.appendChild(el('section', 'carta stato-grande', '<div class="cerchio">' + ico('telefono') + '</div>' +
      '<h2>Come un’app vera</h2><p>Un’icona sulla schermata Home, si apre a tutto schermo e manda le notifiche.</p>'));
    if (richiestaInstallazione) {
      var az = el('div', 'azioni');
      az.appendChild(bottone('azione', '<span class="icona">' + ico('scarica') + '</span><span class="testo">Installa Presenze GAMA<small>compare tra le app, con la sua icona</small></span>', function () {
        richiestaInstallazione.prompt();
        richiestaInstallazione.userChoice.then(function () { richiestaInstallazione = null; turno++; VISTE.installa(); });
      }));
      s.appendChild(az);
      return;
    }
    var passi = iPhone()
      ? ['Apri questo link con <b>Safari</b> (da WhatsApp: tocca i tre puntini e scegli "Apri in Safari")',
         'Tocca <b>Condividi</b> ' + ico('condividi', 'i-xs') + ' in basso',
         'Scorri e scegli <b>Aggiungi alla schermata Home</b>, poi <b>Aggiungi</b>',
         'Da ora apri l’app dall’icona <b>Presenze</b>']
      : ['Apri questo link con <b>Chrome</b> (da WhatsApp: tre puntini → "Apri in Chrome")',
         'Tocca i <b>tre puntini ⋮</b> in alto a destra',
         'Scegli <b>Installa app</b> oppure <b>Aggiungi a schermata Home</b>',
         'Da ora apri l’app dall’icona <b>Presenze</b>'];
    var ol = el('ol', 'passi');
    passi.forEach(function (p) { ol.appendChild(el('li', null, p)); });
    s.appendChild(ol);
    s.appendChild(nota('grigio', 'scudo', 'Il link è <b>personale</b>: chi lo apre entra a nome tuo. Non inoltrarlo.'));
  };

  // ------------------------------------------------------------------ notifiche
  function notificheSupportate() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }

  // Lo stato vero si chiede al telefono, non a un appunto salvato: dopo un nuovo link
  // o un permesso tolto, l'appunto mentirebbe.
  var iscritto = false;
  function controllaIscrizione() {
    if (!notificheSupportate()) return Promise.resolve();
    return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      iscritto = !!sub && Notification.permission === 'granted';
      // si riallinea il server: se il link e' cambiato, l'iscrizione passa al nuovo
      if (iscritto) chiama('api/notifiche/iscrivi', { iscrizione: sub.toJSON(), dispositivo: dispositivo() });
    }).catch(function () { /* senza service worker: niente notifiche */ });
  }

  function statoNotificheTesto() {
    if (!notificheSupportate()) return iPhone() && !installata() ? 'dopo averla messa sulla Home' : 'non disponibili qui';
    if (Notification.permission === 'denied') return 'bloccate dal telefono';
    return iscritto ? 'attive su questo telefono' : 'da attivare: promemoria delle 18';
  }
  function chiaveApplicazione(base64) {
    var pad = '='.repeat((4 - base64.length % 4) % 4);
    var raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function attivaNotifiche() {
    if (!notificheSupportate()) { avvisa('Questo telefono non supporta le notifiche dell’app.', 1); return; }
    velo(true);
    Notification.requestPermission().then(function (permesso) {
      if (permesso !== 'granted') { velo(false); avvisa('Permesso non dato: senza, le notifiche non arrivano.', 1); turno++; VISTE.notifiche(); return null; }
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription().then(function (vecchia) {
          return vecchia || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveApplicazione(S.vapid) });
        });
      }).then(function (iscrizione) {
        return chiama('api/notifiche/iscrivi', { iscrizione: iscrizione.toJSON(), dispositivo: dispositivo() });
      }).then(function (r) {
        velo(false);
        if (!r.ok) { avvisa(r.errore, 1); return; }
        iscritto = true;
        vibra([14, 70, 14]);
        avvisa(r.messaggio);
        turno++; VISTE.notifiche();
      });
    }).catch(function () { velo(false); avvisa('Non sono riuscito ad attivarle. Riprova tra poco.', 1); });
  }

  function spegniNotifiche() {
    navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (!sub) return null;
      return chiama('api/notifiche/togli', { endpoint: sub.endpoint }).then(function () { return sub.unsubscribe(); });
    }).then(function () { iscritto = false; avvisa('Notifiche spente su questo telefono.'); turno++; VISTE.notifiche(); });
  }

  function dispositivo() {
    var ua = navigator.userAgent;
    if (/iphone/i.test(ua)) return 'iPhone';
    if (/ipad/i.test(ua)) return 'iPad';
    var m = ua.match(/Android[^;)]*;\s*([^;)]+)/);
    return m ? 'Android ' + m[1].trim() : (/android/i.test(ua) ? 'Android' : 'computer');
  }

  VISTE.notifiche = function () {
    intesta('Notifiche', '', true); fondo(null);
    var s = schermo();
    var attive = iscritto && notificheSupportate() && Notification.permission === 'granted';
    s.appendChild(el('section', 'carta stato-grande' + (attive ? ' ok' : ' no'),
      '<div class="cerchio">' + ico(attive ? 'campana' : 'campanaNo') + '</div>' +
      '<h2>' + (attive ? 'Notifiche attive' : 'Notifiche spente') + '</h2>' +
      '<p>Alle <b>18:00</b> se l’appello manca, la <b>domenica sera</b> il riepilogo, il <b>primo del mese</b> il mese chiuso. Gratis.</p>'));

    if (!notificheSupportate()) {
      s.appendChild(nota('giallo', 'avviso', iPhone() && !installata()
        ? 'Su iPhone le notifiche si attivano solo dall’app sulla <b>schermata Home</b>. Mettila lì, aprila dall’icona e torna qui.'
        : 'Questo telefono o questo browser non supporta le notifiche dell’app. Prova ad aprire il link con Chrome.'));
      if (!installata()) {
        var a0 = el('div', 'azioni');
        a0.appendChild(bottone('azione', '<span class="icona">' + ico('telefono') + '</span><span class="testo">Come metterla sulla schermata Home</span>' + ico('avanti', 'i-s'), function () { vai('installa'); }));
        s.appendChild(a0);
      }
      return;
    }
    if (Notification.permission === 'denied') {
      s.appendChild(nota('giallo', 'avviso', 'Le notifiche sono <b>bloccate</b>. Per sbloccarle: impostazioni del telefono → app → Presenze → Notifiche: consenti. Poi torna qui.'));
      return;
    }
    var az = el('div', 'azioni');
    if (!attive) {
      az.appendChild(bottone('azione', '<span class="icona">' + ico('campana') + '</span><span class="testo">Attiva le notifiche<small>il telefono chiederà il permesso: tocca Consenti</small></span>', attivaNotifiche));
    } else {
      az.appendChild(bottone('azione', '<span class="icona">' + ico('invia') + '</span><span class="testo">Manda una notifica di prova<small>per vedere se arriva</small></span>', function () {
        chiama('api/notifiche/prova', {}).then(function (r) { avvisa(r.ok ? r.messaggio : r.errore, !r.ok); });
      }));
      az.appendChild(bottone('azione', '<span class="icona">' + ico('rinnova') + '</span><span class="testo">Riattiva su questo telefono<small>se hanno smesso di arrivare</small></span>', attivaNotifiche));
      az.appendChild(bottone('azione', '<span class="icona">' + ico('campanaNo') + '</span><span class="testo">Spegni le notifiche<small>solo su questo telefono</small></span>', spegniNotifiche));
    }
    s.appendChild(az);
  };

  // ------------------------------------------------------------------ avvio
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () { /* senza: niente notifiche, il resto va */ });
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.apri !== undefined) apriPercorso(e.data.apri);
    });
  }

  // Se l'app resta aperta in sottofondo fino al giorno dopo, si ricarica da sola:
  // "oggi" deve essere sempre oggi.
  function codiceOggi() { var d = new Date(); return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && codiceOggi() !== S.oggi) location.reload();
  });

  var percorsoIniziale = location.hash;          // da una notifica: "#appello/20261013"
  S.appelloOggi = copia(S.appello);
  history.replaceState({ vista: 'home', d: 0 }, '', location.pathname);
  mostra({ vista: 'home' });
  if (percorsoIniziale) apriPercorso(percorsoIniziale);
  inviaSospese(false);
  controllaIscrizione().then(function () { if (suHome()) { turno++; VISTE.home(); } });
})();
