(function () {
  const STORAGE_KEY = "margen-metrics-v1";
  const ALLOWED_EVENTS = new Set(["landing_visit", "pilot_click", "demo_use"]);

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function track(event) {
    if (!ALLOWED_EVENTS.has(event)) return;
    try {
      const metrics = read();
      metrics[event] = Number(metrics[event] || 0) + 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
    } catch {
      // La medición es opcional: la web sigue funcionando si el navegador bloquea el almacenamiento.
    }
  }

  window.margenMetrics = { track, summary: read };
})();
