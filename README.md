# fdt-widgets

Widget di Fattoria dei Talenti, inseriti nelle pagine WordPress e serviti via [jsDelivr](https://www.jsdelivr.com/):

| Widget | File | Workflow n8n |
|---|---|---|
| Indice di Agilità Strategica (IAS) | `dist/ias.min.js` | `report - ias v1` |
| Test stile manageriale | `dist/stile-manageriale.min.js` | `report - stile manageriale v1` |
| Iscrizione newsletter (solo email) | `dist/newsletter.min.js` | `marketing - iscrizione newsletter v1` (in costruzione: `workflows/marketing/iscrizione-newsletter/`) |

Più uno **snippet di provenienza** (`snippet/provenienza.html`), da mettere **una volta** nel `<head>` di tutte le pagine del sito.

I widget dei report mostrano il form e le domande e inviano le risposte al webhook n8n, che genera il report PDF e lo spedisce. Il widget newsletter invia solo l'email (più i dati di provenienza) al suo webhook. **Nomi dei campi e risposte del widget newsletter: `workflows/marketing/iscrizione-newsletter/CONTRATTO.md`**, fonte unica per widget e workflow. Il codice non contiene segreti: l'URL del webhook e la site key Turnstile sono pubblici per natura.

**Licenza**: nessuna. Il codice è visibile, ma tutti i diritti sono riservati a Fattoria dei Talenti.

## Struttura

```
src/<widget>/widget.js         logica (montaggio, navigazione, invio)
src/<widget>/widget.css        stile, tutto sotto l'id del contenitore
src/<widget>/markup.html       markup inserito nel contenitore
src/<widget>/attribuzione.html snippet UTM/fdt_cid, resta INLINE nella pagina (solo IAS e stile)
src/condiviso/provenienza.html snippet di provenienza per tutto il sito (newsletter e, dopo il fix #48, tutti)
test/provenienza.test.mjs      test dello snippet di provenienza: node test/provenienza.test.mjs
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
https://cdn.jsdelivr.net/gh/fattoria-dei-talenti/fdt-widgets@v1.3.0/dist/ias.min.js
https://cdn.jsdelivr.net/gh/fattoria-dei-talenti/fdt-widgets@v1.3.0/dist/stile-manageriale.min.js
https://cdn.jsdelivr.net/gh/fattoria-dei-talenti/fdt-widgets@v1.3.0/dist/newsletter.min.js
```

**Regola: mai URL su un branch** (`@main`) o senza versione. jsDelivr tiene in cache per giorni i file dei branch, quindi una modifica potrebbe non arrivare o arrivare a metà. Un tag invece non cambia mai.

## Snippet in WordPress

Incolla `snippet/<widget>.html` in un blocco **HTML personalizzato** (Gutenberg) oppure in un widget HTML di Elementor, e metti in `data-sitekey` la site key pubblica di Turnstile al posto di `__TURNSTILE_SITE_KEY__`. Se la chiave manca, il widget mostra un avviso e non invia niente.

Dalla **v1.3.0** lo snippet di un widget ha due parti:

1. **Contenitore** `<div id="..." data-sitekey="...">`.
2. **Script del widget** da jsDelivr, con `defer`. Turnstile lo carica il widget, solo se la pagina non lo carica già.

**Prerequisito di tutti gli snippet 1.3.0: lo snippet di provenienza nel `<head>` del sito** (vedi sotto). È l'**unico** script di attribuzione: scrive `fdt-attr` e `fdt-origine`, che i widget leggono all'invio. Senza, i widget inviano comunque, ma senza UTM e `fdt_cid` e con la sola provenienza della pagina (`document.referrer`).

> Fino alla v1.2.0 gli snippet di IAS e stile avevano una terza parte, l'**attribuzione inline** (`src/<widget>/attribuzione.html`). Dalla v1.3.0 non c'è più (opzione «b», decisa da Andrea il 23/10/2026): insieme allo snippet di provenienza faceva perdere `fdt_cid` a ogni visita (blocco «CONVIVENZA» di `test/provenienza.test.mjs`). I file `attribuzione.html` restano nel repo **solo** come riferimento per tornare alla v1.2.0.

### Ordine di rilascio della v1.3.0 (le pagine non devono mai restare senza attribuzione)

1. Commit e tag `v1.3.0`, push; verificare che jsDelivr serva `@v1.3.0/dist/ias.min.js`.
2. Snippet di provenienza nel `<head>` di tutto il sito, escluso dal Delay JS di WP Rocket.
3. **Subito dopo**, le pagine IAS e stile alla 1.3.0: `report/build/widget-v130/aggiorna-widget-v130.mjs --scrivi` (toglie l'attribuzione inline e cambia la versione), poi cache Elementor e WP Rocket.
4. Test di regressione: `report/docs/TEST-REGRESSIONE-ATTRIBUZIONE-1.3.0.md`.

Tra il passo 2 e il 3 le pagine dei questionari hanno **due** script (perdono `fdt_cid`): la finestra va tenuta corta, minuti. Il dettaglio, i rischi e il ritorno alla 1.2.0 sono in `report/docs/PASSAGGIO-WIDGET-1.3.0.md`.

### Widget newsletter e snippet di provenienza

- **Widget** (`snippet/newsletter.html`): un widget HTML di Elementor con il contenitore e lo script. Attributi del contenitore: `data-endpoint` (URL del webhook n8n), `data-sitekey` (site key Turnstile), `data-allinea="destra"` (opzionale: allinea il form al bordo destro della colonna). Se `data-endpoint` o `data-sitekey` mancano, il widget avvisa in console e non invia niente. Turnstile si carica solo al primo tocco del campo email, in modalità `interaction-only` (il riquadro compare solo se Cloudflare ha un dubbio).
- **Provenienza** (`snippet/provenienza.html`): Elementor → Codice personalizzato, posizione `<head>`, tutto il sito. Va **escluso dal ritardo JS di WP Rocket**, altrimenti su chi rimbalza subito non scrive niente. Scrive `fdt-attr` (stesso formato letto da IAS e stile) e `fdt-origine` (`referrer_host` e `pagina_ingresso` di inizio visita) in `sessionStorage`, e toglie `fdt_cid` dalla barra. Nessun cookie, nessun invio.
- ⚠️ **Lo snippet di provenienza e le pagine IAS/stile alla 1.3.0 vanno installati lo stesso giorno, uno subito dopo l'altro** (ordine di rilascio qui sopra). Con lo snippet di provenienza e le pagine ancora alla 1.2.0, sulla stessa pagina girano due script: il nuovo toglie `fdt_cid` dalla barra, il vecchio subito dopo vede gli UTM senza `fdt_cid`, azzera l'appunto e lo perde. Riprodotto da `test/provenienza.test.mjs` (blocco «CONVIVENZA»); la versione corretta è provata nel browser da `test/e2e/convivenza.e2e.js`.

### Prove

- `node test/provenienza.test.mjs`: snippet di provenienza (13 prove) + documentazione del bug #48 e della convivenza con la 1.2.0.
- Nel browser, con i webhook **intercettati** (nessuna richiesta a n8n): `npm run build && node test/e2e/genera-pagine.mjs`, poi `python -m http.server 8766 --bind 127.0.0.1` dalla radice del repo e `playwright-cli open && playwright-cli --raw run-code --filename=test/e2e/convivenza.e2e.js`. Arrivo con UTM e `fdt_cid`, ricarica, compilazione completa di IAS e stile: il payload deve avere `fdt_cid` e il `referrer_host` di inizio visita. Le pagine `test/e2e/*.html` sono generate.

## Il tema del sito: perché il CSS ha dei "reset"

Il sito usa il tema **Hello Elementor**, il cui `reset.css` stila tutti i `button`, `label` e `h3` della pagina:

- `[type=button],[type=submit],button { white-space: nowrap; user-select: none; display: inline-block; padding: .5rem 1rem; border: 1px solid #c36; color: #c36 }`
- `label { display: inline-block; line-height: 1 }`
- `h3 { font-size: 1.75rem; margin-block: .5rem 1rem }`

Senza i reset del widget il testo lungo delle opzioni non va a capo ed esce dal riquadro: è il bug della v1.0.0. I reset stanno in cima a `widget.css`, sempre sotto l'id del contenitore, quindi non toccano il resto del sito.

## Versioni

| Versione | Cosa cambia |
|---|---|
| v1.3.0 | Nuovo widget **newsletter** (solo email, variante «integrata nel verde», Turnstile al primo tocco del campo) e **snippet di provenienza** condiviso (`fdt-origine` + regola anti-perdita di `fdt_cid`, bug #48). IAS e stile manageriale: **snippet senza attribuzione inline** (la fa lo snippet di provenienza, opzione «b» del 23/10) e `referrer_host` preso da `fdt-origine` (provenienza di inizio visita) se c'è, altrimenti da `document.referrer` come prima. **Nomi del payload invariati**: i workflow in produzione non cambiano |
| v1.2.0 | Provenienza interna: se il visitatore arriva da un'altra pagina del sito, il payload contiene `referrer_path`, cioè solo il percorso della pagina di provenienza (niente query string né hash, massimo 200 caratteri, non inviato se è la pagina stessa). Con un referrer esterno resta solo `referrer_host`, come prima. Il resto del payload è invariato |
| v1.1.0 | Le opzioni vanno a capo (reset di `white-space` contro Hello Elementor). Testi più grandi di circa 3 px. Nessun anello sul fuoco spostato dallo script (`tabindex="-1"`). Nuovo sottotitolo IAS. Payload invariato |
| v1.0.0 | Prima versione: widget v2 mobile-first serviti via jsDelivr |

## Rapporto con `report/widget-v2/`

La fonte di verità è **questo repo**. La cartella `report/widget-v2/` del workspace è **superata**. Resta congelata come riferimento del payload approvato, perché i test di regressione confrontano la build con quel sorgente. Non va più modificata né pubblicata.
