'use strict';
/* =========================================================
   Parque Acuático · Caja — app principal
   Tres lugares, venta tipo carrito, pulseras con stock por color,
   alertas de término, cuadre de caja y reportes.
   ========================================================= */

const API_URL = ((window.APP_CONFIG || {}).API_URL || '').trim();
// Modo de prueba: se abre con ?demo=1 en la dirección. Trae días inventados y no toca la planilla real.
const PRUEBA = /[?&]demo=1(&|$)/.test(location.search);
const DEMO = !API_URL || PRUEBA;
const REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const API_VERSION_MIN = 7;   // versión del Apps Script que entiende ventas tipo carrito y lugares

const SEDES_DEF = ['Licán Ray', 'Pucón', 'Villarrica'];
const USUARIOS_PRUEBA = [
  { nombre: 'Usuario 1', rol: 'admin', sede: '' },
  { nombre: 'Usuario 2', rol: 'cajero', sede: 'Licán Ray' },
  { nombre: 'Usuario 3', rol: 'cajero', sede: 'Pucón' }
];
const COLORES_MEDIA_DEF = ['Verde', 'Azul', 'Roja', 'Amarilla', 'Naranja', 'Morada', 'Rosada', 'Blanca'];
// Igual que la pestaña Entradas de la planilla (precios por defecto).
const ENTRADAS_DEF = [
  { id: 'media', nombre: '½ hora', precio: 7000, minutos: 30, color: '', rot: true, gratis: false },
  { id: 'hora', nombre: '1 hora', precio: 12000, minutos: 60, color: 'Dorada', rot: false, gratis: false },
  { id: 'full', nombre: 'Full day', precio: 30000, minutos: 0, color: 'Plateada', rot: false, gratis: false },
  { id: 'freepass', nombre: 'Free pass', precio: 0, minutos: 30, color: '', rot: true, gratis: true },
  { id: 'cortesia', nombre: 'Cortesía', precio: 0, minutos: 30, color: '', rot: true, gratis: true },
  { id: 'arrastre', nombre: 'Arrastre', precio: 0, minutos: 0, color: 'Verde flúor', rot: false, gratis: false },
  { id: 'banano', nombre: 'Banano', precio: 0, minutos: 0, color: 'Amarilla flúor', rot: false, gratis: false },
  { id: 'sacachucha', nombre: 'Sacachucha', precio: 0, minutos: 0, color: 'Rosada flúor', rot: false, gratis: false },
  { id: 'extreme', nombre: 'Extreme', precio: 0, minutos: 0, color: 'Naranja flúor', rot: false, gratis: false }
];
// En la prueba los juegos tienen precios de ejemplo para poder probarlos.
const PRECIOS_PRUEBA = { arrastre: 6000, banano: 5000, sacachucha: 6000, extreme: 7000 };
const PRODUCTOS_DEF = [
  { id: 'calcetas', nombre: 'Calcetas', precio: 2000, aviso_bajo: 5 },
  { id: 'bolsa_telefono', nombre: 'Bolsa de teléfono', precio: 2000, aviso_bajo: 5 }
];
const SOCIOS_PRUEBA = { 'Licán Ray': 2, 'Pucón': 5, 'Villarrica': 4 };

const COLOR_HEX = {
  rojo: '#e53935', roja: '#e53935', azul: '#1e88e5', verde: '#43a047', amarillo: '#fdd835', amarilla: '#fdd835',
  naranjo: '#fb8c00', naranja: '#fb8c00', morado: '#8e24aa', morada: '#8e24aa', rosado: '#f06292', rosada: '#f06292', rosa: '#f06292',
  blanco: '#fafafa', blanca: '#fafafa', negro: '#212121', negra: '#212121', celeste: '#4fc3f7', cafe: '#795548', gris: '#9e9e9e',
  fucsia: '#d81b60', turquesa: '#26a69a', dorado: '#d4a017', dorada: '#d4a017', plateado: '#b0bec5', plateada: '#b0bec5',
  lila: '#b39ddb', verdeagua: '#64ffda', verdelimon: '#c0ca33', limon: '#c0ca33',
  verdefluor: '#39ff14', amarillofluor: '#e8ff00', amarillafluor: '#e8ff00', rosadofluor: '#ff2fb3', rosadafluor: '#ff2fb3',
  naranjofluor: '#ff7a00', naranjafluor: '#ff7a00', azulfluor: '#00e5ff', fucsiafluor: '#ff00c8'
};

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
// En modo de prueba todo se guarda con otro prefijo, así nunca se mezcla con los datos reales del teléfono.
const PREF = PRUEBA ? 'pademo_' : 'pa_';
const clave = k => PRUEBA ? k.replace(/^pa_/, PREF) : k;
const LS = {
  get(k, d) { try { const v = localStorage.getItem(clave(k)); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(clave(k), JSON.stringify(v)); } catch (e) { /* sin espacio */ } },
  del(k) { try { localStorage.removeItem(clave(k)); } catch (e) { } }
};
const pad = n => String(n).padStart(2, '0');
const fmt = n => (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(+n || 0)).toLocaleString('es-CL');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fechaDe(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function hoy() { return fechaDe(new Date()); }
function fechaMas(n, base) { const d = base ? new Date(base + 'T12:00:00') : new Date(); d.setDate(d.getDate() + n); return fechaDe(d); }
function ahoraHM() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function segAhora() { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); }
function nowLocal() { const d = new Date(); return hoy() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
function minutosDe(hm) { const p = String(hm || '0:0').split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0); }
function hmDe(m) { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
function sumarMin(hm, m) { return hmDe(minutosDe(hm) + m); }
/* Hora de entrada: siempre a los 5 minutos siguientes (10:51 → 10:55; 10:55 → 10:55) */
function redondear5(hm) { return hmDe(Math.ceil(minutosDe(hm) / 5) * 5); }
function entradaPropuesta() { return redondear5(ahoraHM()); }
function horaDe(ts) { return ts ? String(ts).slice(11, 16) : ''; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function sinTildes(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
function mismaSede(a, b) { return sinTildes(a) === sinTildes(b); }
function slug(s) { return sinTildes(s).replace(/[^a-z0-9]+/g, '-'); }
function colorHex(n) { return COLOR_HEX[sinTildes(n).replace(/\s+/g, '')] || '#90a4ae'; }
function fechaLarga(f) {
  const d = new Date(f + 'T12:00:00');
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function fechaCorta(f) { const d = new Date(f + 'T12:00:00'); return d.getDate() + '/' + (d.getMonth() + 1); }
function toast(msg, tipo) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show ' + (tipo || '');
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = ''; }, 3200);
}
function soltarFoco() { const a = document.activeElement; if (a && a.blur && a !== document.body) a.blur(); }
const enteroDe = v => { const n = parseInt(String(v == null ? '' : v).replace(/\D/g, ''), 10); return isNaN(n) ? null : n; };
const plural = (n, uno, varios) => n + ' ' + (+n === 1 ? uno : varios);

/* ---------- actualización suave del DOM ---------- */
function claveNodo(n) { return n.nodeType === 1 ? (n.getAttribute('data-key') || n.id || null) : null; }
function mismoNodo(a, b) { return a.nodeType === b.nodeType && a.nodeName === b.nodeName && claveNodo(a) === claveNodo(b); }
function morph(destino, html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  morphHijos(destino, t.content);
}
function morphHijos(padre, nuevo) {
  const nuevos = Array.from(nuevo.childNodes);
  let i = 0;
  for (const nk of nuevos) {
    let cur = padre.childNodes[i] || null;
    const k = claveNodo(nk);
    if (k && (!cur || claveNodo(cur) !== k)) {
      const m = Array.from(padre.childNodes).slice(i).find(c => claveNodo(c) === k);
      if (m) { padre.insertBefore(m, cur); cur = m; }
    }
    if (cur && mismoNodo(cur, nk)) morphNodo(cur, nk);
    else { padre.insertBefore(nk, cur); if (nk.nodeType === 1) animarEntrada(nk); }
    i++;
  }
  while (padre.childNodes.length > i) padre.removeChild(padre.lastChild);
}
function morphNodo(a, b) {
  if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  for (const at of Array.from(a.attributes)) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
  for (const at of Array.from(b.attributes)) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
  if (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') {
    const v = b.getAttribute('value') || '';
    if (a !== document.activeElement && a.value !== v) a.value = v;
    return;
  }
  if (a.tagName === 'SELECT' && a === document.activeElement) return;
  morphHijos(a, b);
}
function animarEntrada(el) {
  if (REDUCE) return;
  el.classList.add('entra');
  el.addEventListener('animationend', () => el.classList.remove('entra'), { once: true });
}
function cnt(v, t) { v = Math.round(+v || 0); return `<span data-count="${v}" data-t="${t || '$'}">${t === 'n' ? v : fmt(v)}</span>`; }
function animarConteos(root) {
  root.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count, from = el._v;
    el._v = to;
    if (from == null || from === to || REDUCE) return;
    const t0 = performance.now(), dur = 380, n = el.dataset.t === 'n';
    const paso = now => {
      if (el._v !== to) return;
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (to - from) * e);
      el.textContent = n ? String(v) : fmt(v);
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  });
}

/* ---------- configuración ---------- */
function normalizarEntrada(e) {
  const color = String(e.color || '').trim();
  const rot = e.rot != null ? !!e.rot : (!color || sinTildes(color) === 'rotativo');
  return {
    id: String(e.id), nombre: String(e.nombre || e.id), precio: +e.precio || 0, minutos: +e.minutos || 0,
    color: rot ? '' : color, rot, gratis: !!e.gratis, nota: e.nota || ''
  };
}
function configPrueba(sede) {
  return {
    sede, sedes: SEDES_DEF.slice(),
    colores_media: COLORES_MEDIA_DEF.slice(), medios_pago: ['Efectivo', 'Débito'],
    socios_cantidad: SOCIOS_PRUEBA[sede] || 0,
    entradas: ENTRADAS_DEF.map(e => Object.assign({}, e, PRECIOS_PRUEBA[e.id] && PRUEBA ? { precio: PRECIOS_PRUEBA[e.id], nota: 'precio de ejemplo' } : {})),
    productos: PRODUCTOS_DEF.slice()
  };
}
function normalizarConfig(c, sede) {
  const base = configPrueba(sede || (c && c.sede) || SEDES_DEF[0]);
  const out = Object.assign({}, base, c || {});
  if (!Array.isArray(out.sedes) || !out.sedes.length) out.sedes = base.sedes;
  if (!Array.isArray(out.colores_media) || !out.colores_media.length) out.colores_media = base.colores_media;
  if (!Array.isArray(out.medios_pago) || !out.medios_pago.length) out.medios_pago = base.medios_pago;
  if (!Array.isArray(out.entradas)) out.entradas = base.entradas;
  if (!Array.isArray(out.productos)) out.productos = base.productos;
  out.entradas = out.entradas.map(normalizarEntrada);
  out.productos = out.productos.map(p => ({ id: String(p.id), nombre: String(p.nombre || p.id), precio: +p.precio || 0, aviso_bajo: +p.aviso_bajo || 0 }));
  out.socios_cantidad = +out.socios_cantidad || 0;
  const pul = out.colores_media.slice();
  out.entradas.forEach(e => { if (e.color && pul.indexOf(e.color) < 0) pul.push(e.color); });
  out.pulseras = pul;
  return out;
}

/* ---------- estado ---------- */
const S = {
  user: LS.get('pa_user', null),
  sedes: LS.get('pa_sedes', SEDES_DEF),
  sede: null,
  config: null,
  usuarios: LS.get('pa_usuarios', []),
  fecha: hoy(),
  registros: [], gastos: [], inventario: [], stockPrevio: {}, cierre: null,
  tab: 'vender',
  editId: null,
  venta: null,
  gform: { concepto: '', monto: '', pagadoDesde: 'Efectivo' },
  iform: { producto: '', tipo: 'inicial', cantidad: '', nota: '' },
  cform: { efectivo: '', debito: '' },
  rep: null,
  sedeMenu: false,
  servidorViejo: false,
  syncState: DEMO ? 'demo' : 'idle', syncError: '', syncing: false,
  alertas: [], sonidoTimer: null, sonidoHasta: 0,
  wl: null, wlPidiendo: false
};
function esAdmin() { return !!S.user && String(S.user.rol || '').toLowerCase() === 'admin'; }
function sedeInicial() {
  if (S.user && S.user.sede && !esAdmin()) return S.user.sede;
  const guardada = LS.get('pa_sede', null);
  return (guardada && S.sedes.some(s => mismaSede(s, guardada))) ? guardada : S.sedes[0];
}
function cargarConfig() { S.config = normalizarConfig(DEMO ? configPrueba(S.sede) : LS.get('pa_config_' + slug(S.sede), null), S.sede); }
const productoPorId = id => S.config.productos.find(p => p.id === id);
const entradaPorId = id => S.config.entradas.find(e => e.id === id);
function idsInventario() { return S.config.productos.map(p => p.id).concat(S.config.pulseras.map(c => 'pulsera:' + c)); }
function nombreItem(id) {
  if (String(id).indexOf('pulsera:') === 0) return 'Pulsera ' + id.slice(8).toLowerCase();
  const p = productoPorId(id); return p ? p.nombre : id;
}

/* ---------- datos del día (por lugar) ---------- */
function dayKey(f, sede) { return 'pa_day_' + slug(sede || S.sede) + '_' + f; }
function diasGuardados(sede) {
  const pref = clave('pa_day_' + slug(sede) + '_'), out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(pref) === 0) out.push(k.slice(pref.length));
    }
  } catch (e) { }
  return out.sort();
}
function previoLocal() {
  const movs = [], regs = [];
  diasGuardados(S.sede).filter(f => f < S.fecha).forEach(f => {
    const d = LS.get(dayKey(f), {}) || {};
    (d.inventario || []).forEach(m => movs.push(Object.assign({}, m, { fecha: f })));
    (d.registros || []).forEach(r => regs.push(Object.assign({}, r, { fecha: f })));
  });
  return Calc.stockAntes(S.fecha, idsInventario(), movs, regs);
}
function loadDay() {
  const d = LS.get(dayKey(S.fecha), {}) || {};
  S.registros = d.registros || []; S.gastos = d.gastos || []; S.inventario = d.inventario || [];
  S.cierre = d.cierre || null;
  S.stockPrevio = (!DEMO && d.stockPrevio) ? d.stockPrevio : previoLocal();
  S.cform = { efectivo: '', debito: '' };
}
function saveDay() {
  LS.set(dayKey(S.fecha), { registros: S.registros, gastos: S.gastos, inventario: S.inventario, cierre: S.cierre, stockPrevio: DEMO ? null : S.stockPrevio });
}
function stockHoy() { return Calc.stockDia(idsInventario(), S.stockPrevio, S.inventario, S.registros); }
const getQueue = () => LS.get('pa_queue', []);
const setQueue = q => LS.set('pa_queue', q);
function enqueue(kind, data) {
  const q = getQueue();
  q.push({ opId: uid(), kind, fecha: data.fecha, data, usuario: S.user.nombre, ts: nowLocal() });
  setQueue(q);
}
function upsertArr(arr, obj, key) {
  key = key || 'id';
  const out = arr.slice(); const i = out.findIndex(x => x[key] === obj[key]);
  if (i >= 0) out[i] = obj; else out.push(obj);
  return out;
}
function guardarLocal(kind, obj) {
  obj.sede = S.sede;
  if (kind === 'registro') S.registros = upsertArr(S.registros, obj);
  else if (kind === 'gasto') S.gastos = upsertArr(S.gastos, obj);
  else if (kind === 'inventario') S.inventario = upsertArr(S.inventario, obj);
  else if (kind === 'cierre') S.cierre = obj;
  saveDay();
  if (!DEMO) { enqueue(kind, obj); sync(); }
}

