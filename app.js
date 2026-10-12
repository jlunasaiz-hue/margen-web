const SAMPLE_ROWS = [
  { supplier: "Costa Distribución", item: "Aceite de oliva 5 L", unit: "garrafa", previous: 31.8, current: 36.9, quantity: 8, invoice: "CD-1842", date: "2026-09-28" },
  { supplier: "Costa Distribución", item: "Tomate triturado 2,5 kg", unit: "lata", previous: 4.15, current: 4.32, quantity: 24, invoice: "CD-1842", date: "2026-09-28" },
  { supplier: "Frío Levante", item: "Pechuga de pollo", unit: "kg", previous: 6.42, current: 7.28, quantity: 36, invoice: "FL-9031", date: "2026-09-30" },
  { supplier: "Frío Levante", item: "Merluza congelada", unit: "kg", previous: 8.9, current: 8.72, quantity: 18, invoice: "FL-9031", date: "2026-09-30" },
  { supplier: "Horno Mediterráneo", item: "Pan rústico", unit: "unidad", previous: 0.58, current: 0.66, quantity: 120, invoice: "HM-472", date: "2026-10-01" },
  { supplier: "Horno Mediterráneo", item: "Pan brioche", unit: "unidad", previous: 0.72, current: 0.72, quantity: 80, invoice: "HM-472", date: "2026-10-01" },
  { supplier: "Bebidas Sureste", item: "Agua mineral 1 L", unit: "caja", previous: 4.8, current: 5.05, quantity: 22, invoice: "BS-2219", date: "2026-10-02" },
  { supplier: "Bebidas Sureste", item: "Refresco cola", unit: "caja", previous: 13.2, current: 14.95, quantity: 14, invoice: "BS-2219", date: "2026-10-02" },
  { supplier: "Bebidas Sureste", item: "Cerveza lager 33 cl", unit: "caja", previous: 18.4, current: 18.4, quantity: 6, invoice: "BS-2219", date: "2026-10-02" },
  { supplier: "Bebidas Sureste", item: "Cerveza lager 33 cl", unit: "caja", previous: 18.4, current: 18.4, quantity: 6, invoice: "BS-2219", date: "2026-10-02" },
  { supplier: "Limpieza Sol", item: "Lavavajillas industrial", unit: "garrafa", previous: 12.4, current: 14.25, quantity: 6, invoice: "LS-770", date: "2026-10-03" },
  { supplier: "Limpieza Sol", item: "Papel secamanos", unit: "caja", previous: 18.6, current: 17.9, quantity: 4, invoice: "LS-770", date: "2026-10-03" }
];

const state = {
  rows: [],
  source: "",
  isDemo: false,
  pendingFile: null,
  pendingRows: [],
  pendingHeaders: [],
  mapping: {},
  reviewPage: 0,
  rejectedPdfLines: [],
  severity: "all",
  status: "pending",
  query: "",
  supplier: "all"
};

const MAPPING_FIELDS = [
  { key: "supplier", label: "Proveedor", required: true, aliases: ["proveedor", "supplier", "empresa", "vendor"] },
  { key: "item", label: "Producto", required: true, aliases: ["producto", "articulo", "descripcion", "concepto", "item", "product"] },
  { key: "current", label: "Precio actual", required: true, aliases: ["precio_actual", "precio", "precio_unitario", "pvp", "coste", "current_price", "unit_price"] },
  { key: "quantity", label: "Cantidad", required: true, aliases: ["cantidad", "unidades", "qty", "quantity"] },
  { key: "unit", label: "Unidad o formato", required: false, aliases: ["unidad", "formato", "ud", "unit"] },
  { key: "previous", label: "Precio anterior", required: false, aliases: ["precio_anterior", "precio_previo", "previous_price"] },
  { key: "invoice", label: "N.º de factura", required: false, aliases: ["factura", "numero_factura", "n_factura", "invoice"] },
  { key: "date", label: "Fecha", required: false, aliases: ["fecha", "fecha_factura", "date"] }
];

