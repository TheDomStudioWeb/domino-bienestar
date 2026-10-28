// DOMino Bienestar · Datos del negocio y actividades.
// La primera vez que entra la Dirección, carga el nombre del negocio y elige qué actividades realiza (gimnasio, clases, spa, peluquería…).
// Se guarda en Firestore: config/negocio. El catálogo de actividades sale de turnos/catalogo-actividades.json (ver actividades-datos.js).
// Para sumar una actividad nueva: agregarla al catálogo y correr  node alta/sincronizar-catalogo.js  (no se toca nada más).
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { llamar } from "./turnos/api.js";

const D = () => window.DOMINO, $ = (id) => document.getElementById(id);
const CAT = () => (window.DOMINO_CATALOGO && window.DOMINO_CATALOGO.actividades) || [];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const activo = () => window.DOMINO_RUBRO === 'bienestar';
let negocio = null, cargado = false;

async function leerNegocio() {
  try { const s = await getDoc(doc(D().db, 'config', 'negocio')); negocio = s.exists() ? s.data() : null; cargado = true; }
  catch (e) { console.warn('Bienestar: no se pudo leer config/negocio', e); negocio = null; cargado = false; }
  window.DOMINO_NEGOCIO = negocio;
}
const nombreActividad = (id) => (CAT().find((a) => a.id === id) || { nombre: id }).nombre;
const nombreInicial = () => { const n = (window.DOMINO_CLIENTE && window.DOMINO_CLIENTE.nombre) || ''; return /\(demo\)/i.test(n) ? '' : n; };
const lineaPlanilla = (ids) => 'actividades = ' + ids.join(',');

function estilos() {
  if ($('bn-css')) return;
  const s = document.createElement('style'); s.id = 'bn-css';
  s.textContent = `
  .bn-fondo{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.78);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:max(16px,env(safe-area-inset-top)) 16px 24px}
  .bn-x{position:sticky;top:0;float:right;margin:-8px -6px 0 8px;width:44px;height:44px;border-radius:50%;border:1px solid var(--line,#2a2d33);background:var(--bg-base,#0a0a0a);color:var(--text-main,#f4f1ea);font-size:1.1rem;cursor:pointer;z-index:2}
  .bn-caja{background:var(--bg-panel,#16181c);border:1px solid var(--hairline,#d4af3740);border-radius:12px;width:100%;max-width:560px;margin:auto;padding:22px 20px;color:var(--text-main,#f4f1ea)}
  .bn-caja h2{font-family:Cinzel,serif;font-size:1.35rem;margin:0 0 6px;color:var(--gold-light,#e8c766)}
  .bn-caja p{margin:0 0 12px;color:var(--text-muted,#a8a396);line-height:1.5}
  .bn-caja label.bn-l{display:block;margin:14px 0 6px;font-weight:600}
  .bn-caja input[type=text],.bn-caja input[type=tel]{width:100%;padding:12px;border-radius:8px;border:1px solid var(--line,#2a2d33);background:var(--bg-base,#0a0a0a);color:inherit;font-size:1rem}
  .bn-acts{display:grid;gap:8px;margin-top:6px}
  .bn-act{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--line,#2a2d33);border-radius:10px;cursor:pointer;background:var(--bg-base,#0a0a0a)}
  .bn-act:has(input:checked){border-color:var(--gold,#d4af37);background:#d4af3714}
  .bn-act input{width:22px;height:22px;margin-top:2px;accent-color:#d4af37;flex:none}
  .bn-act b{display:block}.bn-act small{color:var(--text-muted,#a8a396);display:block;margin-top:2px}
  .bn-fila{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
  .bn-btn{padding:12px 18px;border-radius:8px;border:1px solid var(--gold,#d4af37);background:var(--gold,#d4af37);color:#0a0a0a;font-weight:700;font-size:1rem;cursor:pointer}
  .bn-btn.sec{background:transparent;color:var(--gold-light,#e8c766)}
  .bn-err{color:#ff9b93;margin-top:10px;min-height:1.2em}
  .bn-code{display:block;padding:12px;border-radius:8px;background:var(--bg-base,#0a0a0a);border:1px dashed var(--gold,#d4af37);font-family:ui-monospace,monospace;word-break:break-all;margin:8px 0}
  #hub-negocio{margin:0 0 18px;padding:14px 16px;border:1px solid var(--hairline,#d4af3740);border-radius:12px;background:var(--bg-panel,#16181c)}
  #hub-negocio h2{margin:0 0 8px;font-size:1.05rem}
  .bn-chips{display:flex;flex-wrap:wrap;gap:6px}.bn-chip{padding:5px 11px;border-radius:99px;border:1px solid var(--gold,#d4af37);font-size:.85rem;color:var(--gold-light,#e8c766)}
  #hub-negocio .bn-fila{margin-top:12px}
  #hub-negocio details{margin-top:10px;color:var(--text-muted,#a8a396)}#hub-negocio summary{cursor:pointer;color:var(--gold-light,#e8c766)}`;
  document.head.appendChild(s);
}
function cerrar() { const f = $('bn-fondo'); if (f) f.remove(); document.body.style.overflow = ''; }

