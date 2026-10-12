# ZARVIQO — sitio público y aplicación

ZARVIQO es el nuevo nombre comercial de la aplicación de control de costes anteriormente denominada Margen. El repositorio conserva el identificador técnico `margen-web` para no romper integraciones existentes. La funcionalidad de **margen de contribución** mantiene su nombre: es un concepto financiero.

## Publicación recomendada: Cloudflare Pages

**Dominio principal previsto:** https://zarviqo.com/ (aún se necesita configurar y verificar DNS y despliegue).
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
