(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.margenReport=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const EUR=new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"});
  const DECIMAL=new Intl.NumberFormat("es-ES",{maximumFractionDigits:2});
  function escape(value){
    return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function number(value){
    return typeof value==="number"&&Number.isFinite(value)?value:0;
  }
  function isAlert(row){return number(row.current)>number(row.previous)||Boolean(row.possibleDuplicate);}
  function amount(row){
    const current=number(row.current),previous=number(row.previous),qty=Math.max(0,number(row.quantity));
    const price=Math.max(0,(current-previous)*qty);
    const duplicate=row.possibleDuplicate?Math.max(0,current*qty):0;
    return {price,duplicate,toReview:row.possibleDuplicate?duplicate:price};
  }
  function summarize(rows){
    if(!Array.isArray(rows))throw Error("Se necesita un historial de compras válido.");
    let spending=0,price=0,duplicate=0,toReview=0,pendingAmount=0,pending=0,reviewed=0;
    const suppliers=new Set();
    for(const row of rows){
      if(!row||typeof row!=="object")throw Error("Hay una compra no válida.");
      const qty=row.quantity,current=row.current;
      if(typeof qty!=="number"||typeof current!=="number"||!Number.isFinite(qty)||!Number.isFinite(current)||qty<0||current<0||!Number.isFinite(qty*current))throw Error("La compra contiene un importe fuera de rango.");
      spending+=qty*current;
      if(typeof row.supplier==="string"&&row.supplier.trim())suppliers.add(row.supplier.trim());
      if(isAlert(row)){
        const x=amount(row);price+=x.price;duplicate+=x.duplicate;toReview+=x.toReview;
        if(row.reviewed)reviewed++;else{pending++;pendingAmount+=x.toReview;}
      }
    }
    if([spending,price,duplicate,toReview,pendingAmount].some(x=>!Number.isFinite(x)||x>1e15))throw Error("Total fuera de rango.");
    return {lines:rows.length,suppliers:suppliers.size,spending,price,duplicate,toReview,pendingAmount,pending,reviewed,alerts:pending+reviewed};
  }
  function supplierPriority(rows){
    const grouped=new Map();
    for(const row of rows){
      if(!isAlert(row))continue;
      const name=String(row.supplier||"Sin proveedor").trim()||"Sin proveedor";
      if(!grouped.has(name))grouped.set(name,{supplier:name,alerts:0,pending:0,reviewed:0,pendingAmount:0,totalAmount:0});
      const value=grouped.get(name),cost=amount(row).toReview;
      value.alerts++;
      value.totalAmount+=cost;
      if(row.reviewed)value.reviewed++;
      else{value.pending++;value.pendingAmount+=cost;}
    }
    return [...grouped.values()].sort((a,b)=>b.pendingAmount-a.pendingAmount||b.pending-a.pending||a.supplier.localeCompare(b.supplier,"es"));
  }
  function csvCell(value){
    const numeric=typeof value==="number"&&Number.isFinite(value);
    let s=String(value??"");
    if(!numeric&&/^[\s\uFEFF]*[=+\-@]/.test(s))s="'"+s;
    return /[;"\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  }
  function reportHtml(rows,options={}){
    const totals=summarize(rows);
    const context=escape(String(options.source||"Compras registradas").slice(0,160));
    const moment=escape(String(options.generatedAt||"Fecha no indicada").slice(0,80));
    const demo=Boolean(options.isDemo);
    const matchingSource=row=>{
      if(!row.matching)return "Datos tal como figuran en la compra";
      const m=row.matching;
      const original=escape(m.originalItem||row.item);
      const unit=escape(m.originalUnit||row.unit);
      const current=number(m.originalCurrent);
      return "Documento original: "+original+" · "+EUR.format(current)+" / "+unit+(m.confirmed?" · Coincidencia confirmada":" · Sin coincidencia confirmada");
    };
    const priorities=supplierPriority(rows);
    const prioritiesHtml=priorities.slice(0,10).map(entry=>'<tr><td>'+escape(entry.supplier)+'</td><td>'+entry.pending+'</td><td>'+EUR.format(entry.pendingAmount)+'</td><td>'+entry.reviewed+'</td></tr>').join('')||'<tr><td colspan="4">No hay alertas pendientes por proveedor.</td></tr>';
    const alerts=rows.filter(isAlert);
    const sorted=alerts.slice().sort((a,b)=>amount(b).toReview-amount(a).toReview);
    const lines=sorted.map(row=>{
      const a=amount(row);
      const original=matchingSource(row);
      const reason=row.possibleDuplicate?"Posible línea duplicada"+(a.price>0?" y variación de precio":""):"Subida de precio";
      return "<tr><td><strong>"+escape(row.item)+"</strong><small>"+original+"</small></td>"
        +"<td>"+escape(row.supplier)+"</td><td>"+escape(row.invoice||"Sin número")+"<small>"+escape(row.date||"Sin fecha")+"</small></td>"
        +"<td>"+DECIMAL.format(number(row.quantity))+" "+escape(row.unit||"")+"</td>"
        +"<td>"+EUR.format(number(row.previous))+"</td><td>"+EUR.format(number(row.current))+"</td>"
        +"<td>"+escape(reason)+"<small>"+(row.reviewed?"Revisada":"Pendiente")+" · "+escape(row.previousSource||"origen sin especificar")+"</small></td>"
        +"<td>"+EUR.format(a.toReview)+"</td></tr>";
    }).join("");
    const body=lines||'<tr><td colspan="8">No se han detectado alertas con estos datos.</td></tr>';
    const styles=[
      ":root{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#19382a;background:#f4f7f4}",
      "*{box-sizing:border-box}body{max-width:1200px;margin:0 auto;padding:36px 24px}",
      "header{display:flex;justify-content:space-between;gap:20px;align-items:start;border-bottom:3px solid #246c4b;padding-bottom:20px}",
      "h1{margin:4px 0 8px;font-size:28px}h2{font-size:20px;margin:28px 0 12px}",
      "p,small{line-height:1.55;color:#435d50}p{font-size:14px}.tag{font-weight:700;letter-spacing:.1em;color:#246c4b;font-size:12px}",
      ".metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:26px 0}",
      ".metric{background:white;border:1px solid #d1ded5;padding:18px;border-radius:12px}",
      ".metric span,.metric strong{display:block}.metric span{font-size:12px;color:#496455}.metric strong{font-size:22px;margin-top:7px;overflow-wrap:anywhere}",
      ".notice{padding:16px 20px;background:#fff9e9;border:1px solid #ebd4a3;border-radius:10px;font-size:13px}",
      ".table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;background:white;font-size:12px}",
      "th,td{padding:12px;text-align:left;vertical-align:top;border-bottom:1px solid #d7e4da}th{background:#eaf2ec}td small{display:block;font-size:10px;margin-top:5px}",
      "footer{font-size:11px;color:#567061;margin-top:34px}a{color:inherit}",
      "@media(max-width:760px){body{padding:18px 12px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}header{display:block}.metric{padding:12px}.metric strong{font-size:18px}table{min-width:980px}}",
      "@page{size:A4 landscape;margin:12mm}@media print{body{max-width:none;padding:0;background:white}.metrics{grid-template-columns:repeat(4,1fr)}.table-scroll{overflow:visible}table{font-size:9px;min-width:0}th,td{padding:6px}.notice{break-inside:avoid}tr{break-inside:avoid}}"
    ].join("");
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      +'<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; base-uri &#39;none&#39;; form-action &#39;none&#39;">'
      +'<title>Margen — Informe de revisión</title><style>'+styles+'</style></head><body>'
      +'<header><div><div class="tag">MARGEN · CONTROL DE COMPRAS</div><h1>Informe de revisión</h1><p>'+context+'</p></div><div><p><strong>Generado:</strong> '+moment+'</p><p><strong>Alcance:</strong> '+(demo?"Datos ficticios de demostración":"Compras registradas")+'</p></div></header>'
      +'<section class="metrics" aria-label="Indicadores"><div class="metric"><span>Compras analizadas</span><strong>'+totals.lines+'</strong></div>'
      +'<div class="metric"><span>Proveedores</span><strong>'+totals.suppliers+'</strong></div>'
      +'<div class="metric"><span>Alertas pendientes</span><strong>'+totals.pending+'</strong></div>'
      +'<div class="metric"><span>Importe pendiente de revisión</span><strong>'+EUR.format(totals.pendingAmount)+'</strong></div></section>'
      +'<div class="notice"><strong>Importante:</strong> los importes son indicios para revisar y no equivalen a sobrecargos comprobados ni a ahorro recuperado. '
      +'Una misma línea que parece duplicada y tiene una subida no se suma dos veces. '
      +'Confirma factura, tarifas, descuentos, IVA y equivalencias con los documentos originales. '
      +(demo?"<strong>Todos los importes de este informe proceden de datos de ejemplo.</strong>":"")+'</div>'
      +'<p><strong>Gasto registrado:</strong> '+EUR.format(totals.spending)+' · <strong>Total de incidencias detectadas:</strong> '+EUR.format(totals.toReview)+' · <strong>Incidencias revisadas:</strong> '+totals.reviewed+'. No son importes recuperados.</p>'
      +'<h2>Proveedores prioritarios</h2><p>Ordenados por importe pendiente de revisar, no por una valoración de su conducta.</p>'
      +'<div class="table-scroll"><table><thead><tr><th>Proveedor</th><th>Alertas pendientes</th><th>Importe pendiente</th><th>Alertas revisadas</th></tr></thead><tbody>'+prioritiesHtml+'</tbody></table></div>'
      +'<h2>Alertas documentadas ('+totals.alerts+')</h2><div class="table-scroll"><table><thead><tr>'
      +'<th>Producto y trazabilidad</th><th>Proveedor</th><th>Factura y fecha</th><th>Cantidad</th><th>Precio anterior</th><th>Precio actual</th><th>Motivo y estado</th><th>Revisión estimada</th>'
      +'</tr></thead><tbody>'+body+'</tbody></table></div>'
      +'<footer>Margen · Informe local. Revisa este documento antes de compartirlo; puede contener información comercial sensible.</footer></body></html>';
  }
  return {escape,csvCell,amount,isAlert,summarize,supplierPriority,reportHtml};
});
