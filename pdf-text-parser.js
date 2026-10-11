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
      if ((cols.length !== 3 && cols.length !== 4) || !cols[0] || !/^\d+(?:[.,]\d+)?$/.test(cols[1]) || !/^\d+(?:[.,]\d{1,2})?$/.test(cols[2])) continue;
      if (cols.length === 4) {
        if (!/^\d+(?:[.,]\d{1,2})?$/.test(cols[3])) continue;
        const quantity = Number(cols[1].replace(",", "."));
        const unitPrice = Number(cols[2].replace(",", "."));
        const total = Number(cols[3].replace(",", "."));
        // Una diferencia mayor a dos céntimos puede significar columnas mal interpretadas.
        if (Math.abs(quantity * unitPrice - total) > 0.02) continue;
      }
      if (!supplier) continue; // Nunca atribuir compras a un proveedor desconocido.
      records.push({ Proveedor: supplier, Producto: cols[0], Cantidad: cols[1], "Precio actual": cols[2], Factura: invoice, Fecha: date });
    }
    return {headers:["Proveedor","Producto","Cantidad","Precio actual","Factura","Fecha"],records};
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
