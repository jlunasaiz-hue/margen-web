(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.margenPilot = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const formats = ["PDF", "Papel", "WhatsApp", "Excel", "ERP o programa de facturación", "Varios formatos"];
  const text = (value) => String(value ?? "").trim();
  const field = (data, name) => data && typeof data.get === "function" ? data.get(name) : data?.[name];
  const contactIsValid = (value) => {
    const input = text(value);
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) && input.length <= 120;
    const phone = /^\+?[0-9()\s.-]{8,25}$/.test(input) && input.replace(/\D/g, "").length >= 9;
    return email || phone;
  };
  function validate(data) {
    const d = {
      restaurant: text(field(data, "restaurant")),
      name: text(field(data, "name")),
      contact: text(field(data, "contact")),
      format: text(field(data, "format")),
      problem: text(field(data, "problem")),
      consent: field(data, "consent")
    };
    if (d.restaurant.length < 2 || d.restaurant.length > 120)
      return { ok: false, error: "Indica el restaurante (entre 2 y 120 caracteres)." };
    if (d.name.length < 2 || d.name.length > 100)
      return { ok: false, error: "Indica tu nombre (entre 2 y 100 caracteres)." };
    if (!contactIsValid(d.contact))
      return { ok: false, error: "Escribe un correo válido o un teléfono con al menos 9 cifras." };
    if (!formats.includes(d.format))
      return { ok: false, error: "Selecciona el formato habitual de tus facturas." };
    if (d.problem.length < 10 || d.problem.length > 600)
      return { ok: false, error: "Describe el problema con entre 10 y 600 caracteres, sin compartir datos sensibles." };
    if (!(d.consent === true || d.consent === "on" || d.consent === "yes"))
      return { ok: false, error: "Debes aceptar la información de privacidad para preparar la solicitud." };
    return { ok: true, data: d };
  }
  function message(validated) {
    if (!validated || validated.ok !== true) throw Error("Valida los campos antes de preparar la solicitud.");
    const d = validated.data;
    return [
      "Asunto: Solicitud de piloto Margen · " + d.restaurant,
      "",
      "Hola,",
      "",
      "Quiero solicitar información sobre el piloto de Margen.",
      "",
      "Restaurante: " + d.restaurant,
      "Persona de contacto: " + d.name,
      "Correo o teléfono: " + d.contact,
      "Formato habitual: " + d.format,
      "Problema a revisar: " + d.problem,
      "",
      "He leído la información de privacidad y autorizo el uso de estos datos para responder a esta solicitud.",
      "Entiendo que el piloto anunciado tiene un precio único de 39 €, dura 30 días y contempla hasta 30 documentos.",
      "La solicitud no implica contratación, pago ni confirmación de plaza.",
      "",
      "Gracias."
    ].join("\n");
  }
  function emailUrl(destination, validated) {
    const address = text(destination);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
      throw Error("Todavía no hay un correo comercial de destino válido.");
    const body = message(validated).split("\n").slice(1).join("\n").trim();
    const subject = "Solicitud de piloto Margen · " + validated.data.restaurant;
    return "mailto:" + encodeURIComponent(address) +
      "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }
  function filename(validated) {
    if (!validated || !validated.ok) throw Error("Valida la solicitud antes de descargarla.");
    const slug = validated.data.restaurant.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42);
    return "solicitud-margen-" + (slug || "restaurante") + ".txt";
  }
  return { formats, validate, message, emailUrl, filename, contactIsValid };
});
