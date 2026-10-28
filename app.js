'use strict';
/* =========================================================
   Parque Acuático · Caja — app principal
   ========================================================= */

const API_URL = ((window.APP_CONFIG || {}).API_URL || '').trim();
const DEMO = !API_URL;

const DEFAULT_CONFIG = {
  precio_media: 6000,
  precio_hora: 10000,
  precio_calceta: 2000,
  socios: ['Víctor', 'Yessi'],
  cuenta_debito: '',
  colores: ['Rojo', 'Azul', 'Verde', 'Amarillo', 'Naranjo', 'Morado', 'Rosado', 'Blanco']
};

const COLOR_HEX = {
  rojo: '#e53935', azul: '#1e88e5', verde: '#43a047', amarillo: '#fdd835', naranjo: '#fb8c00',
  morado: '#8e24aa', rosado: '#f06292', blanco: '#fafafa', negro: '#212121', celeste: '#4fc3f7',
  cafe: '#795548', gris: '#9e9e9e', fucsia: '#d81b60', turquesa: '#26a69a', dorado: '#c9a227',
  plateado: '#b0bec5', lila: '#b39ddb', verdeagua: '#64ffda'
};

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin espacio */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};
const pad = n => String(n).padStart(2, '0');
const fmt = n => (n < 0 ? '−' : '') + '$' + Math.round(Math.abs(+n || 0)).toLocaleString('es-CL');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function hoy() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function ahoraHM() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function nowLocal() { const d = new Date(); return hoy() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
function minutosDe(hm) { const p = String(hm || '0:0').split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0); }
function sumarMin(hm, m) { const t = (minutosDe(hm) + m) % 1440; return pad(Math.floor(t / 60)) + ':' + pad(t % 60); }
function horaDe(ts) { return ts ? String(ts).slice(11, 16) : ''; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function colorHex(n) { const k = String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ''); return COLOR_HEX[k] || '#90a4ae'; }
function fechaLarga(f) {
  const d = new Date(f + 'T12:00:00');
  const s = d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function toast(msg, tipo) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show ' + (tipo || '');
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = ''; }, 2600);
}

/* ---------- estado ---------- */
const S = {
  user: LS.get('pa_user', null),
  config: Object.assign({}, DEFAULT_CONFIG, LS.get('pa_config', {})),
  usuarios: LS.get('pa_usuarios', []),
  fecha: hoy(),
  registros: [], gastos: [], cierre: null,
  tab: 'registrar',
  editId: null,
  form: null,
  gform: { concepto: '', monto: '', pagadoDesde: 'Efectivo' },
  syncState: DEMO ? 'demo' : 'idle', syncError: '', syncing: false,
  dirty: false
};

function dayKey(f) { return 'pa_day_' + f; }
function loadDay() {
  const d = LS.get(dayKey(S.fecha), { registros: [], gastos: [], cierre: null });
  S.registros = d.registros || []; S.gastos = d.gastos || []; S.cierre = d.cierre || null;
}
function saveDay() { LS.set(dayKey(S.fecha), { registros: S.registros, gastos: S.gastos, cierre: S.cierre }); }
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
  if (kind === 'registro') S.registros = upsertArr(S.registros, obj);
  else if (kind === 'gasto') S.gastos = upsertArr(S.gastos, obj);
  else if (kind === 'cierre') S.cierre = obj;
  saveDay();
  if (!DEMO) { enqueue(kind, obj); sync(); }
}

/* ---------- servidor (Google Apps Script) ---------- */
async function api(action, payload) {
  const body = Object.assign({ action, usuario: S.user && S.user.nombre, pin: S.user && S.user.pin }, payload || {});
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 25000);
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
  S.config = Object.assign({}, DEFAULT_CONFIG, c);
  if (!S.config.socios || !S.config.socios.length) S.config.socios = DEFAULT_CONFIG.socios;
  if (!S.config.colores || !S.config.colores.length) S.config.colores = DEFAULT_CONFIG.colores;
  LS.set('pa_config', S.config);
}

async function sync() {
  if (DEMO || !S.user || S.syncing) return;
  if (!navigator.onLine) { S.syncState = 'offline'; renderHeader(); return; }
  S.syncing = true; S.syncState = 'sync'; renderHeader();
  const fecha = S.fecha;
  try {
    const q = getQueue();
    if (q.length) {
      const res = await api('sync', { ops: q });
      const hechos = new Set(res.applied || []);
      setQueue(getQueue().filter(o => !hechos.has(o.opId)));
    }
    const d = await api('getDay', { fecha });
    aplicarConfig(d.config);
    if (fecha === S.fecha) {
      let regs = d.registros || [], gas = d.gastos || [], cierre = d.cierre || null;
      getQueue().filter(o => o.fecha === fecha).forEach(o => {
        if (o.kind === 'registro') regs = upsertArr(regs, o.data);
        else if (o.kind === 'gasto') gas = upsertArr(gas, o.data);
        else if (o.kind === 'cierre') cierre = o.data;
      });
      S.registros = regs; S.gastos = gas; S.cierre = cierre; saveDay();
    }
    S.syncState = getQueue().length ? 'pending' : 'ok'; S.syncError = '';
  } catch (e) {
    S.syncState = navigator.onLine ? 'error' : 'offline'; S.syncError = e.message;
  }
  S.syncing = false;
  renderHeader(); renderTab(false);
}