const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function normalizeRow(row) {
  const previous = Number(row.previous) || 0;
  const current = Number(row.current) || 0;
  const quantity = Number(row.quantity) || 0;
  const delta = current - previous;
  const percent = previous > 0 ? (delta / previous) * 100 : 0;
  const priceImpact = Math.max(0, delta * quantity);
  const duplicateImpact = row.possibleDuplicate ? current * quantity : 0;
  const impact = priceImpact + duplicateImpact;
  const severity = row.possibleDuplicate || percent >= 10 ? "high" : percent >= 5 ? "medium" : "low";
  return {
    ...row,
    id: row.id || `row-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: row.date || "",
    reviewed: Boolean(row.reviewed),
    previous,
    current,
    quantity,
    delta,
    percent,
    priceImpact,
    duplicateImpact,
    impact,
    severity,
    possibleDuplicate: Boolean(row.possibleDuplicate)
  };
}

function analyze(rows) {
  const seen = new Set();
  return rows.map((row) => {
    const key = row.invoice ? [row.supplier, row.invoice, row.item, row.unit, Number(row.current), Number(row.quantity)].join("|").toLowerCase() : "";
    const possibleDuplicate = Boolean(row.possibleDuplicate || (key && seen.has(key)));
    if (key) seen.add(key);
    return normalizeRow({ ...row, possibleDuplicate });
  });
}

function isAlert(row) { return row.delta > 0 || row.possibleDuplicate; }

function getAlerts(includeReviewed = true) {
  return state.rows
    .filter((row) => isAlert(row) && (includeReviewed || !row.reviewed))
    .sort((a, b) => b.impact - a.impact);
}

function getSupplierSummaries() {
  const grouped = new Map();
  state.rows.forEach((row) => {
    if (!grouped.has(row.supplier)) {
      grouped.set(row.supplier, { name: row.supplier, rows: [], spend: 0, impact: 0, pendingImpact: 0, alerts: 0, pending: 0, high: 0 });
    }
    const supplier = grouped.get(row.supplier);
    supplier.rows.push(row);
    supplier.spend += row.current * row.quantity;
    if (isAlert(row)) {
      supplier.impact += row.impact;
      supplier.alerts += 1;
      if (!row.reviewed) {
        supplier.pendingImpact += row.impact;
        supplier.pending += 1;
        if (row.severity === "high") supplier.high += 1;
      }
    }
  });
  return [...grouped.values()].sort((a, b) => b.pendingImpact - a.pendingImpact || b.spend - a.spend);
}

function render() {
  const rows = state.rows;
  const allAlerts = getAlerts();
  const alerts = getAlerts(false);
  const totalSpend = rows.reduce((sum, row) => sum + row.current * row.quantity, 0);
  const review = alerts.reduce((sum, row) => sum + row.impact, 0);
  const largest = alerts.reduce((max, row) => Math.max(max, row.percent), 0);
  const highCount = alerts.filter((row) => row.severity === "high").length;
  const increaseCount = alerts.filter((row) => row.delta > 0).length;
  const duplicateCount = alerts.filter((row) => row.possibleDuplicate).length;

  $("#reviewAmount").textContent = euros.format(review);
  $("#totalSpend").textContent = euros.format(totalSpend);
  $("#increaseCount").textContent = alerts.length;
  $("#largestIncrease").textContent = `${number.format(largest)} %`;
  $("#reviewCaption").textContent = review ? `${number.format((review / Math.max(totalSpend, 1)) * 100)} % del gasto analizado` : "Sin diferencias positivas";
  $("#spendCaption").textContent = `${rows.length} líneas procesadas`;
  $("#increaseCaption").textContent = `${increaseCount} subidas · ${duplicateCount} posible${duplicateCount === 1 ? "" : "s"} duplicado${duplicateCount === 1 ? "" : "s"}`;
  $("#largestCaption").textContent = alerts[0] ? [...alerts].sort((a,b) => b.percent - a.percent)[0].item : "No hay variaciones";
  $("#navAlertCount").textContent = alerts.length;
  $("#reviewBar").style.width = `${Math.min(100, (review / Math.max(totalSpend, 1)) * 500)}%`;
  $("#dataPeriod").textContent = state.source || "Sin datos cargados";
  $("#demoNotice").classList.toggle("hidden", !state.isDemo);
  renderFirstMinute();

  renderTopAlerts(alerts);
  renderSupplierImpact(alerts);
  renderTableFilters(rows);
  renderTable(rows);
  renderAllAlerts(allAlerts);
  renderSuppliers();
  persistDataset();
}

function renderFirstMinute() {
  const section = $("#firstMinute");
  const rows = state.rows.filter((row) => row.previous > 0 && row.delta > 0 && !row.reviewed);
  const first = rows.sort((a, b) => b.priceImpact - a.priceImpact)[0];
  if (!first) {
    section.classList.toggle("hidden", !state.isDemo && state.rows.length > 0);
    $("#firstMinuteLabel").textContent = state.isDemo ? "EJEMPLO CON DATOS FICTICIOS" : "CONTROL DE PRECIOS";
    $("#firstMinuteTitle").textContent = state.rows.length ? "Sin subidas pendientes detectadas" : "Prueba Margen con tus compras";
    $("#firstMinuteDetail").textContent = "Las diferencias detectadas requieren revisión; no son ahorro confirmado.";
    return;
  }
  section.classList.remove("hidden");
  $("#firstMinuteLabel").textContent = state.isDemo ? "EJEMPLO CON DATOS FICTICIOS" : "DIFERENCIA PENDIENTE DE REVISIÓN";
  $("#firstMinuteTitle").textContent = `${first.item}: +${number.format(first.percent)} % · ${euros.format(first.priceImpact)} en esta compra`;
  $("#firstMinuteDetail").textContent = state.isDemo
    ? `Si esta misma compra de ${number.format(first.quantity)} unidades se repitiera 4 veces al mes, la diferencia hipotética sería ${euros.format(first.priceImpact * 4)}/mes. No es un ahorro confirmado.`
    : `Proveedor: ${first.supplier}. Diferencia estimada de la compra registrada; no hay frecuencia mensual verificada.`;
}

function persistDataset() {
  try {
    localStorage.setItem("margen-dataset", JSON.stringify({ rows: state.rows, source: state.source, isDemo: state.isDemo }));
  } catch {
    showToast("No se han podido guardar los cambios en este navegador");
  }
}

function priorityLabel(row) { return row.possibleDuplicate ? "Duplicado" : row.severity === "high" ? "Alta" : row.severity === "medium" ? "Media" : "Baja"; }

function renderTopAlerts(alerts) {
  const box = $("#topAlerts");
  if (!alerts.length) {
    box.innerHTML = `<div class="empty-state">No hay subidas que revisar en estos datos.</div>`;
    return;
  }
  box.innerHTML = alerts.slice(0, 4).map((row, index) => `
    <article class="alert-row" data-detail="${state.rows.indexOf(row)}" tabindex="0">
      <div class="alert-primary"><span class="severity-icon ${row.severity}">${priorityLabel(row)}</span><strong class="alert-title">${escapeHtml(row.item)}</strong><span class="alert-sub">${row.possibleDuplicate ? "Posible duplicado · " : ""}${escapeHtml(row.supplier)} · ${escapeHtml(row.invoice || "Sin factura")}</span></div>
      <div class="alert-value"><strong>${euros.format(row.impact)}</strong><span>${row.possibleDuplicate ? "a comprobar" : `+${number.format(row.percent)} %`}</span></div>
    </article>`).join("");
  bindDetailButtons();
}

function renderSupplierImpact(alerts) {
  const totals = alerts.reduce((acc, row) => {
    acc[row.supplier] = (acc[row.supplier] || 0) + row.impact;
    return acc;
  }, {});
  const sorted = Object.entries(totals).sort((a,b) => b[1] - a[1]).slice(0,4);
  const max = sorted[0]?.[1] || 1;
  $("#supplierImpact").innerHTML = sorted.length ? sorted.map(([supplier, impact]) => `
    <button type="button" class="supplier-line" data-supplier="${escapeHtml(encodeURIComponent(supplier))}">
      <span class="supplier-line-top"><strong>${escapeHtml(supplier)}</strong><span>${euros.format(impact)}</span></span>
      <span class="supplier-bar"><span style="width:${Math.max(4, impact / max * 100)}%"></span></span>
    </button>`).join("") : `<div class="empty-state">Todavía no hay impacto por proveedor.</div>`;
  bindSupplierButtons();
}

function renderSuppliers() {
  const suppliers = getSupplierSummaries();
  const top = suppliers[0];
  const pendingImpact = suppliers.reduce((sum, supplier) => sum + supplier.pendingImpact, 0);
  $("#topSupplierName").textContent = top?.pendingImpact ? top.name : "Sin alertas";
  $("#topSupplierImpact").textContent = top?.pendingImpact ? `${euros.format(top.pendingImpact)} pendientes de revisar` : "Todo revisado";
  $("#supplierCount").textContent = suppliers.length;
  $("#supplierRiskCount").textContent = `${suppliers.filter((supplier) => supplier.high > 0).length} con alertas prioritarias`;
  $("#annualizedImpact").textContent = euros.format(pendingImpact * 12);
  $("#supplierCards").innerHTML = suppliers.length ? suppliers.map((supplier) => {
    const risk = supplier.high ? "Alta" : supplier.pending ? "Media" : "Controlada";
    const riskClass = supplier.high ? "high" : supplier.pending ? "medium" : "low";
    const share = supplier.spend ? supplier.pendingImpact / supplier.spend * 100 : 0;
    return `<article class="supplier-card">
      <div class="supplier-card-top"><span class="supplier-initial">${escapeHtml(supplier.name.slice(0, 1).toUpperCase())}</span><span class="risk-pill ${riskClass}">${risk}</span></div>
      <h3>${escapeHtml(supplier.name)}</h3>
      <p>${supplier.rows.length} líneas · ${supplier.pending} alertas pendientes</p>
      <div class="supplier-card-metrics"><div><span>Gasto</span><strong>${euros.format(supplier.spend)}</strong></div><div><span>A revisar</span><strong>${euros.format(supplier.pendingImpact)}</strong></div></div>
      <div class="supplier-bar"><span style="width:${Math.min(100, Math.max(supplier.pendingImpact ? 5 : 0, share * 4))}%"></span></div>
      <button type="button" class="button supplier-action" data-supplier="${escapeHtml(encodeURIComponent(supplier.name))}">${supplier.pending ? "Preparar negociación" : "Ver detalle"} <span>→</span></button>
    </article>`;
  }).join("") : `<div class="panel empty-state">Todavía no hay proveedores en el análisis.</div>`;
  bindSupplierButtons();
}

function bindSupplierButtons() {
  $$('[data-supplier]').forEach((element) => {
    element.onclick = () => openSupplier(decodeURIComponent(element.dataset.supplier));
  });
}

function renderTable(rows) {
  const query = state.query.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    const matchesSupplier = state.supplier === "all" || row.supplier === state.supplier;
    const haystack = `${row.item} ${row.supplier} ${row.invoice}`.toLowerCase();
    return matchesSupplier && (!query || haystack.includes(query));
  });
  $("#recentRows").innerHTML = filtered.length ? filtered.map((row) => {
    const direction = row.delta > 0 ? "up" : row.delta < 0 ? "down" : "flat";
    const sign = row.percent > 0 ? "+" : "";
    return `<tr>
      <td class="product-cell"><strong>${escapeHtml(row.item)}</strong><span>${escapeHtml(row.invoice || "Sin factura")} · ${number.format(row.quantity)} ${escapeHtml(row.unit)}${row.date ? ` · ${formatDate(row.date)}` : ""}</span>${row.possibleDuplicate ? `<span class="duplicate-label">Posible duplicado</span>` : ""}</td>
      <td>${escapeHtml(row.supplier)}</td><td>${euros.format(row.previous)}</td><td>${euros.format(row.current)}</td>
      <td><span class="delta ${direction}">${sign}${number.format(row.percent)} %</span></td><td><strong>${euros.format(row.impact)}</strong>${row.reviewed ? `<span class="reviewed-label">Revisada</span>` : ""}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="6"><div class="empty-state">No hay compras que coincidan con los filtros.</div></td></tr>`;
}

function renderTableFilters(rows) {
  const suppliers = [...new Set(rows.map((row) => row.supplier))].sort((a, b) => a.localeCompare(b, "es"));
  const select = $("#supplierFilter");
  const current = suppliers.includes(state.supplier) ? state.supplier : "all";
  select.innerHTML = `<option value="all">Todos los proveedores</option>${suppliers.map((supplier) => `<option value="${escapeHtml(supplier)}">${escapeHtml(supplier)}</option>`).join("")}`;
  select.value = current;
  state.supplier = current;
}

function renderAllAlerts(alerts) {
  const filtered = alerts.filter((row) => {
    const severityMatch = state.severity === "all" || row.severity === state.severity;
    const statusMatch = state.status === "all" || (state.status === "reviewed" ? row.reviewed : !row.reviewed);
    return severityMatch && statusMatch;
  });
  $("#allAlerts").innerHTML = filtered.length ? filtered.map((row) => `
    <article class="full-alert-item ${row.reviewed ? "is-reviewed" : ""}">
      <div class="alert-primary"><span class="severity-icon ${row.severity}">${priorityLabel(row)}</span><span class="data-label">${row.possibleDuplicate ? "Posible duplicado" : "Producto"}</span><strong>${escapeHtml(row.item)}</strong><span class="alert-sub">${escapeHtml(row.supplier)}${row.reviewed ? " · Revisada" : ""}</span></div>
      <div class="hide-mobile"><span class="data-label">Precio</span><strong>${euros.format(row.previous)} → ${euros.format(row.current)}</strong></div>
      <div class="hide-tablet"><span class="data-label">Variación</span><strong>${row.possibleDuplicate ? "Línea repetida" : `+${number.format(row.percent)} %`}</strong></div>
      <div class="hide-mobile"><span class="data-label">Importe</span><strong>${euros.format(row.impact)}</strong></div>
      <button class="review-button" data-detail="${state.rows.indexOf(row)}">Revisar</button>
    </article>`).join("") : `<div class="empty-state">No hay alertas con este filtro.</div>`;
  bindDetailButtons();
}

function bindDetailButtons() {
  $$('[data-detail]').forEach((element) => {
    element.onclick = () => openDetail(Number(element.dataset.detail));
    element.onkeydown = (event) => { if (event.key === "Enter") openDetail(Number(element.dataset.detail)); };
  });
}

function openDetail(index) {
  const row = state.rows[index];
  if (!row) return;
  $("#detailContent").innerHTML = `
    <div class="modal-header"><div><span class="eyebrow">${row.possibleDuplicate ? "POSIBLE DUPLICADO" : "REVISIÓN DE PRECIO"}</span><h2>${escapeHtml(row.item)}</h2></div><button class="icon-button" id="closeDetail" aria-label="Cerrar">×</button></div>
    <p class="modal-copy">${escapeHtml(row.supplier)} · ${escapeHtml(row.invoice || "Factura no indicada")}</p>
    <div class="detail-grid">
      <div class="detail-stat"><span>Precio anterior</span><strong>${euros.format(row.previous)} / ${escapeHtml(row.unit)}</strong></div>
      <div class="detail-stat"><span>Precio actual</span><strong>${euros.format(row.current)} / ${escapeHtml(row.unit)}</strong></div>
      <div class="detail-stat"><span>Variación</span><strong>${row.percent >= 0 ? "+" : ""}${number.format(row.percent)} %</strong></div>
      <div class="detail-stat"><span>Impacto estimado</span><strong>${euros.format(row.impact)}</strong></div>
    </div>
    <div class="recommendation"><strong>Siguiente comprobación:</strong> ${row.possibleDuplicate ? "comprueba en la factura original si esta misma línea se ha contabilizado dos veces." : "verifica que la unidad y el formato sean equivalentes y contrasta el precio con la tarifa, el pedido o la confirmación del proveedor."}</div>
    <div class="modal-actions split-actions"><button class="button danger-ghost" id="deleteDetail">Eliminar línea</button><div><button class="button ghost" id="understoodDetail">Cerrar</button><button class="button primary" id="reviewDetail">${row.reviewed ? "Reabrir alerta" : "Marcar revisada"}</button></div></div>`;
  $("#detailDialog").showModal();
  $("#closeDetail").onclick = () => $("#detailDialog").close();
  $("#understoodDetail").onclick = () => $("#detailDialog").close();
  $("#reviewDetail").onclick = () => {
    row.reviewed = !row.reviewed;
    render();
    $("#detailDialog").close();
    showToast(row.reviewed ? "Alerta marcada como revisada" : "Alerta reabierta");
  };
  $("#deleteDetail").onclick = () => {
    state.rows = state.rows.filter((candidate) => candidate.id !== row.id);
    render();
    $("#detailDialog").close();
    showToast("Línea eliminada");
  };
}

function openSupplier(name) {
  const supplier = getSupplierSummaries().find((candidate) => candidate.name === name);
  if (!supplier) return;
  const alerts = supplier.rows.filter(isAlert).sort((a, b) => b.impact - a.impact);
  const pending = alerts.filter((row) => !row.reviewed);
  const topItems = alerts.slice(0, 4);
  const draft = buildNegotiationDraft(supplier, pending.length ? pending : alerts);
  $("#supplierDetailContent").innerHTML = `
    <div class="modal-header"><div><span class="eyebrow">FICHA DE PROVEEDOR</span><h2>${escapeHtml(supplier.name)}</h2></div><button class="icon-button" id="closeSupplier" aria-label="Cerrar">×</button></div>
    <div class="supplier-detail-hero">
      <div><span>Gasto analizado</span><strong>${euros.format(supplier.spend)}</strong></div>
      <div><span>Impacto pendiente</span><strong>${euros.format(supplier.pendingImpact)}</strong></div>
      <div><span>Alertas abiertas</span><strong>${supplier.pending}</strong></div>
    </div>
    <div class="supplier-detail-section">
      <div class="section-title"><div><span class="eyebrow">PUNTOS DE CONVERSACIÓN</span><h3>Productos con mayor impacto</h3></div></div>
      <div class="negotiation-lines">${topItems.length ? topItems.map((row) => `<div><span><strong>${escapeHtml(row.item)}</strong><small>${euros.format(row.previous)} → ${euros.format(row.current)} · +${number.format(row.percent)} %</small></span><strong>${euros.format(row.impact)}</strong></div>`).join("") : `<p class="empty-inline">No hay subidas detectadas para este proveedor.</p>`}</div>
    </div>
    <div class="supplier-detail-section">
      <div class="section-title"><div><span class="eyebrow">BORRADOR</span><h3>Mensaje para negociar</h3></div><span class="local-badge">No se envía automáticamente</span></div>
      <textarea id="negotiationText" class="negotiation-text" aria-label="Borrador de negociación">${escapeHtml(draft)}</textarea>
    </div>
    <div class="modal-actions split-actions"><button class="button ghost" id="exportSupplier">Exportar CSV</button><div><button class="button ghost" id="markSupplierReviewed" ${pending.length ? "" : "disabled"}>Marcar revisadas</button><button class="button primary" id="copyNegotiation">Copiar mensaje</button></div></div>`;
  $("#supplierDialog").showModal();
  $("#closeSupplier").onclick = () => $("#supplierDialog").close();
  $("#copyNegotiation").onclick = () => copyNegotiationText();
  $("#exportSupplier").onclick = () => exportSupplierReport(supplier);
  $("#markSupplierReviewed").onclick = () => {
    supplier.rows.forEach((row) => { if (row.delta > 0) row.reviewed = true; });
    render();
    $("#supplierDialog").close();
    showToast(`Alertas de ${supplier.name} revisadas`);
  };
}

function buildNegotiationDraft(supplier, alerts) {
  if (!alerts.length) {
    return `Hola, equipo de ${supplier.name}:\n\nEstamos revisando nuestras compras y nos gustaría confirmar que las tarifas y formatos aplicados siguen siendo correctos. ¿Podéis enviarnos vuestra tarifa actualizada?\n\nGracias.`;
  }
  const impact = alerts.reduce((sum, row) => sum + row.impact, 0);
  const products = alerts.slice(0, 3).map((row) => `${row.item} (+${number.format(row.percent)} %)`).join(", ");
  const invoices = [...new Set(alerts.map((row) => row.invoice).filter(Boolean))].slice(0, 3).join(", ");
  return `Hola, equipo de ${supplier.name}:\n\nAl revisar nuestras compras${invoices ? ` y las facturas ${invoices}` : ""}, hemos detectado variaciones de precio en ${products}. El impacto estimado pendiente de revisar es de ${euros.format(impact)}.\n\n¿Podéis confirmar si estas subidas corresponden a una actualización de tarifa y si existe alguna alternativa de precio, formato o volumen?\n\nGracias.`;
}

async function copyNegotiationText() {
  const textarea = $("#negotiationText");
  try {
    await navigator.clipboard.writeText(textarea.value);
  } catch {
    textarea.select();
    document.execCommand("copy");
  }
  showToast("Mensaje copiado");
}

function exportSupplierReport(supplier) {
  const headers = ["proveedor","producto","unidad","precio_anterior","precio_actual","cantidad","variacion_porcentaje","impacto","factura","estado"];
  const rows = supplier.rows.map((row) => [row.supplier,row.item,row.unit,row.previous,row.current,row.quantity,row.percent.toFixed(2),row.impact.toFixed(2),row.invoice,row.reviewed ? "revisada" : "pendiente"]);
  const safeName = supplier.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadFile(`margen-${safeName || "proveedor"}.csv`, [headers, ...rows].map((row) => row.map(csvEscape).join(";")).join("\n"), "text/csv;charset=utf-8");
  showToast("Informe de proveedor exportado");
}

function showView(view) {
  $("#overviewView").classList.toggle("hidden", view !== "overview");
  $("#alertsView").classList.toggle("hidden", view !== "alerts");
  $("#suppliersView").classList.toggle("hidden", view !== "suppliers");
  $("#electricityView").classList.toggle("hidden", view !== "electricity");
  $("#switchView").classList.toggle("hidden", view !== "switch");
  $("#pageTitle").textContent = view === "alerts" ? "Alertas" : view === "suppliers" ? "Proveedores" : view === "electricity" ? "Factura de luz" : view === "switch" ? "Cambiar compañía" : "Resumen";
  $$("[data-view]").forEach((item) => {
    const active = item.dataset.view === view;
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page"); else item.removeAttribute("aria-current");
  });
  $("#sidebar").classList.remove("open");
  $("#menuButton").setAttribute("aria-expanded", "false");
  document.dispatchEvent(new Event("margen:view"));
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function parseSpanishNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  let text = String(value ?? "").trim().replace(/[€$£%]/g, "").replace(/[\s\u00A0]/g, "");
  if (!text) return NaN;
  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/[()]/g, "");
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    const thousands = decimal === "," ? /\./g : /,/g;
    text = text.replace(thousands, "").replace(decimal, ".");
  } else if (comma >= 0) {
    const parts = text.split(",");
    text = parts.length > 2 || (parts[1]?.length === 3 && parts[0].length > 0) ? parts.join("") : text.replace(",", ".");
  } else if (dot >= 0) {
    const parts = text.split(".");
    if (parts.length > 2 || (parts[1]?.length === 3 && parts[0].length > 0)) text = parts.join("");
  }
  const parsed = Number(text);
  return negative ? -parsed : parsed;
}

function parseDelimited(text) {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = clean.split("\n")[0] || "";
  const candidates = [";", ",", "\t"];
  const delimiter = candidates.sort((a, b) => (firstLine.split(b).length - firstLine.split(a).length))[0];
  const matrix = [];
  let row = []; let value = ""; let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === '"' && clean[i + 1] === '"' && quoted) { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(value.trim()); value = ""; }
    else if (char === "\n" && !quoted) { row.push(value.trim()); if (row.some((cell) => cell !== "")) matrix.push(row); row = []; value = ""; }
    else value += char;
  }
  row.push(value.trim());
  if (row.some((cell) => cell !== "")) matrix.push(row);
  return matrix;
}

let excelLoaderPromise = null;
function ensureExcelReader() {
  if (typeof XLSX !== "undefined" && typeof XLSX.read === "function" && XLSX.utils?.sheet_to_json) {
    return Promise.resolve();
  }
  // Fallback temporal: el archivo no sale del navegador. Solo descargamos el lector.
  if (!excelLoaderPromise) {
    excelLoaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.onload = () => {
        if (typeof XLSX !== "undefined" && typeof XLSX.read === "function" && XLSX.utils?.sheet_to_json) resolve();
        else reject(new Error("No se ha podido verificar el lector de Excel."));
      };
      script.onerror = () => reject(new Error("No se ha podido descargar el lector de Excel. Comprueba tu conexión y vuelve a intentarlo."));
      document.head.appendChild(script);
    }).catch(error => {
      excelLoaderPromise = null;
      throw error;
    });
  }
  return excelLoaderPromise;
}

async function readImportFile(file) {
  const extension = file.name.toLowerCase().split(".").pop();
  let matrix;
  if (extension === "xlsx" || extension === "xls") {
    await ensureExcelReader();
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", raw: false, dateNF: "yyyy-mm-dd" });
  } else if (extension === "pdf") {
    if (!window.pdfjsLib) throw new Error("El lector PDF no está disponible. Comprueba la conexión y recarga la página.");
    if (file.size > 8 * 1024 * 1024) throw new Error("PDF demasiado grande (máximo 8 MB).");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.js";
    const task = window.pdfjsLib.getDocument({data:await file.arrayBuffer()});
    const pdf = await task.promise;
    if (pdf.numPages > 15) throw new Error("PDF demasiado largo (máximo 15 páginas).");
    const all = [];
    for (let n=1;n<=pdf.numPages;n++) {
      const page=await pdf.getPage(n);
      const content=await page.getTextContent();
      all.push(window.margenPdfText.textItemsToLines(content.items));
    }
    const parsed = window.margenPdfText.parseInvoiceText(all.join("\n"));
    if (parsed.records.length && parsed.records.some(row => !row.Proveedor)) throw new Error("No se ha podido confirmar el proveedor de la factura.");
    if(!parsed.records.length && !parsed.rejected.length) throw new Error("No se han reconocido líneas completas. Si el PDF es escaneado, hará falta OCR; si contiene texto, copia y revisa sus líneas manualmente.");
    return parsed;
  } else if (extension === "csv") {
    const buffer = await file.arrayBuffer();
    let text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
    matrix = parseDelimited(text);
  } else {
    throw new Error("Formato no admitido. Selecciona un archivo Excel o CSV.");
  }
  matrix = matrix.filter((row) => row.some((cell) => String(cell).trim() !== ""));
  if (matrix.length < 2) throw new Error("El archivo no contiene suficientes filas para analizar.");
  const width = Math.max(...matrix.map((row) => row.length));
  const seenHeaders = new Map();
  const headers = Array.from({ length: width }, (_, index) => {
    const base = String(matrix[0][index] || `Columna ${index + 1}`).trim();
    const count = (seenHeaders.get(base) || 0) + 1;
    seenHeaders.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
  const records = matrix.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))).filter((record) => Object.values(record).some((value) => String(value).trim() !== ""));
  return { headers, records };
}

function suggestMapping(headers) {
  const normalized = headers.map(normalizeHeader);
  const result = Object.fromEntries(MAPPING_FIELDS.map((field) => [field.key, ""]));
  const candidates = [];
  MAPPING_FIELDS.forEach((field) => normalized.forEach((header, index) => {
    const headerTokens = header.split("_").filter(Boolean);
    field.aliases.forEach((alias) => {
      const aliasTokens = alias.split("_").filter(Boolean);
      const exact = header === alias;
      const tokenMatch = alias.length > 2 && aliasTokens.every((token) => headerTokens.includes(token));
      if (exact || tokenMatch) candidates.push({ field: field.key, index, score: exact ? 1000 + alias.length : 100 + aliasTokens.length });
    });
  }));
  const usedHeaders = new Set();
  candidates.sort((a, b) => b.score - a.score).forEach((candidate) => {
    if (!result[candidate.field] && !usedHeaders.has(candidate.index)) {
      result[candidate.field] = headers[candidate.index];
      usedHeaders.add(candidate.index);
    }
  });
  return result;
}

function renderImportReview() {
  const box = $("#importReviewRows");
  box.replaceChildren();
  const fields = [["supplier","Proveedor"],["item","Producto"],["quantity","Cantidad"],["current","Precio unitario"]];
  const pageSize=20;
  const pages=Math.max(1,Math.ceil(state.pendingRows.length/pageSize));
  state.reviewPage=Math.max(0,Math.min(state.reviewPage,pages-1));
  const start=state.reviewPage*pageSize;
  $("#importReviewPage").textContent="Página "+(state.reviewPage+1)+" de "+pages+" · "+state.pendingRows.length+" líneas";
  $("#reviewPrevious").disabled=state.reviewPage===0;
  $("#reviewNext").disabled=state.reviewPage>=pages-1;
  state.pendingRows.slice(start,start+pageSize).forEach((record,offset) => {
    const index=start+offset;
    const card=document.createElement("div"); card.className="import-review-row";
    const title=document.createElement("strong"); title.textContent="Línea "+(index+1);card.append(title);
    for(const [key,label] of fields) {
      const heading=state.mapping[key];
      const wrap=document.createElement("label");wrap.textContent=label;
      const input=document.createElement("input");
      input.type="text";input.value=heading ? String(record[heading] ?? "") : "";
      input.setAttribute("aria-label",label+" línea "+(index+1));
      input.addEventListener("input",()=>{
        if(heading) record[heading]=input.value;
        const value=input.value.trim();
        const valid=(key==="quantity"||key==="current") ? Number.isFinite(parseSpanishNumber(value)) && parseSpanishNumber(value)>0 : Boolean(value);
        input.setAttribute("aria-invalid", String(!valid));
        validateMapping();
      });
      wrap.append(input);card.append(wrap);
    }
    box.append(card);
  });
}
function renderMapping() {
  state.mapping = suggestMapping(state.pendingHeaders);
  state.reviewPage = 0;
  const options = `<option value="">No incluida</option>${state.pendingHeaders.map((header) => `<option value="${escapeHtml(header)}">${escapeHtml(header)}</option>`).join("")}`;
  $("#mappingGrid").innerHTML = MAPPING_FIELDS.map((field) => `<label class="mapping-field"><span>${field.label}${field.required ? " <em>*</em>" : ""}</span><select data-map="${field.key}">${options}</select></label>`).join("");
  $$('[data-map]').forEach((select) => {
    select.value = state.mapping[select.dataset.map] || "";
    select.onchange = () => { state.mapping[select.dataset.map] = select.value; validateMapping(); renderImportReview(); };
  });
  $("#mappingRows").textContent = `${state.pendingRows.length} filas detectadas`;
  $("#mappingPanel").classList.remove("hidden");
  validateMapping();
  renderImportReview();
}

function invalidImportRowIndices() {
  return state.pendingRows.flatMap((record,index) => {
    const bad=["supplier","item","quantity","current"].some(key=>{
      const header=state.mapping[key];
      const value=header ? String(record[header] ?? "").trim() : "";
      return !value || (["quantity","current"].includes(key) && !(parseSpanishNumber(value)>0));
    });
    return bad ? [index] : [];
  });
}

function validateMapping() {
  const missing = MAPPING_FIELDS.filter((field) => field.required && !state.mapping[field.key]);
  const invalidIndices = missing.length ? [] : invalidImportRowIndices();
  const invalid = invalidIndices.length > 0;
  $("#analyzeButton").disabled = missing.length > 0 || !state.pendingRows.length || invalid;
  const jump = $("#reviewFirstError");
  jump.classList.toggle("hidden", !invalid);
  jump.disabled = !invalid;
  if (invalid) jump.textContent = `Ir a la línea ${invalidIndices[0]+1}`;
  $("#importError").textContent = missing.length ? `Falta relacionar: ${missing.map((field) => field.label.toLowerCase()).join(", ")}.` : invalid ? `${invalidIndices.length} línea(s) con errores. La primera es la ${invalidIndices[0]+1}. Corrige cantidad, precio o campos vacíos antes de importar.` : "";
}

function normalizeProduct(value) {
  return String(value || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\bLITROS?\b|\bLTS?\b/g, "L").replace(/\bKILOGRAMOS?\b|\bKGS?\b/g, "KG")
    .replace(/(\d)([A-Z])/g, "$1 $2").replace(/([A-Z])(\d)/g, "$1 $2")
    .replace(/[^A-Z0-9]+/g, " ").replace(/\b(DE|DEL|LA|EL|LOS|LAS)\b/g, " ").replace(/\s+/g, " ").trim();
}

function historyKey(row) {
  return `${normalizeProduct(row.supplier)}|${normalizeProduct(row.item)}|${normalizeProduct(row.unit || "unidad")}`;
}

function findPreviousPurchase(row, rows = state.rows) {
  const key = historyKey(row);
  return [...rows].sort(compareDates).reverse().find((candidate) => historyKey(candidate) === key);
}

function buildImportedRows() {
  const mapped = state.pendingRows.map((record, index) => {
    const get = (key) => state.mapping[key] ? record[state.mapping[key]] : "";
    return {
      supplier: String(get("supplier") || "").trim(),
      item: String(get("item") || "").trim(),
      unit: String(get("unit") || "unidad").trim() || "unidad",
      current: parseSpanishNumber(get("current")),
      previous: parseSpanishNumber(get("previous")),
      quantity: parseSpanishNumber(get("quantity")),
      invoice: String(get("invoice") || "").trim(),
      date: normalizeDate(get("date")),
      sourceRow: index + 2
    };
  });
  const invalid = mapped.filter((row) => !row.supplier || !row.item || !Number.isFinite(row.current) || !Number.isFinite(row.quantity) || row.quantity <= 0);
  const valid = mapped.filter((row) => !invalid.includes(row));
  const baseRows = state.source.startsWith("Demostración") ? [] : [...state.rows];
  const history = [...baseRows].sort(compareDates);
  const latestByProduct = new Map();
  history.forEach((row) => latestByProduct.set(historyKey(row), row));
  const importedRows = [];
  valid.sort(compareDates).forEach((row) => {
    if (!Number.isFinite(row.previous)) {
      const previous = latestByProduct.get(historyKey(row));
      row.previous = previous ? previous.current : row.current;
      row.previousSource = previous ? "history" : "first_purchase";
    } else {
      row.previousSource = "file";
    }
    const normalized = normalizeRow(row);
    history.push(normalized);
    importedRows.push(normalized);
    latestByProduct.set(historyKey(normalized), normalized);
  });
  return { rows: importedRows, baseRows, invalid };
}

function compareDates(a, b) {
  if (!a.date && !b.date) return (a.sourceRow || 0) - (b.sourceRow || 0);
  if (!a.date) return 1;
  if (!b.date) return -1;
  return a.date.localeCompare(b.date);
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const iso = text.match(/^(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const european = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (european) return `${european[3].length === 2 ? `20${european[3]}` : european[3]}-${european[2].padStart(2, "0")}-${european[1].padStart(2, "0")}`;
  return "";
}

function loadDemo() {
  state.rows = analyze(SAMPLE_ROWS);
  state.source = `Demostración · ${SAMPLE_ROWS.length} líneas`;
  state.isDemo = true;
  render(); showView("overview"); showToast("Datos de demostración cargados");
}

function clearDemo() {
  state.rows = [];
  state.source = "Sin datos propios todavía";
  state.isDemo = false;
  render();
  showView("overview");
  showToast("Demo vaciada. Ya puedes añadir tus datos");
}

function openManual() {
  const form = $("#manualForm");
  form.reset();
  form.elements.unit.value = "unidad";
  form.elements.date.value = new Date().toISOString().slice(0, 10);
  $("#manualError").textContent = "";
  updateManualPreview();
  $("#manualDialog").showModal();
  setTimeout(() => form.elements.supplier.focus(), 50);
}

function updateManualPreview() {
  const form = $("#manualForm");
  const previousValue = form.elements.previous.value;
  const currentValue = form.elements.current.value;
  const quantityValue = form.elements.quantity.value;
  const previousPurchase = previousValue ? null : findPreviousPurchase({ supplier: form.elements.supplier.value, item: form.elements.item.value, unit: form.elements.unit.value });
  const previous = previousValue ? Number(previousValue) : previousPurchase?.current;
  const current = Number(currentValue);
  const quantity = Number(quantityValue);
  const preview = $("#manualPreview");
  if (!currentValue || !quantityValue || !Number.isFinite(previous) || ![current, quantity].every(Number.isFinite) || quantity <= 0) {
    preview.innerHTML = `<span>Impacto estimado</span><strong>${previousValue ? "Completa los precios y la cantidad" : "Completa el producto para buscar su historial"}</strong>`;
    return;
  }
  const delta = current - previous;
  const percent = previous > 0 ? delta / previous * 100 : 0;
  const label = delta > 0 ? "Importe a revisar" : delta < 0 ? "Ahorro frente al precio anterior" : "Sin variación";
  preview.innerHTML = `<span>${label}${previousPurchase ? " · según historial" : ""}</span><strong class="${delta > 0 ? "preview-up" : "preview-ok"}">${delta > 0 ? "+" : ""}${euros.format(Math.abs(delta * quantity))} · ${delta > 0 ? "+" : ""}${number.format(percent)} %</strong>`;
}

function saveManualRow(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const previousValue = data.get("previous");
  const raw = {
    supplier: data.get("supplier").trim(),
    invoice: data.get("invoice").trim(),
    date: data.get("date"),
    item: data.get("item").trim(),
    unit: data.get("unit").trim(),
    quantity: Number(data.get("quantity")),
    previous: previousValue === "" ? NaN : Number(previousValue),
    current: Number(data.get("current"))
  };
  const validNumbers = [raw.quantity, raw.current].every(Number.isFinite) && (Number.isNaN(raw.previous) || raw.previous >= 0);
  if (!raw.supplier || !raw.item || !raw.unit || !validNumbers || raw.quantity <= 0 || raw.current < 0) {
    $("#manualError").textContent = "Revisa los campos obligatorios y utiliza importes válidos.";
    return;
  }
  if (!Number.isFinite(raw.previous)) {
    const previous = findPreviousPurchase(raw);
    raw.previous = previous ? previous.current : raw.current;
    raw.previousSource = previous ? "history" : "first_purchase";
  } else {
    raw.previousSource = "manual";
  }
  state.rows.unshift(normalizeRow(raw));
  state.source = `Registro manual · ${state.rows.length} líneas`;
  state.isDemo = false;
  render();
  $("#manualDialog").close();
  showView("overview");
  showToast("Compra añadida y analizada");
}

function exportAlerts() {
  const alerts = getAlerts();
  if (!alerts.length) return showToast("No hay alertas para exportar");
  const headers = ["proveedor","producto","unidad","precio_anterior","precio_actual","cantidad","variacion_porcentaje","importe_a_revisar","factura"];
  const rows = alerts.map((r) => [r.supplier,r.item,r.unit,r.previous,r.current,r.quantity,r.percent.toFixed(2),r.impact.toFixed(2),r.invoice]);
  downloadFile("alertas-margen.csv", [headers, ...rows].map((row) => row.map(csvEscape).join(";")).join("\n"), "text/csv;charset=utf-8");
}

function downloadSample() {
  const headers = ["fecha","proveedor","producto","unidad","precio_actual","cantidad","factura"];
  const rows = SAMPLE_ROWS.slice(0,3).map((r, index) => [`0${index + 1}/10/2026`,r.supplier,r.item,r.unit,r.current,r.quantity,r.invoice]);
  downloadFile("ejemplo-margen.csv", [headers, ...rows].map((row) => row.map(csvEscape).join(";")).join("\n"), "text/csv;charset=utf-8");
}

function openBackup() {
  $("#backupError").textContent = "";
  $("#workspaceInput").value = "";
  $("#backupDialog").showModal();
}

function exportWorkspace() {
  const payload = { app: "margen", version: 1, exportedAt: new Date().toISOString(), source: state.source, rows: state.rows };
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(`margen-copia-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  showToast("Copia de seguridad descargada");
}

async function restoreWorkspace(file) {
  $("#backupError").textContent = "";
  if (!file || !file.name.toLowerCase().endsWith(".json")) {
    $("#backupError").textContent = "Selecciona una copia .json creada por Margen.";
    return;
  }
  try {
    const payload = JSON.parse(await file.text());
    if (payload?.app !== "margen" || !Array.isArray(payload.rows)) throw new Error("El archivo no es una copia válida de Margen.");
    const restored = analyze(payload.rows).filter((row) => row.supplier && row.item && Number.isFinite(row.current) && Number.isFinite(row.quantity));
    if (!restored.length) throw new Error("La copia no contiene compras válidas.");
    if (!window.confirm(`Se sustituirán las ${state.rows.length} líneas actuales por ${restored.length} líneas de la copia. ¿Continuar?`)) return;
    state.rows = restored;
    state.source = `Copia restaurada · ${restored.length} líneas`;
    state.isDemo = false;
    render();
    $("#backupDialog").close();
    showView("overview");
    showToast("Espacio de trabajo restaurado");
  } catch (error) {
    $("#backupError").textContent = error.message;
  }
}

function csvEscape(value) { const text = String(value ?? ""); return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function formatDate(value) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date); }
function downloadFile(name, content, type) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]); }
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2300); }

