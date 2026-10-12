// El correo solo se activa cuando el propietario configure una dirección comercial real.
// No se envían datos a ningún servidor ni se simula la recepción de una solicitud.
const PILOT_CONTACT = "";
const pilotCore = window.margenPilot;

try {
  if (!sessionStorage.getItem("margen-landing-visit")) {
    window.margenMetrics?.track("landing_visit");
    sessionStorage.setItem("margen-landing-visit", "1");
  }
} catch {
  window.margenMetrics?.track("landing_visit");
}

document.querySelectorAll('a[href="#solicitud"]').forEach((link) => {
  link.addEventListener("click", () => window.margenMetrics?.track("pilot_click"));
});

const pilotForm = document.querySelector("#pilotForm");
const pilotFeedback = document.querySelector("#pilotFormMessage");
const pilotPreview = document.querySelector("#pilotPreview");
const pilotPreviewText = document.querySelector("#pilotPreviewText");
const pilotEmailButton = document.querySelector("#pilotEmailButton");
const pilotEmailAddress = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(PILOT_CONTACT) ? PILOT_CONTACT : "";

function currentPilotRequest() {
  if (!pilotForm?.reportValidity()) return null;
  const result = pilotCore.validate(new FormData(pilotForm));
  if (!result.ok) {
    pilotFeedback.textContent = result.error;
    return null;
  }
  return result;
}
function showPilotPreview(request) {
  pilotPreviewText.textContent = pilotCore.message(request);
  pilotPreview.hidden = false;
  pilotFeedback.textContent = "Solicitud preparada en este dispositivo. Todavía no se ha enviado.";
  return request;
}
function getPilotRequest() {
  const request = currentPilotRequest();
  if (request) showPilotPreview(request);
  return request;
}

if (pilotEmailAddress) {
  document.querySelector("#pilotContactNotice").textContent = "La solicitud se abrirá en tu programa de correo. Tendrás que enviarla tú.";
  pilotEmailButton.hidden = false;
} else {
  document.querySelector("#pilotContactNotice").textContent = "Todavía no hay correo comercial configurado. Puedes preparar, copiar o descargar la solicitud, pero no enviarla desde Margen.";
}
pilotForm?.addEventListener("input", () => {
  if (pilotPreview) pilotPreview.hidden = true;
  pilotFeedback.textContent = "";
});
pilotForm?.addEventListener("change", () => {
  if (pilotPreview) pilotPreview.hidden = true;
  pilotFeedback.textContent = "";
});
pilotForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  getPilotRequest();
});

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw Error("El navegador no ha permitido copiar.");
  return Promise.resolve();
}

document.querySelector("#copyPilotButton")?.addEventListener("click", async () => {
  const request = getPilotRequest();
  if (!request) return;
  try {
    await copyToClipboard(pilotCore.message(request));
    pilotFeedback.textContent = "Solicitud copiada. Todavía no se ha enviado; necesitarás una dirección comercial válida.";
  } catch {
    pilotFeedback.textContent = "No se pudo copiar automáticamente. Selecciona el texto de la vista previa y cópialo manualmente.";
  }
});
document.querySelector("#downloadPilotButton")?.addEventListener("click", () => {
  const request = getPilotRequest();
  if (!request) return;
  const url = URL.createObjectURL(new Blob([pilotCore.message(request)], { type:"text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = pilotCore.filename(request);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  pilotFeedback.textContent = "Solicitud descargada en este dispositivo; no se ha enviado.";
});
pilotEmailButton?.addEventListener("click", () => {
  if (!pilotEmailAddress) return;
  const request = getPilotRequest();
  if (!request) return;
  window.location.href = pilotCore.emailUrl(pilotEmailAddress, request);
  pilotFeedback.textContent = "Se ha abierto tu correo. Comprueba y envía el mensaje desde tu aplicación.";
});

const calculator = document.querySelector("#costCalculator");
const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
function updateCostSimulator() {
  if (!calculator) return;
  const valid = calculator.checkValidity();
  const purchases = Number(calculator.elements.monthlyPurchases.value);
  const share = Number(calculator.elements.affectedShare.value);
  const rise = Number(calculator.elements.priceRise.value);
  const monthly = valid && [purchases,share,rise].every(Number.isFinite)
    ? purchases * (share / 100) * (rise / 100) : null;
  document.querySelector("#monthlyExtra").textContent = monthly === null ? "Introduce valores válidos" : money.format(monthly) + " al mes";
  document.querySelector("#annualExtra").textContent = monthly === null ? "Utiliza porcentajes entre 0 y 100." : money.format(monthly * 12) + " al año, si el mismo escenario se mantiene 12 meses.";
}
calculator?.addEventListener("input", updateCostSimulator);
updateCostSimulator();

document.querySelectorAll("[data-demo-link]").forEach(link => {
  link.addEventListener("click", () => window.margenMetrics?.track("demo_use"));
});