/* ---------- servidor (Google Apps Script) ---------- */
async function api(action, payload, espera) {
  const body = Object.assign({ action, usuario: S.user && S.user.nombre, pin: S.user && S.user.pin }, payload || {});
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), espera || 25000);
  try {
    const res = await fetch(API_URL, {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctrl.signal
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'Error del servidor');
    return j;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('El servidor no respondió');
    throw e;
  } finally { clearTimeout(t); }
}
function aplicarConfig(c) {
  if (!c) return;
  // Un Apps Script anterior no manda "entradas": la app no debe vender hasta que lo actualicen.
  S.servidorViejo = !Array.isArray(c.entradas);
  if (Array.isArray(c.sedes) && c.sedes.length) { S.sedes = c.sedes; LS.set('pa_sedes', c.sedes); }
  if (S.servidorViejo) return;
  LS.set('pa_config_' + slug(c.sede || S.sede), c);
  if (!c.sede || mismaSede(c.sede, S.sede)) S.config = normalizarConfig(c, S.sede);
}

async function sync() {
  if (DEMO || !S.user || S.syncing) return;
  if (!navigator.onLine) { S.syncState = 'offline'; renderHeader(); return; }
  S.syncing = true; S.syncState = 'sync'; renderHeader();
  const fecha = S.fecha, sede = S.sede;
  try {
    const q = getQueue();
    if (q.length && !S.servidorViejo) {
      const res = await api('sync', { ops: q }, 90000);
      const hechos = new Set(res.applied || []);
      setQueue(getQueue().filter(o => !hechos.has(o.opId)));
      if (res.rechazados && res.rechazados.length) {
        const m = res.rechazados[0].motivo || 'rechazado';
        toast(res.rechazados.length === 1 ? 'Un cambio no se guardó: ' + m : res.rechazados.length + ' cambios no se guardaron: ' + m, 'err');
      }
    }
    const d = await api('getDay', { fecha, sede });
    aplicarConfig(d.config);
    if (fecha === S.fecha && mismaSede(sede, S.sede)) {
      let regs = d.registros || [], gas = d.gastos || [], inv = d.inventario || [], cierre = d.cierre || null;
      getQueue().filter(o => o.fecha === fecha && mismaSede(o.data.sede, sede)).forEach(o => {
        if (o.kind === 'registro') regs = upsertArr(regs, o.data);
        else if (o.kind === 'gasto') gas = upsertArr(gas, o.data);
        else if (o.kind === 'inventario') inv = upsertArr(inv, o.data);
        else if (o.kind === 'cierre') cierre = Object.assign({}, cierre || {}, o.data);
      });
      S.registros = regs; S.gastos = gas; S.inventario = inv; S.cierre = cierre;
      if (d.stockPrevio) S.stockPrevio = d.stockPrevio;
      saveDay();
    }
    S.syncState = getQueue().length ? 'pending' : 'ok'; S.syncError = '';
  } catch (e) {
    S.syncState = navigator.onLine ? 'error' : 'offline'; S.syncError = e.message;
  }
  S.syncing = false;
  renderHeader(); renderTab();
  revisarAlertas();
}

/* ---------- turnos: cada entrada con tiempo de una venta ---------- */
function turnosDe(regs) {
  // Las líneas de una venta con el mismo color y tiempo (ej. ½ hora + free pass) son un solo turno.
  const out = [];
  (regs || []).forEach(v => {
    if (v.estado === 'anulado') return;
    const grupos = {};
    Calc.lineasDe(v).forEach(l => {
      if (!(+l.minutos > 0)) return;
      const k = String(l.color) + '|' + l.minutos;
      if (!grupos[k]) {
        grupos[k] = { id: v.id + '#' + slug(l.color) + '-' + l.minutos, v, l: { nombre: l.nombre }, cant: 0, color: l.color, rot: !!l.rot, minutos: +l.minutos,
          entrada: v.entrada, salida: sumarMin(v.entrada, +l.minutos), nombre: v.nombre, nombres: [] };
        out.push(grupos[k]);
      }
      const g = grupos[k];
      g.cant += +l.cant;
      g.nombres.push(l.nombre);
      g.l.nombre = g.nombres.join(' + ');
    });
  });
  return out;
}
function registrosDeHoy() {
  return S.fecha === hoy() ? S.registros : ((LS.get(dayKey(hoy()), {}) || {}).registros || []);
}
const segEnt = t => minutosDe(t.entrada) * 60;
const segSal = t => segEnt(t) + t.minutos * 60;
function turnosActivos(excluirVenta) {
  if (S.fecha !== hoy()) return [];
  const now = segAhora();
  return turnosDe(S.registros).filter(t => t.v.id !== excluirVenta && now >= segEnt(t) - 300 && now < segSal(t));
}
function estadoTurno(t) {
  if (t.v.fecha && t.v.fecha !== hoy()) return { cls: 'fin', txt: '', corto: '', pct: null };
  const now = segAhora(), ent = segEnt(t), sal = segSal(t);
  if (now < ent) return { cls: 'prox', txt: 'Entran a las ' + t.entrada, corto: t.entrada, pct: 0 };
  if (now < sal) {
    const q = Math.ceil((sal - now) / 60);
    const pct = Math.round((now - ent) / (sal - ent) * 1000) / 10;
    return { cls: q <= 5 ? 'pronto' : 'activo', txt: (q <= 5 ? '¡Salen a las ' : 'Salen a las ') + t.salida, corto: String(q), pct };
  }
  return { cls: 'fin', txt: 'Salieron a las ' + t.salida, corto: '', pct: null };
}

/* Color de ½ hora (y de Free pass / Cortesía): los que entran en el mismo turno comparten color;
   cada turno nuevo toma el siguiente color de la lista, saltándose los que siguen en el agua. */
function rotativosQueCruzan(entrada, regs, excluirVenta) {
  const ent = minutosDe(entrada);
  return turnosDe(regs).filter(t => t.rot && t.color && t.v.id !== excluirVenta)
    .filter(t => { const e = minutosDe(t.entrada); return e < ent + 30 && ent < e + t.minutos; });
}
function colorMedia(entrada, regs, excluirVenta) {
  const lista = S.config.colores_media;
  const cruzan = rotativosQueCruzan(entrada, regs, excluirVenta);
  const mismo = cruzan.find(t => t.entrada === entrada);
  if (mismo) return mismo.color;
  const usados = new Set(cruzan.map(t => t.color));
  const ent = minutosDe(entrada);
  const antes = turnosDe(regs).filter(t => t.rot && t.color && t.v.id !== excluirVenta && minutosDe(t.entrada) < ent)
    .sort((a, b) => minutosDe(b.entrada) - minutosDe(a.entrada))[0];
  const desde = antes ? lista.indexOf(antes.color) + 1 : 0;
  for (let i = 0; i < lista.length; i++) {
    const c = lista[(desde + i) % lista.length];
    if (!usados.has(c)) return c;
  }
  return lista[desde % lista.length];
}
function asignarColores(regs) {
  regs.slice().sort((a, b) => minutosDe(a.entrada) - minutosDe(b.entrada)).forEach(v => {
    const ls = Calc.lineasDe(v);
    if (!ls.some(l => l.rot && !l.color)) return;
    const c = colorMedia(v.entrada, regs.filter(x => x !== v), v.id);
    ls.forEach(l => { if (l.rot && !l.color) l.color = c; });
    v.lineas = ls;
    v.pulsera = Array.from(new Set(ls.map(l => l.color).filter(Boolean))).join(', ');
  });
  return regs;
}

/* ---------- alertas de término ---------- */
let AC = null;
function audioCtx() {
  try {
    if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C(); }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { return null; }
  return AC;
}
function sonar() {
  const ac = audioCtx();
  if (ac) {
    const t = ac.currentTime + 0.05;
    [0, 0.22, 0.44, 0.95, 1.17, 1.39].forEach((d, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = i % 3 === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.3, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.17);
      o.connect(g); g.connect(ac.destination);
      o.start(t + d); o.stop(t + d + 0.2);
    });
  }
  if (navigator.vibrate) { try { navigator.vibrate([400, 150, 400, 150, 700]); } catch (e) { } }
}
function pedirPermisoNotif() {
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { }
}
function notificar(t) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
    navigator.serviceWorker.ready.then(reg => reg.showNotification('⏰ Llama a los de pulsera ' + String(t.color).toLowerCase(), {
      body: t.nombre + ' · ' + plural(t.cant, 'pulsera', 'pulseras') + ' de ' + t.l.nombre + ' · salida ' + t.salida,
      tag: 'fin-' + t.id, renotify: true, requireInteraction: true,
      icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [400, 150, 400, 150, 700]
    })).catch(() => { });
  } catch (e) { }
}
function revisarAlertas() {
  if (!S.user || !S.sede) return;
  const k = 'pa_avisos_' + slug(S.sede) + '_' + hoy(), vistos = LS.get(k, {}), now = segAhora();
  let cambio = false; const nuevos = [];
  turnosDe(registrosDeHoy()).forEach(t => {
    const id = t.id + '@' + t.salida, sal = segSal(t);
    if (vistos[id] || now < sal) return;
    vistos[id] = 1; cambio = true;
    if (now - sal <= 600) nuevos.push(t);   // terminó hace menos de 10 min: avisar
  });
  if (cambio) LS.set(k, vistos);
  if (!nuevos.length) return;
  nuevos.forEach(t => { S.alertas = S.alertas.filter(a => a.id !== t.id).concat([t]); });
  renderAlerta();
  sonar();
  S.sonidoHasta = Date.now() + 3 * 60 * 1000;
  if (!S.sonidoTimer) S.sonidoTimer = setInterval(() => {
    if (!S.alertas.length || Date.now() > S.sonidoHasta) { clearInterval(S.sonidoTimer); S.sonidoTimer = null; return; }
    sonar();
  }, 9000);
  if (document.hidden) nuevos.forEach(notificar);
  renderTab();
}
function cerrarAlerta() {
  S.alertas = [];
  if (S.sonidoTimer) { clearInterval(S.sonidoTimer); S.sonidoTimer = null; }
  if (navigator.vibrate) { try { navigator.vibrate(0); } catch (e) { } }
  renderAlerta();
}
function renderAlerta() {
  const el = $('#alerta'); if (!el) return;
  if (!S.alertas.length) {
    el.classList.remove('show');
    clearTimeout(renderAlerta._t);
    renderAlerta._t = setTimeout(() => { if (!S.alertas.length) el.hidden = true; }, 320);
    return;
  }
  const html = `<div class="al-hoja" role="alertdialog" aria-labelledby="al-t">
      <div class="al-icono"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M5 3 2 6M19 3l3 3"/></svg></div>
      <h2 id="al-t">${S.alertas.length > 1 ? 'Se acabó el tiempo de ' + S.alertas.length + ' grupos' : 'Se acabó el tiempo'}</h2>
      ${S.alertas.map(t => `<div class="al-grupo" data-key="al-${t.id}"><i style="background:${colorHex(t.color)}"></i><div><b>Llama a los de pulsera ${esc(String(t.color).toLowerCase())}</b><span>${esc(t.nombre)}: ${plural(t.cant, 'pulsera', 'pulseras')} de ${esc(t.l.nombre)}. Salían a las ${esc(t.salida)}.</span></div></div>`).join('')}
      <button class="btn coral big" data-act="alerta-ok">Listo, ya salieron</button>
    </div>`;
  if (el.hidden || !el.firstElementChild) { el.innerHTML = html; el.hidden = false; void el.offsetWidth; el.classList.add('show'); }
  else morph(el, html);
}

/* Pantalla encendida mientras haya grupos en el agua, para que la alerta suene a tiempo */
async function pantallaEncendida() {
  if (!('wakeLock' in navigator) || S.wlPidiendo) return;
  const now = segAhora();
  const hace = !!S.user && !document.hidden &&
    turnosDe(registrosDeHoy()).some(t => now >= segEnt(t) - 600 && now < segSal(t) + 60);
  try {
    if (hace && !S.wl) {
      S.wlPidiendo = true;
      S.wl = await navigator.wakeLock.request('screen');
      S.wl.addEventListener('release', () => { S.wl = null; });
    } else if (!hace && S.wl) { await S.wl.release(); S.wl = null; }
  } catch (e) { /* el navegador no lo permitió */ }
  S.wlPidiendo = false;
}

