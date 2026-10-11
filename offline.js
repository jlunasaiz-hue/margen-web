(function(){'use strict';
const text=document.getElementById('offlineStatusText'),update=document.getElementById('offlineUpdateButton'),install=document.getElementById('offlineInstallButton');if(!text)return;
let ready=false,waiting=null,prompt=null;
function render(){text.textContent=navigator.onLine?(ready?'Disponible sin conexión en este dispositivo.':'Preparando acceso sin conexión…'):(ready?'Sin conexión: puedes usar las funciones locales.':'Sin conexión: abre Margen con internet para prepararlo.');text.parentElement.classList.toggle('is-offline',!navigator.onLine);}
window.addEventListener('online',render);window.addEventListener('offline',render);render();
install.addEventListener('click',async()=>{if(prompt){await prompt.prompt();await prompt.userChoice;prompt=null;}else document.getElementById('installHelp').showModal();});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;});
if(!('serviceWorker'in navigator)){text.textContent='Este navegador no permite preparar el acceso sin conexión.';return;}
async function check(registration){const active=registration.active;if(!active)return;const channel=new MessageChannel();channel.port1.onmessage=event=>{ready=event.data?.ready===true;channel.port1.close();render();};active.postMessage({type:'CHECK_OFFLINE'},[channel.port2]);}
let refreshing=false;
navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing)location.reload();else navigator.serviceWorker.ready.then(check);});
update.addEventListener('click',()=>{if(waiting){refreshing=true;waiting.postMessage({type:'ACTIVATE_UPDATE'});}});
navigator.serviceWorker.register(new URL('./sw.js',location.href),{scope:new URL('./',location.href).pathname,updateViaCache:'none'}).then(registration=>{
 if(registration.waiting){waiting=registration.waiting;update.hidden=false;}
 registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){waiting=registration.waiting;update.hidden=false;}else if(worker.state==='redundant'&&!ready){text.textContent='No se pudo preparar la copia sin conexión. Vuelve a abrir con internet.';}});});
 navigator.serviceWorker.ready.then(check);
}).catch(()=>{text.textContent='No se pudo preparar la copia sin conexión en este navegador.';});
})();