/* ---------- formulario de grupo ---------- */
function gruposActivos(excluirId) {
  if (S.fecha !== hoy()) return [];
  const now = minutosDe(ahoraHM());
  return S.registros.filter(r => r.estado !== 'anulado' && r.id !== excluirId &&
    now >= minutosDe(r.entrada) - 5 && now < minutosDe(r.entrada) + (+r.minutos));
}
function sugerirColor() {
  const usados = new Set(gruposActivos().map(r => r.pulsera));
  return S.config.colores.find(c => !usados.has(c)) || S.config.colores[0];
}
function nuevoForm() {
  return {
    personas: 2, nombre: '', pulsera: sugerirColor(), minutos: 30, calcetas: 0,
    medio: 'Efectivo', cuenta: '', entrada: ahoraHM(), entradaAuto: true, obs: '',
    devolucion: '', devolucionDesde: 'Efectivo',
    precioPersona: S.config.precio_media, precioCalceta: S.config.precio_calceta
  };
}
function formDesde(r) {
  return {
    personas: +r.personas, nombre: r.nombre, pulsera: r.pulsera, minutos: +r.minutos, calcetas: +r.calcetas,
    medio: r.medio, cuenta: r.cuenta || '', entrada: r.entrada, entradaAuto: false, obs: r.obs || '',
    devolucion: +r.devolucion ? String(r.devolucion) : '', devolucionDesde: r.devolucionDesde || 'Efectivo',
    precioPersona: +r.precioPersona, precioCalceta: +r.precioCalceta
  };
}

function guardarGrupo() {
  const f = S.form;
  const nombre = (f.nombre || '').trim();
  if (!nombre) return toast('Falta el nombre del grupo', 'err');
  if (+f.personas < 1) return toast('Debe haber al menos 1 persona', 'err');
  if (f.medio === 'Transferencia' && !f.cuenta) return toast('Elige a qué cuenta llegó la transferencia', 'err');
  const prev = S.editId ? S.registros.find(r => r.id === S.editId) : null;
  const entrada = (!prev && f.entradaAuto && S.fecha === hoy()) ? ahoraHM() : f.entrada;
  const dev = Math.max(0, parseInt(String(f.devolucion).replace(/\D/g, ''), 10) || 0);
  const rec = Object.assign({}, prev || {}, {
    id: prev ? prev.id : uid(),
    fecha: S.fecha,
    entrada, salida: sumarMin(entrada, +f.minutos),
    personas: +f.personas, nombre, pulsera: f.pulsera, minutos: +f.minutos, calcetas: +f.calcetas,
    medio: f.medio, cuenta: f.medio === 'Transferencia' ? f.cuenta : '',
    precioPersona: +f.precioPersona, precioCalceta: +f.precioCalceta,
    obs: (f.obs || '').trim(),
    devolucion: dev, devolucionDesde: dev ? f.devolucionDesde : '',
    estado: prev ? prev.estado : 'ok'
  });
  rec.total = Calc.totalGrupo(rec);
  if (prev) { rec.editadoPor = S.user.nombre; rec.editadoEn = nowLocal(); }
  else { rec.creadoPor = S.user.nombre; rec.creadoEn = nowLocal(); }
  guardarLocal('registro', rec);
  toast(prev ? 'Cambios guardados' : 'Registrado: ' + nombre + ' · ' + fmt(rec.total), 'ok');
  S.editId = null; S.form = nuevoForm();
  if (prev) S.tab = 'dia';
  render(true);
}

function cambiarEstado(id, estado) {
  const r = S.registros.find(x => x.id === id); if (!r) return;
  const msg = estado === 'anulado' ? '¿Anular el grupo de ' + r.nombre + '? Quedará registrado quién lo anuló.' : '¿Restaurar el grupo de ' + r.nombre + '?';
  if (!confirm(msg)) return;
  guardarLocal('registro', Object.assign({}, r, { estado, editadoPor: S.user.nombre, editadoEn: nowLocal() }));
  S.editId = null; S.form = nuevoForm(); S.tab = 'dia';
  toast(estado === 'anulado' ? 'Grupo anulado' : 'Grupo restaurado');
  render(true);
}

