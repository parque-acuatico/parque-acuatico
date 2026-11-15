/**
 * Parque Acuático · Caja — backend en Google Apps Script
 * La planilla de Google Sheets es la base de datos. Un solo archivo para los tres lugares.
 *
 * Instalación nueva (ver README):
 *  1. Planilla nueva → Extensiones → Apps Script → pegar este código.
 *  2. Ejecutar la función `setup` una vez (crea las pestañas y pide permisos de Drive).
 *  3. Implementar → Nueva implementación → Aplicación web
 *     (Ejecutar como: Yo · Quién tiene acceso: Cualquier persona).
 *
 * Actualización: pegar este código encima del anterior → ejecutar `setup` (no borra datos)
 *  → Implementar → Administrar implementaciones → lápiz → Versión: Nueva versión → Implementar.
 */

const ESQUEMA_VERSION = '7';

// IMPORTANTE: las columnas nuevas siempre se agregan AL FINAL para no desordenar los datos existentes.
const HOJAS = {
  Registros: ['id', 'fecha', 'entrada', 'salida', 'personas', 'nombre', 'pulsera', 'minutos', 'calcetas',
    'medio', 'cuenta', 'precioPersona', 'precioCalceta', 'total', 'devolucion', 'devolucionDesde', 'obs',
    'estado', 'creadoPor', 'creadoEn', 'editadoPor', 'editadoEn', 'productos', 'sede', 'lineas'],
  Gastos: ['id', 'fecha', 'concepto', 'monto', 'pagadoDesde', 'estado', 'creadoPor', 'creadoEn', 'editadoPor', 'editadoEn', 'sede'],
  Inventario: ['id', 'fecha', 'producto', 'tipo', 'cantidad', 'nota', 'estado', 'creadoPor', 'creadoEn', 'editadoPor', 'editadoEn', 'sede'],
  Cierres: ['fecha', 'cerradoPor', 'cerradoEn', 'totalBruto', 'devoluciones', 'gastos', 'neto', 'efectivoCaja',
    'debitoPendiente', 'reparto', 'detalle', 'efectivo', 'transferencias', 'debito', 'ventaEntradas',
    'ventaProductos', 'personas', 'productosVendidos', 'stockFinal', 'estado', 'reabiertoPor', 'reabiertoEn',
    'archivo', 'archivoId', 'sede', 'id', 'efectivoContado', 'debitoMaquina', 'difEfectivo', 'difDebito', 'pulserasEntregadas'],
  Historial: ['fechaHora', 'usuario', 'accion', 'id', 'detalle'],
  Sedes: ['nombre', 'activo', 'orden'],
  Entradas: ['id', 'nombre', 'precio', 'minutos', 'color', 'gratis', 'sedes', 'activo', 'orden', 'nota'],
  Productos: ['id', 'nombre', 'precio', 'activo', 'aviso_bajo', 'orden', 'sedes'],
  Usuarios: ['nombre', 'pin', 'rol', 'activo', 'sede'],
  Config: ['clave', 'valor', 'descripcion', 'sede']
};

const COLUMNAS_NUMERO = ['personas', 'minutos', 'calcetas', 'precioPersona', 'precioCalceta', 'total', 'devolucion',
  'monto', 'totalBruto', 'devoluciones', 'gastos', 'neto', 'efectivoCaja', 'debitoPendiente',
  'cantidad', 'precio', 'aviso_bajo', 'orden', 'efectivo', 'debito', 'ventaEntradas', 'ventaProductos'];

const SEDES_INICIALES = ['Licán Ray', 'Pucón', 'Villarrica'];
const COLORES_MEDIA = 'Verde,Azul,Roja,Amarilla,Naranja,Morada,Rosada,Blanca';

// [clave, valor, descripción, sede (vacío = todos los lugares)]
const CONFIG_INICIAL = [
  ['colores_media', COLORES_MEDIA, 'Colores de pulsera para ½ hora, Free pass y Cortesía, separados por coma. La app los rota por turno', ''],
  ['medios_pago', 'Efectivo,Débito', 'Medios de pago que se aceptan, separados por coma', '']
];
const CONFIG_OBSOLETA = ['precio_media', 'precio_hora', 'color_hora', 'color_media', 'socios', 'cuenta_debito', 'precio_calceta', 'socios_cantidad'];

// Entradas y juegos. color: un color fijo, o "rotativo" (cambia por turno). minutos 0 = sin tiempo ni alerta.
const ENTRADAS_INICIALES = [
  { id: 'media', nombre: '½ hora', precio: 7000, minutos: 30, color: 'rotativo', gratis: 'no', orden: 1, nota: '' },
  { id: 'hora', nombre: '1 hora', precio: 12000, minutos: 60, color: 'Dorada', gratis: 'no', orden: 2, nota: '' },
  { id: 'full', nombre: 'Full day', precio: 30000, minutos: 0, color: 'Plateada', gratis: 'no', orden: 3, nota: 'Color de pulsera por confirmar' },
  { id: 'freepass', nombre: 'Free pass', precio: 0, minutos: 30, color: 'rotativo', gratis: 'si', orden: 4, nota: 'Entra con la pulsera del turno, no suma dinero' },
  { id: 'cortesia', nombre: 'Cortesía', precio: 0, minutos: 30, color: 'rotativo', gratis: 'si', orden: 5, nota: 'Entra con la pulsera del turno, no suma dinero' },
  { id: 'arrastre', nombre: 'Arrastre', precio: 0, minutos: 0, color: 'Verde flúor', gratis: 'no', sedes: 'Licán Ray', orden: 6, nota: 'Precio por confirmar' },
  { id: 'banano', nombre: 'Banano', precio: 0, minutos: 0, color: 'Amarilla flúor', gratis: 'no', sedes: 'Licán Ray', orden: 7, nota: 'Precio por confirmar' },
  { id: 'sacachucha', nombre: 'Sacachucha', precio: 0, minutos: 0, color: 'Rosada flúor', gratis: 'no', sedes: 'Licán Ray', orden: 8, nota: 'Precio por confirmar' },
  { id: 'extreme', nombre: 'Extreme', precio: 0, minutos: 0, color: 'Naranja flúor', gratis: 'no', sedes: 'Licán Ray', orden: 9, nota: 'Precio por confirmar' }
];

