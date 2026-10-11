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
    const rejected = [];
    for (const line of lines) {
      // Columnas separadas por tabulador: descripción | cantidad | precio unitario.
      let cols = line.split(/\t/).map(s => s.trim()).filter(Boolean);
      // PDF.js suele dividir cada palabra del producto en una pieza independiente.
      // Solo se reagrupan piezas si las dos últimas son números claros (cantidad y precio).
      if (cols.length > 4 && /^\d+(?:[.,]\d+)?$/.test(cols.at(-2)) && /^\d+(?:[.,]\d{1,2})?$/.test(cols.at(-1))) {
        cols = [cols.slice(0,-2).join(" "), ...cols.slice(-2)];
      }
      if (cols.length < 3) continue;
      const reject = (reason) => rejected.push({line: line.slice(0, 180), reason});
      if ((cols.length !== 3 && cols.length !== 4) || !cols[0] || !/^\d+(?:[.,]\d+)?$/.test(cols[1]) || !/^\d+(?:[.,]\d{1,2})?$/.test(cols[2])) {reject("Columnas, cantidad o precio no reconocidos");continue;}
      if (cols.length === 4) {
        if (!/^\d+(?:[.,]\d{1,2})?$/.test(cols[3])) {reject("Total no reconocido");continue;}
        const quantity = Number(cols[1].replace(",", "."));
        const unitPrice = Number(cols[2].replace(",", "."));
        const total = Number(cols[3].replace(",", "."));
        // Una diferencia mayor a dos céntimos puede significar columnas mal interpretadas.
        if (Math.abs(quantity * unitPrice - total) > 0.02) {reject("Total distinto de cantidad × precio; revisar descuentos o impuestos");continue;}
      }
      if (!supplier) {reject("Proveedor no identificado");continue;}
      records.push({ Proveedor: supplier, Producto: cols[0], Cantidad: cols[1], "Precio actual": cols[2], Factura: invoice, Fecha: date });
    }
    return {headers:["Proveedor","Producto","Cantidad","Precio actual","Factura","Fecha"],records,rejected};
  }
  function textItemsToLines(items) {
    const sorted = (items || []).filter(i => i && i.str && i.transform).map(i=>({str:i.str.trim(),x:i.transform[4],y:i.transform[5]})).filter(i=>i.str);
    sorted.sort((a,b)=> b.y-a.y || a.x-b.x);
    const lines=[];
    for (const item of sorted) {
      const last=lines[lines.length-1];
      if (!last || Math.abs(last.y-item.y)>=3) lines.push({y:item.y,parts:[item]});
      else last.parts.push(item);
    }
    return lines.map(l=>l.parts.sort((a,b)=>a.x-b.x).map(v=>v.str).join("\t")).join("\n");
  }
  root.margenPdfText = {parseInvoiceText,textItemsToLines};
})(typeof window !== "undefined" ? window : globalThis);