/* ---------- gastos y cierre ---------- */
function agregarGasto() {
  const g = S.gform;
  const monto = parseInt(String(g.monto).replace(/\D/g, ''), 10) || 0;
  if (!g.concepto.trim()) return toast('Escribe el concepto del gasto', 'err');
  if (monto <= 0) return toast('Escribe el monto del gasto', 'err');
  guardarLocal('gasto', {
    id: uid(), fecha: S.fecha, concepto: g.concepto.trim(), monto, pagadoDesde: g.pagadoDesde,
    estado: 'ok', creadoPor: S.user.nombre, creadoEn: nowLocal()
  });
  S.gform = { concepto: '', monto: '', pagadoDesde: 'Efectivo' };
  toast('Gasto agregado'); renderTab(true);
}
function anularGasto(id) {
  const g = S.gastos.find(x => x.id === id); if (!g) return;
  if (!confirm('¿Anular el gasto "' + g.concepto + '" de ' + fmt(g.monto) + '?')) return;
  guardarLocal('gasto', Object.assign({}, g, { estado: 'anulado', editadoPor: S.user.nombre, editadoEn: nowLocal() }));
  renderTab(true);
}
function cerrarCaja() {
  const r = Calc.resumen(S.registros, S.gastos, S.config);
  if (!r.grupos) return toast('No hay grupos registrados este día', 'err');
  if (!confirm('¿Cerrar la caja del ' + fechaLarga(S.fecha) + '?\nTotal: ' + fmt(r.recaudado) + ' · Neto: ' + fmt(r.netoTotal))) return;
  guardarLocal('cierre', {
    fecha: S.fecha, cerradoPor: S.user.nombre, cerradoEn: nowLocal(),
    totalBruto: r.bruto, devoluciones: r.devol, gastos: r.totalGastos, neto: r.netoTotal,
    efectivoCaja: r.caja, debitoPendiente: r.debitoPendiente,
    reparto: JSON.stringify(r.entregar),
    detalle: JSON.stringify({ efectivo: r.efectivo, transf: r.transf, debito: r.debito, grupos: r.grupos, personas: r.personas, calcetas: r.calcetas })
  });
  toast('Caja cerrada', 'ok'); renderTab(true);
}
function textoResumen() {
  const r = Calc.resumen(S.registros, S.gastos, S.config);
  const L = [];
  L.push('🌊 Parque Acuático — ' + fechaLarga(S.fecha));
  L.push('Grupos: ' + r.grupos + ' · Personas: ' + r.personas + ' · Calcetas: ' + r.calcetas);
  L.push('');
  L.push('Efectivo: ' + fmt(r.efectivo));
  r.socios.forEach(s => { if (r.transf[s]) L.push('Transf. ' + s + ': ' + fmt(r.transf[s])); });
  if (r.debito) L.push('Débito' + (r.cuentaDebito ? ' (' + r.cuentaDebito + ')' : ' (cuenta pendiente)') + ': ' + fmt(r.debito));
  if (r.devol) L.push('Devoluciones: −' + fmt(r.devol));
  L.push('TOTAL: ' + fmt(r.recaudado));
  if (r.totalGastos) L.push('Gastos: −' + fmt(r.totalGastos) + ' (' + r.listaGastos.map(g => g.concepto).join(', ') + ')');
  L.push('Neto: ' + fmt(r.netoTotal) + (r.debitoPendiente ? ' (débito pendiente ' + fmt(r.debitoPendiente) + ')' : ''));
  L.push('Por socio: ' + fmt(r.parte));
  L.push('');
  r.socios.forEach(s => {
    const e = r.entregar[s];
    L.push(s + ': ' + fmt(r.tiene[s]) + ' en cuenta + ' + (e >= 0 ? fmt(e) + ' efectivo' : 'debe pasar ' + fmt(-e)));
  });
  return L.join('\n');
}
async function compartir() {
  const txt = textoResumen();
  try {
    if (navigator.share) { await navigator.share({ text: txt }); return; }
    await navigator.clipboard.writeText(txt); toast('Resumen copiado, pégalo en WhatsApp', 'ok');
  } catch (e) { /* cancelado */ }
}

/* ---------- datos de ejemplo (solo demo) ---------- */
function cargarEjemplo() {
  const c = S.config, socios = c.socios;
  const filas = [
    [4, 'Usett', 30, 0, 'Efectivo', '', '13:10'], [2, 'Yamilet', 30, 2, 'Transferencia', socios[0], '14:20'],
    [2, 'Felipe', 30, 2, 'Efectivo', '', '15:50'], [2, 'Gerardo Rodríguez', 30, 2, 'Transferencia', socios[0], '16:35'],
    [2, 'Leonor Núñez', 30, 0, 'Transferencia', socios[1], '17:00'], [2, 'Gabriel Espínola', 30, 2, 'Efectivo', '', '17:13'],
    [4, 'Catalina Olivina', 30, 4, 'Transferencia', socios[1], '17:15'], [7, 'Víctor Alvial', 60, 0, 'Efectivo', '', '17:30'],
    [2, 'Estrella Osorio', 30, 2, 'Transferencia', socios[1], '17:45'], [3, 'Saúl Díaz', 60, 0, 'Transferencia', socios[1], '18:00', 10000],
    [4, 'Benjamín Fernández', 30, 1, 'Efectivo', '', '18:20'], [2, 'Neta', 30, 0, 'Efectivo', '', '18:35']
  ];
  filas.forEach((f, i) => {
    const rec = {
      id: uid() + i, fecha: S.fecha, entrada: f[6], salida: sumarMin(f[6], f[2]), personas: f[0], nombre: f[1],
      pulsera: c.colores[i % c.colores.length], minutos: f[2], calcetas: f[3], medio: f[4], cuenta: f[5],
      precioPersona: Calc.precioPersona(c, f[2]), precioCalceta: c.precio_calceta,
      obs: f[7] ? 'Pagó 1 hora y se cambió a ½ hora + 1 calceta' : '',
      devolucion: f[7] || 0, devolucionDesde: f[7] ? 'Efectivo' : '', estado: 'ok',
      creadoPor: S.user.nombre, creadoEn: S.fecha + ' ' + f[6] + ':00'
    };
    rec.total = Calc.totalGrupo(rec);
    S.registros.push(rec);
  });
  S.gastos.push({ id: uid(), fecha: S.fecha, concepto: 'Almuerzos (3)', monto: 15000, pagadoDesde: 'Efectivo', estado: 'ok', creadoPor: S.user.nombre, creadoEn: nowLocal() });
  saveDay(); toast('Día de ejemplo cargado (planilla del 9 de marzo)', 'ok'); renderTab(true);
}

