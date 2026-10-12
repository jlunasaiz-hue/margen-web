const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const matching=require('../product-matching.js');

function engine(){
  const source=fs.readFileSync('app.js','utf8').replace(/\ninit\(\);[\s\S]*$/,'\n;globalThis.importEngine={state,normalizeDate,validImportCell,invalidImportRowIndices,buildImportedRows,findPreviousPurchase,readImportFile,selectFile,resetImportFile,analyze,setRules:value=>{productRules=margenMatching.validateRules(value);}};');
  const elements=new Map();
  const element=selector=>{
    if(!elements.has(selector))elements.set(selector,{
      textContent:'',value:'',disabled:false,
      classList:{add(){},remove(){},toggle(){}}
    });
    return elements.get(selector);
  };
  const context={Intl,console,setTimeout,clearTimeout,URL,Blob,TextDecoder,performance,Map,margenMatching:matching,document:{querySelector:element}};
  vm.createContext(context);
  vm.runInContext(source,context);
  // El parser CSV y la lógica de importación se ejecutan realmente;
  // solo se sustituyen los elementos visuales durante las pruebas de carrera.
  vm.runInContext('renderMapping=()=>{};showPdfImportIssues=()=>{};updateImportAudit=()=>{};',context);
  return {api:context.importEngine,element};
}
const raw=(extra={})=>({supplier:'Costa',item:'Pollo',unit:'kg',current:8,quantity:2,previous:7,date:'2026-10-10',...extra});
const entry=(extra={})=>({Proveedor:'Costa',Producto:'Pollo',Unidad:'kg',Precio:'8',Cantidad:'2',Fecha:'10/10/2026',...extra});
function configure(api,rows=[],pending=[]){
 api.state.isDemo=false;api.state.rows=rows;api.state.pendingRows=pending;
 api.state.mapping={supplier:'Proveedor',item:'Producto',unit:'Unidad',current:'Precio',quantity:'Cantidad',date:'Fecha',previous:'',invoice:''};
 api.setRules([]);
}
const approx=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} frente a ${expected}`);
test('rechaza fechas inexistentes y acepta años bisiestos',()=>{
 const {api}=engine();
 for(const value of ['31/02/2026','2025-02-29','31/11/2026','00/09/2026','2026-13-01'])
  assert.equal(api.normalizeDate(value),'',value);
 assert.equal(api.normalizeDate('29/02/2024'),'2024-02-29');
 assert.equal(api.normalizeDate('12/10/2026'),'2026-10-12');
});
test('la revisión rechaza precios no positivos, cantidades nulas y fechas imposibles',()=>{
 const {api}=engine();configure(api,[],[entry({Precio:'0'}),entry({Cantidad:'-2'}),entry({Fecha:'31/02/2026'})]);
 assert.deepEqual([...api.invalidImportRowIndices()],[0,1,2]);
});
test('el precio anterior cero es válido y las fechas opcionales pueden quedar vacías',()=>{
 const {api}=engine();configure(api,[],[entry({Anterior:'0',Fecha:''})]);
 api.state.mapping.previous='Anterior';
 assert.equal(api.invalidImportRowIndices().length,0);
});
test('si se importa una factura antigua nunca usa una compra futura como referencia',()=>{
 const {api}=engine();configure(api,[raw({date:'2026-11-01',current:20}),raw({date:'2026-09-01',current:5})],[entry()]);
 const result=api.buildImportedRows();approx(result.rows[0].previous,5);approx(result.rows[0].priceImpact,6);
});
test('si falta la fecha, no se inventa una comparación por orden de importación',()=>{
 const {api}=engine();configure(api,[raw({date:'2026-09-01',current:6})],[entry({Fecha:''})]);
 const result=api.buildImportedRows();approx(result.rows[0].previous,8);approx(result.rows[0].impact,0);
});
test('dos compras nuevas se comparan por su fecha y no por su orden en el CSV',()=>{
 const {api}=engine();configure(api,[raw({date:'2026-09-01',current:6})],[entry({Fecha:'25/10/2026',Precio:'10'}),entry({Fecha:'01/10/2026',Precio:'8'})]);
 const result=api.buildImportedRows();approx(result.rows[0].previous,6);approx(result.rows[1].previous,8);
});
test('la búsqueda manual no utiliza facturas futuras ni sin fecha',()=>{
 const {api}=engine();configure(api,[raw({date:'2026-12-01',current:30}),raw({date:'2026-10-01',current:10})],[]);
 const previous=api.findPreviousPurchase({supplier:'Costa',item:'Pollo',unit:'kg',date:'2026-10-15'});
 assert.equal(previous.current,10);
 assert.equal(api.findPreviousPurchase({supplier:'Costa',item:'Pollo',unit:'kg'}),null);
});
test('vincular alias mantiene una comparación comprobable',()=>{
 const {api}=engine();const old=raw({item:'Pechuga de pollo',date:'2026-09-01',current:7});
 configure(api,[old],[entry({Producto:'PECH POLLO',Precio:'9'})]);
 api.setRules([matching.createRule(raw({item:'PECH POLLO'}),old)]);
 const [purchase]=api.buildImportedRows().rows;
 approx(purchase.previous,7);approx(purchase.current,9);approx(purchase.impact,4);
});
test('recalcular duplicados tras la importación detecta dos líneas idénticas',()=>{
 const {api}=engine();const r=raw({invoice:'F-1'}),results=api.analyze([r,{...r}]);
 assert.equal(results[0].possibleDuplicate,false);assert.equal(results[1].possibleDuplicate,true);
});
test('si el usuario cambia de archivo se ignora la lectura anterior',async()=>{
 const {api}=engine();configure(api);
 let resolveOld;
 const oldBuffer=new Promise(resolve=>{resolveOld=resolve;});
 const first={name:'primero.csv',size:200,arrayBuffer:()=>oldBuffer};
 const second={name:'segundo.csv',size:200,arrayBuffer:async()=>new TextEncoder().encode('proveedor;producto;precio_actual;cantidad\\nB;Merluza;12;2').buffer};
 const p1=api.selectFile(first);
 await api.selectFile(second);
 resolveOld(new TextEncoder().encode('proveedor;producto;precio_actual;cantidad\\nA;Pollo;9;2').buffer);
 await p1;
 assert.equal(api.state.pendingFile.name,'segundo.csv');
 assert.equal(api.state.pendingRows[0].proveedor,'B');
});
test('cancelar una lectura pendiente impide que escriba compras después',async()=>{
 const {api}=engine();configure(api);
 let finish;
 const pending=new Promise(resolve=>{finish=resolve;});
 const p=api.selectFile({name:'anterior.csv',size:200,arrayBuffer:()=>pending});
 api.resetImportFile();
 finish(new TextEncoder().encode('proveedor;producto;precio_actual;cantidad\\nA;Pollo;9;2').buffer);
 await p;
 assert.equal(api.state.pendingFile,null);
 assert.equal(api.state.pendingRows.length,0);
});
