const PILOT_CONTACT = ""; // TODO: sustituir por el correo comercial autorizado

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

function buildPilotEmail(data) {
  const subject = `Solicitud de piloto Margen · ${data.get("restaurant")}`;
  const body = [
    "Hola,",
    "",
    "Quiero solicitar el piloto de Margen.",
    "",
    `Restaurante: ${data.get("restaurant")}`,
    `Nombre: ${data.get("name")}`,
    `Contacto: ${data.get("contact")}`,
    `Formato habitual: ${data.get("format")}`,
    `Problema reciente: ${data.get("problem")}`,
    "",
    "Entiendo que el piloto cuesta 39 €, dura 30 días e incluye hasta 30 documentos."
  ].join("\n");
  return `mailto:${PILOT_CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

document.querySelector("#pilotForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("#pilotFormMessage");
  if (!form.reportValidity()) {
    message.textContent = "Completa los campos obligatorios antes de continuar.";
    return;
  }
  window.margenMetrics?.track("pilot_click");
  message.textContent = "Se está abriendo tu aplicación de correo con la solicitud preparada.";
  if (!PILOT_CONTACT) { message.textContent = "Correo comercial pendiente de configurar. Usa «Copiar solicitud» y envíala al correo que se publique aquí."; return; }
  window.location.href = buildPilotEmail(new FormData(form));
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
document.querySelector("#copyPilotButton")?.addEventListener("click", async () => {
  const form = document.querySelector("#pilotForm");
  const message = document.querySelector("#pilotFormMessage");
  if (!form.reportValidity()) {
    message.textContent = "Completa los campos obligatorios antes de copiar la solicitud.";
    return;
  }
  const data = new FormData(form);
  const text = [
    "Para: " + (PILOT_CONTACT || "[TU_CORREO_DE_CONTACTO]"),
    "Asunto: Solicitud de piloto Margen · " + data.get("restaurant"),
    "",
    "Hola, quiero solicitar el piloto de Margen.",
    "Restaurante: " + data.get("restaurant"),
    "Nombre: " + data.get("name"),
    "Contacto: " + data.get("contact"),
    "Formato habitual: " + data.get("format"),
    "Problema reciente: " + data.get("problem"),
    "Entiendo que el piloto cuesta 39 €, dura 30 días y cubre hasta 30 documentos."
  ].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    message.textContent = "Solicitud copiada. Pégala en tu correo y envíala cuando esté configurada la dirección comercial.";
  } catch {
    message.textContent = "No se pudo copiar automáticamente. Comprueba los permisos del portapapeles.";
  }
});