/* ---------- login ---------- */
async function cargarUsuarios() {
  if (DEMO) return;
  try { const r = await api('usuarios'); S.usuarios = r.usuarios || []; LS.set('pa_usuarios', S.usuarios); render(true); }
  catch (e) { const el = $('#lerr'); if (el) el.textContent = 'No se pudo conectar: ' + e.message; }
}
async function login() {
  const nombre = $('#lu').value, pin = $('#lp') ? $('#lp').value.trim() : '';
  const err = $('#lerr');
  if (!nombre) { err.textContent = 'Elige tu nombre'; return; }
  if (DEMO) { S.user = { nombre, pin: '', rol: 'admin' }; }
  else {
    if (!pin) { err.textContent = 'Escribe tu PIN'; return; }
    err.textContent = 'Entrando…';
    try {
      S.user = { nombre, pin };
      const r = await api('login');
      S.user = { nombre: r.usuario.nombre, pin, rol: r.usuario.rol };
      aplicarConfig(r.config);
    } catch (e) { S.user = null; err.textContent = e.message; return; }
  }
  LS.set('pa_user', S.user);
  S.form = nuevoForm(); S.tab = 'registrar';
  render(true); sync();
}
function logout() {
  const n = getQueue().length;
  if (n && !confirm('Hay ' + n + ' cambio(s) sin enviar a la planilla. Si sales ahora no se van a perder, pero se enviarán a nombre de quien entre después. ¿Salir igual?')) return;
  if (!n && !confirm('¿Cerrar sesión de ' + S.user.nombre + '?')) return;
  S.user = null; LS.del('pa_user'); render(true);
  if (!DEMO) cargarUsuarios();
}

/* =========================================================
   Vistas
   ========================================================= */
function render(force) {
  const app = $('#app');
  if (!S.user) { app.innerHTML = vistaLogin(); return; }
  if (!$('#main')) {
    app.innerHTML = '<header id="hdr"></header><main id="main"></main><nav id="nav"></nav>';
  }
  renderHeader(); renderNav(); renderTab(force !== false);
}
function inputConFoco() {
  const a = document.activeElement;
  return a && $('#main') && $('#main').contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
}
function renderTab(force) {
  const main = $('#main'); if (!main) return;
  if (!force && inputConFoco()) { S.dirty = true; return; }
  S.dirty = false;
  if (!S.form) S.form = nuevoForm();
  main.innerHTML = S.tab === 'registrar' ? vistaRegistrar() : S.tab === 'dia' ? vistaDia() : vistaCaja();
}

function vistaLogin() {
  const lista = DEMO ? S.config.socios : S.usuarios;
  const ops = lista.map(n => '<option>' + esc(n) + '</option>').join('');
  return `<div class="login">
    <div class="logo">${iconoOla(56)}</div>
    <h1>Parque Acuático</h1>
    <p class="muted">Control de caja diario</p>
    ${DEMO ? '<div class="aviso">Modo demostración: los datos quedan solo en este teléfono. Para conectar la planilla, sigue el README.</div>' : ''}
    <label class="lbl">¿Quién eres?</label>
    <select id="lu" class="inp">${ops ? '<option value="">Elegir…</option>' + ops : '<option value="">Cargando usuarios…</option>'}</select>
    ${DEMO ? '' : '<label class="lbl">PIN</label><input id="lp" class="inp" type="password" inputmode="numeric" autocomplete="off" maxlength="8">'}
    <button class="btn primary big" data-act="login">Entrar</button>
    <p id="lerr" class="err"></p>
  </div>`;
}

function iconoOla(s) {
  return `<svg width="${s}" height="${s}" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#0b6e99"/><path d="M8 38c6 0 6-5 12-5s6 5 12 5 6-5 12-5 6 5 12 5v14H8z" fill="#7fd8f5"/><path d="M8 30c6 0 6-5 12-5s6 5 12 5 6-5 12-5 6 5 12 5" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="44" cy="16" r="6" fill="#ffd54f"/></svg>`;
}

