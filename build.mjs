// Build dei widget: per ciascuno minifica il CSS, compatta il markup e li incorpora
// nel JS (placeholder __CSS__ e __MARKUP__), poi scrive dist/<widget>.min.js e lo
// snippet da incollare in WordPress (snippet/<widget>.html) con l'URL jsDelivr
// fissato sulla versione di package.json.
// Uso: npm run build
import { build, transform } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const CDN = "https://cdn.jsdelivr.net/gh/fattoria-dei-talenti/fdt-widgets@v" + pkg.version + "/dist/";

const WIDGET = [
  { cartella: "ias", id: "ias-widget", file: "ias.min.js", nome: "Indice di Agilità Strategica (IAS)" },
  { cartella: "stile-manageriale", id: "manager-test", file: "stile-manageriale.min.js", nome: "Test stile manageriale" }
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
    define: { __CSS__: JSON.stringify(css), __MARKUP__: JSON.stringify(markup) },
    banner: { js: "/* fdt-widgets v" + pkg.version + " - " + w.cartella + " - Fattoria dei Talenti, tutti i diritti riservati */" },
    legalComments: "none",
    logLevel: "warning"
  });

  // Snippet per WordPress. L'attribuzione resta inline e prima di tutto: deve girare
  // durante il parsing della pagina, prima di Umami (uno script esterno con defer partirebbe dopo).
  const attribuzione = readFileSync(src + "attribuzione.html", "utf8");
  const snippet =
    "<!-- fdt-widgets v" + pkg.version + ": " + w.nome + ". In data-sitekey va la site key pubblica di Turnstile. -->\n" +
    attribuzione + "\n" +
    '<div id="' + w.id + '" data-sitekey="__TURNSTILE_SITE_KEY__"></div>\n' +
    '<script src="' + CDN + w.file + '" defer></script>\n';
  writeFileSync("snippet/" + w.cartella + ".html", snippet);
  console.log("ok " + w.file + " + snippet/" + w.cartella + ".html");
}
