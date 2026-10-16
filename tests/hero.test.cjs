const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"landing.css"),"utf8");
const script=fs.readFileSync(path.join(root,"hero-3d.js"),"utf8");
const worker=fs.readFileSync(path.join(root,"sw.js"),"utf8");

test("el hero se muestra antes del selector de herramientas",()=>{
  assert.ok(html.indexOf('class="hero hero-experience"')<html.indexOf('class="tool-launcher"'));
  assert.match(html,/<h1 id="heroTitle">ZARVIQO detecta subidas de precio/);
  assert.match(html,/href="\.\/app\.html\?demo=1"/);
});
test("el lienzo 3D no oculta el contenido y existe alternativa visual",()=>{
  assert.match(html,/id="heroCanvas" aria-hidden="true"/);
  assert.match(html,/class="hero-orb-fallback"/);
  assert.match(html,/id="heroMotionToggle"[^>]*hidden/);
  assert.match(css,/\.hero-orb-fallback/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test("el efecto no descarga bibliotecas externas y respeta preferencias de ahorro",()=>{
  assert.match(script,/getContext\("webgl2"/);
  assert.match(script,/prefers-reduced-motion: reduce/);
  assert.match(script,/connection\.saveData/);
  assert.match(script,/IntersectionObserver/);
  assert.match(script,/visibilitychange/);
  assert.match(script,/cancelAnimationFrame/);
  assert.doesNotMatch(script,/\bfetch\s*\(|\bXMLHttpRequest\b|\bimport\s*\(/);
});
test("los archivos 3D se sirven como recursos propios de Pages y PWA",()=>{
  assert.match(html,/src="\.\/hero-3d\.js\?v=/);
  assert.match(worker,/'hero-3d\.js'/);
  assert.match(worker,/20261016-zarviqo-motion-1/);
});