/* ---------------- instalación y migración ---------------- */
function setup() {
  asegurarEsquema(true);
  ['Hoja 1', 'Hoja1', 'Sheet1'].forEach(n => {
    const ss = SpreadsheetApp.getActive();
    const s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  carpetaCajas();
  protegerPlanilla();
  SpreadsheetApp.getActive().toast('Listo. Ahora todo se administra desde la app (Ajustes).');
}

/** Bloquea las pestañas para que solo la cuenta dueña pueda editarlas a mano. La app escribe igual, porque el script corre como la dueña. */
function protegerPlanilla() {
  let yo;
  try { yo = Session.getEffectiveUser(); } catch (e) { return; }
  SpreadsheetApp.getActive().getSheets().forEach(sh => {
    try {
      const ya = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET)[0];
      const p = ya || sh.protect();
      p.setDescription('Se administra desde la app Parque Acuático (Ajustes)');
      p.addEditor(yo);
      p.removeEditors(p.getEditors().filter(u => u.getEmail() !== yo.getEmail()));
      if (p.canDomainEdit()) p.setDomainEdit(false);
    } catch (e) { /* sin permiso para proteger: se sigue igual */ }
  });
}

/** Crea pestañas y columnas que falten y migra datos antiguos, sin borrar nada. */
function asegurarEsquema(forzar) {
  const cache = CacheService.getScriptCache();
  if (!forzar && cache.get('esquema') === ESQUEMA_VERSION) return;
  const ss = SpreadsheetApp.getActive();
  Object.keys(HOJAS).forEach(nombre => {
    const h = HOJAS[nombre];
    let sh = ss.getSheetByName(nombre);
    const nueva = !sh;
    if (!sh) sh = ss.insertSheet(nombre);
    const actuales = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
    if (actuales.length < h.length || h.some((c, i) => actuales[i] !== c)) {
      if (sh.getMaxColumns() < h.length) sh.insertColumnsAfter(sh.getMaxColumns(), h.length - sh.getMaxColumns());
      sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#dff1f8');
      sh.setFrozenRows(1);
      h.forEach((col, i) => {
        if (nueva || i >= actuales.length) {
          sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat(COLUMNAS_NUMERO.indexOf(col) >= 0 ? '#,##0' : '@');
        }
      });
    }
  });

  // Lugares
  const shS = ss.getSheetByName('Sedes');
  if (shS.getLastRow() < 2) SEDES_INICIALES.forEach((s, i) => escribirFila(shS, HOJAS.Sedes, i + 2, { nombre: s, activo: 'si', orden: i + 1 }));
  const base = leerSedes()[0] || SEDES_INICIALES[0];

  // Lo registrado antes de tener varios lugares queda en el primer lugar (Licán Ray)
  ['Registros', 'Gastos', 'Inventario', 'Cierres'].forEach(n => rellenarSede(n, base));

  // Config: agregar claves que falten (por lugar) y marcar las que ya no se usan
  const cfg = ss.getSheetByName('Config');
  const actuales = leer('Config').map(r => String(r.clave).trim() + '|' + String(r.sede || '').trim());
  const faltan = CONFIG_INICIAL.filter(c => actuales.indexOf(c[0] + '|' + c[3]) < 0 &&
    !(c[3] && leer('Config').some(r => String(r.clave).trim() === c[0] && mismaSede(r.sede, c[3]))));
  if (faltan.length) cfg.getRange(cfg.getLastRow() + 1, 1, faltan.length, 4).setValues(faltan);
  const filasCfg = cfg.getRange(1, 1, cfg.getLastRow(), 3).getValues();
  filasCfg.forEach((f, i) => {
    if (i > 0 && CONFIG_OBSOLETA.indexOf(String(f[0]).trim()) >= 0 && !/^Ya no se usa/.test(String(f[2])))
      cfg.getRange(i + 1, 3).setValue('Ya no se usa (precios y colores ahora están en la pestaña Entradas)');
  });

  // Entradas y juegos
  const shE = ss.getSheetByName('Entradas');
  if (shE.getLastRow() < 2) ENTRADAS_INICIALES.forEach((e, i) => escribirFila(shE, HOJAS.Entradas, i + 2, Object.assign({ sedes: 'todas', activo: 'si' }, e)));  // los juegos traen sedes: 'Licán Ray'

  // Productos: calcetas y bolsa de teléfono (la bolsa se agrega una sola vez)
  const prod = ss.getSheetByName('Productos');
  if (prod.getLastRow() < 2) escribirFila(prod, HOJAS.Productos, 2, { id: 'calcetas', nombre: 'Calcetas', precio: 2000, activo: 'si', aviso_bajo: 5, orden: 1, sedes: 'todas' });
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('bolsaTelefono')) {
    if (!leer('Productos').some(p => String(p.id).trim() === 'bolsa_telefono'))
      escribirFila(prod, HOJAS.Productos, Math.max(prod.getLastRow(), 1) + 1, { id: 'bolsa_telefono', nombre: 'Bolsa de teléfono', precio: 2000, activo: 'si', aviso_bajo: 5, orden: 2, sedes: 'todas' });
    props.setProperty('bolsaTelefono', '1');
  }

  // Usuarios de ejemplo solo en instalación nueva
  const us = ss.getSheetByName('Usuarios');
  if (us.getLastRow() < 2) us.getRange(2, 1, 2, 5).setValues([['Usuario 1', '1111', 'admin', 'si', ''], ['Usuario 2', '2222', 'cajero', 'si', base]]);
  cache.put('esquema', ESQUEMA_VERSION, 21600);
}

/** Completa la columna "sede" vacía (datos de antes de tener varios lugares). En Cierres arma también el id. */
function rellenarSede(nombre, sede) {
  const sh = SpreadsheetApp.getActive().getSheetByName(nombre);
  const h = HOJAS[nombre];
  const last = sh.getLastRow();
  if (last < 2) return;
  const cs = h.indexOf('sede') + 1;
  const vals = sh.getRange(2, cs, last - 1, 1).getValues();
  let cambio = false;
  vals.forEach(v => { if (!String(v[0]).trim()) { v[0] = sede; cambio = true; } });
  if (cambio) sh.getRange(2, cs, last - 1, 1).setValues(vals);
  if (nombre === 'Cierres') {
    const ci = h.indexOf('id') + 1;
    const fechas = sh.getRange(2, 1, last - 1, 1).getValues();
    const ids = sh.getRange(2, ci, last - 1, 1).getValues();
    let c2 = false;
    ids.forEach((v, i) => { if (!String(v[0]).trim()) { v[0] = normalizar('fecha', fechas[i][0]) + '|' + vals[i][0]; c2 = true; } });
    if (c2) sh.getRange(2, ci, last - 1, 1).setNumberFormat('@').setValues(ids);
  }
}

