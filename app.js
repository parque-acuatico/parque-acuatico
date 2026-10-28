'use strict';
/* =========================================================
   Parque Acuático · Caja — app principal
   ========================================================= */

const API_URL = ((window.APP_CONFIG || {}).API_URL || '').trim();
const DEMO = !API_URL;
const TABS = ['registrar', 'dia', 'inventario', 'caja'];
const REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

const DEFAULT_CONFIG = {
  precio_media: 6000,
  precio_hora: 10000,
  socios: ['Víctor', 'Yessi'],
  cuenta_debito: '',
  color_media: 'Verde',
  color_hora: 'Rojo',
  productos: [{ id: 'calcetas', nombre: 'Calcetas', precio: 2000, aviso_bajo: 5 }]
};

const COLOR_HEX = {
  rojo: '#e53935', azul: '#1e88e5', verde: '#43a047', amarillo: '#fdd835', naranjo: '#fb8c00', naranja: '#fb8c00',
  morado: '#8e24aa', rosado: '#f06292', rosa: '#f06292', blanco: '#fafafa', negro: '#212121', celeste: '#4fc3f7',
  cafe: '#795548', gris: '#9e9e9e', fucsia: '#d81b60', turquesa: '#26a69a', dorado: '#c9a227',
  plateado: '#b0bec5', lila: '#b39ddb', verdeagua: '#64ffda', verdelimon: '#c0ca33', limon: '#c0ca33'
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
function segAhora() { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); }
function nowLocal() { const d = new Date(); return hoy() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
function minutosDe(hm) { const p = String(hm || '0:0').split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0); }
function sumarMin(hm, m) { const t = ((minutosDe(hm) + m) % 1440 + 1440) % 1440; return pad(Math.floor(t / 60)) + ':' + pad(t % 60); }
/* Hora de entrada: siempre a los 5 minutos siguientes (10:51 → 10:55; 10:55 → 10:55) */
function redondear5(hm) { const r = Math.ceil(minutosDe(hm) / 5) * 5; return pad(Math.floor(r / 60) % 24) + ':' + pad(r % 60); }
function entradaPropuesta() { return redondear5(ahoraHM()); }
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
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.className = ''; }, 2800);
}
function soltarFoco() { const a = document.activeElement; if (a && a.blur && a !== document.body) a.blur(); }
const tiempoTxt = m => +m === 60 ? '1 hora' : '½ hora';
function colorDe(minutos) { return +minutos === 60 ? S.config.color_hora : S.config.color_media; }
function esVenta(r) { return !(+r.personas > 0) || !(+r.minutos > 0); }
function textoProductos(lista) { return lista.map(p => p.nombre + ' ×' + p.cant).join(', '); }

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

/* ---------- estado ---------- */
const S = {
  user: LS.get('pa_user', null),
  config: null,
  usuarios: LS.get('pa_usuarios', []),
  fecha: hoy(),
  registros: [], gastos: [], inventario: [], stockPrevio: {}, cierre: null,
  tab: 'registrar',
  editId: null,
  form: null,
  gform: { concepto: '', monto: '', pagadoDesde: 'Efectivo' },
  iform: { producto: '', tipo: 'inicial', cantidad: '', nota: '' },
  syncState: DEMO ? 'demo' : 'idle', syncError: '', syncing: false,
  alertas: [], sonidoTimer: null, sonidoHasta: 0,
  wl: null, wlPidiendo: false
};

function normalizarConfig(c) {
  const out = Object.assign({}, DEFAULT_CONFIG, c || {});
  if (!out.socios || !out.socios.length) out.socios = DEFAULT_CONFIG.socios;
  if (!out.color_media) out.color_media = DEFAULT_CONFIG.color_media;
  if (!out.color_hora) out.color_hora = DEFAULT_CONFIG.color_hora;
  if (!Array.isArray(c && c.productos) || !c.productos.length) {
    // servidor antiguo: solo tenía precio de calcetas
    const pc = c && +c.precio_calceta;
    out.productos = [{ id: 'calcetas', nombre: 'Calcetas', precio: pc || 2000, aviso_bajo: 5 }];
  }
  out.productos = out.productos.map(p => ({ id: String(p.id), nombre: String(p.nombre || p.id), precio: +p.precio || 0, aviso_bajo: +p.aviso_bajo || 0 }));
  return out;
}
S.config = normalizarConfig(LS.get('pa_config', null));
const idsProductos = () => S.config.productos.map(p => p.id);
const productoPorId = id => S.config.productos.find(p => p.id === id);

