const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const pilot=require("../pilot-request.js");

const sample=(extra={})=>({
  restaurant:"Restaurante de prueba",name:"Cliente de ejemplo",
  contact:"contacto@ejemplo.es",format:"PDF",
  problem:"Nos han subido el precio de los productos básicos.",
  consent:"on",...extra
});
const index=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const landing=fs.readFileSync(path.join(__dirname,"..","landing.js"),"utf8");
const sw=fs.readFileSync(path.join(__dirname,"..","sw.js"),"utf8");

test("acepta solicitudes completas sin enviar información por la red",()=>{
  const check=pilot.validate(sample());
  assert.equal(check.ok,true);
  const prepared=pilot.message(check);
  assert.match(prepared,/Restaurante de prueba/);
  assert.match(prepared,/La solicitud no implica contratación, pago ni confirmación de plaza/);
  assert.match(prepared,/39 €/);
  assert.match(prepared,/30 días/);
});
test("requiere consentimiento y rechaza campos vacíos o problemáticos",()=>{
  for(const bad of [
    {consent:""},{consent:false},{restaurant:"A"},
    {name:"M"},{contact:"no-es-un-contacto"},
    {contact:"12345"},{format:"Formato inventado"},
    {problem:"Corto"},{problem:"x".repeat(601)}
  ]){
    const result=pilot.validate(sample(bad));
    assert.equal(result.ok,false,JSON.stringify(bad));
    assert.ok(result.error);
  }
});
test("admite correo o teléfono de un cliente válido",()=>{
  assert.equal(pilot.validate(sample({contact:"600 123 456"})).ok,true);
  assert.equal(pilot.validate(sample({contact:"+34 600 123 456"})).ok,true);
  assert.equal(pilot.validate(sample({contact:"contacto@ejemplo.es"})).ok,true);
});
test("no crea un correo dirigido a nadie si falta la dirección comercial",()=>{
  const valid=pilot.validate(sample());
  assert.throws(()=>pilot.emailUrl("",valid),/correo comercial/);
  assert.throws(()=>pilot.emailUrl("sin-arroba",valid),/correo comercial/);
});
test("prepara correo dirigido con contenido codificado cuando se configure",()=>{
  const valid=pilot.validate(sample({restaurant:"Bar Azul & Verde",problem:"Subieron 10 % los precios."}));
  const url=pilot.emailUrl("pilotos@ejemplo.es",valid);
  assert.match(url,/^mailto:pilotos%40ejemplo\.es\?/);
  assert.match(url,/subject=Solicitud%20de%20piloto%20Margen/);
  assert.match(url,/body=/);
  assert.ok(!url.includes("\n"));
  assert.ok(!url.includes("undefined"));
});
test("nombres de descarga seguros incluso con caracteres especiales",()=>{
  const valid=pilot.validate(sample({restaurant:"Bar Café/Mar <prueba>"}));
  const name=pilot.filename(valid);
  assert.match(name,/^solicitud-margen-[a-z0-9-]+\.txt$/);
  assert.doesNotMatch(name,/[<>/\\]/);
});
test("la interfaz presenta el estado real de la solicitud y botones disponibles",()=>{
  assert.match(index,/id="pilotForm"/);
  assert.match(index,/id="pilotPreview"/);
  assert.match(index,/id="pilotPreviewText"/);
  assert.match(index,/id="downloadPilotButton"/);
  assert.match(index,/id="copyPilotButton"/);
  assert.match(index,/id="pilotEmailButton" hidden/);
  assert.match(index,/Preparar y revisar solicitud/);
  assert.doesNotMatch(index,/TU_CORREO_DE_CONTACTO/);
  assert.match(landing,/pilotPreviewText\.textContent = pilotCore\.message/);
  assert.match(landing,/const PILOT_CONTACT = ""/);
  assert.ok(index.indexOf('src="./pilot-request.js') < index.indexOf('src="./landing.js'));
  assert.match(sw,/'pilot-request\.js'/);
});
test("no guarda el formulario en el navegador ni realiza solicitudes silenciosas",()=>{
  assert.doesNotMatch(landing,/fetch\s*\(|sendBeacon|XMLHttpRequest/);
  assert.doesNotMatch(landing,/localStorage\.setItem\([^)]*(restaurant|contact|problem)/);
  assert.match(landing,/Solicitud preparada en este dispositivo/);
});
