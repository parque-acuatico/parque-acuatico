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

  /**
   * Stock de un día por ítem (productos e ids "pulsera:Color").
   * inicio: último "Stock al abrir" del día; si no hay, lo que quedó el día anterior; si no, desconocido.
   * queda = inicio + llegadas + ajustes − salidas.
   */
  function stockDia(ids, previo, movs, regs) {
    const res = {};
    const vivos = (movs || []).filter(m => m.estado !== 'anulado');
    const usados = {};
    (regs || []).filter(r => r.estado !== 'anulado').forEach(r => consumosDe(r).forEach(c => { usados[c.id] = (usados[c.id] || 0) + c.cant; }));
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
      totalGastos: 0, gastosCaja: 0, listaGastos: gas, porPersona: {}
    };
    // Quién hizo qué: cada venta cuenta para quien la registró; anulaciones y ediciones para quien las hizo.
    const persona = n => {
      n = String(n || '').trim() || 'Sin nombre';
      if (!r.porPersona[n]) r.porPersona[n] = { ventas: 0, monto: 0, efectivo: 0, debito: 0, otros: 0, pulseras: 0, gratis: 0, devol: 0, gastos: 0, anuladas: 0, editadas: 0 };
      return r.porPersona[n];
    };
    (registros || []).forEach(v => {
      if (v.estado === 'anulado') { if (v.editadoPor) persona(v.editadoPor).anuladas++; return; }
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
          if (!r.porColor[l.color]) r.porColor[l.color] = { cant: 0, gratis: 0 };
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

  const api = { lineasDe, productosDe, totalVenta, consumosDe, stockDia, stockAntes, resumen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