function openImport() {
  state.pendingFile = null;
  state.pendingRows = [];
  state.pendingHeaders = [];
  state.mapping = {};
  $("#fileInput").value = "";
  $("#dropTitle").textContent = "Arrastra el Excel o CSV aquí";
  $("#dropSubtitle").textContent = "o pulsa para seleccionar un archivo";
  $("#importError").textContent = "";
  $("#mappingPanel").classList.add("hidden");
  $("#analyzeButton").disabled = true;
  $("#importDialog").showModal();
}

function updateImportAudit() {
  const audit = $("#importAudit");
  const accepted = state.pendingRows.length;
  const rejected = state.rejectedPdfLines.length;
  audit.classList.toggle("hidden", accepted + rejected === 0);
  if (!accepted && !rejected) return;
  const incomplete = state.pendingFile && /\.pdf$/i.test(state.pendingFile.name) || state.pendingFile?.name === "Texto de factura revisado" ? state.pendingRows.filter(r => !String(r.Proveedor ?? "").trim()).length : 0;
  const needsReview = rejected > 0 || incomplete > 0;
  $("#importAuditTitle").textContent = needsReview ? "Revisión necesaria" : "Datos propuestos para revisión";
  $("#importAuditSummary").textContent = needsReview
    ? "Hay líneas que necesitan comprobación antes de importar. Ningún importe descartado se cuenta como ahorro."
    : "Se han identificado líneas de compra. Confirma proveedor, producto, cantidad y precio con el original.";
  const facts = $("#importAuditFacts");
  facts.replaceChildren();
  for (const [label, value] of [["Líneas propuestas",accepted],["Líneas rechazadas",rejected],["Sin proveedor",incomplete]]) {
    const item=document.createElement("span");
    item.textContent=label+": "+value;
    facts.append(item);
  }
}
function showPdfImportIssues() {
  updateImportAudit();
  const box = $("#pdfImportIssues");
  const issues = state.rejectedPdfLines;
  box.replaceChildren();
  box.classList.toggle("hidden", !issues.length);
  $("#partialImportConfirmation").classList.toggle("hidden", !issues.length);
  if (!issues.length) return;
  const title = document.createElement("strong");
  title.textContent = issues.length + " línea(s) sin importar: requieren revisión";
  box.append(title);
  const list = document.createElement("ul");
  for (const issue of issues.slice(0, 20)) {
    const item = document.createElement("li");
    item.textContent = issue.reason + ": " + issue.line;
    list.append(item);
  }
  box.append(list);
  if (issues.length > 20) {
    const note=document.createElement("p");
    note.textContent = "Mostrando 20 de " + issues.length + " líneas descartadas.";
    box.append(note);
  }
}

