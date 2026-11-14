# Parque Acuático · Caja

App para el celular que reemplaza la planilla de caja en papel, para los tres lugares del parque (Licán Ray, Pucón y Villarrica). Registra cada venta, controla las pulseras y el tiempo, cuadra la caja y guarda el día en Drive. Funciona sin señal y sincroniza con una planilla de Google Sheets.

## Qué hace

- **Lugares**: cada lugar tiene su propia caja, inventario y archivos. Quien trabaja en un lugar solo ve ese lugar. Los usuarios con rol `admin` (los dueños) cambian de lugar tocando el nombre arriba y tienen la pestaña **Reportes**.
- **Vender (tipo carrito)**: en una sola venta se juntan entradas (½ hora, 1 hora, Full day), free pass, cortesías, juegos (arrastre, banano, sacachucha, extreme) y productos (calcetas, bolsa de teléfono), con un solo pago en **Efectivo** o **Débito**.
- **Pulseras**: cada entrada entrega pulseras de su color. 1 hora es dorada, Full day plateada y cada juego tiene su color flúor. La ½ hora, el free pass y la cortesía usan el color del turno, que va rotando: los que entran en el mismo turno comparten color y se salta los colores que siguen en el agua. Se puede cambiar con un toque.
- **Free pass y cortesía**: valen $0, usan pulsera (se descuenta del stock) y quedan contados aparte.
- **Horario de 5 en 5**: la entrada se redondea a los 5 minutos siguientes (si son las 10:51, el turno parte a las 10:55).
- **En el agua**: cada turno con su cuenta regresiva, los que están por entrar y la lista de ventas del día con quién la registró o editó. Tocando una venta se corrige, se registra una devolución o se anula.
- **Alerta de término**: cuando se acaba el tiempo, suena, vibra y aparece "Llama a los de pulsera X". Se repite cada 9 s hasta tocar "Listo" (máximo 3 min). Mientras hay grupos en el agua la pantalla queda encendida.
- **Inventario**: stock de productos y de pulseras por color. Las ventas se descuentan solas; se anota el stock al abrir, lo que llega y los conteos (si no cuadra, se corrige y queda la diferencia). Lo que queda pasa al día siguiente.
- **Caja y cuadre**: total por medio de pago, lo vendido, pulseras entregadas por color (y cuántas quedan), gastos, neto y "neto ÷ socios" del lugar. Al cerrar se ingresa el **efectivo contado** y el **total de la máquina de débito**, y la app muestra si cuadra, sobra o falta.
- **Cerrar caja**: el día queda bloqueado y se guarda una planilla del día en Drive (`Cajas diarias – Parque Acuático / <lugar> / <mes>`). Solo un `admin` puede reabrirla.
- **Reportes** (admin): por lugar o todos juntos, por día, 7 días, mes o fechas a elección: recaudado, neto, efectivo, débito, pulseras, juegos, gratis, gastos, diferencias de caja y los cierres con su archivo.
- **Quién hizo qué**: cada persona entra con nombre y PIN; todo queda firmado y la pestaña `Historial` guarda cada cambio.
- **Sin señal**: lo registrado se guarda en el teléfono y se envía solo cuando vuelve la conexión.

## Versión de prueba para mostrar la app

Agrega `?demo=1` al final de la dirección, por ejemplo `https://parque-acuatico-caja.github.io/?demo=1`.
- Trae los tres lugares con tres días inventados: anteayer y ayer cerrados (con cuadre), y hoy con ventas terminadas, grupos en el agua (uno sale a los pocos minutos, para ver la alerta) y uno por entrar.
- Usuario 1 es administrador (ve todo y los reportes), Usuario 2 trabaja en Licán Ray y Usuario 3 en Pucón.
- Los juegos tienen precios de ejemplo solo en la prueba.
- Todo queda solo en el teléfono de quien prueba, separado de los datos reales: no escribe en la planilla ni crea archivos en Drive.
- Al final de la pestaña Caja hay un botón para volver a los días de prueba originales.
- Quien pruebe no debería agregarla a la pantalla de inicio desde ese link: el ícono abre la versión real.

## Probarla ya (modo demo)

Con `config.js` vacío la app funciona en modo demo: los datos quedan solo en ese teléfono.

## Instalación