/* ---------------- entrada web ---------------- */
function doGet() {
  return salida({ ok: true, msg: 'API Parque Acuático funcionando' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    return salida(manejar(req));
  } catch (err) {
    return salida({ ok: false, error: String(err && err.message || err) });
  }
}

function salida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function manejar(req) {
  asegurarEsquema(false);
  const a = req.action;
  if (a === 'usuarios') {
    return { ok: true, usuarios: leer('Usuarios').filter(esActivo).map(u => String(u.nombre).trim()).filter(String) };
  }
  const user = autenticar(req.usuario, req.pin);
  const sedes = leerSedes();
  if (a === 'login') {
    const s = resolverSede(user, req.sede, sedes);
    return { ok: true, apiVersion: 7, usuario: { nombre: user.nombre, rol: user.rol || 'cajero', sede: user.admin ? '' : sedeUsuario(user, sedes) }, sedes, config: leerConfig(s, sedes) };
  }
  if (a === 'getDay') {
    const s = resolverSede(user, req.sede, sedes);
    const f = String(req.fecha);
    const config = leerConfig(s, sedes);
    const regs = leer('Registros').filter(r => mismaSede(r.sede, s));
    const movs = leer('Inventario').filter(m => mismaSede(m.sede, s));
    const cierre = cierreDe(f, s);
    return {
      ok: true, apiVersion: 7, sede: s,
      registros: regs.filter(r => r.fecha === f).map(limpiar),
      gastos: leer('Gastos').filter(g => g.fecha === f && mismaSede(g.sede, s)).map(limpiar),
      inventario: movs.filter(m => m.fecha === f).map(limpiar),
      stockPrevio: Calc.stockAntes(f, idsInventario(config), movs, regs),
      cierre: cierre ? limpiar(cierre) : null,
      config
    };
  }
  if (a === 'sync') {
    const r = aplicarOps(req.ops || [], user, sedes);
    return { ok: true, applied: r.hechos, rechazados: r.rechazados };
  }
  if (a === 'cambiarPin') {
    cambiarPin(user, req.pinNuevo);
    return { ok: true };
  }
  if (a === 'admin' || a === 'guardarAdmin') {
    if (!user.admin) throw new Error('Solo los administradores pueden cambiar la configuración');
    if (a === 'guardarAdmin') guardarAdmin(user, req.tipo, req.item || {}, req.original);
    return Object.assign({ ok: true }, datosAdmin());
  }
  if (a === 'reporte') {
    if (!user.admin) throw new Error('Solo los administradores pueden ver los reportes');
    return Object.assign({ ok: true }, reporte(String(req.desde), String(req.hasta), req.sede || '*', sedes));
  }
  throw new Error('Acción desconocida: ' + a);
}

/* ---------------- lugares y usuarios ---------------- */
function sinTildes(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
function mismaSede(a, b) { return sinTildes(a) === sinTildes(b); }
function enSedes(lista, sede) {
  const l = sinTildes(lista);
  if (!l || l === 'todas' || l === 'todos') return true;
  return String(lista).split(',').some(x => mismaSede(x, sede));
}
function leerSedes() {
  const l = leer('Sedes').filter(s => String(s.nombre).trim() && String(s.activo || 'si').trim().toLowerCase() !== 'no')
    .sort((a, b) => (Number(a.orden) || 99) - (Number(b.orden) || 99)).map(s => String(s.nombre).trim());
  return l.length ? l : SEDES_INICIALES.slice();
}
function esActivo(u) { return String(u.activo || 'si').trim().toLowerCase() !== 'no' && String(u.nombre).trim() !== ''; }

function autenticar(nombre, pin) {
  const u = leer('Usuarios').filter(x => esActivo(x) &&
    String(x.nombre).trim() === String(nombre || '').trim() &&
    String(x.pin).trim() === String(pin || '').trim())[0];
  if (!u) throw new Error('Usuario o PIN incorrecto');
  const rol = String(u.rol || '').trim().toLowerCase();
  return { nombre: String(u.nombre).trim(), rol, admin: rol === 'admin', sede: String(u.sede || '').trim() };
}
/** Lugar de un trabajador (sin lugar asignado: el primero). */
function sedeUsuario(user, sedes) {
  const m = sedes.filter(s => mismaSede(s, user.sede))[0];
  return m || sedes[0];
}
/** El lugar que se va a mostrar: un administrador elige; un trabajador siempre ve el suyo. */
function resolverSede(user, pedida, sedes) {
  if (user.admin) return sedes.filter(s => mismaSede(s, pedida))[0] || sedes[0];
  return sedeUsuario(user, sedes);
}
function puedeSede(user, sede, sedes) { return user.admin || mismaSede(sedeUsuario(user, sedes), sede); }

/* ---------------- configuración ---------------- */
function leerEntradas(sede, todos) {
  return leer('Entradas')
    .filter(e => String(e.id).trim() && (todos || (String(e.activo || 'si').trim().toLowerCase() !== 'no' && enSedes(e.sedes, sede))))
    .sort((a, b) => (Number(a.orden) || 99) - (Number(b.orden) || 99))
    .map(e => {
      const color = String(e.color || '').trim();
      const rot = !color || sinTildes(color) === 'rotativo';
      return {
        id: String(e.id).trim(), nombre: String(e.nombre || e.id).trim(), precio: Number(e.precio) || 0,
        minutos: Number(e.minutos) || 0, color: rot ? '' : color, rot,
        gratis: sinTildes(e.gratis) === 'si', nota: String(e.nota || '').trim()
      };
    });
}
function leerProductos(sede, todos) {
  return leer('Productos')
    .filter(p => String(p.id).trim() !== '' && (todos || (String(p.activo || 'si').trim().toLowerCase() !== 'no' && enSedes(p.sedes, sede))))
    .sort((a, b) => (Number(a.orden) || 99) - (Number(b.orden) || 99))
    .map(p => ({ id: String(p.id).trim(), nombre: String(p.nombre || p.id).trim(), precio: Number(p.precio) || 0, aviso_bajo: Number(p.aviso_bajo) || 0 }));
}
/** Config de un lugar: las filas sin lugar valen para todos; las filas con lugar las reemplazan. */
function leerConfig(sede, sedes) {
  const base = {}, propio = {};
  leer('Config').forEach(r => {
    const k = String(r.clave).trim(); if (!k) return;
    if (!String(r.sede || '').trim()) base[k] = r.valor;
    else if (mismaSede(r.sede, sede)) propio[k] = r.valor;
  });
  const c = Object.assign(base, propio);
  const lista = k => String(c[k] || '').split(',').map(s => s.trim()).filter(String);
  const entradas = leerEntradas(sede, false);
  const colores = lista('colores_media').length ? lista('colores_media') : COLORES_MEDIA.split(',');
  const pulseras = colores.slice();
  entradas.forEach(e => { if (e.color && pulseras.indexOf(e.color) < 0) pulseras.push(e.color); });
  return {
    sede, sedes: sedes || leerSedes(),
    colores_media: colores,
    medios_pago: lista('medios_pago').length ? lista('medios_pago') : ['Efectivo', 'Débito'],
    socios_cantidad: 0,
    entradas, productos: leerProductos(sede, false), pulseras
  };
}
function idsInventario(cfg) {
  return leerProductos(cfg.sede, true).map(p => p.id).concat(cfg.pulseras.map(c => 'pulsera:' + c));
}

/* ---------------- escritura ---------------- */
function cierreDe(fecha, sede) {
  return leer('Cierres').filter(c => c.fecha === String(fecha) && mismaSede(c.sede, sede))[0] || null;
}
function estaCerrada(c) { return !!c && c.estado !== 'reabierta' && !!c.cerradoEn; }

function aplicarOps(ops, user, sedes) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  const cache = CacheService.getScriptCache();
  const hechos = [], rechazados = [];
  const rechazar = (op, motivo) => {
    rechazados.push({ opId: op.opId, kind: op.kind, fecha: op.fecha, motivo });
    hechos.push(op.opId);
    registrarHistorial(user.nombre, 'rechazado: ' + motivo, op.data.id || '', JSON.stringify(op.data).slice(0, 400));
  };
  try {
    ops.forEach(op => {
      if (!op || !op.opId || !op.data) return;
      if (cache.get('op_' + op.opId)) { hechos.push(op.opId); return; } // ya aplicada (reintento)
      const d = op.data;
      const s = d.sede ? (sedes.filter(x => mismaSede(x, d.sede))[0] || '') : resolverSede(user, null, sedes);
      if (!s) return rechazar(op, 'Lugar desconocido');
      if (!puedeSede(user, s, sedes)) return rechazar(op, 'Sin permiso para ese lugar');
      d.sede = s;
      const fecha = String(op.fecha || d.fecha);
      if (op.kind === 'cierre') {
        d.id = fecha + '|' + s;
        if (d.estado === 'reabierta' && !user.admin) return rechazar(op, 'Solo un administrador puede reabrir la caja');
      } else {
        // Día cerrado: no se aceptan cambios hechos después del cierre
        const c = cierreDe(fecha, s);
        if (estaCerrada(c) && String(op.ts || '') > String(c.cerradoEn)) return rechazar(op, 'La caja de ese día ya estaba cerrada');
      }
      if (op.kind === 'registro') guardar('Registros', 'id', d, user, op, 'venta');
      else if (op.kind === 'gasto') guardar('Gastos', 'id', d, user, op, 'gasto');
      else if (op.kind === 'inventario') guardar('Inventario', 'id', d, user, op, 'inventario');
      else if (op.kind === 'cierre') guardar('Cierres', 'id', d, user, op, 'cierre');
      cache.put('op_' + op.opId, '1', 21600);
      hechos.push(op.opId);
    });
  } finally {
    lock.releaseLock();
  }
  return { hechos, rechazados };
}

function guardar(hoja, clave, data, user, op, tipo) {
  const sh = SpreadsheetApp.getActive().getSheetByName(hoja);
  const h = HOJAS[hoja];
  const ki = h.indexOf(clave);
  const vals = sh.getDataRange().getValues();
  let fila = -1, prev = null;
  for (let i = 1; i < vals.length; i++) {
    if (normalizar(clave, vals[i][ki]) === String(data[clave])) { fila = i + 1; prev = aObjeto(h, vals[i]); break; }
  }
  const obj = tipo === 'cierre' ? Object.assign({}, prev || {}, data) : Object.assign({}, data);
  const cuando = op.ts || ahora();
  let accion;
  if (tipo === 'cierre' && obj.estado === 'reabierta') {
    obj.reabiertoPor = user.nombre; obj.reabiertoEn = cuando;
    if (prev) { obj.cerradoPor = prev.cerradoPor; obj.cerradoEn = prev.cerradoEn; }
    accion = 'reabrir caja';
  } else if (tipo === 'cierre') {
    obj.estado = 'cerrada'; obj.cerradoPor = user.nombre; obj.cerradoEn = cuando;
    accion = prev ? 'volver a cerrar caja' : 'cerrar caja';
  } else if (prev) {
    obj.creadoPor = prev.creadoPor; obj.creadoEn = prev.creadoEn;
    obj.editadoPor = user.nombre; obj.editadoEn = cuando;
    if (obj.estado === 'anulado' && prev.estado !== 'anulado') accion = 'anular ' + tipo;
    else if (prev.estado === 'anulado' && obj.estado !== 'anulado') accion = 'restaurar ' + tipo;
    else accion = 'editar ' + tipo;
  } else {
    obj.creadoPor = user.nombre; obj.creadoEn = cuando; obj.editadoPor = ''; obj.editadoEn = '';
    accion = 'crear ' + tipo;
  }
  if (fila < 0) fila = Math.max(sh.getLastRow(), 1) + 1;
  escribirFila(sh, h, fila, obj);
  registrarHistorial(user.nombre, accion, obj[clave], '[' + obj.sede + '] ' + describir(tipo, obj, prev));
  if (tipo === 'cierre' && obj.estado === 'cerrada') {
    try {
      const arch = archivoDelDia(obj);
      obj.archivo = arch.url; obj.archivoId = arch.id;
    } catch (e) {
      obj.archivo = 'No se pudo crear el archivo: ' + (e && e.message || e);
    }
    escribirFila(sh, h, fila, obj);
  }
}

function escribirFila(sh, h, fila, obj) {
  if (fila > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 200);
  const rango = sh.getRange(fila, 1, 1, h.length);
  rango.setNumberFormats([h.map(k => COLUMNAS_NUMERO.indexOf(k) >= 0 ? '#,##0' : '@')]);
  rango.setValues([h.map(k => {
    const v = obj[k];
    if (v == null) return '';
    if (COLUMNAS_NUMERO.indexOf(k) >= 0) return Number(v) || 0;
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  })]);
}

function textoLineas(r) {
  return Calc.lineasDe(r).map(l => l.cant + ' ' + l.nombre + (l.color ? ' (' + l.color + ')' : '')).join(', ');
}
function describir(tipo, obj, prev) {
  let base;
  if (tipo === 'venta') {
    const prods = Calc.productosDe(obj).map(p => p.nombre + ' ×' + p.cant).join(', ');
    base = obj.nombre + ' · ' + [textoLineas(obj), prods].filter(String).join(' · ') + ' · ' + obj.medio + ' · $' + obj.total;
  } else if (tipo === 'gasto') {
    base = obj.concepto + ' · $' + obj.monto + ' · ' + obj.pagadoDesde;
  } else if (tipo === 'inventario') {
    base = obj.tipo + ' · ' + obj.producto + ' · ' + obj.cantidad + (obj.nota ? ' · ' + obj.nota : '');
  } else {
    base = 'neto $' + obj.neto + (obj.efectivoContado !== '' && obj.efectivoContado != null ? ' · contado $' + obj.efectivoContado + ' (dif ' + obj.difEfectivo + ')' : '');
  }
  if (!prev || tipo === 'cierre') return base;
  const ignorar = ['creadoPor', 'creadoEn', 'editadoPor', 'editadoEn', 'salida'];
  const cambios = Object.keys(obj).filter(k => ignorar.indexOf(k) < 0 && prev[k] !== undefined).map(k => {
    const nv = obj[k] == null ? '' : (typeof obj[k] === 'object' ? JSON.stringify(obj[k]) : String(obj[k]));
    return String(prev[k]) !== nv ? k + ': ' + prev[k] + ' → ' + nv : '';
  }).filter(String);
  return base + (cambios.length ? ' | ' + cambios.join('; ') : '');
}

function registrarHistorial(usuario, accion, id, detalle) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Historial');
  const fila = Math.max(sh.getLastRow(), 1) + 1;
  escribirFila(sh, HOJAS.Historial, fila, { fechaHora: ahora(), usuario, accion, id, detalle });
}

