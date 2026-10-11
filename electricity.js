(function(root){"use strict";
function compare(v) {
 const fields=["oldKwh","oldRate","oldFixed","oldOther","newKwh","newRate","newFixed","newOther"];
 for(const key of fields) if(!Number.isFinite(v[key])||v[key]<0)throw Error("Completa todos los importes con números válidos no negativos.");
 const oldEnergy=v.oldKwh*v.oldRate,newEnergy=v.newKwh*v.newRate;
 const oldTotal=oldEnergy+v.oldFixed+v.oldOther,newTotal=newEnergy+v.newFixed+v.newOther;
 const volume=(v.newKwh-v.oldKwh)*v.oldRate;
 const price=v.newKwh*(v.newRate-v.oldRate);
 const fixed=v.newFixed-v.oldFixed,other=v.newOther-v.oldOther;
 return {oldTotal,newTotal,difference:newTotal-oldTotal,volume,price,fixed,other};
}
function attach(document){
 const form=document.getElementById("electricityForm");
 form.addEventListener("submit",event=>{
  event.preventDefault();
  const v=Object.fromEntries(new FormData(form).entries());
  for(const key of Object.keys(v))v[key]=Number(v[key]);
  const result=document.getElementById("electricityResult");
  try{
   const c=compare(v),fmt=n=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(n);
   result.replaceChildren();
   const heading=document.createElement("h3");heading.textContent="Variación total: "+fmt(c.difference);result.append(heading);
   const breakdown=document.createElement("div");breakdown.className="electricity-breakdown";
   for(const [label,value] of [["Factura anterior",c.oldTotal],["Factura actual",c.newTotal],["Cambio por consumo",c.volume],["Cambio por precio de energía",c.price],["Cambio de costes fijos",c.fixed],["Cambio de otros conceptos",c.other]]){
    const p=document.createElement("p");p.textContent=label+": "+fmt(value);breakdown.append(p);
   }
   result.append(breakdown);
   const note=document.createElement("p");note.textContent="La diferencia se descompone matemáticamente. Comprueba días facturados, descuentos, impuestos y periodos horarios antes de atribuirla a una subida de tarifa.";result.append(note);result.classList.remove("hidden");
  }catch(err){result.textContent=err.message;result.classList.remove("hidden")}
 });
}
root.margenElectricity={compare,attach};
})(typeof window!=="undefined"?window:globalThis);