function asistente() {
  estilos(); cerrar();
  const sel = new Set((negocio && negocio.actividades) || []), primera = !negocio;
  const f = document.createElement('div'); f.id = 'bn-fondo'; f.className = 'bn-fondo'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-labelledby', 'bn-t');
  f.innerHTML = `<form class="bn-caja" id="bn-form" novalidate>
    <button type="button" class="bn-x" id="bn-x" aria-label="Cerrar">✕</button>
    <h2 id="bn-t">${primera ? 'Bienvenido a DOMino Bienestar' : 'Actividades del centro'}</h2>
    <p>${primera ? 'Antes de empezar, cuéntenos sobre su centro. Son dos pasos y lo puede cambiar cuando quiera.' : 'Sume o quite actividades. Los datos que ya cargó no se borran. Si suma una actividad nueva, The DOM Studio Web la deja lista en la agenda de turnos y en la página de reservas.'}</p>
    <label class="bn-l" for="bn-nombre">Nombre del centro</label>
    <input type="text" id="bn-nombre" maxlength="60" autocomplete="organization" placeholder="Ej. Vita Aura" value="${esc((negocio && negocio.nombre) || nombreInicial())}">
    <label class="bn-l" for="bn-tel">Teléfono o WhatsApp (se muestra en la página de reservas)</label>
    <input type="tel" id="bn-tel" maxlength="30" autocomplete="tel" placeholder="Ej. 261 555 0000" value="${esc((negocio && negocio.telefono) || '')}">
    <label class="bn-l">¿Qué actividades realizan? Elija todas las que correspondan.</label>
    <div class="bn-acts">${CAT().map((a) => `<label class="bn-act"><input type="checkbox" value="${esc(a.id)}"${sel.has(a.id) ? ' checked' : ''}><span><b>${esc(a.nombre)}</b><small>${esc(a.texto)}</small></span></label>`).join('')}</div>
    <div class="bn-err" id="bn-err" role="alert"></div>
    <div class="bn-fila"><button type="submit" class="bn-btn" id="bn-ok">${primera ? 'Guardar y empezar' : 'Guardar cambios'}</button><button type="button" class="bn-btn sec" id="bn-no">${primera ? 'Más tarde' : 'Cancelar'}</button></div></form>`;
  document.body.appendChild(f); document.body.style.overflow = 'hidden';
  $('bn-nombre').focus();
  $('bn-no').onclick = cerrar; $('bn-x').onclick = cerrar;
  f.addEventListener('click', (e) => { if (e.target === f) cerrar(); });
  $('bn-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const nom = $('bn-nombre').value.trim(), tel = $('bn-tel').value.trim(), acts = [...f.querySelectorAll('.bn-act input:checked')].map((i) => i.value);
    const err = (m) => { $('bn-err').textContent = m; };
    if (nom.length < 3) return err('Escriba el nombre del centro.');
    if (!acts.length) return err('Elija al menos una actividad.');
    $('bn-ok').disabled = true; $('bn-ok').textContent = 'Guardando…';
    try {
      const datos = { nombre: nom, telefono: tel, actividades: acts, version_catalogo: (window.DOMINO_CATALOGO || {}).version || 1, actualizado: serverTimestamp() };
      if (!negocio) datos.creado = serverTimestamp();
      await setDoc(doc(D().db, 'config', 'negocio'), datos, { merge: true });
      negocio = Object.assign({}, negocio, datos); window.DOMINO_NEGOCIO = negocio;
      cerrar(); pintarPanel(true);
    } catch (e) { console.error(e); $('bn-ok').disabled = false; $('bn-ok').textContent = 'Guardar'; err('No se pudo guardar. Revise su conexión e intente de nuevo.'); }
  };
  f.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
}