function resetImportFile() {
  state.pendingFile = null;
  state.pendingRows = [];
  state.pendingHeaders = [];
  state.rejectedPdfLines = [];
  $("#fileInput").value = "";
  $("#dropTitle").textContent = "Arrastra un PDF, Excel o CSV aquí";
  $("#dropSubtitle").textContent = "o pulsa para seleccionar un archivo";
  $("#removeImportFile").classList.add("hidden");
  $("#mappingPanel").classList.add("hidden");
  $("#analyzeButton").disabled = true;
  $("#confirmPartialImport").checked = false;
  $("#importError").textContent = "";
  showPdfImportIssues();
}

async function selectFile(file) {
  if (!file || !/\.(pdf|csv|xlsx|xls)$/i.test(file.name)) {
    $("#importError").textContent = "Selecciona PDF con texto, Excel (.xlsx, .xls) o CSV."; return;
  }
  state.pendingFile = file;
  $("#removeImportFile").classList.remove("hidden");
  state.rejectedPdfLines = [];
  $("#confirmPartialImport").checked = false;
  showPdfImportIssues();
  $("#dropTitle").textContent = file.name;
  $("#dropSubtitle").textContent = `${number.format(file.size / 1024)} KB · leyendo columnas…`;
  $("#importError").textContent = "";
  $("#mappingPanel").classList.add("hidden");
  $("#analyzeButton").disabled = true;
  try {
    const parsed = await readImportFile(file);
    state.pendingHeaders = parsed.headers;
    state.pendingRows = parsed.records;
    state.rejectedPdfLines = parsed.rejected || [];
    showPdfImportIssues();
    $("#dropSubtitle").textContent = `${number.format(file.size / 1024)} KB · ${parsed.records.length} líneas propuestas (revísalas)`;
    renderMapping();
    updateImportAudit();
  } catch (error) {
    state.pendingRows = [];
    state.rejectedPdfLines = [];
    showPdfImportIssues();
    $("#dropSubtitle").textContent = "No se ha podido leer el archivo";
    $("#importError").textContent = /PDF demasiado largo/.test(error.message) ? "Este PDF supera 15 páginas. Margen está preparado para facturas breves, no para apuntes o documentos largos. Puedes quitarlo y elegir una factura de prueba." : error.message;
  }
}

