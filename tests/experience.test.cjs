const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const html=read("index.html"),css=read("experience.css"),js=read("experience.js"),sw=read("sw.js");
test("experiencia de scroll aparece con escenas y pasos reales",()=>{
  assert.match(html,/id="zarviqoJourney"/);
  assert.equal((html.match(/data-journey-step/g)||[]).length,3);
  assert.equal((html.match(/data-story-visual/g)||[]).length,3);
  assert.match(html,/id="siteProgress"/);
  assert.ok(html.indexOf("id=\"zarviqoJourney\"")<html.indexOf('id="simulador"'));
});
test("el sitio no bloquea navegación ni altera el panel",()=>{
  assert.match(html,/href="\.\/app\.html\?demo=1"/);
  assert.match(html,/id="pilotForm"/);
  assert.match(html,/id="costCalculator"/);
  assert.doesNotMatch(js,/\bfetch\s*\(|\bXMLHttpRequest\b|\blocalStorage\b/);
});
test("las animaciones son progresivas y accesibles",()=>{
  assert.match(js,/prefers-reduced-motion: reduce/);
  assert.match(js,/connection\?\.saveData/);
  assert.match(js,/IntersectionObserver/);
  assert.match(js,/requestAnimationFrame/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.story-visual\{position:sticky/);
  assert.match(css,/\.fx-tilt/);
});
test("nuevos recursos se publican en Cloudflare y se guardan para uso offline",()=>{
  assert.match(html,/experience\.css\?v=/);
  assert.match(html,/experience\.js\?v=/);
  assert.match(sw,/'experience\.css'/);
  assert.match(sw,/'experience\.js'/);
  assert.match(sw,/20261016-zarviqo-motion-1/);
});