function pintarPanel(abrirPasos) {
  const hub = $('vista-hub'), dest = $('hub-grupos'); if (!hub || !dest || !activo()) return;
  estilos();
  let p = $('hub-negocio'); if (!p) { p = document.createElement('section'); p.id = 'hub-negocio'; p.setAttribute('aria-label', 'Su centro'); dest.parentNode.insertBefore(p, dest); }
  const senior = D() && D().rol === 'senior';
  if (!cargado) { p.hidden = true; return; }
  p.hidden = false;
  if (!negocio) {
    p.innerHTML = `<h2>Falta cargar los datos del centro</h2><p style="margin:0;color:var(--text-muted)">${senior ? 'Cargue el nombre y las actividades para dejar todo listo.' : 'La Dirección todavía no cargó las actividades del centro.'}</p>${senior ? '<div class="bn-fila"><button type="button" class="bn-btn" id="bn-abrir">Cargar ahora</button></div>' : ''}`;
  } else {
    const acts = negocio.actividades || [];
    p.innerHTML = `<h2>${esc(negocio.nombre)}</h2><div class="bn-chips">${acts.map((a) => `<span class="bn-chip">${esc(nombreActividad(a))}</span>`).join('')}</div>
    ${senior ? `<div class="bn-fila"><button type="button" class="bn-btn sec" id="bn-abrir">Cambiar actividades</button></div>` : ''}`;
  }
  const a = $('bn-abrir'); if (a) a.onclick = asistente;
}

async function iniciar() {
  if (!activo() || !D() || !D().listo) return;
  if (!cargado) await leerNegocio();
  pintarPanel(false);
  if (cargado && !negocio && D().rol === 'senior' && !window.__bnOfrecido) { window.__bnOfrecido = true; asistente(); }
  const t = (negocio && negocio.nombre) ? negocio.nombre : null;
  if (t && window.DOMINO_CLIENTE) { document.querySelectorAll('.brand-name b').forEach((el) => { el.textContent = t; }); }
}
window.addEventListener('domino:listo', iniciar);
window.addEventListener('domino:vista', (e) => { if (e.detail === 'hub') pintarPanel(false); });
if (D() && D().listo) iniciar();

// ── Inicio del Hub para Bienestar ───────────────────────────────
// Tarjetas: cuotas y aptos médicos por vencer, avisos (seguimientos vencidos o de hoy) y clases de hoy.
// Para hoy: clases de hoy y los próximos días con los lugares que quedan (servicio de turnos), y debajo los seguimientos.
const AVISO_CUOTA_DIAS = 7, AVISO_APTO_DIAS = 15;
const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const diasHasta = (s) => Math.round((new Date(s + 'T12:00:00') - new Date(hoyStr() + 'T12:00:00')) / 86400000);
const dmy = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : '';
const fechaLarga = (s) => { const t = new Date(s + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1); };
let socios = null, clases = null, clasesErr = '';

function estilosHub() {
  if ($('bn-css-hub')) return;
  const s = document.createElement('style'); s.id = 'bn-css-hub';
  s.textContent = `
  .bn-clases{display:grid;gap:14px;margin-bottom:16px}
  .bn-dia h3{font-size:.85rem;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-light,#e8c766);margin:0 0 8px}
  .bn-cls{display:grid;gap:8px}
  .bn-cl{display:grid;grid-template-columns:58px 1fr auto;gap:12px;align-items:center;padding:12px 14px;border:1px solid var(--line,#2a2d33);border-left:4px solid var(--verde-ok,#4CC38A);border-radius:10px;background:var(--bg-panel,#16181c)}
  .bn-cl.pocos{border-left-color:var(--ambar-espera,#E8C766)}.bn-cl.lleno{border-left-color:var(--rojo-alerta,#ff6b5e)}.bn-cl.pasada{opacity:.5}
  .bn-cl .h{font-size:1.15rem;font-weight:800;font-variant-numeric:tabular-nums}
  .bn-cl b{display:block}.bn-cl small{color:var(--text-muted,#a8a396)}
  .bn-cupo{text-align:right;font-weight:800;line-height:1.15}.bn-cupo small{display:block;font-weight:400}
  .bn-sub{font-size:.95rem;margin:18px 0 8px;color:var(--text-main,#f4f1ea)}
  .bn-aviso{padding:12px 14px;border:1px dashed var(--line,#2a2d33);border-radius:10px;color:var(--text-muted,#a8a396)}
  .bn-lista{display:grid;gap:8px;margin-top:8px}
  .bn-li{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--line,#2a2d33);border-radius:10px;background:var(--bg-base,#0a0a0a)}
  .bn-li span small{display:block;color:var(--text-muted,#a8a396)}
  .bn-vence{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
  .bn-vence label{display:grid;gap:4px;font-size:.9rem;color:var(--text-muted,#a8a396)}
  .bn-vence input{padding:10px;border-radius:8px;border:1px solid var(--line,#2a2d33);background:var(--bg-base,#0a0a0a);color:inherit;font-size:1rem}
  .bn-est{font-size:.85rem;margin-top:6px}.bn-est.mal{color:#ff9b93}.bn-est.ojo{color:#E8C766}.bn-est.ok{color:#4CC38A}
  @media (max-width:420px){.bn-vence{grid-template-columns:1fr}}`;
  document.head.appendChild(s);
}

