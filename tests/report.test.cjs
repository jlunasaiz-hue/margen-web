const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const report=require("../report-core.js");
const sample=(overrides={})=>({
  id:"row-1",supplier:"Proveedor Mediterráneo",item:"Aceite de oliva",unit:"litro",
  date:"2026-10-12",invoice:"FAC-2026-8",current:9,previous:7,quantity:3,
  reviewed:false,possibleDuplicate:false,...overrides
});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,String(a)+" != "+String(b));

test("una subida normal se cuenta exactamente una vez",()=>{
  const summary=report.summarize([sample()]);
  near(summary.spending,27);near(summary.price,6);near(summary.toReview,6);
  near(summary.pendingAmount,6);assert.equal(summary.pending,1);
});
test("una línea duplicada con subida no duplica el importe de revisión",()=>{
  const entry=sample({possibleDuplicate:true,current:10,previous:6,quantity:4});
  const amount=report.amount(entry);
  near(amount.price,16);near(amount.duplicate,40);near(amount.toReview,40);
  const summary=report.summarize([entry]);
  near(summary.toReview,40);near(summary.pendingAmount,40);
});
test("una alerta revisada no aparece como importe pendiente",()=>{
  const summary=report.summarize([sample({reviewed:true}),sample({id:"row-2",current:11})]);
  assert.equal(summary.pending,1);assert.equal(summary.reviewed,1);
  near(summary.pendingAmount,12);near(summary.toReview,18);
});
test("una compra sin alerta no infla el informe",()=>{
  const summary=report.summarize([sample({current:6,previous:8})]);
  assert.equal(summary.alerts,0);near(summary.toReview,0);
});
test("la exportación CSV bloquea fórmulas introducidas en texto",()=>{
  for(const dangerous of ["=2+2","+cmd","-cmd","@SHELL"," \t=SUM(A1:A2)"])
    assert.ok(report.csvCell(dangerous).startsWith("'"),dangerous);
  assert.equal(report.csvCell(12.5),"12.5");
  assert.equal(report.csvCell('Aceite; "extra"'),'"Aceite; ""extra"""');
  assert.equal(report.csvCell("Línea\nsiguiente"),'"Línea\nsiguiente"');
});
test("el informe escapa contenido peligroso y no permite scripts externos",()=>{
  const html=report.reportHtml([sample({
    item:'<img src=x onerror=alert(1)>',
    supplier:'" onclick="alert(1)',
    invoice:'<script>alert(1)</script>',
    matching:{originalItem:'<svg onload=alert(1)>',originalUnit:'caja',originalCurrent:12,confirmed:false}
  })],{source:'<script>alert(3)</script>',generatedAt:"12/10/2026",isDemo:false});
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(html.includes("&lt;script&gt;alert(3)&lt;/script&gt;"));
  assert.ok(!html.includes('<img src=x onerror'));
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.match(html,/Content-Security-Policy/);
  assert.match(html,/@media print/);
});
test("los datos ficticios quedan identificados y los informes funcionan vacíos",()=>{
  const html=report.reportHtml([],{isDemo:true,source:"Ejemplo"});
  assert.match(html,/datos de ejemplo/i);
  assert.match(html,/No se han detectado alertas/);
});
test("rechaza entradas no válidas",()=>{
  assert.throws(()=>report.summarize(null),/historial/);
  assert.throws(()=>report.summarize([sample({quantity:-1})]),/fuera de rango/);
  assert.throws(()=>report.summarize([sample({current:Infinity})]),/fuera de rango/);
});
test("el motor de la aplicación no cuenta dos veces una línea duplicada y recalcula al borrar",()=>{
  const script=fs.readFileSync("app.js","utf8")
    .replace(/\ninit\(\);[\s\S]*$/,"\n;globalThis.reportsTest={analyze,normalizeRow};");
  const ctx={Intl,console,setTimeout,clearTimeout,URL,Blob,TextDecoder,performance,Map};
  vm.createContext(ctx);vm.runInContext(script,ctx);
  const first=sample({id:"first",invoice:"F-1",current:10,previous:8,quantity:4});
  const second=sample({id:"second",invoice:"F-1",current:10,previous:8,quantity:4});
  const rows=ctx.reportsTest.analyze([first,second]);
  near(rows[0].impact,8);
  near(rows[1].priceImpact,8);
  near(rows[1].duplicateImpact,40);
  near(rows[1].impact,40);
  const afterRemove=ctx.reportsTest.analyze(rows.slice(1));
  assert.equal(afterRemove[0].possibleDuplicate,false);
  near(afterRemove[0].impact,8);
});

test("ordena los proveedores por el coste pendiente y separa importes ya revisados",()=>{
  const summary=report.supplierPriority([
    sample({supplier:"B",current:7,previous:5,quantity:5}),
    sample({supplier:"A",current:12,previous:7,quantity:10}),
    sample({supplier:"A",reviewed:true,current:20,previous:7,quantity:10})
  ]);
  assert.equal(summary[0].supplier,"A");
  near(summary[0].pendingAmount,50);
  near(summary[0].totalAmount,180);
  assert.equal(summary[0].reviewed,1);
  near(summary[1].pendingAmount,10);
  const html=report.reportHtml([sample({supplier:"A"})]);
  assert.match(html,/Proveedores prioritarios/);
});