function analyzeFile() {
  try {
    const result = buildImportedRows();
    if (!result.rows.length) throw new Error("No se han encontrado filas válidas con este mapeo.");
    if (state.rejectedPdfLines.length && !$("#confirmPartialImport").checked) throw new Error("Hay líneas descartadas. Revísalas y marca la confirmación para importar solo las válidas.");
    state.rows = [...result.baseRows, ...result.rows];
    state.source = `${state.pendingFile.name} · ${result.rows.length} líneas importadas`;
    state.isDemo = false;
    render(); $("#importDialog").close(); showView("overview");
    showToast(result.invalid.length ? `${result.rows.length} filas importadas · ${result.invalid.length} omitidas` : `${result.rows.length} filas importadas`);
  } catch (error) { $("#importError").textContent = error.message; }
}

function init() {
  if (new URLSearchParams(window.location.search).get("demo") === "1") {
    loadDemo();
  } else try {
    const saved = JSON.parse(localStorage.getItem("margen-dataset"));
    if (saved && Array.isArray(saved.rows)) { state.rows = analyze(saved.rows); state.source = saved.source || "Datos guardados"; state.isDemo = Boolean(saved.isDemo); } else loadDemo();
  } catch { loadDemo(); }
  if (state.isDemo) window.margenMetrics?.track("demo_use");
  if (state.rows.length) render();
  $$("[data-view]").forEach((button) => button.addEventListener("click", () => { showView(button.dataset.view); window.scrollTo({top: 0, behavior: "instant"}); }));
  $$("[data-action='open-import']").forEach((button) => button.addEventListener("click", openImport));
  $$("[data-action='open-manual']").forEach((button) => button.addEventListener("click", openManual));
  $$("[data-action='open-backup']").forEach((button) => button.addEventListener("click", openBackup));
  $("#importButton").onclick = openImport;
  $("#firstMinuteImport").onclick = openImport;
  window.margenElectricity.attach(document);
  $("#manualButton").onclick = openManual;
  $("#loadDemoButton").onclick = loadDemo;
  $("#clearDemoButton").onclick = clearDemo;
  $("#exportButton").onclick = exportAlerts;
  $("#downloadSample").onclick = downloadSample;
  $("#fileInput").onchange = (event) => selectFile(event.target.files[0]);
  $("#analyzeButton").onclick = analyzeFile;
  $("#reviewPrevious").onclick = () => {state.reviewPage--;renderImportReview();};
  $("#reviewNext").onclick = () => {state.reviewPage++;renderImportReview();};
  $("#reviewFirstError").onclick = () => {const errors=invalidImportRowIndices();if(errors.length){state.reviewPage=Math.floor(errors[0]/20);renderImportReview();}};
  $("#removeImportFile").onclick = resetImportFile;
  $("#parseInvoiceTextButton").onclick = () => {
    try {
      const parsed = window.margenPdfText.parseInvoiceText($("#invoicePastedText").value);
      if (!parsed.records.length) throw Error("No se han detectado líneas con producto, cantidad y precio separados por tabuladores. Revisa el texto original.");
      state.pendingFile = {name:"Texto de factura revisado"};
      $("#confirmPartialImport").checked = false;
      state.pendingHeaders = parsed.headers;
      state.pendingRows = parsed.records;
      state.rejectedPdfLines = parsed.rejected || [];
      showPdfImportIssues();
      $("#dropSubtitle").textContent = parsed.records.length + " líneas encontradas en el texto";
      renderMapping();
    } catch (error) { $("#importError").textContent = error.message; }
  };
  $("#severityFilter").onchange = (event) => { state.severity = event.target.value; renderAllAlerts(getAlerts()); };
  $("#statusFilter").onchange = (event) => { state.status = event.target.value; renderAllAlerts(getAlerts()); };
  $("#tableSearch").oninput = (event) => { state.query = event.target.value; renderTable(state.rows); };
  $("#supplierFilter").onchange = (event) => { state.supplier = event.target.value; renderTable(state.rows); };
  $("#manualForm").onsubmit = saveManualRow;
  $("#manualForm").oninput = updateManualPreview;
  $("#closeManual").onclick = () => $("#manualDialog").close();
  $("#cancelManual").onclick = () => $("#manualDialog").close();
  $("#closeBackup").onclick = () => $("#backupDialog").close();
  $("#exportWorkspace").onclick = exportWorkspace;
  $("#workspaceInput").onchange = (event) => restoreWorkspace(event.target.files[0]);
  $("#menuButton").onclick = () => { const sidebar = $("#sidebar"); sidebar.classList.toggle("open"); $("#menuButton").setAttribute("aria-expanded", sidebar.classList.contains("open")); };
  const drop = $("#dropZone");
  ["dragenter","dragover"].forEach((name) => drop.addEventListener(name, (e) => { e.preventDefault(); drop.classList.add("dragging"); }));
  ["dragleave","drop"].forEach((name) => drop.addEventListener(name, (e) => { e.preventDefault(); drop.classList.remove("dragging"); }));
  drop.addEventListener("drop", (event) => selectFile(event.dataTransfer.files[0]));
}

init();
if (new URLSearchParams(location.search).get("view") === "electricity") showView("electricity");


if (new URLSearchParams(location.search).get("view") === "switch") showView("switch");