async function leerSocios() {
  try {
    const snap = await getDocs(query(collection(D().db, 'clients'), where('estado', '==', 'activo')));
    socios = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { console.warn('Bienestar: no se pudieron leer los socios', e); socios = []; }
  return socios;
}
const porVencer = (campo, dias) => (socios || []).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x[campo] || '') && diasHasta(x[campo]) <= dias).sort((a, b) => a[campo].localeCompare(b[campo]));

async function leerClases() {
  if (!window.TURNOS_API) { clases = null; clasesErr = 'sin_conexion_planilla'; return; }
  const r = await llamar('clases_dias', { dias: 4 });
  if (r && r.ok) { clases = r.clases; clasesErr = ''; return; }
  if (r && r.error === 'accion_desconocida') {
    // Script anterior: se arma con los horarios libres públicos (solo muestra clases con lugar).
    const i = await llamar('inicio');
    if (i && i.ok) {
      const nom = {}; (i.recursos || []).forEach((x) => { nom[x.id] = x.nombre; });
      clases = [];
      (i.servicios || []).filter((s) => s.cupo > 1).forEach((s) => ((i.horarios || {})[s.id] || []).forEach((d) => Object.entries(d.recursos || {}).forEach(([rid, hs]) => hs.forEach((h) => clases.push({ fecha: d.fecha, hora: h, clase: s.nombre, sala: nom[rid] || '', cupo: s.cupo, libres: ((d.lugares || {})[rid] || {})[h] ?? s.cupo })))));
      clases.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)); clasesErr = ''; return;
    }
  }
  clases = null; clasesErr = (r && r.error) || 'sin_conexion';
}

