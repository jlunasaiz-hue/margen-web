import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

export const CHECKS = [
  { path: "./", title: "Página comercial", contains: ['<h1>Margen detecta subidas de precio', 'src="./pilot-request.js'] },
  { path: "app.html", title: "Panel de compras", contains: ['id="overviewView"', 'src="./app.js'] },
  { path: "sitemap.xml", title: "Mapa del sitio", contains: ["<urlset", "<loc>https://"] },
  { path: "pilot-request.js", title: "Formulario comercial", contains: ["margenPilot", "contactIsValid"] }
];
export function parseSiteUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash)
    throw Error("El despliegue debe tener una URL HTTPS válida y pública.");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}
export function checkResponse(text, check) {
  return check.contains.every(part => text.includes(part));
}
export async function inspectSite(base, fetcher=fetch) {
  const errors=[];
  for(const check of CHECKS) {
    const destination=new URL(check.path,base);
    try{
      const response=await fetcher(destination.href,{
        cache:"no-store",
        signal:AbortSignal.timeout(10000)
      });
      if(!response.ok)throw Error("HTTP "+response.status);
      const body=await response.text();
      if(!checkResponse(body,check))throw Error("La respuesta no contiene los elementos esperados");
      console.log("OK",check.title,destination.href);
    }catch(error){
      errors.push(check.title+": "+error.message);
    }
  }
  return errors;
}
export async function main(site=process.argv[2]) {
  if(!site)throw Error("Indica la URL pública, por ejemplo https://usuario.github.io/repositorio/");
  const base=parseSiteUrl(site);
  let errors=[];
  for(let attempt=1;attempt<=8;attempt++){
    console.log("Comprobación del despliegue:",attempt,"de 8");
    errors=await inspectSite(base);
    if(!errors.length){console.log("La web pública responde correctamente.");return;}
    if(attempt<8)await delay(6000);
  }
  throw Error("El despliegue no supera la comprobación pública:\n"+errors.join("\n"));
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url){
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
