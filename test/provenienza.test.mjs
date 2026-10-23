// Test dello snippet di provenienza (src/condiviso/provenienza.html), senza dipendenze.
// Simula le pagine di una visita: ogni "pagina" esegue lo snippet in un contesto vm con
// location, history, document.referrer e sessionStorage finti. La sessionStorage è condivisa
// tra le pagine della stessa visita, come nel browser (stessa scheda, stesso sito).
// Esegue anche lo scenario della ricarica sullo snippet attuale dei widget IAS
// (src/ias/attribuzione.html) per documentare il bug #48, senza modificarlo.
// Uso: node test/provenienza.test.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const SITO = "https://www.fattoriadeitalenti.it";
const codice = (file) => readFileSync(file, "utf8").replace(/<\/?script>/g, "");
const PROVENIENZA = codice("src/condiviso/provenienza.html");
const IAS = codice("src/ias/attribuzione.html");

function nuovaVisita() {
  const dati = new Map();
  return {
    getItem: (k) => (dati.has(k) ? dati.get(k) : null),
    setItem: (k, v) => dati.set(k, String(v)),
    removeItem: (k) => dati.delete(k),
    clear: () => dati.clear()
  };
}

// Apre una pagina della visita: esegue lo snippet e restituisce l'URL rimasto nella barra
function apri(src, storage, href, referrer = "") {
  const u = new URL(href);
  const location = { href: u.href, hostname: u.hostname, pathname: u.pathname, search: u.search, hash: u.hash };
  const history = {
    state: null,
    replaceState(_s, _t, nuovo) { const n = new URL(nuovo, location.href); Object.assign(location, { href: n.href, pathname: n.pathname, search: n.search, hash: n.hash }); }
  };
  vm.runInNewContext(src, { location, history, sessionStorage: storage, document: { referrer }, URL, JSON, String, Object });
  return location.href;
}
const leggi = (storage, k) => JSON.parse(storage.getItem(k) || "null");

let ok = 0;
function prova(nome, fn) { fn(); ok++; console.log("ok   " + nome); }

// Il codice inline non deve contenere caratteri che wptexturize altera
prova("nessun & < > nel codice dello snippet", () => {
  assert.ok(!/[&<>]/.test(PROVENIENZA), "lo snippet contiene &, < o >");
});

prova("Google → articolo → pagina del form: origine = google + pagina d'ingresso", () => {
  const s = nuovaVisita();
  apri(PROVENIENZA, s, SITO + "/la-matrice-di-covey/", "https://www.google.com/");
  apri(PROVENIENZA, s, SITO + "/strumenti-del-contadino/", SITO + "/la-matrice-di-covey/");
  assert.deepEqual(leggi(s, "fdt-origine"), { pagina_ingresso: "/la-matrice-di-covey/", referrer_host: "www.google.com" });
  assert.equal(s.getItem("fdt-attr"), null, "senza UTM non si scrive fdt-attr");
});

prova("utm + fdt_cid → ricarica: fdt_cid NON perso, e tolto dalla barra", () => {
  const s = nuovaVisita();
  const barra = apri(PROVENIENZA, s, SITO + "/ias/?utm_source=linkedin&utm_medium=social&utm_campaign=231026-test&fdt_cid=abc123", "https://www.linkedin.com/");
  assert.ok(!barra.includes("fdt_cid"), "fdt_cid deve sparire dalla barra");
  apri(PROVENIENZA, s, barra, ""); // ricarica: stesso URL, ormai senza fdt_cid
  assert.deepEqual(leggi(s, "fdt-attr"), { utm_source: "linkedin", utm_medium: "social", utm_campaign: "231026-test", fdt_cid: "abc123" });
});

prova("nuovo link con UTM diversi nella stessa visita: UTM aggiornati, fdt_cid non trascinato", () => {
  const s = nuovaVisita();
  const b1 = apri(PROVENIENZA, s, SITO + "/ias/?utm_source=linkedin&utm_medium=social&utm_campaign=231026-a&fdt_cid=uno", "");
  apri(PROVENIENZA, s, b1, "");
  apri(PROVENIENZA, s, SITO + "/blog/?utm_source=email&utm_medium=email&utm_campaign=241026-b&fdt_cid=due", "");
  assert.deepEqual(leggi(s, "fdt-attr"), { utm_source: "email", utm_medium: "email", utm_campaign: "241026-b", fdt_cid: "due" });
  apri(PROVENIENZA, s, SITO + "/chi-siamo/?utm_source=print&utm_medium=print&utm_campaign=evergreen-qr", "");
  assert.deepEqual(leggi(s, "fdt-attr"), { utm_source: "print", utm_medium: "print", utm_campaign: "evergreen-qr" }, "UTM diversi senza fdt_cid: niente fdt_cid vecchio");
});

prova("l'origine resta quella della prima pagina anche se poi arriva un link con UTM", () => {
  const s = nuovaVisita();
  apri(PROVENIENZA, s, SITO + "/", "https://www.bing.com/");
  apri(PROVENIENZA, s, SITO + "/ias/?utm_source=email&utm_medium=email&utm_campaign=241026-b", "");
  assert.deepEqual(leggi(s, "fdt-origine"), { pagina_ingresso: "/", referrer_host: "www.bing.com" });
});

prova("nessun referrer → niente referrer_host", () => {
  const s = nuovaVisita();
  apri(PROVENIENZA, s, SITO + "/strumenti-del-contadino/", "");
  assert.deepEqual(leggi(s, "fdt-origine"), { pagina_ingresso: "/strumenti-del-contadino/" });
});

