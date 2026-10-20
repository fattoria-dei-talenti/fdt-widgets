(function () {
  // ---- MONTAGGIO ---------------------------------------------------------
  // In pagina c'e' solo <div id="manager-test" data-sitekey="...">: CSS e markup
  // arrivano da qui (__CSS__ e __MARKUP__ li sostituisce la build, vedi build.mjs).
  var root = document.getElementById("manager-test");
  if (!root) { console.warn("[widget stile manageriale] manca <div id=\"manager-test\"> nella pagina."); return; }
  if (root.getAttribute("data-fdt-montato")) return;   // script incluso due volte: si monta una volta sola
  root.setAttribute("data-fdt-montato", "1");
  if (!document.getElementById("fdt-sm-css")) {
    var stile = document.createElement("style");
    stile.id = "fdt-sm-css";
    stile.textContent = __CSS__;
    document.head.appendChild(stile);
  }
  root.innerHTML = __MARKUP__;
  // Turnstile (render esplicito) si carica da qui, solo se la pagina non lo carica gia'
  // (es. un altro form con Turnstile nella stessa pagina): mai due copie dello script.
  if (!window.turnstile && !document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]')) {
    var ts = document.createElement("script");
    ts.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    ts.async = true;
    document.head.appendChild(ts);
  }

  // ---- CONFIGURAZIONE (invariata dalla v1, tranne la site key) -----------
  var WEBHOOK_URL = "https://api.fdt.digital/webhook/report-stile-manageriale";
  // Site key pubblica di Turnstile: si legge dall'attributo data-sitekey del contenitore.
  var TURNSTILE_SITE_KEY = (root.getAttribute("data-sitekey") || "").trim();
  // Site key mancante = nessun token valido = OGNI invio scartato in
  // silenzio dal workflow (200 senza report). Lo segnaliamo subito, in console
  // e nella pagina, cosi' l'errore si vede alla prima prova (review P9).
  var TURNSTILE_NON_CONFIGURATO = !TURNSTILE_SITE_KEY || TURNSTILE_SITE_KEY === "TURNSTILE_SITE_KEY" || TURNSTILE_SITE_KEY.indexOf("__") === 0;
  if (TURNSTILE_NON_CONFIGURATO) {
    console.error("[widget stile manageriale] data-sitekey mancante sul contenitore: gli invii verranno scartati.");
  }
  var PAGINA_GRAZIE = "https://www.fattoriadeitalenti.it/grazie-test-manageriale/";
  // Deve coincidere con VERSIONE_DOMANDE nel workflow n8n: se cambi una
  // domanda, cambia la versione QUI e nei nodi "Normalizza e valida" e
  // "Prepara prompt". Una versione diversa viene rifiutata dal workflow.
  var VERSIONE_DOMANDE = "sm-v1-2025-12";
  // Stessa lista del controllo lato server (qui serve solo all'esperienza utente).
  // Lista comune ai 3 report (D8, 2026-10-19: aggiunti i provider personali italiani).
  var DOMINI_PERSONALI = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com", "aol.com", "icloud.com", "mail.com", "protonmail.com", "zoho.com", "gmx.com", "yandex.com", "libero.it", "virgilio.it", "alice.it", "tiscali.it", "tin.it", "fastwebnet.it"];
  // Domande: solo per MOSTRARLE. Il testo non viene inviato (il server usa la sua copia).
  var questions = [
    {
      "text": "Quando pianifichi una riunione, il tuo obiettivo principale è:",
      "options": [
        "Condividere informazioni essenziali e assicurarti che tutti siano aggiornati.",
        "Risolvere un problema specifico attraverso il contributo di tutti.",
        "Creare un momento di confronto e rafforzare il senso di squadra.",
        "Prendere una decisione finale dopo aver ascoltato le varie opinioni."
      ]
    },
    {
      "text": "A tuo avviso, la responsabilità di un manager finisce quando:",
      "options": [
        "Il dipendente ha ricevuto tutte le istruzioni necessarie per un compito.",
        "Il dipendente ha le competenze per portare a termine il lavoro in autonomia.",
        "Il progetto viene completato, indipendentemente dal risultato.",
        "Il dipendente raggiunge il suo massimo potenziale e non ha più bisogno di te."
      ]
    },
    {
      "text": "Un dipendente non ha capito un'istruzione che gli hai dato verbalmente e ha commesso un errore. Qual è il tuo primo pensiero?",
      "options": [
        "Avrei dovuto mandargli un'email per avere una traccia scritta di ciò che gli ho detto.",
        "Devo prendermi del tempo per spiegargli meglio come comunicare.",
        "È sua responsabilità chiedermi chiarimenti se non capisce qualcosa.",
        "Questo è un segnale che devo migliorare il mio modo di dare istruzioni."
      ]
    },
    {
      "text": "Una riunione si conclude senza che sia stata presa una decisione definitiva. Ti senti:",
      "options": [
        "Frustrato, perché la riunione non è stata produttiva.",
        "Preoccupato che la mancanza di chiarezza possa generare confusione.",
        "Non troppo infastidito, perché a volte le idee hanno bisogno di tempo per maturare.",
        "Sereno, perché preferisci che le decisioni vengano prese in privato."
      ]
    },
    {
      "text": "Sei a conoscenza di un potenziale problema futuro. Qual è la tua reazione istintiva?",
      "options": [
        "Inizi a documentare subito per email la situazione, coinvolgendo le persone interessate.",
        "Ne parli in privato con le persone coinvolte per capire come gestirlo.",
        "Aspetti che il problema si verifichi per affrontarlo direttamente.",
        "Tendi a non comunicarlo finché non hai un piano d'azione ben definito."
      ]
    },
    {
      "text": "Quando il team raggiunge un risultato importante, il tuo primo pensiero è:",
      "options": [
        "Bene, abbiamo dimostrato che siamo capaci. Ora dobbiamo pensare alla prossima sfida.",
        "Sono soddisfatto, ma avrei voluto che lo facessimo con un'efficienza maggiore.",
        "Sono felice che il team sia riuscito a superare le mie aspettative.",
        "Questa vittoria rafforza la mia leadership e la fiducia che ho nel team."
      ]
    },
    {
      "text": "Un membro del team ha un'idea brillante che potrebbe semplificare un processo. La tua prima reazione è:",
      "options": [
        "È una buona idea, ma per ora seguiamo le procedure che abbiamo stabilito.",
        "Ottimo, ma perché non ci hai pensato prima? Ne parleremo in riunione.",
        "Bene, valutiamo insieme i pro e i contro. Coinvolgiamo anche gli altri per capire come implementarla.",
        "Mi piace l'idea, mandami un'email con una proposta scritta per avere una traccia."
      ]
    },
    {
      "text": "Ti trovi in disaccordo con una decisione presa da un tuo superiore, ma devi comunicarla al team. Tu:",
      "options": [
        "La comunichi in modo neutrale, senza far trasparire il tuo dissenso.",
        "Spieghi al team che non sei d'accordo, ma che devi seguire le direttive.",
        "Decidi di non comunicarla subito, sperando che la decisione possa cambiare.",
        "La comunichi come se fosse una tua decisione, per non minare l'autorità."
      ]
    },
    {
      "text": "Quando un tuo dipendente ti chiede un parere sul suo sviluppo professionale, la tua responsabilità si limita a:",
      "options": [
        "Suggerirgli delle opportunità di formazione interna.",
        "Dargli un feedback onesto sul suo operato.",
        "Spingerlo a prendere in mano la sua carriera.",
        "Aiutarlo a definire obiettivi di crescita chiari e a raggiungerli."
      ]
    },
    {
      "text": "La tua principale preoccupazione durante una riunione con un cliente è:",
      "options": [
        "Che il team commetta un errore e mi faccia fare una brutta figura.",
        "Che il cliente non sia soddisfatto del nostro lavoro.",
        "Che la riunione si prolunghi troppo e ci faccia perdere tempo.",
        "Che il cliente non capisca la nostra strategia."
      ]
    },
    {
      "text": "Un dipendente ha avuto un problema personale che ha influenzato negativamente il suo lavoro. La tua prima reazione è:",
      "options": [
        "Chiedergli di non far più accadere una cosa del genere.",
        "Dargli un'opportunità per recuperare, senza fare troppe domande.",
        "Prendere una nota sul suo file personale.",
        "Offrirgli un supporto, ma anche ricordargli le sue responsabilità professionali."
      ]
    },
    {
      "text": "Un membro del team ti manda un'email per chiederti un'approvazione su un progetto. La tua risposta è:",
      "options": [
        "Rispondi subito per email per non farlo aspettare.",
        "Gli rispondi in privato per telefono, in modo da avere un confronto.",
        "Non rispondi subito, per fargli capire che deve risolvere il problema da solo.",
        "Gli chiedi di venire nel tuo ufficio per discuterne di persona."
      ]
    },
    {
      "text": "In una situazione di conflitto tra due dipendenti, il tuo ruolo è principalmente quello di:",
      "options": [
        "Ascoltare entrambe le parti e prendere una decisione per loro.",
        "Fornire uno spazio per il confronto, ma lasciare quei problemi si risolvano tra di loro.",
        "Stabilire dei confini e dire che i litigi non sono accettabili in un team.",
        "Mediare, facilitando il dialogo per trovare un punto di incontro."
      ]
    },
    {
      "text": "Ti trovi a dover correggere un dipendente in una riunione. Tu:",
      "options": [
        "Lo correggi in privato, dopo la riunione.",
        "Lo correggi in riunione, per essere trasparente con tutti.",
        "Lo correggi, ma aggiungendo un complimento per non farlo sentire male.",
        "Aspetti la sua revisione annuale per discutere l'errore."
      ]
    },
    {
      "text": "Un tuo dipendente si è reso disponibile a lavorare per un progetto extra. Il tuo pensiero è:",
      "options": [
        "Se lo fa in maniera impeccabile, allora ne sarò felice.",
        "Sono contento, ma spero che non trascuri le sue responsabilità attuali.",
        "Ottimo, questo dimostra che ha un grande potenziale.",
        "Perché lo fa? Non è che vuole farmi una buona impressione per chiedere un aumento?"
      ]
    },
    {
      "text": "Dopo una discussione difficile con un membro del team, la tua prima azione è:",
      "options": [
        "Mandargli un'email per riassumere i punti salienti della discussione e mettere in chiaro i prossimi passi.",
        "Andare a parlargli di persona per assicurarti che non ci siano stati malintesi.",
        "Lasciar correre, sapendo che le incomprensioni fanno parte del lavoro.",
        "Ignorarlo per un po' di tempo, per far sbollire la tensione."
      ]
    },
    {
      "text": "Un membro del team chiede un aumento di stipendio. Il tuo primo pensiero è:",
      "options": [
        "Ho bisogno di un'email formale per poterlo presentare ai miei superiori.",
        "Ha un buon rendimento, ma deve dimostrare di più per meritarselo.",
        "Dobbiamo valutare il suo rendimento e il suo potenziale per capire se è il caso.",
        "Devo capire come motivarlo, per non fargli chiedere un aumento troppo spesso."
      ]
    },
    {
      "text": "La tua definizione di un manager di successo è qualcuno che:",
      "options": [
        "È in grado di far ottenere ottimi risultati al suo team.",
        "Riesce a bilanciare le esigenze del team con quelle dell'azienda.",
        "È visto come un leader, ma anche come un amico.",
        "È in grado di prendere decisioni difficili senza esitazioni."
      ]
    },
    {
      "text": "Quando senti che un tuo dipendente si lamenta del tuo operato con un collega, la tua reazione è:",
      "options": [
        "Dovrei convocare una riunione con entrambi per chiarire le cose.",
        "Dovrei mandargli un'email per chiedere spiegazioni.",
        "Spero che si renda conto del suo errore e che la smetta di lamentarsi.",
        "Devo capire perché si lamenta e se c'è qualcosa che posso migliorare."
      ]
    },
    {
      "text": "Un membro del team ti dà un feedback negativo sul tuo stile di leadership. La tua prima reazione è:",
      "options": [
        "Ti senti offeso e pensi che non sia il caso che si esprima in quel modo.",
        "Ti senti insicuro e pensi che forse non sei all'altezza del ruolo.",
        "Ti senti curioso e gli chiedi di approfondire il suo punto di vista.",
        "Non ci fai caso, sapendo che il feedback è soggettivo."
      ]
    }
  ];
  // -----------------------------------------------------------------------

  var LETTERE = ["A", "B", "C", "D"];
  var form = document.getElementById("user-form");
  var questionnaire = document.getElementById("questionnaire");
  var domandaBox = document.getElementById("mt-domanda");
  var questionBox = document.getElementById("question-box");
  var answersBox = document.getElementById("answers");
  var erroreForm = document.getElementById("mt-errore-form");
  var stato = document.getElementById("mt-stato");
  var contatore = document.getElementById("mt-contatore");
  var barra = document.getElementById("mt-barra");
  var barraPiena = document.getElementById("mt-barra-piena");
  var btnIndietro = document.getElementById("mt-indietro");
  var btnAvanti = document.getElementById("mt-avanti");

  var userData = {};
  var answers = [];
  var currentQuestion = 0;
  var turnstileId = null;
  var inviato = false;
  var inTransizione = false;
  var movimentoRidotto = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Escape via DOM: nessun carattere "e commerciale" letterale nel sorgente (wptexturize lo altererebbe)
  // (usato solo dentro il testo, mai negli attributi: le virgolette non serve convertirle)
  function esc(s) { var d = document.createElement("div"); d.textContent = String(s); return d.innerHTML; }
  function mostraErroreForm(msg) {
    erroreForm.textContent = msg;
    erroreForm.hidden = !msg;
  }
  function inVista(el) {
    var r = el.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * 0.5) el.scrollIntoView({ behavior: movimentoRidotto ? "auto" : "smooth", block: "start" });
  }
  function rispostaData(i) { return answers[i] !== undefined; }

  // verso: 1 avanti, -1 indietro, 0 nessuna animazione
  function showQuestion(verso) {
    var q = questions[currentQuestion];
    var date = answers.filter(function (a) { return a !== undefined; }).length;
    contatore.textContent = "Domanda " + (currentQuestion + 1) + " di " + questions.length;
    barraPiena.style.transform = "scaleX(" + (date / questions.length) + ")";
    barra.setAttribute("aria-valuenow", String(date));
    questionBox.innerHTML = '<p class="question-text" id="mt-testo-domanda" tabindex="-1">' + esc(q.text) + "</p>";
    answersBox.setAttribute("aria-labelledby", "mt-testo-domanda");
    answersBox.innerHTML = q.options.map(function (opt, i) {
      var sel = answers[currentQuestion] === String(i);
      return '<button type="button" class="answer-option' + (sel ? " selected" : "") + '" data-index="' + i + '" aria-pressed="' + (sel ? "true" : "false") + '">' +
        '<span class="mt-tasto" aria-hidden="true">' + LETTERE[i] + '</span><span class="answer-text">' + esc(opt) + "</span></button>";
    }).join("");
    btnAvanti.hidden = !rispostaData(currentQuestion);
    domandaBox.classList.remove("mt-entra-avanti", "mt-entra-indietro");
    if (verso) { void domandaBox.offsetWidth; domandaBox.classList.add(verso > 0 ? "mt-entra-avanti" : "mt-entra-indietro"); }
    inVista(questionnaire);
    var t = document.getElementById("mt-testo-domanda");
    try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); }
  }

  function avanza() {
    if (currentQuestion < questions.length - 1) { currentQuestion++; showQuestion(1); }
    else { completeTest(); }
  }

  // Scelta di una risposta: selezione visibile, poi avanzamento automatico (come nel plugin)
  function scegli(btn) {
    if (inTransizione || inviato) return;
    answersBox.querySelectorAll(".answer-option").forEach(function (o) { o.classList.remove("selected"); o.setAttribute("aria-pressed", "false"); });
    btn.classList.add("selected");
    btn.setAttribute("aria-pressed", "true");
    // Valore come stringa "0".."3": e' quello che il workflow si aspetta (come i radio del plugin)
    answers[currentQuestion] = String(btn.getAttribute("data-index"));
    inTransizione = true;
    setTimeout(function () { inTransizione = false; avanza(); }, movimentoRidotto ? 150 : 400);
  }
  answersBox.addEventListener("click", function (e) {
    var b = e.target.closest(".answer-option");
    if (b) scegli(b);
  });
  btnIndietro.addEventListener("click", function () {
    if (inTransizione) return;
    if (currentQuestion === 0) {
      // Dalla prima domanda si torna ai dati: le risposte restano
      questionnaire.hidden = true;
      form.hidden = false;
      inVista(form);
      document.getElementById("mt-nome").focus({ preventScroll: true });
      return;
    }
    currentQuestion--;
    showQuestion(-1);
  });
  btnAvanti.addEventListener("click", function () { if (!inTransizione && rispostaData(currentQuestion)) avanza(); });
  questionnaire.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key ? e.key.toUpperCase() : "";
    var idx = LETTERE.indexOf(k);
    if (idx === -1 && k >= "1" && k <= "4") idx = Number(k) - 1;
    if (idx === -1) return;
    var b = answersBox.querySelectorAll(".answer-option")[idx];
    if (b) { e.preventDefault(); scegli(b); }
  });

  // ---- Form anagrafico ----------------------------------------------------
  var OBBLIGATORI = ["nome", "cognome", "azienda", "ruolo", "email"];
  function segnaCampo(nome, errore) {
    var el = form.elements[nome];
    document.getElementById("mt-" + nome + "-err").textContent = errore;
    if (errore) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
  }
  // Stesse regole del plugin; restituisce il messaggio per il campo (vuoto = ok)
  function erroreEmail(v) {
    var email = v.trim().toLowerCase();
    if (!email) return "Campo obbligatorio.";
    if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(email)) return "Controlla l'indirizzo email.";
    if (DOMINI_PERSONALI.indexOf(email.split("@")[1]) !== -1) return "Per favore usa la tua email aziendale.";
    return "";
  }
  OBBLIGATORI.forEach(function (nome) {
    var el = form.elements[nome];
    var controlla = function () { segnaCampo(nome, nome === "email" ? erroreEmail(el.value) : (el.value.trim() ? "" : "Campo obbligatorio.")); };
    // All'uscita dal campo (non mentre si scrive); l'errore sparisce appena corretto
    el.addEventListener("blur", function () { if (el.value !== "" || el.hasAttribute("aria-invalid")) controlla(); });
    el.addEventListener("input", function () { if (el.hasAttribute("aria-invalid")) controlla(); });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    mostraErroreForm("");
    var fd = new FormData(form);
    fd.forEach(function (val, key) { userData[key] = String(val).trim(); });
    var vuoti = OBBLIGATORI.filter(function (k) { return !userData[k]; });
    OBBLIGATORI.forEach(function (k) { segnaCampo(k, userData[k] ? "" : "Campo obbligatorio."); });
    if (vuoti.length) {
      mostraErroreForm("Compila tutti i campi obbligatori.");
      form.elements[vuoti[0]].focus();
      return;
    }
    var email = userData.email.toLowerCase();
    if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(email)) {
      segnaCampo("email", "Controlla l'indirizzo email.");
      form.elements.email.focus();
      return;
    }
    if (DOMINI_PERSONALI.indexOf(email.split("@")[1]) !== -1) {
      segnaCampo("email", "Per favore usa la tua email aziendale.");
      form.elements.email.focus();
      return;
    }
    userData.email = email;
    form.hidden = true;
    questionnaire.hidden = false;
    // Se si torna ai dati e poi si riparte, si riprende dalla domanda lasciata
    showQuestion(1);
  });

  function schermata(html) {
    questionnaire.hidden = true;
    stato.innerHTML = '<div class="completion-screen">' + html + "</div>";
    stato.hidden = false;
    inVista(stato);
  }

  // Torna al form anagrafico mantenendo le risposte (es. email da cambiare).
  function tornaAlForm(msg) {
    stato.hidden = true;
    questionnaire.hidden = true;
    form.hidden = false;
    mostraErroreForm(msg);
    form.elements.email.setAttribute("aria-invalid", "true");
    inviato = false;
    form.scrollIntoView({ behavior: movimentoRidotto ? "auto" : "smooth", block: "start" });
  }

  function completeTest() {
    if (inviato) return;
    inviato = true;
    schermata("<h3>Test completato!</h3><div class=\"spinner\" aria-hidden=\"true\"></div><p>Stiamo inviando le tue risposte, NON chiudere questa pagina.</p>");
    if (TURNSTILE_NON_CONFIGURATO) {
      schermata("<h3>Widget non configurato</h3><p>Manca la chiave Turnstile: la richiesta non può essere inviata. Avvisa info@fattoriadeitalenti.it.</p>");
      return;
    }
    if (!window.turnstile) {
      schermata("<h3>Qualcosa non ha funzionato</h3><p>Non riusciamo a verificare la richiesta: ricarica la pagina e riprova, oppure scrivi a info@fattoriadeitalenti.it.</p>");
      return;
    }
    // Turnstile: verifica invisibile al momento dell'invio.
    var opzioni = {
      sitekey: TURNSTILE_SITE_KEY,
      execution: "execute",
      appearance: "interaction-only",
      callback: invia,
      "error-callback": function () { schermata("<h3>Verifica non riuscita</h3><p>Ricarica la pagina e riprova. Se il problema continua scrivi a info@fattoriadeitalenti.it.</p>"); }
    };
    if (turnstileId === null) turnstileId = window.turnstile.render("#mt-turnstile", opzioni);
    else window.turnstile.reset(turnstileId);
    window.turnstile.execute(turnstileId);
  }

  function invia(token) {
    var attr = {};
    try { attr = JSON.parse(sessionStorage.getItem("fdt-attr") || "{}"); } catch (e) {}
    var dati = {
      nome: userData.nome, cognome: userData.cognome, azienda: userData.azienda, ruolo: userData.ruolo, email: userData.email,
      sito_web: userData.sito_web || "",
      answers: answers,
      versione_domande: VERSIONE_DOMANDE,
      turnstile_token: token,
      pagina: location.pathname
    };
    // Attribuzione: si inviano solo le chiavi presenti (mai stringhe vuote).
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "fdt_cid"].forEach(function (k) { if (attr[k]) dati[k] = attr[k]; });
    // Solo il dominio di provenienza, e solo se esterno al sito.
    try {
      if (document.referrer) {
        var rh = new URL(document.referrer).hostname;
        if (rh && rh !== location.hostname) dati.referrer_host = rh;
      }
    } catch (e) {}

    fetch(WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dati) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; }); })
      .then(function (res) {
        if (res.status === 200 && res.body.esito === "ok") { window.location.href = PAGINA_GRAZIE; return; }
        var msg = (res.body && res.body.messaggio) || "Si è verificato un problema durante l'invio.";
        if (res.body && res.body.motivo === "email_aziendale") { tornaAlForm(msg); return; }
        schermata("<h3>Non è stato possibile inviare il test</h3><p>" + esc(msg) + "</p>");
      })
      .catch(function () {
        inviato = false;
        schermata("<h3>Connessione non riuscita</h3><p>Non siamo riusciti a inviare le risposte. Riprova tra qualche minuto: le tue risposte restano in questa pagina.</p><button type=\"button\" class=\"mt-btn mt-cta start-test-btn\" id=\"mt-riprova\">Riprova l'invio</button>");
        var b = document.getElementById("mt-riprova");
        if (b) b.addEventListener("click", completeTest);
      });
  }
})();