Dónde vive cada cosa:
- **Planilla y Apps Script**: en el correo del negocio, para que no dependan de una cuenta personal.
- **Código de la app**: en una organización de GitHub administrada desde tu cuenta personal. La dirección muestra el nombre de la organización, no tu usuario.

### Parte A: Google, con el correo del negocio

> Usa una ventana de incógnito, o un perfil de Chrome donde solo esté abierto el correo del negocio. Si hay varias cuentas de Google abiertas a la vez, Apps Script suele fallar o guardar el proyecto en la cuenta equivocada.

1. Entra a Google Drive con el correo del negocio y crea una planilla nueva llamada **Parque Acuático – Caja**.
2. En la planilla: **Extensiones → Apps Script**.
3. Borra el código que aparece y pega todo el contenido de `apps-script/Codigo.gs`. Guarda (ícono de disquete).
4. En **Configuración del proyecto** (engranaje, a la izquierda) revisa que la zona horaria sea `(GMT-03:00) Santiago`.
5. Vuelve al editor, elige la función **`setup`** en la lista de arriba y pulsa **Ejecutar**.
6. Google pedirá permisos: **Revisar permisos** → elige el correo del negocio → "Google no verificó esta app" → **Configuración avanzada** → **Ir a … (no seguro)** → **Permitir**. Es normal: la app la hiciste tú y Google no la ha revisado.
7. En la planilla aparecen las pestañas `Registros`, `Gastos`, `Inventario`, `Cierres`, `Historial`, `Productos`, `Usuarios` y `Config`, y junto a la planilla se crea la carpeta **Cajas diarias – Parque Acuático**.
8. En **Usuarios**, cambia los PIN de ejemplo (1111 y 2222) y agrega a quien vaya a usar la app.
9. En **Config**, revisa precios y nombres de socios. El nombre de cada socio tiene que coincidir con su nombre en `Usuarios`.

**Publicar la API**
1. En Apps Script: **Implementar → Nueva implementación** → engranaje → **Aplicación web**.
2. Ejecutar como: **Yo (correo del negocio)**. Quién tiene acceso: **Cualquier persona**.
3. **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
4. Prueba: pega esa URL en el navegador. Debe aparecer `{"ok":true,"msg":"API Parque Acuático funcionando"}`.

**Compartir**
- Comparte la planilla como **Editor** con tu correo personal y el de los socios.
- Guarda la contraseña del correo del negocio donde los socios también puedan encontrarla, y agrega un teléfono de recuperación de uno de ellos.

### Parte B: GitHub, organización desde tu cuenta

1. Con tu cuenta personal entra a GitHub → **+** (arriba a la derecha) → **New organization** → plan **Free**.
2. Nombre de la organización: es lo que aparecerá en la dirección. Por ejemplo `parque-acuatico-caja`. Como correo de contacto puedes usar el del negocio. Tú quedas como dueño.
3. Dentro de la organización: **New repository**.
   - Nombre: **`NOMBRE-ORG.github.io`** (por ejemplo `parque-acuatico-caja.github.io`). Con ese nombre la app queda en la dirección corta `https://parque-acuatico-caja.github.io/`.
   - Visibilidad: **Public** (GitHub Pages gratis lo exige).
4. En el repositorio: **Add file → Upload files**. Arrastra **el contenido** de la carpeta `parque-acuatico`, no la carpeta misma: `index.html` tiene que quedar en la raíz. La carpeta `apps-script` puede ir también. **Commit changes**.
5. Abre `config.js` en GitHub → lápiz (editar) → pega la URL `/exec` entre las comillas:
   ```js
   window.APP_CONFIG = { API_URL: 'https://script.google.com/macros/s/XXXX/exec' };
   ```
   **Commit changes**.
6. **Settings → Pages** → Source: *Deploy from a branch* → Branch: **main** / **(root)** → **Save**.
7. En uno o dos minutos la app queda en `https://NOMBRE-ORG.github.io/`.

### Parte C: en los teléfonos

1. Abre la dirección en el celular (Chrome en Android, Safari en iPhone).
2. Elige **Agregar a pantalla de inicio**.
3. Entra con tu nombre y PIN y registra un grupo de prueba. Debería aparecer en la pestaña `Registros` de la planilla y en `Historial`. Después anúlalo desde la app.

## Administración desde la planilla