function renderHeader() {
  const h = $('#hdr'); if (!h || !S.user) return;
  const n = getQueue().length;
  const st = {
    demo: ['demo', 'Modo demo'], idle: ['pend', '…'], sync: ['sync', 'Sincronizando…'],
    ok: ['ok', 'Al día con la planilla'], pending: ['pend', n + ' por enviar'],
    offline: ['off', 'Sin señal' + (n ? ' · ' + n + ' por enviar' : '')],
    error: ['err', 'Error: ' + (S.syncError || 'reintentar')]
  }[S.syncState] || ['pend', ''];
  h.innerHTML = `<div class="hdr-row">
      <div class="brand">${iconoOla(28)}<span>Parque Acuático</span></div>
      <button class="user" data-act="logout" title="Cerrar sesión">${esc(S.user.nombre)} <span class="muted">· salir</span></button>
    </div>
    <div class="hdr-row">
      <label class="fecha"><input type="date" id="fecha" value="${S.fecha}"><span>${esc(fechaLarga(S.fecha))}${S.fecha === hoy() ? ' · hoy' : ''}</span></label>
      <button class="sync s-${st[0]}" data-act="sync">${esc(st[1])}</button>
    </div>`;
}

function renderNav() {
  const nav = $('#nav'); if (!nav) return;
  const t = [['registrar', 'Registrar', '<path d="M12 5v14M5 12h14"/>'], ['dia', 'Grupos del día', '<path d="M4 6h16M4 12h16M4 18h10"/>'], ['caja', 'Caja', '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>']];
  nav.innerHTML = t.map(x => `<button class="${S.tab === x[0] ? 'on' : ''}" data-act="tab" data-v="${x[0]}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${x[2]}</svg><span>${x[1]}</span></button>`).join('');
}

function chips(field, opciones, valor, extra) {
  return `<div class="chips">${opciones.map(o => {
    const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
    return `<button type="button" class="chip ${String(valor) === String(v) ? 'on' : ''}" data-act="${extra || 'set'}" data-f="${field}" data-v="${esc(v)}">${esc(l)}</button>`;
  }).join('')}</div>`;
}
function stepper(field, valor, min) {
  return `<div class="stepper"><button type="button" data-act="step" data-f="${field}" data-v="-1" ${valor <= min ? 'disabled' : ''}>−</button><b>${valor}</b><button type="button" data-act="step" data-f="${field}" data-v="1">+</button></div>`;
}

function vistaRegistrar() {
  const f = S.form, c = S.config;
  const prev = S.editId ? S.registros.find(r => r.id === S.editId) : null;
  const usados = new Set(gruposActivos(S.editId).map(r => r.pulsera));
  const total = Calc.totalGrupo(f);
  const salida = sumarMin(f.entradaAuto && !prev && S.fecha === hoy() ? ahoraHM() : f.entrada, +f.minutos);
  const precioTxt = (+f.minutos === 60 ? '1 hora' : '½ hora');
  const otroDia = S.fecha !== hoy() && !prev;

  return `<section class="card form">
    ${prev ? `<div class="editando"><div><b>Editando grupo de ${esc(prev.nombre)}</b><small>Registrado por ${esc(prev.creadoPor || '?')} a las ${esc(horaDe(prev.creadoEn))}</small></div><button class="btn ghost sm" data-act="cancelar">Cancelar</button></div>` : ''}
    ${otroDia ? `<div class="aviso">Estás registrando en el ${esc(fechaLarga(S.fecha))}, no hoy.</div>` : ''}

    <div class="row2">
      <div><label class="lbl">Personas</label>${stepper('personas', f.personas, 1)}</div>
      <div><label class="lbl">Calcetas</label>${stepper('calcetas', f.calcetas, 0)}</div>
    </div>

    <label class="lbl" for="f-nombre">Nombre del grupo</label>
    <input id="f-nombre" class="inp" data-field="nombre" value="${esc(f.nombre)}" placeholder="Ej: Yamilet" autocomplete="off" autocapitalize="words">

    <label class="lbl">Tiempo</label>
    ${chips('minutos', [[30, '½ hora · ' + fmt(c.precio_media)], [60, '1 hora · ' + fmt(c.precio_hora)]], f.minutos)}

    <label class="lbl">Pulsera</label>
    <div class="colores">${c.colores.map(col => `<button type="button" class="color ${f.pulsera === col ? 'on' : ''} ${usados.has(col) ? 'usado' : ''}" data-act="set" data-f="pulsera" data-v="${esc(col)}"><i style="background:${colorHex(col)}"></i>${esc(col)}${usados.has(col) ? '<small>en uso</small>' : ''}</button>`).join('')}</div>

    <label class="lbl">Pago</label>
    ${chips('medio', ['Efectivo', 'Transferencia', 'Débito'], f.medio)}
    ${f.medio === 'Transferencia' ? `<label class="lbl">¿A qué cuenta llegó?</label>${chips('cuenta', c.socios, f.cuenta)}` : ''}
    ${f.medio === 'Débito' && !c.cuenta_debito ? '<p class="nota">La cuenta del débito aún no está definida. Se suma al total pero queda aparte en el reparto.</p>' : ''}

    <div class="row2">
      <div><label class="lbl" for="f-entrada">Entrada</label>
        <input id="f-entrada" class="inp" type="time" data-field="entrada" value="${esc(f.entradaAuto && !prev && S.fecha === hoy() ? ahoraHM() : f.entrada)}">
        ${f.entradaAuto && !prev && S.fecha === hoy() ? '<small class="muted">Se usa la hora al registrar</small>' : ''}
      </div>
      <div><label class="lbl">Salida</label><div class="salida">${salida}</div></div>
    </div>

    <label class="lbl" for="f-obs">Observaciones</label>
    <input id="f-obs" class="inp" data-field="obs" value="${esc(f.obs)}" placeholder="Opcional" autocomplete="off">

    ${prev ? `<div class="devol">
      <label class="lbl" for="f-dev">Devolución al cliente</label>
      <input id="f-dev" class="inp" data-field="devolucion" inputmode="numeric" value="${esc(f.devolucion)}" placeholder="$0">
      <label class="lbl">Se devolvió desde</label>${chips('devolucionDesde', ['Efectivo'].concat(c.socios), f.devolucionDesde)}
    </div>` : ''}

    <div class="total">
      <div><small>${f.personas} × ${fmt(f.precioPersona)} (${precioTxt})${+f.calcetas ? ' + ' + f.calcetas + ' calc. × ' + fmt(f.precioCalceta) : ''}</small>
      <b>${fmt(total)}</b>${prev && +String(f.devolucion).replace(/\D/g, '') ? `<small>Neto tras devolución: ${fmt(total - (+String(f.devolucion).replace(/\D/g, '')))}</small>` : ''}</div>
      <button class="btn primary big" data-act="guardar">${prev ? 'Guardar cambios' : 'Registrar grupo'}</button>
    </div>
    ${prev ? `<button class="btn ghost danger" data-act="${prev.estado === 'anulado' ? 'restaurar' : 'anular'}" data-v="${prev.id}">${prev.estado === 'anulado' ? 'Restaurar grupo' : 'Anular grupo'}</button>` : ''}
  </section>
  ${!prev ? vistaActivosMini() : ''}`;
}

