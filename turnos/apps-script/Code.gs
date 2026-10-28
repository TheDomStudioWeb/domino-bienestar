/**
 * DOMino Turnos — Backend (Google Apps Script) · v0.2
 * ------------------------------------------------------------------
 * La planilla es la base de datos; este script es la ÚNICA puerta.
 * Una planilla + un script por negocio. Costo cero.
 *
 * Hojas: config · recursos · servicios · horarios · bloqueos · turnos · slots · usuarios
 *
 * Todo entra por POST (texto JSON): { accion, ...datos, token? }
 *   Públicas (sin sesión): config_publica, horarios_libres, reservar, ver_turno, cancelar_turno
 *   Del personal (con token): login, agenda, crear_turno, cambiar_estado, reprogramar,
 *                             guardar_bloqueo, recordatorios_manana, marcar_avisado
 * Doble reserva: LockService + hoja «slots» (una fila por tramo ocupado).
 * Despliegue: Implementar > Aplicación web > Ejecutar como: yo · Acceso: cualquier persona.
 */

const DIAS_TOKEN = 30;
const MAX_INTENTOS_LOGIN = 5;
const MIN_BLOQUEO_LOGIN = 10;
const HASH_VUELTAS = 1000;
const MAX_RESERVAS_TEL_DIA = 3;
const ROLES = ['Senior', 'Mid Senior', 'Asistente', 'Profesional'];
const ROLES_GESTION = ['Senior', 'Mid Senior'];
const ROLES_AGENDA_TOTAL = ['Senior', 'Mid Senior', 'Asistente'];
const ESTADOS = ['Por confirmar', 'Confirmado', 'En sala', 'Atendido', 'Cancelado', 'No vino', 'Reprogramado'];
const ESTADOS_ACTIVOS = ['Por confirmar', 'Confirmado', 'En sala'];
const TRANSICIONES = {
  'Por confirmar': ['Confirmado', 'Cancelado'],
  'Confirmado': ['En sala', 'Cancelado', 'No vino'],
  'En sala': ['Atendido', 'Cancelado'],
  'Atendido': [], 'Cancelado': [], 'No vino': [], 'Reprogramado': []
};
const HOJAS = { config: 'config', recursos: 'recursos', servicios: 'servicios', horarios: 'horarios', bloqueos: 'bloqueos', turnos: 'turnos', slots: 'slots', usuarios: 'usuarios' };
const COL_TURNOS = ['id', 'codigo', 'estado', 'fecha', 'hora', 'duracion_min', 'recurso_id', 'servicio_id', 'cliente_id', 'cliente_nombre', 'contacto_nombre', 'contacto_tel', 'contacto_email', 'sujeto_nombre', 'sujeto_tipo', 'nota', 'motivo_cancelacion', 'reprogramado_de', 'origen', 'consentimiento', 'avisado', 'creado', 'actualizado'];
const CAMPOS_TEXTO = ['fecha', 'hora', 'contacto_tel', 'codigo', 'desde', 'hasta'];

// ── Entrada ───────────────────────────────────────────────────────
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'widget') {
    // Solo lectura para el widget del teléfono. Clave larga en Propiedades del script (LAUNCHER_KEY); se crea con prepararWidget().
    const clave = PropertiesService.getScriptProperties().getProperty('LAUNCHER_KEY');
    if (!clave || p.key !== clave) return json_({ ok: false, error: 'sin_autorizacion' });
    try { return json_(resumenWidget_()); } catch (err) { return json_({ ok: false, error: 'error' }); }
  }
  return json_({ ok: true, servicio: 'DOMino Turnos' });
}

/** Ejecutar UNA vez desde el editor: crea la clave del widget y la muestra en el registro. */
function prepararWidget() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('LAUNCHER_KEY')) props.setProperty('LAUNCHER_KEY', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  console.log('Clave del widget (LAUNCHER_KEY): ' + props.getProperty('LAUNCHER_KEY'));
  console.log('Dirección: <URL de la aplicación web>?action=widget&key=<la clave de arriba>');
}

// Resumen para el widget: turnos de hoy, solicitudes por confirmar y novedades de las últimas 48 h.
function resumenWidget_() {
  const tz = Session.getScriptTimeZone(), ahora = new Date(), hoy = Utilities.formatDate(ahora, tz, 'yyyy-MM-dd'), horaAhora = Utilities.formatDate(ahora, tz, 'HH:mm');
  const recs = {}; leerHoja_(HOJAS.recursos).forEach(r => { recs[String(r.id)] = r.nombre; });
  const svs = {}; leerHoja_(HOJAS.servicios).forEach(s => { svs[String(s.id)] = s.nombre; });
  const todos = leerHoja_(HOJAS.turnos);
  const fila = t => ({ id: String(t.id), hora: t.hora, fecha: t.fecha, nombre: t.contacto_nombre, mascota: t.sujeto_nombre || '', servicio: svs[String(t.servicio_id)] || '', profesional: recs[String(t.recurso_id)] || '', estado: t.estado, origen: t.origen });
  const deHoy = todos.filter(t => t.fecha === hoy && ESTADOS_ACTIVOS.indexOf(t.estado) > -1).sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
  const porConfirmar = todos.filter(t => t.estado === 'Por confirmar' && t.fecha >= hoy).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  const proximo = deHoy.find(t => t.estado !== 'En sala' && String(t.hora) >= horaAhora);
  const desde = new Date(ahora.getTime() - 48 * 3600000).toISOString();
  const novedades = todos.filter(t => t.creado && String(t.creado) >= desde && (t.estado === 'Por confirmar' || t.estado === 'Confirmado')).sort((a, b) => String(b.creado).localeCompare(String(a.creado))).slice(0, 10);
  return {
    ok: true, generado: ahora.toISOString(), negocio: config_().nombre,
    resumen: { hoy: deHoy.length, por_confirmar: porConfirmar.length, atendidos_hoy: todos.filter(t => t.fecha === hoy && t.estado === 'Atendido').length },
    proximo_turno: proximo ? fila(proximo) : null,
    turnos_hoy: deHoy.map(fila),
    por_confirmar: porConfirmar.slice(0, 10).map(fila),
    novedades: novedades.map(t => Object.assign(fila(t), { creado: t.creado }))
  };
}

function doPost(e) {
  let p;
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_({ ok: false, error: 'pedido_invalido' }); }
  try { return json_(despachar_(p)); }
  catch (err) { if (!(err && err.codigo)) console.error(err && err.stack || err); return json_({ ok: false, error: err && err.codigo ? err.codigo : 'error_interno' }); }
}

function falla_(codigo) { const e = new Error(codigo); e.codigo = codigo; return e; }

function despachar_(p) {
  const a = String(p.accion || '');
  const PUB = { inicio: inicio_, clases_dias: clasesDias_, config_publica: configPublica_, horarios_libres: horariosLibres_, reservar: reservar_, ver_turno: verTurno_, cancelar_turno: cancelarTurno_ };
  if (PUB[a]) return PUB[a](p);
  if (a === 'login') return login_(p.email, p.clave);
  const u = validarToken_(p.token);
  if (!u) return { ok: false, error: 'sesion_invalida' };
  const PRIV = { agenda: agenda_, historial: historial_, vincular_cliente: vincularCliente_, crear_turno: crearTurno_, cambiar_estado: cambiarEstado_, reprogramar: reprogramar_, guardar_bloqueo: guardarBloqueo_, clases_config: clasesConfig_, guardar_clase: guardarClase_, quitar_clase: quitarClase_, recordatorios_manana: recordatoriosManana_, marcar_avisado: marcarAvisado_ };
  if (!PRIV[a]) return { ok: false, error: 'accion_desconocida' };
  return PRIV[a](p, u);
}

