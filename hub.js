// DOMino Profesional · Hub de gestión
// Inicio con accesos, expedientes, calendario, herramientas y equipo.
// Usa la conexión a Firebase que arma app.js (window.DOMINO).
import { collection, getDocs, query, where, addDoc, setDoc, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const D = () => window.DOMINO;
const esc = (v) => (D() ? D().esc(v) : String(v ?? ''));
const $ = (id) => document.getElementById(id);
const hoyISO = () => new Date().toISOString().split('T')[0];
const ESTADO_FIN = 'Proceso Completo/Finalizado';

const ICONOS = {
  comando: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  cartera: '<path d="M3 7h18v13H3zM8 7V4h8v3"/>',
  expedientes: '<path d="M4 4h6l2 3h8v13H4z"/>',
  kanban: '<path d="M4 4h5v16H4zM10 4h5v10h-5zM16 4h5v13h-5z"/>',
  tareas: '<path d="M5 12l4 4L19 6"/>',
  buzon: '<path d="M3 8l9 6 9-6M3 6h18v12H3z"/>',
  pendientes: '<path d="M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6"/>',
  enviar: '<path d="M4 12l16-8-6 16-3-7z"/>',
  portal: '<path d="M10 4H5v16h14v-5M14 4h6v6M20 4l-9 9"/>',
  calendario: '<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  equipo: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M16 5a3 3 0 010 6M18 14c2 1 3 3 3 6"/>',
  cuit: '<path d="M4 6h16v12H4zM8 10h4M8 14h8"/>',
  iva: '<path d="M5 19L19 5M7 8a1.5 1.5 0 100-.01M17 18a1.5 1.5 0 100-.01"/>',
  hoja: '<path d="M6 3h9l4 4v14H6zM9 12h7M9 16h7"/>',
  pdf: '<path d="M6 3h9l4 4v14H6zM12 11v6M9 14h6"/>',
  turnos: '<path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3M13 14h3M8 17h3"/>',
  reserva: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>'
};
const icono = (k) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[k]}</svg>`;

// ---------------------------------------------------------------
// Catálogo del Hub: cada función de DOMino Profesional, en un lugar
// ---------------------------------------------------------------
const GRUPOS = [
  { titulo: 'Gestión del estudio', items: [
    { k: 'expedientes', t: 'Clientes', d: 'Empresas, procesos y documentos. Desde acá también se da de alta o baja a un cliente.', roles: ['senior', 'midsenior'], go: () => navegarA('expedientes') },
    { k: 'kanban', t: 'Tareas', d: 'Todas las tareas del estudio, por estado.', roles: ['senior', 'midsenior'], go: () => navegarA('kanban') },
    { k: 'tareas', t: 'Mis Tareas', d: 'Lo que tenés asignado, por estado.', roles: ['asistente'], go: () => navegarA('mis-tareas') }
  ]},
  { titulo: 'Documentos', items: [
    { k: 'buzon', t: 'Buzón documental', d: 'Cargar lo recibido y enviar documentación al cliente.', roles: ['senior', 'midsenior'], go: () => abrirExpedientes('buzon') },
    { k: 'pendientes', t: 'Documentos pendientes', d: 'Lo que subieron los clientes y falta procesar.', roles: ['senior', 'midsenior'], badge: 'docs', go: () => abrirModalDocsPendientes() },
    { k: 'portal', t: 'Portal del cliente', d: 'Cómo ve y envía documentos su cliente.', roles: ['senior', 'midsenior'], go: () => window.open('portal-cliente.html', '_blank', 'noopener') }
  ]},
  { titulo: 'Plazos y equipo', items: [
    { k: 'calendario', t: 'Calendario', d: 'Vencimientos del mes, día por día.', roles: ['senior', 'midsenior', 'asistente'], go: () => navegarA('calendario') },
    { k: 'chat', t: 'Chat interno', d: 'Mensajes del equipo con menciones.', roles: ['senior', 'midsenior', 'asistente'], badge: 'chat', go: () => abrirChat() },
    { k: 'equipo', t: 'Equipo', d: 'Quiénes tienen acceso y con qué nivel.', roles: ['senior'], go: () => navegarA('equipo') }
  ]},
  { titulo: 'Herramientas', items: [
    { k: 'cuit', t: 'Validador de CUIT', d: 'Dígito verificador y tipo de persona.', roles: ['senior', 'midsenior', 'asistente'], go: () => irHerramienta('tool-cuit') },
    { k: 'iva', t: 'Calculadora de IVA', d: 'De neto a total y de total a neto.', roles: ['senior', 'midsenior', 'asistente'], go: () => irHerramienta('tool-iva') },
    { k: 'hoja', t: 'Hoja unificada A4', d: 'Frente y dorso de un documento en una hoja.', roles: ['senior', 'midsenior', 'asistente'], go: () => irHerramienta('tool-hoja') },
    { k: 'pdf', t: 'Unificador de archivos en PDF', d: 'Fotos, PDF, Word y Excel en un solo PDF.', roles: ['senior', 'midsenior', 'asistente'], go: () => irHerramienta('tool-pdf') }
  ]}
];
// Módulos opcionales (se activan por rubro en modulos.js). Turnos: agenda para veterinarias, consultorios, gimnasios.
const MODULOS = window.DOMINO_MODULOS || {};
if (MODULOS.turnos) {
  GRUPOS.push({ titulo: 'Agenda y turnos', items: [
    { k: 'turnos', t: 'Agenda de turnos', d: 'Turnos del día, solicitudes por confirmar y avisos de mañana.', roles: ['senior', 'midsenior', 'asistente'], go: () => window.open('turnos/panel.html', '_blank', 'noopener') },
    { k: 'reserva', t: 'Página de reserva', d: 'La página donde sus clientes piden turno. Compártala por WhatsApp o redes.', roles: ['senior', 'midsenior', 'asistente'], go: () => window.open('turnos/reserva.html', '_blank', 'noopener') }
  ]});
}
// Perfil por rubro (modulos.js): oculta, renombra y ordena según lo que necesita cada rubro.
{
  const P = window.DOMINO_PERFIL || {}, oc = P.ocultar || [], et = P.etiquetas || {}, orden = P.orden || [];
  GRUPOS.forEach((g) => { g.items = g.items.filter((i) => !oc.includes(i.k)); g.items.forEach((i) => { if (et[i.k]) Object.assign(i, et[i.k]); }); });
  for (let i = GRUPOS.length - 1; i >= 0; i--) if (!GRUPOS[i].items.length) GRUPOS.splice(i, 1);
  if (orden.length) GRUPOS.sort((a, b) => { const x = orden.indexOf(a.titulo), y = orden.indexOf(b.titulo); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
  if ((window.DOMINO_FUNC || {}).documentos === false) GRUPOS.forEach((g) => g.items.forEach((i) => { if (['buzon', 'pendientes', 'portal'].includes(i.k)) { i.prox = true; i.go = () => window.DOMINO_PROXIMO && window.DOMINO_PROXIMO(i.t); } }));
  const gest = GRUPOS.find((g) => g.titulo === 'Gestión del estudio'); if (gest && window.DOMINO_T) gest.titulo = window.DOMINO_T('gestion', gest.titulo);
  const nav = document.getElementById('nav-expedientes'); if (nav && window.DOMINO_T) nav.textContent = window.DOMINO_T('clientes', nav.textContent);
  const lt = document.getElementById('lista-tareas-cliente'), pr = lt && lt.parentElement.querySelector('h2'); if (pr && window.DOMINO_T) pr.textContent = window.DOMINO_T('procesos', pr.textContent);
}
const ACCIONES = [];

function irHerramienta(id) {
  navegarA('herramientas');
  setTimeout(() => { const el = $(id); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('resalta'); setTimeout(() => el.classList.remove('resalta'), 1600); } }, 60);
}
window.abrirExpedientes = function (modo) {
  D().modoExp = modo || 'expediente';
  navegarA('expedientes');
};

// ---------------------------------------------------------------
// INICIO
// ---------------------------------------------------------------
const T = (k, d) => (window.DOMINO_T ? window.DOMINO_T(k, d) : d);
const ROL_TXT = { senior: T('rol_senior', 'Profesional Senior'), midsenior: T('rol_midsenior', 'Profesional Mid Senior'), asistente: T('rol_asistente', 'Asistente') };

function badgeChat() { const b = $('badge-chat'); return b && b.style.display !== 'none' ? b.innerText : ''; }

async function tareasAbiertas() {
  const snap = await getDocs(collection(D().db, 'tasks'));
  const out = [];
  snap.forEach((t) => out.push({ id: t.id, ...t.data() }));
  return out;
}

async function renderHub() {
  const rol = D().rol;
  $('hub-buscar').hidden = rol === 'asistente';
  if (rol !== 'asistente') { $('hub-q').value = ''; $('hub-q-res').innerHTML = ''; cargarEmpresas().catch((e) => console.error(e)); }
  const nombre = D().nombre || '';
  $('hub-fecha').innerText = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  // Si el nombre cargado es un título genérico (Contador 1, Asistente 2…), se saluda sin número ni cargo
  const generico = /^(contador|contadora|asistente|profesional|usuario|admin|administrador)\b/i.test(String(nombre || '').trim());
  $('hub-saludo').innerText = nombre && !generico ? `Hola, ${nombre}` : 'Hola, profesional';
  $('hub-sub').innerText = `${ROL_TXT[rol] || ''} · ${T('hub_sub', 'Todo el estudio en un solo lugar: elegí una herramienta y entrás en un toque.')}`;
  renderGrupos();
  try {
    let tareas = await tareasAbiertas();
    if (rol === 'asistente') tareas = tareas.filter((t) => t.responsable === nombre);
    const hoy = hoyISO();
    const lim = new Date(); lim.setDate(lim.getDate() + 4);
    const limite = lim.toISOString().split('T')[0];
    const abiertas = tareas.filter((t) => t.estado !== ESTADO_FIN);
    const vencidas = abiertas.filter((t) => t.vencimiento && t.vencimiento < hoy);
    const deHoy = abiertas.filter((t) => t.vencimiento === hoy);
    const proximas = abiertas.filter((t) => t.vencimiento && t.vencimiento > hoy && t.vencimiento <= limite);
    renderResumen({ listos: tareas.filter((t) => t.estado === ESTADO_FIN).length, vencidas: vencidas.length, hoy: deHoy.length, proceso: abiertas.filter((t) => t.estado === 'En Proceso' || t.estado === 'Procesado/Liquidado').length });
    renderHoy([...vencidas, ...deHoy, ...proximas].sort((a, b) => (a.vencimiento || '').localeCompare(b.vencimiento || '')).slice(0, 8), hoy);
  } catch (e) {
    console.error('Hub: no se pudieron leer las tareas', e);
    $('hub-lista-hoy').innerHTML = '<p class="vacio">No se pudieron cargar las tareas. Probá de nuevo en un momento.</p>';
  }
}

function renderResumen(r) {
  const rol = D().rol;
  const items = [
    { n: r.vencidas, t: 'Vencidas', cls: 'text-rojo', go: "verVencidas()" },
    { n: r.hoy, t: 'Vencen hoy', cls: 'text-ambar', go: "navegarA('calendario')" },
    { n: r.proceso, t: 'En proceso', cls: 'text-ambar', go: `navegarA('${rol === 'asistente' ? 'mis-tareas' : 'kanban'}')` }
  ];
  items.push({ n: r.listos, t: rol === 'asistente' ? T('kpi_finalizadas', 'Finalizadas') : T('kpi_listos', 'Balances listos'), cls: 'text-verde', go: `navegarA('${rol === 'asistente' ? 'mis-tareas' : 'kanban'}')` });
  if (rol !== 'asistente' && (window.DOMINO_FUNC || {}).documentos !== false) items.push({ n: (D().kpis || {}).docsPendientes ?? '–', t: 'Documentos por procesar', cls: 'text-ambar', go: 'abrirModalDocsPendientes()' });
  $('hub-resumen').innerHTML = items.map((i) => `<button type="button" class="res-card" onclick="${i.go}"><span class="numero ${i.cls}">${esc(i.n)}</span><span class="res-t">${esc(i.t)}</span></button>`).join('');
}

function renderHoy(lista, hoy) {
  const cont = $('hub-lista-hoy');
  if (!lista.length) { cont.innerHTML = '<p class="vacio">No hay vencimientos para hoy ni para los próximos días.</p>'; return; }
  const cache = (window.DOMINO && window.DOMINO.clientes) || {};
  cont.innerHTML = lista.map((t) => {
    const vencida = t.vencimiento < hoy;
    const eti = vencida ? 'Vencida' : t.vencimiento === hoy ? 'Hoy' : 'Próxima';
    const color = vencida ? 'border-rojo' : t.vencimiento === hoy ? 'border-ambar' : 'border-verde';
    const empresa = cache[t.cliente_id] || T('empresa', 'Empresa');
    const act = D().rol === 'asistente'
      ? `data-act="docs-tarea" data-id="${esc(t.id)}" data-titulo="${esc(t.titulo)}" data-cliente="${esc(t.cliente_id)}"`
      : `data-act="expediente" data-id="${esc(t.cliente_id)}" data-nombre="${esc(empresa)}"`;
    return `<div class="task-item ${color}"><div class="task-info"><h4>${esc(t.titulo)}</h4><p style="color:var(--text-muted);font-size:.85rem;"><strong>${esc(empresa)}</strong> | ${esc(t.responsable)} | Vence: ${esc(t.vencimiento)} | <b class="eti">${eti}</b></p></div><button class="btn-action" ${act}>${D().rol === 'asistente' ? 'Documentos' : T('ver_ficha', 'Ver expediente')}</button></div>`;
  }).join('');
}

function renderGrupos() {
  const rol = D().rol;
  $('hub-grupos').innerHTML = GRUPOS.map((g, gi) => {
    const items = g.items.filter((i) => i.roles.includes(rol));
    if (!items.length) return '';
    return `<section class="hub-grupo" id="hub-g-${gi}"><h2>${esc(g.titulo)}</h2><div class="tiles">${items.map((i, ii) => `
      <button type="button" class="tile"${i.prox ? ' data-prox="1"' : ''} data-g="${gi}" data-i="${g.items.indexOf(i)}">${i.prox ? '<span class="tile-prox">Próximamente</span>' : ''}
        <span class="tile-ic">${icono(i.k)}</span>
        <span class="tile-tx"><b>${esc(i.t)}</b><small>${esc(i.d)}</small></span>
        <span class="tile-badge" data-badge="${i.badge || ''}" hidden></span>
      </button>`).join('')}</div></section>`;
  }).join('');
  $('hub-atajos').innerHTML = GRUPOS.map((g, gi) => g.items.some((i) => i.roles.includes(rol)) ? `<button type="button" class="atajo" data-ir="hub-g-${gi}">${esc(g.titulo)}</button>` : '').join('');
  refrescarBadges();
}
function refrescarBadges() {
  document.querySelectorAll('.tile-badge').forEach((b) => {
    let v = '';
    if (b.dataset.badge === 'docs') v = (D().kpis || {}).docsPendientes || '';
    if (b.dataset.badge === 'chat') v = badgeChat();
    b.hidden = !v || v === '0'; b.innerText = v;
  });
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('.tile');
  if (!t) return;
  GRUPOS[+t.dataset.g].items[+t.dataset.i].go();
});
window.addEventListener('domino:kpis', refrescarBadges);
setInterval(refrescarBadges, 4000);

// ---------------------------------------------------------------
// EXPEDIENTES (selector de empresa)
// ---------------------------------------------------------------
let empresas = [];
async function cargarEmpresas() {
  const [cl, ta, dc] = await Promise.all([
    getDocs(query(collection(D().db, 'clients'), where('estado', '==', 'activo'))),
    getDocs(collection(D().db, 'tasks')),
    getDocs(query(collection(D().db, 'documents'), where('estado', '==', 'Pendiente de Procesar')))
  ]);
  const abiertas = {}, docs = {};
  ta.forEach((t) => { const d = t.data(); if (d.estado !== ESTADO_FIN) abiertas[d.cliente_id] = (abiertas[d.cliente_id] || 0) + 1; });
  dc.forEach((x) => { const d = x.data(); docs[d.cliente_id] = (docs[d.cliente_id] || 0) + 1; });
  empresas = [];
  cl.forEach((c) => { const d = c.data(); empresas.push({ id: c.id, nombre: d.nombre_empresa, cuit: d.cuit, masc: (window.DOMINO_MODULOS || {}).mascotas ? (d.mascotas || []).map((m) => m.nombre).join(', ') : '', fam: (d.personas || []).map((p) => p.nombre).join(', '), abiertas: abiertas[c.id] || 0, docs: docs[c.id] || 0 }); });
  empresas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
function pintarEmpresas() {
  const q = ($('buscar-expediente').value || '').toLowerCase().trim();
  const modo = D().modoExp === 'buzon' ? 'buzon' : 'expediente';
  const lista = empresas.filter((e) => !q || e.nombre.toLowerCase().includes(q) || String(e.cuit).includes(q) || `${e.masc} ${e.fam}`.toLowerCase().includes(q));
  $('lista-expedientes').innerHTML = lista.length ? lista.map((e) => `
    <button type="button" class="exp-card" data-act="${modo}" data-id="${esc(e.id)}" data-nombre="${esc(e.nombre)}">
      <b>${esc(e.nombre)}</b><small>${e.cuit ? T('id_label', 'CUIT') + ' ' + esc(e.cuit) : ''}</small>${e.masc ? `<small>Mascotas: ${esc(e.masc)}</small>` : ''}
      <span class="exp-meta"><span>${e.abiertas} ${e.abiertas === 1 ? T('proceso', 'proceso abierto') : T('procesos_n', 'procesos abiertos')}</span>${e.docs ? `<span class="exp-doc">${e.docs} ${e.docs === 1 ? 'documento por procesar' : 'documentos por procesar'}</span>` : ''}</span>
    </button>`).join('') : '<p class="vacio">No hay empresas que coincidan.</p>';
}
async function renderExpedientes() {
  const modo = D().modoExp === 'buzon' ? 'buzon' : 'expediente';
  $('titulo-expedientes').innerText = modo === 'buzon' ? (window.DOMINO_T ? window.DOMINO_T('buzon', 'Buzón documental') : 'Buzón documental') : (window.DOMINO_T ? window.DOMINO_T('expedientes', 'Expedientes') : 'Expedientes');
  $('expedientes-ayuda').innerText = modo === 'buzon' ? T('buscar_ayuda_buzon', 'Elegí la empresa para cargar documentos recibidos o enviarle documentación.') : (window.DOMINO_T ? window.DOMINO_T('ayuda_expediente', 'Elegí la empresa para ver sus procesos y documentos.') : 'Elegí la empresa para ver sus procesos y documentos.');
  $('lista-expedientes').innerHTML = '<p class="vacio">Cargando…</p>';
  try { await cargarEmpresas(); pintarEmpresas(); } catch (e) { console.error(e); $('lista-expedientes').innerHTML = '<p class="vacio">No se pudieron cargar las empresas.</p>'; }
  D().modoExp = 'expediente';
}
$('buscar-expediente').addEventListener('input', pintarEmpresas);

// ---------------------------------------------------------------
// CALENDARIO
// ---------------------------------------------------------------
let calMes = new Date(); calMes.setDate(1);
let calTareas = [];
let calSel = null;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

async function renderCalendario() {
  try {
    let t = await tareasAbiertas();
    if (D().rol === 'asistente') t = t.filter((x) => x.responsable === D().nombre);
    calTareas = t.filter((x) => x.vencimiento);
  } catch (e) { console.error(e); }
  pintarCalendario();
}
function pintarCalendario() {
  const y = calMes.getFullYear(), m = calMes.getMonth();
  $('cal-titulo').innerText = `${MESES[m][0].toUpperCase()}${MESES[m].slice(1)} ${y}`;
  const primero = new Date(y, m, 1).getDay();
  const offset = (primero + 6) % 7; // lunes primero
  const dias = new Date(y, m + 1, 0).getDate();
  const hoy = hoyISO();
  let h = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((d) => `<div class="cal-cab">${d}</div>`).join('');
  for (let i = 0; i < offset; i++) h += '<div class="cal-vacio"></div>';
  for (let d = 1; d <= dias; d++) {
    const f = iso(y, m, d);
    const ts = calTareas.filter((t) => t.vencimiento === f);
    const abiertas = ts.filter((t) => t.estado !== ESTADO_FIN).length;
    const cls = ['cal-dia-btn', f === hoy ? 'es-hoy' : '', f === calSel ? 'sel' : '', abiertas && f < hoy ? 'vencido' : ''].join(' ');
    const lab = ts.length ? `${d}: ${ts.length} ${ts.length === 1 ? 'vencimiento' : 'vencimientos'}` : `${d}: sin vencimientos`;
    h += `<button type="button" class="${cls}" data-f="${f}" aria-label="${lab}"><span>${d}</span>${ts.length ? `<em>${ts.length}</em>` : ''}</button>`;
  }
  $('cal-grid').innerHTML = h;
  pintarDia();
}
function pintarDia() {
  if (!calSel) { $('cal-dia-titulo').innerText = 'Elegí un día'; $('cal-dia-lista').innerHTML = ''; return; }
  const [y, m, d] = calSel.split('-').map(Number);
  $('cal-dia-titulo').innerText = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const ts = calTareas.filter((t) => t.vencimiento === calSel);
  const cache = D().clientes || {};
  $('cal-dia-lista').innerHTML = ts.length ? ts.map((t) => {
    const fin = t.estado === ESTADO_FIN;
    const act = D().rol === 'asistente'
      ? `data-act="docs-tarea" data-id="${esc(t.id)}" data-titulo="${esc(t.titulo)}" data-cliente="${esc(t.cliente_id)}"`
      : `data-act="expediente" data-id="${esc(t.cliente_id)}" data-nombre="${esc(cache[t.cliente_id] || T('empresa', 'Empresa'))}"`;
    return `<div class="task-item ${fin ? 'border-verde' : 'border-ambar'}"><div class="task-info"><h4>${esc(t.titulo)}</h4><p style="color:var(--text-muted);font-size:.85rem;"><strong>${esc(cache[t.cliente_id] || 'Empresa')}</strong> | ${esc(t.responsable)} | Estado: ${esc(t.estado)}</p></div><button class="btn-action" ${act}>${D().rol === 'asistente' ? 'Documentos' : T('ver_ficha', 'Ver expediente')}</button></div>`;
  }).join('') : '<p class="vacio">No hay vencimientos este día.</p>';
}
$('cal-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; calSel = b.dataset.f; pintarCalendario(); });
$('cal-prev').addEventListener('click', () => { calMes.setMonth(calMes.getMonth() - 1); pintarCalendario(); });
$('cal-next').addEventListener('click', () => { calMes.setMonth(calMes.getMonth() + 1); pintarCalendario(); });
$('cal-hoy').addEventListener('click', () => { calMes = new Date(); calMes.setDate(1); calSel = hoyISO(); pintarCalendario(); });

// ---------------------------------------------------------------
// EQUIPO
// ---------------------------------------------------------------
const NIVELES = [['senior', T('rol_senior', 'Profesional Senior')], ['midsenior', T('rol_midsenior', 'Profesional Mid Senior')], ['asistente', T('rol_asistente', 'Asistente')]];
let equipoCache = [];
async function renderEquipo() {
  const cont = $('lista-equipo');
  cont.innerHTML = '<p class="vacio">Cargando…</p>';
  try {
    const snap = await getDocs(collection(D().db, 'users'));
    equipoCache = [];
    snap.forEach((u) => equipoCache.push({ id: u.id, ...u.data() }));
    const orden = { senior: 0, midsenior: 1, asistente: 2 };
    equipoCache.sort((a, b) => (orden[a.rol_jerarquia] ?? 9) - (orden[b.rol_jerarquia] ?? 9) || String(a.nombre_display).localeCompare(String(b.nombre_display)));
    const yo = String(D().email || '').toLowerCase();
    cont.innerHTML = equipoCache.map((u) => {
      const soyYo = String(u.email || '').toLowerCase() === yo;
      const baja = u.activo === false;
      const opts = NIVELES.map(([v, t]) => `<option value="${v}" ${u.rol_jerarquia === v ? 'selected' : ''}>${t}</option>`).join('');
      return `<div class="task-item eq-fila ${baja ? 'eq-baja' : (u.rol_jerarquia === 'senior' ? 'border-verde' : 'border-ambar')}" data-uid="${esc(u.id)}">
        <div class="task-info"><h4>${esc(u.nombre_display || u.email)} ${soyYo ? '<small class="eq-yo">(vos)</small>' : ''} ${baja ? '<small class="eq-tag">De baja</small>' : ''}</h4>
        <p style="color:var(--text-muted);font-size:.85rem;">${esc(u.email)}</p></div>
        <div class="eq-acc">
          <label class="eq-niv"><span>Nivel</span><select data-eq="nivel" ${soyYo ? 'disabled title="No podés cambiar tu propio nivel"' : ''}>${opts}</select></label>
          <button class="btn-secundario" data-eq="acceso">Reenviar acceso</button>
          ${soyYo ? '' : `<button class="${baja ? 'btn-activar' : 'btn-baja'}" data-eq="baja">${baja ? 'Reactivar' : 'Dar de baja'}</button>`}
        </div></div>`;
    }).join('') || '<p class="vacio">No hay personas cargadas.</p>';
  } catch (e) { console.error(e); cont.innerHTML = '<p class="vacio">No se pudo cargar el equipo.</p>'; }
}
const seniorsActivos = (exceptoId) => equipoCache.filter((u) => u.rol_jerarquia === 'senior' && u.activo !== false && u.id !== exceptoId).length;
async function guardarUsuario(id, datos) { await updateDoc(doc(D().db, 'users', id), datos); }
document.addEventListener('change', async (e) => {
  const sel = e.target.closest('[data-eq="nivel"]');
  if (!sel) return;
  const fila = sel.closest('[data-uid]'); const u = equipoCache.find((x) => x.id === fila.dataset.uid);
  if (!u) return;
  if (u.rol_jerarquia === 'senior' && sel.value !== 'senior' && seniorsActivos(u.id) < 1) {
    D().aviso('Tiene que quedar al menos un Profesional Senior.', 'error'); sel.value = u.rol_jerarquia; return;
  }
  try { await guardarUsuario(u.id, { rol_jerarquia: sel.value }); u.rol_jerarquia = sel.value; D().aviso(`Nivel de ${u.nombre_display || u.email} actualizado. Se aplica la próxima vez que entre.`); }
  catch (err) { console.error(err); D().aviso('No se pudo guardar el cambio. Verificá tu conexión y tus permisos.', 'error'); sel.value = u.rol_jerarquia; }
});
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-eq="acceso"],[data-eq="baja"]');
  if (!b) return;
  const u = equipoCache.find((x) => x.id === b.closest('[data-uid]').dataset.uid); if (!u) return;
  if (b.dataset.eq === 'acceso') { window.enviarAcceso(u.email, b); return; }
  const darBaja = u.activo !== false;
  if (darBaja && u.rol_jerarquia === 'senior' && seniorsActivos(u.id) < 1) { D().aviso('Tiene que quedar al menos un Profesional Senior activo.', 'error'); return; }
  try { await guardarUsuario(u.id, { activo: !darBaja }); D().aviso(darBaja ? `${u.nombre_display || u.email} quedó de baja: ya no puede entrar.` : `${u.nombre_display || u.email} fue reactivado.`); renderEquipo(); }
  catch (err) { console.error(err); D().aviso('No se pudo guardar el cambio.', 'error'); }
});
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'form-alta-persona') return;
  e.preventDefault();
  const nombre = $('persona-nombre').value.trim(), email = $('persona-email').value.trim().toLowerCase(), nivel = $('persona-nivel').value;
  if (!nombre || !email) return;
  if (equipoCache.some((u) => String(u.email).toLowerCase() === email)) { D().aviso('Ese correo ya está cargado en el equipo.', 'error'); return; }
  const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
  try {
    await setDoc(doc(D().db, 'users', email), { email, nombre_display: nombre, rol_jerarquia: nivel, activo: true, creado: serverTimestamp() });
  } catch (err) { console.error(err); D().aviso('No se pudo guardar a la persona. Verificá tus permisos.', 'error'); btn.disabled = false; return; }
  try {
    const r = await D().crearAcceso(email);
    D().aviso(r === 'creado' ? `${nombre} fue agregado. Le enviamos un correo a ${email} para que cree su clave.` : `${nombre} fue agregado. Ya tenía una cuenta: le enviamos un correo para restablecer su clave.`);
  } catch (err) { console.error(err); D().aviso(`${nombre} quedó cargado, pero no se pudo enviar el correo (${D().textoErrorAcceso(err)}) Probá con «Reenviar acceso».`, 'error'); }
  e.target.reset(); btn.disabled = false; renderEquipo();
});

// ---------------------------------------------------------------
// HERRAMIENTAS
// ---------------------------------------------------------------
// 1) CUIT / CUIL
export function validarCuit(txt) {
  const n = String(txt).replace(/\D/g, '');
  if (n.length !== 11) return { ok: false, msg: 'Debe tener 11 dígitos.' };
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((a, p, i) => a + p * +n[i], 0);
  let dv = 11 - (suma % 11);
  if (dv === 11) dv = 0;
  if (dv === 10 || dv !== +n[10]) return { ok: false, msg: `El dígito verificador no coincide (debería ser ${dv === 10 ? 'no válido' : dv}).` };
  const pre = n.slice(0, 2);
  const tipos = { '20': 'persona humana (masculino)', '27': 'persona humana (femenino)', '23': 'persona humana', '24': 'persona humana', '30': 'persona jurídica', '33': 'persona jurídica', '34': 'persona jurídica' };
  return { ok: true, msg: `Dígito verificador correcto. Prefijo ${pre}: ${tipos[pre] || 'tipo no estándar, verificalo en ARCA'}.`, fmt: `${n.slice(0, 2)}-${n.slice(2, 10)}-${n[10]}` };
}
$('cuit-in').addEventListener('input', () => {
  const v = $('cuit-in').value;
  const out = $('cuit-out');
  if (!v.trim()) { out.innerHTML = ''; return; }
  const r = validarCuit(v);
  out.className = 'tool-out ' + (r.ok ? 'ok' : 'mal');
  out.innerHTML = `<b>${r.ok ? '✓ Válido' : '✕ No válido'}</b>${r.fmt ? ` · ${esc(r.fmt)}` : ''}<br>${esc(r.msg)}<br><small>Solo controla el formato matemático; no confirma que esté inscripto.</small>`;
});

// 2) IVA
let ivaModo = 'neto';
const moneda = (n) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
function calcIva() {
  const m = parseFloat($('iva-monto').value);
  const out = $('iva-out');
  if (!isFinite(m)) { out.innerHTML = ''; return; }
  const a = parseFloat($('iva-alicuota').value) / 100;
  const neto = ivaModo === 'neto' ? m : m / (1 + a);
  const iva = neto * a;
  out.className = 'tool-out';
  out.innerHTML = `<table class="mini-tabla"><tr><td>Neto</td><td>${moneda(neto)}</td></tr><tr><td>IVA</td><td>${moneda(iva)}</td></tr><tr><td><b>Total</b></td><td><b>${moneda(neto + iva)}</b></td></tr></table>`;
}
function setIvaModo(modo) {
  ivaModo = modo;
  $('iva-neto').className = modo === 'neto' ? 'btn-primary' : 'btn-secundario';
  $('iva-total').className = modo === 'total' ? 'btn-primary' : 'btn-secundario';
  $('iva-neto').setAttribute('aria-pressed', modo === 'neto'); $('iva-total').setAttribute('aria-pressed', modo === 'total');
  calcIva();
}
$('iva-neto').addEventListener('click', () => setIvaModo('neto'));
$('iva-total').addEventListener('click', () => setIvaModo('total'));
$('iva-monto').addEventListener('input', calcIva);
$('iva-alicuota').addEventListener('change', calcIva);

// 3) Hoja A4 unificada
const hoja = { frente: null, dorso: null };
function cargarImg(file) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
}
function dibujarHoja() {
  const c = $('hoja-canvas'); const x = c.getContext('2d');
  c.width = 1240; c.height = 1754; // A4 a 150 ppp
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  const caja = (img, y0) => {
    const mx = 120, my = 90, w = c.width - mx * 2, h = c.height / 2 - my * 2;
    x.strokeStyle = '#d9d9d9'; x.setLineDash([8, 8]); x.strokeRect(mx, y0 + my, w, h); x.setLineDash([]);
    if (!img) return;
    const k = Math.min(w / img.width, h / img.height);
    const iw = img.width * k, ih = img.height * k;
    x.drawImage(img, mx + (w - iw) / 2, y0 + my + (h - ih) / 2, iw, ih);
  };
  caja(hoja.frente, 0); caja(hoja.dorso, c.height / 2);
}
async function leerHoja(que, file) { if (!file) { hoja[que] = null; } else { try { hoja[que] = await cargarImg(file); } catch (e) { hoja[que] = null; } } dibujarHoja(); }
$('hoja-frente').addEventListener('change', (e) => leerHoja('frente', e.target.files[0]));
$('hoja-dorso').addEventListener('change', (e) => leerHoja('dorso', e.target.files[0]));
$('hoja-limpiar').addEventListener('click', () => {
  hoja.frente = null; hoja.dorso = null; $('hoja-frente').value = ''; $('hoja-dorso').value = ''; dibujarHoja();
  if (D() && D().aviso) D().aviso('Listo: se limpiaron las imágenes.');
});
$('hoja-descargar').addEventListener('click', () => {
  if (!hoja.frente && !hoja.dorso) { alert('Elegí al menos una imagen.'); return; }
  $('hoja-canvas').toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'hoja-unificada-A4.png'; document.body.appendChild(a); a.click(); a.remove(); }, 'image/png');
});
$('hoja-imprimir').addEventListener('click', () => {
  if (!hoja.frente && !hoja.dorso) { alert('Elegí al menos una imagen.'); return; }
  const url = $('hoja-canvas').toDataURL('image/png');
  const w = window.open('', '_blank');
  if (!w) { alert('El navegador bloqueó la ventana de impresión.'); return; }
  w.document.write(`<title>Hoja unificada</title><style>@page{size:A4;margin:0}body{margin:0}img{width:210mm;height:297mm;display:block}</style><img src="${url}" onload="setTimeout(function(){print()},200)">`);
  w.document.close();
});
dibujarHoja();

// ---------------------------------------------------------------
// Enrutado de vistas
// ---------------------------------------------------------------
window.addEventListener('domino:vista', (e) => {
  if (!D().listo) return;
  const v = e.detail;
  if (v === 'hub') renderHub();
  else if (v === 'expedientes') renderExpedientes();
  else if (v === 'calendario') renderCalendario();
  else if (v === 'equipo') renderEquipo();
});

// ---------------------------------------------------------------
// Buscador de empresa en Inicio: escribir tres letras y entrar directo
// ---------------------------------------------------------------
function buscarEnInicio() {
  const q = $('hub-q').value.toLowerCase().trim();
  const out = $('hub-q-res');
  if (q.length < 2) { out.innerHTML = ''; return; }
  const lista = empresas.filter((e) => e.nombre.toLowerCase().includes(q) || `${e.masc} ${e.fam}`.toLowerCase().includes(q) || String(e.cuit).replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§')).slice(0, 6);
  out.innerHTML = lista.length ? lista.map((e) => `
    <div class="q-fila">
      <div class="q-txt"><b>${esc(e.nombre)}</b><small>${e.cuit ? T('id_label', 'CUIT') + ' ' + esc(e.cuit) : ''}${e.masc ? ' · Mascotas: ' + esc(e.masc) : ''} · ${e.abiertas} ${e.abiertas === 1 ? T('proceso', 'proceso abierto') : T('procesos_n', 'procesos abiertos')}${e.docs ? ` · ${e.docs} por procesar` : ''}</small></div>
      <div class="q-acc">
        <button type="button" class="btn-primary" data-act="expediente" data-id="${esc(e.id)}" data-nombre="${esc(e.nombre)}">Expediente</button>
        <button type="button" class="btn-secundario" data-act="buzon" data-id="${esc(e.id)}" data-nombre="${esc(e.nombre)}">Buzón</button>
      </div>
    </div>`).join('') : '<p class="vacio">No hay empresas activas que coincidan.</p>';
}
$('hub-q').addEventListener('input', buscarEnInicio);
$('hub-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const b = document.querySelector('#hub-q-res [data-act="expediente"]'); if (b) b.click(); } });

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ir]');
  if (!b) return;
  const el = document.getElementById(b.dataset.ir);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
});


// ---------------------------------------------------------------
// FICHA: datos de contacto y mascotas dentro del expediente de cada cliente
// ---------------------------------------------------------------
import { getDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
window.mostrarFichaDatos = async function (id) {
  let bloque = $('ficha-datos');
  if (!bloque) { bloque = document.createElement('section'); bloque.id = 'ficha-datos'; bloque.className = 'ficha-datos'; const lista = $('lista-tareas-cliente'); lista.parentNode.insertBefore(bloque, lista); }
  bloque.innerHTML = ''; bloque.hidden = true;
  let c; try { const s = await getDoc(doc(D().db, 'clients', id)); if (!s.exists()) return; c = s.data(); } catch (e) { return; }
  const turnos = !!(window.DOMINO_MODULOS || {}).turnos, masc = !!(window.DOMINO_MODULOS || {}).mascotas;
  if (!turnos && !c.telefono && !c.email_contacto && !(c.mascotas || []).length && !(c.personas || []).length) return;
  const tel = String(c.telefono || '').replace(/\D/g, '');
  const nombreFicha = c.nombre_empresa || '';
  let pers = c.personas || [], abierta = null, ctl = null;
  const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const dmy = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.split('-').reverse().join('/') : '';
  const dias = (s) => Math.round((new Date(s + 'T12:00:00') - new Date(hoyISO() + 'T12:00:00')) / 86400000);
  const estadoLib = (x) => { const p = (x.libreta || []).map((e) => e.proxima).filter(Boolean).sort(); const futuras = p.filter((s) => dias(s) >= 0), vencidas = (x.libreta || []).filter((e) => e.proxima && dias(e.proxima) < 0 && !(x.libreta || []).some((o) => o !== e && o.tipo === e.tipo && o.fecha > e.fecha)); return { vencidas, prox: futuras[0] }; };
  const guardarMasc = async (lista) => { await updateDoc(doc(D().db, 'clients', id), { mascotas: lista }); c.mascotas = lista; };
  const TIPOS = ['Vacuna', 'Antirrábica', 'Desparasitación', 'Consulta', 'Cirugía', 'Peso', 'Otro'];
  const libretaHTML = (x) => {
    const ls = (x.libreta || []).slice().sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')), st = estadoLib(x);
    const nuevoTurno = ctl ? `<div class="lib-ok"><b>Control cargado para el ${dmy(ctl.proxima)}.</b> ¿Lo coordinamos ahora?<div class="lib-acc">${turnos ? `<a class="btn-primary" style="text-decoration:none;display:inline-flex;align-items:center" href="turnos/panel.html?nuevo=1&cliente=${encodeURIComponent(id)}&fecha=${ctl.proxima}&mascota=${encodeURIComponent(x.nombre)}&tipo=${encodeURIComponent(x.tipo || '')}&nota=${encodeURIComponent('Control de ' + ctl.tipo.toLowerCase())}&reg=${encodeURIComponent(ctl.id)}">Agendar turno</a>` : ''}<button type="button" class="btn-secundario" id="lib-ics">Agregar a mi calendario</button><button type="button" class="btn-secundario" id="lib-no">Más tarde</button></div></div>` : '';
    return `<div class="libreta"><h4>Libreta sanitaria · ${esc(x.nombre)}</h4>${nuevoTurno}
    ${st.vencidas.length ? `<div class="lib-alerta">Vencido: ${st.vencidas.map((e) => esc(e.tipo) + ' (' + dmy(e.proxima) + ')').join(', ')}</div>` : ''}${st.prox ? `<div class="lib-ok">Próximo vencimiento: ${dmy(st.prox)} · en ${dias(st.prox)} ${dias(st.prox) === 1 ? 'día' : 'días'}</div>` : ''}
    <div class="lib-lista">${ls.length ? ls.map((e) => `<div class="lib-fila"><b>${dmy(e.fecha)}</b><span>${esc(e.tipo)}${e.detalle ? ' — ' + esc(e.detalle) : ''}${e.proxima ? `<small>Próxima: ${dmy(e.proxima)}</small>` : ''}</span><button data-le="${esc(e.id)}" aria-label="Quitar registro">×</button></div>`).join('') : '<i>Sin registros todavía.</i>'}</div>
    <form class="libreta-alta" id="lib-form"><label>Qué<select id="lb-t">${TIPOS.map((t) => `<option>${t}</option>`).join('')}</select></label><label>Fecha<input id="lb-f" type="date" value="${hoyISO()}" required></label><label class="lb-det">Detalle (producto, peso, nota)<input id="lb-d" maxlength="120" placeholder="Ej. Sextuple, lote 123 / 12,4 kg"></label><label>Próxima<input id="lb-p" type="date"></label><button class="btn-secundario" type="submit">Guardar registro</button></form>
    ${(window.DOMINO_FUNC || {}).documentos === false ? '<button type="button" class="btn-secundario" id="lib-doc" disabled>Adjuntar certificado o foto <small class="prox-pill">Próximamente</small></button>' : '<button type="button" class="btn-secundario" id="lib-doc">Adjuntar certificado o foto (Buzón documental)</button>'}</div>`;
  };
  const pintar = (m) => {
    bloque.hidden = false;
    bloque.innerHTML = `<h3>Datos del cliente</h3>
    <form class="ficha-contacto" id="ficha-contacto"><label>Teléfono<input id="fc-t" type="tel" inputmode="tel" maxlength="25" value="${esc(c.telefono || '')}" placeholder="Ej. 261 555 1234"></label><label>Correo<input id="fc-e" type="email" maxlength="80" value="${esc(c.email_contacto || '')}" placeholder="Opcional"></label><button class="btn-secundario" type="submit">Guardar datos</button>${tel.length >= 6 ? `<a class="btn-secundario" href="tel:${esc(tel)}" style="text-decoration:none;display:inline-flex;align-items:center">Llamar</a>` : ''}</form>
    <div class="ficha-fila"><span>Responsable</span><b>${esc(nombreFicha)}</b></div>
    ${pers.length ? `<div class="ficha-fila"><span>Familiares y otros</span><div class="ficha-chips">${pers.map((x, i) => `<span class="ficha-chip">${esc(x.nombre)}${x.relacion ? ' · ' + esc(x.relacion) : ''}<button data-p="${i}" aria-label="Quitar ${esc(x.nombre)}">×</button></span>`).join('')}</div></div>` : ''}
    <form class="ficha-alta" id="ficha-fam"><input id="ff-n" placeholder="Agregar familiar u otra persona" maxlength="60" required><select id="ff-r">${['Esposo/a','Pareja','Hijo/a','Padre / madre','Hermano/a','Primo/a','Otro familiar','Vecino/a','Amigo/a','Otra relación'].map(r => `<option>${r}</option>`).join('')}</select><button class="btn-secundario" type="submit">+ Agregar</button></form>
    ${masc ? `<div class="ficha-fila"><span>Mascotas</span><div class="ficha-chips">${m.length ? m.map((x, i) => `<span class="ficha-chip"${abierta === i ? ' data-sel="1"' : ''}><button class="ficha-nom" data-l="${i}" title="Abrir libreta sanitaria">${esc(x.nombre)}${x.tipo ? ' · ' + esc(x.tipo) : ''}${estadoLib(x).vencidas.length ? ' ⚠' : ''}</button><button data-q="${i}" aria-label="Quitar ${esc(x.nombre)}">×</button></span>`).join('') : '<i>ninguna cargada</i>'}</div></div>
    <form class="ficha-alta" id="ficha-masc"><input id="fm-n" placeholder="Nombre de la mascota" maxlength="60" required><select id="fm-t"><option>Perro</option><option>Gato</option><option>Otro</option></select><button class="btn-secundario" type="submit">+ Agregar</button></form>
    ${abierta !== null && m[abierta] ? libretaHTML(m[abierta]) : ''}
    <a class="btn-secundario" style="text-decoration:none;display:inline-flex;align-items:center;margin-top:8px" href="turnos/panel.html?cliente=${encodeURIComponent(id)}">Ver turnos de este cliente</a>` : ''}`;
    bloque.querySelector('#ficha-contacto').onsubmit = async (ev) => { ev.preventDefault(); const t = bloque.querySelector('#fc-t').value.trim(), e = bloque.querySelector('#fc-e').value.trim().toLowerCase(); try { await updateDoc(doc(D().db, 'clients', id), { telefono: t, email_contacto: e }); c.telefono = t; c.email_contacto = e; pintar(m); D().aviso && D().aviso('Datos guardados.', 'ok'); } catch (x) { D().aviso && D().aviso('No se pudieron guardar los datos.', 'error'); } };
    bloque.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => { const x = pers[+b.dataset.p]; try { await updateDoc(doc(D().db, 'clients', id), { personas: arrayRemove(x) }); pers = pers.filter((_, i) => i !== +b.dataset.p); c.personas = pers; pintar(m); } catch (e) { D().aviso && D().aviso('No se pudo quitar.', 'error'); } });
    bloque.querySelector('#ficha-fam').onsubmit = async (ev) => { ev.preventDefault(); const n = bloque.querySelector('#ff-n').value.trim(); if (!n) return; const nueva = { nombre: n, relacion: bloque.querySelector('#ff-r').value, telefono: '' }; try { await updateDoc(doc(D().db, 'clients', id), { personas: arrayUnion(nueva) }); pers = [...pers, nueva]; c.personas = pers; pintar(m); } catch (e) { D().aviso && D().aviso('No se pudo guardar.', 'error'); } };
    bloque.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { abierta = abierta === +b.dataset.l ? null : +b.dataset.l; pintar(m); });
    const lf = bloque.querySelector('#lib-form');
    if (lf) {
      lf.onsubmit = async (ev) => { ev.preventDefault(); const f = bloque.querySelector('#lb-f').value; if (!f) return; const reg = { id: 'r' + Date.now().toString(36), tipo: bloque.querySelector('#lb-t').value, fecha: f, detalle: bloque.querySelector('#lb-d').value.trim(), proxima: bloque.querySelector('#lb-p').value || '' }; const nueva = m.map((x, i) => i === abierta ? { ...x, libreta: [...(x.libreta || []), reg] } : x); try { await guardarMasc(nueva); m = nueva; ctl = reg.proxima ? reg : null; pintar(m); } catch (e) { D().aviso && D().aviso('No se pudo guardar el registro.', 'error'); } };
      bloque.querySelectorAll('[data-le]').forEach(b => b.onclick = async () => { const nueva = m.map((x, i) => i === abierta ? { ...x, libreta: (x.libreta || []).filter((e) => e.id !== b.dataset.le) } : x); try { await guardarMasc(nueva); m = nueva; pintar(m); } catch (e) { D().aviso && D().aviso('No se pudo quitar.', 'error'); } });
      const ics = bloque.querySelector('#lib-ics'), no = bloque.querySelector('#lib-no');
      if (no) no.onclick = () => { ctl = null; pintar(m); };
      if (ics) ics.onclick = () => {
        const f = ctl.proxima.replace(/-/g, ''), sig = (() => { const d = new Date(ctl.proxima + 'T12:00:00'); d.setDate(d.getDate() + 1); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; })();
        const tx = `Control de ${m[abierta].nombre}: ${ctl.tipo} (${nombreFicha})`, esc2 = (s) => String(s).replace(/[\\;,]/g, '\\$&');
        const cuerpo = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The DOM Studio Web//DOMino//ES', 'BEGIN:VEVENT', `UID:${ctl.id}@domino`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${f}`, `DTEND;VALUE=DATE:${sig}`, `SUMMARY:${esc2(tx)}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc2(tx)}`, 'TRIGGER:-P7D', 'END:VALARM', 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc2(tx)}`, 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([cuerpo], { type: 'text/calendar' })); a.download = 'control-' + m[abierta].nombre.replace(/\W+/g, '_') + '.ics'; document.body.appendChild(a); a.click(); a.remove();
      };
      bloque.querySelector('#lib-doc').onclick = () => { if (window.abrirBuzon) window.abrirBuzon(); };
    }
    const f = bloque.querySelector('#ficha-masc');
    if (f) f.onsubmit = async (ev) => { ev.preventDefault(); const n = bloque.querySelector('#fm-n').value.trim(); if (!n) return; const nueva = { nombre: n, tipo: bloque.querySelector('#fm-t').value }; try { const lista = [...m, nueva]; await guardarMasc(lista); m = lista; pintar(m); } catch (e) { D().aviso && D().aviso('No se pudo guardar la mascota.', 'error'); } };
    bloque.querySelectorAll('[data-q]').forEach(b => b.onclick = async () => { const x = m[+b.dataset.q]; try { const lista = m.filter((_, i) => i !== +b.dataset.q); await guardarMasc(lista); m = lista; abierta = null; pintar(m); } catch (e) { D().aviso && D().aviso('No se pudo quitar la mascota.', 'error'); } });
  };
  pintar(c.mascotas || []);
};