function vistaActivosMini() {
  const act = gruposActivos();
  if (!act.length) return '';
  return `<section class="card"><h3>En el agua ahora</h3>${act.map(r => {
    const e = estadoGrupo(r);
    return `<div class="mini ${e.cls}" data-act="edit" data-v="${r.id}"><i style="background:${colorHex(r.pulsera)}"></i><span>${esc(r.nombre)} · ${r.personas}p</span><b>${esc(e.corto)}</b></div>`;
  }).join('')}</section>`;
}

function estadoGrupo(r) {
  if (r.estado === 'anulado') return { cls: 'anulado', txt: 'Anulado', corto: 'Anulado' };
  if (r.fecha !== hoy()) return { cls: 'fin', txt: '', corto: '' };
  const now = minutosDe(ahoraHM()), ent = minutosDe(r.entrada), sal = ent + (+r.minutos);
  if (now < ent) return { cls: 'prox', txt: 'Entra a las ' + r.entrada, corto: r.entrada };
  if (now < sal) {
    const q = sal - now;
    return q <= 5 ? { cls: 'aviso', txt: '¡Quedan ' + q + ' min!', corto: q + ' min' } : { cls: 'activo', txt: 'En el agua · quedan ' + q + ' min', corto: q + ' min' };
  }
  return { cls: 'fin', txt: 'Terminado', corto: 'Terminó' };
}

