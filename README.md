# fdt-widgets

Widget dei report di Fattoria dei Talenti, inseriti nelle pagine WordPress e serviti via [jsDelivr](https://www.jsdelivr.com/):

| Widget | File | Workflow n8n |
|---|---|---|
| Indice di Agilità Strategica (IAS) | `dist/ias.min.js` | `report - ias v1` |
| Test stile manageriale | `dist/stile-manageriale.min.js` | `report - stile manageriale v1` |

Ogni widget mostra il form e le domande e invia le risposte al webhook n8n, che genera il report PDF e lo spedisce. Il codice non contiene segreti: l'URL del webhook e la site key Turnstile sono pubblici per natura.

**Licenza**: nessuna. Il codice è visibile, ma tutti i diritti sono riservati a Fattoria dei Talenti.

## Struttura

```
src/<widget>/widget.js         logica (montaggio, navigazione, invio)
src/<widget>/widget.css        stile, tutto sotto l'id del contenitore
src/<widget>/markup.html       markup inserito nel contenitore
src/<widget>/attribuzione.html snippet UTM/fdt_cid, resta INLINE nella pagina
dist/                          file minificati serviti da jsDelivr (versionati nel repo)
snippet/<widget>.html          da incollare in WordPress
build.mjs                      build con esbuild
```

## Build

```
npm install
npm run build
```

La build minifica CSS e JS, incorpora CSS e markup nel JS e rigenera `dist/` e `snippet/`.

## Rilascio di una nuova versione

1. Modifica `src/`, poi aumenta `version` in `package.json` (es. `1.0.0` → `1.1.0`).
2. `npm run build`, poi commit di `src/`, `dist/` e `snippet/`.
3. Crea il tag e pubblicalo: `git tag v1.1.0` e `git push origin main --tags`.
4. Nelle pagine WordPress cambia solo il numero di versione nell'URL dello script.

Per tornare indietro (rollback) si rimette il numero di versione precedente nella pagina.

## URL jsDelivr

```
https://cdn.jsdelivr.net/gh/fattoria-dei-talenti/fdt-widgets@v1.0.0/dist/ias.min.js
https://cdn.jsdelivr.net/gh/fattoria-dei-talenti/fdt-widgets@v1.0.0/dist/stile-manageriale.min.js
```

**Regola: mai URL su un branch** (`@main`) o senza versione. jsDelivr tiene in cache per giorni i file dei branch, quindi una modifica potrebbe non arrivare o arrivare a metà. Un tag invece non cambia mai.

## Snippet in WordPress

Incolla `snippet/<widget>.html` in un blocco **HTML personalizzato** (Gutenberg) oppure in un widget HTML di Elementor, e metti in `data-sitekey` la site key pubblica di Turnstile al posto di `__TURNSTILE_SITE_KEY__`. Se la chiave manca, il widget mostra un avviso e non invia niente.

Lo snippet ha tre parti:

1. **Attribuzione inline**: legge `utm_*` e `fdt_cid` dall'URL. Deve girare prima di Umami, per questo non sta su CDN. Non contiene `&`, `<` o `>`, quindi il filtro `wptexturize` di WordPress non la altera.
2. **Contenitore** `<div id="..." data-sitekey="...">`.
3. **Script del widget** da jsDelivr, con `defer`. Turnstile lo carica il widget, solo se la pagina non lo carica già.