function dayKey(f) { return 'pa_day_' + f; }
function previoLocal() {
  const movs = [], regs = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.indexOf('pa_day_') !== 0) continue;
      const f = k.slice(7);
      if (f >= S.fecha) continue;
      const d = LS.get(k, {}) || {};
      (d.inventario || []).forEach(m => movs.push(Object.assign({}, m, { fecha: f })));
      (d.registros || []).forEach(r => regs.push(Object.assign({}, r, { fecha: f })));
    }
  } catch (e) { }
  return Calc.stockAntes(S.fecha, idsProductos(), movs, regs);
}
function loadDay() {
  const d = LS.get(dayKey(S.fecha), {}) || {};
  S.registros = d.registros || []; S.gastos = d.gastos || []; S.inventario = d.inventario || [];
  S.cierre = d.cierre || null;
  S.stockPrevio = (!DEMO && d.stockPrevio) ? d.stockPrevio : previoLocal();
}
function saveDay() {
  LS.set(dayKey(S.fecha), { registros: S.registros, gastos: S.gastos, inventario: S.inventario, cierre: S.cierre, stockPrevio: DEMO ? null : S.stockPrevio });
}
function stockHoy() { return Calc.stockDia(idsProductos(), S.stockPrevio, S.inventario, S.registros); }
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
  else if (kind === 'inventario') S.inventario = upsertArr(S.inventario, obj);
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
  S.config = normalizarConfig(c);
  LS.set('pa_config', c);
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
      let regs = d.registros || [], gas = d.gastos || [], inv = d.inventario || [], cierre = d.cierre || null;
      getQueue().filter(o => o.fecha === fecha).forEach(o => {
        if (o.kind === 'registro') regs = upsertArr(regs, o.data);
        else if (o.kind === 'gasto') gas = upsertArr(gas, o.data);
        else if (o.kind === 'inventario') inv = upsertArr(inv, o.data);
        else if (o.kind === 'cierre') cierre = o.data;
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

/* ---------- tiempos de los grupos ---------- */
function registrosDeHoy() {
  return S.fecha === hoy() ? S.registros : ((LS.get(dayKey(hoy()), {}) || {}).registros || []);
}
function segEntrada(r) { return minutosDe(r.entrada) * 60; }
function segSalida(r) { return segEntrada(r) + (+r.minutos) * 60; }
function gruposActivos(excluirId) {
  if (S.fecha !== hoy()) return [];
  const now = segAhora();
  return S.registros.filter(r => r.estado !== 'anulado' && !esVenta(r) && r.id !== excluirId &&
    now >= segEntrada(r) - 300 && now < segSalida(r));
}
function estadoGrupo(r) {
  if (r.estado === 'anulado') return { cls: 'anulado', txt: 'Anulado', corto: 'Anulado', pct: null };
  if (esVenta(r)) return { cls: 'venta', txt: '', corto: '', pct: null };
  if (r.fecha !== hoy()) return { cls: 'fin', txt: '', corto: '', pct: null };
  const now = segAhora(), ent = segEntrada(r), sal = segSalida(r);
  if (now < ent) {
    const q = Math.ceil((ent - now) / 60);
    return { cls: 'prox', txt: 'Entra a las ' + r.entrada + ' · en ' + q + ' min', corto: 'entra ' + r.entrada, pct: 0 };
  }
  if (now < sal) {
    const q = Math.ceil((sal - now) / 60);
    const pct = Math.round((now - ent) / (sal - ent) * 1000) / 10;
    return q <= 5
      ? { cls: 'pronto', txt: '¡Quedan ' + q + ' min!', corto: q + ' min', pct }
      : { cls: 'activo', txt: 'En el agua · quedan ' + q + ' min', corto: q + ' min', pct };
  }
  return { cls: 'fin', txt: 'Terminó a las ' + r.salida, corto: 'Terminó', pct: null };
}
function barra(e) { return e.pct == null ? '' : `<div class="barra"><span style="width:${e.pct}%"></span></div>`; }

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
function notificar(r) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
    navigator.serviceWorker.ready.then(reg => reg.showNotification('⏰ Terminó el tiempo · pulsera ' + r.pulsera, {
      body: r.nombre + ' · ' + r.personas + ' personas · salida ' + r.salida,
      tag: 'fin-' + r.id, renotify: true, requireInteraction: true,
      icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [400, 150, 400, 150, 700]
    })).catch(() => { });
  } catch (e) { }
}
function revisarAlertas() {
  if (!S.user) return;
  const k = 'pa_avisos_' + hoy(), vistos = LS.get(k, {}), now = segAhora();
  let cambio = false; const nuevos = [];
  registrosDeHoy().forEach(r => {
    if (r.estado === 'anulado' || esVenta(r)) return;
    const id = r.id + '@' + r.salida, sal = segSalida(r);
    if (vistos[id] || now < sal) return;
    vistos[id] = 1; cambio = true;
    if (now - sal <= 600) nuevos.push(r);   // terminó hace menos de 10 min: avisar
  });
  if (cambio) LS.set(k, vistos);
  if (!nuevos.length) return;
  nuevos.forEach(r => { S.alertas = S.alertas.filter(a => a.id !== r.id).concat([r]); });
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
      ${S.alertas.map(r => `<div class="al-grupo" data-key="al-${r.id}"><i style="background:${colorHex(r.pulsera)}"></i><div><b>Pulsera ${esc(r.pulsera)} · ${tiempoTxt(r.minutos)}</b><span>${esc(r.nombre)} · ${r.personas} pers · salida ${esc(r.salida)}</span></div></div>`).join('')}
      <button class="btn primary big" data-act="alerta-ok">Listo, ya salieron</button>
    </div>`;
  if (el.hidden || !el.firstElementChild) { el.innerHTML = html; el.hidden = false; void el.offsetWidth; el.classList.add('show'); }
  else morph(el, html);
}

/* Pantalla encendida mientras haya grupos en el agua, para que la alerta suene a tiempo */
async function pantallaEncendida() {
  if (!('wakeLock' in navigator) || S.wlPidiendo) return;
  const now = segAhora();
  const hace = !!S.user && !document.hidden &&
    registrosDeHoy().some(r => r.estado !== 'anulado' && !esVenta(r) && now >= segEntrada(r) - 600 && now < segSalida(r) + 60);
  try {
    if (hace && !S.wl) {
      S.wlPidiendo = true;
      S.wl = await navigator.wakeLock.request('screen');
      S.wl.addEventListener('release', () => { S.wl = null; });
    } else if (!hace && S.wl) { await S.wl.release(); S.wl = null; }
  } catch (e) { /* el navegador no lo permitió */ }
  S.wlPidiendo = false;
}

/* ---------- formulario de grupo ---------- */
function itemsNuevos() { return S.config.productos.map(p => ({ id: p.id, nombre: p.nombre, precio: p.precio, cant: 0, orig: 0 })); }
function itemsDesde(r) {
  const vend = Calc.productosDe(r);
  const items = vend.map(p => ({ id: p.id, nombre: p.nombre, precio: +p.precio, cant: +p.cant, orig: +p.cant }));
  S.config.productos.forEach(p => { if (!items.find(i => i.id === p.id)) items.push({ id: p.id, nombre: p.nombre, precio: p.precio, cant: 0, orig: 0 }); });
  return items;
}
function nuevoForm() {
  return {
    personas: 2, nombre: '', minutos: 30, items: itemsNuevos(),
    medio: 'Efectivo', cuenta: '', entrada: entradaPropuesta(), entradaAuto: true, obs: '',
    devolucion: '', devolucionDesde: 'Efectivo',
    precioPersona: S.config.precio_media
  };
}
function formDesde(r) {
  return {
    personas: +r.personas, nombre: r.nombre, minutos: +r.minutos || 30, items: itemsDesde(r),
    medio: r.medio, cuenta: r.cuenta || '', entrada: r.entrada, entradaAuto: false, obs: r.obs || '',
    devolucion: +r.devolucion ? String(r.devolucion) : '', devolucionDesde: r.devolucionDesde || 'Efectivo',
    precioPersona: +r.precioPersona || Calc.precioPersona(S.config, +r.minutos || 30)
  };
}
function entradaAutoActiva() { return S.form.entradaAuto && !S.editId && S.fecha === hoy(); }
function productosDelForm() { return S.form.items.filter(i => +i.cant > 0).map(i => ({ id: i.id, nombre: i.nombre, cant: +i.cant, precio: +i.precio })); }
function totalForm() {
  const f = S.form;
  return Calc.totalGrupo({ personas: f.personas, precioPersona: f.precioPersona, productos: productosDelForm() });
}

function guardarGrupo() {
  const f = S.form;
  const nombre = (f.nombre || '').trim();
  const productos = productosDelForm();
  const venta = !(+f.personas > 0);
  if (!nombre) return toast(venta ? 'Escribe a nombre de quién es la compra' : 'Falta el nombre del grupo', 'err');
  if (venta && !productos.length) return toast('Agrega personas o algún producto', 'err');
  if (f.medio === 'Transferencia' && !f.cuenta) return toast('Elige a qué cuenta llegó la transferencia', 'err');
  soltarFoco();
  pedirPermisoNotif();
  audioCtx();
  const prev = S.editId ? S.registros.find(r => r.id === S.editId) : null;
  const entrada = venta ? (prev ? prev.entrada : (S.fecha === hoy() ? ahoraHM() : f.entrada))
    : (entradaAutoActiva() ? entradaPropuesta() : f.entrada);
  const minutos = venta ? 0 : +f.minutos;
  const dev = Math.max(0, parseInt(String(f.devolucion).replace(/\D/g, ''), 10) || 0);
  const calc = productos.find(p => p.id === 'calcetas');
  const rec = Object.assign({}, prev || {}, {
    id: prev ? prev.id : uid(),
    fecha: S.fecha,
    entrada, salida: venta ? '' : sumarMin(entrada, minutos),
    personas: +f.personas, nombre, pulsera: venta ? '' : colorDe(minutos), minutos,
    productos,
    calcetas: calc ? calc.cant : 0, precioCalceta: calc ? calc.precio : 0,
    medio: f.medio, cuenta: f.medio === 'Transferencia' ? f.cuenta : '',
    precioPersona: venta ? 0 : +f.precioPersona,
    obs: (f.obs || '').trim(),
    devolucion: dev, devolucionDesde: dev ? f.devolucionDesde : '',
    estado: prev ? prev.estado : 'ok'
  });
  rec.total = Calc.totalGrupo(rec);
  if (prev) { rec.editadoPor = S.user.nombre; rec.editadoEn = nowLocal(); }
  else { rec.creadoPor = S.user.nombre; rec.creadoEn = nowLocal(); }
  guardarLocal('registro', rec);
  const msg = prev ? 'Cambios guardados'
    : venta ? 'Venta: ' + textoProductos(productos) + ' · ' + fmt(rec.total)
      : nombre + ' · pulsera ' + rec.pulsera + ' · ' + rec.entrada + '–' + rec.salida + ' · ' + fmt(rec.total);
  toast(msg, 'ok');
  avisarStockBajo(productos);
  if (prev) irA('dia', () => { S.editId = null; S.form = nuevoForm(); });
  else { S.form = nuevoForm(); renderTab(); window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' }); }
  pantallaEncendida();
}
function avisarStockBajo(productos) {
  const st = stockHoy();
  const bajos = productos.map(p => ({ p: productoPorId(p.id), s: st[p.id] }))
    .filter(x => x.p && x.s && x.s.queda != null && x.s.queda <= x.p.aviso_bajo);
  if (bajos.length) setTimeout(() => toast('Quedan pocas: ' + bajos.map(x => x.p.nombre + ' ' + x.s.queda).join(', '), 'warn'), 2900);
}

function cambiarEstado(id, estado) {
  const r = S.registros.find(x => x.id === id); if (!r) return;
  const quien = esVenta(r) ? 'la venta de ' : 'el grupo de ';
  const msg = estado === 'anulado' ? '¿Anular ' + quien + r.nombre + '? Quedará registrado quién lo anuló.' : '¿Restaurar ' + quien + r.nombre + '?';
  if (!confirm(msg)) return;
  guardarLocal('registro', Object.assign({}, r, { estado, editadoPor: S.user.nombre, editadoEn: nowLocal() }));
  toast(estado === 'anulado' ? 'Anulado' : 'Restaurado');
  irA('dia', () => { S.editId = null; S.form = nuevoForm(); });
}

/* ---------- inventario ---------- */
const TIPOS_MOV = [
  ['inicial', 'Stock al abrir', '¿Cuántas hay al abrir?'],
  ['ingreso', 'Llegó mercadería', '¿Cuántas llegaron?'],
  ['conteo', 'Contar ahora', '¿Cuántas hay ahora?']
];
function guardarMovimiento() {
  const f = S.iform;
  const p = productoPorId(f.producto) || S.config.productos[0];
  if (!p) return toast('No hay productos configurados', 'err');
  const cant = parseInt(String(f.cantidad).replace(/\D/g, ''), 10);
  if (isNaN(cant)) return toast('Escribe la cantidad', 'err');
  if (f.tipo === 'ingreso' && cant <= 0) return toast('La cantidad que llegó debe ser mayor que 0', 'err');
  soltarFoco();
  const st = stockHoy()[p.id];
  let tipo = f.tipo, cantidad = cant, nota = (f.nota || '').trim(), msg;
  if (f.tipo === 'conteo') {
    if (st.queda == null) {
      // Primer conteo del día después de haber vendido: se calcula con cuánto se abrió
      tipo = 'inicial';
      cantidad = cant + st.vendidas - st.entradas - st.ajustes;
      nota = ('Contadas ' + cant + ' a las ' + ahoraHM() + '. ' + nota).trim();
      msg = p.nombre + ': quedan ' + cant;
    } else {
      tipo = 'ajuste';
      cantidad = cant - st.queda;
      nota = ('Conteo: ' + cant + ' (sistema decía ' + st.queda + '). ' + nota).trim();
      msg = cantidad === 0 ? p.nombre + ': el conteo cuadra' : p.nombre + ': diferencia ' + (cantidad > 0 ? '+' : '') + cantidad + ' corregida';
    }
  } else msg = f.tipo === 'inicial' ? p.nombre + ': se abre con ' + cant : p.nombre + ': +' + cant + ' llegaron';
  guardarLocal('inventario', {
    id: uid(), fecha: S.fecha, producto: p.id, tipo, cantidad, nota,
    estado: 'ok', creadoPor: S.user.nombre, creadoEn: nowLocal()
  });
  S.iform = { producto: p.id, tipo: f.tipo, cantidad: '', nota: '' };
  toast(msg, cantidad !== 0 && f.tipo === 'conteo' ? 'warn' : 'ok');
  renderTab();
}
function anularMovimiento(id) {
  const m = S.inventario.find(x => x.id === id); if (!m) return;
  if (!confirm('¿Anular este movimiento de inventario?')) return;
  guardarLocal('inventario', Object.assign({}, m, { estado: 'anulado', editadoPor: S.user.nombre, editadoEn: nowLocal() }));
  renderTab();
}

/* ---------- gastos y cierre ---------- */
function agregarGasto() {
  const g = S.gform;
  const monto = parseInt(String(g.monto).replace(/\D/g, ''), 10) || 0;
  if (!g.concepto.trim()) return toast('Escribe el concepto del gasto', 'err');
  if (monto <= 0) return toast('Escribe el monto del gasto', 'err');
  soltarFoco();
  guardarLocal('gasto', {
    id: uid(), fecha: S.fecha, concepto: g.concepto.trim(), monto, pagadoDesde: g.pagadoDesde,
    estado: 'ok', creadoPor: S.user.nombre, creadoEn: nowLocal()
  });
  S.gform = { concepto: '', monto: '', pagadoDesde: 'Efectivo' };
  toast('Gasto agregado'); renderTab();
}
function anularGasto(id) {
  const g = S.gastos.find(x => x.id === id); if (!g) return;
  if (!confirm('¿Anular el gasto "' + g.concepto + '" de ' + fmt(g.monto) + '?')) return;
  guardarLocal('gasto', Object.assign({}, g, { estado: 'anulado', editadoPor: S.user.nombre, editadoEn: nowLocal() }));
  renderTab();
}
function cerrarCaja() {
  const r = Calc.resumen(S.registros, S.gastos, S.config);
  if (!r.grupos && !r.ventasSueltas) return toast('No hay ventas registradas este día', 'err');
  if (!confirm('¿Cerrar la caja del ' + fechaLarga(S.fecha) + '?\nTotal: ' + fmt(r.recaudado) + ' · Neto: ' + fmt(r.netoTotal))) return;
  const st = stockHoy();
  guardarLocal('cierre', {
    fecha: S.fecha, cerradoPor: S.user.nombre, cerradoEn: nowLocal(),
    totalBruto: r.bruto, devoluciones: r.devol, gastos: r.totalGastos, neto: r.netoTotal,
    efectivoCaja: r.caja, debitoPendiente: r.debitoPendiente,
    reparto: r.socios.map(s => s + ': ' + fmt(r.tiene[s]) + ' en cuenta + ' + (r.entregar[s] >= 0 ? fmt(r.entregar[s]) + ' efectivo' : 'debe pasar ' + fmt(-r.entregar[s]))).join(' · '),
    detalle: JSON.stringify({ efectivo: r.efectivo, transf: r.transf, debito: r.debito, grupos: r.grupos, personas: r.personas, productos: r.porProducto, entregar: r.entregar }),
    efectivo: r.efectivo,
    transferencias: r.socios.map(s => s + ' ' + fmt(r.transf[s] || 0)).join(' · '),
    debito: r.debito,
    ventaEntradas: r.ventaMedia + r.ventaHora,
    ventaProductos: r.ventaProductos,
    personas: r.personas,
    productosVendidos: Object.keys(r.porProducto).map(k => r.porProducto[k].nombre + ' ×' + r.porProducto[k].cant).join(', '),
    stockFinal: S.config.productos.map(p => p.nombre + ': ' + (st[p.id].queda == null ? 'sin conteo' : st[p.id].queda)).join(' · ')
  });
  toast('Caja cerrada', 'ok'); renderTab();
}
function textoResumen() {
  const r = Calc.resumen(S.registros, S.gastos, S.config);
  const st = stockHoy();
  const L = [];
  L.push('🌊 Parque Acuático — ' + fechaLarga(S.fecha));
  L.push('Grupos: ' + r.grupos + ' · Personas: ' + r.personas + ' (½h ' + r.personasMedia + ' · 1h ' + r.personasHora + ')');
  Object.keys(r.porProducto).forEach(k => L.push(r.porProducto[k].nombre + ' vendidas: ' + r.porProducto[k].cant + ' (' + fmt(r.porProducto[k].monto) + ')'));
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
  const stock = S.config.productos.filter(p => st[p.id].queda != null).map(p => p.nombre + ' ' + st[p.id].queda);
  if (stock.length) { L.push(''); L.push('Stock que queda: ' + stock.join(' · ')); }
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
  const c = S.config, socios = c.socios, pc = productoPorId('calcetas') || c.productos[0];
  const filas = [
    [4, 'Usett', 30, 0, 'Efectivo', '', '13:10'], [2, 'Yamilet', 30, 2, 'Transferencia', socios[0], '14:20'],
    [2, 'Felipe', 30, 2, 'Efectivo', '', '15:50'], [2, 'Gerardo Rodríguez', 30, 2, 'Transferencia', socios[0], '16:35'],
    [2, 'Leonor Núñez', 30, 0, 'Transferencia', socios[1], '17:00'], [2, 'Gabriel Espínola', 30, 2, 'Efectivo', '', '17:15'],
    [4, 'Catalina Olivina', 30, 4, 'Transferencia', socios[1], '17:15'], [7, 'Víctor Alvial', 60, 0, 'Efectivo', '', '17:30'],
    [2, 'Estrella Osorio', 30, 2, 'Transferencia', socios[1], '17:45'], [3, 'Saúl Díaz', 60, 0, 'Transferencia', socios[1], '18:00', 10000],
    [4, 'Benjamín Fernández', 30, 1, 'Efectivo', '', '18:20'], [2, 'Neta', 30, 0, 'Efectivo', '', '18:35']
  ];
  S.inventario.push({ id: uid(), fecha: S.fecha, producto: pc.id, tipo: 'inicial', cantidad: 30, nota: 'Ejemplo', estado: 'ok', creadoPor: S.user.nombre, creadoEn: S.fecha + ' 13:00:00' });
  filas.forEach((f, i) => {
    const prods = f[3] ? [{ id: pc.id, nombre: pc.nombre, cant: f[3], precio: pc.precio }] : [];
    const rec = {
      id: uid() + i, fecha: S.fecha, entrada: f[6], salida: sumarMin(f[6], f[2]), personas: f[0], nombre: f[1],
      pulsera: colorDe(f[2]), minutos: f[2], productos: prods, calcetas: f[3], precioCalceta: pc.precio,
      medio: f[4], cuenta: f[5], precioPersona: Calc.precioPersona(c, f[2]),
      obs: f[7] ? 'Pagó 1 hora y se cambió a ½ hora + 1 calceta' : '',
      devolucion: f[7] || 0, devolucionDesde: f[7] ? 'Efectivo' : '', estado: 'ok',
      creadoPor: S.user.nombre, creadoEn: S.fecha + ' ' + f[6] + ':00'
    };
    rec.total = Calc.totalGrupo(rec);
    S.registros.push(rec);
  });
  S.gastos.push({ id: uid(), fecha: S.fecha, concepto: 'Almuerzos (3)', monto: 15000, pagadoDesde: 'Efectivo', estado: 'ok', creadoPor: S.user.nombre, creadoEn: nowLocal() });
  saveDay(); toast('Día de ejemplo cargado (planilla del 9 de marzo)', 'ok'); renderTab();
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
  render(); sync(); revisarAlertas();
}
function logout() {
  const n = getQueue().length;
  if (n && !confirm('Hay ' + n + ' cambio(s) sin enviar a la planilla. Si sales ahora no se van a perder, pero se enviarán a nombre de quien entre después. ¿Salir igual?')) return;
  if (!n && !confirm('¿Cerrar sesión de ' + S.user.nombre + '?')) return;
  S.user = null; LS.del('pa_user'); cerrarAlerta(); render();
  if (!DEMO) cargarUsuarios();
}

/* =========================================================
   Vistas
   ========================================================= */
function aparecer(el) {
  if (REDUCE) return;
  el.classList.remove('fade'); void el.offsetWidth; el.classList.add('fade');
}
function render() {
  const app = $('#app');
  if (!S.user) { app.innerHTML = vistaLogin(); aparecer(app); return; }
  if (!$('#main')) {
    app.innerHTML = '<header id="hdr"></header><main id="main"></main><nav id="nav"></nav>';
    construirNav(); aparecer(app);
  }
  renderHeader(); actualizarNav(); renderTab();
}
function vistaId() { return S.tab + '|' + S.fecha + '|' + (S.tab === 'registrar' ? (S.editId || 'nuevo') : ''); }
function renderTab() {
  const main = $('#main'); if (!main || !S.user) return;
  if (!S.form) S.form = nuevoForm();
  const html = S.tab === 'registrar' ? vistaRegistrar() : S.tab === 'dia' ? vistaDia() : S.tab === 'inventario' ? vistaInventario() : vistaCaja();
  const id = vistaId();
  if (main.dataset.vista !== id) { main.innerHTML = html; main.dataset.vista = id; }
  else morph(main, html);
  animarConteos(main);
}
function irA(tab, preparar) {
  const dir = TABS.indexOf(tab) >= TABS.indexOf(S.tab) ? 'der' : 'izq';
  if (preparar) preparar();
  S.tab = tab;
  actualizarNav(); renderTab();
  window.scrollTo({ top: 0, behavior: 'instant' });
  const m = $('#main');
  if (m && !REDUCE) { m.classList.remove('in-der', 'in-izq'); void m.offsetWidth; m.classList.add('in-' + dir); }
}

function vistaLogin() {
  const lista = DEMO ? S.config.socios : S.usuarios;
  const ops = lista.map(n => '<option>' + esc(n) + '</option>').join('');
  return `<div class="login">
    <div class="logo">${iconoOla(64)}</div>
    <h1>Parque Acuático</h1>
    <p class="muted">Control de caja diario</p>
    ${DEMO ? '<div class="info">Modo demostración: los datos quedan solo en este teléfono. Para conectar la planilla, sigue el README.</div>' : ''}
    <label class="lbl">¿Quién eres?</label>
    <select id="lu" class="inp">${ops ? '<option value="">Elegir…</option>' + ops : '<option value="">Cargando usuarios…</option>'}</select>
    ${DEMO ? '' : '<label class="lbl">PIN</label><input id="lp" class="inp" type="password" inputmode="numeric" autocomplete="off" maxlength="8">'}
    <button class="btn primary big" data-act="login">Entrar</button>
    <p id="lerr" class="err"></p>
  </div>`;
}

function iconoOla(s) {
  return `<img src="icon.svg" width="${s}" height="${s}" alt="" class="logo-img">`;
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
  morph(h, `<div class="hdr-row">
      <div class="brand">${iconoOla(28)}<span>Parque Acuático</span></div>
      <button class="user" data-act="logout" title="Cerrar sesión">${esc(S.user.nombre)} <span class="muted">· salir</span></button>
    </div>
    <div class="hdr-row">
      <label class="fecha"><input type="date" id="fecha" value="${S.fecha}"><span>${esc(fechaLarga(S.fecha))}${S.fecha === hoy() ? ' · hoy' : ''}</span></label>
      <button class="sync s-${st[0]}" data-act="sync">${esc(st[1])}</button>
    </div>`);
}

function construirNav() {
  const t = [
    ['registrar', 'Registrar', '<path d="M12 5v14M5 12h14"/>'],
    ['dia', 'Grupos', '<path d="M4 6h16M4 12h16M4 18h10"/>'],
    ['inventario', 'Inventario', '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>'],
    ['caja', 'Caja', '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>']
  ];
  $('#nav').innerHTML = '<span class="ind"></span>' + t.map(x => `<button data-act="tab" data-v="${x[0]}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${x[2]}</svg><span>${x[1]}</span></button>`).join('');
}
function actualizarNav() {
  const nav = $('#nav'); if (!nav) return;
  nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === S.tab));
  const ind = nav.querySelector('.ind'); if (ind) ind.style.transform = 'translateX(' + (TABS.indexOf(S.tab) * 100) + '%)';
}