function listaModal(titulo, filas, vacio) {
  estilos(); cerrar();
  const f = document.createElement('div'); f.id = 'bn-fondo'; f.className = 'bn-fondo'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true');
  f.innerHTML = `<div class="bn-caja"><button type="button" class="bn-x" id="bn-x" aria-label="Cerrar">✕</button><h2>${esc(titulo)}</h2>
    ${filas.length ? `<div class="bn-lista">${filas.map((x) => `<div class="bn-li"><span><b>${esc(x.nombre)}</b><small>${esc(x.detalle)}</small></span><button type="button" class="bn-btn sec" data-ficha="${esc(x.id)}" data-nombre="${esc(x.nombre)}">Ver ficha</button></div>`).join('')}</div>` : `<p>${esc(vacio)}</p>`}
    <div class="bn-fila"><button type="button" class="bn-btn sec" id="bn-no">Cerrar</button></div></div>`;
  document.body.appendChild(f); document.body.style.overflow = 'hidden';
  $('bn-x').onclick = cerrar; $('bn-no').onclick = cerrar;
  f.addEventListener('click', (e) => { if (e.target === f) return cerrar(); const b = e.target.closest('[data-ficha]'); if (b) { cerrar(); window.abrirExpediente && window.abrirExpediente(b.dataset.ficha, b.dataset.nombre); } });
  f.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
}
const detalleVence = (s, que) => { const n = diasHasta(s); return n < 0 ? `${que} vencida el ${dmy(s)}` : n === 0 ? `${que} vence hoy` : `${que} vence el ${dmy(s)} (en ${n} ${n === 1 ? 'día' : 'días'})`; };
window.bnVerCuotas = () => listaModal('Cuotas vencidas o por vencer', porVencer('cuota_vence', AVISO_CUOTA_DIAS).map((x) => ({ id: x.id, nombre: x.nombre_empresa, detalle: detalleVence(x.cuota_vence, 'Cuota') })), `No hay cuotas vencidas ni que venzan en los próximos ${AVISO_CUOTA_DIAS} días.`);
window.bnVerAptos = () => listaModal('Aptos médicos vencidos o por vencer', porVencer('apto_vence', AVISO_APTO_DIAS).map((x) => ({ id: x.id, nombre: x.nombre_empresa, detalle: detalleVence(x.apto_vence, 'Apto médico') })), `No hay aptos médicos vencidos ni que venzan en los próximos ${AVISO_APTO_DIAS} días.`);
window.bnVerClases = () => { const c = $('bn-clases'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

let ultimoResumen = null;
function pintarResumen(r) {
  ultimoResumen = r; estilosHub();
  const cont = $('hub-resumen'); if (!cont) return;
  const rol = D().rol, cuotas = porVencer('cuota_vence', AVISO_CUOTA_DIAS).length, aptos = porVencer('apto_vence', AVISO_APTO_DIAS).length;
  const deHoy = (clases || []).filter((c) => c.fecha === hoyStr() && !c.pasada && !c.suspendida).length;
  const items = [
    { n: socios ? cuotas : '–', t: 'Cuotas por vencer', cls: cuotas ? 'text-rojo' : 'text-verde', go: 'bnVerCuotas()' },
    { n: socios ? aptos : '–', t: 'Aptos médicos por vencer', cls: aptos ? 'text-ambar' : 'text-verde', go: 'bnVerAptos()' },
    { n: (r.vencidas || 0) + (r.hoy || 0), t: 'Avisos de hoy', cls: (r.vencidas || r.hoy) ? 'text-ambar' : 'text-verde', go: r.vencidas ? 'verVencidas()' : `navegarA('${rol === 'asistente' ? 'mis-tareas' : 'kanban'}')` },
    { n: clases ? deHoy : '–', t: 'Clases que quedan hoy', cls: 'text-verde', go: 'bnVerClases()' }
  ];
  cont.innerHTML = items.map((i) => `<button type="button" class="res-card" onclick="${i.go}"><span class="numero ${i.cls}">${esc(i.n)}</span><span class="res-t">${esc(i.t)}</span></button>`).join('');
}

function pintarClases() {
  estilosHub();
  const lista = $('hub-lista-hoy'); if (!lista) return;
  let box = $('bn-clases'); if (!box) { box = document.createElement('div'); box.id = 'bn-clases'; box.className = 'bn-clases'; lista.parentNode.insertBefore(box, lista); }
  const h2 = document.querySelector('.hub-hoy-head h2'); if (h2) h2.textContent = 'Clases de hoy y los próximos días';
  if (!clases) {
    box.innerHTML = clasesErr === 'sin_conexion_planilla'
      ? '<p class="bn-aviso">Las clases aparecen acá cuando la agenda de turnos está conectada.</p>'
      : clasesErr ? '<p class="bn-aviso">No se pudieron traer las clases. Revise su conexión e intente de nuevo.</p>' : '<p class="bn-aviso">Cargando clases…</p>';
    return;
  }
  const visibles = clases.filter((c) => !(c.fecha === hoyStr() && c.pasada));
  if (!visibles.length) { box.innerHTML = '<p class="bn-aviso">No hay clases cargadas para estos días.</p>'; return; }
  const dias = [...new Set(visibles.map((c) => c.fecha))];
  box.innerHTML = dias.map((f) => `<div class="bn-dia"><h3>${f === hoyStr() ? 'Hoy' : esc(fechaLarga(f))}</h3><div class="bn-cls">${visibles.filter((c) => c.fecha === f).map((c) => {
    const lleno = c.libres <= 0, pocos = !lleno && c.libres <= Math.max(2, Math.ceil(c.cupo * 0.2));
    const estado = c.suspendida ? 'Suspendida' : lleno ? 'Completa' : `${c.libres} de ${c.cupo}`;
    return `<div class="bn-cl${c.suspendida || lleno ? ' lleno' : pocos ? ' pocos' : ''}"><span class="h">${esc(c.hora)}</span><span><b>${esc(c.clase)}</b><small>${esc(c.sala)}</small></span><span class="bn-cupo">${esc(estado)}${!c.suspendida && !lleno ? '<small>lugares libres</small>' : ''}</span></div>`;
  }).join('')}</div></div>`).join('');
}

window.BIENESTAR_RESUMEN = (r) => { pintarResumen(r); };
window.BIENESTAR_HOY = (lista, hoy, base) => {
  base(lista, hoy);
  const cont = $('hub-lista-hoy');
  if (cont) cont.innerHTML = lista.length ? '<h3 class="bn-sub">Seguimientos</h3>' + cont.innerHTML : '';
  pintarClases();
};
async function refrescarHubBienestar() {
  if (!activo() || !D() || !D().listo) return;
  pintarClases();
  await Promise.all([leerSocios(), leerClases()]);
  if (ultimoResumen) pintarResumen(ultimoResumen);
  pintarClases();
}

// ── Ficha del socio: vencimiento de cuota y de apto médico ─────
function estadoVence(s, que, aviso) {
  if (!s) return '';
  const n = diasHasta(s), cls = n < 0 ? 'mal' : n <= aviso ? 'ojo' : 'ok';
  return `<div class="bn-est ${cls}">${esc(detalleVence(s, que))}</div>`;
}
async function bloqueVencimientos(id) {
  estilosHub();
  const lista = $('lista-tareas-cliente'); if (!lista) return;
  let b = $('bn-vence-ficha'); if (!b) { b = document.createElement('section'); b.id = 'bn-vence-ficha'; b.className = 'ficha-datos'; lista.parentNode.insertBefore(b, lista); }
  b.hidden = true;
  let c; try { const s = await getDoc(doc(D().db, 'clients', id)); if (!s.exists()) return; c = s.data(); } catch (e) { return; }
  b.hidden = false;
  b.innerHTML = `<h3>Cuota y apto médico</h3><form id="bn-vence-form"><div class="bn-vence">
    <label>Vence la cuota<input type="date" id="bn-cuota" value="${esc(c.cuota_vence || '')}">${estadoVence(c.cuota_vence, 'Cuota', AVISO_CUOTA_DIAS)}</label>
    <label>Vence el apto médico<input type="date" id="bn-apto" value="${esc(c.apto_vence || '')}">${estadoVence(c.apto_vence, 'Apto médico', AVISO_APTO_DIAS)}</label></div>
    <div class="bn-fila" style="margin-top:12px"><button type="submit" class="bn-btn sec" id="bn-vence-ok">Guardar vencimientos</button></div><div class="bn-err" id="bn-vence-err" role="status"></div></form>`;
  $('bn-vence-form').onsubmit = async (ev) => {
    ev.preventDefault(); const ok = $('bn-vence-ok'); ok.disabled = true; ok.textContent = 'Guardando…';
    try { await updateDoc(doc(D().db, 'clients', id), { cuota_vence: $('bn-cuota').value || '', apto_vence: $('bn-apto').value || '' }); socios = null; bloqueVencimientos(id); }
    catch (e) { console.error(e); ok.disabled = false; ok.textContent = 'Guardar vencimientos'; $('bn-vence-err').textContent = 'No se pudo guardar. Revise su conexión.'; }
  };
}
function engancharFicha() {
  if (window.__bnFicha || typeof window.mostrarFichaDatos !== 'function') return;
  window.__bnFicha = true;
  const orig = window.mostrarFichaDatos;
  window.mostrarFichaDatos = async function (id) { const r = await orig.apply(this, arguments); if (activo()) bloqueVencimientos(id); return r; };
}
// Alta de socio: los dos vencimientos también se pueden cargar al registrarlo.
function engancharAlta() {
  const form = $('form-alta-cliente'); if (!form || $('bn-alta-vence')) return;
  const w = document.createElement('div'); w.id = 'bn-alta-vence'; w.className = 'form-group';
  w.innerHTML = '<label>Vencimientos (opcional)</label><div class="bn-vence" style="margin-top:0"><label>Cuota<input type="date" id="bn-alta-cuota"></label><label>Apto médico<input type="date" id="bn-alta-apto"></label></div>';
  form.insertBefore(w, form.querySelector('.btn-submit'));
  window.datosExtraAlta = () => ({ cuota_vence: ($('bn-alta-cuota') || {}).value || '', apto_vence: ($('bn-alta-apto') || {}).value || '' });
}
window.addEventListener('domino:listo', () => { if (!activo()) return; estilosHub(); engancharFicha(); engancharAlta(); refrescarHubBienestar(); });
window.addEventListener('domino:vista', (e) => { if (activo() && e.detail === 'hub') refrescarHubBienestar(); });
if (activo() && D() && D().listo) { estilosHub(); engancharFicha(); engancharAlta(); refrescarHubBienestar(); }
