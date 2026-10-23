// Genera le pagine di prova per test/e2e/convivenza.e2e.js: snippet di provenienza nel <head>
// (come lo installerà Andrea su tutto il sito) + snippet 1.3.0 del widget nel body, con il widget
// compilato locale (dist/) al posto di jsDelivr e la site key di TEST di Cloudflare (passa sempre).
// Uso (dalla radice del repo): npm run build && node test/e2e/genera-pagine.mjs
import { readFileSync, writeFileSync } from "node:fs";

const TEST_KEY = "1x00000000000000000000AA";
const provenienza = readFileSync("snippet/provenienza.html", "utf8");
for (const [nome, file] of [["ias", "ias.min.js"], ["stile-manageriale", "stile-manageriale.min.js"]]) {
  const widget = readFileSync("snippet/" + nome + ".html", "utf8")
    .replace(/https:\/\/cdn\.jsdelivr\.net\/gh\/fattoria-dei-talenti\/fdt-widgets@v[\d.]+\/dist\//, "/dist/")
    .replace("__TURNSTILE_SITE_KEY__", TEST_KEY);
  writeFileSync("test/e2e/" + nome + ".html",
    "<!doctype html><html lang=\"it\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
    "<title>e2e " + nome + "</title>\n" + provenienza + "\n</head><body>\n" + widget + "</body></html>\n");
  console.log("ok test/e2e/" + nome + ".html");
}