function chips(field, opciones, valor, extra) {
  return `<div class="chips">${opciones.map(o => {
    const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
    return `<button type="button" class="chip ${String(valor) === String(v) ? 'on' : ''}" data-act="${extra || 'set'}" data-f="${field}" data-v="${esc(v)}">${esc(l)}</button>`;
  }).join('')}</div>`;
}
function stepper(act, field, valor, min) {
  return `<div class="stepper"><button type="button" data-act="${act}" data-f="${field}" data-v="-1" ${valor <= min ? 'disabled' : ''} aria-label="menos">−</button><b data-count="${valor}" data-t="n">${valor}</b><button type="button" data-act="${act}" data-f="${field}" data-v="1" aria-label="más">+</button></div>`;
}

function vistaRegistrar() {
  const f = S.form, c = S.config;
  const prev = S.editId ? S.registros.find(r => r.id === S.editId) : null;
  const total = totalForm();
  const venta = !(+f.personas > 0);
  const auto = entradaAutoActiva();
  const entrada = auto ? entradaPropuesta() : f.entrada;
  const salida = sumarMin(entrada, +f.minutos);
  const otroDia = S.fecha !== hoy() && !prev;
  const dev = +String(f.devolucion).replace(/\D/g, '') || 0;
  const st = stockHoy();
  const prods = productosDelForm();
  const detalle = [];
  if (!venta) detalle.push(f.personas + ' × ' + fmt(f.precioPersona) + ' (' + tiempoTxt(f.minutos) + ')');
  prods.forEach(p => detalle.push(p.cant + ' ' + p.nombre.toLowerCase() + ' × ' + fmt(p.precio)));

  const tiempoChip = (min, precio) => {
    const col = colorDe(min);
    return `<button type="button" class="chip tchip ${+f.minutos === min ? 'on' : ''}" data-act="set" data-f="minutos" data-v="${min}">
      <span class="t-top">${tiempoTxt(min)} · ${fmt(precio)}</span>
      <span class="t-pul"><i style="background:${colorHex(col)}"></i>Pulsera ${esc(col)}</span></button>`;
  };

  return `<section class="card form">
    ${prev ? `<div class="editando"><div><b>Editando ${esVenta(prev) ? 'venta' : 'grupo'} de ${esc(prev.nombre)}</b><small>Registrado por ${esc(prev.creadoPor || '?')} a las ${esc(horaDe(prev.creadoEn))}</small></div><button class="btn ghost sm" data-act="cancelar">Cancelar</button></div>` : ''}
    ${otroDia ? `<div class="info">Estás registrando en el ${esc(fechaLarga(S.fecha))}, no hoy.</div>` : ''}

    <div class="row-pers">
      <div><label class="lbl">Personas</label>${stepper('step', 'personas', f.personas, 0)}</div>
      <div class="pers-txt">${venta ? '<b>Solo compra</b><small>No entra al agua</small>' : ''}</div>
    </div>

    <label class="lbl" for="f-nombre">${venta ? 'A nombre de' : 'Nombre del grupo'}</label>
    <input id="f-nombre" class="inp" data-field="nombre" value="${esc(f.nombre)}" placeholder="Ej: Yamilet" autocomplete="off" autocapitalize="words" enterkeyhint="done">

    ${venta ? '' : `<div data-key="bloque-tiempo">
      <label class="lbl">Tiempo y pulsera</label>
      <div class="chips tiempos">${tiempoChip(30, c.precio_media)}${tiempoChip(60, c.precio_hora)}</div>
    </div>`}

    <label class="lbl">Productos</label>
    <div class="prods">${f.items.map(i => {
      const s = st[i.id], pinfo = productoPorId(i.id);
      let q = '';
      if (s && s.queda != null) {
        const queda = s.queda - (+i.cant - +i.orig);
        const cls = queda < 0 ? 'neg' : (pinfo && queda <= pinfo.aviso_bajo ? 'bajo' : '');
        q = `<small class="${cls}">quedan ${queda}</small>`;
      } else q = '<small class="muted">sin conteo</small>';
      return `<div class="prod-row" data-key="pi-${esc(i.id)}"><div><b>${esc(i.nombre)}</b><small>${fmt(i.precio)}</small>${q}</div>${stepper('pstep', i.id, +i.cant, 0)}</div>`;
    }).join('')}</div>

    <label class="lbl">Pago</label>
    ${chips('medio', ['Efectivo', 'Transferencia', 'Débito'], f.medio)}
    ${f.medio === 'Transferencia' ? `<div class="sub" data-key="cuenta"><label class="lbl">¿A qué cuenta llegó?</label>${chips('cuenta', c.socios, f.cuenta)}</div>` : ''}
    ${f.medio === 'Débito' && !c.cuenta_debito ? '<p class="nota" data-key="nota-deb">La cuenta del débito aún no está definida. Se suma al total pero queda aparte en el reparto.</p>' : ''}

    ${venta ? '' : `<div data-key="bloque-horario"><div class="horario">
      <div><label class="lbl" for="f-entrada">Entrada</label>
        <input id="f-entrada" class="inp" type="time" step="300" data-field="entrada" value="${esc(entrada)}">
      </div>
      <div class="flecha" aria-hidden="true">→</div>
      <div><label class="lbl">Salida</label><div class="salida">${salida}</div></div>
    </div>
    ${auto ? `<small class="muted hint">Son las ${ahoraHM()} · el turno parte a las ${entrada}</small>` : ''}</div>`}

    <label class="lbl" for="f-obs">Observaciones</label>
    <input id="f-obs" class="inp" data-field="obs" value="${esc(f.obs)}" placeholder="Opcional" autocomplete="off">

    ${prev ? `<div class="devol">
      <label class="lbl" for="f-dev">Devolución al cliente</label>
      <input id="f-dev" class="inp" data-field="devolucion" inputmode="numeric" value="${esc(f.devolucion)}" placeholder="$0">
      <label class="lbl">Se devolvió desde</label>${chips('devolucionDesde', ['Efectivo'].concat(c.socios), f.devolucionDesde)}
    </div>` : ''}

    <div class="total">
      <div><small>${esc(detalle.join(' + ') || 'Agrega personas o productos')}</small>
      <b>${cnt(total)}</b>${prev && dev ? `<small>Neto tras devolución: ${fmt(total - dev)}</small>` : ''}</div>
      <button class="btn primary big" data-act="guardar">${prev ? 'Guardar cambios' : venta ? 'Registrar venta' : 'Registrar grupo'}</button>
    </div>
    ${prev ? `<button class="btn ghost danger" data-act="${prev.estado === 'anulado' ? 'restaurar' : 'anular'}" data-v="${prev.id}">${prev.estado === 'anulado' ? 'Restaurar' : 'Anular'}</button>` : ''}
  </section>
  ${!prev ? vistaActivosMini() : ''}`;
}