/* ---------- venta (carrito) ---------- */
function nuevaVenta() {
  return {
    nombre: '', ents: {}, prods: {}, medio: S.config.medios_pago[0], entrada: entradaPropuesta(), entradaAuto: true,
    obs: '', colorRot: '', colorManual: false, devolucion: '', orig: null
  };
}
function ventaDesde(v) {
  const ents = {}, prods = {};
  Calc.lineasDe(v).forEach(l => { ents[l.id] = (ents[l.id] || 0) + (+l.cant); });
  Calc.productosDe(v).forEach(p => { prods[p.id] = (prods[p.id] || 0) + (+p.cant); });
  const rot = Calc.lineasDe(v).find(l => l.rot && l.color);
  const medio = S.config.medios_pago.indexOf(v.medio) >= 0 ? v.medio : S.config.medios_pago[0];
  return {
    nombre: v.nombre || '', ents, prods, medio, entrada: v.entrada, entradaAuto: false, obs: v.obs || '',
    colorRot: rot ? rot.color : '', colorManual: !!rot, devolucion: +v.devolucion ? String(v.devolucion) : '',
    orig: { lineas: Calc.lineasDe(v), productos: Calc.productosDe(v), medio: v.medio }
  };
}
function entradaAutoActiva() { return S.venta.entradaAuto && !S.editId && S.fecha === hoy(); }
function horaVenta() { return entradaAutoActiva() ? entradaPropuesta() : S.venta.entrada; }
function colorRotActual() {
  const f = S.venta;
  return f.colorManual && f.colorRot ? f.colorRot : colorMedia(horaVenta(), S.registros, S.editId);
}
/** Entradas del carrito como líneas de venta (con precio, tiempo y color). */
function lineasDelCarrito() {
  const f = S.venta, out = [];
  const color = colorRotActual();
  const ids = Object.keys(f.ents).filter(id => +f.ents[id] > 0);
  ids.forEach(id => {
    const e = entradaPorId(id);
    const o = f.orig && f.orig.lineas.find(l => l.id === id);
    const base = o || (e ? { id, nombre: e.nombre, precio: e.precio, minutos: e.minutos, color: e.color, rot: e.rot, gratis: e.gratis } : null);
    if (!base) return;
    out.push({ id, nombre: base.nombre, cant: +f.ents[id], precio: +base.precio || 0, minutos: +base.minutos || 0,
      color: base.rot ? color : base.color, rot: !!base.rot, gratis: !!base.gratis });
  });
  // en el orden de la planilla
  const orden = id => { const i = S.config.entradas.findIndex(e => e.id === id); return i < 0 ? 99 : i; };
  return out.sort((a, b) => orden(a.id) - orden(b.id));
}
function productosDelCarrito() {
  const f = S.venta;
  return Object.keys(f.prods).filter(id => +f.prods[id] > 0).map(id => {
    const o = f.orig && f.orig.productos.find(p => p.id === id);
    const p = o || productoPorId(id) || { id, nombre: id, precio: 0 };
    return { id, nombre: p.nombre, cant: +f.prods[id], precio: +p.precio || 0 };
  });
}
function totalCarrito() { return Calc.totalVenta({ lineas: lineasDelCarrito(), productos: productosDelCarrito() }); }

function diaCerrado() { return !!S.cierre && S.cierre.estado !== 'reabierta' && !!S.cierre.cerradoEn; }
function bloqueado() {
  if (S.servidorViejo) { toast('Falta actualizar el Apps Script de la planilla. Avisa al administrador.', 'err'); return true; }
  if (!diaCerrado()) return false;
  toast('La caja de este día está cerrada. No se pueden hacer cambios.', 'err');
  return true;
}

