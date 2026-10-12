# Margen — página pública y aplicación

Margen es una herramienta para que restaurantes revisen subidas de precios, proveedores y posibles duplicados de compras. Está en fase de validación comercial.

## Direcciones públicas previstas

- Presentación comercial: https://jlunasaiz-hue.github.io/margen-web/
- Panel de Margen: https://jlunasaiz-hue.github.io/margen-web/app.html
- Mapa del sitio: https://jlunasaiz-hue.github.io/margen-web/sitemap.xml

La presencia de estas direcciones en el código **no demuestra** que GitHub Pages esté activado o que el despliegue haya terminado correctamente.

## Activar la publicación

El repositorio incluye el flujo `.github/workflows/pages.yml` y el comando `npm run build:pages`. El despliegue se genera en `_site/` con una lista limitada de recursos estáticos; no publica archivos del servidor ni carpetas de pruebas.

1. En GitHub, abrir **Settings → Pages** del repositorio `jlunasaiz-hue/margen-web`.
2. En **Build and deployment → Source**, seleccionar **GitHub Actions**. No es necesario generar otro flujo desde las plantillas.
3. Abrir **Actions → Publicar Margen en GitHub Pages → Run workflow**, seleccionar `main` y ejecutar. Se puede lanzar también automáticamente con un nuevo commit.
4. Comprobar el resultado de `build` y `deploy`; después abrir la dirección comercial y el panel desde otro dispositivo o una ventana privada.

**Importante:** el acceso público no implica posicionamiento en buscadores. No está configurado ningún dominio propio. La aplicación funciona con datos guardados localmente en cada navegador: el mismo enlace no sincroniza los datos entre dispositivos.

## Solicitar la indexación en Google

1. Abrir https://search.google.com/search-console y añadir una propiedad de **prefijo de URL**: `https://jlunasaiz-hue.github.io/margen-web/`.
2. Verificar la propiedad siguiendo el método ofrecido por Google. Si ofrece un archivo HTML, incorporarlo al sitio público antes de validar. La publicación de `_site/` utiliza una lista explícita de archivos y puede requerir incluir la verificación en `scripts/build-pages.mjs`.
3. En **Sitemaps**, enviar `https://jlunasaiz-hue.github.io/margen-web/sitemap.xml`.
4. En **Inspección de URLs**, probar `https://jlunasaiz-hue.github.io/margen-web/` y solicitar su indexación si cumple los requisitos.

El archivo `robots.txt` del subdirectorio del proyecto está incluido para facilitar futuras migraciones, pero **no funciona como robots.txt global** de `github.io`. Por tanto, no sustituye la configuración mediante Search Console.

La página comercial permite indexación. El panel `app.html` lleva `noindex,follow`, porque es una herramienta de trabajo y la página comercial es la que debe aparecer en los resultados.

## Control de calidad y límites conocidos

- `npm run check`: sintaxis y pruebas automáticas.
- `npm run build:pages`: prepara la web estática en `_site/` si encuentra los archivos requeridos.
- `app.html` tiene diseño adaptable e instalación tipo PWA, pero hay que validar el funcionamiento de descarga, PDF y almacenamiento en móviles reales.
- La extracción de facturas PDF puede requerir mejoras adicionales: algunos documentos escaneados no se leen sin OCR.
- El formulario del piloto prepara una solicitud, pero **el correo comercial todavía no está configurado**. No se debe afirmar que recibe solicitudes automáticamente.