function vistaActivosMini() {
  const act = gruposActivos().sort((a, b) => segSalida(a) - segSalida(b));
  if (!act.length) return '';
  return `<section class="card" data-key="activos"><h3>En el agua ahora</h3>${act.map(r => {
    const e = estadoGrupo(r);
    return `<div class="mini ${e.cls}" data-key="m-${r.id}" data-act="edit" data-v="${r.id}"><i style="background:${colorHex(r.pulsera)}"></i><div class="mini-txt"><span>${esc(r.nombre)} · ${r.personas}p · ${+r.minutos === 60 ? '1 h' : '½ h'}</span>${barra(e)}</div><b>${esc(e.corto)}</b></div>`;
  }).join('')}</section>`;
}

function vistaDia() {
  const r = Calc.resumen(S.registros, S.gastos, S.config);
  const lista = S.registros.slice().sort((a, b) => minutosDe(a.entrada) - minutosDe(b.entrada));
  const vacio = !lista.length;
  return `<section class="stats">
      <div><b>${cnt(r.grupos, 'n')}</b><small>grupos</small></div>
      <div><b>${cnt(r.personas, 'n')}</b><small>personas</small></div>
      <div><b>${cnt(r.unidades, 'n')}</b><small>productos</small></div>
      <div><b>${cnt(r.recaudado)}</b><small>recaudado</small></div>
    </section>
    ${vacio ? `<section class="card vacio" data-key="vacio"><p>No hay grupos registrados el ${esc(fechaLarga(S.fecha))}.</p>
      <button class="btn primary" data-act="tab" data-v="registrar">Registrar el primero</button>
      ${DEMO ? '<button class="btn ghost" data-act="ejemplo">Cargar día de ejemplo (planilla 9 de marzo)</button>' : ''}</section>` : ''}
    ${lista.map(x => {
      const e = estadoGrupo(x);
      const pago = x.medio === 'Transferencia' ? 'Transf. ' + x.cuenta : x.medio;
      const prods = Calc.productosDe(x);
      const venta = esVenta(x);
      const det = venta
        ? ['Venta de productos', textoProductos(prods), x.entrada, pago]
        : [x.personas + ' pers', (+x.minutos === 60 ? '1 h' : '½ h'), x.entrada + '–' + x.salida, prods.length ? textoProductos(prods) : '', pago];
      return `<article class="grupo ${e.cls}" data-key="g-${x.id}" data-act="edit" data-v="${x.id}">
        <i class="pulsera" style="background:${venta ? 'var(--line)' : colorHex(x.pulsera)}" title="${esc(x.pulsera)}"></i>
        <div class="g-main">
          <div class="g-top"><b>${esc(x.nombre)}</b><span class="g-total">${fmt(x.total)}</span></div>
          <div class="g-det">${esc(det.filter(Boolean).join(' · '))}</div>
          ${e.txt ? `<div class="g-estado">${esc(e.txt)}</div>` : ''}
          ${barra(e)}
          ${+x.devolucion ? `<div class="g-dev">Devolución ${fmt(x.devolucion)} (${esc(x.devolucionDesde)})</div>` : ''}
          ${x.obs ? `<div class="g-obs">${esc(x.obs)}</div>` : ''}
          <div class="g-quien">Registró ${esc(x.creadoPor || '?')} ${esc(horaDe(x.creadoEn))}${x.editadoPor ? ' · ' + (x.estado === 'anulado' ? 'anuló' : 'editó') + ' ' + esc(x.editadoPor) + ' ' + esc(horaDe(x.editadoEn)) : ''}</div>
        </div>
      </article>`;
    }).join('')}`;
}