function guardarVenta() {
  if (bloqueado()) return;
  const f = S.venta;
  const lineas = lineasDelCarrito();
  const productos = productosDelCarrito();
  if (!lineas.length && !productos.length) return toast('Agrega al menos una entrada, juego o producto', 'err');
  if (!f.medio) return toast('Elige el medio de pago', 'err');
  soltarFoco(); pedirPermisoNotif(); audioCtx();
  const prev = S.editId ? S.registros.find(r => r.id === S.editId) : null;
  const conTiempo = lineas.some(l => l.minutos > 0);
  const entrada = prev ? (conTiempo ? f.entrada : prev.entrada) : (conTiempo ? horaVenta() : (S.fecha === hoy() ? ahoraHM() : f.entrada));
  const numero = prev ? null : S.registros.length + 1;
  const dev = Math.max(0, enteroDe(f.devolucion) || 0);
  const salidas = lineas.filter(l => l.minutos > 0).map(l => sumarMin(entrada, l.minutos)).sort();
  const calc = productos.find(p => p.id === 'calcetas');
  const rec = Object.assign({}, prev || {}, {
    id: prev ? prev.id : uid(),
    fecha: S.fecha, sede: S.sede,
    nombre: (f.nombre || '').trim() || (prev ? prev.nombre : 'Venta ' + numero),
    entrada, salida: salidas.length ? salidas[salidas.length - 1] : '',
    lineas, productos,
    personas: lineas.reduce((s, l) => s + l.cant, 0),
    pulsera: Array.from(new Set(lineas.map(l => l.color).filter(Boolean))).join(', '),
    minutos: 0, precioPersona: 0,
    calcetas: calc ? calc.cant : 0, precioCalceta: calc ? calc.precio : 0,
    medio: f.medio, cuenta: '',
    obs: (f.obs || '').trim(),
    devolucion: dev, devolucionDesde: dev ? 'Efectivo' : '',
    estado: prev ? prev.estado : 'ok'
  });
  rec.total = Calc.totalVenta(rec);
  if (prev) { rec.editadoPor = S.user.nombre; rec.editadoEn = nowLocal(); }
  else { rec.creadoPor = S.user.nombre; rec.creadoEn = nowLocal(); }
  guardarLocal('registro', rec);
  const entrega = lineas.length ? ' · entrega ' + resumenPulseras(lineas) : '';
  toast(prev ? 'Cambios guardados' : rec.nombre + entrega + ' · ' + fmt(rec.total), 'ok');
  avisarStockBajo(rec);
  if (prev) irA('grupos', () => { S.editId = null; S.venta = nuevaVenta(); });
  else { S.venta = nuevaVenta(); renderTab(); window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' }); }
  pantallaEncendida();
}
function resumenPulseras(lineas) {
  const m = {};
  lineas.forEach(l => { if (l.color) m[l.color] = (m[l.color] || 0) + l.cant; });
  return Object.keys(m).map(c => m[c] + ' ' + c.toLowerCase()).join(', ');
}
function avisarStockBajo(v) {
  const st = stockHoy();
  const bajos = Calc.consumosDe(v).map(c => ({ c, s: st[c.id] })).filter(x => {
    if (!x.s || x.s.queda == null) return false;
    const p = productoPorId(x.c.id);
    return x.s.queda <= (p ? p.aviso_bajo : 10);
  });
  if (bajos.length) setTimeout(() => toast('Quedan pocas: ' + bajos.map(x => nombreItem(x.c.id) + ' ' + x.s.queda).join(', '), 'warn'), 3300);
}

function cambiarEstado(id, estado) {
  if (bloqueado()) return;
  const r = S.registros.find(x => x.id === id); if (!r) return;
  const msg = estado === 'anulado' ? '¿Anular "' + r.nombre + '"? Antes recupera o corta las pulseras entregadas. Quedará registrado quién la anuló.' : '¿Restaurar "' + r.nombre + '"?';
  if (!confirm(msg)) return;
  guardarLocal('registro', Object.assign({}, r, { estado, editadoPor: S.user.nombre, editadoEn: nowLocal() }));
  toast(estado === 'anulado' ? 'Venta anulada' : 'Venta restaurada');
  irA('grupos', () => { S.editId = null; S.venta = nuevaVenta(); });
}

/* ---------- inventario ---------- */
const TIPOS_MOV = [
  ['inicial', 'Stock al abrir', '¿Cuántas hay al abrir?'],
  ['ingreso', 'Llegó mercadería', '¿Cuántas llegaron?'],
  ['conteo', 'Contar ahora', '¿Cuántas hay ahora?']
];
function guardarMovimiento() {
  if (bloqueado()) return;
  const f = S.iform;
  const id = f.producto || idsInventario()[0];
  const cant = enteroDe(f.cantidad);
  if (cant == null) return toast('Escribe la cantidad', 'err');
  if (f.tipo === 'ingreso' && cant <= 0) return toast('La cantidad que llegó debe ser mayor que 0', 'err');
  soltarFoco();
  const st = stockHoy()[id] || { queda: null, vendidas: 0, entradas: 0, ajustes: 0 };
  const nom = nombreItem(id);
  let tipo = f.tipo, cantidad = cant, nota = (f.nota || '').trim(), msg;
  if (f.tipo === 'conteo') {
    if (st.queda == null) {
      tipo = 'inicial';
      cantidad = cant + st.vendidas - st.entradas - st.ajustes;
      nota = ('Contadas ' + cant + ' a las ' + ahoraHM() + '. ' + nota).trim();
      msg = nom + ': quedan ' + cant;
    } else {
      tipo = 'ajuste';
      cantidad = cant - st.queda;
      nota = ('Conteo: ' + cant + ' (la app decía ' + st.queda + '). ' + nota).trim();
      msg = cantidad === 0 ? nom + ': el conteo cuadra' : nom + ': diferencia ' + (cantidad > 0 ? '+' : '') + cantidad + ' corregida';
    }
  } else msg = f.tipo === 'inicial' ? nom + ': se abre con ' + cant : nom + ': +' + cant + ' llegaron';
  guardarLocal('inventario', {
    id: uid(), fecha: S.fecha, producto: id, tipo, cantidad, nota,
    estado: 'ok', creadoPor: S.user.nombre, creadoEn: nowLocal()
  });
  S.iform = { producto: id, tipo: f.tipo, cantidad: '', nota: '' };
  toast(msg, cantidad !== 0 && f.tipo === 'conteo' ? 'warn' : 'ok');
  renderTab();
}
function anularMovimiento(id) {
  if (bloqueado()) return;
  const m = S.inventario.find(x => x.id === id); if (!m) return;
  if (!confirm('¿Anular este movimiento de inventario?')) return;
  guardarLocal('inventario', Object.assign({}, m, { estado: 'anulado', editadoPor: S.user.nombre, editadoEn: nowLocal() }));
  renderTab();
}

/* ---------- gastos, cuadre y cierre ---------- */
function agregarGasto() {
  if (bloqueado()) return;
  const g = S.gform;
  const monto = enteroDe(g.monto) || 0;
  if (!g.concepto.trim()) return toast('Escribe en qué se gastó', 'err');
  if (monto <= 0) return toast('Escribe el monto del gasto', 'err');
  soltarFoco();
  guardarLocal('gasto', {
    id: uid(), fecha: S.fecha, concepto: g.concepto.trim(), monto, pagadoDesde: g.pagadoDesde,
    estado: 'ok', creadoPor: S.user.nombre, creadoEn: nowLocal()
  });
  S.gform = { concepto: '', monto: '', pagadoDesde: 'Efectivo' };
  toast('Gasto anotado'); renderTab();
}
function anularGasto(id) {
  if (bloqueado()) return;
  const g = S.gastos.find(x => x.id === id); if (!g) return;
  if (!confirm('¿Anular el gasto "' + g.concepto + '" de ' + fmt(g.monto) + '?')) return;
  guardarLocal('gasto', Object.assign({}, g, { estado: 'anulado', editadoPor: S.user.nombre, editadoEn: nowLocal() }));
  renderTab();
}
function ordenColores(cols) {
  const o = c => { const i = S.config.pulseras.indexOf(c); return i < 0 ? 99 : i; };
  return cols.slice().sort((a, b) => o(a) - o(b));
}
function textoPorColor(R) { return Object.keys(R.porColor).map(c => c + ' ' + R.porColor[c].cant).join(' · '); }
function cerrarCaja() {
  if (bloqueado()) return;
  const R = Calc.resumen(S.registros, S.gastos, S.config);
  if (!R.ventas) return toast('No hay ventas registradas este día', 'err');
  const contado = enteroDe(S.cform.efectivo), maquina = enteroDe(S.cform.debito);
  const activos = turnosActivos().length;
  let msg = '¿Cerrar la caja de ' + S.sede + ' del ' + fechaLarga(S.fecha) + '?\n\nTotal: ' + fmt(R.recaudado) + '\nNeto: ' + fmt(R.neto);
  if (contado == null) msg += '\n\nNo ingresaste el efectivo contado: el cierre queda sin cuadre.';
  else msg += '\nEfectivo contado: ' + fmt(contado) + ' (diferencia ' + fmt(contado - R.efectivoEsperado) + ')';
  if (activos) msg += '\n\nOjo: todavía hay ' + activos + ' grupo(s) en el agua.';
  msg += '\n\nDespués de cerrar no se pueden agregar ni cambiar ventas de este día.';
  if (!confirm(msg)) return;
  const st = stockHoy();
  guardarLocal('cierre', Object.assign({}, S.cierre || {}, {
    fecha: S.fecha, estado: 'cerrada', cerradoPor: S.user.nombre, cerradoEn: nowLocal(),
    totalBruto: R.bruto, devoluciones: R.devol, gastos: R.totalGastos, neto: R.neto,
    efectivoCaja: R.efectivoEsperado, debitoPendiente: 0,
    efectivo: R.efectivo, debito: R.debito, transferencias: R.transferencia ? fmt(R.transferencia) : '',
    ventaEntradas: R.ventaEntradas, ventaProductos: R.ventaProductos, personas: R.pulseras,
    productosVendidos: Object.keys(R.porProducto).map(k => R.porProducto[k].nombre + ' ×' + R.porProducto[k].cant).join(', '),
    pulserasEntregadas: textoPorColor(R),
    stockFinal: idsInventario().filter(id => st[id] && st[id].queda != null).map(id => nombreItem(id) + ': ' + st[id].queda).join(' · '),
    reparto: R.porSocio != null ? 'Neto ÷ ' + R.socios + ' socios = ' + fmt(R.porSocio) : '',
    efectivoContado: contado == null ? '' : contado, debitoMaquina: maquina == null ? '' : maquina,
    difEfectivo: contado == null ? '' : contado - R.efectivoEsperado, difDebito: maquina == null ? '' : maquina - R.debito,
    detalle: JSON.stringify({ porMedio: R.porMedio, porEntrada: R.porEntrada, porColor: R.porColor, porProducto: R.porProducto })
  }));
  toast(DEMO ? 'Caja cerrada' : 'Caja cerrada. El archivo del día se está guardando en Drive.', 'ok');
  S.editId = null; S.venta = nuevaVenta();
  renderTab();
}
function reabrirCaja() {
  if (!esAdmin()) return toast('Solo un administrador puede reabrir la caja', 'err');
  if (!confirm('¿Reabrir la caja de ' + S.sede + ' del ' + fechaLarga(S.fecha) + '?\nQuedará registrado que la reabriste. Después hay que volver a cerrarla.')) return;
  guardarLocal('cierre', Object.assign({}, S.cierre, { estado: 'reabierta', reabiertoPor: S.user.nombre, reabiertoEn: nowLocal() }));
  S.cform = { efectivo: S.cierre.efectivoContado === '' ? '' : String(S.cierre.efectivoContado || ''), debito: S.cierre.debitoMaquina === '' ? '' : String(S.cierre.debitoMaquina || '') };
  toast('Caja reabierta', 'ok'); renderTab();
}
function textoResumen() {
  const R = Calc.resumen(S.registros, S.gastos, S.config);
  const st = stockHoy();
  const L = [];
  L.push('🌊 ' + S.sede + ' — ' + fechaLarga(S.fecha));
  L.push('Ventas: ' + R.ventas + ' · Pulseras: ' + R.pulseras + (R.gratis ? ' (' + R.gratis + ' gratis)' : ''));
  Object.keys(R.porEntrada).forEach(k => { const e = R.porEntrada[k]; L.push(e.nombre + ': ' + e.cant + (e.gratis ? '' : ' (' + fmt(e.monto) + ')')); });
  Object.keys(R.porProducto).forEach(k => L.push(R.porProducto[k].nombre + ': ' + R.porProducto[k].cant + ' (' + fmt(R.porProducto[k].monto) + ')'));
  L.push('');
  L.push('Efectivo: ' + fmt(R.efectivo));
  L.push('Débito: ' + fmt(R.debito));
  if (R.transferencia) L.push('Transferencia: ' + fmt(R.transferencia));
  if (R.devol) L.push('Devoluciones: −' + fmt(R.devol));
  L.push('TOTAL: ' + fmt(R.recaudado));
  if (R.totalGastos) L.push('Gastos: −' + fmt(R.totalGastos) + ' (' + R.listaGastos.map(g => g.concepto).join(', ') + ')');
  L.push('Neto: ' + fmt(R.neto));
  if (R.porSocio != null) L.push('Neto ÷ ' + R.socios + ' socios: ' + fmt(R.porSocio));
  L.push('Efectivo que debe haber en caja: ' + fmt(R.efectivoEsperado));
  if (S.cierre && S.cierre.efectivoContado !== '' && S.cierre.efectivoContado != null && diaCerrado())
    L.push('Efectivo contado: ' + fmt(S.cierre.efectivoContado) + ' (diferencia ' + fmt(S.cierre.difEfectivo) + ')');
  const pul = Object.keys(R.porColor).map(c => c + ' ' + R.porColor[c].cant + (st['pulsera:' + c] && st['pulsera:' + c].queda != null ? ' (quedan ' + st['pulsera:' + c].queda + ')' : ''));
  if (pul.length) { L.push(''); L.push('Pulseras: ' + pul.join(' · ')); }
  return L.join('\n');
}
async function compartir() {
  const txt = textoResumen();
  try {
    if (navigator.share) { await navigator.share({ text: txt }); return; }
    await navigator.clipboard.writeText(txt); toast('Resumen copiado, pégalo en WhatsApp', 'ok');
  } catch (e) { /* cancelado */ }
}

/* ---------- reportes (administradores) ---------- */
function rangoRapido(k) {
  const h = hoy();
  if (k === 'hoy') return [h, h];
  if (k === 'ayer') { const a = fechaMas(-1); return [a, a]; }
  if (k === '7') return [fechaMas(-6), h];
  if (k === 'mes') return [h.slice(0, 8) + '01', h];
  return [fechaMas(-29), h];
}
function nuevoReporte() { const r = rangoRapido('7'); return { sede: '*', desde: r[0], hasta: r[1], rapido: '7', datos: null, cargando: false, error: '' }; }
function reporteLocal(desde, hasta, sedePed) {
  const lista = sedePed === '*' ? S.sedes : S.sedes.filter(s => mismaSede(s, sedePed));
  const porSede = [], todosR = [], todosG = [], cierres = [];
  lista.forEach(s => {
    const regs = [], gas = [], cie = [];
    diasGuardados(s).filter(f => f >= desde && f <= hasta).forEach(f => {
      const d = LS.get(dayKey(f, s), {}) || {};
      (d.registros || []).forEach(r => regs.push(r));
      (d.gastos || []).forEach(g => gas.push(g));
      if (d.cierre) cie.push(Object.assign({ fecha: f, sede: s }, d.cierre));
    });
    const r = Calc.resumen(regs, gas, {});
    delete r.listaGastos;
    r.sede = s;
    r.dias = new Set(regs.map(x => x.fecha)).size;
    r.cerrados = cie.filter(c => c.estado !== 'reabierta' && c.cerradoEn).length;
    r.difEfectivo = cie.filter(c => c.difEfectivo !== '' && c.difEfectivo != null).reduce((a, c) => a + (+c.difEfectivo || 0), 0);
    porSede.push(r);
    regs.forEach(x => todosR.push(x)); gas.forEach(x => todosG.push(x));
    cie.forEach(c => cierres.push(c));
  });
  const total = Calc.resumen(todosR, todosG, {});
  delete total.listaGastos;
  total.difEfectivo = porSede.reduce((a, r) => a + r.difEfectivo, 0);
  cierres.sort((a, b) => (a.fecha + a.sede) < (b.fecha + b.sede) ? 1 : -1);
  return { desde, hasta, sede: sedePed, porSede, total, cierres };
}
async function verReporte() {
  const r = S.rep;
  if (r.desde > r.hasta) return toast('La fecha "desde" es posterior a "hasta"', 'err');
  r.cargando = true; r.error = ''; renderTab();
  try {
    r.datos = DEMO ? reporteLocal(r.desde, r.hasta, r.sede) : await api('reporte', { desde: r.desde, hasta: r.hasta, sede: r.sede }, 60000);
  } catch (e) { r.error = e.message; }
  r.cargando = false; renderTab();
}

/* ---------- días inventados para el modo de prueba ---------- */
function borrarPrueba() {
  try {
    const ks = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('pademo_') === 0) ks.push(k); }
    ks.forEach(k => localStorage.removeItem(k));
  } catch (e) { }
}
function sembrarPrueba(soloEscena) {
  let semilla = 11;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };
  const elegir = a => a[Math.floor(azar() * a.length)];
  const ahora = minutosDe(ahoraHM());
  SEDES_DEF.forEach((sede, si) => {
    const cfg = normalizarConfig(configPrueba(sede), sede);
    S.config = cfg;   // los colores de ½ hora se calculan con la configuración del lugar
    const E = id => cfg.entradas.find(e => e.id === id);
    const P = id => cfg.productos.find(p => p.id === id);
    const usuarios = USUARIOS_PRUEBA.filter(u => !u.sede || mismaSede(u.sede, sede)).map(u => u.nombre);
    const escala = si === 0 ? 1 : 0.6;
    let n = 0, num = 0;
    const venta = (fecha, minuto, o) => {
      o = o || {};
      const lineas = [];
      const add = (id, cant) => { const e = E(id); if (e && cant > 0) lineas.push({ id, nombre: e.nombre, cant, precio: e.precio, minutos: e.minutos, color: e.color, rot: e.rot, gratis: e.gratis }); };
      if (o.lineas) o.lineas.forEach(x => add(x[0], x[1]));
      else {
        const r = azar();
        if (r < .62) add('media', 2 + Math.floor(azar() * 4));
        else if (r < .8) add('hora', 1 + Math.floor(azar() * 4));
        else if (r < .87) add('full', 1 + Math.floor(azar() * 2));
        if (azar() < .3) add(elegir(['sacachucha', 'banano', 'extreme', 'arrastre']), 1 + Math.floor(azar() * 3));
        if (azar() < .08) add('freepass', 1);
        if (azar() < .04) add('cortesia', 1);
        if (!lineas.length) add('media', 2);
      }
      const productos = [];
      const cal = o.calcetas != null ? o.calcetas : (azar() < .5 ? 1 + Math.floor(azar() * 3) : 0);
      if (cal) productos.push({ id: 'calcetas', nombre: P('calcetas').nombre, cant: cal, precio: P('calcetas').precio });
      if (o.bolsa || (o.bolsa == null && azar() < .25)) productos.push({ id: 'bolsa_telefono', nombre: P('bolsa_telefono').nombre, cant: 1, precio: P('bolsa_telefono').precio });
      const entrada = hmDe(minuto);
      const timed = lineas.filter(l => l.minutos > 0).map(l => sumarMin(entrada, l.minutos)).sort();
      const quien = o.quien || elegir(usuarios);
      const rec = {
        id: uid() + (++n), fecha, sede, nombre: o.nombre || 'Venta ' + (++num), entrada, salida: timed.length ? timed[timed.length - 1] : '',
        lineas, productos, personas: lineas.reduce((s, l) => s + l.cant, 0), pulsera: '', minutos: 0, precioPersona: 0,
        calcetas: cal, precioCalceta: cal ? P('calcetas').precio : 0,
        medio: o.medio || (azar() < .6 ? 'Efectivo' : 'Débito'), cuenta: '', obs: o.obs || '',
        devolucion: o.devolucion || 0, devolucionDesde: o.devolucion ? 'Efectivo' : '', estado: o.estado || 'ok',
        creadoPor: quien, creadoEn: fecha + ' ' + hmDe(minuto - 3) + ':00', demoVivo: !!o.vivo
      };
      if (o.estado === 'anulado') { rec.editadoPor = elegir(usuarios); rec.editadoEn = fecha + ' ' + hmDe(minuto + 2) + ':00'; }
      rec.total = Calc.totalVenta(rec);
      return rec;
    };
    const mov = (fecha, minuto, id, tipo, cantidad, nota) => ({ id: uid() + 'm' + (++n), fecha, sede, producto: id, tipo, cantidad, nota: nota || '', estado: 'ok', creadoPor: usuarios[0], creadoEn: fecha + ' ' + hmDe(minuto) + ':00' });
    const gasto = (fecha, minuto, concepto, monto, desde) => ({ id: uid() + 'g' + (++n), fecha, sede, concepto, monto, pagadoDesde: desde || 'Efectivo', estado: 'ok', creadoPor: elegir(usuarios), creadoEn: fecha + ' ' + hmDe(minuto) + ':00' });
    const cerrar = (fecha, regs, gas, minuto, dif) => {
      const R = Calc.resumen(regs, gas, cfg);
      return { fecha, sede, estado: 'cerrada', cerradoPor: usuarios[usuarios.length - 1], cerradoEn: fecha + ' ' + hmDe(minuto) + ':00',
        neto: R.neto, totalBruto: R.bruto, efectivoCaja: R.efectivoEsperado,
        efectivoContado: R.efectivoEsperado + (dif || 0), difEfectivo: dif || 0, debitoMaquina: R.debito, difDebito: 0 };
    };
    const guardarDia = (fecha, d) => LS.set(dayKey(fecha, sede), Object.assign({ registros: [], gastos: [], inventario: [], cierre: null, stockPrevio: null }, d));
    const conDemo = r => { asignarColores(r); return r; };

    if (soloEscena) {
      const d = LS.get(dayKey(hoy(), sede), null);
      if (!d || (d.cierre && d.cierre.estado !== 'reabierta')) return;
      num = (d.registros || []).length;
      const viejos = (d.registros || []).filter(r => !r.demoVivo);
      d.registros = conDemo(viejos.concat(escenaHoy()));
      LS.set(dayKey(hoy(), sede), d);
      return;
    }
    function escenaHoy() {
      const f0 = hoy();
      return [
        venta(f0, Math.ceil((ahora - 28) / 5) * 5, { vivo: true, nombre: 'Grupo familiar', lineas: [['media', 3]], calcetas: 2, medio: 'Efectivo' }),
        venta(f0, Math.floor((ahora - 12) / 5) * 5, { vivo: true, nombre: 'Cumpleaños', lineas: [['hora', 6], ['sacachucha', 2]], calcetas: 0, bolsa: true, medio: 'Débito' }),
        venta(f0, Math.ceil((ahora + 1) / 5) * 5, { vivo: true, nombre: 'Grupo por entrar', lineas: [['media', 2], ['freepass', 1]], calcetas: 2, bolsa: false, medio: 'Efectivo' })
      ];
    }

    // Anteayer y ayer: días completos y cerrados (ayer con una diferencia de caja)
    const pulserasIniciales = cfg.pulseras.map(c => mov(fechaMas(-2), 10 * 60 + 40, 'pulsera:' + c, 'inicial', /flúor|fluor/i.test(c) ? 60 : (c === 'Dorada' || c === 'Plateada' ? 80 : 120), 'Conteo al abrir'));
    [-2, -1].forEach(dd => {
      const f = fechaMas(dd);
      num = 0;
      const regs = [];
      for (let m = 11 * 60; m <= 19 * 60; m += Math.round((22 + Math.floor(azar() * 25)) / escala)) regs.push(venta(f, Math.ceil(m / 5) * 5));
      regs.push(venta(f, 15 * 60 + 12, { nombre: 'Compra de calcetas', lineas: [], calcetas: 2, bolsa: false, medio: 'Efectivo' }));
      if (dd === -1) {
        regs.push(venta(f, 16 * 60, { nombre: 'Venta con devolución', lineas: [['hora', 3]], calcetas: 1, medio: 'Efectivo', devolucion: 10000, obs: 'Pagó 1 hora y al final se quedó ½ hora' }));
        regs.push(venta(f, 17 * 60 + 20, { nombre: 'Venta duplicada', lineas: [['media', 4]], estado: 'anulado', obs: 'Se registró dos veces' }));
      }
      conDemo(regs);
      const gas = dd === -2 ? [gasto(f, 14 * 60, 'Almuerzo (3)', 15000), gasto(f, 10 * 60 + 40, 'Bencina generador', 12000, 'Aparte')]
        : [gasto(f, 13 * 60 + 30, 'Almuerzo (2)', 10000), gasto(f, 12 * 60, 'Hielo', 3000)];
      const inv = dd === -2
        ? [mov(f, 10 * 60 + 45, 'calcetas', 'inicial', 60, 'Conteo al abrir'), mov(f, 10 * 60 + 46, 'bolsa_telefono', 'inicial', 30, 'Conteo al abrir')].concat(pulserasIniciales)
        : [mov(f, 12 * 60 + 30, 'calcetas', 'ingreso', 20, 'Llegó pedido'), mov(f, 19 * 60 + 30, 'calcetas', 'ajuste', -1, 'Conteo: faltó 1')];
      guardarDia(f, { registros: regs, gastos: gas, inventario: inv, cierre: cerrar(f, regs, gas, 19 * 60 + 50, dd === -1 ? -2000 : 0) });
    });

    // Hoy: algunas terminadas, dos grupos en el agua (uno a punto de salir, para ver la alerta) y uno por entrar
    const f0 = hoy();
    num = 0;
    const r0 = [];
    for (let m = Math.max(10 * 60 + 30, ahora - 200); m <= ahora - 45; m += Math.round((30 + Math.floor(azar() * 15)) / escala)) r0.push(venta(f0, Math.floor(m / 5) * 5));
    escenaHoy().forEach(v => r0.push(v));
    conDemo(r0);
    guardarDia(f0, { registros: r0, gastos: [gasto(f0, Math.max(ahora - 60, 10 * 60), 'Almuerzo (2)', 10000)], inventario: [] });
    // Los grupos que ya terminaron antes de abrir la prueba no hacen sonar la alerta
    const vistos = {};
    turnosDe(r0).forEach(t => { if (minutosDe(t.entrada) + t.minutos <= ahora) vistos[t.id + '@' + t.salida] = 1; });
    LS.set('pa_avisos_' + slug(sede) + '_' + f0, vistos);
  });
  if (!soloEscena) LS.set('pa_semilla', { v: 6, fecha: hoy() });
}

