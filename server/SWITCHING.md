# Cambio de comercializadora: estado de implementación

La web pública ofrece una demostración local y mantiene deshabilitada la contratación real. `switching.mjs` es un coordinador de servidor sin ruta HTTP ni adaptador comercial habilitados. No existe un cambio de proveedor operativo en esta versión.

## Integración necesaria

1. Contrato comercial y API de contratación de una comercializadora o intermediario autorizado: ofertas para el suministro, envío idempotente, consulta de estado y confirmación de activación.
2. Servidor autenticado. `actorId` procede de la sesión; nunca de un campo que pueda cambiar el navegador. Identidad y representación se verifican para cada suministro.
3. Oferta persistida y verificada que incluya periodo, costes comparables, impuestos, servicios, permanencia, penalización de salida, elegibilidad, caducidad y hash del contrato.
4. Evidencia verificable de aceptación de esa oferta y contrato concretos. Una casilla de la demo no se convierte en autorización real. La consulta de consumo tampoco autoriza contratación ni cambios posteriores.
5. Repositorio persistente con exclusión mutua por suministro, unicidad de autorización, cola durable, eventos deduplicados y auditoría. `withSupplyLock` asegura una transacción atómica al crear la solicitud. `withRequestLock` usa un bloqueo durable/lease; cada `update` debe confirmarse antes de efectuar la petición externa, sin mantener una transacción SQL abierta durante esa petición. El repositorio de las pruebas usa memoria y no sirve para producción.
6. Worker de cola y reconciliador. Un timeout, respuesta ambigua o proceso interrumpido en `dispatching` obliga a consultar al proveedor por la misma clave; nunca reenvía automáticamente una contratación de resultado desconocido. `validateForDispatch` vuelve a verificar autorización, contrato, caducidad y elegibilidad justo antes del envío.
7. Verificador de callbacks contra la especificación del proveedor (firma, emisor, fecha, identificador único y protección de replay). El navegador nunca fija el estado final. `verifyProviderEvent` solo devuelve eventos auténticos, no datos de una petición sin verificar.
8. Canal de incidencias, cancelación/desistimiento cuando corresponda, notificaciones y revisión de los textos contractuales aplicables. Las activaciones y rechazos terminales requieren conciliación para cualquier discrepancia posterior; no se sobreescriben con eventos fuera de orden.

Estados: `queued` → `dispatching` → `submitted` → `accepted` → `activated`. Salidas: `blocked`, `rejected`, `reconciliation_required`. Una aceptación no es una activación. El clic inicia una solicitud autorizada; la fecha efectiva la determina el proceso de la comercializadora y la distribuidora.

No habilitar el botón mediante CSS/JavaScript. No guardar CUPS, documentos de identidad, IBAN, firmas o credenciales en localStorage ni en el repositorio Git. Los proveedores y los importes del ejemplo son ficticios.

Fuentes consultadas el 11 de octubre de 2026:
- CNMC, guía de cambio: https://www.cnmc.es/sectores-que-regulamos/energia/cambio-de-comercializador-en-espa%C3%B1a/guia-informativa
- CNMC, supervisión de consentimiento: https://www.cnmc.es/prensa/consentimiento-cambio-comercializador-20220228