function vistaInventario() {
  const st = stockHoy();
  const f = S.iform;
  const prods = S.config.productos;
  if (!f.producto || !productoPorId(f.producto)) f.producto = prods[0] ? prods[0].id : '';
  const tipo = TIPOS_MOV.find(t => t[0] === f.tipo) || TIPOS_MOV[0];
  const movs = S.inventario.slice().reverse();
  const fuenteTxt = { conteo: 'contado hoy', anterior: 'lo que quedó el día anterior', sin: '' };
  const tipoTxt = { inicial: 'Stock al abrir', ingreso: 'Llegó mercadería', ajuste: 'Corrección por conteo' };

  return `${prods.map(p => {
    const s = st[p.id];
    const conocido = s.queda != null;
    const cls = !conocido ? 'sin' : s.queda < 0 ? 'neg' : s.queda <= p.aviso_bajo ? 'bajo' : '';
    return `<section class="card prod ${cls}" data-key="p-${esc(p.id)}">
      <div class="p-top"><div><h3>${esc(p.nombre)}</h3><small class="muted">${fmt(p.precio)} c/u</small></div>
        <div class="p-queda">${conocido ? `<b>${cnt(s.queda, 'n')}</b><small>quedan</small>` : '<b>—</b><small>falta contar</small>'}</div></div>
      ${conocido && s.queda <= p.aviso_bajo ? `<p class="nota" data-key="bajo">${s.queda < 0 ? 'El stock dio negativo: cuenta de nuevo con "Contar ahora".' : 'Quedan pocas.'}</p>` : ''}
      ${!conocido ? `<p class="nota" data-key="sin">Registra cuántas hay con "Stock al abrir" (o "Contar ahora" si ya empezaron a vender).</p>` : ''}
      <div class="p-grid">
        <div><small>Al abrir</small><b>${s.inicio == null ? '—' : s.inicio}</b>${s.inicio != null ? `<em>${fuenteTxt[s.fuente]}</em>` : ''}</div>
        <div><small>Llegaron</small><b>+${s.entradas}</b></div>
        <div><small>Vendidas</small><b>−${s.vendidas}</b></div>
        <div><small>Ajustes</small><b>${s.ajustes > 0 ? '+' : ''}${s.ajustes}</b></div>
      </div>
    </section>`;
  }).join('')}

  <section class="card">
    <h3>Registrar movimiento</h3>
    ${prods.length > 1 ? `<label class="lbl">Producto</label>${chips('producto', prods.map(p => [p.id, p.nombre]), f.producto, 'iset')}` : ''}
    <label class="lbl">¿Qué pasó?</label>
    ${chips('tipo', TIPOS_MOV.map(t => [t[0], t[1]]), f.tipo, 'iset')}
    <label class="lbl" for="i-cant">${tipo[2]}</label>
    <div class="row2">
      <input id="i-cant" class="inp" data-ifield="cantidad" value="${esc(f.cantidad)}" inputmode="numeric" placeholder="Cantidad" autocomplete="off">
      <input class="inp" data-ifield="nota" value="${esc(f.nota)}" placeholder="Nota (opcional)" autocomplete="off">
    </div>
    ${f.tipo === 'conteo' ? '<small class="muted hint">Cuenta lo que hay físicamente. Si no coincide con el sistema, se corrige y queda anotada la diferencia.</small>' : ''}
    <button class="btn primary" data-act="guardar-mov">Guardar</button>
  </section>

  <section class="card">
    <h3>Movimientos del día</h3>
    ${movs.length ? movs.map(m => {
      const p = productoPorId(m.producto);
      const anul = m.estado === 'anulado';
      const signo = m.tipo === 'ingreso' ? '+' + m.cantidad : m.tipo === 'ajuste' ? (m.cantidad > 0 ? '+' : '') + m.cantidad : String(m.cantidad);
      return `<div class="fila mov ${anul ? 'anulado' : ''}" data-key="mv-${m.id}"><span>${esc(tipoTxt[m.tipo] || m.tipo)} · ${esc(p ? p.nombre : m.producto)}<small>${esc(m.creadoPor || '')} ${esc(horaDe(m.creadoEn))}${m.nota ? ' · ' + esc(m.nota) : ''}${anul ? ' · anulado por ' + esc(m.editadoPor || '') : ''}</small></span><b>${esc(signo)}</b>${anul ? '' : `<button class="x" data-act="anular-mov" data-v="${m.id}" aria-label="Anular movimiento">×</button>`}</div>`;
    }).join('') : '<p class="muted" data-key="sin-mov">Sin movimientos hoy. Las ventas se descuentan solas al registrar cada grupo.</p>'}
  </section>
  <p class="muted pie">Para agregar productos o cambiar precios, usa la pestaña <b>Productos</b> de la planilla.</p>`;
}

