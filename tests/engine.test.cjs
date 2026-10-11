const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { performance } = require("node:perf_hooks");

const source = fs.readFileSync((fs.existsSync(path.join(__dirname, "..", "app.js")) ? path.join(__dirname, "..", "app.js") : path.join(__dirname, "..", "dist", "app.js")), "utf8");
const context = { Intl, console, setTimeout, clearTimeout, URL, Blob, TextDecoder, performance };
vm.createContext(context);
vm.runInContext(
  source.replace(
    /\ninit\(\);[\s\S]*$/,
    "\n;globalThis.engine={parseSpanishNumber,parseDelimited,normalizeDate,suggestMapping,normalizeProduct,buildImportedRows,analyze,state,SAMPLE_ROWS,getAlerts};"
  ),
  context
);

const engine = context.engine;

test("interpreta números españoles e internacionales", () => {
  const cases = [
    ["1.234,56 €", 1234.56],
    ["1,234.56", 1234.56],
    ["12,50", 12.5],
    ["1.234", 1234],
    ["(9,95)", -9.95]
  ];
  for (const [input, expected] of cases) {
    assert.ok(Math.abs(engine.parseSpanishNumber(input) - expected) < 0.0001, input);
  }
});

test("respeta separadores dentro de campos CSV entrecomillados", () => {
  const rows = engine.parseDelimited('Proveedor;Producto;Precio\n"Casa; Norte";Aceite;"1.234,56"\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], "Casa; Norte");
});

test("mapea columnas habituales sin duplicarlas", () => {
  const mapping = engine.suggestMapping(["Empresa", "Descripción", "Precio unitario", "Unidades", "Fecha factura"]);
  assert.equal(mapping.supplier, "Empresa");
  assert.equal(mapping.item, "Descripción");
  assert.equal(mapping.current, "Precio unitario");
  assert.equal(mapping.quantity, "Unidades");
  assert.equal(mapping.date, "Fecha factura");
  assert.equal(mapping.unit, "");
  assert.equal(mapping.invoice, "");
});

test("normaliza variantes del mismo producto", () => {
  assert.equal(engine.normalizeProduct("Aceite de girasol 5L"), engine.normalizeProduct("ACEITE GIRASOL 5 LT"));
  assert.equal(engine.normalizeDate("01/10/2026"), "2026-10-01");
});

test("infiere el precio anterior desde el historial", () => {
  engine.state.rows = engine.analyze([
    { supplier: "Frío Levante", item: "Pechuga pollo", unit: "kg", previous: 9, current: 10, quantity: 2, date: "2026-09-01" }
  ]);
  engine.state.source = "Compras reales";
  engine.state.pendingRows = [
    { Prov: "Frío Levante", Desc: "PECHUGA DE POLLO", Formato: "KG", Precio: "12,00", Cant: "3", Fecha: "01/10/2026" }
  ];
  engine.state.mapping = { supplier: "Prov", item: "Desc", unit: "Formato", current: "Precio", quantity: "Cant", date: "Fecha", previous: "", invoice: "" };
  const result = engine.buildImportedRows();
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].previous, 10);
  assert.equal(result.rows[0].impact, 6);
  assert.equal(result.rows[0].previousSource, "history");
});

test("procesa 5.000 líneas sin degradación cuadrática", () => {
  engine.state.rows = [];
  engine.state.source = "Compras reales";
  engine.state.mapping = { supplier: "Proveedor", item: "Artículo", current: "Precio", quantity: "Cantidad", date: "Fecha", unit: "", previous: "", invoice: "" };
  engine.state.pendingRows = Array.from({ length: 5000 }, (_, index) => ({
    Proveedor: `Proveedor ${index % 20}`,
    Artículo: `Producto ${index % 200}`,
    Precio: String(10 + (index % 50) / 10).replace(".", ","),
    Cantidad: "2",
    Fecha: `${String((index % 28) + 1).padStart(2, "0")}/09/2026`
  }));
  const started = performance.now();
  const result = engine.buildImportedRows();
  const elapsed = performance.now() - started;
  assert.equal(result.rows.length, 5000);
  assert.ok(elapsed < 2000, `El análisis tardó ${Math.round(elapsed)} ms`);
});

test("la demo incluye varios proveedores, subidas y un posible duplicado", () => {
  const rows = engine.analyze(engine.SAMPLE_ROWS);
  assert.ok(new Set(rows.map((row) => row.supplier)).size >= 4);
  assert.ok(rows.some((row) => row.delta > 0));
  const duplicate = rows.find((row) => row.possibleDuplicate);
  assert.ok(duplicate);
  assert.equal(duplicate.duplicateImpact, duplicate.current * duplicate.quantity);
});