/* ---------- login ---------- */
async function cargarUsuarios() {
  if (DEMO) return;
  try { const r = await api('usuarios'); S.usuarios = r.usuarios || []; LS.set('pa_usuarios', S.usuarios); if (!S.user) render(); }
  catch (e) { const el = $('#lerr'); if (el) el.textContent = 'No se pudo conectar: ' + e.message; }
}
async function login() {
  const nombre = $('#lu').value, pin = $('#lp') ? $('#lp').value.trim() : '';
  const err = $('#lerr');
  if (!nombre) { err.textContent = 'Elige tu nombre'; return; }
  pedirPermisoNotif(); audioCtx();
  if (DEMO) {
    const u = USUARIOS_PRUEBA.find(x => x.nombre === nombre) || USUARIOS_PRUEBA[0];
    S.user = Object.assign({ pin: '' }, u);
    S.sedes = SEDES_DEF.slice();
  } else {
    if (!pin) { err.textContent = 'Escribe tu PIN'; return; }
    err.textContent = 'Entrando…';
    try {
      S.user = { nombre, pin };
      const r = await api('login', { sede: LS.get('pa_sede', null) });
      S.user = { nombre: r.usuario.nombre, pin, rol: r.usuario.rol, sede: r.usuario.sede || '' };
      if (Array.isArray(r.sedes) && r.sedes.length) { S.sedes = r.sedes; LS.set('pa_sedes', r.sedes); }
      S.sede = (r.config && r.config.sede) || sedeInicial();
      aplicarConfig(r.config);
    } catch (e) { S.user = null; err.textContent = e.message; return; }
  }
  LS.set('pa_user', S.user);
  if (!S.sede || DEMO) S.sede = sedeInicial();
  LS.set('pa_sede', S.sede);
  S.fecha = hoy();
  cargarConfig(); loadDay();
  S.venta = nuevaVenta(); S.tab = 'vender'; S.rep = nuevoReporte();
  const app = $('#app'); app.innerHTML = '';
  render(); sync(); revisarAlertas();
}
function logout() {
  const n = getQueue().length;
  if (n && !confirm('Hay ' + n + ' cambio(s) sin enviar a la planilla. Si sales ahora no se van a perder, pero se enviarán a nombre de quien entre después. ¿Salir igual?')) return;
  if (!n && !confirm('¿Cerrar sesión de ' + S.user.nombre + '?')) return;
  S.user = null; LS.del('pa_user'); cerrarAlerta(); render();
  if (!DEMO) cargarUsuarios();
}
function cambiarSede(s) {
  if (!esAdmin() || mismaSede(s, S.sede)) { S.sedeMenu = false; renderHeader(); return; }
  S.sede = s; LS.set('pa_sede', s); S.sedeMenu = false; S.editId = null;
  cargarConfig(); loadDay(); S.venta = nuevaVenta();
  S.alertas = []; renderAlerta();
  render(); sync(); revisarAlertas();
  const m = $('#main'); if (m && !REDUCE) { m.classList.remove('in-der', 'in-izq'); void m.offsetWidth; m.classList.add('in-der'); }
  toast('Ahora estás en ' + s);
}

/* =========================================================
   Vistas
   ========================================================= */
const ICON = {
  lock: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  efectivo: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></svg>',
  debito: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/></svg>',
  transferencia: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/></svg>',
  archivo: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  compartir: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'
};
const COLOR_MEDIO = { 'Efectivo': '#ffc93c', 'Débito': '#0aa2c0', 'Transferencia': '#6d5dfc' };

