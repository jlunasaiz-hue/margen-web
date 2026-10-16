(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  else root.zarviqoSourcing=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  function normalize(value){
    return String(value||"").trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");
  }
  function valid(row){
    return row&&typeof row.item==="string"&&row.item.trim()&&typeof row.unit==="string"&&row.unit.trim()&&typeof row.supplier==="string"&&row.supplier.trim()&&Number.isFinite(row.current)&&row.current>=0&&row.current<=1e9&&Number.isFinite(row.quantity)&&row.quantity>0&&row.quantity<=1e9&&!row.possibleDuplicate&&/^\d{4}-\d{2}-\d{2}$/.test(String(row.date||""))&&!Number.isNaN(Date.parse(row.date+"T00:00:00Z"));
  }
  function compare(rows,options={}){
    if(!Array.isArray(rows))throw Error("Las compras deben ser una lista.");
    if(rows.length>100000)throw Error("Demasiadas líneas para una comparación local.");
    const maxAge=options.maxAgeDays===undefined?90:options.maxAgeDays;
    if(!Number.isInteger(maxAge)||maxAge<0||maxAge>3650)throw Error("Antigüedad máxima no válida.");
    const latest=new Map();
    for(const row of rows){
      if(!valid(row))continue;
      const productKey=JSON.stringify([normalize(row.item),normalize(row.unit)]);
      const supplierKey=normalize(row.supplier);
      const key=JSON.stringify([productKey,supplierKey]);
      const old=latest.get(key);
      if(!old||row.date>=old.date)latest.set(key,{...row,productKey,supplierKey});
    }
    const products=new Map();
    for(const row of latest.values()){
      if(!products.has(row.productKey))products.set(row.productKey,[]);
      products.get(row.productKey).push(row);
    }
    const opportunities=[];
    for(const group of products.values()){
      if(new Set(group.map(row=>row.supplierKey)).size<2)continue;
      const ordered=group.slice().sort((a,b)=>a.current-b.current||a.supplierKey.localeCompare(b.supplierKey));
      const best=ordered[0];
      for(const current of ordered.slice(1)){
        if(current.current<=best.current||current.supplierKey===best.supplierKey)continue;
        const age=Math.abs(Date.parse(current.date+"T00:00:00Z")-Date.parse(best.date+"T00:00:00Z"))/86400000;
        if(age>maxAge)continue;
        const difference=current.current-best.current;
        const amount=Math.round((difference*current.quantity+Number.EPSILON)*100)/100;
        if(!Number.isFinite(amount)||amount<=0||amount>1e12)continue;
        opportunities.push({
          id:JSON.stringify([current.productKey,current.supplierKey,best.supplierKey,current.date,best.date,current.current,best.current]),
          item:current.item,unit:current.unit,fromSupplier:current.supplier,toSupplier:best.supplier,
          fromPrice:current.current,toPrice:best.current,quantity:current.quantity,
          fromDate:current.date,toDate:best.date,unitDifference:difference,comparisonAmount:amount,
          ageDays:age,fromInvoice:String(current.invoice||""),toInvoice:String(best.invoice||"")
        });
      }
    }
    return opportunities.sort((a,b)=>b.comparisonAmount-a.comparisonAmount||a.id.localeCompare(b.id)).slice(0,100);
  }
  return {compare,normalize};
});
