// Prova nel browser dell'opzione (b): snippet di provenienza nel head + widget 1.3.0 compilato.
// Arrivo con UTM + fdt_cid da Google, RICARICA, compilazione completa, invio: il payload deve
// contenere fdt_cid (bug #48 risolto) e referrer_host di inizio visita. I webhook di produzione
// sono INTERCETTATI con page.route: nessuna richiesta esce verso n8n.
// Prerequisiti: npm run build && node test/e2e/genera-pagine.mjs, poi dalla radice del repo
//   python -m http.server 8766 --bind 127.0.0.1
// Uso: playwright-cli open && playwright-cli --raw run-code --filename=test/e2e/convivenza.e2e.js
async page => {
  const BASE = "http://127.0.0.1:8766/test/e2e/";
  const URL_ARRIVO = "?utm_source=linkedin&utm_medium=social&utm_campaign=231026-test&utm_content=test-e2e&fdt_cid=";
  const ricevuti = {};
  await page.route("https://api.fdt.digital/webhook/**", async (route) => {
    const nome = route.request().url().includes("report-ias") ? "ias" : "stile-manageriale";
    ricevuti[nome] = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ esito: "ok", dimensione: "grande" }) });
  });
  // Lo stile manageriale, dopo il successo, va alla pagina di ringraziamento del sito: la si intercetta
  await page.route("https://www.fattoriadeitalenti.it/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>grazie (finta)</p>" }));
  const esito = {};
  const verifica = (nome) => {
    const p = ricevuti[nome] || {};
    return { fdt_cid: p.fdt_cid || null, utm_campaign: p.utm_campaign || null, referrer_host: p.referrer_host || null, referrer_path: p.referrer_path || null, pagina: p.pagina || null };
  };

  // ---- IAS ----
  await page.goto(BASE + "ias.html" + URL_ARRIVO + "e2e-ias", { referer: "https://www.google.com/" });
  esito.ias_barra_dopo_arrivo = page.url();
  await page.reload();                                  // ricarica: con la v1.2.0 qui si perdeva fdt_cid
  await page.waitForSelector("#ias-nome");
  await page.fill("#ias-nome", "Test"); await page.fill("#ias-cognome", "E2E");
  await page.fill("#ias-email", "test+e2e-ias@fattoriadeitalenti.it");
  await page.fill("#ias-dip", "20"); await page.fill("#ias-tel", "3330000000"); await page.fill("#ias-azienda", "Prova Srl");
  await page.check("#ias-privacy");
  await page.click("#ias-form-dati button[type=submit]");
  for (let i = 0; i < 30; i++) {
    const btn = page.locator(".ias-question:not([hidden]) .ias-answer-btn").first();
    await btn.waitFor({ state: "visible" });
    await btn.click();
    await page.waitForTimeout(450);
  }
  await page.waitForFunction(() => window.turnstile && document.querySelector("#ias-turnstile iframe, #ias-turnstile input[name='cf-turnstile-response']"), null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.click("#ias-valuta");
  await page.waitForFunction(() => document.querySelector(".ias-test-success"), null, { timeout: 20000 });
  esito.ias = verifica("ias");

  // ---- Stile manageriale (nuova visita: nuova scheda pulita) ----
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(BASE + "stile-manageriale.html" + URL_ARRIVO + "e2e-stile", { referer: "https://www.linkedin.com/" });
  await page.reload();
  await page.waitForSelector("#mt-nome");
  await page.fill("#mt-nome", "Test"); await page.fill("#mt-cognome", "E2E"); await page.fill("#mt-azienda", "Prova Srl");
  await page.fill("#mt-ruolo", "Titolare"); await page.fill("#mt-email", "test+e2e-stile@fattoriadeitalenti.it");
  await page.click("#user-form button[type=submit]");
  for (let i = 0; i < 200 && !ricevuti["stile-manageriale"]; i++) {
    const btn = page.locator("#answers .answer-option").first();
    if (await btn.count() === 0) { await page.waitForTimeout(500); continue; }
    await btn.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  esito.stile = verifica("stile-manageriale");
  esito.payload_ias_chiavi = Object.keys(ricevuti.ias || {}).sort().join(",");
  esito.payload_stile_chiavi = Object.keys(ricevuti["stile-manageriale"] || {}).sort().join(",");
  return JSON.stringify(esito, null, 1);
}
