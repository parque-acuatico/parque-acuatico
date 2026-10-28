# Parque Acuático · Caja

App para el celular que reemplaza la planilla de caja en papel. Registra cada grupo, calcula los totales y reparte la caja entre los socios. Funciona sin señal y sincroniza con una planilla de Google Sheets.

## Qué hace

- **Registrar**: personas, nombre, tiempo (½ h / 1 h), productos y medio de pago. Si es transferencia, a qué cuenta llegó. La hora de entrada se toma sola y la salida se calcula.
- **Pulseras**: el color depende del tiempo (uno para ½ hora y otro para 1 hora). Se configura en `Config` (`color_media`, `color_hora`) y la app lo asigna sola.
- **Productos**: en el mismo registro del grupo se suman las calcetas u otros productos al total. Con 0 personas queda como venta suelta (alguien que solo compra).
- **Inventario**: stock de cada producto en el día. Las ventas se descuentan solas; se registra el stock al abrir, la mercadería que llega y los conteos (si no cuadra, se corrige y queda anotada la diferencia). Lo que queda pasa al día siguiente.
- **Horario de 5 en 5**: la entrada se redondea a los 5 minutos siguientes (si son las 10:51, el turno parte a las 10:55).
- **Alerta de término**: cuando se acaba el tiempo de un grupo, suena, vibra y aparece una ventana con el color de pulsera. Se repite cada 9 s hasta tocar "Listo" (máximo 3 min). Mientras hay grupos en el agua, la pantalla se mantiene encendida para que la alerta suene a tiempo.
- **Grupos del día**: lista con la cuenta regresiva y barra de avance de cada grupo (se marca en naranjo cuando quedan 5 min), quién lo registró y quién lo editó. Tocando un grupo se puede corregir, registrar una devolución o anularlo.
- **Caja**: efectivo, transferencias por socio, débito, devoluciones, gastos, neto y cuánto efectivo se lleva cada socio. Resumen para WhatsApp.
- **Cerrar caja**: al cerrar, el día queda bloqueado (no se pueden agregar ni cambiar grupos, gastos ni inventario) y se guarda una planilla con todo el día en la carpeta **Cajas diarias – Parque Acuático** del Drive, ordenada por mes. Un usuario con rol `admin` puede reabrirla; al volver a cerrar, el archivo se actualiza.
- **Quién hizo qué**: cada persona entra con su nombre y PIN. Todo queda firmado, y la pestaña `Historial` de la planilla guarda cada creación, edición y anulación con el detalle de lo que cambió.
- **Sin señal**: los registros se guardan en el teléfono y se envían solos cuando vuelve la conexión.

## Versión de prueba para mostrar la app

Agrega `?demo=1` al final de la dirección, por ejemplo `https://parque-acuatico-caja.github.io/?demo=1`.
- Trae tres días inventados: anteayer y ayer cerrados, y hoy con grupos terminados, dos en el agua (uno sale a los pocos minutos, para ver la alerta) y uno por entrar.
- Todo queda solo en el teléfono de quien prueba, separado de los datos reales: no escribe en la planilla ni crea archivos en Drive.
- Al final de la pestaña Caja hay un botón para volver a los días de prueba originales.
- Quien pruebe no debería agregarla a la pantalla de inicio desde ese link: el ícono abre la versión real.

## Probarla ya (modo demo)

Con `config.js` vacío la app funciona en modo demo: los datos quedan solo en ese teléfono. En "Grupos del día" hay un botón para cargar la planilla del 9 de marzo y comprobar que los números coinciden.

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
| `Usuarios` | Nombre, PIN, rol y activo (si/no). **Cambia los PIN de ejemplo (1111 y 2222).** Para sacar a alguien, pon `no` en activo. Solo quienes tienen rol `admin` pueden reabrir una caja cerrada; para el resto escribe `cajero`. |
| `Config` | Precios de entrada (`precio_media`, `precio_hora`), colores de pulsera (`color_media`, `color_hora`), socios y cuenta del débito. Los cambios llegan a los teléfonos en la siguiente sincronización. (Si quedó una fila `precio_calceta` o `colores` de la versión anterior, ya no se usa.) |
| `Productos` | Lo que se vende: `id` (una palabra, sin espacios, no cambiarlo después), `nombre`, `precio`, `activo` (si/no), `aviso_bajo` (avisa cuando quedan esa cantidad o menos) y `orden`. Para vender algo nuevo, agrega una fila. |
| `Registros` | Un grupo o venta por fila. Cada fila guarda el precio que se cobró, así cambiar precios no altera días pasados. La columna `productos` dice qué compró. |
| `Inventario` | Movimientos de stock: stock al abrir, llegadas de mercadería y correcciones por conteo, con quién los hizo. |
| `Gastos` | Gastos del día y con qué se pagaron. |
| `Cierres` | **La caja de cada día**: una fila por día cerrado con total, gastos, neto, efectivo, transferencias por socio, lo vendido, el reparto, el stock final y quién cerró. |
| `Historial` | Registro de cada acción, quién la hizo y qué cambió. |

### Dónde quedan guardadas las cajas

Todo vive en el Drive del correo del negocio.
- Cada grupo se guarda en `Registros` apenas se registra (o cuando vuelve la señal).
- Al tocar **Cerrar caja del día**, se escribe la fila del día en `Cierres` y se crea un archivo propio del día: `Cajas diarias – Parque Acuático / 2026-10 Octubre / Caja 2026-10-28 (miércoles)`. Tiene el resumen, el reparto, todos los grupos, los gastos y el inventario. El enlace queda en la columna `archivo` de `Cierres` y en la app (pestaña Caja).
- Para ver un día anterior: abre su archivo en esa carpeta, o en la app toca la fecha y elige ese día.
- Google guarda versiones de la planilla: **Archivo → Historial de versiones** permite ver o recuperar cómo estaba en cualquier momento.
- Para un respaldo aparte: **Archivo → Descargar → Excel**, o **Archivo → Hacer una copia**.

Para definir la cuenta del débito, escribe el nombre del socio en `cuenta_debito`. Mientras esté vacía, el débito se suma al total pero no se reparte.

## Cómo se reparte la caja

1. **Total recaudado** = todo lo cobrado − devoluciones.
2. **Neto** = total − gastos.
3. **Parte de cada socio** = neto ÷ número de socios.
4. A cada socio se le descuenta lo que ya le llegó a su cuenta por transferencia. Lo que falta se lo lleva en efectivo.
5. Si un socio recibió más que su parte por transferencia, la app indica cuánto debe pasarle al otro.

Gastos y devoluciones pueden salir de la caja o del dinero de un socio. Si los pagó un socio, se le compensa en el reparto.

## Actualizar

- **Cambios en la app**: sube los archivos a GitHub y aumenta el número `VERSION` en `sw.js` para que los teléfonos tomen la versión nueva.
- **Cambios en `Codigo.gs`**: pega el código nuevo encima del anterior y guarda. Si la versión nueva necesita permisos nuevos (por ejemplo, Drive para los archivos diarios), ejecuta una vez la función `setup` desde el editor y acepta los permisos; no borra datos. Luego Implementar → Administrar implementaciones → editar (lápiz) → Versión: **Nueva versión** → Implementar. Así se mantiene la misma URL. Las pestañas y columnas nuevas se crean solas la primera vez que la app se conecta; los datos existentes no se tocan.
