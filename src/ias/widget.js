(function () {
  // ---- MONTAGGIO ---------------------------------------------------------
  // In pagina c'è solo <div id="ias-widget" data-sitekey="...">: CSS e markup
  // arrivano da qui (__CSS__ e __MARKUP__ li sostituisce la build, vedi build.mjs).
  var root = document.getElementById("ias-widget");
  if (!root) { console.warn("Widget IAS: manca <div id=\"ias-widget\"> nella pagina."); return; }
  if (root.getAttribute("data-fdt-montato")) return;   // script incluso due volte: si monta una volta sola
  root.setAttribute("data-fdt-montato", "1");
  if (!document.getElementById("fdt-ias-css")) {
    var stile = document.createElement("style");
    stile.id = "fdt-ias-css";
    stile.textContent = __CSS__;
    document.head.appendChild(stile);
  }
  root.innerHTML = __MARKUP__;
  // Turnstile (render esplicito) si carica da qui, solo se la pagina non lo carica già
  // (es. un altro form con Turnstile nella stessa pagina): mai due copie dello script.
  if (!window.turnstile && !document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]')) {
    var ts = document.createElement("script");
    ts.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    ts.async = true;
    document.head.appendChild(ts);
  }

  // ---- CONFIGURAZIONE (invariata dalla v1, tranne la site key) -----------
  var WEBHOOK_URL = "https://api.fdt.digital/webhook/report-ias";
  // Site key pubblica di Turnstile: si legge dall'attributo data-sitekey del contenitore,
  // così si cambia dalla pagina WP senza rilasciare una nuova versione.
  var TURNSTILE_SITE_KEY = (root.getAttribute("data-sitekey") || "").trim();
  var TURNSTILE_DA_CONFIGURARE = !TURNSTILE_SITE_KEY || TURNSTILE_SITE_KEY.indexOf("__") === 0;
  var VERSIONE_DOMANDE = "ias-plugin-3.7";
  // Domini gratuiti rifiutati (stessa lista di n8n, comune ai 3 report; D8 aggiunge i provider
  // italiani): blocco PRIMA delle domande. È solo UX: il controllo vero lo fa n8n.
  var DOMINI_GRATUITI = ["gmail.com","hotmail.com","yahoo.com","outlook.com","aol.com","icloud.com","mail.com","protonmail.com","zoho.com","gmx.com","yandex.com","libero.it","virgilio.it","alice.it","tiscali.it","tin.it","fastwebnet.it"];
  // Messaggi finali 1:1 dal plugin (>= 9 addetti / < 9 addetti)
  var MSG_GRANDE = "Grazie per aver compilato il questionario dell'Indice di Agilità Strategica. Il sistema sta elaborando i tuoi dati e riceverai il tuo <strong>report personalizzato via email entro pochi minuti</strong>.";
  var MSG_PICCOLA = "Grazie! I tuoi dati sono stati ricevuti correttamente. Stiamo generando il tuo Report PDF Avanzato: controlla la tua casella di posta, <strong>ti arriverà tra pochi minuti</strong>.";
  var MSG_GUASTO = "Si è verificato un errore tecnico durante l'invio dei tuoi risultati. Riprova tra qualche minuto oppure scrivi a <a href=\"mailto:info@fattoriadeitalenti.it\">info@fattoriadeitalenti.it</a>.";
  var MSG_DOMINIO = "Errore: Usa un'email aziendale (non sono accettati indirizzi Gmail, Hotmail, ecc.).";

  // ---- DOMANDE E RISPOSTE (1:1 dal plugin, NON modificare: punteggi in n8n) ----
  var DOMANDE = [
    "Quanto velocemente la vostra azienda è in grado di adattare i propri prodotti/servizi alle nuove tendenze del mercato?",
    "Avete processi definiti per monitorare i cambiamenti nel vostro settore e nel mercato in generale?",
    "Quanto è flessibile la vostra struttura organizzativa per rispondere a nuove sfide?",
    "In che misura incoraggiate la sperimentazione e l'innovazione all'interno della vostra azienda?",
    "Avete piani di emergenza definiti per affrontare eventi imprevisti (es. interruzioni della catena di fornitura, crisi economiche)?",
    "Quanto è diversificata la vostra base clienti?",
    "Come valutate la capacità dei vostri dipendenti di apprendere nuove competenze e adattarsi a nuovi ruoli?",
    "Avete investito in tecnologie che vi permettono di essere più agili e reattivi?",
    "Quanto è forte la vostra liquidità per affrontare periodi di incertezza?",
    "Quanto è efficace la vostra comunicazione interna durante i periodi di cambiamento?",
    "Avete introdotto con successo almeno un nuovo prodotto/servizio negli ultimi 12 mesi?",
    "Avete perso un'opportunità di mercato significativa a causa della vostra lentezza nell'adattarvi?",
    "Quanto spesso rivedete la vostra strategia aziendale in risposta ai cambiamenti esterni?",
    "Avete partnership strategiche che vi aiutano ad affrontare i cambiamenti?",
    "Quanto è forte la vostra reputazione sul mercato?",
    "Quanto è consapevole la vostra azienda del potenziale impatto dell'Intelligenza Artificiale (AI) sul vostro settore?",
    "Avete già esplorato o implementato soluzioni basate sull'AI nella vostra azienda?",
    "Qual è la vostra opinione generale sull'adozione dell'AI nella vostra azienda?",
    "Qual è la principale preoccupazione che avete riguardo all'introduzione dell'AI nella vostra azienda?",
    "Qual è la principale opportunità che vedete nell'adozione dell'AI per la vostra azienda?",
    "Quanto è importante per la vostra azienda rimanere competitiva integrando nuove tecnologie come l'AI?",
    "Avete intenzione di investire nella formazione dei vostri dipendenti per comprendere e utilizzare l'AI?",
    "Come pensate che l'AI potrebbe influenzare i vostri processi o servizi interni nei prossimi 3-5 anni?",
    "Siete aperti a collaborare con esperti esterni o aziende specializzate in AI per la sua implementazione?",
    "Quanto vi sentite preparati ad affrontare i cambiamenti nel mercato del lavoro dovuti all'introduzione dell'AI?",
    "Quanto è efficace la vostra pianificazione strategica a lungo termine (oltre 3 anni)?",
    "Avete accesso a risorse finanziarie sufficienti per investire in nuove tecnologie e affrontare imprevisti?",
    "Quanto è forte la vostra rete di contatti professionali e di supporto esterno?",
    "Quanto è agile il vostro processo decisionale?",
    "Quanto è forte la cultura dell'apprendimento continuo e del miglioramento all'interno della vostra azienda?"
  ];
  var OPZIONI = [
    ["Molto rapidamente","Abbastanza rapidamente","Con una certa lentezza","Molto lentamente"],
    ["Sì, processi strutturati e regolari","Sì, ma in modo informale","Solo occasionalmente","No"],
    ["Molto flessibile","Abbastanza flessibile","Poco flessibile","Per niente flessibile"],
    ["Fortemente incoraggiata e supportata","Abbastanza incoraggiata","Poco incoraggiata","Non incoraggiata"],
    ["Sì, piani dettagliati e aggiornati","Sì, piani generali","Piani informali o non completamente definiti","No"],
    ["Molto diversificata","Abbastanza diversificata","Poco diversificata","Per niente diversificata (dipendenza da pochi clienti)"],
    ["Molto alta","Abbastanza alta","Bassa","Molto bassa"],
    ["Sì, in modo significativo","Sì, in parte","Poco","Per niente"],
    ["Molto forte","Abbastanza forte","Debole","Molto debole"],
    ["Molto efficace","Abbastanza efficace","Poco efficace","Per niente efficace"],
    ["Sì","No"],
    ["Sì","No"],
    ["Trimestralmente o più spesso","Annualmente","Ogni due anni o più raramente","Non abbiamo un processo di revisione strutturato"],
    ["Sì, diverse partnership chiave","Sì, alcune partnership","Poche o nessuna partnership significativa","No"],
    ["Molto forte","Abbastanza forte","Neutrale","Debole"],
    ["Molto consapevole","Abbastanza consapevole","Poco consapevole","Per niente consapevole"],
    ["Sì, in diverse aree","Sì, in alcune aree limitate","Stiamo iniziando a esplorare","No"],
    ["Un'opportunità cruciale per la crescita e l'efficienza","Un'opportunità interessante da valutare attentamente","Una potenziale minaccia per alcuni ruoli lavorativi","Irrilevante per la nostra attività"],
    ["Costi e Complessità","Impatto sul Lavoro e Competenze","Etica e Affidabilità","Sicurezza e Privacy dei Dati"],
    ["Efficienza e Produttività","Miglioramento dell'Esperienza Cliente","Innovazione e Nuovi Prodotti/Servizi","Decisioni Basate sui Dati e Vantaggio Competitivo"],
    ["Molto importante","Abbastanza importante","Poco importante","Per niente importante"],
    ["Sì, abbiamo piani specifici","Sì, stiamo valutando delle opzioni","Non abbiamo piani al momento","Non riteniamo sia necessario"],
    ["Trasformazione significativa","Cambiamenti moderati","Impatto limitato","Nessun impatto"],
    ["Molto aperti","Abbastanza aperti","Poco aperti","Per niente aperti"],
    ["Molto preparati","Abbastanza preparati","Poco preparati","Per niente preparati"],
    ["Molto efficace, con obiettivi chiari e monitoraggio regolare","Abbastanza efficace, ma potrebbe essere migliorata","Poco efficace o non ben definita","Non abbiamo una pianificazione strategica a lungo termine"],
    ["Sì, risorse solide","Abbastanza risorse","Risorse limitate","Risorse molto limitate"],
    ["Molto forte e diversificata","Abbastanza forte","Debole","Molto debole"],
    ["Molto agile, decisioni rapide","Abbastanza agile","Lento","Molto lento"],
    ["Molto forte e parte integrante della nostra cultura","Abbastanza forte","Debole","Non presente"]
  ];
  var LETTERE = ["a", "b", "c", "d"];
  var TOTALE = DOMANDE.length;

  var formDati = document.getElementById("ias-form-dati");
  var formTest = document.getElementById("ias-form-test");
  var box = document.getElementById("ias-domande");
  var finale = document.getElementById("ias-finale");
  var btnValuta = document.getElementById("ias-valuta");
  var btnIndietro = document.getElementById("ias-indietro");
  var btnAvanti = document.getElementById("ias-avanti");
  var suggerimento = document.getElementById("ias-suggerimento");
  var contatore = document.getElementById("ias-contatore");
  var barra = document.getElementById("ias-barra");
  var barraPiena = document.getElementById("ias-barra-piena");
  var tsStato = document.getElementById("ias-ts-stato");
  var msg = document.getElementById("ias-messaggio");
  var overlay = document.getElementById("ias-loading-overlay");
  var notaAttesa = document.getElementById("ias-attesa-nota");
  var risposte = {};
  var corrente = 0;          // 0..29 = domanda, TOTALE = ultimo passo
  var dati = null;
  var tsWidget = null;
  var invioInAttesa = false; // "Valuta" premuto prima della verifica: si invia appena arriva il token
  var inTransizione = false; // blocca doppi tocchi durante l'avanzamento automatico
  var timerAttesa = null;
  var movimentoRidotto = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
  function mostraErrore(html) {
    msg.innerHTML = '<div class="ias-test-error"><div>' + html + '</div></div>';
    msg.scrollIntoView({ behavior: movimentoRidotto ? "auto" : "smooth", block: "center" });
  }
  function pulisciErrore() { msg.innerHTML = ""; }
  // Porta in vista l'inizio del widget solo se l'utente non lo vede già
  function inVista(el) {
    var r = el.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * 0.5) el.scrollIntoView({ behavior: movimentoRidotto ? "auto" : "smooth", block: "start" });
  }

  // ---- Costruzione delle 30 domande ------------------------------------
  DOMANDE.forEach(function (testo, i) {
    var n = i + 1;
    var html = '<div class="ias-question" data-question-number="' + n + '" role="group" aria-labelledby="ias-q-' + n + '" hidden>' +
      '<p class="ias-question-text" id="ias-q-' + n + '" tabindex="-1">' + esc(testo) + '</p>' +
      '<div class="ias-answer-options">';
    OPZIONI[i].forEach(function (etichetta, k) {
      html += '<button type="button" class="ias-answer-btn" data-question="q' + n + '" data-value="' + LETTERE[k] + '" aria-pressed="false">' +
        '<span class="ias-tasto" aria-hidden="true">' + LETTERE[k].toUpperCase() + '</span><span>' + esc(etichetta) + '</span></button>';
    });
    box.insertAdjacentHTML("beforeend", html + '</div></div>');
  });
  var domande = box.querySelectorAll(".ias-question");

  function aggiornaAvanzamento() {
    var date = Object.keys(risposte).length;
    barraPiena.style.transform = "scaleX(" + (date / TOTALE) + ")";
    barra.setAttribute("aria-valuenow", String(date));
    contatore.textContent = corrente < TOTALE ? "Domanda " + (corrente + 1) + " di " + TOTALE : "Completato: " + date + " di " + TOTALE;
    // "Avanti" solo se la domanda corrente ha già una risposta (es. dopo essere tornati indietro)
    btnAvanti.hidden = !(corrente < TOTALE && risposte["q" + (corrente + 1)]);
    suggerimento.hidden = corrente >= TOTALE;
  }

  // Mostra la domanda i (0..29) o l'ultimo passo (i === TOTALE). verso: 1 avanti, -1 indietro
  function mostraDomanda(i, verso) {
    corrente = i;
    domande.forEach(function (q, k) {
      q.hidden = k !== i;
      q.classList.remove("ias-entra-avanti", "ias-entra-indietro");
    });
    finale.hidden = i !== TOTALE;
    var attivo = i === TOTALE ? finale : domande[i];
    if (verso) { void attivo.offsetWidth; attivo.classList.add(verso > 0 ? "ias-entra-avanti" : "ias-entra-indietro"); }
    aggiornaAvanzamento();
    inVista(formTest);
    var fuoco = i === TOTALE ? document.getElementById("ias-finale-titolo") : attivo.querySelector(".ias-question-text");
    try { fuoco.focus({ preventScroll: true }); } catch (e) { fuoco.focus(); }
    // Turnstile solo all'ultimo passo: il token scade dopo 5 minuti, il questionario può durare di più
    if (i === TOTALE) renderTurnstile();
  }

  // Lo script di Cloudflare si carica in modo asincrono: se non è ancora pronto, si riprova.
  function renderTurnstile() {
    if (tsWidget !== null) return;
    if (TURNSTILE_DA_CONFIGURARE) {
      // Segnaposto non sostituito: avviso visibile, così chi pubblica se ne accorge subito.
      console.warn("Widget IAS: site key Turnstile non configurata (attributo data-sitekey del contenitore).");
      mostraErrore("Configurazione incompleta: manca la chiave della verifica di sicurezza. Il modulo non può essere inviato.");
      return;
    }
    if (!window.turnstile) { tsStato.textContent = "Caricamento della verifica di sicurezza…"; setTimeout(renderTurnstile, 300); return; }
    tsStato.textContent = "Verifica di sicurezza in corso…";
    // Il token si legge con getResponse all'invio. La callback informa l'utente e, se "Valuta"
    // è già stato premuto (invioInAttesa), fa partire l'invio rimasto in sospeso.
    tsWidget = window.turnstile.render("#ias-turnstile", {
      sitekey: TURNSTILE_SITE_KEY, language: "it",
      callback: function () {
        tsStato.textContent = "Verifica completata.";
        if (invioInAttesa) { invioInAttesa = false; inviaOra(); }
      },
      "expired-callback": function () { tsStato.textContent = "Verifica scaduta: si rinnova da sola, attendi un istante."; },
      "error-callback": function () {
        invioInAttesa = false;
        btnValuta.disabled = false;
        tsStato.textContent = "Verifica non riuscita: ricarica la pagina e riprova.";
      }
    });
  }

  // ---- Passo 1: validazione dei campi -----------------------------------
  var campi = {
    "ias-nome": function (el) { return el.value.trim() ? "" : "Inserisci il nome."; },
    "ias-cognome": function (el) { return el.value.trim() ? "" : "Inserisci il cognome."; },
    "ias-email": function (el) {
      var v = el.value.trim().toLowerCase();
      if (!v) return "Inserisci la tua email aziendale.";
      if (el.validity.typeMismatch || v.indexOf("@") < 1) return "Controlla l'indirizzo email: sembra incompleto.";
      if (DOMINI_GRATUITI.indexOf(v.split("@").pop()) !== -1) return MSG_DOMINIO;
      return "";
    },
    "ias-dip": function (el) { return el.validity.valid && el.value !== "" ? "" : "Indica il numero di addetti (un numero intero, almeno 1)."; },
    "ias-tel": function (el) { return el.value.trim() ? "" : "Inserisci un numero di telefono."; },
    "ias-azienda": function (el) { return el.value.trim() ? "" : "Inserisci la ragione sociale."; },
    "ias-privacy": function (el) { return el.checked ? "" : "Per continuare accetta l'informativa sulla privacy."; }
  };
  function verifica(id) {
    var el = document.getElementById(id);
    var errore = campi[id](el);
    document.getElementById(id + "-err").textContent = errore;
    if (errore) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
    return !errore;
  }
  Object.keys(campi).forEach(function (id) {
    var el = document.getElementById(id);
    // Validazione all'uscita dal campo (non mentre si scrive); l'errore sparisce appena corretto
    el.addEventListener(el.type === "checkbox" ? "change" : "blur", function () { if (el.value !== "" || el.type === "checkbox" || el.hasAttribute("aria-invalid")) verifica(id); });
    el.addEventListener("input", function () { if (el.hasAttribute("aria-invalid")) verifica(id); });
  });
  // La rotella del mouse non deve cambiare il numero di addetti mentre si scorre la pagina
  document.getElementById("ias-dip").addEventListener("wheel", function () { this.blur(); }, { passive: true });

  // Passo 1 -> passo 2: controlli lato browser (gli stessi li rifà n8n)
  formDati.addEventListener("submit", function (e) {
    e.preventDefault();
    pulisciErrore();
    var primo = null;
    Object.keys(campi).forEach(function (id) { if (!verifica(id) && !primo) primo = id; });
    if (primo) { document.getElementById(primo).focus(); return; }
    var email = document.getElementById("ias-email").value.trim().toLowerCase();
    dati = {
      nome: document.getElementById("ias-nome").value.trim(),
      cognome: document.getElementById("ias-cognome").value.trim(),
      email: email,
      num_dipendenti: parseInt(document.getElementById("ias-dip").value, 10),
      telefono: document.getElementById("ias-tel").value.trim(),
      azienda: document.getElementById("ias-azienda").value.trim(),
      consenso_privacy: document.getElementById("ias-privacy").checked,
      sito_web: document.getElementById("ias-sito").value
    };
    formDati.hidden = true;
    formTest.hidden = false;
    // Se si torna ai dati e poi si riparte, si riprende dalla domanda lasciata
    mostraDomanda(corrente, 1);
  });

  // ---- Passo 2: risposte e navigazione ----------------------------------
  function scegli(b) {
    if (inTransizione) return;
    var gruppo = b.parentElement.querySelectorAll(".ias-answer-btn");
    gruppo.forEach(function (s) { s.classList.remove("selected"); s.setAttribute("aria-pressed", "false"); });
    b.classList.add("selected");
    b.setAttribute("aria-pressed", "true");
    risposte[b.getAttribute("data-question")] = b.getAttribute("data-value");
    aggiornaAvanzamento();
    // Breve pausa per vedere la scelta, poi avanti da soli (anche dall'ultima domanda all'ultimo passo)
    inTransizione = true;
    setTimeout(function () { inTransizione = false; mostraDomanda(corrente + 1, 1); }, movimentoRidotto ? 150 : 320);
  }
  box.addEventListener("click", function (e) {
    var b = e.target.closest(".ias-answer-btn");
    if (b) scegli(b);
  });
  btnIndietro.addEventListener("click", function () {
    if (inTransizione) return;
    pulisciErrore();
    if (corrente === 0) {
      // Dalla prima domanda si torna ai dati: le risposte restano
      formTest.hidden = true;
      formDati.hidden = false;
      inVista(formDati);
      document.getElementById("ias-nome").focus({ preventScroll: true });
      return;
    }
    mostraDomanda(corrente - 1, -1);
  });
  btnAvanti.addEventListener("click", function () { if (!inTransizione && risposte["q" + (corrente + 1)]) mostraDomanda(corrente + 1, 1); });
  // Da tastiera: A-D o 1-4 scelgono la risposta della domanda visibile
  formTest.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || corrente >= TOTALE) return;
    var k = e.key ? e.key.toLowerCase() : "";
    var idx = LETTERE.indexOf(k);
    if (idx === -1 && k >= "1" && k <= "4") idx = Number(k) - 1;
    if (idx === -1) return;
    var opzione = domande[corrente].querySelectorAll(".ias-answer-btn")[idx];
    if (opzione) { e.preventDefault(); scegli(opzione); }
  });

  function payload(token) {
    var p = Object.assign({}, dati, { risposte: risposte, cf_turnstile_response: token, versione_domande: VERSIONE_DOMANDE, pagina: location.pathname });
    var attr = {};
    try { attr = JSON.parse(sessionStorage.getItem("fdt-attr") || "{}"); } catch (e) {}
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "fdt_cid"].forEach(function (k) { if (attr[k]) p[k] = attr[k]; }); // mai valori vuoti
    try {
      var ref = document.referrer ? new URL(document.referrer).hostname : "";
      if (ref && ref !== location.hostname) p.referrer_host = ref;                                   // solo il dominio esterno
    } catch (e) {}
    return p;
  }

  function attesa(si) {
    overlay.hidden = !si;
    btnValuta.disabled = si;
    clearTimeout(timerAttesa);
    notaAttesa.textContent = "Non chiudere questa pagina.";
    // Se la risposta tarda, lo diciamo (senza inventare fasi di elaborazione)
    if (si) timerAttesa = setTimeout(function () { notaAttesa.textContent = "Ci vuole ancora qualche secondo: non chiudere questa pagina."; }, 10000);
  }

  // ---- Invio (logica ed esiti invariati dalla v1) ------------------------
  formTest.addEventListener("submit", function (e) {
    e.preventDefault();
    if (corrente < TOTALE) return;   // "Invio" da tastiera su una domanda non invia
    pulisciErrore();
    var mancanti = [];
    for (var i = 1; i <= 30; i++) if (!risposte["q" + i]) mancanti.push(i);
    if (mancanti.length) { mostraDomanda(mancanti[0] - 1, -1); mostraErrore("Per favore, rispondi a tutte le domande prima di inviare (manca la domanda " + mancanti[0] + ")."); return; }
    var token = window.turnstile && tsWidget !== null ? window.turnstile.getResponse(tsWidget) : "";
    if (!token) {
      // Niente errore in cima (su mobile fa scorrere la pagina e porta "Valuta" fuori schermo):
      // l'avviso resta accanto al pulsante e l'invio parte da solo appena arriva il token.
      if (tsWidget === null) { mostraErrore("Attendi la verifica di sicurezza qui sopra il pulsante, poi premi di nuovo Valuta."); return; }
      invioInAttesa = true;
      btnValuta.disabled = true;
      tsStato.textContent = "Verifica di sicurezza in corso: l'invio parte appena è completata.";
      return;
    }
    inviaOra();
  });

  function inviaOra() {
    var token = window.turnstile && tsWidget !== null ? window.turnstile.getResponse(tsWidget) : "";
    if (!token) { btnValuta.disabled = false; return; }
    attesa(true);
    fetch(WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(token)) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { stato: r.status, j: j }; }); })
      .then(function (res) {
        attesa(false);
        if (res.stato === 200 && res.j.esito === "ok") {
          window.removeEventListener("beforeunload", primaDiUscire);
          formTest.hidden = true;
          var testo = res.j.dimensione === "piccola" || (res.j.dimensione !== "grande" && dati.num_dipendenti < 9) ? MSG_PICCOLA : MSG_GRANDE;
          msg.innerHTML = '<div class="ias-test-success ias-final-message-container">' +
            '<svg class="ias-icona-ok" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="28" fill="#ebf5ef"/><circle cx="28" cy="28" r="20" fill="#0c553e"/><path d="m19.5 28.5 6 6 11-12" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '<p class="ias-final-message-text">' + testo + '</p></div>';
          inVista(root);
          return;
        }
        if (window.turnstile && tsWidget !== null) window.turnstile.reset(tsWidget);   // il token vale una volta sola
        if (res.j.motivo === "email_aziendale") {
          formTest.hidden = true; formDati.hidden = false;
          mostraErrore("Errore: " + esc(res.j.messaggio || "Usa un'email aziendale."));
          var em = document.getElementById("ias-email");
          em.setAttribute("aria-invalid", "true");
          return;
        }
        mostraErrore(res.j.messaggio ? esc(res.j.messaggio) : MSG_GUASTO);
      })
      .catch(function () {
        attesa(false);
        mostraErrore(MSG_GUASTO);
      });
  }

  // Avviso se si esce a metà questionario (come il plugin)
  function primaDiUscire(e) { if (Object.keys(risposte).length > 0) { e.preventDefault(); e.returnValue = ""; } }
  window.addEventListener("beforeunload", primaDiUscire);
})();
