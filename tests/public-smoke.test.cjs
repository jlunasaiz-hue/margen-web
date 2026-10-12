const test=require("node:test");
const assert=require("node:assert/strict");

let modulePromise=import("../scripts/public-smoke.mjs");
test("la URL del despliegue solo admite HTTPS y genera subrutas correctas",async()=>{
  const {parseSiteUrl}=await modulePromise;
  const url=parseSiteUrl("https://example.github.io/margen-web");
  assert.equal(url.href,"https://example.github.io/margen-web/");
  assert.equal(new URL("app.html",url).href,"https://example.github.io/margen-web/app.html");
  for(const unsafe of ["http://example.com/","https://user:secret@example.com/","https://example.com/?token=secreto"]){
    assert.throws(()=>parseSiteUrl(unsafe));
  }
});
test("la prueba de producción comprueba cuatro recursos esenciales",async()=>{
  const {CHECKS}=await modulePromise;
  assert.deepEqual(CHECKS.map(check=>check.path),["./","app.html","sitemap.xml","pilot-request.js"]);
});
test("una respuesta HTTP correcta pero vacía no se considera despliegue válido",async()=>{
  const {checkResponse,CHECKS}=await modulePromise;
  assert.equal(checkResponse("",CHECKS[0]),false);
  assert.equal(checkResponse(CHECKS[0].contains.join(" "),CHECKS[0]),true);
});
test("detecta fallos parciales del alojamiento sin inventar éxito",async()=>{
  const {inspectSite,parseSiteUrl,CHECKS}=await modulePromise;
  let count=0;
  const base=parseSiteUrl("https://example.github.io/margen-web/");
  const errors=await inspectSite(base,async url=>{
    count++;
    const check=CHECKS.find(v=>new URL(v.path,base).href===url);
    if(!check)throw Error("Ruta inesperada");
    return {ok:check.path!=="app.html",status:404,text:async()=>check.contains.join(" \n")};
  });
  assert.equal(count,4);
  assert.equal(errors.length,1);
  assert.match(errors[0],/Panel de compras/);
});
test("acepta alojamiento que ofrece todos los archivos y sus marcadores",async()=>{
  const {inspectSite,parseSiteUrl,CHECKS}=await modulePromise;
  const base=parseSiteUrl("https://example.github.io/margen-web/");
  const errors=await inspectSite(base,async url=>{
    const check=CHECKS.find(v=>new URL(v.path,base).href===url);
    return {ok:true,status:200,text:async()=>check.contains.join(" \n")};
  });
  assert.deepEqual(errors,[]);
});
