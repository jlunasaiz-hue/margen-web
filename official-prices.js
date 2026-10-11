(function(root){
  "use strict";
  const zone="Europe/Madrid", endpoint="https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real";
  function madridDate(now=new Date()) {
    const p=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
    const get=t=>p.find(v=>v.type===t).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }
  function checkDate(date) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+"T12:00:00Z"))||new Date(date+"T12:00:00Z").toISOString().slice(0,10)!==date)throw Error("Selecciona una fecha válida.");
    return date;
  }
  function requestUrl(date) {
    checkDate(date);
    return endpoint+"?"+new URLSearchParams({start_date:date+"T00:00",end_date:date+"T23:59",time_trunc:"hour"});
  }
  function parsePrices(payload,date) {
    checkDate(date);
    const series=payload?.included?.find(s=>s?.attributes?.title==="PVPC");
    if(!series||!Array.isArray(series.attributes.values))throw Error("La fuente no devuelve una serie PVPC válida.");
    const seen=new Set();
    const rows=series.attributes.values.filter(v=>{
      if(typeof v.value!=="number"||!Number.isFinite(v.value)||!v.datetime||Number.isNaN(Date.parse(v.datetime)))return false;
      if(madridDate(new Date(v.datetime))!==date||seen.has(Date.parse(v.datetime)))return false;
      seen.add(Date.parse(v.datetime));return true;
    }).map(v=>({datetime:v.datetime,price:v.value/1000})).sort((a,b)=>Date.parse(a.datetime)-Date.parse(b.datetime));
    // PVPC is hourly. Validate the requested day's length, including clock changes.
    const next=new Date(date+"T12:00:00Z");next.setUTCDate(next.getUTCDate()+1);
    const nextDate=next.toISOString().slice(0,10);
    // Use offsets just before each midnight; midday changes on DST transition days.
    function localMidnight(day){const d=new Date(day+"T00:00:00Z");const offset=new Intl.DateTimeFormat("en",{timeZone:zone,timeZoneName:"longOffset"}).formatToParts(new Date(d.getTime()-4*3600000)).find(p=>p.type==="timeZoneName").value;return Date.parse(day+"T00:00:00"+offset.replace("GMT",""));}
    const expected=(localMidnight(nextDate)-localMidnight(date))/3600000;
    if(rows.length!==expected||rows.some((v,i)=>Date.parse(v.datetime)!==localMidnight(date)+i*3600000))throw Error("No hay precios completos para este día. Prueba otra fecha o consulta de nuevo más tarde.");
    return {rows,average:rows.reduce((n,r)=>n+r.price,0)/rows.length,min:rows.reduce((a,b)=>a.price<=b.price?a:b),max:rows.reduce((a,b)=>a.price>=b.price?a:b),sourceUpdated:series.attributes["last-update"]||payload.data?.attributes?.["last-update"]||null};
  }
  async function loadPrices(date,fetcher=root.fetch.bind(root),signal) {
    const uri=root.location&&!root.location.hostname.endsWith("github.io")?new URL("/api/energy/prices?date="+encodeURIComponent(date),root.location.origin).href:requestUrl(date);
    const response=await fetcher(uri,{headers:{Accept:"application/json"},signal});
    if(!response.ok)throw Error("La fuente oficial no está disponible (HTTP "+response.status+").");
    const payload=await response.json();const parsed=parsePrices(payload,date);
    try{root.localStorage?.setItem("margen-public-pvpc",JSON.stringify({date,payload,consultedAt:new Date().toISOString()}));}catch{}
    return parsed;
  }
  function attach(document) {
    const form=document.getElementById("energyPriceForm");if(!form)return;
    const el=id=>document.getElementById(id), date=el("energyDate");date.value=madridDate();
    let controller=null, lastAttempt=0, selectedToday=true;
    const price=n=>new Intl.NumberFormat("es-ES",{minimumFractionDigits:5,maximumFractionDigits:5}).format(n)+" €/kWh";
    const time=d=>new Intl.DateTimeFormat("es-ES",{timeZone:zone,hour:"2-digit",minute:"2-digit",timeZoneName:"short"}).format(new Date(d));
    async function refresh(){
      if(controller)controller.abort();controller=new AbortController();const own=controller;
      lastAttempt=Date.now();const requested=date.value;
      el("energyState").textContent="Consultando";el("energyStatus").textContent="Consultando la fuente oficial…";
      el("energyData").hidden=true;el("energyRefresh").disabled=true;
      try{
        if(root.navigator?.onLine===false)throw Error("OFFLINE");
        const result=await loadPrices(requested,root.fetch.bind(root),own.signal);
        el("energySaved").hidden=false;
        if(own!==controller)return;
        el("energyAverage").textContent=price(result.average);el("energyMinimum").textContent=price(result.min.price);el("energyMaximum").textContent=price(result.max.price);
        el("energyMinimumTime").textContent=time(result.min.datetime);el("energyMaximumTime").textContent=time(result.max.datetime);
        const fragment=document.createDocumentFragment();
        result.rows.forEach(r=>{const tr=document.createElement("tr");[time(r.datetime),price(r.price)].forEach(value=>{const td=document.createElement("td");td.textContent=value;tr.append(td);});fragment.append(tr);});
        el("energyPriceRows").replaceChildren(fragment);el("energyData").hidden=false;
        el("energyState").textContent=requested===madridDate()?"Precios de hoy":"Histórico";
        const stamp=new Intl.DateTimeFormat("es-ES",{timeZone:zone,dateStyle:"short",timeStyle:"short"});
        el("energyStatus").textContent=`Día ${requested} · ${result.rows.length} horas · Consultado: ${stamp.format(new Date())}.`+(result.sourceUpdated&&!Number.isNaN(Date.parse(result.sourceUpdated))?` Publicación de la fuente: ${stamp.format(new Date(result.sourceUpdated))}.`:"");
      }catch(error){
        if(own!==controller)return;
        try{const saved=JSON.parse(root.localStorage?.getItem("margen-public-pvpc")||"null");if(saved?.date===requested){const result=parsePrices(saved.payload,requested);el("energyAverage").textContent=price(result.average);el("energyMinimum").textContent=price(result.min.price);el("energyMaximum").textContent=price(result.max.price);el("energyMinimumTime").textContent=time(result.min.datetime);el("energyMaximumTime").textContent=time(result.max.datetime);const fragment=document.createDocumentFragment();result.rows.forEach(r=>{const tr=document.createElement("tr");[time(r.datetime),price(r.price)].forEach(value=>{const td=document.createElement("td");td.textContent=value;tr.append(td);});fragment.append(tr);});el("energyPriceRows").replaceChildren(fragment);el("energyData").hidden=false;el("energyState").textContent="Datos guardados";el("energyStatus").textContent="No se pudo actualizar. Precios guardados del "+saved.date+" · Consulta original: "+saved.consultedAt+". No son datos actualizados.";return;}}catch{}
        el("energyState").textContent="Sin datos disponibles";
        el("energyStatus").textContent=error.name==="AbortError"?"La consulta tardó demasiado. Puedes volver a intentarlo.":error.message+" No se muestran precios de ejemplo ni de otro día.";
      }finally{if(own===controller){el("energyRefresh").disabled=false;controller=null;}}
    }
    function visible(){return !document.hidden&&!el("electricityView").classList.contains("hidden");}
    function maybeRefresh(){if(!visible()||controller)return;if(selectedToday&&date.value!==madridDate()){date.value=madridDate();lastAttempt=0;}if(Date.now()-lastAttempt>=15*60*1000)refresh();}
    try{const saved=JSON.parse(root.localStorage?.getItem("margen-public-pvpc")||"null");if(saved){parsePrices(saved.payload,saved.date);el("energySaved").hidden=false;}}catch{}
    el("energySaved").addEventListener("click",()=>{try{const saved=JSON.parse(root.localStorage.getItem("margen-public-pvpc"));parsePrices(saved.payload,saved.date);date.value=saved.date;selectedToday=false;refresh();}catch{el("energySaved").hidden=true;}});
    form.addEventListener("submit",event=>{event.preventDefault();selectedToday=date.value===madridDate();refresh();});
    date.addEventListener("change",()=>{selectedToday=date.value===madridDate();refresh();});
    document.addEventListener("margen:view",maybeRefresh);document.addEventListener("visibilitychange",maybeRefresh);
    root.setInterval(maybeRefresh,60000);
    // Abort hanging requests without permitting overlapping background calls.
    root.setInterval(()=>{if(controller&&Date.now()-lastAttempt>20000)controller.abort();},1000);
  }
  root.margenOfficialPrices={madridDate,requestUrl,parsePrices,loadPrices,attach};
  if(typeof document!=="undefined")attach(document);
})(typeof window!=="undefined"?window:globalThis);
