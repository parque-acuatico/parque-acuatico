/* Cálculos de caja — sin dependencias, usable en navegador y en Node */
(function (root) {
  'use strict';

  function precioPersona(cfg, minutos) {
    return +minutos === 60 ? +cfg.precio_hora : +cfg.precio_media;
  }

  function totalGrupo(g) {
    return (+g.personas || 0) * (+g.precioPersona || 0) + (+g.calcetas || 0) * (+g.precioCalceta || 0);
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
      socios, grupos: regs.length, personas: 0, personasMedia: 0, personasHora: 0, calcetas: 0,
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
      r.personas += p;
      r.calcetas += +x.calcetas || 0;
      if (+x.minutos === 60) r.personasHora += p; else r.personasMedia += p;

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

  const api = { precioPersona, totalGrupo, resumen };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