// ── Configuración y datos base ───────────────────────────────────
function config_() {
  const c = { nombre: 'Negocio', paso_min: 30, modo_reserva: 'solicitud', anticipacion_min_horas: 2, cancelacion_limite_horas: 4, ventana_dias: 30, rubro: 'bienestar', telefono: '' };
  leerHoja_(HOJAS.config).forEach(r => { if (r.clave) c[String(r.clave)] = r.valor; });
  ['paso_min', 'anticipacion_min_horas', 'cancelacion_limite_horas', 'ventana_dias'].forEach(k => c[k] = Number(c[k]));
  return c;
}
function activos_(nombre) { return leerHoja_(nombre).filter(r => String(r.activo).toLowerCase() !== 'no' && String(r.activo).toLowerCase() !== 'false'); }
function lista_(v) { return String(v || '').split(',').map(s => s.trim()).filter(Boolean); }

function configPublica_() {
  const c = config_();
  const servicios = activos_(HOJAS.servicios).filter(s => String(s.publico).toLowerCase() !== 'no');
  const recursos = activos_(HOJAS.recursos).filter(r => String(r.tipo) !== 'sala' || true);
  return { ok: true, negocio: { nombre: c.nombre, rubro: c.rubro, telefono: c.telefono, modo_reserva: c.modo_reserva, ventana_dias: c.ventana_dias, cancelacion_limite_horas: c.cancelacion_limite_horas },
    servicios: servicios.map(s => ({ id: String(s.id), nombre: s.nombre, duracion_min: Number(s.duracion_min), recursos: lista_(s.recursos), cupo: cupoDe_(s), actividad: s.actividad || '', profesor: s.profesor || '' })),
    recursos: recursos.map(r => ({ id: String(r.id), nombre: r.nombre, tipo: r.tipo, color: r.color })) };
}

// Una sola llamada para abrir la página: configuración + horarios libres de cada servicio público (evita una espera de red).
function inicio_() {
  const cfg = configPublica_(), c = config_(), dias = Math.min(c.ventana_dias, 14), desde = deMin_(ahoraMin_()).fecha, h = {};
  cfg.servicios.forEach(sv => { h[sv.id] = horariosLibres_({ servicio_id: sv.id, desde: desde, dias: dias }).dias; });
  cfg.horarios = h; cfg.generado = Date.now();
  return cfg;
}


// Clases con cupo de hoy y los próximos días, con lugares libres (para el Hub de Bienestar). Solo cuenta lugares: no devuelve datos de personas.
function clasesDias_(p) {
  const c = config_(), dias = Math.min(Math.max(Number(p.dias) || 4, 1), 14), hoy = deMin_(ahoraMin_()).fecha, ahora = ahoraMin_();
  const ocupados = mapaOcupados_(), horarios = leerHoja_(HOJAS.horarios), bloqueos = leerHoja_(HOJAS.bloqueos);
  const recs = {}; activos_(HOJAS.recursos).forEach(r => { recs[String(r.id)] = r.nombre; });
  const out = [];
  activos_(HOJAS.servicios).filter(s => cupoDe_(s) > 1).forEach(serv => {
    const cupo = cupoDe_(serv), dur = Number(serv.duracion_min);
    lista_(serv.recursos).forEach(rid => {
      for (let i = 0; i < dias; i++) {
        const f = deMin_(aMin_(hoy, '00:00') + i * 1440).fecha, dow = diaSemana_(f);
        horarios.filter(h => String(h.recurso_id) === rid && Number(h.dia_semana) === dow).forEach(h => {
          const ini = aMin_(f, h.desde); if (ini + dur > aMin_(f, h.hasta)) return;
          let usados = 0; for (let t = ini; t < ini + dur; t += c.paso_min) usados = Math.max(usados, ocupados[claveSlot_(rid, t)] || 0);
          out.push({ fecha: f, hora: deMin_(ini).hora, servicio_id: String(serv.id), clase: serv.nombre, profesor: serv.profesor || '', sala: recs[rid] || '', cupo: cupo, libres: Math.max(cupo - usados, 0), suspendida: enBloqueo_(bloqueos, rid, ini, ini + dur), pasada: ini + dur <= ahora });
        });
      }
    });
  });
  out.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  return { ok: true, clases: out };
}

// ── Tiempo (todo en minutos "de pared", sin depender de la zona del servidor) ──
function aMin_(fecha, hora) { const f = String(fecha).split('-').map(Number), h = String(hora).split(':').map(Number); return Date.UTC(f[0], f[1] - 1, f[2], h[0], h[1] || 0) / 60000; }
function deMin_(m) { const d = new Date(m * 60000); const z = n => ('0' + n).slice(-2); return { fecha: d.getUTCFullYear() + '-' + z(d.getUTCMonth() + 1) + '-' + z(d.getUTCDate()), hora: z(d.getUTCHours()) + ':' + z(d.getUTCMinutes()) }; }
function ahoraMin_() { const t = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm').split(' '); return aMin_(t[0], t[1]); }
function diaSemana_(fecha) { const f = String(fecha).split('-').map(Number); return new Date(Date.UTC(f[0], f[1] - 1, f[2])).getUTCDay(); } // 0 = domingo
function validaFecha_(f) { return /^\d{4}-\d{2}-\d{2}$/.test(String(f)); }
function validaHora_(h) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(h)); }
function claveSlot_(recurso, min) { const t = deMin_(min); return recurso + '|' + t.fecha + '|' + t.hora; }

// ── Disponibilidad ───────────────────────────────────────────────
// Devuelve los inicios libres de un recurso/servicio para una fecha.
// Cupo: personas por horario. Servicio individual = 1 (un turno por tramo). Clase = cupo > 1: cada fila de «horarios» es UNA clase que empieza en «desde».
function cupoDe_(serv) { const n = Math.floor(Number(serv && serv.cupo)); return n > 1 ? Math.min(n, 500) : 1; }
function inicioLibres_(c, serv, recursoId, fecha, ocupados, horarios, bloqueos, conLugares) {
  const out = [], dur = Number(serv.duracion_min), paso = c.paso_min, cupo = cupoDe_(serv);
  const dow = diaSemana_(fecha), ahora = ahoraMin_();
  const minInicio = ahora + c.anticipacion_min_horas * 60, maxInicio = ahora + c.ventana_dias * 1440;
  horarios.filter(h => String(h.recurso_id) === String(recursoId) && Number(h.dia_semana) === dow).forEach(h => {
    const d = aMin_(fecha, h.desde), ha = aMin_(fecha, h.hasta);
    for (let ini = d; ini + dur <= ha; ini += (cupo > 1 ? 1e9 : paso)) { // clase: un solo inicio por fila
      if (ini < minInicio || ini > maxInicio) continue;
      let libre = true;
      let usados = 0;
      for (let t = ini; t < ini + dur; t += paso) { const u = ocupados[claveSlot_(recursoId, t)] || 0; if (u > usados) usados = u; if (u >= cupo) { libre = false; break; } }
      if (libre && enBloqueo_(bloqueos, recursoId, ini, ini + dur)) libre = false;
      if (libre) { const hh = deMin_(ini).hora; out.push(hh); if (conLugares) conLugares[hh] = cupo - usados; }
    }
  });
  return out;
}
function enBloqueo_(bloqueos, recursoId, ini, fin) {
  return bloqueos.some(b => (String(b.recurso_id) === String(recursoId) || String(b.recurso_id) === '*' || String(b.recurso_id) === '') && ini < bloqueoMin_(b.hasta, true) && fin > bloqueoMin_(b.desde, false));
}
function bloqueoMin_(v, fin) { const s = String(v); const p = s.split(' '); return aMin_(p[0], p[1] || (fin ? '23:59' : '00:00')); }

function mapaOcupados_() {
  const m = {};
  leerHoja_(HOJAS.slots).forEach(s => { const k = String(s.clave); m[k] = (m[k] || 0) + 1; }); // cuenta cuántos turnos ocupan cada tramo (clases con cupo)
  return m;
}