/* ---------------- administración desde la app ---------------- */
const MEDIOS_POSIBLES = ['Efectivo', 'Débito', 'Transferencia'];
const siNo = v => (v === true || sinTildes(v) === 'si') ? 'si' : 'no';
const activoDe = v => String(v == null || v === '' ? 'si' : v).trim().toLowerCase() !== 'no';
function idDesde(nombre, existentes) {
  let base = sinTildes(nombre).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
  let id = base, n = 2;
  while (existentes.indexOf(id) >= 0) id = base + '_' + (n++);
  return id;
}
/** Busca la fila cuyo campo "clave" coincide (sin importar tildes ni mayúsculas) y la reemplaza; si no está, la agrega. */
function upsertFila(hoja, coincide, obj) {
  const sh = SpreadsheetApp.getActive().getSheetByName(hoja);
  const h = HOJAS[hoja];
  const filas = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues() : [];
  let fila = -1, prev = null;
  for (let i = 0; i < filas.length; i++) {
    const o = aObjeto(h, filas[i]);
    if (coincide(o)) { fila = i + 2; prev = o; break; }
  }
  const nuevo = Object.assign({}, prev || {}, obj);
  escribirFila(sh, h, fila > 0 ? fila : Math.max(sh.getLastRow(), 1) + 1, nuevo);
  return prev;
}
function datosAdmin() {
  const cfgFilas = leer('Config');
  const valor = (k, sede) => {
    const r = cfgFilas.filter(x => String(x.clave).trim() === k && (sede ? mismaSede(x.sede, sede) : !String(x.sede || '').trim()))[0];
    return r ? String(r.valor) : '';
  };
  const lista = v => String(v || '').split(',').map(x => x.trim()).filter(String);
  const sedes = leer('Sedes').filter(x => String(x.nombre).trim())
    .sort((a, b) => (Number(a.orden) || 99) - (Number(b.orden) || 99))
    .map(x => ({ nombre: String(x.nombre).trim(), activo: activoDe(x.activo), orden: Number(x.orden) || 0 }));
  return {
    admin: {
      usuarios: leer('Usuarios').filter(u => String(u.nombre).trim()).map(u => ({
        nombre: String(u.nombre).trim(), rol: String(u.rol || 'cajero').trim().toLowerCase() === 'admin' ? 'admin' : 'cajero',
        sede: String(u.sede || '').trim(), activo: activoDe(u.activo), tienePin: String(u.pin || '').trim() !== ''
      })),
      sedes,
      entradas: leer('Entradas').filter(e => String(e.id).trim())
        .sort((a, b) => (Number(a.orden) || 99) - (Number(b.orden) || 99))
        .map(e => {
          const color = String(e.color || '').trim();
          return {
            id: String(e.id).trim(), nombre: String(e.nombre || e.id).trim(), precio: Number(e.precio) || 0, minutos: Number(e.minutos) || 0,
            color: !color || sinTildes(color) === 'rotativo' ? '' : color, gratis: sinTildes(e.gratis) === 'si',
            sedes: String(e.sedes || 'todas').trim() || 'todas', activo: activoDe(e.activo), orden: Number(e.orden) || 0, nota: String(e.nota || '')
          };
        }),
      productos: leer('Productos').filter(x => String(x.id).trim())
        .sort((a, b) => (Number(a.orden) || 99) - (Number(b.orden) || 99))
        .map(x => ({
          id: String(x.id).trim(), nombre: String(x.nombre || x.id).trim(), precio: Number(x.precio) || 0, aviso_bajo: Number(x.aviso_bajo) || 0,
          sedes: String(x.sedes || 'todas').trim() || 'todas', activo: activoDe(x.activo), orden: Number(x.orden) || 0
        })),
      colores_media: lista(valor('colores_media')).length ? lista(valor('colores_media')) : COLORES_MEDIA.split(','),
      medios_pago: lista(valor('medios_pago')).length ? lista(valor('medios_pago')) : ['Efectivo', 'Débito']
    }
  };
}
function validarPin(pin) {
  const p = String(pin == null ? '' : pin).trim();
  if (!/^\d{4,8}$/.test(p)) throw new Error('El PIN debe tener entre 4 y 8 números');
  return p;
}
function cambiarPin(user, pinNuevo) {
  const p = validarPin(pinNuevo);
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    upsertFila('Usuarios', o => String(o.nombre).trim() === user.nombre, { pin: p });
    registrarHistorial(user.nombre, 'cambiar su PIN', user.nombre, '');
  } finally { lock.releaseLock(); }
}
function textoSedes(v, sedesValidas) {
  if (Array.isArray(v)) v = v.join(', ');
  const t = String(v || '').trim();
  if (!t || sinTildes(t) === 'todas' || sinTildes(t) === 'todos') return 'todas';
  const ok = t.split(',').map(x => x.trim()).filter(String).map(x => sedesValidas.filter(s => mismaSede(s, x))[0]).filter(Boolean);
  if (!ok.length) throw new Error('Elige al menos un lugar');
  return ok.join(', ');
}
function guardarAdmin(user, tipo, it, original) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const todasSedes = leer('Sedes').map(x => String(x.nombre).trim()).filter(String);
    let detalle = '', id = '';
    if (tipo === 'usuario') {
      const nombre = String(it.nombre || '').trim().replace(/\s+/g, ' ');
      if (!nombre) throw new Error('Escribe el nombre');
      if (nombre.length > 40) throw new Error('El nombre es muy largo');
      const usuarios = leer('Usuarios').filter(u => String(u.nombre).trim());
      const orig = original ? usuarios.filter(u => String(u.nombre).trim() === String(original).trim())[0] : null;
      if (original && !orig) throw new Error('No se encontró ese usuario');
      if (usuarios.some(u => sinTildes(u.nombre) === sinTildes(nombre) && u !== orig)) throw new Error('Ya existe un usuario con ese nombre');
      const rol = it.rol === 'admin' ? 'admin' : 'cajero';
      const activo = it.activo !== false;
      const sede = rol === 'admin' ? '' : (todasSedes.filter(s => mismaSede(s, it.sede))[0] || '');
      if (rol === 'cajero' && !sede) throw new Error('Elige el lugar donde trabaja');
      const esYo = orig && String(orig.nombre).trim() === user.nombre;
      if (esYo && (!activo || rol !== 'admin')) throw new Error('No puedes quitarte el rol de administrador ni desactivarte a ti mismo');
      const quedanAdmins = usuarios.filter(u => u !== orig && activoDe(u.activo) && String(u.rol).trim().toLowerCase() === 'admin').length + (rol === 'admin' && activo ? 1 : 0);
      if (!quedanAdmins) throw new Error('Tiene que quedar al menos un administrador activo');
      const obj = { nombre, rol, sede, activo: activo ? 'si' : 'no' };
      if (it.pin != null && String(it.pin).trim() !== '') obj.pin = validarPin(it.pin);
      else if (!orig) throw new Error('Ponle un PIN de 4 a 8 números');
      upsertFila('Usuarios', o => orig ? String(o.nombre).trim() === String(orig.nombre).trim() : false, obj);
      id = nombre;
      detalle = (orig ? (orig.nombre !== nombre ? 'renombrado desde ' + orig.nombre + '; ' : '') : 'nuevo; ') + rol + (sede ? ' en ' + sede : '') + (activo ? '' : '; desactivado') + (obj.pin ? '; PIN cambiado' : '');
    } else if (tipo === 'sede') {
      const sedes = leer('Sedes').filter(x => String(x.nombre).trim());
      const orig = original ? sedes.filter(x => String(x.nombre).trim() === String(original).trim())[0] : null;
      const nombre = orig ? String(orig.nombre).trim() : String(it.nombre || '').trim().replace(/\s+/g, ' ');
      if (!nombre) throw new Error('Escribe el nombre del lugar');
      if (!orig && sedes.some(x => mismaSede(x.nombre, nombre))) throw new Error('Ese lugar ya existe');
      const activo = it.activo !== false;
      if (!activo && sedes.filter(x => x !== orig && activoDe(x.activo)).length === 0) throw new Error('Tiene que quedar al menos un lugar activo');
      const orden = it.orden != null && it.orden !== '' ? Number(it.orden) || 0 : (orig ? Number(orig.orden) || 0 : sedes.length + 1);
      upsertFila('Sedes', o => mismaSede(o.nombre, nombre), { nombre, activo: activo ? 'si' : 'no', orden });
      id = nombre; detalle = (orig ? '' : 'nuevo; ') + (activo ? 'activo' : 'desactivado');
    } else if (tipo === 'entrada' || tipo === 'producto') {
      const hoja = tipo === 'entrada' ? 'Entradas' : 'Productos';
      const filas = leer(hoja).filter(x => String(x.id).trim());
      const orig = original ? filas.filter(x => String(x.id).trim() === String(original).trim())[0] : null;
      if (original && !orig) throw new Error('No se encontró');
      const nombre = String(it.nombre || '').trim();
      if (!nombre) throw new Error('Escribe el nombre');
      const precio = Math.round(Number(it.precio));
      if (!(precio >= 0)) throw new Error('El precio no es válido');
      id = orig ? String(orig.id).trim() : idDesde(nombre, filas.map(x => String(x.id).trim()));
      const obj = {
        id, nombre, precio, activo: it.activo === false ? 'no' : 'si', sedes: textoSedes(it.sedes, todasSedes),
        orden: it.orden != null && it.orden !== '' ? Number(it.orden) || 0 : (orig ? Number(orig.orden) || 0 : filas.length + 1)
      };
      if (tipo === 'entrada') {
        const minutos = Math.round(Number(it.minutos) || 0);
        if (minutos < 0 || minutos > 720) throw new Error('Los minutos no son válidos');
        const gratis = !!it.gratis;
        if (!gratis && precio === 0 && it.activo !== false) obj.nota = 'Falta precio';
        else if (orig && /precio por confirmar|falta precio/i.test(String(orig.nota || ''))) obj.nota = '';
        Object.assign(obj, { minutos, color: String(it.color || '').trim() || 'rotativo', gratis: gratis ? 'si' : 'no' });
        if (it.nota != null) obj.nota = String(it.nota).slice(0, 200);
      } else {
        obj.aviso_bajo = Math.max(0, Math.round(Number(it.aviso_bajo) || 0));
      }
      upsertFila(hoja, o => String(o.id).trim() === id, obj);
      detalle = (orig ? '' : 'nuevo; ') + nombre + ' ' + precio + (obj.activo === 'no' ? '; desactivado' : '');
    } else if (tipo === 'config') {
      const cfgUp = (clave, sede, valor, desc) => upsertFila('Config',
        o => String(o.clave).trim() === clave && (sede ? mismaSede(o.sede, sede) : !String(o.sede || '').trim()),
        { clave, valor: String(valor), descripcion: desc, sede: sede || '' });
      if (it.colores_media != null) {
        const cols = (Array.isArray(it.colores_media) ? it.colores_media : String(it.colores_media).split(','))
          .map(x => String(x).trim()).filter(String).filter((x, i, a) => a.findIndex(y => sinTildes(y) === sinTildes(x)) === i);
        if (cols.length < 2) throw new Error('Deja al menos dos colores para rotar');
        cfgUp('colores_media', '', cols.join(','), 'Colores de pulsera que rotan por turno (½ hora, Free pass y Cortesía)');
        detalle += 'colores: ' + cols.join(', ') + '. ';
      }
      if (it.medios_pago != null) {
        const ms = MEDIOS_POSIBLES.filter(m => (it.medios_pago || []).some(x => sinTildes(x) === sinTildes(m)));
        if (!ms.length) throw new Error('Deja al menos un medio de pago');
        cfgUp('medios_pago', '', ms.join(','), 'Medios de pago que se aceptan');
        detalle += 'medios: ' + ms.join(', ') + '. ';
      }
      id = 'config';
    } else throw new Error('Tipo desconocido');
    registrarHistorial(user.nombre, 'ajustes: ' + tipo, id, detalle.trim());
  } finally { lock.releaseLock(); }
}

