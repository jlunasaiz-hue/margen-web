# Cambio de comercializadora: estado de implementación

La web pública ofrece una demostración local y mantiene deshabilitada la contratación real. `switching.mjs` es un coordinador de servidor con una API HTTP preparada, repositorio SQLite local y procesador de cola; sin servidor de contratación desplegado ni adaptador comercial habilitado. No existe un cambio de proveedor operativo en esta versión.

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

## Bloque de servidor y persistencia

Implementado y probado: `sqlite-repository.mjs` (cola, bloqueo con caducidad, auditoría, eventos atómicos), `switch-api.mjs` (consulta de estado/historial y creación autenticada, origen permitido y cuerpo limitado), `switch-worker.mjs` (envío y conciliación de órdenes interrumpidas).

El repositorio SQLite requiere Node 24 y disco privado persistente. No se ejecuta en Cloudflare Workers ni en GitHub Pages. La publicación actual sigue siendo estática; antes de conectar clientes reales hay que desplegar el servicio en un entorno Node con disco privado, o implementar el mismo contrato de repositorio sobre D1 y un entorno Worker con identidad validada. No debe copiarse un archivo SQLite a `dist/` ni a GitHub.

Preparación local, sin usuarios ni contratos:

```sh
MARGEN_SWITCH_DB=/ruta/privada/margen-switch.sqlite npm run switch:migrate
MARGEN_SWITCH_DB=/ruta/privada/margen-switch.sqlite npm run switch:server
```

El servicio local escucha solo en `127.0.0.1:3002` y por defecto no incorpora autenticación ni conexiones de contratación: su endpoint de disponibilidad indica `not_connected`; los endpoints privados responden 503. Su fábrica admite un handler con autenticación verificable únicamente para pruebas/integración de servidor. No se pueden activar firmas o contratar cambiando un parámetro del navegador.

API prevista:
- `GET /api/switching/capabilities`: disponibilidad, sin datos privados.
- `GET /api/switching/requests`: últimas solicitudes de la sesión autenticada.
- `GET /api/switching/requests/:id`: estado e historial únicamente del propietario.
- `POST /api/switching/requests`: IDs de oferta, suministro y autorización ya verificados. El actor se obtiene de la sesión.

El seguimiento permanece disponible para sesiones verificadas aunque el envío esté deshabilitado. No se publican IDs internos de firma, contrato o proveedor en estas respuestas. La firma y el alta de ofertas/consentimientos verificados no tienen rutas públicas en este bloque.

Los adaptadores comerciales deben imponer timeout de red menor que la duración del lease y resolver todas las consultas mediante canales autenticados. La conciliación solo consulta por la misma clave idempotente; una respuesta `not_found` o ambigua no produce un reenvío automático. El hosting real, las notificaciones al cliente, el adaptador comercial, el verificador de firmas y el proveedor de identidad todavía no están integrados.

El procesador consulta también solicitudes recibidas/aceptadas para confirmar su activación si el callback se pierde. No reenvía esas solicitudes. Una respuesta atrasada «recibida» no rebaja el estado «aceptada», y repetir un estado idéntico no añade filas al historial. El adaptador debe documentar la autenticidad y la consistencia de su consulta de estado.
