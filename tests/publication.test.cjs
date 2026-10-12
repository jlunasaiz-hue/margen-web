const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
const index=read("index.html");
const app=read("app.html");
const manifest=JSON.parse(read("manifest.webmanifest"));
const pkg=JSON.parse(read("package.json"));
const sitemap=read("sitemap.xml");
const build=read("scripts/build-pages.mjs");
const workflow=read(".github/workflows/pages.yml");

test("la página comercial puede indexarse y utiliza una URL canónica coherente",()=>{
 assert.match(index,/<meta name="robots" content="index,follow"/);
 assert.match(index,/<link rel="canonical" href="https:\/\/zarviqo\.com\/"/);
 assert.match(index,/<meta name="description" content="[^"]{70,180}"/);
 assert.match(index,/<meta property="og:title"/);
 assert.match(index,/<meta property="og:image"/);
 assert.match(index,/<meta name="twitter:card"/);
 assert.match(index,/<meta name="viewport" content="width=device-width, initial-scale=1\.0"/);
});
test("los datos estructurados del sitio son JSON válido sin organizaciones inventadas",()=>{
 const raw=index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
 assert.ok(raw);
 const data=JSON.parse(raw[1]);
 assert.equal(data["@type"],"WebSite");
 assert.equal(data.url,"https://zarviqo.com/");
 assert.equal(data.inLanguage,"es-ES");
});
test("el panel queda accesible pero fuera del índice de Google",()=>{
 assert.match(app,/<meta name="robots" content="noindex,follow"/);
 assert.match(app,/href="https:\/\/zarviqo\.com\/app\.html"/);
 assert.match(index,/href="\.\/app\.html"/);
});
test("el sitemap solo incluye la dirección de la página comercial",()=>{
 assert.match(sitemap,/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
 assert.match(sitemap,/<loc>https:\/\/zarviqo\.com\/<\/loc>/);
 assert.doesNotMatch(sitemap,/app\.html/);
});
test("el manifiesto instala el panel desde el subdirectorio correcto",()=>{
 assert.equal(manifest.start_url,"./app.html");
 assert.equal(manifest.scope,"./");
 assert.equal(manifest.display,"standalone");
});
test("la publicación automática comprueba el código antes de desplegar recursos",()=>{
 assert.equal(pkg.scripts["build:pages"],"node scripts/build-pages.mjs");
 assert.match(workflow,/run: npm run check/);
 assert.match(workflow,/run: npm run build:pages/);
 assert.match(workflow,/uses: actions\/deploy-pages@v4/);
 assert.match(workflow,/path: _site/);
 assert.match(build,/writeFileSync\(join\(OUT,"\.nojekyll"\)/);
 assert.match(build,/const assets=\[/);
 assert.doesNotMatch(build,/copyFileSync\(ROOT/);
});