/* ---------------- reportes (administradores) ---------------- */
function reporte(desde, hasta, sedePedida, sedes) {
  const enRango = x => x.fecha >= desde && x.fecha <= hasta;
  const lista = sedePedida === '*' ? sedes : sedes.filter(s => mismaSede(s, sedePedida));
  const regsAll = leer('Registros').filter(enRango);
  const gasAll = leer('Gastos').filter(enRango);
  const cieAll = leer('Cierres').filter(enRango);
  const limpio = r => {
    const o = Object.assign({}, r); delete o.listaGastos; return o;
  };
  const porSede = lista.map(s => {
    const regs = regsAll.filter(r => mismaSede(r.sede, s));
    const gas = gasAll.filter(g => mismaSede(g.sede, s));
    const cie = cieAll.filter(c => mismaSede(c.sede, s));
    const r = limpio(Calc.resumen(regs, gas, {}));
    r.sede = s;
    r.dias = Array.from(new Set(regs.map(x => x.fecha))).length;
    r.cerrados = cie.filter(estaCerrada).length;
    r.difEfectivo = cie.filter(c => String(c.difEfectivo).trim() !== '').reduce((a, c) => a + (Number(c.difEfectivo) || 0), 0);
    return r;
  });
  const regsT = regsAll.filter(r => lista.some(s => mismaSede(s, r.sede)));
  const gasT = gasAll.filter(g => lista.some(s => mismaSede(s, g.sede)));
  const total = limpio(Calc.resumen(regsT, gasT, {}));
  total.difEfectivo = porSede.reduce((a, r) => a + r.difEfectivo, 0);
  const cierres = cieAll.filter(c => lista.some(s => mismaSede(s, c.sede)))
    .sort((a, b) => (a.fecha + a.sede) < (b.fecha + b.sede) ? 1 : -1)
    .map(c => ({ fecha: c.fecha, sede: c.sede, estado: c.estado, cerradoPor: c.cerradoPor, neto: c.neto, efectivoCaja: c.efectivoCaja,
      efectivoContado: c.efectivoContado, difEfectivo: c.difEfectivo, archivo: c.archivo }));
  return { desde, hasta, sede: sedePedida, porSede, total, cierres };
}

