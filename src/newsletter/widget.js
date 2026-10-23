(function () {
  // ---- MONTAGGIO ---------------------------------------------------------
  // In pagina c'è solo <div id="fdt-newsletter" data-endpoint="..." data-sitekey="...">:
  // CSS e markup arrivano da qui (__CSS__ e __MARKUP__ li sostituisce la build, vedi build.mjs).
  // Nomi dei campi e risposte: n8n-workspace/workflows/marketing/iscrizione-newsletter/CONTRATTO.md
  var root = document.getElementById("fdt-newsletter");
  if (!root) { console.warn("Widget newsletter: manca <div id=\"fdt-newsletter\"> nella pagina."); return; }
  if (root.getAttribute("data-fdt-montato")) return;   // script incluso due volte: si monta una volta sola
  root.setAttribute("data-fdt-montato", "1");
  if (!document.getElementById("fdt-newsletter-css")) {
    var stile = document.createElement("style");
    stile.id = "fdt-newsletter-css";
    stile.textContent = __CSS__;
    document.head.appendChild(stile);
  }
  root.innerHTML = __MARKUP__;

  // ---- CONFIGURAZIONE ----------------------------------------------------
  // Endpoint e site key si leggono dal contenitore: si cambiano dalla pagina WP senza rilasciare.
  function attributo(nome) { var v = (root.getAttribute(nome) || "").trim(); return v.indexOf("__") === 0 ? "" : v; }
  var ENDPOINT = attributo("data-endpoint");
  var SITE_KEY = attributo("data-sitekey");
  var CONFIGURATO = !!(ENDPOINT && SITE_KEY);
  if (!CONFIGURATO) console.warn("Widget newsletter: mancano data-endpoint e/o data-sitekey sul contenitore. Il modulo non invia nulla.");
  var VERSIONE = "newsletter-" + __VERSIONE__;
  var TS_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
  var MSG_OK = "Abbiamo ricevuto la tua iscrizione! Controlla la tua email perché l'ultimo numero pubblicato è in arrivo!";
  var MSG_GUASTO = "Qualcosa non è andato. Riprova tra un attimo.";

  var form = document.getElementById("nl-form");
  var campiBox = document.getElementById("nl-campi");
  var email = document.getElementById("nl-email");
  var privacy = document.getElementById("nl-privacy");
  var sito = document.getElementById("nl-sito");
  var btn = document.getElementById("nl-invia");
  var stato = document.getElementById("nl-stato");
  var tsWidget = null;
  var invioInAttesa = false;   // "Iscriviti" premuto prima che arrivi il token: si invia appena arriva
  var inviando = false;

  function messaggio(testo, tipo) { stato.className = "nl-stato" + (tipo ? " nl-" + tipo : ""); stato.textContent = testo || ""; }

  // ---- TURNSTILE: al primo tocco del campo email (D5) --------------------
  // Chi legge la pagina senza iscriversi non scarica niente da Cloudflare. Una sola copia dello script.
  function caricaTurnstile() {
    if (!CONFIGURATO || tsWidget !== null) return;
    if (!window.turnstile && !document.querySelector('script[src^="' + TS_SRC + '"]')) {
      var ts = document.createElement("script");
      ts.src = TS_SRC + "?render=explicit";
      ts.async = true;
      document.head.appendChild(ts);
    }
    renderTurnstile();
  }
  function renderTurnstile() {
    if (tsWidget !== null) return;
    if (!window.turnstile) { setTimeout(renderTurnstile, 250); return; }
    // interaction-only: il riquadro compare solo se Cloudflare ha un dubbio; di solito resta invisibile
    tsWidget = window.turnstile.render("#nl-turnstile", {
      sitekey: SITE_KEY, language: "it", appearance: "interaction-only", action: "newsletter",
      callback: function () { if (invioInAttesa) { invioInAttesa = false; inviaOra(); } },
      "error-callback": function () {
        invioInAttesa = false;
        btn.disabled = false;
        messaggio("Verifica di sicurezza non riuscita: ricarica la pagina e riprova.", "errore");
      }
    });
  }
  ["focus", "pointerdown", "touchstart"].forEach(function (ev) {
    email.addEventListener(ev, caricaTurnstile, { once: true, passive: true });
  });
  // Rete di sicurezza: chi arriva al bottone senza passare dal campo (es. compilazione automatica)
  privacy.addEventListener("change", caricaTurnstile, { once: true });

  // ---- VALIDAZIONE: all'uscita dal campo e all'invio, non mentre si scrive ----
  var controlli = {
    "nl-email": function () {
      var v = email.value.trim();
      if (!v) return "Inserisci la tua email.";
      if (email.validity.typeMismatch || v.indexOf("@") < 1 || v.split("@").pop().indexOf(".") < 1) return "Controlla l'indirizzo: sembra incompleto.";
      return "";
    },
    "nl-privacy": function () { return privacy.checked ? "" : "Per iscriverti conferma di aver letto l'informativa."; }
  };
  function verifica(id) {
    var el = document.getElementById(id);
    var errore = controlli[id]();
    document.getElementById(id + "-err").textContent = errore;
    if (errore) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
    return !errore;
  }
  email.addEventListener("blur", function () { if (email.value !== "" || email.hasAttribute("aria-invalid")) verifica("nl-email"); });
  email.addEventListener("input", function () { if (email.hasAttribute("aria-invalid")) verifica("nl-email"); });
  privacy.addEventListener("change", function () { verifica("nl-privacy"); });

  // ---- PAYLOAD (CONTRATTO par. 3): campi vuoti mai inviati ---------------
  function leggi(chiave) { try { return JSON.parse(sessionStorage.getItem(chiave) || "{}") || {}; } catch (e) { return {}; } }
  function payload(token) {
    var p = { email: email.value.trim(), privacy: true, sito_web: sito.value, cf_turnstile_response: token, pagina: location.pathname, versione_widget: VERSIONE };
    function metti(k, v) { if (v) p[k] = String(v).slice(0, 200); }
    var attr = leggi("fdt-attr");
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "fdt_cid"].forEach(function (k) { metti(k, attr[k]); });
    var origine = leggi("fdt-origine");
    metti("referrer_host", origine.referrer_host);
    metti("pagina_ingresso", origine.pagina_ingresso);
    try {
      if (document.referrer) {
        var ru = new URL(document.referrer);
        var stessoSito = ru.hostname.replace(/^www\./, "") === location.hostname.replace(/^www\./, "");
        // Senza lo snippet di provenienza nel sito: si ripiega sul referrer della pagina (come IAS)
        if (!stessoSito && !origine.pagina_ingresso) metti("referrer_host", ru.hostname);
        // Pagina interna di provenienza, solo il percorso e non se è la pagina stessa (come IAS v1.2.0)
        if (stessoSito && ru.pathname !== location.pathname) metti("referrer_path", ru.pathname);
      }
    } catch (e) {}
    return p;
  }

  // ---- INVIO --------------------------------------------------------------
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (inviando) return;
    messaggio("");
    var primo = null;
    ["nl-email", "nl-privacy"].forEach(function (id) { if (!verifica(id) && !primo) primo = id; });
    if (primo) { document.getElementById(primo).focus(); return; }
    if (!CONFIGURATO) { messaggio("Il modulo non è ancora attivo. Riprova più tardi.", "errore"); return; }
    caricaTurnstile();
    var token = window.turnstile && tsWidget !== null ? window.turnstile.getResponse(tsWidget) : "";
    if (!token) {
      // Il token arriva di solito in 1-2 secondi: l'invio parte da solo appena c'è
      invioInAttesa = true;
      btn.disabled = true;
      messaggio("Verifica di sicurezza in corso: l'iscrizione parte appena è completata.");
      return;
    }
    inviaOra();
  });

  function inviaOra() {
    var token = window.turnstile && tsWidget !== null ? window.turnstile.getResponse(tsWidget) : "";
    if (!token) { btn.disabled = false; return; }
    inviando = true;
    btn.disabled = true;
    messaggio("Invio in corso…");
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 20000) : null;
    fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(token)), signal: controller ? controller.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { stato: r.status, j: j }; }); })
      .then(function (res) {
        if (res.stato === 200 && res.j.ok === true) { successo(); return; }
        if (res.stato === 200 && res.j.codice === "email_non_valida") {
          document.getElementById("nl-email-err").textContent = "Questo indirizzo non risulta valido: controllalo.";
          email.setAttribute("aria-invalid", "true");
          email.focus();
          messaggio("");
          return;
        }
        if (res.stato === 200 && res.j.codice === "troppi_tentativi") { messaggio("Hai già provato più volte: riprova tra qualche minuto.", "errore"); return; }
        messaggio(MSG_GUASTO, "errore");
      })
      .catch(function () { messaggio(MSG_GUASTO, "errore"); })
      .then(function () {
        clearTimeout(timer);
        inviando = false;
        if (!form.classList.contains("nl-fatto")) btn.disabled = false;
        // Il token vale una volta sola: dopo ogni invio se ne prepara uno nuovo
        if (window.turnstile && tsWidget !== null) { try { window.turnstile.reset(tsWidget); } catch (e) {} }
      });
  }

  function successo() {
    form.classList.add("nl-fatto");
    campiBox.hidden = true;
    [email, privacy, btn].forEach(function (el) { el.disabled = true; });
    stato.className = "nl-stato nl-ok";
    stato.innerHTML = '<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="13" fill="#fbbf3b"/><path d="m7.5 13.5 3.8 3.8 7.2-8" fill="none" stroke="#0d553e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span></span>';
    stato.querySelector("span").textContent = MSG_OK;
  }
})();