function vistaDia() {
  const r = Calc.resumen(S.registros, S.gastos, S.config);
  const lista = S.registros.slice().sort((a, b) => minutosDe(a.entrada) - minutosDe(b.entrada));
  const vacio = !lista.length;
  return `<section class="stats">
      <div><b>${r.grupos}</b><small>grupos</small></div>
      <div><b>${r.personas}</b><small>personas</small></div>
      <div><b>${r.calcetas}</b><small>calcetas</small></div>
      <div><b>${fmt(r.recaudado)}</b><small>recaudado</small></div>
    </section>
    ${vacio ? `<section class="card vacio"><p>No hay grupos registrados el ${esc(fechaLarga(S.fecha))}.</p>
      <button class="btn primary" data-act="tab" data-v="registrar">Registrar el primero</button>
      ${DEMO ? '<button class="btn ghost" data-act="ejemplo">Cargar día de ejemplo (planilla 9 de marzo)</button>' : ''}</section>` : ''}
    ${lista.map(x => {
      const e = estadoGrupo(x);
      const pago = x.medio === 'Transferencia' ? 'Transf. ' + x.cuenta : x.medio;
      return `<article class="grupo ${e.cls}" data-act="edit" data-v="${x.id}">
        <i class="pulsera" style="background:${colorHex(x.pulsera)}" title="${esc(x.pulsera)}"></i>
        <div class="g-main">
          <div class="g-top"><b>${esc(x.nombre)}</b><span class="g-total">${fmt(x.total)}</span></div>
          <div class="g-det">${x.personas} pers · ${+x.minutos === 60 ? '1 h' : '½ h'} · ${x.entrada}–${x.salida}${+x.calcetas ? ' · ' + x.calcetas + ' calc.' : ''} · ${esc(pago)}</div>
          ${e.txt ? `<div class="g-estado">${esc(e.txt)}</div>` : ''}
          ${+x.devolucion ? `<div class="g-dev">Devolución ${fmt(x.devolucion)} (${esc(x.devolucionDesde)})</div>` : ''}
          ${x.obs ? `<div class="g-obs">${esc(x.obs)}</div>` : ''}
          <div class="g-quien">Registró ${esc(x.creadoPor || '?')} ${esc(horaDe(x.creadoEn))}${x.editadoPor ? ' · ' + (x.estado === 'anulado' ? 'anuló' : 'editó') + ' ' + esc(x.editadoPor) + ' ' + esc(horaDe(x.editadoEn)) : ''}</div>
        </div>
      </article>`;
    }).join('')}`;
}

function vistaCaja() {
  const r = Calc.resumen(S.registros, S.gastos, S.config);
  const g = S.gform, c = S.config;
  const cambiosPostCierre = S.cierre && Math.round(S.cierre.neto) !== Math.round(r.netoTotal);
  const fila = (l, v, cls) => `<div class="fila ${cls || ''}"><span>${l}</span><b>${v}</b></div>`;

  return `<section class="card">
    <h3>Ingresos</h3>
    ${fila('Efectivo', fmt(r.efectivo))}
    ${r.socios.map(s => fila('Transferencias a ' + esc(s), fmt(r.transf[s] || 0))).join('')}
    ${r.debito || c.cuenta_debito ? fila('Débito' + (r.cuentaDebito ? ' (cuenta ' + esc(r.cuentaDebito) + ')' : ' · cuenta pendiente'), fmt(r.debito)) : ''}
    ${r.devol ? fila('Devoluciones', '−' + fmt(r.devol), 'neg') : ''}
    ${fila('Total recaudado', fmt(r.recaudado), 'tot')}
  </section>

  <section class="card">
    <h3>Gastos del día</h3>
    ${r.listaGastos.length ? r.listaGastos.map(x => `<div class="fila gasto"><span>${esc(x.concepto)}<small>${x.pagadoDesde === 'Efectivo' ? 'De la caja' : 'Lo pagó ' + esc(x.pagadoDesde)} · ${esc(x.creadoPor || '')}</small></span><b>−${fmt(x.monto)}</b><button class="x" data-act="anular-gasto" data-v="${x.id}" aria-label="Anular gasto">×</button></div>`).join('') : '<p class="muted">Sin gastos registrados.</p>'}
    <div class="gform">
      <div class="chips mini-chips">${['Almuerzo', 'Bencina', 'Hielo', 'Bolsas'].map(q => `<button type="button" class="chip" data-act="gq" data-v="${q}">${q}</button>`).join('')}</div>
      <div class="row2">
        <input class="inp" data-gfield="concepto" value="${esc(g.concepto)}" placeholder="Concepto" autocomplete="off">
        <input class="inp" data-gfield="monto" value="${esc(g.monto)}" placeholder="Monto" inputmode="numeric">
      </div>
      <label class="lbl">Pagado con</label>
      ${chips('pagadoDesde', [['Efectivo', 'Efectivo de la caja']].concat(c.socios.map(s => [s, 'Plata de ' + s])), g.pagadoDesde, 'gset')}
      <button class="btn" data-act="agregar-gasto">Agregar gasto</button>
    </div>
    ${r.totalGastos ? fila('Total gastos', '−' + fmt(r.totalGastos), 'neg') : ''}
  </section>

  <section class="card reparto">
    <h3>Reparto entre socios</h3>
    ${fila('Neto del día', fmt(r.netoTotal), 'tot')}
    ${r.debitoPendiente ? `<p class="nota">Hay ${fmt(r.debitoPendiente)} en débito sin cuenta definida. No se reparte todavía.</p>` : ''}
    ${fila('A cada uno (÷' + r.socios.length + ')', fmt(r.parte))}
    ${fila('Efectivo en caja', fmt(r.caja))}
    <div class="socios">${r.socios.map(s => {
      const e = r.entregar[s];
      return `<div class="socio"><h4>${esc(s)}</h4>
        <div class="fila"><span>Ya tiene en su cuenta</span><b>${fmt(r.tiene[s])}</b></div>
        ${e >= 0 ? `<div class="fila hl"><span>Se lleva en efectivo</span><b>${fmt(e)}</b></div>` : `<div class="fila hl neg"><span>Debe transferir</span><b>${fmt(-e)}</b></div>`}
      </div>`;
    }).join('')}</div>
    ${r.ajustes.map(a => `<p class="nota">${esc(a.de)} recibió más de su parte por transferencia: debe pasarle ${fmt(a.monto)} ${a.a ? 'a ' + esc(a.a) : 'a los demás'}.</p>`).join('')}
  </section>

  <section class="card">
    <h3>Inventario del día</h3>
    ${fila('Personas ½ hora', r.personasMedia)}
    ${fila('Personas 1 hora', r.personasHora)}
    ${fila('Calcetas vendidas', r.calcetas)}
  </section>

  <section class="card cierre">
    ${S.cierre ? `<p class="ok-txt">Caja cerrada por <b>${esc(S.cierre.cerradoPor)}</b> a las ${esc(horaDe(S.cierre.cerradoEn))}.</p>` : ''}
    ${cambiosPostCierre ? '<p class="nota">Hubo cambios después del cierre. Vuelve a cerrar para actualizar la planilla.</p>' : ''}
    <button class="btn primary big" data-act="cerrar">${S.cierre ? 'Volver a cerrar caja' : 'Cerrar caja del día'}</button>
    <button class="btn ghost" data-act="compartir">Compartir resumen (WhatsApp)</button>
  </section>`;
}

