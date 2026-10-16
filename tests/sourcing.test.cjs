const test=require("node:test");
const assert=require("node:assert/strict");
const {compare}=require("../sourcing-core.js");
const row=(supplier,item,current,quantity,date="2026-10-12",unit="kg",extra={})=>({supplier,item,current,quantity,date,unit,...extra});
test("compares only exact normalized product and unit across suppliers",()=>{
  const result=compare([row("A","Pechuga de pollo",7.28,36),row("B","pechuga DE pollo",6.85,12)]);
  assert.equal(result.length,1);
  assert.equal(result[0].fromSupplier,"A");
  assert.equal(result[0].toSupplier,"B");
  assert.equal(result[0].comparisonAmount,15.48);
});
test("different packaging and units never compare",()=>{
  assert.deepEqual(compare([row("A","Aceite 5 L",20,5,"2026-10-12","garrafa"),row("B","Aceite 1 L",5,10,"2026-10-12","garrafa")]),[]);
  assert.deepEqual(compare([row("A","Arroz",2,5),row("B","Arroz",1,5,"2026-10-12","caja")]),[]);
});
test("only latest price per supplier and no duplicates",()=>{
  const r=compare([row("A","Arroz",5,10,"2026-10-01"),row("A","Arroz",4,10,"2026-10-12"),row("B","Arroz",3,2),row("B","Arroz",1,100,"2026-10-13","kg",{possibleDuplicate:true})]);
  assert.equal(r.length,1);
  assert.equal(r[0].fromPrice,4);
  assert.equal(r[0].comparisonAmount,10);
});
test("stale comparisons and invalid values are excluded",()=>{
  assert.deepEqual(compare([row("A","Arroz",4,10,"2026-10-12"),row("B","Arroz",3,10,"2026-01-01")]),[]);
  assert.deepEqual(compare([row("A","Arroz",4,10),row("B","Arroz",3,10,"", "kg")]),[]);
  assert.deepEqual(compare([row("A","Arroz",4,10),row("B","Arroz",NaN,10)]),[]);
});
test("equal prices and same supplier are not alternatives",()=>{
  assert.deepEqual(compare([row("A","Arroz",4,10),row("B","Arroz",4,20)]),[]);
  assert.deepEqual(compare([row("A","Arroz",4,10),row("A","Arroz",2,20)]),[]);
});
test("does not multiply the estimate by an invented monthly frequency",()=>{
  const r=compare([row("A","Arroz",8,3),row("B","Arroz",7,100)]);
  assert.equal(r[0].comparisonAmount,3);
  assert.equal("annualizedAmount" in r[0],false);
});
test("rejects invalid options and input",()=>{
  assert.throws(()=>compare({}),/lista/);
  assert.throws(()=>compare([], {maxAgeDays:-1}),/Antigüedad/);
});
