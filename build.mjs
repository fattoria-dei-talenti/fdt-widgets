// Build dei widget: per ciascuno minifica il CSS, compatta il markup e li incorpora
// nel JS (placeholder __CSS__ e __MARKUP__), poi scrive dist/<widget>.min.js e lo
// snippet da incollare in WordPress (snippet/<widget>.html) con l'URL jsDelivr
// fissato sulla versione di package.json.
// Uso: npm run build
import { build, transform } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const CDN = "https://cdn.jsdelivr.net/gh/fattoria-dei-talenti/fdt-widgets@v" + pkg.version + "/dist/";

// attribuzione: true = lo snippet incorpora src/<cartella>/attribuzione.html.
// Dalla v1.3.0 nessun widget la incorpora: l'attribuzione la fa lo snippet di provenienza, una volta
// per tutto il sito (head). Due script insieme si ostacolano: fdt_cid si perde a ogni visita (test CONVIVENZA).
// Gli attribuzione.html di ias e stile restano nel repo solo come riferimento della v1.2.0 (rollback).
const PREREQUISITO = " Richiede lo snippet di provenienza nel head del sito (snippet/provenienza.html).";
const WIDGET = [
  { cartella: "ias", id: "ias-widget", file: "ias.min.js", nome: "Indice di Agilità Strategica (IAS)", attribuzione: false, nota: PREREQUISITO },
  { cartella: "stile-manageriale", id: "manager-test", file: "stile-manageriale.min.js", nome: "Test stile manageriale", attribuzione: false, nota: PREREQUISITO },
  { cartella: "newsletter", id: "fdt-newsletter", file: "newsletter.min.js", nome: "Iscrizione newsletter", attribuzione: false,
    attributi: ' data-endpoint="__WEBHOOK_URL__" data-allinea="destra"',
    nota: " In data-endpoint va l'URL del webhook n8n. data-allinea=\"destra\" allinea il form al bordo destro della colonna (togliere per allinearlo a sinistra). Richiede lo snippet di provenienza nel head del sito (snippet/provenienza.html)." }
];

mkdirSync("dist", { recursive: true });
mkdirSync("snippet", { recursive: true });

for (const w of WIDGET) {
  const src = "src/" + w.cartella + "/";
  const css = (await transform(readFileSync(src + "widget.css", "utf8"), { loader: "css", minify: true })).code.trim();
  // Nel markup HTML gli spazi multipli valgono come uno solo (non ci sono <pre> o <textarea>):
  // si compattano e si tolgono i commenti, senza cambiare cosa si vede.
  const markup = readFileSync(src + "markup.html", "utf8").replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim();

  await build({
    entryPoints: [src + "widget.js"],
    outfile: "dist/" + w.file,
    minify: true,
    target: "es2017",
    define: { __CSS__: JSON.stringify(css), __MARKUP__: JSON.stringify(markup), __VERSIONE__: JSON.stringify(pkg.version) },
    banner: { js: "/* fdt-widgets v" + pkg.version + " - " + w.cartella + " - Fattoria dei Talenti, tutti i diritti riservati */" },
    legalComments: "none",
    logLevel: "warning"
  });

  // Snippet per WordPress. L'attribuzione resta inline e prima di tutto: deve girare
  // durante il parsing della pagina, prima di Umami (uno script esterno con defer partirebbe dopo).
  const attribuzione = w.attribuzione ? readFileSync(src + "attribuzione.html", "utf8") + "\n" : "";
  const snippet =
    "<!-- fdt-widgets v" + pkg.version + ": " + w.nome + ". In data-sitekey va la site key pubblica di Turnstile." + (w.nota || "") + " -->\n" +
    attribuzione +
    '<div id="' + w.id + '"' + (w.attributi || "") + ' data-sitekey="__TURNSTILE_SITE_KEY__"></div>\n' +
    '<script src="' + CDN + w.file + '" defer></script>\n';
  writeFileSync("snippet/" + w.cartella + ".html", snippet);
  console.log("ok " + w.file + " + snippet/" + w.cartella + ".html");
}

// Snippet di provenienza: inline (non da CDN) perché deve girare durante il parsing, prima di Umami.
// Va UNA volta su tutte le pagine (Elementor > Codice personalizzato, posizione <head>).
writeFileSync("snippet/provenienza.html",
  "<!-- fdt-widgets v" + pkg.version + ": provenienza della visita. Va in <head> su TUTTE le pagine, prima di Umami, ed escluso dal ritardo JS di WP Rocket. -->\n" +
  readFileSync("src/condiviso/provenienza.html", "utf8"));
console.log("ok snippet/provenienza.html");