function horariosLibres_(p) {
  const c = config_();
  const serv = activos_(HOJAS.servicios).find(s => String(s.id) === String(p.servicio_id));
  if (!serv) throw falla_('servicio_invalido');
  if (!validaFecha_(p.desde)) throw falla_('fecha_invalida');
  const dias = Math.min(Math.max(Number(p.dias) || 7, 1), 31);
  const recs = (p.recurso_id ? [String(p.recurso_id)] : lista_(serv.recursos)).filter(r => lista_(serv.recursos).indexOf(r) > -1);
  const ocupados = mapaOcupados_(), horarios = leerHoja_(HOJAS.horarios), bloqueos = leerHoja_(HOJAS.bloqueos);
  const res = [];
  for (let i = 0; i < dias; i++) {
    const f = deMin_(aMin_(p.desde, '00:00') + i * 1440).fecha;
    const porRec = {}, lug = {};
    recs.forEach(r => { const l = {}; const h = inicioLibres_(c, serv, r, f, ocupados, horarios, bloqueos, l); if (h.length) { porRec[r] = h; lug[r] = l; } });
    if (Object.keys(porRec).length) res.push(cupoDe_(serv) > 1 ? { fecha: f, recursos: porRec, lugares: lug } : { fecha: f, recursos: porRec });
  }
  return { ok: true, dias: res };
}

// ── Núcleo: ocupar horario (con cerrojo) ─────────────────────────
function ocuparYGuardar_(datos, opciones) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw falla_('sistema_ocupado');
  try {
    const c = config_();
    const serv = activos_(HOJAS.servicios).find(s => String(s.id) === String(datos.servicio_id));
    if (!serv) throw falla_('servicio_invalido');
    if (lista_(serv.recursos).indexOf(String(datos.recurso_id)) < 0) throw falla_('recurso_invalido');
    if (!activos_(HOJAS.recursos).some(r => String(r.id) === String(datos.recurso_id))) throw falla_('recurso_invalido');
    if (!validaFecha_(datos.fecha) || !validaHora_(datos.hora)) throw falla_('fecha_invalida');
    const dur = Number(serv.duracion_min), ini = aMin_(datos.fecha, datos.hora);
    if (ini % c.paso_min !== 0) throw falla_('horario_invalido');
    const ocup = mapaOcupados_();
    const libres = inicioLibres_(c, serv, datos.recurso_id, datos.fecha, ocup, leerHoja_(HOJAS.horarios), leerHoja_(HOJAS.bloqueos));
    const fuerza = opciones && opciones.forzar;
    if (!fuerza) { if (libres.indexOf(datos.hora) < 0) throw falla_(horaOcupada_(datos, dur, c, ocup, cupoDe_(serv)) ? 'horario_ocupado' : 'fuera_de_horario'); }
    else if (horaOcupada_(datos, dur, c, ocup, cupoDe_(serv))) throw falla_('horario_ocupado');
    const id = 'T' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    const codigo = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    const filaSlots = [];
    for (let t = ini; t < ini + dur; t += c.paso_min) filaSlots.push([claveSlot_(datos.recurso_id, t), id]);
    const ahora = new Date().toISOString();
    const t = Object.assign({ id: id, codigo: codigo, duracion_min: dur, creado: ahora, actualizado: ahora, avisado: '' }, datos);
    agregarFila_(HOJAS.turnos, COL_TURNOS, t);
    const hs = obtenerHoja_(HOJAS.slots);
    asegurarColumnas_(hs, ['clave', 'turno_id']);
    filaSlots.forEach(f => hs.appendRow(f));
    return t;
  } finally { lock.releaseLock(); }
}
function horaOcupada_(d, dur, c, ocup, cupo) {
  const ini = aMin_(d.fecha, d.hora), tope = cupo || 1;
  for (let t = ini; t < ini + dur; t += c.paso_min) if ((ocup[claveSlot_(d.recurso_id, t)] || 0) >= tope) return true;
  return false;
}
function liberarSlots_(turnoId) { // se llama dentro del cerrojo
  const sh = obtenerHoja_(HOJAS.slots), datos = sh.getDataRange().getValues();
  for (let i = datos.length - 1; i >= 1; i--) if (String(datos[i][1]) === String(turnoId)) sh.deleteRow(i + 1);
}

// ── Reserva pública ──────────────────────────────────────────────
function reservar_(p) {
  if (p.web) return { ok: true, codigo: 'x' }; // campo trampa: un robot lo completa
  const c = config_();
  const nombre = limpiar_(p.nombre, 80), tel = String(p.tel || '').replace(/[^\d+]/g, '').slice(0, 20), email = limpiar_(p.email, 80);
  if (nombre.length < 2) throw falla_('falta_nombre');
  if (tel.length < 6) throw falla_('falta_telefono');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw falla_('email_invalido');
  if (!p.consentimiento) throw falla_('falta_consentimiento');
  const cache = CacheService.getScriptCache(), kT = 'res_' + tel;
  const n = Number(cache.get(kT) || 0);
  if (n >= MAX_RESERVAS_TEL_DIA) throw falla_('demasiadas_reservas');
  const sv = activos_(HOJAS.servicios).find(x => String(x.id) === String(p.servicio_id));
  if (!sv || String(sv.publico).toLowerCase() === 'no') throw falla_('servicio_invalido');
  const estado = c.modo_reserva === 'inmediata' ? 'Confirmado' : 'Por confirmar';
  const t = ocuparYGuardar_({ estado: estado, fecha: p.fecha, hora: p.hora, recurso_id: p.recurso_id, servicio_id: p.servicio_id, contacto_nombre: nombre, contacto_tel: tel, contacto_email: email, sujeto_nombre: limpiar_(p.sujeto_nombre, 60), sujeto_tipo: limpiar_(p.sujeto_tipo, 30), nota: limpiar_(p.nota, 300), origen: 'web', consentimiento: 'si' });
  cache.put(kT, String(n + 1), 86400);
  avisoCorreo_(t, estado === 'Confirmado' ? 'confirmado' : 'recibido', c);
  return { ok: true, codigo: t.codigo, estado: estado, fecha: t.fecha, hora: t.hora };
}
function limpiar_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }

function turnoPorCodigo_(codigo) {
  if (!codigo || String(codigo).length < 12) return null;
  return leerHoja_(HOJAS.turnos).find(t => String(t.codigo) === String(codigo)) || null;
}
function verTurno_(p) {
  const t = turnoPorCodigo_(p.codigo); if (!t) throw falla_('turno_no_encontrado');
  const serv = leerHoja_(HOJAS.servicios).find(s => String(s.id) === String(t.servicio_id)) || {};
  const rec = leerHoja_(HOJAS.recursos).find(r => String(r.id) === String(t.recurso_id)) || {};
  const c = config_();
  return { ok: true, turno: { estado: t.estado, fecha: t.fecha, hora: t.hora, servicio: serv.nombre, profesional: rec.nombre, sujeto: t.sujeto_nombre, puede_cancelar: puedeCancelar_(t, c) }, negocio: { nombre: c.nombre, telefono: c.telefono } };
}
function puedeCancelar_(t, c) { return ESTADOS_ACTIVOS.indexOf(t.estado) > -1 && aMin_(t.fecha, t.hora) - ahoraMin_() >= c.cancelacion_limite_horas * 60; }
function cancelarTurno_(p) {
  const t = turnoPorCodigo_(p.codigo); if (!t) throw falla_('turno_no_encontrado');
  if (!puedeCancelar_(t, config_())) throw falla_(ESTADOS_ACTIVOS.indexOf(t.estado) > -1 ? 'fuera_de_plazo' : 'estado_invalido');
  cambiarEstadoInterno_(t.id, 'Cancelado', 'Cancelado por el cliente');
  return { ok: true };
}