/* ---------------- archivo diario en Drive ---------------- */
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Carpeta "Cajas diarias" junto a la planilla (se crea una vez). */
function carpetaCajas() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('carpetaCajas');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { } }
  const padres = DriveApp.getFileById(SpreadsheetApp.getActive().getId()).getParents();
  const base = padres.hasNext() ? padres.next() : DriveApp.getRootFolder();
  const f = base.createFolder('Cajas diarias – Parque Acuático');
  props.setProperty('carpetaCajas', f.getId());
  return f;
}
function subcarpeta(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}
/** Cajas diarias / <lugar> / 2026-11 Noviembre */
function carpetaMes(fecha, sede) {
  return subcarpeta(subcarpeta(carpetaCajas(), sede), fecha.slice(0, 7) + ' ' + MESES[Number(fecha.slice(5, 7)) - 1]);
}
function fechaTexto(fecha) {
  const d = new Date(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)), 12);
  const t = DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()].toLowerCase() + ' de ' + d.getFullYear();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Crea (o reescribe, si se volvió a cerrar) la planilla con la caja del día de un lugar.
 *  Pestaña "Resumen": totales, cuadre, entradas, pulseras, inventario y gastos. Pestaña "Ventas": el detalle. */
function archivoDelDia(cierre) {
  const fecha = String(cierre.fecha), sede = String(cierre.sede);
  let ss = null;
  if (cierre.archivoId) { try { ss = SpreadsheetApp.openById(cierre.archivoId); } catch (e) { ss = null; } }
  if (!ss) {
    const d = new Date(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)), 12);
    ss = SpreadsheetApp.create('Caja ' + sede + ' ' + fecha + ' (' + DIAS[d.getDay()] + ')');
    DriveApp.getFileById(ss.getId()).moveTo(carpetaMes(fecha, sede));
  }
  try { ss.setSpreadsheetLocale('es_CL'); ss.setSpreadsheetTimeZone(Session.getScriptTimeZone()); } catch (e) { }
  const primera = ss.getSheets()[0];
  const shR = ss.getSheetByName('Resumen') || (primera.getName && primera.getName() !== 'Ventas' ? primera : ss.insertSheet('Resumen'));
  shR.setName('Resumen');
  const shV = ss.getSheetByName('Ventas') || ss.insertSheet('Ventas');
  shR.clear(); shV.clear();

  const cfg = leerConfig(sede);
  const regsSede = leer('Registros').filter(r => mismaSede(r.sede, sede));
  const regs = regsSede.filter(r => r.fecha === fecha).sort((a, b) => String(a.entrada).localeCompare(String(b.entrada)));
  const gastos = leer('Gastos').filter(g => g.fecha === fecha && mismaSede(g.sede, sede) && g.estado !== 'anulado');
  const movsSede = leer('Inventario').filter(m => mismaSede(m.sede, sede));
  const ids = idsInventario(cfg);
  const stock = Calc.stockDia(ids, Calc.stockAntes(fecha, ids, movsSede, regsSede), movsSede.filter(m => m.fecha === fecha), regs);
  const R = Calc.resumen(regs, gastos, cfg);
  const num = v => Number(v) || 0;
  const hay = v => v !== '' && v != null && !isNaN(Number(v));
  const DINERO = '$#,##0;-$#,##0';

  /* ----- pestaña Resumen ----- */
  const W = 6, F = [], E = [], M = [];
  const add = (vals, tipo) => { const r = vals.slice(0, W); while (r.length < W) r.push(''); F.push(r); if (tipo) E.push({ f: F.length, t: tipo }); return F.length; };
  const dinero = (fila, col, n, nc) => M.push([fila, col, n || 1, nc || 1]);
  let f;

  add(['Caja del día · ' + sede], 'titulo');
  add([fechaTexto(fecha)], 'sub');
  add(['Cerrada por ' + cierre.cerradoPor + ' a las ' + String(cierre.cerradoEn).slice(11, 16)], 'nota');
  add([]);

  add(['Resumen'], 'seccion');
  f = add(['Total recaudado', R.recaudado], 'grande'); dinero(f, 2);
  f = add(['Efectivo', R.efectivo]); dinero(f, 2);
  f = add(['Débito', R.debito]); dinero(f, 2);
  if (R.transferencia) { f = add(['Transferencia', R.transferencia]); dinero(f, 2); }
  if (R.devol) { f = add(['Devoluciones (en efectivo)', -R.devol]); dinero(f, 2); }
  f = add(['Gastos', -R.totalGastos]); dinero(f, 2);
  f = add(['Neto del día', R.neto], 'fuerte'); dinero(f, 2);
  add([]);

  add(['Cuadre de caja'], 'seccion');
  add(['', 'Según sistema', 'Contado / máquina', 'Diferencia'], 'cabecera');
  f = add(['Efectivo en caja', R.efectivoEsperado, hay(cierre.efectivoContado) ? num(cierre.efectivoContado) : 'No ingresado',
    hay(cierre.efectivoContado) ? num(cierre.efectivoContado) - R.efectivoEsperado : '']);
  dinero(f, 2, 1, 3);
  f = add(['Débito', R.debito, hay(cierre.debitoMaquina) ? num(cierre.debitoMaquina) : 'No ingresado',
    hay(cierre.debitoMaquina) ? num(cierre.debitoMaquina) - R.debito : '']);
  dinero(f, 2, 1, 3);
  add([]);

  add(['Entradas y juegos'], 'seccion');
  add(['Tipo', 'Pulseras', 'Gratis', 'Monto'], 'cabecera');
  const ents = Object.keys(R.porEntrada);
  if (ents.length) ents.forEach(k => { const e = R.porEntrada[k]; f = add([e.nombre, e.cant, e.gratis ? e.cant : '', e.monto]); dinero(f, 4); });
  else add(['Sin entradas'], 'nota');
  f = add(['Total', R.pulseras, R.gratis || '', R.ventaEntradas], 'fuerte'); dinero(f, 4);
  add([]);

  add(['Pulseras por color'], 'seccion');
  add(['Color', 'Entregadas', 'Gratis', 'Rotas', 'Al abrir + llegaron', 'Quedan'], 'cabecera');
  cfg.pulseras.forEach(col => {
    const s = stock['pulsera:' + col] || {};
    const c = R.porColor[col] || { cant: 0, gratis: 0, rotas: 0 };
    if (!c.cant && !c.rotas && s.inicio == null && !s.entradas) return;
    add([col, c.cant, c.gratis || '', c.rotas || '', s.inicio == null ? 'Sin conteo' : (+s.inicio) + (+s.entradas || 0), s.queda == null ? 'Sin conteo' : s.queda]);
  });
  add([]);

  add(['Productos'], 'seccion');
  add(['Producto', 'Vendidos', 'Monto', 'Al abrir', 'Llegaron', 'Quedan'], 'cabecera');
  leerProductos(sede, true).forEach(p => {
    const s = stock[p.id] || {};
    const v = R.porProducto[p.id] || { cant: 0, monto: 0 };
    if (!v.cant && s.inicio == null) return;
    f = add([p.nombre, v.cant, v.monto, s.inicio == null ? 'Sin conteo' : s.inicio, s.entradas || 0, s.queda == null ? 'Sin conteo' : s.queda]);
    dinero(f, 3);
  });
  add([]);

  add(['Quién registró qué'], 'seccion');
  add(['Persona', 'Ventas', 'Efectivo', 'Débito', 'Total cobrado', 'Anuló / editó'], 'cabecera');
  Object.keys(R.porPersona).forEach(n => {
    const x = R.porPersona[n];
    f = add([n, x.ventas, x.efectivo, x.debito, x.monto, (x.anuladas || x.editadas) ? x.anuladas + ' / ' + x.editadas : '']);
    dinero(f, 3, 1, 3);
  });
  add(['Cerró la caja: ' + cierre.cerradoPor], 'nota');
  add([]);

  add(['Gastos'], 'seccion');
  add(['Concepto', 'Monto', 'Pagado con', 'Anotó'], 'cabecera');
  if (gastos.length) gastos.forEach(g => { f = add([g.concepto, num(g.monto), g.pagadoDesde === 'Efectivo' ? 'Efectivo de la caja' : 'Pagado aparte', g.creadoPor]); dinero(f, 2); });
  else add(['Sin gastos'], 'nota');

  shR.getRange(1, 1, F.length, W).setValues(F);
  M.forEach(m => shR.getRange(m[0], m[1], m[2], m[3]).setNumberFormat(DINERO));
  E.forEach(e => {
    const fila = shR.getRange(e.f, 1, 1, W);
    if (e.t === 'titulo') shR.getRange(e.f, 1).setFontSize(18).setFontWeight('bold').setFontColor('#0b4f71');
    else if (e.t === 'sub') shR.getRange(e.f, 1).setFontSize(12).setFontWeight('bold');
    else if (e.t === 'nota') shR.getRange(e.f, 1).setFontColor('#557083');
    else if (e.t === 'seccion') shR.getRange(e.f, 1).setFontSize(13).setFontWeight('bold').setFontColor('#0786a3');
    else if (e.t === 'cabecera') fila.setFontWeight('bold').setBackground('#dff3f8');
    else if (e.t === 'fuerte') fila.setFontWeight('bold');
    else if (e.t === 'grande') shR.getRange(e.f, 1, 1, 2).setFontWeight('bold').setFontSize(13).setFontColor('#0b4f71');
  });
  shR.getRange(1, 2, F.length, W - 1).setHorizontalAlignment('right');
  [240, 130, 150, 130, 110, 110].forEach((w, i) => shR.setColumnWidth(i + 1, w));

  /* ----- pestaña Ventas ----- */
  const cab = ['Hora', 'Venta', 'Entradas y juegos', 'Pulseras', 'Productos', 'Pago', 'Total', 'Devolución', 'Observaciones', 'Registró'];
  const V = [cab];
  regs.forEach(x => {
    V.push([
      x.entrada, x.nombre, textoLineas(x), Calc.lineasDe(x).reduce((s, l) => s + (+l.cant), 0),
      Calc.productosDe(x).map(p => p.nombre + ' ×' + p.cant).join(', '), x.medio,
      num(x.total), num(x.devolucion) || '',
      (x.estado === 'anulado' ? 'ANULADA. ' : '') + (x.obs || ''),
      x.creadoPor + (x.editadoPor ? ' (editó ' + x.editadoPor + ')' : '')
    ]);
  });
  V.push(['Total', R.ventas + ' ventas', '', R.pulseras, '', '', R.bruto, R.devol || '',
    R.devol ? 'Recaudado neto (descontando devoluciones): $' + R.recaudado.toLocaleString('es-CL') : '', '']);
  shV.getRange(1, 1, V.length, cab.length).setValues(V);
  shV.getRange(1, 1, 1, cab.length).setFontWeight('bold').setBackground('#dff3f8');
  shV.getRange(V.length, 1, 1, cab.length).setFontWeight('bold').setBackground('#f1f8fa');
  shV.getRange(2, 7, V.length - 1, 2).setNumberFormat(DINERO);
  shV.getRange(1, 4, V.length, 1).setHorizontalAlignment('center');
  shV.getRange(1, 7, V.length, 2).setHorizontalAlignment('right');
  shV.getRange(2, 3, V.length - 1, 1).setWrap(true);
  shV.getRange(2, 9, V.length - 1, 1).setWrap(true);
  shV.getRange(1, 1, V.length, cab.length).setVerticalAlignment('middle');
  regs.forEach((x, i) => { if (x.estado === 'anulado') shV.getRange(i + 2, 1, 1, cab.length).setFontColor('#9aa9b2').setFontLine('line-through'); });
  shV.setFrozenRows(1);
  [60, 150, 260, 80, 170, 90, 100, 100, 240, 150].forEach((w, i) => shV.setColumnWidth(i + 1, w));

  SpreadsheetApp.flush();
  return { id: ss.getId(), url: ss.getUrl() };
}

