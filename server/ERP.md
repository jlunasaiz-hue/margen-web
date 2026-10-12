# Integración ERP de solo lectura

La publicación actual no tiene proveedor ni credenciales ERP configurados y devuelve `ERP_NOT_CONFIGURED`. No se envían claves del proveedor al navegador. El panel funciona con datos locales mientras se configura la integración.

`createErpHandler({authenticate, connector})` expone `GET /api/erp/status` y `GET /api/erp/catalog`. En producción el handler se inyecta como `erpHandler` en `createLiveWorker`. La autenticación debe verificar la sesión y obtener `actorId` y `workspaceId` desde el servidor. Nunca acepte esas identidades desde query strings o cabeceras arbitrarias del navegador.

El adaptador implementa `fetchCosts({workspaceId,actorId,signal})`: debe comprobar que el usuario tiene permiso en la empresa, paginar la API real, normalizar importes netos en EUR y respetar la señal de cancelación. Sus URLs y credenciales se configuran en el servidor; el endpoint no es un proxy abierto. No modifica facturas, pagos ni el ERP. El motor valida hasta 5.000 líneas, fechas, identificadores únicos, precios y cantidades. Las respuestas privadas no se cachean. Los errores conservan los datos anteriores en el panel.

Formato que devuelve el adaptador:

```json
{"version":1,"currency":"EUR","priceBasis":"net","purchases":[{"id":"linea-123","supplier":"Proveedor","item":"Pollo","unit":"kg","unitPrice":7.28,"quantity":10,"date":"2026-10-12","invoice":"F-123"}]}
```

El panel sincroniza al pulsar el botón y, tras el primer éxito, con la frecuencia indicada por el adaptador mientras está abierto, visible y con internet. Las líneas se actualizan por identificador y conservan las compras locales de un espacio real. Si había una demo, la sustituye por las líneas reales. Los insumos se vinculan por proveedor, producto y unidad exacta. La ficha de producto sigue necesitando precio neto de venta, unidades del periodo y consumo de cada insumo por unidad vendida. No se inventan recetas ni conversiones de unidades.

Para activar un proveedor concreto faltan: ERP elegido, acceso de API autorizado, identificación de empresa, autenticación de los usuarios de Margen, permisos de lectura y validación del adaptador con respuestas reales. Las pruebas con adaptadores ficticios comprueban el contrato y el aislamiento; no acreditan una conexión real.

## Primer proveedor: Holded API v2

Implementado `createHoldedConnector` y `createHoldedErpHandler`. La lectura utiliza exclusivamente `GET https://api.holded.com/api/v2/purchases`, `Authorization: Bearer`, paginación por cursor y filtro `approval_status=approved`. Requiere una clave con acceso `accounting:purchases.read`. No utiliza la API antigua ni acepta URLs de proveedor desde el navegador.

`getConnection({workspaceId,actorId})` debe consultar el almacén de secretos y verificar permisos antes de devolver `{authorized:true,workspaceId,apiKey,startDate,endDate}`. Se comprueba en cada llamada, también antes de devolver una caché privada. La clave se mantiene en el servidor; los datos se aíslan por empresa, huella de credencial y rango de fechas. Cambiar o revocar el acceso impide reutilizar datos cacheados con otra clave. El rango máximo es de 366 días. Se exige un identificador estable para cada línea; una factura sin identificadores o con totales incoherentes bloquea la sincronización completa.

Se comprueban el subtotal antes de descuentos y el neto `total - tax`; se aplica el descuento porcentual de línea y se distribuye proporcionalmente cualquier descuento residual del documento. Los suplidos se excluyen. Las líneas con unidad ausente se marcan como `unidad sin especificar`: no se deduce que sean kg o litros. Portes no expresados como línea no se reparten entre ingredientes. Solo se leen facturas de compra; las rectificativas requieren un flujo de conciliación posterior y no están implementadas.

La consulta devuelve una instantánea completa del rango. El panel sustituye las líneas Holded de ese rango y conserva las compras manuales, evitando mantener facturas anuladas que ya no figuren en la instantánea. Ante un error no aplica una respuesta parcial. Los resultados se conservan en caché privada durante 6 horas por defecto; la frecuencia debe ajustarse al plan y al volumen reales. El cliente respeta la frecuencia recibida y los HTTP 429 / `Retry-After`. No se han activado webhooks ni supervisión con la web cerrada. La memoria de caché/cuotas es local al proceso; un despliegue con varios procesos necesitará coordinación persistente.

Fuentes oficiales verificadas el 12/10/2026:
- https://www.holded.com/en-us/developers/api-reference/purchases/list-purchases
- https://www.holded.com/en-us/developers/api-reference/purchases/get-a-purchase
- https://www.holded.com/en-us/developers/authentication
- https://www.holded.com/en-us/developers/rate-limiting

La integración sigue desactivada en producción: faltan identidad verificada en Margen y una cuenta Holded autorizada. Las pruebas utilizan respuestas construidas según el esquema documentado; falta contrastarlo con una empresa real.