// ── Cambios de estado (cerrojo) ──────────────────────────────────
function cambiarEstadoInterno_(id, nuevo, motivo) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw falla_('sistema_ocupado');
  try {
    const sh = obtenerHoja_(HOJAS.turnos), fila = buscarFila_(sh, id);
    if (fila < 0) throw falla_('turno_no_encontrado');
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
    const val = k => sh.getRange(fila, headers.indexOf(k) + 1);
    const actual = String(val('estado').getValue());
    if (TRANSICIONES[actual].indexOf(nuevo) < 0) throw falla_('estado_invalido');
    if (nuevo === 'No vino' && aMin_(String(val('fecha').getValue()), String(val('hora').getValue())) > ahoraMin_()) throw falla_('aun_no_es_la_hora');
    val('estado').setValue(nuevo);
    if (motivo) val('motivo_cancelacion').setValue(motivo);
    val('actualizado').setValue(new Date().toISOString());
    if (nuevo === 'Cancelado' || nuevo === 'No vino' || nuevo === 'Reprogramado') liberarSlots_(id);
    return true;
  } finally { lock.releaseLock(); }
}

// ── Personal ─────────────────────────────────────────────────────
function recursoDe_(u) { const r = leerHoja_(HOJAS.recursos).find(x => String(x.usuario_email).toLowerCase() === String(u.email).toLowerCase()); return r ? String(r.id) : null; }
function puedeVer_(u, t) { return ROLES_AGENDA_TOTAL.indexOf(u.rol) > -1 || (u.rol === 'Profesional' && recursoDe_(u) === String(t.recurso_id)); }

function agenda_(p, u) {
  if (!validaFecha_(p.desde) || !validaFecha_(p.hasta)) throw falla_('fecha_invalida');
  const servs = leerHoja_(HOJAS.servicios);
  const turnos = leerHoja_(HOJAS.turnos).filter(t => t.fecha >= p.desde && t.fecha <= p.hasta && puedeVer_(u, t)).map(t => {
    const s = servs.find(x => String(x.id) === String(t.servicio_id)) || {};
    return Object.assign({}, t, { servicio: s.nombre });
  });
  return { ok: true, turnos: turnos, recursos: leerHoja_(HOJAS.recursos), servicios: servs, bloqueos: leerHoja_(HOJAS.bloqueos), config: config_() };
}
function crearTurno_(p, u) {
  if (u.rol === 'Profesional' && recursoDe_(u) !== String(p.recurso_id)) throw falla_('sin_permiso');
  const t = ocuparYGuardar_({ estado: 'Confirmado', fecha: p.fecha, hora: p.hora, recurso_id: p.recurso_id, servicio_id: p.servicio_id, cliente_id: limpiar_(p.cliente_id, 40), cliente_nombre: limpiar_(p.cliente_nombre, 80), contacto_nombre: limpiar_(p.nombre, 80), contacto_tel: String(p.tel || '').replace(/[^\d+]/g, '').slice(0, 20), contacto_email: limpiar_(p.email, 80), sujeto_nombre: limpiar_(p.sujeto_nombre, 60), sujeto_tipo: limpiar_(p.sujeto_tipo, 30), nota: limpiar_(p.nota, 300), origen: 'recepcion', consentimiento: p.consentimiento ? 'si' : '' }, { forzar: !!p.forzar && ROLES_AGENDA_TOTAL.indexOf(u.rol) > -1 });
  return { ok: true, id: t.id, codigo: t.codigo };
}
// Historial de un cliente (por ficha o, si no tiene, por teléfono). Solo lo que el usuario puede ver.
function historial_(p, u) {
  const cid = limpiar_(p.cliente_id, 40), tel = String(p.tel || '').replace(/[^\d]/g, '');
  if (!cid && tel.length < 6) throw falla_('falta_cliente');
  const servs = leerHoja_(HOJAS.servicios);
  const lista = leerHoja_(HOJAS.turnos).filter(t => puedeVer_(u, t) && ((cid && String(t.cliente_id) === cid) || (!cid && String(t.contacto_tel).replace(/[^\d]/g, '') === tel)))
    .sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)).slice(0, 60)
    .map(t => ({ id: t.id, fecha: t.fecha, hora: t.hora, estado: t.estado, servicio: (servs.find(x => String(x.id) === String(t.servicio_id)) || {}).nombre, sujeto: t.sujeto_nombre, recurso_id: t.recurso_id }));
  return { ok: true, turnos: lista };
}
// Vincula el turno con una ficha de DOMino Profesional; los otros turnos del mismo teléfono sin ficha quedan vinculados también.
function vincularCliente_(p, u) {
  const t = turnoPorId_(p.id); if (!t) throw falla_('turno_no_encontrado');
  if (!puedeVer_(u, t)) throw falla_('sin_permiso');
  const cid = limpiar_(p.cliente_id, 40), nom = limpiar_(p.cliente_nombre, 80); if (!cid) throw falla_('falta_cliente');
  const lock = LockService.getScriptLock(); if (!lock.tryLock(15000)) throw falla_('sistema_ocupado');
  try {
    const sh = obtenerHoja_(HOJAS.turnos), h = asegurarColumnas_(sh, COL_TURNOS), iId = h.indexOf('id'), iC = h.indexOf('cliente_id'), iN = h.indexOf('cliente_nombre'), iT = h.indexOf('contacto_tel');
    const d = sh.getDataRange().getValues(), tel = String(t.contacto_tel).replace(/[^\d]/g, ''); let n = 0;
    for (let i = 1; i < d.length; i++) {
      const propio = String(d[i][iId]) === String(t.id), mismoTel = tel.length >= 6 && String(d[i][iT]).replace(/[^\d]/g, '') === tel && !d[i][iC];
      if (propio || mismoTel) { sh.getRange(i + 1, iC + 1).setValue(cid); sh.getRange(i + 1, iN + 1).setValue(nom); n++; }
    }
    return { ok: true, vinculados: n };
  } finally { lock.releaseLock(); }
}
function turnoPorId_(id) { return leerHoja_(HOJAS.turnos).find(t => String(t.id) === String(id)); }
function cambiarEstado_(p, u) {
  const t = turnoPorId_(p.id); if (!t) throw falla_('turno_no_encontrado');
  if (!puedeVer_(u, t)) throw falla_('sin_permiso');
  if (ESTADOS.indexOf(p.estado) < 0 || p.estado === 'Reprogramado') throw falla_('estado_invalido');
  cambiarEstadoInterno_(t.id, p.estado, p.estado === 'Cancelado' ? limpiar_(p.motivo || 'Cancelado por el negocio', 200) : '');
  if (p.estado === 'Confirmado') avisoCorreo_(turnoPorId_(t.id), 'confirmado', config_());
  return { ok: true };
}
function reprogramar_(p, u) {
  const t = turnoPorId_(p.id); if (!t) throw falla_('turno_no_encontrado');
  if (!puedeVer_(u, t)) throw falla_('sin_permiso');
  if (ESTADOS_ACTIVOS.indexOf(t.estado) < 0) throw falla_('estado_invalido');
  // primero se reserva el nuevo horario; recién después se libera el viejo
  const nuevo = ocuparYGuardar_({ estado: 'Confirmado', fecha: p.fecha, hora: p.hora, recurso_id: p.recurso_id || t.recurso_id, servicio_id: t.servicio_id, cliente_id: t.cliente_id, contacto_nombre: t.contacto_nombre, contacto_tel: String(t.contacto_tel), contacto_email: t.contacto_email, sujeto_nombre: t.sujeto_nombre, sujeto_tipo: t.sujeto_tipo, nota: t.nota, reprogramado_de: t.id, origen: t.origen, consentimiento: t.consentimiento });
  cambiarEstadoInterno_(t.id, 'Cancelado', 'Reprogramado'); // TRANSICIONES no permite 'Reprogramado' directo desde activos
  marcarReprogramado_(t.id);
  return { ok: true, id: nuevo.id, codigo: nuevo.codigo };
}
function marcarReprogramado_(id) {
  const sh = obtenerHoja_(HOJAS.turnos), fila = buscarFila_(sh, id);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
  sh.getRange(fila, headers.indexOf('estado') + 1).setValue('Reprogramado');
}
function guardarBloqueo_(p, u) {
  if (ROLES_GESTION.indexOf(u.rol) < 0) throw falla_('sin_permiso');
  const lock = LockService.getScriptLock(); if (!lock.tryLock(15000)) throw falla_('sistema_ocupado');
  try { agregarFila_(HOJAS.bloqueos, ['id', 'recurso_id', 'desde', 'hasta', 'motivo'], { id: 'B' + Utilities.getUuid().slice(0, 8), recurso_id: p.recurso_id || '*', desde: p.desde, hasta: p.hasta, motivo: limpiar_(p.motivo, 100) }); }
  finally { lock.releaseLock(); }
  return { ok: true };
}

