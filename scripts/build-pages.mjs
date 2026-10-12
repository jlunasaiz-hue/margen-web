import {readFileSync,existsSync,mkdirSync,copyFileSync,writeFileSync,rmSync} from "node:fs";
import {dirname,join,resolve,sep} from "node:path";

const ROOT=resolve(import.meta.dirname,"..");
const OUT=resolve(ROOT,"_site");
const source=readFileSync(join(ROOT,"sw.js"),"utf8");
const match=source.match(/const FILES=\[([\s\S]*?)\];/);
if(!match)throw Error("No se ha podido extraer la lista de archivos públicos del service worker.");
const assets=[...match[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
if(assets.length<20||new Set(assets).size!==assets.length)throw Error("La lista de archivos públicos está vacía o contiene duplicados.");
const files=[...assets,"sw.js","sitemap.xml","robots.txt"];
if(existsSync(OUT))rmSync(OUT,{recursive:true,force:true});
mkdirSync(OUT,{recursive:true});
for(const asset of files){
  const from=resolve(ROOT,asset),to=resolve(OUT,asset);
  if(!from.startsWith(ROOT+sep)||!to.startsWith(OUT+sep))throw Error("Ruta pública no segura: "+asset);
  if(!existsSync(from))throw Error("Falta un recurso necesario para publicar la web: "+asset);
  mkdirSync(dirname(to),{recursive:true});
  copyFileSync(from,to);
}
writeFileSync(join(OUT,".nojekyll"),"");
const index=readFileSync(join(OUT,"index.html"),"utf8");
if(!index.includes('content="index,follow')||!index.includes('rel="canonical"'))throw Error("La página principal carece de metadatos de indexación.");
console.log("Sitio público preparado: "+files.length+" archivos, en "+OUT);