/* ---------------- lectura ---------------- */
function leer(hoja) {
  const sh = SpreadsheetApp.getActive().getSheetByName(hoja);
  if (!sh || sh.getLastRow() < 2) return [];
  const vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const h = vals[0].map(String);
  return vals.slice(1).map(fila => aObjeto(h, fila));
}

function aObjeto(h, fila) {
  const o = {};
  h.forEach((k, i) => { o[k] = normalizar(k, fila[i]); });
  return o;
}

function normalizar(k, v) {
  const tz = Session.getScriptTimeZone();
  if (v instanceof Date) {
    if (k === 'entrada' || k === 'salida') return Utilities.formatDate(v, tz, 'HH:mm');
    if (k === 'fecha') return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
    return Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm:ss');
  }
  if (v === undefined) return COLUMNAS_NUMERO.indexOf(k) >= 0 ? 0 : '';
  return COLUMNAS_NUMERO.indexOf(k) >= 0 ? (v === '' ? 0 : Number(v)) : (v === null ? '' : String(v));
}

function limpiar(o) {
  const c = Object.assign({}, o);
  delete c.pin;
  return c;
}

function ahora() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

/* ======================================================================
   Cálculos compartidos con la app (copia de calc.js, se actualiza sola al armar el proyecto)
   ====================================================================== */
/* CALC_INICIO */
/* Cálculos de caja, pulseras e inventario — sin dependencias.
   Se usa en el navegador (window.Calc), en Node (module.exports) y en Apps Script
   (se copia dentro de Codigo.gs al armar el proyecto: no editar esa copia a mano). */
