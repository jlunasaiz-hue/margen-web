# Integración ERP de solo lectura

La publicación actual no tiene proveedor ni credenciales ERP configurados y devuelve `ERP_NOT_CONFIGURED`. No se envían claves del proveedor al navegador. El panel funciona con datos locales mientras se configura la integración.

`createErpHandler({authenticate, connector})` expone `GET /api/erp/status` y `GET /api/erp/catalog`. En producción el handler se inyecta como `erpHandler` en `createLiveWorker`. La autenticación debe verificar la sesión y obtener `actorId` y `workspaceId` desde el servidor. Nunca acepte esas identidades desde query strings o cabeceras arbitrarias del navegador.

El adaptador implementa `fetchCosts({workspaceId,actorId,signal})`: debe comprobar que el usuario tiene permiso en la empresa, paginar la API real, normalizar importes netos en EUR y respetar la señal de cancelación. Sus URLs y credenciales se configuran en el servidor; el endpoint no es un proxy abierto. No modifica facturas, pagos ni el ERP. El motor valida hasta 5.000 líneas, fechas, identificadores únicos, precios y cantidades. Las respuestas privadas no se cachean. Los errores conservan los datos anteriores en el panel.

Formato que devuelve el adaptador:

```json
{"version":1,"currency":"EUR","priceBasis":"net","purchases":[{"id":"linea-123","supplier":"Proveedor","item":"Pollo","unit":"kg","unitPrice":7.28,"quantity":10,"date":"2026-10-12","invoice":"F-123"}]}
```

El panel sincroniza al pulsar el botón y, tras el primer éxito, cada 60 segundos mientras está abierto, visible y con internet. Las líneas se actualizan por identificador y conservan las compras locales de un espacio real. Si había una demo, la sustituye por las líneas reales. Los insumos se vinculan por proveedor, producto y unidad exacta. La ficha de producto sigue necesitando precio neto de venta, unidades del periodo y consumo de cada insumo por unidad vendida. No se inventan recetas ni conversiones de unidades.

Para activar un proveedor concreto faltan: ERP elegido, acceso de API autorizado, identificación de empresa, autenticación de los usuarios de Margen, permisos de lectura y validación del adaptador con respuestas reales. Las pruebas con adaptadores ficticios comprueban el contrato y el aislamiento; no acreditan una conexión real.
