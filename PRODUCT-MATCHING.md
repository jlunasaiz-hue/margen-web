# Bloque 3: productos y unidades

Las coincidencias se proponen dentro de la revisión de importación y necesitan confirmación. El diccionario local se guarda en `margen-product-rules-v1`, con decisiones vinculadas al proveedor, nombre de origen y formato. Confirmar una equivalencia o mantener un producto separado evita volver a pedir la misma decisión. El gestor «Productos emparejados» permite olvidar decisiones para las próximas importaciones.

Se normalizan kg/kilos/kilogramos, g/gr/gramos, l/lt/litros, ml, ud/uds/unidades y cajas/cj/cjs. La normalización de gramos y mililitros convierte tanto la cantidad como el precio unitario, preservando `precio × cantidad`. Una caja, garrafa o paquete no se convierte a kg o litros sin una equivalencia declarada por el usuario. Los formatos y dimensiones diferentes requieren indicar unidades de destino por unidad de origen; no se deducen densidades ni contenido de cajas.

Los nombres aproximados usan tokens, abreviaturas habituales y distancia de edición; números de referencia y formatos diferentes impiden proponer algunas coincidencias potencialmente engañosas. Son sugerencias, no una identificación garantizada. La revisión ofrece también búsqueda manual de destino. Las sugerencias se calculan solo para la página visible. Las no confirmadas se importan como productos separados. Se conserva el nombre, unidad, cantidad y precio originales en la fila y en su detalle. Las reglas se incluyen en la copia de seguridad.

El historial se convierte a una base comparable en memoria para inferir el precio anterior. No se vuelven a convertir filas ya normalizadas. Los datos existentes se conservan; la identidad confirmada se aplica a la importación actual y a las siguientes. El procesamiento del bloque es local, sin APIs ni envío de facturas.

Validación: pruebas con variantes habituales de nombres de factura, conversión de unidades, equivalencias explícitas, repetición de importaciones y conservación de importe/impacto. Los casos de prueba son ejemplos construidos, no facturas reales de clientes. La revisión visual en Safari queda pendiente porque este entorno no dispone de navegador de pruebas.