(function (root) {
  'use strict';

  function parse(a) {
    if (typeof a === 'string' && a) { try { return JSON.parse(a); } catch (e) { return null; } }
    return a;
  }

  /** Entradas y juegos de una venta: [{id, nombre, cant, precio, minutos, color, rot, gratis}].
   *  Ventas antiguas (antes del carrito) solo tienen personas + minutos + pulsera. */
  function lineasDe(r) {
    const a = parse(r && r.lineas);
    if (Array.isArray(a)) return a.filter(l => l && +l.cant > 0);
    if (r && +r.personas > 0 && +r.minutos > 0) {
      const hora = +r.minutos === 60;
      return [{ id: hora ? 'hora' : 'media', nombre: hora ? '1 hora' : '½ hora', cant: +r.personas, precio: +r.precioPersona || 0,
        minutos: +r.minutos, color: r.pulsera || '', rot: !hora, gratis: false }];
    }
    return [];
  }

  /** Productos de una venta: [{id, nombre, cant, precio}]. Las antiguas solo tienen calcetas. */
  function productosDe(r) {
    const a = parse(r && r.productos);
    if (Array.isArray(a)) return a.filter(p => p && +p.cant > 0);
    if (r && +r.calcetas > 0) return [{ id: 'calcetas', nombre: 'Calcetas', cant: +r.calcetas, precio: +r.precioCalceta || 0 }];
    return [];
  }

  function totalVenta(v) {
    return lineasDe(v).reduce((s, l) => s + (+l.cant) * (+l.precio || 0), 0) +
      productosDe(v).reduce((s, p) => s + (+p.cant) * (+p.precio || 0), 0);
  }

  /** Lo que una venta descuenta del inventario: productos y una pulsera por cada entrada. */
  function consumosDe(r) {
    const out = productosDe(r).map(p => ({ id: p.id, cant: +p.cant }));
    lineasDe(r).forEach(l => { if (l.color) out.push({ id: 'pulsera:' + l.color, cant: +l.cant }); });
    return out;
  }

  /** Pulseras que se rompieron en una venta anulada (se cancelaron después de entregarlas): salen del stock sin cobro. */
  function rotasDe(r) {
    if (!r || r.estado !== 'anulado') return [];
    return lineasDe(r).filter(l => l.rota && l.color).map(l => ({ id: 'pulsera:' + l.color, color: l.color, cant: +l.cant }));
  }

  /**
   * Stock de un día por ítem (productos e ids "pulsera:Color").
   * inicio: último "Stock al abrir" del día; si no hay, lo que quedó el día anterior; si no, desconocido.
   * queda = inicio + llegadas + ajustes − salidas.
   */
  function stockDia(ids, previo, movs, regs) {
    const res = {};
    const vivos = (movs || []).filter(m => m.estado !== 'anulado');
    const usados = {};
    (regs || []).forEach(r => (r.estado === 'anulado' ? rotasDe(r) : consumosDe(r)).forEach(c => { usados[c.id] = (usados[c.id] || 0) + c.cant; }));
    ids.forEach(id => {
      const m = vivos.filter(x => x.producto === id);
      const ini = m.filter(x => x.tipo === 'inicial');
      let inicio = null, fuente = 'sin';
      if (ini.length) { inicio = +ini[ini.length - 1].cantidad || 0; fuente = 'conteo'; }
      else if (previo && previo[id] != null) { inicio = +previo[id]; fuente = 'anterior'; }
      const entradas = m.filter(x => x.tipo === 'ingreso').reduce((s, x) => s + (+x.cantidad || 0), 0);
      const ajustes = m.filter(x => x.tipo === 'ajuste').reduce((s, x) => s + (+x.cantidad || 0), 0);
      const vendidas = usados[id] || 0;
      res[id] = { inicio, fuente, entradas, ajustes, vendidas, queda: inicio == null ? null : inicio + entradas + ajustes - vendidas };
    });
    return res;
  }

  /** Lo que quedó al final del día anterior a "fecha", recorriendo toda la historia. */
  function stockAntes(fecha, ids, movsAll, regsAll) {
    const fechas = Array.from(new Set((movsAll || []).concat(regsAll || []).map(x => String(x.fecha)).filter(f => f < fecha))).sort();
    let previo = {};
    fechas.forEach(f => {
      const d = stockDia(ids, previo, movsAll.filter(x => x.fecha === f), regsAll.filter(x => x.fecha === f));
      const nuevo = {};
      ids.forEach(id => { nuevo[id] = d[id].queda; });
      previo = nuevo;
    });
    return previo;
  }

  /**
   * Resumen de un día (o de un período, si se le pasan varias fechas).
   * - porMedio: cuánto entró por Efectivo, Débito (y Transferencia en ventas antiguas).
   * - efectivoEsperado = efectivo cobrado − devoluciones − gastos pagados con la caja.
   * - porSocio: neto ÷ cantidad de socios del lugar (si está configurada).
   */
  function resumen(registros, gastos, cfg) {
    cfg = cfg || {};
    const vivos = (registros || []).filter(r => r.estado !== 'anulado');
    const gas = (gastos || []).filter(g => g.estado !== 'anulado');
    const r = {
      ventas: vivos.length, pulseras: 0, gratis: 0, porEntrada: {}, porColor: {}, porProducto: {},
      porMedio: {}, bruto: 0, devol: 0, ventaEntradas: 0, ventaProductos: 0, unidades: 0,
      totalGastos: 0, gastosCaja: 0, listaGastos: gas, porPersona: {}, rotas: 0
    };
    // Quién hizo qué: cada venta cuenta para quien la registró; anulaciones y ediciones para quien las hizo.
    const persona = n => {
      n = String(n || '').trim() || 'Sin nombre';
      if (!r.porPersona[n]) r.porPersona[n] = { ventas: 0, monto: 0, efectivo: 0, debito: 0, otros: 0, pulseras: 0, gratis: 0, devol: 0, gastos: 0, anuladas: 0, editadas: 0, rotas: 0 };
      return r.porPersona[n];
    };
    (registros || []).forEach(v => {
      if (v.estado === 'anulado') {
        const quien = persona(v.editadoPor || v.creadoPor);
        if (v.editadoPor) quien.anuladas++;
        rotasDe(v).forEach(x => {
          quien.rotas += x.cant; r.rotas += x.cant;
          if (!r.porColor[x.color]) r.porColor[x.color] = { cant: 0, gratis: 0, rotas: 0 };
          r.porColor[x.color].rotas = (r.porColor[x.color].rotas || 0) + x.cant;
        });
        return;
      }
      const pp = persona(v.creadoPor), t = +v.total || 0;
      pp.ventas++; pp.monto += t - (+v.devolucion || 0);
      if ((v.medio || 'Efectivo') === 'Efectivo') pp.efectivo += t; else if (v.medio === 'Débito') pp.debito += t; else pp.otros += t;
      pp.devol += +v.devolucion || 0;
      lineasDe(v).forEach(l => { pp.pulseras += +l.cant; if (l.gratis) pp.gratis += +l.cant; });
      if (v.editadoPor) persona(v.editadoPor).editadas++;
    });
    gas.forEach(g => { persona(g.creadoPor).gastos += +g.monto || 0; });
    vivos.forEach(v => {
      const t = +v.total || 0;
      r.bruto += t;
      const medio = v.medio || 'Efectivo';
      r.porMedio[medio] = (r.porMedio[medio] || 0) + t;
      lineasDe(v).forEach(l => {
        const k = l.id;
        if (!r.porEntrada[k]) r.porEntrada[k] = { nombre: l.nombre, cant: 0, monto: 0, gratis: !!l.gratis };
        r.porEntrada[k].cant += +l.cant;
        r.porEntrada[k].monto += (+l.cant) * (+l.precio || 0);
        r.pulseras += +l.cant;
        if (l.gratis) r.gratis += +l.cant;
        r.ventaEntradas += (+l.cant) * (+l.precio || 0);
        if (l.color) {
          if (!r.porColor[l.color]) r.porColor[l.color] = { cant: 0, gratis: 0, rotas: 0 };
          r.porColor[l.color].cant += +l.cant;
          if (l.gratis) r.porColor[l.color].gratis += +l.cant;
        }
      });
      productosDe(v).forEach(p => {
        if (!r.porProducto[p.id]) r.porProducto[p.id] = { nombre: p.nombre, cant: 0, monto: 0 };
        r.porProducto[p.id].cant += +p.cant;
        r.porProducto[p.id].monto += (+p.cant) * (+p.precio || 0);
        r.unidades += +p.cant;
        r.ventaProductos += (+p.cant) * (+p.precio || 0);
      });
      r.devol += +v.devolucion || 0;
    });
    gas.forEach(g => {
      const m = +g.monto || 0;
      r.totalGastos += m;
      if (!g.pagadoDesde || g.pagadoDesde === 'Efectivo') r.gastosCaja += m;
    });
    r.efectivo = r.porMedio['Efectivo'] || 0;
    r.debito = r.porMedio['Débito'] || 0;
    r.transferencia = r.porMedio['Transferencia'] || 0;
    r.recaudado = r.bruto - r.devol;
    r.neto = r.recaudado - r.totalGastos;
    r.efectivoEsperado = r.efectivo - r.devol - r.gastosCaja;   // las devoluciones se pagan en efectivo
    const n = +cfg.socios_cantidad || 0;
    r.socios = n;
    r.porSocio = n > 0 ? r.neto / n : null;
    return r;
  }

  const api = { lineasDe, productosDe, totalVenta, consumosDe, rotasDe, stockDia, stockAntes, resumen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
/* CALC_FIN */