function tabsVisibles() {
  const t = [
    ['vender', 'Vender', '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2.2l2.4 11h11.2l2-8H6.3"/>'],
    ['grupos', 'En el agua', '<path d="M2 15c2 0 2-2 4.5-2S9 15 11.5 15 14 13 16.5 13 19 15 22 15"/><path d="M2 19c2 0 2-2 4.5-2S9 19 11.5 19 14 17 16.5 17 19 19 22 19"/><circle cx="12" cy="7" r="3"/>'],
    ['inventario', 'Inventario', '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>'],
    ['caja', 'Caja', '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>']
  ];
  if (esAdmin()) t.push(['reportes', 'Reportes', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>']);
  return t;
}
function aparecer(el) {
  if (REDUCE) return;
  el.classList.remove('fade'); void el.offsetWidth; el.classList.add('fade');
}
function render() {
  const app = $('#app');
  if (!S.user) { app.innerHTML = vistaLogin(); aparecer(app); return; }
  if (!$('#main')) {
    app.innerHTML = '<header id="hdr"></header><main id="main"></main><nav id="nav"></nav>';
    aparecer(app);
  }
  construirNav();
  renderHeader(); actualizarNav(); renderTab();
}
function vistaId() { return S.tab + '|' + S.sede + '|' + S.fecha + '|' + (S.tab === 'vender' ? (S.editId || 'nuevo') : '') + '|' + (diaCerrado() ? 'c' : 'a'); }
function renderTab() {
  const main = $('#main'); if (!main || !S.user) return;
  if (!S.venta) S.venta = nuevaVenta();
  if (!S.rep) S.rep = nuevoReporte();
  if (S.tab === 'reportes' && !esAdmin()) S.tab = 'vender';
  const vista = S.tab === 'vender' ? vistaVender() : S.tab === 'grupos' ? vistaGrupos() : S.tab === 'inventario' ? vistaInventario()
    : S.tab === 'caja' ? vistaCaja() : vistaReportes();
  const html = (S.tab === 'reportes' ? '' : bannerServidor() + bannerCerrado()) + vista;
  const id = vistaId();
  if (main.dataset.vista !== id) { main.innerHTML = html; main.dataset.vista = id; }
  else morph(main, html);
  animarConteos(main);
}
function irA(tab, preparar) {
  const ts = tabsVisibles().map(x => x[0]);
  const dir = ts.indexOf(tab) >= ts.indexOf(S.tab) ? 'der' : 'izq';
  if (preparar) preparar();
  S.tab = tab;
  actualizarNav(); renderTab();
  window.scrollTo({ top: 0, behavior: 'instant' });
  const m = $('#main');
  if (m && !REDUCE) { m.classList.remove('in-der', 'in-izq'); void m.offsetWidth; m.classList.add('in-' + dir); }
}

function iconoOla(s) { return `<img src="icon.svg" width="${s}" height="${s}" alt="" class="logo-img">`; }
const inicial = n => esc(String(n || '?').trim().charAt(0).toUpperCase());

function linkArchivo(cls) {
  const a = S.cierre && S.cierre.archivo;
  if (a && /^https?:/.test(a)) return `<a class="${cls || 'btn'}" href="${esc(a)}" target="_blank" rel="noopener">${ICON.archivo}<span>Abrir archivo del día</span></a>`;
  return '';
}
function bannerCerrado() {
  if (!diaCerrado()) return '';
  return `<div class="cerrado" data-key="cerrado">
    <span class="cerrado-ic">${ICON.lock}</span>
    <div><b>Caja cerrada</b><small>La cerró ${esc(S.cierre.cerradoPor || '')} a las ${esc(horaDe(S.cierre.cerradoEn))}. Este día ya no acepta cambios.</small></div>
    ${linkArchivo('cerrado-link')}
  </div>`;
}
function bannerServidor() {
  if (!S.servidorViejo) return '';
  return `<div class="cerrado alerta-srv" data-key="srv">
    <span class="cerrado-ic">!</span>
    <div><b>Falta actualizar la planilla</b><small>Esta versión de la app necesita el Apps Script nuevo (Codigo.gs). Hasta que se actualice no se pueden registrar ventas, para no perder datos.</small></div>
  </div>`;
}

function vistaLogin() {
  const lista = DEMO ? USUARIOS_PRUEBA.map(u => u.nombre) : S.usuarios;
  const ops = lista.map(n => '<option>' + esc(n) + '</option>').join('');
  return `<div class="login">
    <div class="login-ola">
      <div class="logo">${iconoOla(76)}</div>
      <h1>Parque Acuático</h1>
      <p>Caja del día</p>
    </div>
    <div class="login-form">
      ${PRUEBA ? `<p class="info"><b>Versión de prueba.</b> Trae tres lugares con días inventados: anteayer y ayer cerrados, y hoy con grupos en el agua. Nada de esto llega a la caja real.<br><br>
        <b>Usuario 1</b> es administrador: ve los tres lugares y los reportes. <b>Usuario 2</b> trabaja en Licán Ray y <b>Usuario 3</b> en Pucón: solo ven su lugar.</p>`
        : DEMO ? '<p class="info">Modo de prueba: lo que registres queda solo en este teléfono.</p>' : ''}
      <label class="lbl" for="lu">¿Quién eres?</label>
      <select id="lu" class="inp">${ops ? '<option value="">Elige tu nombre</option>' + ops : '<option value="">Cargando usuarios…</option>'}</select>
      ${DEMO ? '' : '<label class="lbl" for="lp">PIN</label><input id="lp" class="inp" type="password" inputmode="numeric" autocomplete="off" maxlength="8">'}
      <button class="btn coral big" data-act="login">Entrar</button>
      <p id="lerr" class="err"></p>
    </div>
  </div>`;
}

function tiraDias() {
  const CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dias = [];
  for (let i = 6; i >= 0; i--) dias.push({ f: fechaMas(-i), i });
  const fuera = !dias.some(d => d.f === S.fecha);
  const cerradoEn = f => { const d = LS.get(dayKey(f), null); return !!(d && d.cierre && d.cierre.estado !== 'reabierta' && d.cierre.cerradoEn); };
  const fd = new Date(S.fecha + 'T12:00:00');
  return `<div class="dias" role="group" aria-label="Elegir día">
    ${dias.map(d => {
      const dt = new Date(d.f + 'T12:00:00');
      const etiqueta = d.i === 0 ? 'Hoy' : d.i === 1 ? 'Ayer' : CORTO[dt.getDay()];
      return `<button class="dia ${d.f === S.fecha ? 'on' : ''}" data-act="dia" data-v="${d.f}" aria-pressed="${d.f === S.fecha}">
        <small>${etiqueta}</small><b>${dt.getDate()}</b>${cerradoEn(d.f) ? '<i class="d-lock" title="Caja cerrada"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></i>' : ''}</button>`;
    }).join('')}
    <button type="button" class="dia cal ${fuera ? 'on' : ''}" data-act="calendario" title="Elegir otra fecha">
      <input type="date" id="fecha" value="${S.fecha}" max="${hoy()}" tabindex="-1" aria-hidden="true">
      <small>${fuera ? CORTO[fd.getDay()] + ' ' + fd.getDate() : 'Otro'}</small>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>
    </button>
  </div>`;
}
function cambiarDia(f) {
  if (!f || f === S.fecha) return;
  const dir = f > S.fecha ? 'der' : 'izq';
  S.fecha = f; S.editId = null; loadDay(); S.venta = nuevaVenta();
  render(); sync();
  const m = $('#main');
  if (m && !REDUCE) { m.classList.remove('in-der', 'in-izq'); void m.offsetWidth; m.classList.add('in-' + dir); }
}

function renderHeader() {
  const h = $('#hdr'); if (!h || !S.user) return;
  const n = getQueue().length;
  const st = {
    demo: ['demo', PRUEBA ? 'Prueba' : 'Sin planilla'], idle: ['pend', 'Conectando'], sync: ['sync', 'Guardando…'],
    ok: ['ok', 'Guardado'], pending: ['pend', n + ' por guardar'],
    offline: ['off', 'Sin señal' + (n ? ', ' + n + ' por guardar' : '')],
    error: ['err', 'No se pudo guardar']
  }[S.syncState] || ['pend', ''];
  const admin = esAdmin();
  morph(h, `<div class="hdr-in">
      <div class="hdr-top">
        <div class="brand">${iconoOla(30)}<span>Parque Acuático</span></div>
        <button class="user" data-act="logout" title="Cerrar sesión"><span class="avatar">${inicial(S.user.nombre)}</span><span>${esc(S.user.nombre)}</span></button>
      </div>
      <div class="sede-fila">
        ${admin ? `<button class="sede-pill ${S.sedeMenu ? 'abierto' : ''}" data-act="sede-menu" aria-expanded="${S.sedeMenu}">${ICON.pin}<span>${esc(S.sede)}</span><i>▾</i></button>`
          : `<span class="sede-pill fija">${ICON.pin}<span>${esc(S.sede)}</span></span>`}
        <button class="sync s-${st[0]}" data-act="sync" title="${esc(S.syncError || '')}">${esc(st[1])}</button>
      </div>
      ${admin && S.sedeMenu ? `<div class="sede-menu" data-key="sede-menu">${S.sedes.map(s => `<button class="chip ${mismaSede(s, S.sede) ? 'on' : ''}" data-act="sede" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
      <div class="f-titulo"><span class="f-dia">${esc(fechaLarga(S.fecha))}</span></div>
      ${tiraDias()}
      ${S.fecha !== hoy() ? '<button class="volver-hoy" data-act="ir-hoy">Volver a hoy</button>' : ''}
    </div>
    <svg class="ola" viewBox="0 0 400 28" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0H400V12C350 28 300 28 250 16S150 0 100 10 30 24 0 16Z"/></svg>`);
}

function construirNav() {
  const nav = $('#nav'); if (!nav) return;
  const t = tabsVisibles();
  const firma = t.map(x => x[0]).join(',');
  if (nav.dataset.firma === firma) return;
  nav.dataset.firma = firma;
  nav.style.setProperty('--n', t.length);
  nav.innerHTML = '<span class="ind"></span>' + t.map(x => `<button data-act="tab" data-v="${x[0]}"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${x[2]}</svg><span>${x[1]}</span></button>`).join('');
}
function actualizarNav() {
  const nav = $('#nav'); if (!nav) return;
  const ts = tabsVisibles().map(x => x[0]);
  nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === S.tab));
  const ind = nav.querySelector('.ind'); if (ind) ind.style.transform = 'translateX(' + (Math.max(0, ts.indexOf(S.tab)) * 100) + '%)';
}

function chips(field, opciones, valor, extra) {
  return `<div class="chips">${opciones.map(o => {
    const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
    return `<button type="button" class="chip ${String(valor) === String(v) ? 'on' : ''}" data-act="${extra || 'set'}" data-f="${field}" data-v="${esc(v)}">${l}</button>`;
  }).join('')}</div>`;
}
function stepper(act, field, valor, min) {
  return `<div class="stepper"><button type="button" data-act="${act}" data-f="${esc(field)}" data-v="-1" ${valor <= min ? 'disabled' : ''} aria-label="Quitar uno">−</button><b data-count="${valor}" data-t="n">${valor}</b><button type="button" data-act="${act}" data-f="${esc(field)}" data-v="1" aria-label="Agregar uno">+</button></div>`;
}
function pulseraVis(color) { return `<span class="pulsera-vis" style="--c:${colorHex(color)}" aria-hidden="true"></span>`; }
function seccion(titulo, cuerpo, key, extra) {
  return `<section class="paso ${extra || ''}" data-key="${key}"><h2 class="paso-h">${titulo}</h2>${cuerpo}</section>`;
}

/* ---------- Vender ---------- */
function vistaVender() {
  if (diaCerrado()) {
    return `<section class="vacio-card" data-key="reg-cerrado">
      <div class="vacio-ic">${ICON.lock}</div>
      <h2>Este día ya no acepta ventas</h2>
      <p>La caja de ${esc(S.sede)} ya se cerró. ${S.fecha !== hoy() ? 'Para vender, vuelve al día de hoy.' : 'Si hay que corregir algo, un administrador puede reabrirla desde la pestaña Caja.'}</p>
      ${S.fecha !== hoy() ? '<button class="btn coral" data-act="ir-hoy">Ir a hoy</button>' : '<button class="btn" data-act="tab" data-v="caja">Ver la caja</button>'}
    </section>`;
  }
  const f = S.venta, c = S.config;
  const prev = S.editId ? S.registros.find(r => r.id === S.editId) : null;
  const lineas = lineasDelCarrito(), prods = productosDelCarrito();
  const total = totalCarrito();
  const colRot = colorRotActual();
  const st = stockHoy();
  const entrada = horaVenta();
  const otroDia = S.fecha !== hoy() && !prev;
  const dev = enteroDe(f.devolucion) || 0;
  const conTiempo = lineas.filter(l => l.minutos > 0);
  const hayRot = lineas.some(l => l.rot);

  const tile = e => {
    const n = +f.ents[e.id] || 0;
    const sinPrecio = !e.gratis && !(e.precio > 0);
    const color = e.rot ? colRot : e.color;
    const s = st['pulsera:' + color];
    const tipo = e.minutos > 0 ? e.minutos + ' min' : e.id === 'full' ? 'Todo el día' : 'Juego';
    return `<div class="ent ${n ? 'on' : ''} ${sinPrecio ? 'off' : ''}" data-key="e-${esc(e.id)}">
      <button type="button" class="ent-main" data-act="ent" data-v="${esc(e.id)}" ${sinPrecio ? 'disabled' : ''}>
        ${pulseraVis(color)}
        <b>${esc(e.nombre)}</b>
        <span class="ent-precio">${sinPrecio ? 'Falta precio' : e.gratis ? 'Gratis' : fmt(e.precio)}</span>
        <small>${esc(tipo)} · ${esc(String(color).toLowerCase())}${s && s.queda != null && s.queda <= 10 ? ` · <em>quedan ${s.queda}</em>` : ''}</small>
      </button>
      ${n ? `<span class="ent-n" data-count="${n}" data-t="n">${n}</span><button type="button" class="ent-menos" data-act="ent-" data-v="${esc(e.id)}" aria-label="Quitar uno">−</button>` : ''}
    </div>`;
  };

  const prodFila = p => {
    const n = +f.prods[p.id] || 0;
    const s = st[p.id];
    const orig = f.orig ? (f.orig.productos.find(x => x.id === p.id) || { cant: 0 }).cant : 0;
    let q = '<small class="stock">Sin conteo de stock</small>';
    if (s && s.queda != null) {
      const queda = s.queda - (n - orig);
      q = `<small class="stock ${queda < 0 ? 'neg' : queda <= p.aviso_bajo ? 'bajo' : ''}">${queda < 0 ? 'Faltan ' + (-queda) : 'Quedan ' + queda}</small>`;
    }
    return `<div class="prod-row ${n ? 'con' : ''}" data-key="pi-${esc(p.id)}"><div class="prod-txt"><b>${esc(p.nombre)}</b><span>${fmt(p.precio)}</span>${q}</div>${stepper('pstep', p.id, n, 0)}</div>`;
  };

  const cruzan = hayRot ? rotativosQueCruzan(entrada, S.registros, S.editId).filter(t => t.entrada !== entrada) : [];

  return `${prev ? `<div class="editando" data-key="editando"><div><b>Editando ${esc(prev.nombre)}</b><small>La registró ${esc(prev.creadoPor || '?')} a las ${esc(horaDe(prev.creadoEn))}</small></div><button class="btn sm" data-act="cancelar">Cancelar</button></div>` : ''}
  ${otroDia ? `<p class="aviso-dia" data-key="otro-dia">Estás vendiendo en el ${esc(fechaLarga(S.fecha))}, no hoy.</p>` : ''}
  ${seccion('Entradas y juegos', `<div class="ents">${c.entradas.map(tile).join('')}</div>
    ${c.entradas.some(e => !e.gratis && !(e.precio > 0)) ? '<p class="ayuda">Los que dicen "Falta precio" se activan cuando se ponga su valor en la pestaña Entradas de la planilla.</p>' : ''}`, 's-ents')}
  ${c.productos.length ? seccion('Productos', `<div class="prods">${c.productos.map(prodFila).join('')}</div>`, 's-prods') : ''}
  ${seccion('Venta actual', `
    ${!lineas.length && !prods.length ? '<p class="muted carrito-vacio" data-key="vacio">Toca una entrada, un juego o un producto para agregarlo.</p>' : `<div class="carrito">
      ${lineas.map(l => `<div class="c-linea" data-key="cl-${esc(l.id)}"><i style="background:${colorHex(l.color)}"></i><span><b>${l.cant} × ${esc(l.nombre)}</b><small>Pulsera ${esc(String(l.color).toLowerCase())}${l.minutos ? ', sale ' + sumarMin(entrada, l.minutos) : ''}</small></span><b>${l.gratis ? 'Gratis' : fmt(l.cant * l.precio)}</b></div>`).join('')}
      ${prods.map(p => `<div class="c-linea" data-key="cp-${esc(p.id)}"><i class="prod"></i><span><b>${p.cant} × ${esc(p.nombre)}</b></span><b>${fmt(p.cant * p.precio)}</b></div>`).join('')}
    </div>`}
    ${conTiempo.length ? `<div class="horario" data-key="horario">
      <span>Entran a las</span>
      <input id="f-entrada" class="hora" type="time" step="300" data-field="entrada" value="${esc(entrada)}" aria-label="Hora de entrada">
      ${entradaAutoActiva() ? `<small class="muted">Son las ${ahoraHM()}; el turno parte a los 5 minutos siguientes.</small>` : ''}
    </div>` : ''}
    ${hayRot ? `<div class="sub" data-key="pulseras">
      <p class="sub-t">Color de pulsera del turno${f.colorManual ? ' (elegido a mano)' : ''}</p>
      <div class="colores-media">${c.colores_media.map(col => {
        const ocupado = cruzan.find(t => t.color === col);
        return `<button type="button" class="col-chip ${col === colRot ? 'on' : ''} ${ocupado ? 'ocupado' : ''}" data-act="pulsera" data-v="${esc(col)}"><i style="background:${colorHex(col)}"></i><span>${esc(col)}</span>${ocupado ? `<small>sale ${esc(ocupado.salida)}</small>` : ''}</button>`;
      }).join('')}</div>
    </div>` : ''}
    <label class="lbl" for="f-nombre">Nombre o referencia <span class="muted">(opcional)</span></label>
    <input id="f-nombre" class="inp" data-field="nombre" value="${esc(f.nombre)}" placeholder="Ej: familia del quitasol azul" autocomplete="off" autocapitalize="sentences" enterkeyhint="done">
    <p class="sub-t">Medio de pago</p>
    <div class="tiles medios" style="--n:${c.medios_pago.length}">${c.medios_pago.map(m => `<button type="button" class="tile pago ${f.medio === m ? 'on' : ''}" data-act="set" data-f="medio" data-v="${esc(m)}">${ICON[sinTildes(m)] || ICON.efectivo}<b>${esc(m)}</b></button>`).join('')}</div>
    <label class="lbl" for="f-obs">Observaciones</label>
    <input id="f-obs" class="inp" data-field="obs" value="${esc(f.obs)}" placeholder="Opcional" autocomplete="off">
    ${prev ? `<div class="devol">
      <label class="lbl" for="f-dev">Devolución al cliente (en efectivo)</label>
      <input id="f-dev" class="inp" data-field="devolucion" inputmode="numeric" value="${esc(f.devolucion)}" placeholder="$0">
    </div>` : ''}`, 's-venta')}
  ${prev ? `<button class="btn quitar" data-act="${prev.estado === 'anulado' ? 'restaurar' : 'anular'}" data-v="${prev.id}">${prev.estado === 'anulado' ? 'Restaurar esta venta' : 'Anular esta venta'}</button>` : ''}
  <div class="accion" data-key="accion">
    <div class="acc-total"><small>${lineas.length ? esc(plural(lineas.reduce((s, l) => s + l.cant, 0), 'pulsera', 'pulseras')) : prods.length ? 'Solo productos' : 'Carrito vacío'}${prev && dev ? ' · devolución ' + fmt(dev) : ''}</small><b>${cnt(total)}</b></div>
    <button class="btn coral" data-act="guardar" ${S.servidorViejo ? 'disabled' : ''}>${prev ? 'Guardar' : lineas.length ? 'Cobrar y entregar' : 'Cobrar'}</button>
  </div>`;
}

/* ---------- En el agua ---------- */
function anillo(e, color) {
  const C = 2 * Math.PI * 22;
  const resto = e.pct == null ? 0 : Math.max(0, 100 - e.pct);
  const off = C * (1 - resto / 100);
  return `<div class="anillo ${e.cls}" style="--c:${colorHex(color)}">
    <svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="22" class="a-fondo"/><circle cx="26" cy="26" r="22" class="a-arco" style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"/></svg>
    <span><b>${esc(e.corto)}</b><small>${e.cls === 'prox' ? 'entran' : 'min'}</small></span>
  </div>`;
}
function tarjetaTurno(t) {
  const e = estadoTurno(t);
  return `<article class="g g-vivo ${e.cls}" data-key="t-${t.id}" data-act="edit" data-v="${t.v.id}">
    ${anillo(e, t.color)}
    <div class="g-info"><b class="g-nom">Pulsera ${esc(String(t.color).toLowerCase())}</b>
      <div class="tags"><span class="tag pul" style="--c:${colorHex(t.color)}"><i></i>${esc(t.l.nombre)}</span><span class="tag">${plural(t.cant, 'pulsera', 'pulseras')}</span></div>
      <small>${esc(t.nombre)} · ${esc(e.txt)}</small></div>
  </article>`;
}
function filaVenta(x) {
  const ls = Calc.lineasDe(x), ps = Calc.productosDe(x);
  const partes = ls.map(l => l.cant + ' ' + l.nombre).concat(ps.map(p => p.nombre + ' ×' + p.cant));
  const quien = 'Registró ' + (x.creadoPor || '?') + ' ' + horaDe(x.creadoEn) +
    (x.editadoPor ? (x.estado === 'anulado' ? ', anuló ' : ', editó ') + x.editadoPor + ' ' + horaDe(x.editadoEn) : '');
  return `<article class="g g-fila ${x.estado === 'anulado' ? 'anulado' : ''}" data-key="v-${x.id}" data-act="edit" data-v="${x.id}">
    <span class="pul-dots">${ls.filter(l => l.color).map(l => `<i style="--c:${colorHex(l.color)}"></i>`).join('') || '<i style="--c:var(--line)"></i>'}</span>
    <div class="g-info"><b class="g-nom">${esc(x.nombre)} <span class="muted">${esc(x.entrada)}</span></b><small>${esc(partes.join(', '))}</small>
      ${+x.devolucion ? `<small class="g-dev">Devolución de ${fmt(x.devolucion)}</small>` : ''}
      ${x.obs ? `<small class="g-obs">${esc(x.obs)}</small>` : ''}
      <small class="g-quien">${esc(quien)}</small></div>
    <div class="g-monto"><b>${fmt(x.total)}</b><small>${esc(x.medio)}</small></div>
  </article>`;
}
function bloque(titulo, n, html, key) {
  if (!n) return '';
  return `<section class="bloque" data-key="${key}"><h2 class="bloque-h">${titulo}<span class="cuenta">${n}</span></h2>${html}</section>`;
}
function vistaGrupos() {
  const R = Calc.resumen(S.registros, S.gastos, S.config);
  const ventas = S.registros.slice().sort((a, b) => minutosDe(b.entrada) - minutosDe(a.entrada));
  const esHoy = S.fecha === hoy();
  const probar = PRUEBA && esHoy && !diaCerrado() ? `<section class="prueba-pie" data-key="probar-alerta">
      <p><b>¿Quieres ver la alerta?</b> Crea un grupo que termina en 1 minuto. Deja la app abierta y con volumen.</p>
      <button class="btn coral" data-act="probar-alerta">Probar la alerta</button>
    </section>` : '';
  if (!ventas.length) {
    return `${probar}<section class="vacio-card" data-key="vacio">
      <div class="vacio-ic">${iconoOla(48)}</div>
      <h2>Todavía no hay ventas</h2>
      <p>Las ventas de ${esc(S.sede)} del ${esc(fechaLarga(S.fecha).toLowerCase())} aparecen aquí, con el tiempo que le queda a cada pulsera.</p>
      ${diaCerrado() ? '' : '<button class="btn coral" data-act="tab" data-v="vender">Hacer la primera venta</button>'}
    </section>`;
  }
  const turnos = turnosDe(S.registros);
  const agua = [], prox = [];
  if (esHoy) turnos.forEach(t => { const e = estadoTurno(t); if (e.cls === 'activo' || e.cls === 'pronto') agua.push(t); else if (e.cls === 'prox') prox.push(t); });
  agua.sort((a, b) => segSal(a) - segSal(b));
  const enAgua = agua.reduce((s, t) => s + t.cant, 0);
  const vivas = ventas.filter(v => v.estado !== 'anulado'), anuladas = ventas.filter(v => v.estado === 'anulado');
  return `${probar}<section class="cifras" data-key="cifras">
      ${esHoy ? `<div class="c-agua"><b>${cnt(enAgua, 'n')}</b><small>${enAgua === 1 ? 'persona' : 'personas'} en el agua</small></div>` : ''}
      <div><b>${cnt(R.ventas, 'n')}</b><small>${R.ventas === 1 ? 'venta' : 'ventas'} · ${plural(R.pulseras, 'pulsera', 'pulseras')}</small></div>
      <div><b>${cnt(R.recaudado)}</b><small>recaudado</small></div>
    </section>
    ${bloque('En el agua', agua.length, agua.map(tarjetaTurno).join(''), 'b-agua')}
    ${bloque('Por entrar', prox.length, prox.map(tarjetaTurno).join(''), 'b-prox')}
    ${bloque('Ventas del día', vivas.length, vivas.map(filaVenta).join(''), 'b-ventas')}
    ${bloque('Anuladas', anuladas.length, anuladas.map(filaVenta).join(''), 'b-anul')}`;
}

/* ---------- Inventario ---------- */
function vistaInventario() {
  const st = stockHoy();
  const f = S.iform;
  const cerrado = diaCerrado();
  const items = idsInventario();
  if (!f.producto || items.indexOf(f.producto) < 0) f.producto = items[0] || '';
  const tipo = TIPOS_MOV.find(t => t[0] === f.tipo) || TIPOS_MOV[0];
  const movs = S.inventario.slice().reverse();
  const R = Calc.resumen(S.registros, S.gastos, S.config);
  const fuenteTxt = { conteo: 'contado hoy', anterior: 'quedó de antes', sin: '' };
  const tipoTxt = { inicial: 'Stock al abrir', ingreso: 'Llegó mercadería', ajuste: 'Corrección por conteo' };

  const prodCard = p => {
    const s = st[p.id];
    const conocido = s.queda != null;
    const cls = !conocido ? 'sin' : s.queda < 0 ? 'neg' : s.queda <= p.aviso_bajo ? 'bajo' : 'ok';
    const base = (s.inicio || 0) + s.entradas;
    const pct = conocido && base > 0 ? Math.max(0, Math.min(100, s.queda / base * 100)) : 0;
    return `<section class="card prod ${cls}" data-key="p-${esc(p.id)}">
      <div class="p-top">
        <div><h2>${esc(p.nombre)}</h2><small>${fmt(p.precio)} cada una</small></div>
        <div class="p-queda">${conocido ? `<b>${cnt(s.queda, 'n')}</b><small>${s.queda === 1 ? 'queda' : 'quedan'}</small>` : '<b>?</b><small>falta contar</small>'}</div>
      </div>
      ${conocido ? `<div class="p-barra"><span style="width:${pct}%"></span></div>` : ''}
      <div class="p-grid">
        <div><small>Al abrir</small><b>${s.inicio == null ? '–' : s.inicio}</b>${s.inicio != null ? `<em>${fuenteTxt[s.fuente]}</em>` : ''}</div>
        <div><small>Llegaron</small><b>+${s.entradas}</b></div>
        <div><small>Vendidas</small><b>−${s.vendidas}</b></div>
        <div><small>Ajustes</small><b>${s.ajustes > 0 ? '+' : ''}${s.ajustes}</b></div>
      </div>
    </section>`;
  };
  const pulCard = col => {
    const s = st['pulsera:' + col] || { queda: null, vendidas: 0 };
    const g = (R.porColor[col] || {}).gratis || 0;
    const cls = s.queda == null ? 'sin' : s.queda < 0 ? 'neg' : s.queda <= 10 ? 'bajo' : '';
    return `<button type="button" class="pul-card ${cls} ${f.producto === 'pulsera:' + col ? 'sel' : ''}" data-key="pc-${esc(col)}" data-act="iset" data-f="producto" data-v="pulsera:${esc(col)}">
      <span class="pc-banda" style="--c:${colorHex(col)}"></span>
      <span class="pc-nom">${esc(col)}</span>
      <b>${s.queda == null ? '?' : s.queda}</b><small>${s.queda == null ? 'falta contar' : 'quedan'}</small>
      <span class="pc-hoy">${s.vendidas ? 'Entregadas hoy: ' + s.vendidas + (g ? ' (' + g + ' gratis)' : '') : 'Sin entregas hoy'}</span>
    </button>`;
  };

  return `${S.config.productos.map(prodCard).join('')}
  <section class="card" data-key="pulseras">
    <h2 class="card-h">Pulseras</h2>
    <p class="ayuda">Cada entrada, juego, free pass y cortesía descuenta una pulsera de su color. Toca un color para anotar su stock abajo.</p>
    <div class="pul-grid">${S.config.pulseras.map(pulCard).join('')}</div>
  </section>

  ${cerrado ? '' : `<section class="card" data-key="mov-form">
    <h2 class="card-h">Anotar en el inventario</h2>
    <p class="sub-t">¿Qué?</p>
    ${chips('producto', items.map(id => [id, id.indexOf('pulsera:') === 0 ? `<i class="chip-dot" style="background:${colorHex(id.slice(8))}"></i>${esc(id.slice(8))}` : esc(nombreItem(id))]), f.producto, 'iset')}
    <p class="sub-t">¿Qué pasó?</p>
    ${chips('tipo', TIPOS_MOV.map(t => [t[0], t[1]]), f.tipo, 'iset')}
    <label class="lbl" for="i-cant">${esc(nombreItem(f.producto))}: ${tipo[2].toLowerCase()}</label>
    <div class="row2">
      <input id="i-cant" class="inp" data-ifield="cantidad" value="${esc(f.cantidad)}" inputmode="numeric" placeholder="Cantidad" autocomplete="off">
      <input class="inp" data-ifield="nota" value="${esc(f.nota)}" placeholder="Nota (opcional)" autocomplete="off">
    </div>
    ${f.tipo === 'conteo' ? '<p class="ayuda" data-key="ayuda-conteo">Cuenta lo que hay físicamente. Si no coincide con lo que dice la app, se corrige y queda anotada la diferencia.</p>' : ''}
    <button class="btn coral" data-act="guardar-mov">Guardar</button>
  </section>`}

  <section class="card" data-key="movs">
    <h2 class="card-h">Movimientos del día</h2>
    ${movs.length ? movs.map(m => {
      const anul = m.estado === 'anulado';
      const signo = m.tipo === 'ingreso' ? '+' + m.cantidad : m.tipo === 'ajuste' ? (m.cantidad > 0 ? '+' : '') + m.cantidad : String(m.cantidad);
      return `<div class="fila mov ${anul ? 'anulado' : ''}" data-key="mv-${m.id}"><span>${esc(tipoTxt[m.tipo] || m.tipo)}, ${esc(nombreItem(m.producto).toLowerCase())}<small>${esc(m.creadoPor || '')} a las ${esc(horaDe(m.creadoEn))}${m.nota ? '. ' + esc(m.nota) : ''}${anul ? '. Anulado por ' + esc(m.editadoPor || '') : ''}</small></span><b>${esc(signo)}</b>${anul || cerrado ? '' : `<button class="x" data-act="anular-mov" data-v="${m.id}" aria-label="Anular movimiento">×</button>`}</div>`;
    }).join('') : '<p class="muted" data-key="sin-mov">Nada anotado hoy. Las ventas se descuentan solas.</p>'}
  </section>
  <p class="pie">Para agregar productos o cambiar precios, usa las pestañas Productos y Entradas de la planilla.</p>`;
}

/* ---------- Caja ---------- */
function difTexto(d) {
  if (d === 0) return '<span class="dif ok">Cuadra</span>';
  return `<span class="dif ${d > 0 ? 'sobra' : 'falta'}">${d > 0 ? 'Sobran' : 'Faltan'} ${fmt(Math.abs(d))}</span>`;
}
function vistaCaja() {
  const R = Calc.resumen(S.registros, S.gastos, S.config);
  const g = S.gform, c = S.config;
  const cerrado = diaCerrado();
  const st = stockHoy();
  const fila = (l, v, cls, key) => `<div class="fila ${cls || ''}"${key ? ` data-key="${key}"` : ''}><span>${l}</span><b>${v}</b></div>`;
  const medios = c.medios_pago.slice();
  Object.keys(R.porMedio).forEach(m => { if (medios.indexOf(m) < 0) medios.push(m); });
  const suma = medios.reduce((s, m) => s + (R.porMedio[m] || 0), 0);
  const contado = cerrado ? (S.cierre.efectivoContado === '' || S.cierre.efectivoContado == null ? null : +S.cierre.efectivoContado) : enteroDe(S.cform.efectivo);
  const maquina = cerrado ? (S.cierre.debitoMaquina === '' || S.cierre.debitoMaquina == null ? null : +S.cierre.debitoMaquina) : enteroDe(S.cform.debito);

  return `<section class="total-dia" data-key="total">
    <small>Total del día · ${esc(S.sede)}</small>
    <b class="t-num">${cnt(R.recaudado)}</b>
    ${R.devol ? `<small class="t-nota">Ya descontadas devoluciones por ${fmt(R.devol)}</small>` : ''}
    <div class="split" role="img" aria-label="Cómo se pagó">${suma ? medios.filter(m => R.porMedio[m] > 0).map(m => `<span style="flex-grow:${R.porMedio[m]};background:${COLOR_MEDIO[m] || '#90a4ae'}"></span>`).join('') : '<span class="vacia"></span>'}</div>
    <ul class="leyenda">${medios.map(m => `<li data-key="l-${esc(m)}"><i style="background:${COLOR_MEDIO[m] || '#90a4ae'}"></i><span>${esc(m)}</span><b>${cnt(R.porMedio[m] || 0)}</b></li>`).join('')}</ul>
  </section>

  <section class="card" data-key="vendido">
    <h2 class="card-h">Lo vendido</h2>
    ${Object.keys(R.porEntrada).length ? Object.keys(R.porEntrada).map(k => { const e = R.porEntrada[k]; return fila(esc(e.nombre) + ` <small>${plural(e.cant, 'pulsera', 'pulseras')}</small>`, e.gratis ? 'Gratis' : cnt(e.monto), '', 've-' + k); }).join('')
      : '<p class="muted" data-key="sin-ent">Sin entradas vendidas.</p>'}
    ${Object.keys(R.porProducto).map(k => fila(esc(R.porProducto[k].nombre) + ` <small>${R.porProducto[k].cant} unidades</small>`, cnt(R.porProducto[k].monto), '', 'vp-' + k)).join('')}
  </section>

  <section class="card" data-key="pul-caja">
    <h2 class="card-h">Pulseras entregadas</h2>
    ${Object.keys(R.porColor).length ? ordenColores(Object.keys(R.porColor)).map(col => {
      const pc = R.porColor[col], s = st['pulsera:' + col];
      return `<div class="fila pul" data-key="pk-${esc(col)}"><span><i class="chip-dot" style="background:${colorHex(col)}"></i>${esc(col)}<small>${pc.gratis ? pc.gratis + ' gratis (free pass y cortesía)' : 'Todas pagadas'}${s && s.queda != null ? ' · quedan ' + s.queda : ''}</small></span><b>${pc.cant}</b></div>`;
    }).join('') + fila('Total', `${R.pulseras}`, 'tot', 'pk-tot') : '<p class="muted" data-key="sin-pul">Todavía no se entregan pulseras.</p>'}
  </section>

  <section class="card" data-key="gastos">
    <h2 class="card-h">Gastos</h2>
    ${R.listaGastos.length ? R.listaGastos.map(x => `<div class="fila gasto" data-key="x-${x.id}"><span>${esc(x.concepto)}<small>${x.pagadoDesde === 'Efectivo' ? 'Con efectivo de la caja' : 'Pagado aparte'}, anotó ${esc(x.creadoPor || '')}</small></span><b>−${fmt(x.monto)}</b>${cerrado ? '' : `<button class="x" data-act="anular-gasto" data-v="${x.id}" aria-label="Anular gasto">×</button>`}</div>`).join('') : '<p class="muted" data-key="sin-gastos">Sin gastos anotados.</p>'}
    ${R.totalGastos ? fila('Total de gastos', '−' + fmt(R.totalGastos), 'tot neg', 'tg') : ''}
    ${cerrado ? '' : `<div class="gform" data-key="gform">
      <div class="chips mini">${['Almuerzo', 'Bencina', 'Hielo', 'Bolsas'].map(q => `<button type="button" class="chip" data-act="gq" data-v="${q}">${q}</button>`).join('')}</div>
      <div class="row2">
        <input class="inp" data-gfield="concepto" value="${esc(g.concepto)}" placeholder="En qué se gastó" autocomplete="off">
        <input class="inp" data-gfield="monto" value="${esc(g.monto)}" placeholder="Monto" inputmode="numeric">
      </div>
      <p class="sub-t">Se pagó con</p>
      ${chips('pagadoDesde', [['Efectivo', 'Efectivo de la caja'], ['Aparte', 'Pagado aparte']], g.pagadoDesde, 'gset')}
      <button class="btn" data-act="agregar-gasto">Anotar gasto</button>
    </div>`}
  </section>

  <section class="card cuadre" data-key="cuadre">
    <h2 class="card-h">Cuadre de caja</h2>
    <p class="frase">Neto del día <b>${cnt(R.neto)}</b>${R.porSocio != null ? `. Dividido en ${R.socios} socios: <b>${cnt(R.porSocio)}</b> cada uno` : ''}.</p>
    <div class="cq">
      <div class="cq-fila" data-key="cq-ef">
        <div><span>Efectivo que debe haber</span><b>${cnt(R.efectivoEsperado)}</b><small>cobrado ${fmt(R.efectivo)}${R.devol ? ' − devoluciones ' + fmt(R.devol) : ''}${R.gastosCaja ? ' − gastos de caja ' + fmt(R.gastosCaja) : ''}</small></div>
        ${cerrado ? `<div class="cq-in"><span>Contado</span><b>${contado == null ? 'No ingresado' : fmt(contado)}</b>${contado != null ? difTexto(contado - R.efectivoEsperado) : ''}</div>`
          : `<label class="cq-in"><span>Efectivo contado</span><input class="inp" data-cfield="efectivo" inputmode="numeric" value="${esc(S.cform.efectivo)}" placeholder="$0">${contado != null ? difTexto(contado - R.efectivoEsperado) : ''}</label>`}
      </div>
      <div class="cq-fila" data-key="cq-deb">
        <div><span>Débito según la app</span><b>${cnt(R.debito)}</b><small>suma de las ventas con débito</small></div>
        ${cerrado ? `<div class="cq-in"><span>Máquina</span><b>${maquina == null ? 'No ingresado' : fmt(maquina)}</b>${maquina != null ? difTexto(maquina - R.debito) : ''}</div>`
          : `<label class="cq-in"><span>Total de la máquina</span><input class="inp" data-cfield="debito" inputmode="numeric" value="${esc(S.cform.debito)}" placeholder="$0">${maquina != null ? difTexto(maquina - R.debito) : ''}</label>`}
      </div>
    </div>
  </section>

  <section class="card cierre ${cerrado ? 'cerrada' : ''}" data-key="cierre">
    ${cerrado ? `<div class="c-estado"><span class="cerrado-ic">${ICON.lock}</span><div><b>Caja cerrada</b><small>La cerró ${esc(S.cierre.cerradoPor)} a las ${esc(horaDe(S.cierre.cerradoEn))}.</small></div></div>
      ${linkArchivo('btn')}
      ${!DEMO && !(S.cierre.archivo) ? '<p class="ayuda" data-key="arch-pend">El archivo del día aparece aquí cuando el cierre llega a la planilla.</p>' : ''}
      ${S.cierre.archivo && !/^https?:/.test(S.cierre.archivo) ? `<p class="ayuda alerta" data-key="arch-err">${esc(S.cierre.archivo)}</p>` : ''}
      ${DEMO ? '<p class="ayuda" data-key="arch-demo">En la versión real, aquí aparece el botón para abrir el archivo de este día guardado en Drive.</p>' : ''}`
    : `${S.cierre && S.cierre.estado === 'reabierta' ? `<p class="ayuda alerta" data-key="reab">La caja fue reabierta por ${esc(S.cierre.reabiertoPor || '')} a las ${esc(horaDe(S.cierre.reabiertoEn))}. Vuelve a cerrarla cuando termines.</p>` : ''}
      <button class="btn coral big" data-act="cerrar">Cerrar caja del día</button>
      <p class="ayuda">Cuenta el efectivo y escríbelo arriba antes de cerrar. Al cerrar, el día queda bloqueado y se guarda una planilla con todo en la carpeta de ${esc(S.sede)} del Drive.</p>`}
    <button class="btn" data-act="compartir">${ICON.compartir}<span>Compartir resumen</span></button>
    ${cerrado && esAdmin() ? '<button class="btn quitar" data-act="reabrir">Reabrir caja (administrador)</button>' : ''}
  </section>
  ${PRUEBA ? `<section class="prueba-pie" data-key="prueba">
    <p><b>Estás en la versión de prueba.</b> Para ver los días anteriores, toca la fecha de arriba.${esAdmin() ? ' Para cambiar de lugar, toca el nombre del lugar.' : ''}</p>
    <button class="btn" data-act="reiniciar-prueba">Volver a los días de prueba originales</button>
  </section>` : ''}`;
}

/* ---------- Reportes ---------- */
function vistaReportes() {
  const r = S.rep, d = r.datos;
  const rapidos = [['hoy', 'Hoy'], ['ayer', 'Ayer'], ['7', '7 días'], ['mes', 'Este mes'], ['30', '30 días']];
  const tile = (l, v, cls) => `<div class="rt ${cls || ''}"><small>${l}</small><b>${v}</b></div>`;
  let res = '';
  if (r.cargando) res = '<p class="muted" data-key="cargando">Calculando…</p>';
  else if (r.error) res = `<p class="ayuda alerta" data-key="err">${esc(r.error)}</p>`;
  else if (d) {
    const T = d.total;
    const ents = Object.keys(T.porEntrada), cols = Object.keys(T.porColor), prs = Object.keys(T.porProducto);
    res = `<section class="card" data-key="r-tot">
      <h2 class="card-h">${d.sede === '*' ? 'Todos los lugares' : esc(d.sede)} <span class="muted">· ${fechaCorta(d.desde)} al ${fechaCorta(d.hasta)}</span></h2>
      <div class="rt-grid">
        ${tile('Recaudado', fmt(T.recaudado), 'grande')}
        ${tile('Neto (menos gastos)', fmt(T.neto))}
        ${tile('Efectivo', fmt(T.efectivo))}
        ${tile('Débito', fmt(T.debito))}
        ${T.transferencia ? tile('Transferencia', fmt(T.transferencia)) : ''}
        ${tile('Ventas', T.ventas)}
        ${tile('Pulseras', T.pulseras)}
        ${tile('Gratis (free pass y cortesía)', T.gratis)}
        ${tile('Gastos', fmt(T.totalGastos))}
        ${tile('Diferencias de caja', T.difEfectivo ? fmt(T.difEfectivo) : '$0', T.difEfectivo ? (T.difEfectivo < 0 ? 'neg' : 'pos') : '')}
      </div>
    </section>
    ${d.porSede.length > 1 ? `<section class="card" data-key="r-sedes"><h2 class="card-h">Por lugar</h2>
      <div class="r-tabla"><div class="r-cab"><span>Lugar</span><span>Recaudado</span><span>Neto</span><span>Pulseras</span><span>Días cerrados</span></div>
      ${d.porSede.map(s => `<div class="r-fila" data-key="rs-${esc(s.sede)}"><span><b>${esc(s.sede)}</b>${s.difEfectivo ? `<small class="${s.difEfectivo < 0 ? 'neg' : ''}">dif. caja ${fmt(s.difEfectivo)}</small>` : ''}</span><span>${fmt(s.recaudado)}</span><span>${fmt(s.neto)}</span><span>${s.pulseras}</span><span>${s.cerrados}/${s.dias}</span></div>`).join('')}
      </div></section>` : ''}
    <section class="card" data-key="r-ents"><h2 class="card-h">Entradas y juegos vendidos</h2>
      ${ents.length ? ents.map(k => { const e = T.porEntrada[k]; return `<div class="fila" data-key="re-${esc(k)}"><span>${esc(e.nombre)}<small>${plural(e.cant, 'pulsera', 'pulseras')}</small></span><b>${e.gratis ? 'Gratis' : fmt(e.monto)}</b></div>`; }).join('') : '<p class="muted">Sin ventas en el período.</p>'}
      ${prs.map(k => `<div class="fila" data-key="rp-${esc(k)}"><span>${esc(T.porProducto[k].nombre)}<small>${T.porProducto[k].cant} unidades</small></span><b>${fmt(T.porProducto[k].monto)}</b></div>`).join('')}
    </section>
    ${cols.length ? `<section class="card" data-key="r-cols"><h2 class="card-h">Pulseras por color</h2>
      <div class="r-cols">${cols.map(col => `<div class="r-col"><i style="background:${colorHex(col)}"></i><span>${esc(col)}</span><b>${T.porColor[col].cant}</b>${T.porColor[col].gratis ? `<small>${T.porColor[col].gratis} gratis</small>` : ''}</div>`).join('')}</div>
    </section>` : ''}
    <section class="card" data-key="r-cie"><h2 class="card-h">Cierres de caja</h2>
      ${d.cierres.length ? d.cierres.map(c => {
        const dif = c.difEfectivo === '' || c.difEfectivo == null ? null : +c.difEfectivo;
        const ok = c.estado !== 'reabierta' && c.cerradoPor;
        return `<div class="fila cie" data-key="rc-${esc(c.fecha + c.sede)}"><span><b>${esc(fechaLarga(c.fecha))}</b><small>${esc(c.sede)} · ${ok ? 'cerró ' + esc(c.cerradoPor) : 'reabierta'}${dif != null ? ' · ' + (dif === 0 ? 'cuadró' : (dif > 0 ? 'sobraron ' : 'faltaron ') + fmt(Math.abs(dif))) : ''}</small></span><b>${fmt(c.neto)}</b>${c.archivo && /^https?:/.test(c.archivo) ? `<a class="x" href="${esc(c.archivo)}" target="_blank" rel="noopener" aria-label="Abrir archivo del día">${ICON.archivo}</a>` : ''}</div>`;
      }).join('') : '<p class="muted">No hay cierres en el período.</p>'}
    </section>`;
  }
  return `<section class="card" data-key="r-filtro">
      <h2 class="card-h">Reportes</h2>
      <p class="sub-t">Lugar</p>
      ${chips('sede', [['*', 'Todos']].concat(S.sedes.map(s => [s, esc(s)])), r.sede, 'rset')}
      <p class="sub-t">Período</p>
      ${chips('rapido', rapidos, r.rapido, 'rset')}
      <div class="row2 r-fechas">
        <label><span class="lbl">Desde</span><input class="inp" type="date" data-rfield="desde" value="${r.desde}" max="${hoy()}"></label>
        <label><span class="lbl">Hasta</span><input class="inp" type="date" data-rfield="hasta" value="${r.hasta}" max="${hoy()}"></label>
      </div>
      <button class="btn coral" data-act="ver-reporte">Ver reporte</button>
    </section>
    ${res}`;
}

/* =========================================================
   Eventos
   ========================================================= */
const ACT = {
  login, logout, sync: () => DEMO ? toast('Modo de prueba: no hay planilla conectada') : sync(),
  tab(v) {
    if (v === S.tab && !S.editId) return;
    irA(v, () => { if (S.editId) { S.editId = null; S.venta = nuevaVenta(); } });
  },
  'sede-menu'() { S.sedeMenu = !S.sedeMenu; renderHeader(); },
  sede(v) { cambiarSede(v); },
  set(v, el) {
    const f = el.dataset.f;
    S.venta[f] = v;
    renderTab();
  },
  ent(v) {
    if (bloqueado()) return;
    S.venta.ents[v] = (+S.venta.ents[v] || 0) + 1;
    audioCtx();
    renderTab();
  },
  'ent-'(v) { S.venta.ents[v] = Math.max(0, (+S.venta.ents[v] || 0) - 1); renderTab(); },
  pulsera(v) { S.venta.colorRot = v; S.venta.colorManual = true; renderTab(); },
  pstep(v, el) {
    const id = el.dataset.f;
    S.venta.prods[id] = Math.max(0, (+S.venta.prods[id] || 0) + (+v));
    renderTab();
  },
  guardar: guardarVenta,
  cancelar() { irA('grupos', () => { S.editId = null; S.venta = nuevaVenta(); }); },
  edit(v) {
    if (bloqueado()) return;
    const r = S.registros.find(x => x.id === v); if (!r) return;
    irA('vender', () => { S.editId = v; S.venta = ventaDesde(r); });
  },
  anular(v) { cambiarEstado(v, 'anulado'); },
  restaurar(v) { cambiarEstado(v, 'ok'); },
  iset(v, el) { S.iform[el.dataset.f] = v; renderTab(); if (el.dataset.f === 'tipo') { const i = $('#i-cant'); if (i) i.focus(); } },
  'guardar-mov': guardarMovimiento,
  'anular-mov': anularMovimiento,
  gq(v) { S.gform.concepto = v; renderTab(); const m = document.querySelector('[data-gfield="monto"]'); if (m) m.focus(); },
  gset(v) { S.gform.pagadoDesde = v; renderTab(); },
  'agregar-gasto': agregarGasto,
  'anular-gasto': anularGasto,
  'alerta-ok': cerrarAlerta,
  cerrar: cerrarCaja,
  reabrir: reabrirCaja,
  'ir-hoy'() { cambiarDia(hoy()); },
  dia(v) { cambiarDia(v); },
  calendario() {
    // Abre el calendario del sistema (en computador, Chrome no lo abre con un clic normal sobre el campo)
    const i = $('#fecha'); if (!i) return;
    try { if (i.showPicker) { i.showPicker(); return; } } catch (e) { }
    i.style.pointerEvents = 'auto'; i.focus(); i.click();
  },
  rset(v, el) {
    const f = el.dataset.f;
    if (f === 'rapido') { const rr = rangoRapido(v); S.rep.desde = rr[0]; S.rep.hasta = rr[1]; S.rep.rapido = v; }
    else S.rep[f] = v;
    renderTab();
    verReporte();
  },
  'ver-reporte': verReporte,
  compartir,
  'probar-alerta'() {
    if (bloqueado()) return;
    audioCtx(); pedirPermisoNotif();
    const entrada = hmDe(Math.floor((segAhora() + 60) / 60) - 30);    // sale al cambiar el próximo minuto
    const e = entradaPorId('media');
    const l = { id: 'media', nombre: e.nombre, cant: 2, precio: e.precio, minutos: 30, color: colorMedia(entrada, S.registros), rot: true, gratis: false };
    const rec = {
      id: uid(), fecha: S.fecha, nombre: 'Prueba de alerta', entrada, salida: sumarMin(entrada, 30), lineas: [l], productos: [],
      personas: 2, pulsera: l.color, minutos: 0, precioPersona: 0, calcetas: 0, precioCalceta: 0,
      medio: 'Efectivo', cuenta: '', obs: '', devolucion: 0, devolucionDesde: '', estado: 'ok', demoVivo: true,
      creadoPor: S.user.nombre, creadoEn: nowLocal()
    };
    rec.total = Calc.totalVenta(rec);
    guardarLocal('registro', rec);
    toast('Listo: a las ' + rec.salida + ' suena la alerta', 'ok');
    renderTab();
  },
  'reiniciar-prueba'() {
    if (!confirm('¿Volver a los días de prueba originales? Se borra lo que hayas registrado en esta prueba.')) return;
    const u = LS.get('pa_user', null);
    borrarPrueba(); if (u) LS.set('pa_user', u);
    location.reload();
  }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act]; if (fn) { e.preventDefault(); fn(el.dataset.v, el); }
});
document.addEventListener('pointerdown', () => audioCtx(), { passive: true });
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.field && S.venta) {
    S.venta[t.dataset.field] = t.value;
    if (t.dataset.field === 'entrada') { S.venta.entradaAuto = false; if (!S.venta.colorManual) S.venta.colorRot = ''; }
    if (t.dataset.field === 'entrada' || t.dataset.field === 'devolucion') renderTab();
  }
  if (t.dataset.gfield) S.gform[t.dataset.gfield] = t.value;
  if (t.dataset.ifield) S.iform[t.dataset.ifield] = t.value;
  if (t.dataset.cfield) { S.cform[t.dataset.cfield] = t.value; renderTab(); }
  if (t.dataset.rfield) { S.rep[t.dataset.rfield] = t.value; S.rep.rapido = ''; }
});
document.addEventListener('change', e => {
  if (e.target.id === 'fecha' && e.target.value) cambiarDia(e.target.value > hoy() ? hoy() : e.target.value);
  if (e.target.dataset && e.target.dataset.rfield) renderTab();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'lp') login();
  if (e.key === 'Enter' && e.target.id === 'f-nombre') e.target.blur();
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.ifield) guardarMovimiento();
});
window.addEventListener('online', sync);
window.addEventListener('offline', () => { if (!DEMO) { S.syncState = 'offline'; renderHeader(); } });
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !S.user) return;
  revisarAlertas(); renderTab(); pantallaEncendida(); sync();
});