prova("referrer interno alla prima pagina (anche senza www) → niente referrer_host", () => {
  const s1 = nuovaVisita();
  apri(PROVENIENZA, s1, SITO + "/strumenti-del-contadino/", SITO + "/blog/");
  assert.deepEqual(leggi(s1, "fdt-origine"), { pagina_ingresso: "/strumenti-del-contadino/" });
  const s2 = nuovaVisita();
  apri(PROVENIENZA, s2, SITO + "/strumenti-del-contadino/", "https://fattoriadeitalenti.it/blog/");
  assert.deepEqual(leggi(s2, "fdt-origine"), { pagina_ingresso: "/strumenti-del-contadino/" });
});

prova("sottodominio nostro (landing.) resta un dominio esterno: lo classifica n8n", () => {
  const s = nuovaVisita();
  apri(PROVENIENZA, s, SITO + "/", "https://landing.fattoriadeitalenti.it/analisi-del-talento");
  assert.equal(leggi(s, "fdt-origine").referrer_host, "landing.fattoriadeitalenti.it");
});

prova("query e hash non finiscono in pagina_ingresso", () => {
  const s = nuovaVisita();
  apri(PROVENIENZA, s, SITO + "/blog/?q=prova#sezione", "");
  assert.equal(leggi(s, "fdt-origine").pagina_ingresso, "/blog/");
});

prova("sessionStorage che lancia eccezioni: lo snippet non rompe la pagina", () => {
  const rotta = { getItem() { throw new Error("bloccata"); }, setItem() { throw new Error("bloccata"); } };
  assert.doesNotThrow(() => apri(PROVENIENZA, rotta, SITO + "/?fdt_cid=x", ""));
});

// ---- Documentazione del bug #48 sullo snippet attuale dei widget IAS (non modificato) ----
{
  const s = nuovaVisita();
  const barra = apri(IAS, s, SITO + "/ias/?utm_source=linkedin&utm_medium=social&utm_campaign=231026-test&fdt_cid=abc123", "");
  const primo = leggi(s, "fdt-attr");
  apri(IAS, s, barra, "");
  const dopo = leggi(s, "fdt-attr");
  const perso = primo.fdt_cid === "abc123" && !("fdt_cid" in dopo);
  console.log("\nBUG #48 su src/ias/attribuzione.html: " + (perso ? "CONFERMATO" : "non riprodotto"));
  console.log("  dopo il primo caricamento: " + JSON.stringify(primo));
  console.log("  dopo la ricarica:          " + JSON.stringify(dopo));
}

// ---- Convivenza: pagina IAS con lo snippet nuovo nel head E quello vecchio inline nel widget ----
{
  const s = nuovaVisita();
  const barra = apri(PROVENIENZA, s, SITO + "/ias/?utm_source=linkedin&utm_medium=social&utm_campaign=231026-test&fdt_cid=abc123", "");
  apri(IAS, s, barra, ""); // lo snippet IAS gira dopo, sullo stesso caricamento, con fdt_cid già tolto
  const dopo = leggi(s, "fdt-attr");
  console.log("CONVIVENZA provenienza (head) + attribuzione IAS (inline), stessa pagina: fdt_cid " + ("fdt_cid" in dopo ? "conservato" : "PERSO"));
  console.log("  fdt-attr: " + JSON.stringify(dopo));
}

// ---- Convivenza RISOLTA (v1.3.0, opzione b): un solo script di attribuzione, quello di provenienza ----
// Gli snippet IAS e stile 1.3.0 non incorporano più attribuzione.html: sulla pagina gira solo lo snippet
// nel head. Il payload lo verifica nel browser test/convivenza-ias.e2e.js (widget IAS compilato).
const snippetWidget = (n) => readFileSync("snippet/" + n + ".html", "utf8");
prova("snippet IAS e stile 1.3.0: nessuno script inline (niente attribuzione v1.2.0)", () => {
  for (const n of ["ias", "stile-manageriale"]) {
    const s = snippetWidget(n);
    assert.ok(!/<script>/.test(s), n + ": c'è ancora uno script inline");
    assert.ok(!s.includes("fdt-attr"), n + ": c'è ancora fdt-attr");
    assert.equal((s.match(/<script src=/g) || []).length, 1, n + ": atteso un solo script esterno");
  }
});
prova("widget IAS e stile compilati leggono fdt-attr e fdt-origine", () => {
  for (const f of ["dist/ias.min.js", "dist/stile-manageriale.min.js"]) {
    const js = readFileSync(f, "utf8");
    assert.ok(js.includes("fdt-attr") && js.includes("fdt-origine"), f);
  }
});
prova("convivenza risolta: arrivo con utm+fdt_cid → ricarica → fdt_cid ancora in fdt-attr", () => {
  const s = nuovaVisita();
  const barra = apri(PROVENIENZA, s, SITO + "/ias/?utm_source=linkedin&utm_medium=social&utm_campaign=231026-test&fdt_cid=abc123", "https://www.google.com/");
  apri(PROVENIENZA, s, barra, ""); // ricarica, nessuno script vecchio dopo
  assert.equal(leggi(s, "fdt-attr").fdt_cid, "abc123");
  assert.equal(leggi(s, "fdt-origine").referrer_host, "www.google.com");
});

console.log("\n" + ok + " prove superate");