// ── Recordatorios ────────────────────────────────────────────────
function mananaTxt_() { return deMin_(ahoraMin_() + 1440).fecha; }
function recordatoriosManana_(p, u) {
  const m = mananaTxt_(), servs = leerHoja_(HOJAS.servicios), c = config_();
  const lista = leerHoja_(HOJAS.turnos).filter(t => t.fecha === m && ESTADOS_ACTIVOS.indexOf(t.estado) > -1 && puedeVer_(u, t)).sort((a, b) => String(a.hora).localeCompare(String(b.hora))).map(t => {
    const s = servs.find(x => String(x.id) === String(t.servicio_id)) || {};
    return { id: t.id, hora: t.hora, nombre: t.contacto_nombre, tel: String(t.contacto_tel), sujeto: t.sujeto_nombre, servicio: s.nombre, avisado: t.avisado,
      mensaje: 'Hola ' + t.contacto_nombre + ', le recordamos su turno de mañana a las ' + t.hora + ' en ' + c.nombre + (t.sujeto_nombre ? ' (' + t.sujeto_nombre + ')' : '') + '. Si no puede venir, avísenos. ¡Gracias!' };
  });
  return { ok: true, fecha: m, turnos: lista };
}
function marcarAvisado_(p, u) {
  const t = turnoPorId_(p.id); if (!t || !puedeVer_(u, t)) throw falla_('sin_permiso');
  const sh = obtenerHoja_(HOJAS.turnos), fila = buscarFila_(sh, t.id);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
  sh.getRange(fila, headers.indexOf('avisado') + 1).setValue(p.via === 'correo' ? 'correo' : 'whatsapp');
  return { ok: true };
}
// Disparador diario (configurarDisparador): correo automático a quien dio su correo y consintió
function enviarRecordatorios() {
  limpiarSlotsViejos_();
  const c = config_(), m = mananaTxt_();
  leerHoja_(HOJAS.turnos).filter(t => t.fecha === m && ESTADOS_ACTIVOS.indexOf(t.estado) > -1 && t.contacto_email && t.consentimiento === 'si' && !t.avisado).forEach(t => {
    if (MailApp.getRemainingDailyQuota() < 5) return;
    if (avisoCorreo_(t, 'recordatorio', c)) { const sh = obtenerHoja_(HOJAS.turnos), fila = buscarFila_(sh, t.id), h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x).trim().toLowerCase()); sh.getRange(fila, h.indexOf('avisado') + 1).setValue('correo'); }
  });
}
// Los tramos de días pasados ya no sirven para bloquear: se quitan para que la hoja «slots» no crezca.
function limpiarSlotsViejos_() {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return;
  try {
    const sh = obtenerHoja_(HOJAS.slots), d = sh.getDataRange().getValues(), hoy = deMin_(ahoraMin_()).fecha;
    for (let i = d.length - 1; i >= 1; i--) { const f = String(d[i][0]).split('|')[1]; if (f && f < hoy) sh.deleteRow(i + 1); }
  } finally { lock.releaseLock(); }
}
function configurarDisparador() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'enviarRecordatorios').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('enviarRecordatorios').timeBased().everyDays(1).atHour(18).create();
}
function avisoCorreo_(t, tipo, c) {
  if (!t || !t.contacto_email || t.consentimiento !== 'si') return false;
  const asunto = { recibido: 'Recibimos su solicitud de turno', confirmado: 'Turno confirmado', recordatorio: 'Recordatorio de turno de mañana' }[tipo];
  const cuerpo = 'Hola ' + t.contacto_nombre + ',\n\n' + ({ recibido: 'recibimos su solicitud para el ' + t.fecha + ' a las ' + t.hora + '. Le confirmaremos a la brevedad.', confirmado: 'su turno quedó confirmado para el ' + t.fecha + ' a las ' + t.hora + '.', recordatorio: 'le recordamos su turno de mañana (' + t.fecha + ') a las ' + t.hora + '.' }[tipo]) + '\n\n' + c.nombre + (c.telefono ? ' · ' + c.telefono : '');
  try { MailApp.sendEmail(t.contacto_email, asunto, cuerpo); return true; } catch (e) { console.warn('Correo no enviado: ' + e); return false; }
}

// ── Usuarios, claves y sesión (mismo esquema que el Hub de X5) ───
function iguales_(a, b) { a = String(a); b = String(b); let d = a.length ^ b.length; for (let i = 0; i < Math.min(a.length, b.length); i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function esHashClave_(v) { return /^h1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/.test(String(v)); }
function huellaClave_(sal, clave) {
  let h = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(clave), sal)).replace(/=+$/, '');
  for (let i = 0; i < HASH_VUELTAS; i++) h = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(h + String(clave), sal)).replace(/=+$/, '');
  return h;
}
function hashClave_(clave) { const sal = Utilities.getUuid().replace(/-/g, ''); return 'h1$' + sal + '$' + huellaClave_(sal, clave); }
function claveCorrecta_(guardada, ingresada) {
  if (esHashClave_(guardada)) { const x = String(guardada).split('$'); return iguales_(x[2], huellaClave_(x[1], ingresada)); }
  return iguales_(guardada, ingresada);
}
function protegerClaves() { // ejecutar una vez, o se protegen solas en el primer ingreso
  const sh = obtenerHoja_(HOJAS.usuarios), d = sh.getDataRange().getValues(), h = d[0].map(x => String(x).trim().toLowerCase()), iC = h.indexOf('clave');
  for (let i = 1; i < d.length; i++) if (d[i][iC] !== '' && !esHashClave_(d[i][iC])) sh.getRange(i + 1, iC + 1).setValue(hashClave_(d[i][iC]));
}
function guardarClave_(email, valor) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = obtenerHoja_(HOJAS.usuarios), d = sh.getDataRange().getValues(), h = d[0].map(x => String(x).trim().toLowerCase()), iE = h.indexOf('email'), iC = h.indexOf('clave');
    for (let i = 1; i < d.length; i++) if (String(d[i][iE]).toLowerCase() === String(email).toLowerCase()) { sh.getRange(i + 1, iC + 1).setValue(valor); return; }
  } finally { lock.releaseLock(); }
}
function usuarioLimpio_(u) { return { nombre: u.nombre, email: u.email, rol: u.rol, recurso_id: recursoDe_(u) }; }
function login_(email, clave) {
  email = String(email || '').trim().toLowerCase();
  const cache = CacheService.getScriptCache(), k = 'intentos_' + Utilities.base64EncodeWebSafe(email).slice(0, 80);
  const n = Number(cache.get(k) || 0);
  if (n >= MAX_INTENTOS_LOGIN) return { ok: false, error: 'demasiados_intentos' };
  const u = leerHoja_(HOJAS.usuarios).find(x => String(x.email).toLowerCase() === email);
  if (!u || String(u.estado) !== 'Activo' || ROLES.indexOf(u.rol) < 0) { cache.put(k, String(n + 1), MIN_BLOQUEO_LOGIN * 60); return { ok: false, error: 'usuario_invalido' }; }
  if (!claveCorrecta_(u.clave, clave)) { cache.put(k, String(n + 1), MIN_BLOQUEO_LOGIN * 60); return { ok: false, error: 'clave_incorrecta' }; }
  cache.remove(k);
  if (!esHashClave_(u.clave)) { try { guardarClave_(u.email, hashClave_(clave)); } catch (e) {} }
  return { ok: true, token: firmarToken_(email, Date.now() + DIAS_TOKEN * 86400000), usuario: usuarioLimpio_(u) };
}
function firmarToken_(email, exp) { const pl = Utilities.base64EncodeWebSafe(Utilities.newBlob(email + '|' + exp).getBytes()); return pl + '.' + firma_(pl); }
function validarToken_(token) {
  const x = String(token || '').split('.');
  if (x.length !== 2 || !iguales_(firma_(x[0]), x[1])) return null;
  const t = Utilities.newBlob(Utilities.base64DecodeWebSafe(x[0])).getDataAsString(), corte = t.lastIndexOf('|');
  const email = t.slice(0, corte), exp = Number(t.slice(corte + 1));
  if (!exp || Date.now() > exp) return null;
  const u = leerHoja_(HOJAS.usuarios).find(y => String(y.email).toLowerCase() === email);
  return u && String(u.estado) === 'Activo' ? u : null; // baja = sesión cortada
}
function firma_(texto) {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty('TOKEN_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('TOKEN_SECRET', s); }
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(texto, s)).replace(/=+$/, '');
}