// Cada 5 s: alertas, cuenta regresiva y anillos. Cada 30 s: sincronizar con la planilla.
setInterval(() => {
  if (!S.user) return;
  revisarAlertas();
  if (S.fecha === hoy() && (S.tab === 'vender' || S.tab === 'grupos')) renderTab();
  pantallaEncendida();
}, 5000);
setInterval(() => { if (S.user) sync(); }, 30000);

/* ---------- inicio ---------- */
if (PRUEBA) {
  const sem = LS.get('pa_semilla', null);
  if (!sem || sem.v !== 6 || sem.fecha !== hoy()) {
    // Primera vez, o es otro día: se arman los días de nuevo (se mantiene la sesión si el usuario existe)
    const u = LS.get('pa_user', null);
    borrarPrueba();
    if (u && USUARIOS_PRUEBA.some(x => x.nombre === u.nombre)) LS.set('pa_user', u); else S.user = null;
    S.sedes = SEDES_DEF.slice();
    sembrarPrueba();
  } else sembrarPrueba(true);   // mismo día: solo se rearman los grupos en el agua según la hora actual
}
if (S.user && !S.user.rol && !DEMO) { S.user = null; LS.del('pa_user'); }  // sesión de una versión anterior: volver a entrar
if (S.user && DEMO) { const u = USUARIOS_PRUEBA.find(x => x.nombre === S.user.nombre); if (u) S.user = Object.assign({ pin: '' }, u); else S.user = null; }
S.sede = sedeInicial();
cargarConfig();
loadDay();
if (S.user) { S.venta = nuevaVenta(); S.rep = nuevoReporte(); }
render();
if (S.user) { sync(); revisarAlertas(); pantallaEncendida(); } else cargarUsuarios();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { });
}
