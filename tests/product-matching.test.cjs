const test=require('node:test'),assert=require('node:assert/strict'),core=require('../product-matching.js'),fs=require('node:fs'),vm=require('node:vm');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const row=(overrides={})=>({supplier:'Proveedor A',item:'Pechuga de pollo',unit:'kg',current:8,quantity:3,previous:7,...overrides});
test('unifica las variantes de kilos, litros, cajas y unidades sin inferir el contenido de las cajas',()=>{for(const u of ['kg','KGS','Kilos','kilogramos'])assert.equal(core.unit(u).canonical,'kg');for(const u of ['l','LT','lts','litros'])assert.equal(core.unit(u).canonical,'litro');for(const u of ['ud.','uds','Unidades'])assert.equal(core.unit(u).canonical,'unidad');for(const u of ['CJ','cjs','cajas'])assert.equal(core.unit(u).canonical,'caja');assert.equal(core.autoFactor(row({unit:'caja'}),row({unit:'kg'})),null);});
test('convertir gramos a kilos conserva gasto, precio anterior e impacto total',()=>{const original=row({unit:'GR',current:0.01,previous:0.008,quantity:500}),out=core.canonicalize(original);assert.equal(out.unit,'kg');near(out.current,10);near(out.previous,8);near(out.quantity,0.5);near(out.current*out.quantity,original.current*original.quantity);near((out.current-out.previous)*out.quantity,1);assert.equal(original.current,0.01);});
test('convertir mililitros a litros conserva el coste de la compra',()=>{const original=row({unit:'ml',current:0.003,quantity:750});const out=core.canonicalize(original);assert.equal(out.unit,'litro');near(out.current,3);near(out.quantity,0.75);near(out.current*out.quantity,2.25);});
test('nombres habituales de factura generan propuestas revisables',()=>{for(const [source,target]of [['PECH. POLLO','Pechuga de pollo'],['ACE. OLIVA 5 L','Aceite de oliva 5L'],['TOM TRIT 2,5 KG','Tomate triturado 2.5 kg'],['PATATAS LAVADAS','Patata lavada'],['Pechuga polllo','Pechuga pollo']]){const catalog=core.makeCatalog([row({item:target})]);const proposals=core.suggest(row({item:source}),core.createIndex(catalog));assert.ok(proposals.length,source+' / '+target);assert.equal(core.canonicalize(row({item:source})).item,source,'Una sugerencia no confirma un emparejamiento');}});
test('formatos 1 L y 5 L no se proponen como coincidencia automática',()=>{assert.equal(core.score('Aceite oliva 1 L','Aceite oliva 5 L'),0);assert.equal(core.autoFactor(row({item:'Refresco 6x1L',unit:'caja'}),row({item:'Refresco 12x1L',unit:'caja'})),null);});
test('las dimensiones incompatibles y las unidades desconocidas exigen equivalencia explícita',()=>{assert.equal(core.autoFactor(row({unit:'kg'}),row({unit:'litro'})),null);assert.equal(core.autoFactor(row({unit:'desconocida'}),row({unit:'desconocida'})),null);assert.throws(()=>core.createRule(row({unit:'caja'}),row({unit:'kg'})));});
test('una equivalencia verificada de caja a kilos se recuerda en futuras importaciones',()=>{const source=row({item:'POLLO FRESCO CAJA',unit:'caja',current:24,quantity:2,previous:21}),target=row({item:'Pechuga de pollo',unit:'kg'}),rule=core.createRule(source,target,3);const restored=JSON.parse(JSON.stringify([rule]));core.validateRules(restored);const first=core.canonicalize(source,restored),next=core.canonicalize({...source,current:27},restored);assert.equal(first.item,'Pechuga de pollo');near(first.current,8);near(first.quantity,6);near(next.current,9);near(next.current*next.quantity,54);assert.equal(next.matching.confirmed,true);});
test('la decisión queda ligada al proveedor y al formato de origen',()=>{const source=row({item:'PECH POLLO',unit:'kg'}),rule=core.createRule(source,row());assert.equal(core.canonicalize(source,[rule]).item,'Pechuga de pollo');assert.equal(core.canonicalize({...source,supplier:'Otro proveedor'},[rule]).item,'PECH POLLO');assert.equal(core.canonicalize({...source,unit:'caja'},[rule]).item,'PECH POLLO');});
test('mantener separado también se recuerda y no renombra el producto',()=>{const source=row({item:'Pollo premium'}),rule=core.separate(source);core.validateRules([rule]);const result=core.canonicalize(source,[rule]);assert.equal(result.item,'Pollo premium');assert.equal(result.matching.separate,true);});
test('rechaza conversiones nulas, negativas, infinitas, destinos no canónicos y reglas duplicadas',()=>{for(const factor of [0,-1,Infinity,NaN])assert.throws(()=>core.createRule(row(),row(),factor));const rule=core.createRule(row(),row());assert.throws(()=>core.validateRules([rule,rule]));assert.throws(()=>core.validateRules([{...rule,target:{item:'Pollo',unit:'KGS'}}]));});
function engine(){const source=fs.readFileSync('app.js','utf8');const ctx={Intl,console,setTimeout,clearTimeout,URL,Blob,TextDecoder,performance,Map,margenMatching:core};vm.createContext(ctx);vm.runInContext(source.replace(/\ninit\(\);[\s\S]*$/,'\n;globalThis.engine={state,buildImportedRows,reconcileMatchingHistory,parseSpanishNumber,setRules:value=>{productRules=coreRules(value);}};function coreRules(value){return globalThis.margenMatching.validateRules(value);}'),ctx);return ctx.engine;}
function setup(e){e.state.rows=[row({id:'old',date:'2026-09-01',current:7})];e.state.source='Compras propias';e.state.isDemo=false;e.state.mapping={supplier:'Proveedor',item:'Producto',unit:'Unidad',current:'Precio',quantity:'Cantidad',previous:'',invoice:'Factura',date:'Fecha'};}
test('la importación utiliza el emparejamiento guardado para inferir el precio anterior comparable',()=>{const e=engine();setup(e);e.setRules([core.createRule(row({item:'PECH POLLO',unit:'caja'}),row(),3)]);e.state.pendingRows=[{Proveedor:'Proveedor A',Producto:'PECH POLLO',Unidad:'caja',Precio:'24',Cantidad:'2',Factura:'F-2',Fecha:'01/10/2026'}];const result=e.buildImportedRows();near(result.rows[0].previous,7);near(result.rows[0].current,8);near(result.rows[0].quantity,6);near(result.rows[0].impact,6);assert.equal(result.rows[0].matching.originalUnit,'caja');assert.equal(e.state.rows[0].current,7);});
test('un precio histórico expresado en gramos se compara con kilos sin falsas subidas',()=>{const e=engine();setup(e);e.state.rows=[row({date:'2026-09-01',unit:'g',current:0.008,quantity:500})];e.state.pendingRows=[{Proveedor:'Proveedor A',Producto:'Pechuga de pollo',Unidad:'kg',Precio:'8',Cantidad:'1',Fecha:'01/10/2026'}];const result=e.buildImportedRows();near(result.rows[0].previous,8);near(result.rows[0].impact,0);});
test('una fila ya normalizada no vuelve a multiplicar su factor en futuras comparaciones',()=>{const e=engine();setup(e);e.state.rows=[core.canonicalize(row({date:'2026-09-01',unit:'g',current:0.008,quantity:500}))];e.state.pendingRows=[{Proveedor:'Proveedor A',Producto:'Pechuga de pollo',Unidad:'kg',Precio:'9',Cantidad:'1',Fecha:'01/10/2026'}];const result=e.buildImportedRows();near(result.rows[0].previous,8);near(result.rows[0].impact,1);});
test('las cantidades decimales que empiezan por cero no se interpretan como miles',()=>{const e=engine();near(e.parseSpanishNumber('0,125'),0.125);near(e.parseSpanishNumber('0.125'),0.125);assert.equal(e.parseSpanishNumber('1.234'),1234);});
test('códigos numéricos distintos no se proponen como el mismo producto',()=>{assert.equal(core.score('Producto 123','Producto 124'),0);assert.equal(core.score('Refresco 6x1L','Refresco 12x1L'),0);});