/* =========================================================
   Eventos
   ========================================================= */
const ACT = {
  login, logout, sync: () => DEMO ? toast('Modo demo: no hay planilla conectada') : sync(),
  tab(v) {
    if (S.editId) { S.editId = null; S.form = nuevoForm(); }
    else if (v === 'registrar' && S.form && !S.form.nombre) { S.form.pulsera = sugerirColor(); }
    S.tab = v; render(true); window.scrollTo(0, 0);
  },
  set(v, el) {
    const f = el.dataset.f;
    S.form[f] = (f === 'minutos') ? +v : v;
    if (f === 'minutos') {
      const prev = S.editId ? S.registros.find(r => r.id === S.editId) : null;
      S.form.precioPersona = (prev && +prev.minutos === +v) ? +prev.precioPersona : Calc.precioPersona(S.config, v);
    }
    if (f === 'medio' && v !== 'Transferencia') S.form.cuenta = '';
    renderTab(true);
  },
  step(v, el) { const f = el.dataset.f; S.form[f] = Math.max(f === 'personas' ? 1 : 0, (+S.form[f] || 0) + (+v)); renderTab(true); },
  guardar: guardarGrupo,
  cancelar() { S.editId = null; S.form = nuevoForm(); S.tab = 'dia'; render(true); },
  edit(v) { const r = S.registros.find(x => x.id === v); if (!r) return; S.editId = v; S.form = formDesde(r); S.tab = 'registrar'; render(true); window.scrollTo(0, 0); },
  anular(v) { cambiarEstado(v, 'anulado'); },
  restaurar(v) { cambiarEstado(v, 'ok'); },
  gq(v) { S.gform.concepto = v; renderTab(true); const m = document.querySelector('[data-gfield="monto"]'); if (m) m.focus(); },
  gset(v) { S.gform.pagadoDesde = v; renderTab(true); },
  'agregar-gasto': agregarGasto,
  'anular-gasto': anularGasto,
  cerrar: cerrarCaja,
  compartir,
  ejemplo: cargarEjemplo
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act]; if (fn) { e.preventDefault(); fn(el.dataset.v, el); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.field && S.form) {
    S.form[t.dataset.field] = t.value;
    if (t.dataset.field === 'entrada') {
      S.form.entradaAuto = false;
      const s = document.querySelector('.salida'); if (s) s.textContent = sumarMin(t.value, +S.form.minutos);
    }
    if (t.dataset.field === 'devolucion') { /* total se actualiza al salir del campo */ }
  }
  if (t.dataset.gfield) S.gform[t.dataset.gfield] = t.value;
});
document.addEventListener('change', e => {
  if (e.target.id === 'fecha' && e.target.value) {
    S.fecha = e.target.value; S.editId = null; S.form = nuevoForm(); loadDay(); render(true); sync();
  }
  if (e.target.dataset.field === 'devolucion') renderTab(true);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'lp') login();
  if (e.key === 'Enter' && e.target.id === 'f-nombre') { e.target.blur(); }
});
document.addEventListener('focusout', () => {
  setTimeout(() => { if (S.dirty && !inputConFoco()) renderTab(true); }, 350);
});
window.addEventListener('online', sync);
window.addEventListener('offline', () => { if (!DEMO) { S.syncState = 'offline'; renderHeader(); } });

// Refresco: cuenta regresiva cada 30 s, sincronización cada 30 s
setInterval(() => {
  if (!S.user) return;
  if (S.fecha === hoy() && (S.tab === 'dia' || (S.tab === 'registrar' && !S.editId))) renderTab(false);
  sync();
}, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });

/* ---------- inicio ---------- */
loadDay();
if (S.user) S.form = nuevoForm();
render(true);
if (S.user) sync(); else cargarUsuarios();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { });
}
