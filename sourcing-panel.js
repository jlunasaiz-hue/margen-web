(function(root){
  "use strict";
  const KEY="zarviqo-sourcing-decisions-v1";
  const engine=root.zarviqoSourcing;
  const money=new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"});
  const decimal=new Intl.NumberFormat("es-ES",{maximumFractionDigits:2});
  let rows=[],isDemo=false,attached=false,decisions={};
  const el=id=>document.getElementById(id);
  function load(){
    try{
      const value=JSON.parse(localStorage.getItem(KEY)||"{}");
      decisions=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
    }catch{decisions={};}
  }
  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(decisions));return true;}
    catch{el("sourcingStatus").textContent="No se ha podido guardar la revisión en este dispositivo.";return false;}
  }
  function node(tag,cls,value){
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(value!==undefined)e.textContent=String(value);
    return e;
  }
  function negotiation(op){
    return "Hola, equipo de "+op.toSupplier+":\n\n"+
      "Estamos revisando el coste de "+op.item+" ("+op.unit+"). En una compra anterior del "+op.toDate+
      " consta un precio unitario de "+money.format(op.toPrice)+
      ". ¿Podéis confirmar por escrito el precio neto actual, el formato, la calidad, los gastos de transporte, la disponibilidad y las condiciones para "+decimal.format(op.quantity)+" "+op.unit+"?\n\n"+
      "Esta solicitud no es un pedido ni una aceptación de oferta. Gracias.";
  }
  async function copy(value){
    try{await navigator.clipboard.writeText(value);el("sourcingStatus").textContent="Solicitud copiada. Revísala antes de enviarla.";}
    catch{
      const area=node("textarea");area.value=value;area.setAttribute("aria-label","Solicitud para copiar");el("sourcingStatus").replaceChildren(area);
      area.focus();area.select();
    }
  }
  function card(op){
    const article=node("article","sourcing-card");
    const heading=node("div","sourcing-card-top");
    heading.append(node("h3","",op.item+" · "+op.unit),node("strong","sourcing-amount",money.format(op.comparisonAmount)));
    article.append(heading);
    article.append(node("p","sourcing-subline","Compra registrada: "+op.fromSupplier+" · "+money.format(op.fromPrice)+"/"+op.unit+" · "+decimal.format(op.quantity)+" "+op.unit));
    article.append(node("p","sourcing-subline","Referencia histórica: "+op.toSupplier+" · "+money.format(op.toPrice)+"/"+op.unit));
    article.append(node("p","sourcing-proof","Fechas: "+op.fromDate+" / "+op.toDate+" · diferencia "+money.format(op.unitDifference)+" por "+op.unit+" · "+op.ageDays+" días entre registros"));
    article.append(node("p","sourcing-disclaimer","Comparación sobre la cantidad de la última compra registrada. No confirma una oferta vigente ni un ahorro realizado."));
    const actions=node("div","sourcing-actions");
    const status=decisions[op.id]||"pending";
    const select=node("select","sourcing-select");
    select.setAttribute("aria-label","Estado de revisión de "+op.item+" con "+op.toSupplier);
    for(const [value,label] of [["pending","Pendiente"],["reviewed","Revisada"],["dismissed","Descartada"]]){
      const option=node("option","",label);option.value=value;select.append(option);
    }
    select.value=["pending","reviewed","dismissed"].includes(status)?status:"pending";
    select.addEventListener("change",()=>{
      if(select.value==="pending")delete decisions[op.id];
      else decisions[op.id]=select.value;
      if(save())render();
    });
    const button=node("button","button ghost","Copiar solicitud de presupuesto");
    button.type="button";button.addEventListener("click",()=>copy(negotiation(op)));
    actions.append(select,button);
    article.append(actions);
    return article;
  }
  function render(){
    if(!attached)return;
    const list=el("sourcingResults");
    try{
      const age=Number(el("sourcingAge").value);
      const results=engine.compare(rows,{maxAgeDays:age,maxLookbackDays:180});
      const pending=results.filter(op=>(decisions[op.id]||"pending")==="pending");
      const visible=el("sourcingOnlyPending").checked?pending:results;
      const reviewed=results.filter(op=>decisions[op.id]==="reviewed").length;
      const dismissed=results.filter(op=>decisions[op.id]==="dismissed").length;
      el("sourcingCount").textContent=String(results.length);
      el("sourcingPending").textContent=String(pending.length);
      el("sourcingReviewed").textContent=String(reviewed);
      el("sourcingDismissed").textContent=String(dismissed);
      el("sourcingDemo").hidden=!isDemo;
      list.replaceChildren();
      if(!visible.length){
        list.append(node("p","sourcing-empty",rows.length?"No hay alternativas comparables con estos filtros. Para comparar hacen falta compras recientes del mismo artículo y unidad a dos proveedores distintos.":"Todavía no hay compras. Carga el ejemplo o importa tus registros para empezar."));
      }else{
        const fragment=document.createDocumentFragment();
        visible.slice(0,30).forEach(op=>fragment.append(card(op)));
        list.append(fragment);
        if(visible.length>30)list.append(node("p","sourcing-disclaimer","Se muestran las primeras 30 comparaciones ordenadas por diferencia económica."));
      }
      el("sourcingStatus").textContent=results.length?"Comparaciones de compras históricas; verifica condiciones y fechas antes de tomar decisiones.":"No se han encontrado comparaciones con los datos y filtros actuales.";
    }catch(error){
      list.replaceChildren(node("p","sourcing-empty","No se pudieron comparar las compras."));
      el("sourcingStatus").textContent=error.message;
    }
  }
  function attach(){
    if(attached)return;
    if(!engine||!el("sourcingResults"))return;
    attached=true;load();
    el("sourcingAge").addEventListener("change",render);
    el("sourcingOnlyPending").addEventListener("change",render);
    render();
  }
  function setRows(nextRows,demo){
    rows=Array.isArray(nextRows)?nextRows:[];
    isDemo=Boolean(demo);
    render();
  }
  root.zarviqoSourcingUI={attach,setRows};
})(globalThis);
