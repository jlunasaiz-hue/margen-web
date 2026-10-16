const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const dist = fs.existsSync(path.join(__dirname,"..","app.html")) ? path.join(__dirname,"..") : path.join(__dirname,"..","dist");
const landing = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const app = fs.readFileSync(path.join(dist, "app.html"), "utf8");
const privacy = fs.readFileSync(path.join(dist, "privacidad.html"), "utf8");
const legal = fs.readFileSync(path.join(dist, "aviso-legal.html"), "utf8");
const cookies = fs.readFileSync(path.join(dist, "cookies.html"), "utf8");
const metrics = fs.readFileSync(path.join(dist, "metrics.js"), "utf8");

test("la landing y la aplicación son páginas independientes", () => {
  assert.match(landing, /<h1(?:\s+[^>]*)?>ZARVIQO detecta subidas de precio/);
  assert.match(app, /id="overviewView"/);
});

test("la landing explica el piloto y mantiene una única acción comercial", () => {
  assert.match(landing, /39 €/);
  assert.match(landing, /30 días/);
  assert.match(landing, /Hasta 30/);
  assert.match(landing, /Plazo acordado en el piloto/);
  assert.doesNotMatch(landing, /Comprar|Suscribirse|Crear cuenta/);
  assert.match(landing, /Solicitar el piloto/);
});

test("incluye metadatos, salto accesible y páginas legales", () => {
  assert.match(landing, /property="og:title"/);
  assert.match(landing, /href="#contenido">Saltar al contenido/);
  assert.match(app, /href="#appMain">Saltar al contenido/);
  assert.match(privacy, /Política de privacidad/);
  assert.match(legal, /Aviso legal/);
  assert.match(cookies, /no utiliza cookies publicitarias/i);
});

test("la medición se limita a tres contadores locales sin datos personales", () => {
  assert.match(metrics, /landing_visit/);
  assert.match(metrics, /pilot_click/);
  assert.match(metrics, /demo_use/);
  assert.doesNotMatch(metrics, /fetch\(|sendBeacon|XMLHttpRequest/);
});