test('centilitros se convierten a litros sin alterar el importe',()=>{
  const before=row({unit:'cl',current:0.15,quantity:33});
  const normalized=core.canonicalize(before);
  assert.equal(normalized.unit,'litro');near(normalized.quantity,0.33);near(normalized.current,15);near(normalized.current*normalized.quantity,4.95);
});
test('las cajas, garrafas y botellas requieren siempre equivalencia comprobada incluso con el mismo nombre de unidad',()=>{
  for(const unit of ['caja','garrafa','botella'])assert.equal(core.autoFactor(row({unit}),row({unit})),null);
  const source=row({item:'Agua 1 L',unit:'caja',current:18,quantity:2}),target=row({item:'Agua 1 L',unit:'caja'});
  assert.throws(()=>core.createRule(source,target));
  const matched=core.canonicalize(source,[core.createRule(source,target,1)]);
  near(matched.current*matched.quantity,36);
});
test('formatos declarados distintos impiden equivalencias automáticas aunque ambas unidades sean litros',()=>{
  assert.equal(core.autoFactor(row({item:'Aceite de oliva 1 L',unit:'litros'}),row({item:'Aceite de oliva 5 L',unit:'litros'})),null);
  assert.equal(core.autoFactor(row({item:'Aceite de oliva 500 ml',unit:'ml'}),row({item:'Aceite de oliva 0,5 L',unit:'litros'})),0.001);
});
test('rechaza factores ínfimos y conversiones que producirían números no finitos',()=>{
  const source=row({unit:'caja'}),target=row({unit:'kg'});
  assert.throws(()=>core.createRule(source,target,1e-300));
  assert.throws(()=>core.canonicalize(row({current:1e308,unit:'g'})),/rango permitido/);
});
test('una regla nueva vuelve a relacionar las compras históricas ya normalizadas sin aplicar dos veces el factor',()=>{
  const e=engine();setup(e);
  const old=row({item:'PECH POLLO',unit:'gr',date:'2026-09-01',current:0.008,quantity:500});
  e.state.rows=[core.canonicalize(old)];
  e.setRules([core.createRule(old,row())]);
  e.state.pendingRows=[{Proveedor:'Proveedor A',Producto:'Pechuga de pollo',Unidad:'kg',Precio:'9',Cantidad:'1',Fecha:'01/10/2026'}];
  const imported=e.buildImportedRows().rows[0];
  near(imported.previous,8);near(imported.impact,1);
  near(e.state.rows[0].current*e.state.rows[0].quantity,4);
});