// ── Utilidades de hoja ───────────────────────────────────────────
function obtenerHoja_(n) { const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n); if (!s) throw new Error('No existe la hoja ' + n); return s; }
// Hojas que casi no cambian: caché de 60 s (y memo dentro del pedido). turnos y slots se leen siempre frescos.
const HOJAS_CACHE = ['config', 'recursos', 'servicios', 'horarios', 'bloqueos'];
var MEMO_ = {};
function leerHoja_(n) {
  if (HOJAS_CACHE.indexOf(n) < 0) return leerHojaDirecto_(n);
  if (MEMO_[n]) return MEMO_[n];
  const cache = CacheService.getScriptCache(), k = 'h_' + n, g = cache.get(k);
  if (g) { try { return MEMO_[n] = JSON.parse(g); } catch (e) {} }
  const datos = leerHojaDirecto_(n);
  try { const t = JSON.stringify(datos); if (t.length < 90000) cache.put(k, t, 60); } catch (e) {}
  return MEMO_[n] = datos;
}
function invalidarHoja_(n) { delete MEMO_[n]; try { CacheService.getScriptCache().remove('h_' + n); } catch (e) {} }
function limpiarCache() { HOJAS_CACHE.forEach(invalidarHoja_); } // ejecutar a mano si se editó la planilla y no se quiere esperar 60 s
function leerHojaDirecto_(n) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n); if (!sh) return [];
  const d = sh.getDataRange().getValues(); if (d.length <= 1) return [];
  const tz = Session.getScriptTimeZone(), h = d.shift().map(x => String(x).trim().toLowerCase());
  return d.filter(r => r.some(c => c !== '' && c !== null)).map(r => { const o = {}; h.forEach((k, i) => { if (k) o[k] = normalizar_(r[i], tz, k); }); return o; });
}
function normalizar_(v, tz, campo) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (v.getFullYear() < 1901) return Utilities.formatDate(v, tz, 'HH:mm');
    return campo === 'creado' || campo === 'actualizado' ? v.toISOString() : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  }
  return v;
}
function asegurarColumnas_(sh, esperadas) {
  let h = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x).trim().toLowerCase()) : [];
  const falta = esperadas.filter(c => h.indexOf(c) < 0);
  if (falta.length) { sh.getRange(1, h.length + 1, 1, falta.length).setValues([falta]); h = h.concat(falta); }
  return h;
}
function buscarFila_(sh, id) { const n = sh.getLastRow() - 1; if (n < 1) return -1; const v = sh.getRange(2, 1, n, 1).getValues(); for (let i = 0; i < v.length; i++) if (String(v[i][0]) === String(id)) return i + 2; return -1; }
function valorCelda_(campo, v) {
  if (v === undefined || v === null) return '';
  let s = String(v);
  if (/^[=+\-@]/.test(s) && campo !== 'desde' && campo !== 'hasta') s = "'" + s; // anti fórmulas
  if (CAMPOS_TEXTO.indexOf(campo) > -1 && s !== '' && s[0] !== "'") s = "'" + s;
  return s;
}
function agregarFila_(hoja, columnas, obj) {
  const sh = obtenerHoja_(hoja), h = asegurarColumnas_(sh, columnas);
  sh.appendRow(h.map(k => valorCelda_(k, obj[k])));
  invalidarHoja_(hoja);
}
// ── Actividades del negocio (Bienestar) ─────────────────────────
// El catálogo sale de turnos/catalogo-actividades.json (única fuente). NO editar a mano entre las marcas:
// correr «node alta/sincronizar-catalogo.js» en la copia del código.
// <CATALOGO>
const CATALOGO_ = {"version":1,"actividades":[{"id":"gimnasio","nombre":"Gimnasio y musculación","texto":"Sala de musculación, planes mensuales y evaluaciones.","persona":"socio","recurso":{"nombre":"Evaluación física","tipo":"profesional"},"servicios":[{"nombre":"Evaluación física inicial","duracion_min":60},{"nombre":"Plan de entrenamiento personalizado","duracion_min":60},{"nombre":"Entrenamiento personal","duracion_min":60}],"horarios":[{"dias":[1,2,3,4,5],"desde":"09:00","hasta":"13:00"},{"dias":[1,2,3,4,5],"desde":"16:00","hasta":"20:00"}]},{"id":"clases","nombre":"Clases grupales","texto":"Funcional, spinning, zumba y otras clases con cupos.","persona":"alumno","clases":[{"nombre":"Funcional","cupo":15,"duracion_min":60,"sala":"Sala funcional","horarios":[{"dias":[1,3,5],"desde":"08:00","hasta":"09:00"},{"dias":[1,3,5],"desde":"19:00","hasta":"20:00"}]},{"nombre":"Spinning","cupo":20,"duracion_min":60,"sala":"Sala de spinning","horarios":[{"dias":[2,4],"desde":"08:00","hasta":"09:00"},{"dias":[1,2,3,4,5],"desde":"20:00","hasta":"21:00"}]},{"nombre":"Zumba","cupo":25,"duracion_min":60,"sala":"Salón de baile","horarios":[{"dias":[2,4],"desde":"19:00","hasta":"20:00"}]}]},{"id":"yoga","nombre":"Yoga y pilates","texto":"Clases de yoga, pilates y estiramiento con cupos reducidos.","persona":"alumno","clases":[{"nombre":"Yoga","cupo":12,"duracion_min":60,"sala":"Sala de yoga","horarios":[{"dias":[1,3],"desde":"09:00","hasta":"10:00"},{"dias":[2,4],"desde":"19:00","hasta":"20:00"}]},{"nombre":"Pilates","cupo":8,"duracion_min":60,"sala":"Sala de pilates","horarios":[{"dias":[1,3,5],"desde":"10:00","hasta":"11:00"},{"dias":[2,4],"desde":"18:00","hasta":"19:00"}]}]},{"id":"spa","nombre":"Spa y masajes","texto":"Masajes, circuitos de spa y tratamientos corporales.","persona":"cliente","recurso":{"nombre":"Masajista","tipo":"profesional"},"servicios":[{"nombre":"Masaje descontracturante","duracion_min":60},{"nombre":"Masaje relajante","duracion_min":60},{"nombre":"Drenaje linfático","duracion_min":60},{"nombre":"Masaje con piedras calientes","duracion_min":90}],"horarios":[{"dias":[1,2,3,4,5],"desde":"10:00","hasta":"13:00"},{"dias":[1,2,3,4,5],"desde":"15:00","hasta":"20:00"}]},{"id":"peluqueria","nombre":"Peluquería","texto":"Cortes, color, brushing y peinados.","persona":"cliente","recurso":{"nombre":"Peluquero/a","tipo":"profesional"},"servicios":[{"nombre":"Corte","duracion_min":30},{"nombre":"Corte y brushing","duracion_min":60},{"nombre":"Color","duracion_min":120},{"nombre":"Mechas o balayage","duracion_min":180},{"nombre":"Peinado para evento","duracion_min":60}],"horarios":[{"dias":[2,3,4,5,6],"desde":"09:00","hasta":"13:00"},{"dias":[2,3,4,5,6],"desde":"15:00","hasta":"20:00"}]},{"id":"barberia","nombre":"Barbería","texto":"Cortes y arreglo de barba.","persona":"cliente","recurso":{"nombre":"Barbero","tipo":"profesional"},"servicios":[{"nombre":"Corte de pelo","duracion_min":30},{"nombre":"Corte y barba","duracion_min":60},{"nombre":"Arreglo de barba","duracion_min":30}],"horarios":[{"dias":[2,3,4,5,6],"desde":"10:00","hasta":"13:00"},{"dias":[2,3,4,5,6],"desde":"15:00","hasta":"20:00"}]},{"id":"unas","nombre":"Uñas","texto":"Manicuría, esmaltado semipermanente y esculpidas.","persona":"cliente","recurso":{"nombre":"Manicura","tipo":"profesional"},"servicios":[{"nombre":"Manicuría","duracion_min":60},{"nombre":"Esmaltado semipermanente","duracion_min":60},{"nombre":"Uñas esculpidas","duracion_min":120},{"nombre":"Pedicuría","duracion_min":60}],"horarios":[{"dias":[2,3,4,5,6],"desde":"09:00","hasta":"13:00"},{"dias":[2,3,4,5,6],"desde":"15:00","hasta":"19:00"}]},{"id":"estetica","nombre":"Estética y depilación","texto":"Limpiezas faciales, depilación, pestañas y cejas.","persona":"cliente","recurso":{"nombre":"Esteticista","tipo":"profesional"},"servicios":[{"nombre":"Limpieza facial","duracion_min":60},{"nombre":"Depilación definitiva","duracion_min":30},{"nombre":"Perfilado de cejas","duracion_min":30},{"nombre":"Lifting de pestañas","duracion_min":60}],"horarios":[{"dias":[1,2,3,4,5],"desde":"10:00","hasta":"13:00"},{"dias":[1,2,3,4,5],"desde":"15:00","hasta":"19:00"}]},{"id":"consultorio","nombre":"Nutrición y kinesiología","texto":"Consultas individuales de nutrición, kinesiología o entrenamiento terapéutico.","persona":"paciente","recurso":{"nombre":"Profesional de salud","tipo":"profesional"},"servicios":[{"nombre":"Consulta nutricional","duracion_min":60},{"nombre":"Sesión de kinesiología","duracion_min":60},{"nombre":"Control de seguimiento","duracion_min":30}],"horarios":[{"dias":[1,2,3,4,5],"desde":"09:00","hasta":"13:00"},{"dias":[1,3,5],"desde":"16:00","hasta":"19:00"}]}]};
// </CATALOGO>
const COL_RECURSOS = ['id', 'nombre', 'tipo', 'color', 'usuario_email', 'activo'];
const COL_SERVICIOS = ['id', 'nombre', 'duracion_min', 'recursos', 'publico', 'activo', 'cupo', 'actividad', 'profesor'];
const COL_HORARIOS = ['recurso_id', 'dia_semana', 'desde', 'hasta'];
const COLORES_ = ['#D4AF37', '#4CC38A', '#22D3EE', '#9E7535', '#E8C766', '#A9B98D'];
// Ejecutar a mano UNA vez (Ejecutar > cargarActividades) después de poner en la hoja «config» la fila  actividades = gimnasio,clases,spa
// (los códigos salen del catálogo). Agrega recursos, servicios y horarios típicos de cada actividad. No pisa nada: si ya existe, lo deja.
// Después se ajustan precios, horarios y profesionales directamente en la planilla.
function cargarActividades() {
  const pedidas = lista_(config_().actividades), faltan = pedidas.filter(a => !(CATALOGO_.actividades || []).some(x => x.id === a));
  if (!pedidas.length) throw new Error('Falta la fila «actividades» en la hoja config (ej. gimnasio,clases,spa).');
  if (faltan.length) throw new Error('Actividades que no están en el catálogo: ' + faltan.join(', '));
  const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) throw new Error('Intente de nuevo en un momento.');
  let nuevos = { recursos: 0, servicios: 0, horarios: 0 };
  try {
    const rec = new Set(leerHojaDirecto_(HOJAS.recursos).map(r => String(r.id))), srv = new Set(leerHojaDirecto_(HOJAS.servicios).map(r => String(r.id)));
    let color = rec.size;
    const nuevoRecurso = (id, nombre, tipo) => { if (rec.has(id)) return; agregarFila_(HOJAS.recursos, COL_RECURSOS, { id: id, nombre: nombre, tipo: tipo, color: COLORES_[color++ % COLORES_.length], usuario_email: '', activo: 'si' }); rec.add(id); nuevos.recursos++; };
    const nuevoServicio = (o) => { if (srv.has(o.id)) return; agregarFila_(HOJAS.servicios, COL_SERVICIOS, Object.assign({ publico: 'si', activo: 'si' }, o)); srv.add(o.id); nuevos.servicios++; };
    const horarios = (rid, hs) => hs.forEach(h => h.dias.forEach(d => { agregarFila_(HOJAS.horarios, COL_HORARIOS, { recurso_id: rid, dia_semana: d, desde: h.desde, hasta: h.hasta }); nuevos.horarios++; }));
    pedidas.forEach(id => {
      const a = CATALOGO_.actividades.find(x => x.id === id);
      (a.clases || []).forEach((cl, i) => {
        const rid = 'R_' + id + '_' + (i + 1), sid = 'S_' + id + '_' + (i + 1), nuevo = !rec.has(rid);
        nuevoRecurso(rid, cl.sala, 'sala');
        nuevoServicio({ id: sid, nombre: cl.nombre, duracion_min: cl.duracion_min, recursos: rid, cupo: cl.cupo, actividad: id });
        if (nuevo) horarios(rid, cl.horarios);
      });
      if (a.recurso) {
        const rid = 'R_' + id, nuevo = !rec.has(rid);
        nuevoRecurso(rid, a.recurso.nombre, a.recurso.tipo);
        a.servicios.forEach((s, i) => nuevoServicio({ id: 'S_' + id + '_' + (i + 1), nombre: s.nombre, duracion_min: s.duracion_min, recursos: rid, cupo: '', actividad: id }));
        if (nuevo) horarios(rid, a.horarios);
      }
    });
  } finally { lock.releaseLock(); HOJAS_CACHE.forEach(invalidarHoja_); }
  Logger.log('Listo. Nuevos: ' + JSON.stringify(nuevos));
  return nuevos;
}

