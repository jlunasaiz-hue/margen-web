/* Parser conservador para texto copiado de facturas PDF. No es OCR ni un lector de PDF. */
(function (root) {
  "use strict";
  function parseInvoiceText(text) {
    const lines = String(text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length > 3000 || String(text).length > 150000) throw Error("Texto demasiado largo. Procesa una factura cada vez.");
    const supplierLine = lines.find(l => /^proveedor\s*:/i.test(l));
    const supplier = supplierLine ? supplierLine.replace(/^proveedor\s*:/i, "").trim() : "";
    const invoice = (lines.find(l => /^(factura|n[úu]mero de factura)\s*:/i.test(l)) || "").replace(/^[^:]+:\s*/, "").trim();
    const date = (lines.find(l => /^fecha\s*:/i.test(l)) || "").replace(/^fecha\s*:/i, "").trim();
    const records = [];
    for (const line of lines) {
      // Columnas separadas por tabulador: descripción | cantidad | precio unitario.
      const cols = line.split(/\t/).map(s => s.trim());
      if (cols.length !== 3 || !cols[0] || !/^\d+(?:[.,]\d+)?$/.test(cols[1]) || !/^\d+(?:[.,]\d{1,2})?$/.test(cols[2])) continue;
      records.push({ Proveedor: supplier, Producto: cols[0], Cantidad: cols[1], "Precio actual": cols[2], Factura: invoice, Fecha: date });
    }
    return {headers:["Proveedor","Producto","Cantidad","Precio actual","Factura","Fecha"],records};
  }
  root.margenPdfText = {parseInvoiceText};
})(typeof window !== "undefined" ? window : globalThis);
