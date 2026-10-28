/* Cálculos de caja e inventario — sin dependencias, usable en navegador y en Node.
   Las funciones de stock (productosDe, stockDia, stockAntes) están copiadas igual en apps-script/Codigo.gs. */
(function (root) {
  'use strict';

  function precioPersona(cfg, minutos) {
    return +minutos === 60 ? +cfg.precio_hora : +cfg.precio_media;
  }

  /** Productos vendidos en un registro: [{id, nombre, cant, precio}].
   *  Registros antiguos solo tienen "calcetas" + "precioCalceta". */
  function productosDe(r) {
    let a = r && r.productos;
    if (typeof a === 'string' && a) { try { a = JSON.parse(a); } catch (e) { a = null; } }
    if (Array.isArray(a)) return a.filter(p => p && +p.cant > 0);
    if (r && +r.calcetas > 0) return [{ id: 'calcetas', nombre: 'Calcetas', cant: +r.calcetas, precio: +r.precioCalceta || 0 }];
    return [];
  }

  function totalGrupo(g) {
    const entradas = (+g.personas || 0) * (+g.precioPersona || 0);
    const prods = productosDe(g).reduce((s, p) => s + (+p.cant) * (+p.precio || 0), 0);
    return entradas + prods;
  }

  /**
   * Stock de un día por producto.
   * - inicio: último "Stock al abrir" del día; si no hay, lo que quedó el día anterior (previo); si no, desconocido.
   * - queda = inicio + llegadas + ajustes − vendidas.
   */
  function stockDia(ids, previo, movs, regs) {
    const res = {};
    const vivos = (movs || []).filter(m => m.estado !== 'anulado');
    const ventas = (regs || []).filter(r => r.estado !== 'anulado');
    ids.forEach(id => {
      const m = vivos.filter(x => x.producto === id);
      const ini = m.filter(x => x.tipo === 'inicial');
      let inicio = null, fuente = 'sin';
      if (ini.length) { inicio = +ini[ini.length - 1].cantidad || 0; fuente = 'conteo'; }
      else if (previo && previo[id] != null) { inicio = +previo[id]; fuente = 'anterior'; }
      const entradas = m.filter(x => x.tipo === 'ingreso').reduce((s, x) => s + (+x.cantidad || 0), 0);
      const ajustes = m.filter(x => x.tipo === 'ajuste').reduce((s, x) => s + (+x.cantidad || 0), 0);
      let vendidas = 0;
      ventas.forEach(r => productosDe(r).forEach(p => { if (p.id === id) vendidas += +p.cant; }));
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
   * Resumen del día y reparto entre socios.
   * - "tiene": lo que cada socio ya recibió en su cuenta (transferencias, débito si es su cuenta)
   *   menos devoluciones o gastos que pagó él.
   * - "caja": efectivo físico = efectivo cobrado − devoluciones en efectivo − gastos pagados en efectivo.
   * - Cada socio debe terminar con la misma parte; "entregar" = efectivo que le toca de la caja.
   *   Si es negativo, ese socio recibió de más por transferencia y debe pasarle la diferencia al otro.
   */
  function resumen(registros, gastos, cfg) {
    const socios = (cfg.socios && cfg.socios.length) ? cfg.socios : ['Socio 1', 'Socio 2'];
    const regs = (registros || []).filter(r => r.estado !== 'anulado');
    const gas = (gastos || []).filter(g => g.estado !== 'anulado');
    const ctaDeb = cfg.cuenta_debito && socios.indexOf(cfg.cuenta_debito) >= 0 ? cfg.cuenta_debito : '';

    const r = {
      socios, grupos: 0, ventasSueltas: 0, personas: 0, personasMedia: 0, personasHora: 0,
      ventaMedia: 0, ventaHora: 0, ventaProductos: 0, unidades: 0, porProducto: {},
      efectivo: 0, transf: {}, debito: 0, bruto: 0,
      devol: 0, devEfectivo: 0, devSocio: {},
      totalGastos: 0, gastosEf: 0, gastosSocio: {}, listaGastos: gas,
      cuentaDebito: ctaDeb
    };
    socios.forEach(s => { r.transf[s] = 0; r.devSocio[s] = 0; r.gastosSocio[s] = 0; });

    regs.forEach(x => {
      const t = +x.total || 0;
      const p = +x.personas || 0;
      r.bruto += t;
      if (p > 0) r.grupos++; else r.ventasSueltas++;
      r.personas += p;
      const entr = p * (+x.precioPersona || 0);
      if (+x.minutos === 60) { r.personasHora += p; r.ventaHora += entr; }
      else { r.personasMedia += p; r.ventaMedia += entr; }
      productosDe(x).forEach(pr => {
        const k = pr.id;
        if (!r.porProducto[k]) r.porProducto[k] = { nombre: pr.nombre, cant: 0, monto: 0 };
        r.porProducto[k].cant += +pr.cant;
        r.porProducto[k].monto += (+pr.cant) * (+pr.precio || 0);
        r.unidades += +pr.cant;
        r.ventaProductos += (+pr.cant) * (+pr.precio || 0);
      });

      if (x.medio === 'Efectivo') r.efectivo += t;
      else if (x.medio === 'Transferencia') r.transf[x.cuenta] = (r.transf[x.cuenta] || 0) + t;
      else if (x.medio === 'Débito') r.debito += t;

      const d = +x.devolucion || 0;
      if (d) {
        r.devol += d;
        if (!x.devolucionDesde || x.devolucionDesde === 'Efectivo') r.devEfectivo += d;
        else r.devSocio[x.devolucionDesde] = (r.devSocio[x.devolucionDesde] || 0) + d;
      }
    });
    r.calcetas = (r.porProducto.calcetas || { cant: 0 }).cant;

    gas.forEach(g => {
      const m = +g.monto || 0;
      r.totalGastos += m;
      if (!g.pagadoDesde || g.pagadoDesde === 'Efectivo') r.gastosEf += m;
      else r.gastosSocio[g.pagadoDesde] = (r.gastosSocio[g.pagadoDesde] || 0) + m;
    });

    r.recaudado = r.bruto - r.devol;                 // lo que la planilla llama "Total"
    r.netoTotal = r.recaudado - r.totalGastos;       // después de gastos
    r.debitoPendiente = ctaDeb ? 0 : r.debito;       // débito sin cuenta definida: no se reparte aún
    r.caja = r.efectivo - r.devEfectivo - r.gastosEf;

    r.tiene = {};
    socios.forEach(s => {
      r.tiene[s] = (r.transf[s] || 0) + (s === ctaDeb ? r.debito : 0) - (r.devSocio[s] || 0) - (r.gastosSocio[s] || 0);
    });

    r.repartible = r.netoTotal - r.debitoPendiente;
    r.parte = r.repartible / socios.length;
    r.entregar = {};
    socios.forEach(s => { r.entregar[s] = r.parte - r.tiene[s]; });

    // Ajustes entre socios cuando alguno recibió de más por transferencia
    r.ajustes = [];
    const deben = socios.filter(s => r.entregar[s] < 0);
    const reciben = socios.filter(s => r.entregar[s] > 0);
    deben.forEach(s => r.ajustes.push({ de: s, a: reciben.length === 1 ? reciben[0] : '', monto: -r.entregar[s] }));
    return r;
  }

  const api = { precioPersona, productosDe, totalGrupo, stockDia, stockAntes, resumen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