// ── Clases del centro (Hub → Administrar clases) ─────────────────
// La Dirección suma, edita o quita clases con cupo: nombre, profesor, cupo, duración, días y hora de inicio.
// Cada clase tiene su propia sala (recurso) para que los cupos de dos clases no se mezclen.
function clasesConfig_(p, u) {
  if (ROLES_GESTION.indexOf(u.rol) < 0) throw falla_('sin_permiso');
  const recs = {}; leerHoja_(HOJAS.recursos).forEach(r => { recs[String(r.id)] = r; });
  const hs = leerHoja_(HOJAS.horarios);
  const clases = activos_(HOJAS.servicios).filter(sv => cupoDe_(sv) > 1).map(sv => {
    const rid = lista_(sv.recursos)[0] || '';
    return { servicio_id: String(sv.id), nombre: sv.nombre, actividad: sv.actividad || '', profesor: sv.profesor || '', cupo: cupoDe_(sv), duracion_min: Number(sv.duracion_min), publico: String(sv.publico).toLowerCase() !== 'no', recurso_id: rid, sala: (recs[rid] || {}).nombre || '',
      horarios: hs.filter(h => String(h.recurso_id) === rid).map(h => ({ dia: Number(h.dia_semana), desde: String(h.desde) })).sort((a, b) => a.dia - b.dia || a.desde.localeCompare(b.desde)) };
  });
  return { ok: true, clases: clases };
}
function datosClase_(p, c) {
  const nombre = limpiar_(p.nombre, 60); if (nombre.length < 2) throw falla_('falta_nombre_clase');
  const cupo = Math.floor(Number(p.cupo)); if (!(cupo >= 2 && cupo <= 500)) throw falla_('cupo_invalido');
  const dur = Math.floor(Number(p.duracion_min)); if (!(dur >= c.paso_min && dur <= 480 && dur % c.paso_min === 0)) throw falla_('duracion_invalida');
  const hs = []; (Array.isArray(p.horarios) ? p.horarios : []).slice(0, 40).forEach(h => {
    const dias = Array.isArray(h.dias) ? h.dias.map(Number) : [];
    if (!validaHora_(h.desde) || !dias.length || dias.some(d => !(d >= 0 && d <= 6) || d % 1)) throw falla_('horario_invalido');
    const fin = aMin_('2026-01-05', h.desde) + dur; if (fin > aMin_('2026-01-05', '23:59')) throw falla_('horario_invalido');
    dias.forEach(d => hs.push({ dia: d, desde: h.desde, hasta: deMin_(fin).hora }));
  });
  if (!hs.length) throw falla_('faltan_horarios');
  return { nombre: nombre, cupo: cupo, dur: dur, hs: hs, profesor: limpiar_(p.profesor, 60), sala: limpiar_(p.sala, 60), publico: p.publico === false ? 'no' : 'si', actividad: /^[a-z0-9_]{2,30}$/.test(String(p.actividad || '')) ? String(p.actividad) : 'propia' };
}
// Dos clases no pueden coincidir en día y horario en la misma sala. Si coincide con otra clase y no se indicó sala, se pide la sala.
function choqueSala_(d, propioSid) {
  const recs = {}; leerHojaDirecto_(HOJAS.recursos).forEach(r => { recs[String(r.id)] = r; });
  const hs = leerHojaDirecto_(HOJAS.horarios), norm = v => String(v || '').trim().toLowerCase();
  let propioRid = '';
  const otras = leerHojaDirecto_(HOJAS.servicios).filter(sv => String(sv.activo).toLowerCase() !== 'no' && cupoDe_(sv) > 1).filter(sv => { if (String(sv.id) === propioSid) { propioRid = lista_(sv.recursos)[0] || ''; return false; } return true; });
  const salaNueva = d.sala || (propioRid && recs[propioRid] ? recs[propioRid].nombre : '');
  for (const sv of otras) {
    const rid = lista_(sv.recursos)[0] || '', sala = (recs[rid] || {}).nombre || '';
    for (const h of hs.filter(x => String(x.recurso_id) === rid)) {
      const ini = aMin_('2026-01-05', h.desde), fin = ini + Number(sv.duracion_min);
      for (const n of d.hs) {
        if (Number(h.dia_semana) !== n.dia) continue;
        const a = aMin_('2026-01-05', n.desde), b = aMin_('2026-01-05', n.hasta);
        if (a < fin && b > ini) {
          const info = { clase: sv.nombre, sala: sala, dia: n.dia, hora: String(h.desde) };
          if (!salaNueva) return Object.assign({ error: 'falta_sala' }, info);
          if (norm(salaNueva) === norm(sala)) return Object.assign({ error: 'sala_ocupada' }, info);
        }
      }
    }
  }
  return null;
}
function guardarClase_(p, u) {
  if (ROLES_GESTION.indexOf(u.rol) < 0) throw falla_('sin_permiso');
  const c = config_(), d = datosClase_(p, c);
  const lock = LockService.getScriptLock(); if (!lock.tryLock(15000)) throw falla_('sistema_ocupado');
  try {
    const choque = choqueSala_(d, String(p.servicio_id || ''));
    if (choque) return Object.assign({ ok: false }, choque);
    const shS = obtenerHoja_(HOJAS.servicios), hS = asegurarColumnas_(shS, COL_SERVICIOS);
    const shR = obtenerHoja_(HOJAS.recursos), hR = asegurarColumnas_(shR, COL_RECURSOS);
    let sid = String(p.servicio_id || ''), rid;
    if (sid) { // editar
      const fila = buscarFila_(shS, sid); if (fila < 0) throw falla_('servicio_invalido');
      const actual = shS.getRange(fila, 1, 1, hS.length).getValues()[0];
      rid = lista_(actual[hS.indexOf('recursos')])[0]; if (!rid) throw falla_('servicio_invalido');
      const set = (k, v) => shS.getRange(fila, hS.indexOf(k) + 1).setValue(valorCelda_(k, v));
      set('nombre', d.nombre); set('profesor', d.profesor); set('cupo', d.cupo); set('duracion_min', d.dur); set('publico', d.publico); set('activo', 'si');
      if (d.sala) { const fr = buscarFila_(shR, rid); if (fr > 0) shR.getRange(fr, hR.indexOf('nombre') + 1).setValue(valorCelda_('nombre', d.sala)); }
      const shH = obtenerHoja_(HOJAS.horarios), dh = shH.getDataRange().getValues(), iR = dh[0].map(x => String(x).trim().toLowerCase()).indexOf('recurso_id');
      for (let i = dh.length - 1; i >= 1; i--) if (String(dh[i][iR]) === rid) shH.deleteRow(i + 1);
    } else { // nueva
      const rec = new Set(leerHojaDirecto_(HOJAS.recursos).map(r => String(r.id))), srv = new Set(leerHojaDirecto_(HOJAS.servicios).map(r => String(r.id)));
      const slug = d.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'clase';
      let n = 1, suf = 'P_' + slug; while (rec.has('R_' + suf) || srv.has('S_' + suf)) suf = 'P_' + slug + '_' + (++n);
      rid = 'R_' + suf; sid = 'S_' + suf;
      agregarFila_(HOJAS.recursos, COL_RECURSOS, { id: rid, nombre: d.sala || 'Sala de ' + d.nombre, tipo: 'sala', color: COLORES_[rec.size % COLORES_.length], usuario_email: '', activo: 'si' });
      agregarFila_(HOJAS.servicios, COL_SERVICIOS, { id: sid, nombre: d.nombre, duracion_min: d.dur, recursos: rid, publico: d.publico, activo: 'si', cupo: d.cupo, actividad: d.actividad, profesor: d.profesor });
    }
    d.hs.forEach(h => agregarFila_(HOJAS.horarios, COL_HORARIOS, { recurso_id: rid, dia_semana: h.dia, desde: h.desde, hasta: h.hasta }));
    return { ok: true, servicio_id: sid, recurso_id: rid };
  } finally { lock.releaseLock(); HOJAS_CACHE.forEach(invalidarHoja_); }
}
// Quitar una clase: queda inactiva (no borra turnos ni historial) y se puede volver a activar en la planilla.
function quitarClase_(p, u) {
  if (ROLES_GESTION.indexOf(u.rol) < 0) throw falla_('sin_permiso');
  const sid = String(p.servicio_id || ''); if (!/^S_[A-Za-z0-9_]+$/.test(sid)) throw falla_('servicio_invalido');
  const lock = LockService.getScriptLock(); if (!lock.tryLock(15000)) throw falla_('sistema_ocupado');
  try {
    const sh = obtenerHoja_(HOJAS.servicios), h = asegurarColumnas_(sh, COL_SERVICIOS), fila = buscarFila_(sh, sid);
    if (fila < 0) throw falla_('servicio_invalido');
    if (!(Number(sh.getRange(fila, h.indexOf('cupo') + 1).getValues()[0][0]) > 1)) throw falla_('servicio_invalido');
    sh.getRange(fila, h.indexOf('activo') + 1).setValue('no');
    return { ok: true };
  } finally { lock.releaseLock(); invalidarHoja_(HOJAS.servicios); }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