test('al cambiar la equivalencia de cajas, el precio anterior histórico sigue en su unidad correcta',()=>{
  const e=engine();setup(e);
  const previous=row({item:'Pechuga de pollo',unit:'kg',current:7,quantity:10,date:'2026-09-01'});
  const source=row({item:'POLLO CAJA',unit:'caja',current:24,quantity:2,date:'2026-10-01'});
  const original=core.canonicalize(source,[core.createRule(source,row(),3)]);
  original.previous=7;original.previousSource='history';
  e.state.rows=[previous,original];
  e.setRules([core.createRule(source,row(),6)]);
  const result=e.reconcileMatchingHistory(e.state.rows);
  near(result[1].previous,7);near(result[1].current,4);near(result[1].quantity,12);
  near(result[1].current*result[1].quantity,48);
  assert.equal(result[1].previousSource,'history');
});
test('una compra inicialmente separada recupera el precio anterior al confirmar la coincidencia',()=>{
  const e=engine();setup(e);
  const previous=row({item:'Pechuga de pollo',unit:'kg',current:7,date:'2026-09-01'});
  const source=row({item:'PECH POLLO',unit:'kg',current:9,date:'2026-10-01'});
  const first=core.canonicalize(source);
  first.previous=9;first.previousSource='first_purchase';
  e.state.rows=[previous,first];
  e.setRules([core.createRule(source,row())]);
  const result=e.reconcileMatchingHistory(e.state.rows);
  near(result[1].previous,7);near(result[1].current,9);
  assert.equal(result[1].previousSource,'history');
});