| Pestaña | Para qué |
|---|---|
| `Usuarios` | Nombre, PIN, rol, activo (si/no) y **sede** (lugar). Los dueños llevan rol `admin` y la sede vacía: ven todos los lugares. Los trabajadores llevan rol `cajero` y su lugar escrito igual que en `Sedes` (las tildes no importan). **Cambia los PIN de ejemplo.** |
| `Sedes` | Los lugares: nombre, activo (si/no) y orden. Para abrir otro lugar, agrega una fila. |
| `Entradas` | Entradas y juegos: `id` (no cambiarlo después), nombre, precio, minutos (0 = sin tiempo), color de pulsera (`rotativo` = el color del turno de ½ hora), gratis (si/no), sedes (`todas` o los lugares separados por coma), activo y orden. **Los juegos vienen con precio 0 y no se pueden vender hasta ponerles precio.** |
| `Productos` | Lo que se vende aparte: `id`, nombre, precio, activo, `aviso_bajo` (avisa cuando quedan esa cantidad o menos), orden y sedes. |
| `Config` | `colores_media` (lista de colores que rotan), `medios_pago` (`Efectivo,Débito`) y `socios_cantidad` por lugar (columna `sede`) para la línea "neto ÷ socios". Las claves antiguas quedan marcadas "Ya no se usa". |
| `Registros` | Una venta por fila, con la columna `lineas` (qué entradas y juegos, a qué precio y color) y `productos`. Cada fila guarda el precio cobrado, así cambiar precios no altera días pasados. |
| `Inventario` | Movimientos de stock de productos y pulseras (`pulsera:Verde`, etc.) por lugar. |
| `Gastos` | Gastos del día por lugar y con qué se pagaron. |
| `Cierres` | Una fila por día y lugar: totales, cuadre (efectivo contado, débito de la máquina y diferencias), pulseras entregadas, stock final, quién cerró y el enlace al archivo del día. |
| `Historial` | Registro de cada acción, quién la hizo y qué cambió. |

### Dónde quedan guardadas las cajas

Todo vive en el Drive del correo del negocio.
- Cada grupo se guarda en `Registros` apenas se registra (o cuando vuelve la señal).
- Al tocar **Cerrar caja del día**, se escribe la fila del día en `Cierres` y se crea un archivo propio del día: `Cajas diarias – Parque Acuático / Pucón / 2026-10 Octubre / Caja Pucón 2026-10-28 (miércoles)`. Tiene el resumen, el cuadre, entradas y juegos, pulseras por color, productos, gastos y una pestaña con todas las ventas. El enlace queda en la columna `archivo` de `Cierres` y en la app (pestaña Caja).
- Para ver un día anterior: abre su archivo en esa carpeta, o en la app toca la fecha y elige ese día.
- Google guarda versiones de la planilla: **Archivo → Historial de versiones** permite ver o recuperar cómo estaba en cualquier momento.
- Para un respaldo aparte: **Archivo → Descargar → Excel**, o **Archivo → Hacer una copia**.

## Cómo se calcula la caja

1. **Total recaudado** = todo lo cobrado − devoluciones.
2. **Neto** = total − gastos.
3. **Efectivo que debe haber** = efectivo cobrado − devoluciones − gastos pagados con la caja. Se compara con el efectivo contado.
4. **Débito**: la suma de las ventas con débito se compara con el total de la máquina.
5. **Neto ÷ socios**: solo informativo, con la cantidad de socios de cada lugar (`socios_cantidad` en `Config`).

## Actualizar

**Orden importante:** primero el Apps Script (Codigo.gs) y después GitHub. Si la app nueva se conecta a un Apps Script antiguo, muestra "Falta actualizar la planilla" y no deja vender, para no perder datos.


- **Cambios en la app**: sube los archivos a GitHub y aumenta el número `VERSION` en `sw.js` para que los teléfonos tomen la versión nueva.
- **Cambios en `Codigo.gs`**: pega el código nuevo encima del anterior y guarda. Si la versión nueva necesita permisos nuevos (por ejemplo, Drive para los archivos diarios), ejecuta una vez la función `setup` desde el editor y acepta los permisos; no borra datos. Luego Implementar → Administrar implementaciones → editar (lápiz) → Versión: **Nueva versión** → Implementar. Así se mantiene la misma URL. Las pestañas y columnas nuevas se crean solas la primera vez que la app se conecta; los datos existentes no se tocan.
