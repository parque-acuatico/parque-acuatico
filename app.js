'use strict';
/* =========================================================
   Parque Acuático · Caja — app principal
   ========================================================= */

const API_URL = ((window.APP_CONFIG || {}).API_URL || '').trim();
// Modo de prueba: se abre con ?demo=1 en la dirección. Trae días inventados y no toca la planilla real.
const PRUEBA = /[?&]demo=1(&|$)/.test(location.search);
const DEMO = !API_URL || PRUEBA;
const USUARIOS_PRUEBA = ['Usuario 1', 'Usuario 2'];
const TABS = ['registrar', 'dia', 'inventario', 'caja'];
const REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

const DEFAULT_CONFIG = {
  precio_media: 6000,
  precio_hora: 10000,
  socios: ['Usuario 1'],
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
      if (!k || k.indexOf(PREF + 'day_') !== 0) continue;
      const f = k.slice((PREF + 'day_').length);
      if (f >= S.fecha) continue;
      const d = LS.get('pa_day_' + f, {}) || {};
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
      const res = await api('sync', { ops: q }, 90000);
      const hechos = new Set(res.applied || []);
      setQueue(getQueue().filter(o => !hechos.has(o.opId)));
      if (res.rechazados && res.rechazados.length) {
        toast(res.rechazados.length === 1 ? 'Un cambio no se guardó: la caja de ese día ya estaba cerrada'
          : res.rechazados.length + ' cambios no se guardaron: la caja de ese día ya estaba cerrada', 'err');
      }
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

function diaCerrado() { return !!S.cierre && S.cierre.estado !== 'reabierta'; }
function esAdmin() { return DEMO || (S.user && String(S.user.rol || '').toLowerCase() === 'admin'); }
function bloqueado() {
  if (!diaCerrado()) return false;
  toast('La caja de este día está cerrada. No se pueden hacer cambios.', 'err');
  return true;
}

function guardarGrupo() {
  if (bloqueado()) return;
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
  if (bloqueado()) return;
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
  if (bloqueado()) return;
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
  if (bloqueado()) return;
  const m = S.inventario.find(x => x.id === id); if (!m) return;
  if (!confirm('¿Anular este movimiento de inventario?')) return;
  guardarLocal('inventario', Object.assign({}, m, { estado: 'anulado', editadoPor: S.user.nombre, editadoEn: nowLocal() }));
  renderTab();
}

/* ---------- gastos y cierre ---------- */
function agregarGasto() {
  if (bloqueado()) return;
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
  if (bloqueado()) return;
  const g = S.gastos.find(x => x.id === id); if (!g) return;
  if (!confirm('¿Anular el gasto "' + g.concepto + '" de ' + fmt(g.monto) + '?')) return;
  guardarLocal('gasto', Object.assign({}, g, { estado: 'anulado', editadoPor: S.user.nombre, editadoEn: nowLocal() }));
  renderTab();
}
function cerrarCaja() {
  const r = Calc.resumen(S.registros, S.gastos, S.config);
  if (diaCerrado()) return toast('La caja ya está cerrada', 'err');
  if (!r.grupos && !r.ventasSueltas) return toast('No hay ventas registradas este día', 'err');
  const activos = gruposActivos().length;
  if (!confirm('¿Cerrar la caja del ' + fechaLarga(S.fecha) + '?\n\nTotal: ' + fmt(r.recaudado) + '\nNeto: ' + fmt(r.netoTotal) +
    (activos ? '\n\nOjo: todavía hay ' + activos + ' grupo(s) en el agua.' : '') +
    '\n\nDespués de cerrar no se pueden agregar ni cambiar registros de este día.')) return;
  const st = stockHoy();
  guardarLocal('cierre', Object.assign({}, S.cierre || {}, {
    fecha: S.fecha, estado: 'cerrada', cerradoPor: S.user.nombre, cerradoEn: nowLocal(),
    totalBruto: r.bruto, devoluciones: r.devol, gastos: r.totalGastos, neto: r.netoTotal,
    efectivoCaja: r.caja, debitoPendiente: r.debitoPendiente,
    reparto: r.socios.map(s => s + ': ' + fmt(r.tiene[s]) + ' en cuenta + ' + (r.entregar[s] >= 0 ? fmt(r.entregar[s]) + ' efectivo' : 'debe pasar ' + fmt(-r.entregar[s]))).join(' · '),
    detalle: JSON.stringify({ efectivo: r.efectivo, transf: r.transf, debito: r.debito, grupos: r.grupos, personas: r.personas, productos: r.porProducto, parte: r.parte, tiene: r.tiene, entregar: r.entregar }),
    efectivo: r.efectivo,
    transferencias: r.socios.map(s => s + ' ' + fmt(r.transf[s] || 0)).join(' · '),
    debito: r.debito,
    ventaEntradas: r.ventaMedia + r.ventaHora,
    ventaProductos: r.ventaProductos,
    personas: r.personas,
    productosVendidos: Object.keys(r.porProducto).map(k => r.porProducto[k].nombre + ' ×' + r.porProducto[k].cant).join(', '),
    stockFinal: S.config.productos.map(p => p.nombre + ': ' + (st[p.id].queda == null ? 'sin conteo' : st[p.id].queda)).join(' · ')
  }));
  toast(DEMO ? 'Caja cerrada' : 'Caja cerrada. El archivo del día se está guardando en Drive.', 'ok');
  S.editId = null; S.form = nuevoForm();
  renderTab();
}
function reabrirCaja() {
  if (!esAdmin()) return toast('Solo un administrador puede reabrir la caja', 'err');
  if (!confirm('¿Reabrir la caja del ' + fechaLarga(S.fecha) + '?\nQuedará registrado que la reabriste. Después hay que volver a cerrarla.')) return;
  guardarLocal('cierre', Object.assign({}, S.cierre, { estado: 'reabierta', reabiertoPor: S.user.nombre, reabiertoEn: nowLocal() }));
  toast('Caja reabierta', 'ok'); renderTab();
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
  const cta = k => socios[k % socios.length];
  const filas = [
    [4, 'Grupo 1', 30, 0, 'Efectivo', '', '13:10'], [2, 'Grupo 2', 30, 2, 'Transferencia', cta(0), '14:20'],
    [2, 'Grupo 3', 30, 2, 'Efectivo', '', '15:50'], [2, 'Grupo 4', 30, 2, 'Transferencia', cta(0), '16:35'],
    [2, 'Grupo 5', 30, 0, 'Transferencia', cta(1), '17:00'], [2, 'Grupo 6', 30, 2, 'Efectivo', '', '17:15'],
    [4, 'Grupo 7', 30, 4, 'Transferencia', cta(1), '17:15'], [7, 'Grupo 8', 60, 0, 'Efectivo', '', '17:30'],
    [2, 'Grupo 9', 30, 2, 'Transferencia', cta(1), '17:45'], [3, 'Grupo 10', 60, 0, 'Transferencia', cta(1), '18:00', 10000],
    [4, 'Grupo 11', 30, 1, 'Efectivo', '', '18:20'], [2, 'Grupo 12', 30, 0, 'Efectivo', '', '18:35']
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

/* ---------- días inventados para el modo de prueba ---------- */
function borrarPrueba() {
  try {
    const ks = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('pademo_') === 0) ks.push(k); }
    ks.forEach(k => localStorage.removeItem(k));
  } catch (e) { }
}
function sembrarPrueba() {
  const c = S.config, socios = c.socios, pc = c.productos[0];
  const usuarios = USUARIOS_PRUEBA;
  let numGrupo = 0;
  let semilla = 7;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };
  const elegir = a => a[Math.floor(azar() * a.length)];
  const fechaMas = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const hm = m => pad(Math.floor(((m % 1440) + 1440) % 1440 / 60)) + ':' + pad(((m % 60) + 60) % 60);
  let n = 0;
  const grupo = (fecha, minEntrada, o) => {
    o = o || {};
    const personas = o.personas != null ? o.personas : 2 + Math.floor(azar() * (azar() < .2 ? 7 : 4));
    const minutos = personas ? (o.minutos || (azar() < .25 ? 60 : 30)) : 0;
    const cant = o.calcetas != null ? o.calcetas : (azar() < .55 ? Math.min(personas || 1, 1 + Math.floor(azar() * 4)) : 0);
    const r = azar();
    const medio = o.medio || (r < .5 ? 'Efectivo' : r < .9 ? 'Transferencia' : 'Débito');
    const entrada = hm(minEntrada);
    const quien = o.quien || elegir(usuarios);
    const rec = {
      id: 'demo' + (++n), fecha, entrada, salida: minutos ? sumarMin(entrada, minutos) : '',
      personas, nombre: o.nombre || 'Grupo ' + (++numGrupo), pulsera: minutos ? colorDe(minutos) : '', minutos,
      productos: cant ? [{ id: pc.id, nombre: pc.nombre, cant, precio: pc.precio }] : [],
      calcetas: cant, precioCalceta: cant ? pc.precio : 0,
      medio, cuenta: medio === 'Transferencia' ? (o.cuenta || elegir(socios)) : '',
      precioPersona: minutos ? Calc.precioPersona(c, minutos) : 0, obs: o.obs || '',
      devolucion: o.devolucion || 0, devolucionDesde: o.devolucion ? 'Efectivo' : '',
      estado: o.estado || 'ok', creadoPor: quien, creadoEn: fecha + ' ' + hm(minEntrada - 3) + ':00'
    };
    if (o.estado === 'anulado') { rec.editadoPor = elegir(usuarios); rec.editadoEn = fecha + ' ' + hm(minEntrada + 2) + ':00'; }
    rec.total = Calc.totalGrupo(rec);
    return rec;
  };
  const movimiento = (fecha, minuto, tipo, cantidad, nota, quien) => ({
    id: 'demo-m' + (++n), fecha, producto: pc.id, tipo, cantidad, nota: nota || '', estado: 'ok',
    creadoPor: quien || usuarios[0], creadoEn: fecha + ' ' + hm(minuto) + ':00'
  });
  const gasto = (fecha, minuto, concepto, monto, desde) => ({
    id: 'demo-g' + (++n), fecha, concepto, monto, pagadoDesde: desde || 'Efectivo', estado: 'ok',
    creadoPor: elegir(usuarios), creadoEn: fecha + ' ' + hm(minuto) + ':00'
  });
  const cerrar = (fecha, regs, gastos, quien, minuto) => {
    const r = Calc.resumen(regs, gastos, c);
    return { fecha, estado: 'cerrada', cerradoPor: quien, cerradoEn: fecha + ' ' + hm(minuto) + ':00', neto: r.netoTotal, totalBruto: r.bruto };
  };
  const guardarDia = (fecha, d) => LS.set('pa_day_' + fecha, Object.assign({ registros: [], gastos: [], inventario: [], cierre: null, stockPrevio: null }, d));

  // Anteayer: día completo, ya cerrado
  const f2 = fechaMas(-2); numGrupo = 0;
  const r2 = [];
  for (let m = 11 * 60; m <= 19 * 60; m += 25 + Math.floor(azar() * 25)) r2.push(grupo(f2, Math.ceil(m / 5) * 5));
  r2.push(grupo(f2, 15 * 60 + 12, { personas: 0, calcetas: 2, nombre: 'Compra de calcetas', medio: 'Efectivo' }));
  const g2 = [gasto(f2, 14 * 60, 'Almuerzo (3)', 15000), gasto(f2, 10 * 60 + 40, 'Bencina generador', 12000, socios[socios.length - 1])];
  guardarDia(f2, { registros: r2, gastos: g2, inventario: [movimiento(f2, 10 * 60 + 45, 'inicial', 40, 'Conteo al abrir')], cierre: cerrar(f2, r2, g2, usuarios[0], 19 * 60 + 45) });

  // Ayer: con llegada de mercadería, una devolución, un anulado y una diferencia en el conteo
  const f1 = fechaMas(-1); numGrupo = 0;
  const r1 = [];
  for (let m = 11 * 60 + 15; m <= 19 * 60; m += 22 + Math.floor(azar() * 28)) r1.push(grupo(f1, Math.ceil(m / 5) * 5));
  r1.push(grupo(f1, 16 * 60, { personas: 3, minutos: 30, calcetas: 1, medio: 'Transferencia', cuenta: socios[socios.length - 1], nombre: 'Grupo con devolución', devolucion: 10000, obs: 'Pagó 1 hora y al final se quedó ½ hora' }));
  r1.push(grupo(f1, 17 * 60 + 20, { personas: 4, estado: 'anulado', nombre: 'Grupo duplicado', obs: 'Se registró dos veces' }));
  const g1 = [gasto(f1, 13 * 60 + 30, 'Almuerzo (2)', 10000), gasto(f1, 12 * 60, 'Hielo', 3000)];
  const i1 = [movimiento(f1, 12 * 60 + 30, 'ingreso', 20, 'Llegó pedido', usuarios[1]),
    movimiento(f1, 19 * 60 + 30, 'ajuste', -1, 'Conteo: faltó 1 (se mojó y se botó)', usuarios[1])];
  guardarDia(f1, { registros: r1, gastos: g1, inventario: i1, cierre: cerrar(f1, r1, g1, usuarios[1], 19 * 60 + 50) });

  // Hoy: algunos terminados, dos en el agua (uno a punto de salir, para ver la alerta) y uno por entrar
  const f0 = fechaMas(0); numGrupo = 0;
  const ahora = minutosDe(ahoraHM());
  const r0 = [];
  for (let m = Math.max(10 * 60 + 30, ahora - 200); m <= ahora - 45; m += 30 + Math.floor(azar() * 15)) r0.push(grupo(f0, Math.floor(m / 5) * 5));
  r0.push(grupo(f0, Math.ceil((ahora - 28) / 5) * 5, { personas: 3, minutos: 30, calcetas: 2, nombre: 'Grupo familiar', medio: 'Efectivo' }));
  r0.push(grupo(f0, Math.floor((ahora - 12) / 5) * 5, { personas: 6, minutos: 60, calcetas: 0, nombre: 'Cumpleaños', medio: 'Transferencia', cuenta: socios[0] }));
  r0.push(grupo(f0, minutosDe(entradaPropuesta()), { personas: 2, minutos: 30, calcetas: 2, nombre: 'Grupo por entrar', medio: 'Débito' }));
  guardarDia(f0, { registros: r0, gastos: [gasto(f0, Math.max(ahora - 60, 10 * 60), 'Almuerzo (2)', 10000)], inventario: [] });

  // Los grupos que ya terminaron antes de abrir la prueba no hacen sonar la alerta
  const vistos = {};
  r0.forEach(r => { if (r.minutos && minutosDe(r.entrada) + r.minutos <= ahora) vistos[r.id + '@' + r.salida] = 1; });
  LS.set('pa_avisos_' + f0, vistos);
  LS.set('pa_semilla', 2);
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
const ICON = {
  lock: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  efectivo: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/></svg>',
  transferencia: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/></svg>',
  debito: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/></svg>',
  archivo: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  compartir: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>'
};
const COLOR_PAGO = ['#0aa2c0', '#6d5dfc', '#16a34a', '#f472b6'];

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
function vistaId() { return S.tab + '|' + S.fecha + '|' + (S.tab === 'registrar' ? (S.editId || 'nuevo') : '') + '|' + (diaCerrado() ? 'c' : 'a'); }
function renderTab() {
  const main = $('#main'); if (!main || !S.user) return;
  if (!S.form) S.form = nuevoForm();
  const vista = S.tab === 'registrar' ? vistaRegistrar() : S.tab === 'dia' ? vistaDia() : S.tab === 'inventario' ? vistaInventario() : vistaCaja();
  const html = bannerCerrado() + vista;
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

function vistaLogin() {
  const lista = DEMO ? USUARIOS_PRUEBA : S.usuarios;
  const ops = lista.map(n => '<option>' + esc(n) + '</option>').join('');
  return `<div class="login">
    <div class="login-ola">
      <div class="logo">${iconoOla(76)}</div>
      <h1>Parque Acuático</h1>
      <p>Caja del día</p>
    </div>
    <div class="login-form">
      ${PRUEBA ? '<p class="info"><b>Versión de prueba.</b> Trae tres días inventados: anteayer y ayer ya cerrados, y hoy con grupos en el agua. Prueba todo lo que quieras: nada de esto llega a la caja real.</p>'
        : DEMO ? '<p class="info">Modo de prueba: lo que registres queda solo en este teléfono.</p>' : ''}
      <label class="lbl" for="lu">¿Quién eres?</label>
      <select id="lu" class="inp">${ops ? '<option value="">Elige tu nombre</option>' + ops : '<option value="">Cargando usuarios…</option>'}</select>
      ${DEMO ? '' : '<label class="lbl" for="lp">PIN</label><input id="lp" class="inp" type="password" inputmode="numeric" autocomplete="off" maxlength="8">'}
      <button class="btn coral big" data-act="login">Entrar</button>
      <p id="lerr" class="err"></p>
    </div>
  </div>`;
}

/* Tira de días: los últimos 7 días a un toque, y el calendario para cualquier otro */
function fechaMas(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function tiraDias() {
  const CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dias = [];
  for (let i = 6; i >= 0; i--) dias.push({ f: fechaMas(-i), i });
  const fuera = !dias.some(d => d.f === S.fecha);
  const cerradoEn = f => { const d = LS.get('pa_day_' + f, null); return !!(d && d.cierre && d.cierre.estado !== 'reabierta'); };
  const fd = new Date(S.fecha + 'T12:00:00');
  return `<div class="dias" role="group" aria-label="Elegir día">
    ${dias.map(d => {
      const dt = new Date(d.f + 'T12:00:00');
      const etiqueta = d.i === 0 ? 'Hoy' : d.i === 1 ? 'Ayer' : CORTO[dt.getDay()];
      return `<button class="dia ${d.f === S.fecha ? 'on' : ''}" data-act="dia" data-v="${d.f}" aria-pressed="${d.f === S.fecha}">
        <small>${etiqueta}</small><b>${dt.getDate()}</b>${cerradoEn(d.f) ? '<i class="d-lock" title="Caja cerrada"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></i>' : ''}</button>`;
    }).join('')}
    <label class="dia cal ${fuera ? 'on' : ''}" title="Elegir otra fecha">
      <input type="date" id="fecha" value="${S.fecha}" max="${hoy()}" aria-label="Elegir otra fecha">
      <small>${fuera ? CORTO[fd.getDay()] + ' ' + fd.getDate() : 'Otro'}</small>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>
    </label>
  </div>`;
}
function cambiarDia(f) {
  if (!f || f === S.fecha) return;
  const dir = f > S.fecha ? 'der' : 'izq';
  S.fecha = f; S.editId = null; loadDay(); S.form = nuevoForm();
  render(); sync();
  const m = $('#main');
  if (m && !REDUCE) { m.classList.remove('in-der', 'in-izq'); void m.offsetWidth; m.classList.add('in-' + dir); }
}

function renderHeader() {
  const h = $('#hdr'); if (!h || !S.user) return;
  const n = getQueue().length;
  const st = {
    demo: ['demo', PRUEBA ? 'Prueba' : 'Sin planilla'], idle: ['pend', 'Conectando'], sync: ['sync', 'Guardando…'],
    ok: ['ok', 'Guardado en la planilla'], pending: ['pend', n + ' por guardar'],
    offline: ['off', 'Sin señal' + (n ? ', ' + n + ' por guardar' : '')],
    error: ['err', 'No se pudo guardar']
  }[S.syncState] || ['pend', ''];
  const esHoy = S.fecha === hoy();
  morph(h, `<div class="hdr-in">
      <div class="hdr-top">
        <div class="brand">${iconoOla(30)}<span>Parque Acuático</span></div>
        <button class="user" data-act="logout" title="Cerrar sesión"><span class="avatar">${inicial(S.user.nombre)}</span><span>${esc(S.user.nombre)}</span></button>
      </div>
      <div class="f-titulo">
        <span class="f-dia">${esc(fechaLarga(S.fecha))}</span>
        <button class="sync s-${st[0]}" data-act="sync" title="${esc(S.syncError || '')}">${esc(st[1])}</button>
      </div>
      ${tiraDias()}
      ${!esHoy ? '<button class="volver-hoy" data-act="ir-hoy">Volver a hoy</button>' : ''}
    </div>
    <svg class="ola" viewBox="0 0 400 28" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0H400V12C350 28 300 28 250 16S150 0 100 10 30 24 0 16Z"/></svg>`);
}

function construirNav() {
  const t = [
    ['registrar', 'Registrar', '<path d="M12 5v14M5 12h14"/>'],
    ['dia', 'Grupos', '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.3 5 2.7 5 5.8"/>'],
    ['inventario', 'Inventario', '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>'],
    ['caja', 'Caja', '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>']
  ];
  $('#nav').innerHTML = '<span class="ind"></span>' + t.map(x => `<button data-act="tab" data-v="${x[0]}"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${x[2]}</svg><span>${x[1]}</span></button>`).join('');
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
function stepper(act, field, valor, min, grande) {
  return `<div class="stepper ${grande ? 'grande' : ''}"><button type="button" data-act="${act}" data-f="${field}" data-v="-1" ${valor <= min ? 'disabled' : ''} aria-label="Quitar uno">−</button><b data-count="${valor}" data-t="n">${valor}</b><button type="button" data-act="${act}" data-f="${field}" data-v="1" aria-label="Agregar uno">+</button></div>`;
}
function paso(n, titulo, cuerpo, key) {
  return `<section class="paso" data-key="${key}"><h2 class="paso-h"><span class="n">${n}</span>${titulo}</h2>${cuerpo}</section>`;
}
function pulseraVis(color) { return `<span class="pulsera-vis" style="--c:${colorHex(color)}" aria-hidden="true"></span>`; }

/* ---------- Registrar ---------- */
function vistaRegistrar() {
  if (diaCerrado()) {
    return `<section class="vacio-card" data-key="reg-cerrado">
      <div class="vacio-ic">${ICON.lock}</div>
      <h2>No se pueden registrar más grupos este día</h2>
      <p>La caja ya se cerró. ${S.fecha !== hoy() ? 'Para registrar, vuelve al día de hoy.' : 'Si hay que corregir algo, un administrador puede reabrirla desde la pestaña Caja.'}</p>
      ${S.fecha !== hoy() ? '<button class="btn coral" data-act="ir-hoy">Ir a hoy</button>' : '<button class="btn" data-act="tab" data-v="caja">Ver la caja</button>'}
    </section>`;
  }
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
  if (!venta) detalle.push(f.personas + ' × ' + fmt(f.precioPersona));
  prods.forEach(p => detalle.push(p.cant + ' ' + p.nombre.toLowerCase()));
  let n = 0;

  const tiempoTile = (min, precio) => {
    const col = colorDe(min);
    return `<button type="button" class="tile tiempo ${+f.minutos === min ? 'on' : ''}" data-act="set" data-f="minutos" data-v="${min}">
      ${pulseraVis(col)}
      <b>${tiempoTxt(min)}</b>
      <span>${fmt(precio)} por persona</span>
      <small>Pulsera ${esc(col.toLowerCase())}</small>
    </button>`;
  };
  const pagoTile = (v, label, ic) => `<button type="button" class="tile pago ${f.medio === v ? 'on' : ''}" data-act="set" data-f="medio" data-v="${v}">${ic}<b>${label}</b></button>`;

  const pasos = [];
  pasos.push(paso(++n, '¿Cuántas personas?', `
    <div class="personas">${stepper('step', 'personas', f.personas, 0, true)}</div>
    ${venta ? '<p class="ayuda" data-key="ayuda-venta">Con 0 personas se registra solo la compra de productos, sin entrar al agua.</p>' : ''}`, 'p-pers'));
  pasos.push(paso(++n, venta ? '¿A nombre de quién?' : 'Nombre del grupo', `
    <input id="f-nombre" class="inp" data-field="nombre" value="${esc(f.nombre)}" placeholder="Ej: nombre de quien paga" autocomplete="off" autocapitalize="words" enterkeyhint="done">`, 'p-nom'));
  if (!venta) pasos.push(paso(++n, 'Tiempo', `
    <div class="tiles dos">${tiempoTile(30, c.precio_media)}${tiempoTile(60, c.precio_hora)}</div>
    <div class="horario">
      <span>Entran</span>
      <input id="f-entrada" class="hora" type="time" step="300" data-field="entrada" value="${esc(entrada)}" aria-label="Hora de entrada">
      <span>y salen a las</span><b>${salida}</b>
    </div>
    ${auto ? `<p class="ayuda" data-key="ayuda-hora">Son las ${ahoraHM()}. El turno parte a los 5 minutos siguientes.</p>` : ''}`, 'p-tiempo'));
  pasos.push(paso(++n, 'Productos', `<div class="prods">${f.items.map(i => {
    const s = st[i.id], pinfo = productoPorId(i.id);
    let q;
    if (s && s.queda != null) {
      const queda = s.queda - (+i.cant - +i.orig);
      const cls = queda < 0 ? 'neg' : (pinfo && queda <= pinfo.aviso_bajo ? 'bajo' : '');
      q = `<small class="stock ${cls}">${queda < 0 ? 'Faltan ' + (-queda) : 'Quedan ' + queda}</small>`;
    } else q = '<small class="stock">Sin conteo de stock</small>';
    return `<div class="prod-row ${+i.cant > 0 ? 'con' : ''}" data-key="pi-${esc(i.id)}"><div class="prod-txt"><b>${esc(i.nombre)}</b><span>${fmt(i.precio)}</span>${q}</div>${stepper('pstep', i.id, +i.cant, 0)}</div>`;
  }).join('')}</div>`, 'p-prod'));
  pasos.push(paso(++n, 'Pago', `
    <div class="tiles tres">${pagoTile('Efectivo', 'Efectivo', ICON.efectivo)}${pagoTile('Transferencia', 'Transferencia', ICON.transferencia)}${pagoTile('Débito', 'Débito', ICON.debito)}</div>
    ${f.medio === 'Transferencia' ? `<div class="sub" data-key="cuenta"><p class="sub-t">¿A qué cuenta llegó?</p>${chips('cuenta', c.socios.map(s => [s, 'Cuenta de ' + s]), f.cuenta)}</div>` : ''}
    ${f.medio === 'Débito' && !c.cuenta_debito ? '<p class="ayuda" data-key="nota-deb">Todavía no está definida la cuenta del débito. Se suma al total, pero queda aparte en el reparto.</p>' : ''}`, 'p-pago'));

  return `${prev ? `<div class="editando" data-key="editando"><div><b>Editando ${esVenta(prev) ? 'la compra' : 'el grupo'} de ${esc(prev.nombre)}</b><small>Lo registró ${esc(prev.creadoPor || '?')} a las ${esc(horaDe(prev.creadoEn))}</small></div><button class="btn sm" data-act="cancelar">Cancelar</button></div>` : ''}
  ${otroDia ? `<p class="aviso-dia" data-key="otro-dia">Estás registrando en el ${esc(fechaLarga(S.fecha))}, no hoy.</p>` : ''}
  ${pasos.join('')}
  <section class="paso extra" data-key="p-obs">
    <label class="lbl" for="f-obs">Observaciones</label>
    <input id="f-obs" class="inp" data-field="obs" value="${esc(f.obs)}" placeholder="Opcional" autocomplete="off">
    ${prev ? `<div class="devol">
      <label class="lbl" for="f-dev">Devolución al cliente</label>
      <input id="f-dev" class="inp" data-field="devolucion" inputmode="numeric" value="${esc(f.devolucion)}" placeholder="$0">
      <p class="sub-t">Se devolvió con</p>${chips('devolucionDesde', [['Efectivo', 'Efectivo de la caja']].concat(c.socios.map(s => [s, 'Dinero de ' + s])), f.devolucionDesde)}
    </div>` : ''}
  </section>
  ${prev ? `<button class="btn quitar" data-act="${prev.estado === 'anulado' ? 'restaurar' : 'anular'}" data-v="${prev.id}">${prev.estado === 'anulado' ? 'Restaurar este registro' : 'Anular este registro'}</button>` : ''}
  <div class="accion" data-key="accion">
    <div class="acc-total"><small>${esc(detalle.join(' + ') || 'Agrega personas o productos')}</small><b>${cnt(total)}</b>${prev && dev ? `<small>Con devolución: ${fmt(total - dev)}</small>` : ''}</div>
    <button class="btn coral" data-act="guardar">${prev ? 'Guardar' : venta ? 'Registrar compra' : 'Registrar grupo'}</button>
  </div>`;
}

/* ---------- Grupos ---------- */
function anillo(e, color) {
  const C = 2 * Math.PI * 22;
  const resto = e.pct == null ? 0 : Math.max(0, 100 - e.pct);
  const off = C * (1 - resto / 100);
  const num = e.cls === 'prox' ? e.corto.replace('entra ', '') : e.corto.replace(' min', '');
  return `<div class="anillo ${e.cls}" style="--c:${colorHex(color)}">
    <svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="22" class="a-fondo"/><circle cx="26" cy="26" r="22" class="a-arco" style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${off.toFixed(1)}"/></svg>
    <span><b>${esc(num)}</b><small>${e.cls === 'prox' ? 'entra' : 'min'}</small></span>
  </div>`;
}
function tarjetaGrupo(x) {
  const e = estadoGrupo(x);
  const prods = Calc.productosDe(x);
  const pago = x.medio === 'Transferencia' ? 'Transf. ' + x.cuenta : x.medio;
  const tags = [`<span class="tag pul" style="--c:${colorHex(x.pulsera)}"><i></i>${+x.minutos === 60 ? '1 hora' : '½ hora'}</span>`,
    `<span class="tag">${x.personas} ${+x.personas === 1 ? 'persona' : 'personas'}</span>`]
    .concat(prods.map(p => `<span class="tag">${esc(p.nombre)} ×${p.cant}</span>`));
  const linea = e.cls === 'prox' ? 'Entran a las ' + x.entrada + ' y salen a las ' + x.salida
    : e.cls === 'pronto' ? '¡Salen a las ' + x.salida + '!' : 'Salen a las ' + x.salida;
  return `<article class="g g-vivo ${e.cls}" data-key="g-${x.id}" data-act="edit" data-v="${x.id}">
    ${anillo(e, x.pulsera)}
    <div class="g-info"><b class="g-nom">${esc(x.nombre)}</b><div class="tags">${tags.join('')}</div><small>${esc(linea)}</small></div>
    <div class="g-monto"><b>${fmt(x.total)}</b><small>${esc(pago)}</small></div>
  </article>`;
}
function filaGrupo(x) {
  const venta = esVenta(x);
  const prods = Calc.productosDe(x);
  const pago = x.medio === 'Transferencia' ? 'Transf. ' + x.cuenta : x.medio;
  const partes = venta ? [textoProductos(prods)]
    : [x.personas + (+x.personas === 1 ? ' persona' : ' personas') + ', ' + (+x.minutos === 60 ? '1 hora' : '½ hora'), x.entrada + ' a ' + x.salida].concat(prods.length ? [textoProductos(prods)] : []);
  const quien = 'Registró ' + (x.creadoPor || '?') + ' ' + horaDe(x.creadoEn) +
    (x.editadoPor ? (x.estado === 'anulado' ? ', anuló ' : ', editó ') + x.editadoPor + ' ' + horaDe(x.editadoEn) : '');
  return `<article class="g g-fila ${x.estado === 'anulado' ? 'anulado' : ''} ${venta ? 'venta' : ''}" data-key="g-${x.id}" data-act="edit" data-v="${x.id}">
    <i class="pul-dot" style="--c:${venta ? 'var(--line)' : colorHex(x.pulsera)}"></i>
    <div class="g-info"><b class="g-nom">${esc(x.nombre)}</b><small>${esc(partes.join(', '))}</small>
      ${+x.devolucion ? `<small class="g-dev">Devolución de ${fmt(x.devolucion)}</small>` : ''}
      ${x.obs ? `<small class="g-obs">${esc(x.obs)}</small>` : ''}
      <small class="g-quien">${esc(quien)}</small></div>
    <div class="g-monto"><b>${fmt(x.total)}</b><small>${esc(pago)}</small></div>
  </article>`;
}
function bloque(titulo, n, html, key) {
  if (!n) return '';
  return `<section class="bloque" data-key="${key}"><h2 class="bloque-h">${titulo}<span class="cuenta">${n}</span></h2>${html}</section>`;
}
function vistaDia() {
  const r = Calc.resumen(S.registros, S.gastos, S.config);
  const lista = S.registros.slice().sort((a, b) => minutosDe(a.entrada) - minutosDe(b.entrada));
  if (!lista.length) {
    return `<section class="vacio-card" data-key="vacio">
      <div class="vacio-ic">${iconoOla(48)}</div>
      <h2>Todavía no hay grupos</h2>
      <p>Los grupos que registres el ${esc(fechaLarga(S.fecha).toLowerCase())} aparecen aquí, con el tiempo que les queda.</p>
      ${diaCerrado() ? '' : '<button class="btn coral" data-act="tab" data-v="registrar">Registrar el primer grupo</button>'}
      ${DEMO && !diaCerrado() ? '<button class="btn" data-act="ejemplo">Cargar un día de ejemplo</button>' : ''}
    </section>`;
  }
  const vivos = lista.filter(x => x.estado !== 'anulado' && !esVenta(x));
  const grupos = { agua: [], prox: [], fin: [] };
  vivos.forEach(x => {
    const e = estadoGrupo(x);
    if (e.cls === 'activo' || e.cls === 'pronto') grupos.agua.push(x);
    else if (e.cls === 'prox') grupos.prox.push(x);
    else grupos.fin.push(x);
  });
  grupos.agua.sort((a, b) => segSalida(a) - segSalida(b));
  const ventas = lista.filter(x => x.estado !== 'anulado' && esVenta(x));
  const anulados = lista.filter(x => x.estado === 'anulado');
  const enAgua = grupos.agua.reduce((s, x) => s + (+x.personas), 0);
  const esHoy = S.fecha === hoy();

  return `<section class="cifras" data-key="cifras">
      ${esHoy ? `<div class="c-agua"><b>${cnt(enAgua, 'n')}</b><small>${enAgua === 1 ? 'persona' : 'personas'} en el agua</small></div>` : ''}
      <div><b>${cnt(r.grupos, 'n')}</b><small>grupos, ${r.personas} personas</small></div>
      <div><b>${cnt(r.recaudado)}</b><small>recaudado</small></div>
    </section>
    ${bloque('En el agua', grupos.agua.length, grupos.agua.map(tarjetaGrupo).join(''), 'b-agua')}
    ${bloque('Por entrar', grupos.prox.length, grupos.prox.map(tarjetaGrupo).join(''), 'b-prox')}
    ${bloque(esHoy ? 'Terminados' : 'Grupos', grupos.fin.length, grupos.fin.slice().reverse().map(filaGrupo).join(''), 'b-fin')}
    ${bloque('Compras sin entrada', ventas.length, ventas.map(filaGrupo).join(''), 'b-venta')}
    ${bloque('Anulados', anulados.length, anulados.map(filaGrupo).join(''), 'b-anul')}`;
}

/* ---------- Inventario ---------- */
function vistaInventario() {
  const st = stockHoy();
  const f = S.iform;
  const prods = S.config.productos;
  const cerrado = diaCerrado();
  if (!f.producto || !productoPorId(f.producto)) f.producto = prods[0] ? prods[0].id : '';
  const tipo = TIPOS_MOV.find(t => t[0] === f.tipo) || TIPOS_MOV[0];
  const movs = S.inventario.slice().reverse();
  const fuenteTxt = { conteo: 'contado hoy', anterior: 'quedó de antes', sin: '' };
  const tipoTxt = { inicial: 'Stock al abrir', ingreso: 'Llegó mercadería', ajuste: 'Corrección por conteo' };

  return `${prods.map(p => {
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
      ${conocido && s.queda < 0 ? '<p class="ayuda alerta" data-key="neg">El stock dio negativo. Cuenta lo que hay con "Contar ahora".</p>'
        : conocido && s.queda <= p.aviso_bajo ? '<p class="ayuda alerta" data-key="bajo">Quedan pocas.</p>' : ''}
      ${!conocido ? '<p class="ayuda" data-key="sin">Registra cuántas hay con "Stock al abrir", o con "Contar ahora" si ya empezaron a vender.</p>' : ''}
      <div class="p-grid">
        <div><small>Al abrir</small><b>${s.inicio == null ? '–' : s.inicio}</b>${s.inicio != null ? `<em>${fuenteTxt[s.fuente]}</em>` : ''}</div>
        <div><small>Llegaron</small><b>+${s.entradas}</b></div>
        <div><small>Vendidas</small><b>−${s.vendidas}</b></div>
        <div><small>Ajustes</small><b>${s.ajustes > 0 ? '+' : ''}${s.ajustes}</b></div>
      </div>
    </section>`;
  }).join('')}

  ${cerrado ? '' : `<section class="card" data-key="mov-form">
    <h2 class="card-h">Anotar en el inventario</h2>
    ${prods.length > 1 ? `<p class="sub-t">Producto</p>${chips('producto', prods.map(p => [p.id, p.nombre]), f.producto, 'iset')}` : ''}
    <p class="sub-t">¿Qué pasó?</p>
    ${chips('tipo', TIPOS_MOV.map(t => [t[0], t[1]]), f.tipo, 'iset')}
    <label class="lbl" for="i-cant">${tipo[2]}</label>
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
      const p = productoPorId(m.producto);
      const anul = m.estado === 'anulado';
      const signo = m.tipo === 'ingreso' ? '+' + m.cantidad : m.tipo === 'ajuste' ? (m.cantidad > 0 ? '+' : '') + m.cantidad : String(m.cantidad);
      return `<div class="fila mov ${anul ? 'anulado' : ''}" data-key="mv-${m.id}"><span>${esc(tipoTxt[m.tipo] || m.tipo)}, ${esc(p ? p.nombre.toLowerCase() : m.producto)}<small>${esc(m.creadoPor || '')} a las ${esc(horaDe(m.creadoEn))}${m.nota ? '. ' + esc(m.nota) : ''}${anul ? '. Anulado por ' + esc(m.editadoPor || '') : ''}</small></span><b>${esc(signo)}</b>${anul || cerrado ? '' : `<button class="x" data-act="anular-mov" data-v="${m.id}" aria-label="Anular movimiento">×</button>`}</div>`;
    }).join('') : '<p class="muted" data-key="sin-mov">Nada anotado hoy. Las ventas se descuentan solas al registrar cada grupo.</p>'}
  </section>
  <p class="pie">Para agregar productos o cambiar precios, usa la pestaña Productos de la planilla.</p>`;
}

/* ---------- Caja ---------- */
function vistaCaja() {
  const r = Calc.resumen(S.registros, S.gastos, S.config);
  const g = S.gform, c = S.config;
  const cerrado = diaCerrado();
  const fila = (l, v, cls, key) => `<div class="fila ${cls || ''}"${key ? ` data-key="${key}"` : ''}><span>${l}</span><b>${v}</b></div>`;
  const medios = [['Efectivo', r.efectivo, '#ffc93c']]
    .concat(r.socios.map((s, i) => ['Transferencias a ' + s, r.transf[s] || 0, COLOR_PAGO[i % COLOR_PAGO.length]]))
    .concat(r.debito || c.cuenta_debito ? [['Débito' + (r.cuentaDebito ? ' (cuenta de ' + r.cuentaDebito + ')' : ''), r.debito, '#ec4a2c']] : []);
  const sumaMedios = medios.reduce((s, m) => s + m[1], 0);
  const cambiosPostCierre = S.cierre && S.cierre.estado === 'cerrada' && Math.round(+S.cierre.neto) !== Math.round(r.netoTotal);

  return `<section class="total-dia" data-key="total">
    <small>Total del día</small>
    <b class="t-num">${cnt(r.recaudado)}</b>
    ${r.devol ? `<small class="t-nota">Ya descontadas devoluciones por ${fmt(r.devol)}</small>` : ''}
    <div class="split" role="img" aria-label="Cómo se pagó">${sumaMedios ? medios.filter(m => m[1] > 0).map(m => `<span style="flex-grow:${m[1]};background:${m[2]}"></span>`).join('') : '<span class="vacia"></span>'}</div>
    <ul class="leyenda">${medios.map(m => `<li data-key="l-${esc(m[0])}"><i style="background:${m[2]}"></i><span>${esc(m[0])}</span><b>${cnt(m[1])}</b></li>`).join('')}</ul>
  </section>

  <section class="card" data-key="vendido">
    <h2 class="card-h">Qué se vendió</h2>
    ${fila('Entradas de ½ hora <small>' + r.personasMedia + ' personas</small>', cnt(r.ventaMedia), '', 'vm')}
    ${fila('Entradas de 1 hora <small>' + r.personasHora + ' personas</small>', cnt(r.ventaHora), '', 'vh')}
    ${Object.keys(r.porProducto).map(k => fila(esc(r.porProducto[k].nombre) + ' <small>' + r.porProducto[k].cant + ' unidades</small>', cnt(r.porProducto[k].monto), '', 'vp-' + k)).join('')}
  </section>

  <section class="card" data-key="gastos">
    <h2 class="card-h">Gastos</h2>
    ${r.listaGastos.length ? r.listaGastos.map(x => `<div class="fila gasto" data-key="x-${x.id}"><span>${esc(x.concepto)}<small>${x.pagadoDesde === 'Efectivo' ? 'Con efectivo de la caja' : 'Con dinero de ' + esc(x.pagadoDesde)}, anotó ${esc(x.creadoPor || '')}</small></span><b>−${fmt(x.monto)}</b>${cerrado ? '' : `<button class="x" data-act="anular-gasto" data-v="${x.id}" aria-label="Anular gasto">×</button>`}</div>`).join('') : '<p class="muted" data-key="sin-gastos">Sin gastos anotados.</p>'}
    ${r.totalGastos ? fila('Total de gastos', '−' + fmt(r.totalGastos), 'tot neg', 'tg') : ''}
    ${cerrado ? '' : `<div class="gform" data-key="gform">
      <div class="chips mini">${['Almuerzo', 'Bencina', 'Hielo', 'Bolsas'].map(q => `<button type="button" class="chip" data-act="gq" data-v="${q}">${q}</button>`).join('')}</div>
      <div class="row2">
        <input class="inp" data-gfield="concepto" value="${esc(g.concepto)}" placeholder="En qué se gastó" autocomplete="off">
        <input class="inp" data-gfield="monto" value="${esc(g.monto)}" placeholder="Monto" inputmode="numeric">
      </div>
      <p class="sub-t">Se pagó con</p>
      ${chips('pagadoDesde', [['Efectivo', 'Efectivo de la caja']].concat(c.socios.map(s => [s, 'Dinero de ' + s])), g.pagadoDesde, 'gset')}
      <button class="btn" data-act="agregar-gasto">Anotar gasto</button>
    </div>`}
  </section>

  <section class="card reparto" data-key="reparto">
    <h2 class="card-h">Reparto entre socios</h2>
    <p class="frase">Neto del día <b>${cnt(r.netoTotal)}</b>. ${r.socios.length === 1 ? 'Todo corresponde a ' + esc(r.socios[0]) + '.' : `A cada socio le toca <b>${cnt(r.parte)}</b>.`}</p>
    ${r.debitoPendiente ? `<p class="ayuda" data-key="debpend">Hay ${fmt(r.debitoPendiente)} en débito que no se reparte hasta definir la cuenta.</p>` : ''}
    <div class="socios ${r.socios.length === 1 ? 'uno' : ''}">${r.socios.map((s, i) => {
      const e = r.entregar[s];
      return `<div class="socio" data-key="s-${esc(s)}" style="--c:${COLOR_PAGO[i % COLOR_PAGO.length]}">
        <div class="s-top"><span class="avatar">${inicial(s)}</span><b>${esc(s)}</b></div>
        <small>Ya recibió ${fmt(r.tiene[s])} en su cuenta</small>
        ${e >= 0 ? `<div class="s-lleva"><small>Se lleva en efectivo</small><b>${cnt(e)}</b></div>` : `<div class="s-lleva debe"><small>Debe transferir</small><b>${cnt(-e)}</b></div>`}
      </div>`;
    }).join('')}</div>
    ${r.ajustes.map(a => `<p class="ayuda alerta" data-key="aj-${esc(a.de)}">${esc(a.de)} recibió más que su parte por transferencias: debe pasarle ${fmt(a.monto)} ${a.a ? 'a ' + esc(a.a) : 'a los demás'}.</p>`).join('')}
    <div class="caja-check"><span>En la caja debería haber</span><b>${cnt(r.caja)}</b><small>en efectivo</small></div>
  </section>

  <section class="card cierre ${cerrado ? 'cerrada' : ''}" data-key="cierre">
    ${cerrado ? `<div class="c-estado"><span class="cerrado-ic">${ICON.lock}</span><div><b>Caja cerrada</b><small>La cerró ${esc(S.cierre.cerradoPor)} a las ${esc(horaDe(S.cierre.cerradoEn))}.</small></div></div>
      ${linkArchivo('btn')}
      ${!DEMO && !(S.cierre.archivo) ? '<p class="ayuda" data-key="arch-pend">El archivo del día aparece aquí cuando el cierre llega a la planilla.</p>' : ''}
      ${DEMO ? '<p class="ayuda" data-key="arch-demo">En la versión real, aquí aparece el botón para abrir el archivo de este día guardado en Drive.</p>' : ''}
      ${S.cierre.archivo && !/^https?:/.test(S.cierre.archivo) ? `<p class="ayuda alerta" data-key="arch-err">${esc(S.cierre.archivo)}</p>` : ''}
      ${cambiosPostCierre ? '<p class="ayuda alerta" data-key="post">Los totales no coinciden con lo que se cerró. Revisa con un administrador.</p>' : ''}`
    : `${S.cierre && S.cierre.estado === 'reabierta' ? `<p class="ayuda alerta" data-key="reab">La caja fue reabierta por ${esc(S.cierre.reabiertoPor || '')} a las ${esc(horaDe(S.cierre.reabiertoEn))}. Vuelve a cerrarla cuando termines.</p>` : ''}
      <button class="btn coral big" data-act="cerrar">Cerrar caja del día</button>
      <p class="ayuda">Al cerrar, el día queda bloqueado y se guarda una planilla con todo en la carpeta Cajas diarias del Drive.</p>`}
    <button class="btn" data-act="compartir">${ICON.compartir}<span>Compartir resumen</span></button>
    ${cerrado && esAdmin() ? '<button class="btn quitar" data-act="reabrir">Reabrir caja (administrador)</button>' : ''}
  </section>
  ${PRUEBA ? `<section class="prueba-pie" data-key="prueba">
    <p><b>Estás en la versión de prueba.</b> Para ver los días anteriores, toca la fecha de arriba y elige ayer o anteayer.</p>
    <button class="btn" data-act="reiniciar-prueba">Volver a los días de prueba originales</button>
  </section>` : ''}`;
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
    if (bloqueado()) return;
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
  reabrir: reabrirCaja,
  'ir-hoy'() { cambiarDia(hoy()); },
  dia(v) { cambiarDia(v); },
  compartir,
  ejemplo: cargarEjemplo,
  'reiniciar-prueba'() {
    if (!confirm('¿Volver a los días de prueba originales? Se borra lo que hayas registrado en esta prueba.')) return;
    borrarPrueba(); location.reload();
  }
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
  if (e.target.id === 'fecha' && e.target.value) cambiarDia(e.target.value > hoy() ? hoy() : e.target.value);
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
if (PRUEBA && LS.get('pa_semilla', null) !== 2) { borrarPrueba(); S.user = null; sembrarPrueba(); }
loadDay();
if (S.user) S.form = nuevoForm();
render();
if (S.user) { sync(); revisarAlertas(); pantallaEncendida(); } else cargarUsuarios();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { });
}