function vistaCaja() {
  const r = Calc.resumen(S.registros, S.gastos, S.config);
  const g = S.gform, c = S.config;
  const cambiosPostCierre = S.cierre && Math.round(S.cierre.neto) !== Math.round(r.netoTotal);
  const fila = (l, v, cls, key) => `<div class="fila ${cls || ''}"${key ? ` data-key="${key}"` : ''}><span>${l}</span><b>${v}</b></div>`;

  return `<section class="card">
    <h3>Ingresos por medio de pago</h3>
    ${fila('Efectivo', cnt(r.efectivo))}
    ${r.socios.map(s => fila('Transferencias a ' + esc(s), cnt(r.transf[s] || 0), '', 't-' + s)).join('')}
    ${r.debito || c.cuenta_debito ? fila('Débito' + (r.cuentaDebito ? ' (cuenta ' + esc(r.cuentaDebito) + ')' : ' · cuenta pendiente'), cnt(r.debito), '', 'deb') : ''}
    ${r.devol ? fila('Devoluciones', '−' + fmt(r.devol), 'neg', 'devol') : ''}
    ${fila('Total recaudado', cnt(r.recaudado), 'tot', 'tot')}
  </section>

  <section class="card">
    <h3>Qué se vendió</h3>
    ${fila('Entradas ½ hora <small>' + r.personasMedia + ' personas</small>', cnt(r.ventaMedia), '', 'vm')}
    ${fila('Entradas 1 hora <small>' + r.personasHora + ' personas</small>', cnt(r.ventaHora), '', 'vh')}
    ${Object.keys(r.porProducto).map(k => fila(esc(r.porProducto[k].nombre) + ' <small>' + r.porProducto[k].cant + ' unidades</small>', cnt(r.porProducto[k].monto), '', 'vp-' + k)).join('')}
  </section>

  <section class="card">
    <h3>Gastos del día</h3>
    ${r.listaGastos.length ? r.listaGastos.map(x => `<div class="fila gasto" data-key="x-${x.id}"><span>${esc(x.concepto)}<small>${x.pagadoDesde === 'Efectivo' ? 'De la caja' : 'Lo pagó ' + esc(x.pagadoDesde)} · ${esc(x.creadoPor || '')}</small></span><b>−${fmt(x.monto)}</b><button class="x" data-act="anular-gasto" data-v="${x.id}" aria-label="Anular gasto">×</button></div>`).join('') : '<p class="muted" data-key="sin-gastos">Sin gastos registrados.</p>'}
    <div class="gform" data-key="gform">
      <div class="chips mini-chips">${['Almuerzo', 'Bencina', 'Hielo', 'Bolsas'].map(q => `<button type="button" class="chip" data-act="gq" data-v="${q}">${q}</button>`).join('')}</div>
      <div class="row2">
        <input class="inp" data-gfield="concepto" value="${esc(g.concepto)}" placeholder="Concepto" autocomplete="off">
        <input class="inp" data-gfield="monto" value="${esc(g.monto)}" placeholder="Monto" inputmode="numeric">
      </div>
      <label class="lbl">Pagado con</label>
      ${chips('pagadoDesde', [['Efectivo', 'Efectivo de la caja']].concat(c.socios.map(s => [s, 'Plata de ' + s])), g.pagadoDesde, 'gset')}
      <button class="btn" data-act="agregar-gasto">Agregar gasto</button>
    </div>
    ${r.totalGastos ? fila('Total gastos', '−' + fmt(r.totalGastos), 'neg', 'tg') : ''}
  </section>

  <section class="card reparto">
    <h3>Reparto entre socios</h3>
    ${fila('Neto del día', cnt(r.netoTotal), 'tot')}
    ${r.debitoPendiente ? `<p class="nota" data-key="debpend">Hay ${fmt(r.debitoPendiente)} en débito sin cuenta definida. No se reparte todavía.</p>` : ''}
    ${fila('A cada uno (÷' + r.socios.length + ')', cnt(r.parte), '', 'parte')}
    ${fila('Efectivo en caja', cnt(r.caja), '', 'caja')}
    <div class="socios" data-key="socios">${r.socios.map(s => {
      const e = r.entregar[s];
      return `<div class="socio" data-key="s-${esc(s)}"><h4>${esc(s)}</h4>
        <div class="fila"><span>Ya tiene en su cuenta</span><b>${cnt(r.tiene[s])}</b></div>
        ${e >= 0 ? `<div class="fila hl" data-key="lleva"><span>Se lleva en efectivo</span><b>${cnt(e)}</b></div>` : `<div class="fila hl neg" data-key="debe"><span>Debe transferir</span><b>${cnt(-e)}</b></div>`}
      </div>`;
    }).join('')}</div>
    ${r.ajustes.map(a => `<p class="nota" data-key="aj-${esc(a.de)}">${esc(a.de)} recibió más de su parte por transferencia: debe pasarle ${fmt(a.monto)} ${a.a ? 'a ' + esc(a.a) : 'a los demás'}.</p>`).join('')}
  </section>

  <section class="card cierre">
    ${S.cierre ? `<p class="ok-txt" data-key="cerrada">Caja cerrada por <b>${esc(S.cierre.cerradoPor)}</b> a las ${esc(horaDe(S.cierre.cerradoEn))}.</p>` : ''}
    ${cambiosPostCierre ? '<p class="nota" data-key="post">Hubo cambios después del cierre. Vuelve a cerrar para actualizar la planilla.</p>' : ''}
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
    if (v === S.tab && !S.editId) return;
    irA(v, () => { if (S.editId) { S.editId = null; S.form = nuevoForm(); } });
  },
  set(v, el) {
    const f = el.dataset.f;
    S.form[f] = (f === 'minutos') ? +v : v;
    if (f === 'minutos') {
      const prev = S.editId ? S.registros.find(r => r.id === S.editId) : null;
      S.form.precioPersona = (prev && +prev.minutos === +v && +prev.precioPersona) ? +prev.precioPersona : Calc.precioPersona(S.config, v);
    }
    if (f === 'medio' && v !== 'Transferencia') S.form.cuenta = '';
    renderTab();
  },
  step(v, el) {
    const f = el.dataset.f;
    S.form[f] = Math.max(0, (+S.form[f] || 0) + (+v));
    if (f === 'personas' && S.form.personas > 0 && !(+S.form.precioPersona)) S.form.precioPersona = Calc.precioPersona(S.config, S.form.minutos);
    renderTab();
  },
  pstep(v, el) {
    const it = S.form.items.find(i => i.id === el.dataset.f); if (!it) return;
    it.cant = Math.max(0, (+it.cant || 0) + (+v));
    renderTab();
  },
  guardar: guardarGrupo,
  cancelar() { irA('dia', () => { S.editId = null; S.form = nuevoForm(); }); },
  edit(v) {
    const r = S.registros.find(x => x.id === v); if (!r) return;
    irA('registrar', () => { S.editId = v; S.form = formDesde(r); });
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
  compartir,
  ejemplo: cargarEjemplo
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act]; if (fn) { e.preventDefault(); fn(el.dataset.v, el); }
});
document.addEventListener('pointerdown', () => audioCtx(), { passive: true });
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.field && S.form) {
    S.form[t.dataset.field] = t.value;
    if (t.dataset.field === 'entrada') S.form.entradaAuto = false;
    if (t.dataset.field === 'entrada' || t.dataset.field === 'devolucion') renderTab();
  }
  if (t.dataset.gfield) S.gform[t.dataset.gfield] = t.value;
  if (t.dataset.ifield) S.iform[t.dataset.ifield] = t.value;
});
document.addEventListener('change', e => {
  if (e.target.id === 'fecha' && e.target.value) {
    S.fecha = e.target.value; S.editId = null; loadDay(); S.form = nuevoForm(); render(); sync();
  }
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

// Cada 5 s: alertas, cuenta regresiva y barras de avance. Cada 30 s: sincronizar con la planilla.
setInterval(() => {
  if (!S.user) return;
  revisarAlertas();
  if (S.fecha === hoy() && (S.tab === 'registrar' || S.tab === 'dia')) renderTab();
  pantallaEncendida();
}, 5000);
setInterval(() => { if (S.user) sync(); }, 30000);

/* ---------- inicio ---------- */
loadDay();
if (S.user) S.form = nuevoForm();
render();
if (S.user) { sync(); revisarAlertas(); pantallaEncendida(); } else cargarUsuarios();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { });
}
