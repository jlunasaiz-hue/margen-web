(function(){
'use strict';
const panel=document.getElementById('switchDemo');if(!panel)return;
const result=document.getElementById('switchDemoStatus'), consent=document.getElementById('switchDemoConsent'), button=document.getElementById('switchDemoAuthorize');
document.getElementById('switchDemoOpen').addEventListener('click',()=>{panel.hidden=false;consent.disabled=false;result.textContent='Ejemplo local. Ninguna compañía recibe esta solicitud.';consent.checked=false;button.disabled=true;button.textContent='Simular autorización con un clic';});
consent.addEventListener('change',()=>{button.disabled=!consent.checked;});
button.addEventListener('click',()=>{if(!consent.checked||button.disabled)return;button.disabled=true;consent.disabled=true;button.textContent='Solicitud de ejemplo preparada';result.textContent='Demostración: autorización registrada en esta sesión. En el servicio real, la compañía tendría que recibir, aceptar y activar el cambio. Aquí no se ha enviado ni contratado nada.';});
document.getElementById('switchDemoClose').addEventListener('click',()=>{panel.hidden=true;consent.disabled=false;consent.checked=false;button.disabled=true;});
})();
