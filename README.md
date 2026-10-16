# ZARVIQO — sitio público y aplicación

ZARVIQO es el nuevo nombre comercial de la aplicación de control de costes anteriormente denominada Margen. El repositorio conserva el identificador técnico `margen-web` para no romper integraciones existentes. La funcionalidad de **margen de contribución** mantiene su nombre: es un concepto financiero.

## Publicación recomendada: Cloudflare Pages

**Sitio publicado en Cloudflare Pages:** https://zarviqo.pages.dev/ (despliegue inicial confirmado por el propietario; los cambios posteriores requieren verificación).
**Dominio principal previsto:** https://zarviqo.com/ (pendiente de confirmar DNS y dominio personalizado).
**Panel:** https://zarviqo.com/app.html

La web es actualmente estática, con datos por navegador; todavía no hay cuentas, base de datos central, sincronización entre clientes ni recepción automática de solicitudes comerciales.

### Activación por el propietario de la cuenta

1. Entrar en [Cloudflare Dashboard](https://dash.cloudflare.com/) y crear un proyecto de **Workers & Pages → Pages → Connect to Git** (las etiquetas pueden variar).
2. Autorizar GitHub y seleccionar el repositorio `jlunasaiz-hue/margen-web`, rama `main`.
3. Configurar **Framework preset: None**, **Build command: `npm run build:pages`**, **Build output directory: `_site`**. Seleccionar Node.js compatible con `package.json` (Node 24) si se solicita.
4. Desplegar y probar el enlace temporal `*.pages.dev`. No publicar el repositorio completo como raíz web: `_site` contiene solo los activos públicos permitidos.
5. En el proyecto Pages, añadir **Custom domains → zarviqo.com** y seguir las instrucciones específicas para enlazar los DNS y verificar el dominio.
6. Para `www.zarviqo.com`, agregarlo como dominio personalizado y configurar redirección permanente hacia `https://zarviqo.com/`. No crear entradas DNS contradictorias. Si el dominio está registrado fuera de Cloudflare, el proveedor puede requerir transferir la gestión DNS a Cloudflare mediante nameservers para usar el dominio raíz con Pages.
7. Verificar certificado HTTPS, inicio, panel, importación, descarga e instalación PWA; comprobar desde móvil. Solo entonces anunciar la URL al público.

Los dominios secundarios (`.es`, `.app`, `.eu` si se han comprado) **son opcionales** y requieren configuración de DNS y redirección a la URL principal; no hay que alojar cuatro webs.

### Google y SEO

Una vez accesible `https://zarviqo.com/`, registrar la propiedad en [Google Search Console](https://search.google.com/search-console), verificar la propiedad y enviar `https://zarviqo.com/sitemap.xml`. Indexar no es inmediato ni garantizado.

## Radar de alternativas entre proveedores

La sección **Radar de proveedores** (`app.html?view=sourcing`) compara precios de compras históricas entre proveedores para el **mismo nombre de producto normalizado y la misma unidad**, sin adivinar equivalencias. Usa la última compra registrada por proveedor, ignora posibles duplicados, excluye registros futuros y de más de 180 días, y exige que las fechas de las dos compras estén dentro del rango seleccionado (30, 90 o 180 días). Calcula la diferencia de precios aplicada a la cantidad de la compra comparada, **sin extrapolación mensual/anual ni afirmaciones de ahorro conseguido**. Incluye estados locales de revisión y solicitud de presupuesto para copiar manualmente. No contacta con proveedores, no consulta tarifas actuales ni contrata nada.

En la demostración, los proveedores y los precios son ficticios. El radar tiene pruebas unitarias en `tests/sourcing.test.cjs`. No usar sus comparaciones como decisiones comerciales sin confirmar condiciones, unidades, calidad, impuestos y transporte.

## Presentación tridimensional de la portada

La página principal incorpora **ZARVIQO Intelligence**, un hero de visualización conceptual WebGL2 (archivo `hero-3d.js`) con esfera de cristal estilizado, tres órbitas, nodos y cuadrícula de profundidad. No es una representación de datos reales ni una captura de precios en vivo. Responde al cursor y al desplazamiento mientras el hero está visible. No utiliza Three.js, Spline, CDNs ni recursos 3D externos, de modo que el despliegue sigue siendo estático y compatible con Cloudflare Pages.

**Rendimiento y accesibilidad:** sin pantalla de carga bloqueante; texto y botones visibles incluso sin JavaScript; fallback CSS cuando falta WebGL2, el navegador solicita reducir movimiento o se ha activado ahorro de datos/conexión lenta; botón de pausa; pausa al salir del viewport o cambiar de pestaña; resolución limitada y frecuencia máxima de 30 FPS en pantallas estrechas y 45 FPS en escritorio. La prueba `tests/hero.test.cjs` verifica la integración estática, pero el rendimiento real en móviles requiere medir con Lighthouse y dispositivos físicos. Si aparecen problemas de GPU, la escena debe simplificarse o desactivarse, nunca impedir la navegación.

## Comprobaciones

- `npm run check`: sintaxis y pruebas.
- `npm run build:pages`: compila una carpeta `_site` segura para Cloudflare Pages.
- `npm run smoke:public -- https://zarviqo.com/`: comprobación HTTPS después del despliegue y DNS.
- El panel (`app.html`) tiene meta `noindex,follow`; la portada comercial puede indexarse.
- El servicio offline puede conservar archivos antiguos en dispositivos: comprobar actualización y recargar; no borrar almacenamiento de clientes sin consentimiento.

## Límites comerciales y legales

El formulario de solicitud permite preparar, copiar y descargar el texto, pero **no envía solicitudes automáticamente**: `PILOT_CONTACT` en `landing.js` no está configurado. No afirmar que existen suscripciones activas o recepción automática de formularios. El análisis se hace localmente en el navegador; no hay todavía infraestructura multiusuario segura para documentos comerciales de terceros. Antes de operar con clientes reales, revisar privacidad, condiciones, facturación, seguridad y permisos apropiados.

## Repositorio técnico

Se mantiene temporalmente `jlunasaiz-hue/margen-web` para conservar su historial y automatizaciones. Cambiar el nombre del repositorio de GitHub no es necesario para que la web pública sea ZARVIQO.
