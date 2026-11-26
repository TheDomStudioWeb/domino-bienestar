// DOMino Bienestar · Módulo exclusivo ODONTOLOGÍA (etapa 4a: órdenes de trabajo al laboratorio).
// Cada orden (corona, prótesis, placa…) queda en negocios/{id}/laboratorio/{id} con su seguimiento de estados y el costo del laboratorio.
// Los archivos van a una carpeta en el Drive DEL CONSULTORIO (su propio script) que se comparte solo con el mail del laboratorio:
// el laboratorio no necesita usar la app. Las órdenes no se borran: se anulan.
// Laboratorios del centro: negocios/{id}/config/odonto_labs (solo Dirección).
import { getDoc, getDocs, setDoc, updateDoc, addDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { collection, doc } from "./tenant.js";

const D = () => window.DOMINO, $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const habilitado = () => !!(D() && D().negocioDoc && D().negocioDoc.modulos && D().negocioDoc.modulos.odontologia);
const esPersonal = () => ['senior', 'midsenior', 'asistente'].includes(window.rolActual);
const esProfesional = () => ['senior', 'midsenior'].includes(window.rolActual);
const esDireccion = () => window.rolActual === 'senior';
const yo = () => String((D().auth && D().auth.currentUser && D().auth.currentUser.email) || D().email || '').toLowerCase();
const $$ = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-AR');
const num = (v) => { const n = Number(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const ms = (t) => t && t.toMillis ? t.toMillis() : (t ? new Date(t).getTime() : 0);
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dia = (iso) => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—';
const MAX = 25 * 1024 * 1024;

const ESTADOS = { preparando: 'En preparación', enviado: 'En el laboratorio', prueba: 'Prueba en boca', listo: 'Llegó terminado', colocado: 'Entregado al paciente', anulado: 'Anulada' };
const ABIERTOS = ['preparando', 'enviado', 'prueba', 'listo'];
const TRABAJOS = ['Corona', 'Puente', 'Corona sobre implante', 'Incrustación', 'Carilla', 'Perno muñón', 'Prótesis parcial removible', 'Prótesis completa', 'Compostura / reparación', 'Placa miorrelajante', 'Placa de blanqueamiento', 'Aparato de ortodoncia', 'Modelo de estudio'];
const MATERIALES = ['Zirconio', 'Disilicato de litio', 'Metal-cerámica', 'Acrílico', 'Composite', 'Cromo-cobalto', 'Resina impresa'];
const COLORES = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4', 'BL1', 'BL2'];
const EXT_OK = /\.(jpe?g|png|webp|gif|bmp|tiff?|pdf|stl|ply|obj|zip)$/i;

let P = null, LABS = null, PROFES = null, URL_DRIVE = null;

async function cargarLabs() {
  if (LABS) return LABS;
  try { const s = await getDoc(doc(D().db, 'config', 'odonto_labs')); LABS = s.exists() ? (s.data().labs || []) : []; } catch (e) { LABS = []; }
  return LABS;
}
async function cargarProfes() {
  if (PROFES) return PROFES;
  try {
    const s = await getDocs(query(collection(D().db, 'users'), where('negocio_id', '==', window.DOMINO_NID || D().nid)));
    PROFES = s.docs.map((d) => d.data()).filter((u) => u.activo !== false && ['senior', 'midsenior'].includes(u.rol_jerarquia)).map((u) => ({ email: String(u.email || '').toLowerCase(), nombre: u.nombre_display || u.email }));
  } catch (e) { PROFES = []; }
  if (!PROFES.length && esProfesional()) PROFES = [{ email: yo(), nombre: window.nombreDisplay || yo() }];
  return PROFES;
}
const profeNombre = (email) => ((PROFES || []).find((p) => p.email === email) || {}).nombre || email || '—';
async function urlDrive() {
  if (URL_DRIVE !== null) return URL_DRIVE;
  try { const s = await getDoc(doc(D().db, 'config', 'odonto')); URL_DRIVE = s.exists() ? String(s.data().drive_url || '') : ''; } catch (e) { URL_DRIVE = ''; }
  return URL_DRIVE;
}
async function llamar(accion, extra) {
  const url = await urlDrive(); if (!url) throw new Error('sin_drive');
  const token = await D().auth.currentUser.getIdToken();
  const r = await fetch(url, { method: 'POST', body: JSON.stringify(Object.assign({ accion, token, nid: window.DOMINO_NID || D().nid }, extra || {})) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'error');
  return j;
}
const aBase64 = (blob) => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = mal; r.readAsDataURL(blob); });
const errTxt = (e) => {
  const m = String(e && (e.message || e.code) || e);
  if (/sin_drive/.test(m)) return 'Falta conectar el Drive del consultorio (lo hace la Dirección en Historia clínica → Imágenes).';
  if (/sin_permiso|permission/i.test(m)) return 'Sin permiso: el módulo Odontología tiene que estar activo y su usuario en este centro.';
  if (/muy_grande/.test(m)) return 'El archivo supera los 25 MB.';
  if (/tipo_no_permitido/.test(m)) return 'Tipo de archivo no permitido: imágenes, PDF, STL, PLY, OBJ o ZIP.';
  if (/sin_configurar|otro_centro/.test(m)) return 'El Drive conectado no corresponde a este consultorio. Avise a The DOM.';
  if (/accion_desconocida/.test(m)) return 'El script del consultorio está desactualizado: hay que pegar la versión nueva (avise a The DOM).';
  return 'No se pudo completar. Revise su conexión e intente de nuevo.';
};
const telWa = (t) => { const d = String(t || '').replace(/\D/g, ''); return d ? (d.startsWith('54') ? d : '549' + d.replace(/^0/, '')) : ''; };

// ── Caja (reusa los estilos del módulo de historia clínica) ─────────────────
function cerrar() { const f = $('ol-fondo'); if (f) f.remove(); document.body.style.overflow = ''; }
function caja() {
  if (window.odEstilos) window.odEstilos();
  cerrar();
  const f = document.createElement('div'); f.id = 'ol-fondo'; f.className = 'od-fondo'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-labelledby', 'ol-t');
  f.innerHTML = '<div class="od-caja" id="ol-caja"></div>';
  document.body.appendChild(f); document.body.style.overflow = 'hidden';
  f.addEventListener('click', (e) => { if (e.target === f) cerrar(); });
  f.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
  if (!$('ol-css')) {
    const s = document.createElement('style'); s.id = 'ol-css';
    s.textContent = `.ol-chip{display:inline-block;font-size:.75rem;padding:2px 8px;border-radius:999px;border:1px solid var(--line,#2a2d33);margin-left:6px}
    .ol-chip.enviado{border-color:#3b82f6;color:#bcd5ff}.ol-chip.prueba{border-color:#d4af37;color:#e8c766}.ol-chip.listo{border-color:#4cc38a;color:#9ff0c4}.ol-chip.colocado{opacity:.75}.ol-chip.anulado{opacity:.55}
    .ol-tarde{color:#ffb3b5;font-weight:600}.ol-h{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:18px 0 6px}.ol-h h3{margin:0;font-size:1.05rem}
    .ol-arch{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.ol-arch span{font-size:.82rem;border:1px solid var(--line,#2a2d33);border-radius:4px;padding:4px 8px;display:inline-flex;gap:6px;align-items:center}
    .ol-arch button{background:none;border:0;color:inherit;cursor:pointer;font-size:.9rem;padding:0 2px}
    .ol-im{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-top:8px}.ol-im label{border:1px solid var(--line,#2a2d33);border-radius:6px;overflow:hidden;cursor:pointer;font-size:.75rem;position:relative}
    .ol-im img,.ol-im .ol-pdf{display:block;width:100%;height:72px;object-fit:cover;background:#000}.ol-im .ol-pdf{display:flex;align-items:center;justify-content:center;font-size:1.4rem}.ol-im span{display:block;padding:4px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ol-im input{position:absolute;top:6px;left:6px;width:18px;height:18px}.ol-hist{margin:8px 0 0;padding-left:18px;font-size:.85rem;color:var(--text-muted,#a8a396)}
    .ol-tabla{width:100%;border-collapse:collapse;margin-top:8px;font-size:.92rem}.ol-tabla td,.ol-tabla th{padding:7px 6px;border-bottom:1px solid var(--line,#2a2d33);text-align:left}.ol-tabla td.n{text-align:right;white-space:nowrap}`;
    document.head.appendChild(s);
  }
}
const cabecera = (t, sub) => `<button type="button" class="od-x" id="ol-x" aria-label="Cerrar">✕</button><h2 id="ol-t">${esc(t)}</h2><p class="od-sub">${esc(sub || '')}</p>`;
const enlazarX = () => { $('ol-x').onclick = cerrar; };
const tarde = (o) => ['preparando', 'enviado', 'prueba'].includes(o.estado) && o.entrega && o.entrega < hoyISO();
const resumenOrden = (o) => `${esc(o.trabajo || 'Trabajo')}${o.piezas ? ' · pieza ' + esc(o.piezas) : ''} · ${esc(o.lab_nombre || 'sin laboratorio')}`;

// ── Órdenes del paciente ────────────────────────────────────────────────────
async function abrir(id, nombre) {
  if (!habilitado() || !esPersonal()) return;
  P = { id, nombre, ordenes: [] };
  caja(); $('ol-caja').innerHTML = cabecera('Laboratorio', nombre) + '<p>Cargando…</p>'; enlazarX();
  try {
    const [s] = await Promise.all([getDocs(query(collection(D().db, 'laboratorio'), where('socio_id', '==', id))), cargarLabs(), cargarProfes(), urlDrive()]);
    P.ordenes = s.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => ms(b.creado) - ms(a.creado));
    vista();
  } catch (e) { console.error(e); $('ol-caja').innerHTML = cabecera('Laboratorio', nombre) + `<p class="od-err">${esc(errTxt(e))}</p>`; enlazarX(); }
}
function tarjeta(o, conPaciente) {
  return `<div class="od-ev"><div class="meta">${conPaciente ? '<b>' + esc(o.socio_nombre) + '</b> · ' : ''}Pedida ${esc(dia(o.creado_dia))}<span class="ol-chip ${esc(o.estado)}">${esc(ESTADOS[o.estado] || o.estado)}</span></div>
    <div>${resumenOrden(o)}</div>
    <div class="od-fila" style="justify-content:space-between;margin-top:4px"><span class="${tarde(o) ? 'ol-tarde' : 'od-sub'}">${o.entrega ? (tarde(o) ? 'Atrasada · entrega ' : 'Entrega ') + esc(dia(o.entrega)) : 'Sin fecha de entrega'}</span><button type="button" class="od-btn sec" data-ver="${esc(o.id)}" style="padding:7px 12px">Ver</button></div></div>`;
}
function vista() {
  $('ol-caja').innerHTML = cabecera('Laboratorio', P.nombre) + `
    <div class="ol-h"><h3>Órdenes de trabajo</h3><button type="button" class="od-btn" id="ol-nueva">+ Nueva orden</button></div>
    ${P.ordenes.length ? P.ordenes.map((o) => tarjeta(o, false)).join('') : '<p class="od-sub">Este paciente no tiene trabajos de laboratorio.</p>'}
    <div class="od-fila fin" style="margin-top:18px"><button type="button" class="od-btn sec" id="ol-abiertas">Todas las órdenes abiertas</button>${esDireccion() ? '<button type="button" class="od-btn sec" id="ol-labs">Laboratorios</button><button type="button" class="od-btn sec" id="ol-cuenta">Cuenta con laboratorios</button>' : ''}</div>
    <div id="od-msg"></div>`;
  enlazarX();
  $('ol-nueva').onclick = () => editor(null);
  $('ol-abiertas').onclick = abiertas;
  if ($('ol-labs')) $('ol-labs').onclick = () => labs(vista);
  if ($('ol-cuenta')) $('ol-cuenta').onclick = cuenta;
  $('ol-caja').querySelectorAll('[data-ver]').forEach((b) => b.onclick = () => editor(P.ordenes.find((o) => o.id === b.dataset.ver)));
}

// ── Editor de la orden ──────────────────────────────────────────────────────
function editor(orden, volver) {
  const atras = volver || vista;
  const O = orden ? JSON.parse(JSON.stringify(orden)) : { estado: 'preparando', profesional: esProfesional() ? yo() : ((PROFES[0] || {}).email || ''), archivos: [], historial: [] };
  const cola = [], elegidas = new Set(); // archivos nuevos a subir y radiografías del paciente a copiar
  const abierta = ABIERTOS.includes(O.estado);
  const editable = O.estado === 'preparando';
  let fotos = null;
  const leer = () => {
    if (!editable) return;
    const l = (LABS || [])[Number($('ol-lab').value)];
    if (l) { O.lab_nombre = l.nombre; O.lab_email = String(l.email || '').toLowerCase(); O.lab_tel = l.tel || ''; }
    ['trabajo', 'piezas', 'color', 'material', 'indicaciones'].forEach((k) => { O[k] = $('ol-' + k).value.trim(); });
    O.entrega = $('ol-entrega').value; O.costo = num($('ol-costo').value); O.profesional = $('ol-prof').value;
  };
  const pintar = (aviso) => {
    const labIdx = (LABS || []).findIndex((l) => String(l.email || '').toLowerCase() === O.lab_email && l.nombre === O.lab_nombre);
    const dis = editable ? '' : 'disabled';
    $('ol-caja').innerHTML = cabecera(orden ? 'Orden de laboratorio' : 'Nueva orden de laboratorio', P.nombre) + `
      ${orden ? `<p style="margin:0 0 8px"><span class="ol-chip ${esc(O.estado)}" style="margin:0">${esc(ESTADOS[O.estado])}</span>${tarde(O) ? ' <span class="ol-tarde">· Atrasada</span>' : ''}</p>` : ''}
      ${!(LABS || []).length && editable ? `<p class="od-pend">Todavía no hay laboratorios cargados.${esDireccion() ? ' Cárguelos en «Laboratorios».' : ' Pídale a la Dirección que los cargue.'}</p>` : ''}
      <datalist id="ol-tr">${TRABAJOS.map((t) => `<option value="${esc(t)}">`).join('')}</datalist><datalist id="ol-ma">${MATERIALES.map((t) => `<option value="${esc(t)}">`).join('')}</datalist><datalist id="ol-co">${COLORES.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
      <div class="od-grid">
        <div><label class="od-l" for="ol-lab">Laboratorio</label><select class="od-in" id="ol-lab" ${dis}>${editable ? '<option value="">Elegir…</option>' : ''}${(LABS || []).map((l, i) => `<option value="${i}" ${i === labIdx ? 'selected' : ''}>${esc(l.nombre)}</option>`).join('')}${labIdx < 0 && O.lab_nombre ? `<option selected>${esc(O.lab_nombre)}</option>` : ''}</select></div>
        <div><label class="od-l" for="ol-prof">Profesional</label><select class="od-in" id="ol-prof" ${dis}>${(PROFES || []).map((p) => `<option value="${esc(p.email)}" ${p.email === O.profesional ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></div>
        <div><label class="od-l" for="ol-trabajo">Trabajo</label><input class="od-in" id="ol-trabajo" list="ol-tr" value="${esc(O.trabajo)}" placeholder="Ej.: Corona" ${dis}></div>
        <div><label class="od-l" for="ol-piezas">Pieza/s</label><input class="od-in" id="ol-piezas" value="${esc(O.piezas)}" placeholder="Ej.: 11, 21" ${dis}></div>
        <div><label class="od-l" for="ol-color">Color</label><input class="od-in" id="ol-color" list="ol-co" value="${esc(O.color)}" placeholder="Ej.: A2" ${dis}></div>
        <div><label class="od-l" for="ol-material">Material</label><input class="od-in" id="ol-material" list="ol-ma" value="${esc(O.material)}" ${dis}></div>
        <div><label class="od-l" for="ol-entrega">Entrega pedida</label><input class="od-in" type="date" id="ol-entrega" value="${esc(O.entrega)}" min="${hoyISO()}" ${dis}></div>
        <div><label class="od-l" for="ol-costo">Costo del laboratorio</label><input class="od-in" id="ol-costo" inputmode="decimal" value="${esc(O.costo || '')}" placeholder="$" ${dis}></div>
      </div>
      <label class="od-l" for="ol-indicaciones">Indicaciones para el laboratorio</label><textarea class="od-in" id="ol-indicaciones" maxlength="2000" ${dis}>${esc(O.indicaciones)}</textarea>
      <div class="ol-h"><h3>Archivos</h3>${O.carpeta_url ? `<a class="od-btn sec" style="padding:7px 12px;text-decoration:none" href="${esc(O.carpeta_url)}" target="_blank" rel="noopener">Abrir carpeta</a>` : ''}</div>
      ${(O.archivos || []).length ? `<div class="ol-arch">${O.archivos.map((a) => `<span>📎 ${esc(a.nombre)}</span>`).join('')}</div>` : ''}
      ${cola.length || elegidas.size ? `<div class="ol-arch">${cola.map((f, i) => `<span>⬆ ${esc(f.name)} <button type="button" data-qc="${i}" aria-label="Quitar ${esc(f.name)}">✕</button></span>`).join('')}${[...elegidas].map((id) => { const a = (fotos || []).find((x) => x.id === id); return a ? `<span>🦷 ${esc(a.nombre)} <button type="button" data-qe="${esc(id)}" aria-label="Quitar ${esc(a.nombre)}">✕</button></span>` : ''; }).join('')}</div><p class="od-sub">${O.estado === 'preparando' ? 'Se suben al enviar la orden.' : 'Toque «Subir archivos» para mandarlos a la carpeta.'}</p>` : ''}
      ${abierta ? (URL_DRIVE ? `<div class="od-fila" style="margin-top:8px"><label class="od-btn sec" style="padding:8px 12px;cursor:pointer">+ Archivo del dispositivo<input type="file" id="ol-file" multiple accept="image/*,.pdf,.stl,.ply,.obj,.zip" hidden></label>${esProfesional() ? '<button type="button" class="od-btn sec" id="ol-fotos" style="padding:8px 12px">+ De las imágenes del paciente</button>' : ''}${O.estado !== 'preparando' && (cola.length || elegidas.size) ? '<button type="button" class="od-btn" id="ol-subir" style="padding:8px 12px">Subir archivos</button>' : ''}</div><p class="od-sub">Fotos, radiografías, PDF o escaneos (STL, PLY, OBJ, ZIP), hasta 25 MB cada uno. Los escaneos más pesados se mandan desde el programa del escáner.</p>` : '<p class="od-pend">Para mandar archivos falta conectar el Drive del consultorio (la Dirección lo hace en Historia clínica → Imágenes). La orden se puede enviar igual, sin archivos.</p>') : ''}
      <div id="ol-galeria"></div>
      ${(O.historial || []).length ? `<div class="ol-h"><h3>Seguimiento</h3></div><ul class="ol-hist">${O.historial.map((h) => `<li>${esc(dia(h.fecha))} · ${esc(ESTADOS[h.estado] || h.estado)}${h.nota ? ' · ' + esc(h.nota) : ''} · ${esc(profeNombre(h.por))}</li>`).join('')}</ul>` : ''}
      ${O.costo ? `<p class="od-sub">Costo del laboratorio: ${$$(O.costo)}${O.pagado_lab ? ' · pagado' : ' · pendiente de pago'}</p>` : ''}
      <div class="od-fila fin">
        <button type="button" class="od-btn sec" id="ol-volver">Volver</button>
        ${editable ? '<button type="button" class="od-btn sec" id="ol-guardar">Guardar</button><button type="button" class="od-btn" id="ol-enviar">Enviar al laboratorio</button>' : ''}
        ${['enviado', 'prueba'].includes(O.estado) ? '<button type="button" class="od-btn sec" data-est="prueba">Volvió para prueba</button><button type="button" class="od-btn" data-est="listo">Llegó terminado</button>' : ''}
        ${O.estado === 'prueba' ? '<button type="button" class="od-btn sec" data-est="enviado">Volvió al laboratorio</button>' : ''}
        ${O.estado === 'listo' ? '<button type="button" class="od-btn" data-est="colocado">Entregado al paciente</button>' : ''}
      </div>
      ${orden && O.estado !== 'preparando' && O.estado !== 'anulado' ? `<div class="od-fila fin" style="margin-top:8px"><button type="button" class="od-btn sec" id="ol-wa" style="padding:7px 12px">Avisar por WhatsApp</button><button type="button" class="od-btn sec" id="ol-mail" style="padding:7px 12px">Avisar por mail</button></div>` : ''}
      ${orden && abierta ? '<div class="od-fila fin" style="margin-top:8px"><button type="button" class="od-btn sec" id="ol-anular" style="padding:7px 12px">Anular orden</button></div>' : ''}
      <div id="od-msg">${aviso || ''}</div>`;
    enlazarX();
    $('ol-volver').onclick = atras;
    const f = $('ol-file');
    if (f) f.onchange = () => {
      leer(); const malos = [];
      [...f.files].forEach((x) => { if (x.size > MAX || !(EXT_OK.test(x.name) || /^image\//.test(x.type))) malos.push(x.name); else cola.push(x); });
      pintar(malos.length ? `<p class="od-err">No se agregó: ${esc(malos.join(', '))} (más de 25 MB o tipo no permitido).</p>` : '');
    };
    $('ol-caja').querySelectorAll('[data-qc]').forEach((b) => b.onclick = () => { leer(); cola.splice(Number(b.dataset.qc), 1); pintar(); });
    $('ol-caja').querySelectorAll('[data-qe]').forEach((b) => b.onclick = () => { leer(); elegidas.delete(b.dataset.qe); pintar(); });
    if ($('ol-fotos')) $('ol-fotos').onclick = async () => {
      leer();
      const g = $('ol-galeria'); g.innerHTML = '<p class="od-sub">Cargando imágenes…</p>';
      try {
        if (!fotos) { const s = await getDocs(collection(D().db, 'clinica', P.id, 'archivos')); fotos = s.docs.map((d) => Object.assign({ id: d.id }, d.data())).filter((a) => !a.oculto && a.drive_id).sort((a, b) => ms(b.fecha) - ms(a.fecha)); }
        if (!fotos.length) { g.innerHTML = '<p class="od-sub">El paciente no tiene radiografías ni fotos cargadas.</p>'; return; }
        g.innerHTML = `<div class="ol-im">${fotos.map((a) => `<label>${a.thumb ? `<img src="${esc(a.thumb)}" alt="">` : '<div class="ol-pdf">📄</div>'}<input type="checkbox" data-el="${esc(a.id)}" ${elegidas.has(a.id) ? 'checked' : ''} aria-label="${esc(a.nombre)}"><span>${esc(a.nombre)}</span></label>`).join('')}</div><div class="od-fila fin"><button type="button" class="od-btn sec" id="ol-elok" style="padding:7px 12px">Listo</button></div>`;
        $('ol-elok').onclick = () => { g.querySelectorAll('[data-el]').forEach((c) => { if (c.checked) elegidas.add(c.dataset.el); else elegidas.delete(c.dataset.el); }); pintar(); };
      } catch (e) { console.error(e); g.innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
    };
    const bloquear = (si) => $('ol-caja').querySelectorAll('.od-btn').forEach((b) => { if (b.tagName === 'BUTTON') b.disabled = si; });
    const guardarDoc = async (cambios) => {
      const datos = Object.assign({}, cambios, { actualizado: serverTimestamp(), actualizado_por: yo() });
      if (O.id) await updateDoc(doc(D().db, 'laboratorio', O.id), datos);
      else {
        Object.assign(datos, { socio_id: P.id, socio_nombre: P.nombre, creado: serverTimestamp(), creado_dia: hoyISO(), creado_por: yo(), pagado_lab: false });
        const r = await addDoc(collection(D().db, 'laboratorio'), datos); O.id = r.id; O.creado_dia = datos.creado_dia; O.socio_id = P.id; O.socio_nombre = P.nombre;
      }
      Object.assign(O, cambios);
      const local = Object.assign({}, O, { creado: O.creado || new Date() });
      P.ordenes = [local].concat(P.ordenes.filter((x) => x.id !== O.id)).sort((a, b) => ms(b.creado) - ms(a.creado));
    };
    const camposOrden = () => ({ lab_nombre: O.lab_nombre || '', lab_email: O.lab_email || '', lab_tel: O.lab_tel || '', trabajo: O.trabajo || '', piezas: O.piezas || '', color: O.color || '', material: O.material || '', entrega: O.entrega || '', costo: num(O.costo), indicaciones: O.indicaciones || '', profesional: O.profesional || '', estado: O.estado });
    // Sube a la carpeta del laboratorio lo que esté en cola y copia las imágenes elegidas del paciente.
    const subirTodo = async () => {
      const nuevos = [];
      for (const file of cola) {
        $('od-msg').innerHTML = `<p class="od-pend">Subiendo ${esc(file.name)}…</p>`;
        const r = await llamar('orden_subir', { oid: O.id, cid: P.id, carpeta: O.carpeta_id, nombre: file.name, mime: file.type || 'application/octet-stream', datos: await aBase64(file) });
        nuevos.push({ nombre: file.name, id: r.id });
      }
      for (const id of elegidas) {
        const a = (fotos || []).find((x) => x.id === id); if (!a) continue;
        $('od-msg').innerHTML = `<p class="od-pend">Copiando ${esc(a.nombre)}…</p>`;
        const r = await llamar('orden_copiar', { oid: O.id, cid: P.id, carpeta: O.carpeta_id, id: a.drive_id, nombre: a.nombre });
        nuevos.push({ nombre: r.nombre || a.nombre, id: r.id });
      }
      cola.length = 0; elegidas.clear();
      return nuevos;
    };
    if ($('ol-guardar')) $('ol-guardar').onclick = async () => {
      leer(); bloquear(true);
      try { await guardarDoc(camposOrden()); orden = O; pintar('<p class="od-ok">Orden guardada (todavía no se envió).</p>'); }
      catch (e) { console.error(e); bloquear(false); $('od-msg').innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
    };
    if ($('ol-enviar')) $('ol-enviar').onclick = async () => {
      leer();
      if (!O.lab_nombre) { $('od-msg').innerHTML = '<p class="od-err">Elija el laboratorio.</p>'; return; }
      if (!O.trabajo) { $('od-msg').innerHTML = '<p class="od-err">Escriba qué trabajo se pide.</p>'; return; }
      bloquear(true);
      let aviso = '';
      try {
        await guardarDoc(camposOrden()); orden = O;
        if (URL_DRIVE) {
          $('od-msg').innerHTML = '<p class="od-pend">Creando la carpeta del laboratorio…</p>';
          const c = await llamar('orden_carpeta', { oid: O.id, cid: P.id });
          O.carpeta_id = c.id; O.carpeta_url = c.url;
          if (!c.compartida) aviso = '<p class="od-err">La carpeta se creó, pero no se pudo compartir con el mail del laboratorio (tiene que ser una cuenta de Google). Mande los archivos por WhatsApp o pídale un Gmail al laboratorio.</p>';
          O.archivos = (O.archivos || []).concat(await subirTodo());
        }
        const historial = (O.historial || []).concat([{ estado: 'enviado', fecha: hoyISO(), por: yo() }]);
        await guardarDoc({ estado: 'enviado', enviado_dia: hoyISO(), historial, carpeta_id: O.carpeta_id || '', carpeta_url: O.carpeta_url || '', archivos: O.archivos || [] });
        O.historial = historial;
        editor(O, atras);
        $('od-msg').innerHTML = aviso + '<p class="od-ok">Orden enviada. Avísele al laboratorio con los botones de abajo: el mensaje ya lleva los datos y el enlace a la carpeta.</p>';
      } catch (e) { console.error(e); bloquear(false); $('od-msg').innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
    };
    if ($('ol-subir')) $('ol-subir').onclick = async () => {
      bloquear(true);
      try {
        if (!O.carpeta_id) { const c = await llamar('orden_carpeta', { oid: O.id, cid: P.id }); O.carpeta_id = c.id; O.carpeta_url = c.url; }
        const archivos = (O.archivos || []).concat(await subirTodo());
        await guardarDoc({ archivos, carpeta_id: O.carpeta_id, carpeta_url: O.carpeta_url });
        pintar('<p class="od-ok">Archivos subidos a la carpeta del laboratorio.</p>');
      } catch (e) { console.error(e); bloquear(false); $('od-msg').innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
    };
    $('ol-caja').querySelectorAll('[data-est]').forEach((b) => b.onclick = async () => {
      const est = b.dataset.est;
      const nota = est === 'prueba' || est === 'enviado' ? (prompt(est === 'prueba' ? 'Nota de la prueba (opcional):' : '¿Qué se le pidió corregir al laboratorio? (opcional)') ?? null) : '';
      if (nota === null) return;
      bloquear(true);
      try {
        const historial = (O.historial || []).concat([{ estado: est, fecha: hoyISO(), por: yo(), nota: String(nota || '').trim() }]);
        await guardarDoc({ estado: est, historial }); O.historial = historial;
        editor(O, atras); $('od-msg').innerHTML = `<p class="od-ok">${esc(ESTADOS[est])}.</p>`;
      } catch (e) { console.error(e); bloquear(false); $('od-msg').innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
    });
    if ($('ol-anular')) $('ol-anular').onclick = async () => {
      const motivo = prompt('¿Anular esta orden? Escriba el motivo:'); if (motivo === null) return;
      if (!motivo.trim()) { alert('Escriba el motivo de la anulación.'); return; }
      bloquear(true);
      try {
        const historial = (O.historial || []).concat([{ estado: 'anulado', fecha: hoyISO(), por: yo(), nota: motivo.trim() }]);
        await guardarDoc({ estado: 'anulado', historial }); O.historial = historial;
        if (O.carpeta_id) await llamar('orden_cerrar', { oid: O.id, cid: P.id, carpeta: O.carpeta_id }).catch(() => {});
        editor(O, atras); $('od-msg').innerHTML = '<p class="od-ok">Orden anulada. El laboratorio ya no ve la carpeta.</p>';
      } catch (e) { console.error(e); bloquear(false); $('od-msg').innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
    };
    const texto = () => {
      const neg = (D().negocioDoc && D().negocioDoc.nombre) || 'el consultorio';
      return `Hola ${O.lab_nombre || ''}, les envío un trabajo de ${neg}:\n\nPaciente: ${P.nombre}\nTrabajo: ${O.trabajo || ''}` + (O.piezas ? `\nPieza/s: ${O.piezas}` : '') + (O.color ? `\nColor: ${O.color}` : '') + (O.material ? `\nMaterial: ${O.material}` : '') + (O.entrega ? `\nEntrega pedida: ${dia(O.entrega)}` : '') + (O.indicaciones ? `\nIndicaciones: ${O.indicaciones}` : '') + (O.carpeta_url ? `\n\nArchivos: ${O.carpeta_url}` : '') + `\n\nProfesional: ${profeNombre(O.profesional)}\nMuchas gracias.`;
    };
    if ($('ol-wa')) $('ol-wa').onclick = () => window.open('https://wa.me/' + telWa(O.lab_tel) + '?text=' + encodeURIComponent(texto()), '_blank', 'noopener');
    if ($('ol-mail')) $('ol-mail').onclick = () => { location.href = 'mailto:' + encodeURIComponent(O.lab_email || '') + '?subject=' + encodeURIComponent(`Trabajo ${O.trabajo || ''} · ${P.nombre}`) + '&body=' + encodeURIComponent(texto()); };
  };
  pintar();
}

// ── Todas las órdenes abiertas del centro ───────────────────────────────────
async function abiertas() {
  const base = P;
  $('ol-caja').innerHTML = cabecera('Órdenes abiertas', 'Todo el consultorio, primero las más urgentes') + '<p>Cargando…</p>'; enlazarX();
  try {
    const s = await getDocs(query(collection(D().db, 'laboratorio'), where('estado', 'in', ABIERTOS)));
    const L = s.docs.map((d) => Object.assign({ id: d.id }, d.data())).filter((o) => ABIERTOS.includes(o.estado)).sort((a, b) => (a.estado === 'listo') - (b.estado === 'listo') || String(a.entrega || '9999').localeCompare(String(b.entrega || '9999')));
    const atrasadas = L.filter(tarde).length;
    $('ol-caja').innerHTML = cabecera('Órdenes abiertas', 'Todo el consultorio, primero las más urgentes') + `
      ${atrasadas ? `<p class="ol-tarde">${atrasadas} orden${atrasadas === 1 ? ' atrasada' : 'es atrasadas'}: conviene llamar al laboratorio.</p>` : ''}
      ${L.length ? L.map((o) => tarjeta(o, true)).join('') : '<p class="od-sub">No hay trabajos pendientes en el laboratorio.</p>'}
      <div class="od-fila fin"><button type="button" class="od-btn sec" id="ol-volver">Volver</button></div>`;
    enlazarX(); $('ol-volver').onclick = () => { P = base; vista(); };
    $('ol-caja').querySelectorAll('[data-ver]').forEach((b) => b.onclick = () => {
      const o = L.find((x) => x.id === b.dataset.ver);
      P = { id: o.socio_id, nombre: o.socio_nombre, ordenes: base && base.id === o.socio_id ? base.ordenes : [o] };
      editor(o, abiertas);
    });
  } catch (e) { console.error(e); $('ol-caja').innerHTML += `<p class="od-err">${esc(errTxt(e))}</p>`; }
}

// ── Laboratorios del centro (Dirección) ─────────────────────────────────────
function labs(volver) {
  const L = (LABS || []).map((l) => Object.assign({}, l));
  if (!L.length) L.push({ nombre: '', email: '', tel: '', nota: '' });
  const pintar = (aviso) => {
    $('ol-caja').innerHTML = cabecera('Laboratorios', 'Con quiénes trabaja el consultorio') + `
      <div id="ol-ll">${L.map((l, i) => `<div class="od-ev" data-i="${i}"><div class="od-grid">
        <div><label class="od-l">Nombre</label><input class="od-in" data-k="nombre" value="${esc(l.nombre)}" placeholder="Ej.: Laboratorio Dental Andes"></div>
        <div><label class="od-l">Mail (cuenta de Google)</label><input class="od-in" type="email" data-k="email" value="${esc(l.email)}" placeholder="Para compartir la carpeta"></div>
        <div><label class="od-l">WhatsApp</label><input class="od-in" type="tel" data-k="tel" value="${esc(l.tel)}" placeholder="Ej.: 2615551234"></div>
        <div><label class="od-l">Nota interna</label><input class="od-in" data-k="nota" value="${esc(l.nota)}" placeholder="Ej.: retira los martes"></div></div>
        <div class="od-fila fin" style="margin-top:6px"><button type="button" class="od-btn sec" data-q="${i}" style="padding:6px 10px">Quitar</button></div></div>`).join('')}</div>
      <div class="od-fila" style="margin-top:8px"><button type="button" class="od-btn sec" id="ol-lmas" style="padding:8px 12px">+ Agregar laboratorio</button></div>
      <p class="od-pend">Para que el laboratorio pueda abrir la carpeta con los archivos, el mail tiene que ser de una cuenta de Google (Gmail o similar).</p>
      <div class="od-fila fin"><button type="button" class="od-btn sec" id="ol-volver">Volver</button><button type="button" class="od-btn" id="ol-lok">Guardar</button></div><div id="od-msg">${aviso || ''}</div>`;
    enlazarX();
    const leer = () => $('ol-ll').querySelectorAll('[data-i]').forEach((r) => { const l = L[Number(r.dataset.i)]; r.querySelectorAll('[data-k]').forEach((inp) => { l[inp.dataset.k] = inp.value.trim(); }); });
    $('ol-volver').onclick = volver;
    $('ol-lmas').onclick = () => { leer(); L.push({ nombre: '', email: '', tel: '', nota: '' }); pintar(); };
    $('ol-caja').querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { leer(); L.splice(Number(b.dataset.q), 1); pintar(); });
    $('ol-lok').onclick = async () => {
      leer();
      const lista = L.filter((l) => l.nombre).map((l) => ({ nombre: l.nombre, email: l.email.toLowerCase(), tel: l.tel, nota: l.nota }));
      const mal = lista.find((l) => l.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(l.email));
      if (mal) { $('od-msg').innerHTML = `<p class="od-err">Revise el mail de ${esc(mal.nombre)}.</p>`; return; }
      $('ol-lok').disabled = true;
      try { await setDoc(doc(D().db, 'config', 'odonto_labs'), { labs: lista, actualizado: serverTimestamp(), actualizado_por: yo() }); LABS = lista; pintar('<p class="od-ok">Laboratorios guardados.</p>'); }
      catch (e) { console.error(e); $('ol-lok').disabled = false; $('od-msg').innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
    };
  };
  pintar();
}

// ── Cuenta con laboratorios (Dirección): lo que se les debe ─────────────────
async function cuenta() {
  $('ol-caja').innerHTML = cabecera('Cuenta con laboratorios', 'Trabajos con costo pendiente de pago') + '<p>Cargando…</p>'; enlazarX();
  try {
    const s = await getDocs(query(collection(D().db, 'laboratorio'), where('pagado_lab', '==', false)));
    const L = s.docs.map((d) => Object.assign({ id: d.id }, d.data())).filter((o) => o.pagado_lab === false && o.estado !== 'anulado' && o.estado !== 'preparando' && num(o.costo) > 0);
    const por = {}; L.forEach((o) => { (por[o.lab_nombre || 'Sin laboratorio'] = por[o.lab_nombre || 'Sin laboratorio'] || []).push(o); });
    $('ol-caja').innerHTML = cabecera('Cuenta con laboratorios', 'Trabajos con costo pendiente de pago') + `
      ${Object.keys(por).length ? Object.entries(por).map(([lab, os]) => `<div class="ol-h"><h3>${esc(lab)}</h3><b>${$$(os.reduce((a, o) => a + num(o.costo), 0))}</b></div>
        <table class="ol-tabla"><tbody>${os.map((o) => `<tr><td>${esc(dia(o.enviado_dia || o.creado_dia))} · ${esc(o.socio_nombre)}<br><small class="od-sub">${esc(o.trabajo)}${o.piezas ? ' · ' + esc(o.piezas) : ''} · ${esc(ESTADOS[o.estado])}</small></td><td class="n">${$$(o.costo)}<br><button type="button" class="od-btn sec" data-pagar="${esc(o.id)}" style="padding:5px 10px;margin-top:4px">Pagado</button></td></tr>`).join('')}</tbody></table>`).join('') : '<p class="od-sub">No hay nada pendiente de pago a laboratorios.</p>'}
      <div class="od-fila fin"><button type="button" class="od-btn sec" id="ol-volver">Volver</button></div><div id="od-msg"></div>`;
    enlazarX(); $('ol-volver').onclick = vista;
    $('ol-caja').querySelectorAll('[data-pagar]').forEach((b) => b.onclick = async () => {
      const o = L.find((x) => x.id === b.dataset.pagar);
      if (!confirm(`¿Marcar como pagado el trabajo de ${o.socio_nombre} (${$$(o.costo)})?`)) return;
      b.disabled = true;
      try { await updateDoc(doc(D().db, 'laboratorio', o.id), { pagado_lab: true, pagado_dia: hoyISO(), pagado_por: yo(), actualizado: serverTimestamp(), actualizado_por: yo() }); cuenta(); }
      catch (e) { console.error(e); b.disabled = false; $('od-msg').innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
    });
  } catch (e) { console.error(e); $('ol-caja').innerHTML += `<p class="od-err">${esc(errTxt(e))}</p>`; }
}

// ── Botón en la ficha del socio ─────────────────────────────────────────────
let actual = { id: null, nombre: '' };
function enganchar() {
  if (window.__olFicha || typeof window.abrirExpediente !== 'function') return;
  window.__olFicha = true;
  const orig = window.abrirExpediente;
  window.abrirExpediente = function (id, nombre) { actual = { id, nombre }; const r = orig.apply(this, arguments); boton(); return r; };
}
function boton() {
  const zona = document.querySelector('#vista-expediente .topbar-right'); if (!zona) return;
  let b = $('ol-btn');
  if (!habilitado() || !esPersonal()) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement('button'); b.id = 'ol-btn'; b.type = 'button'; b.className = 'btn-secundario'; b.textContent = '🧪 Laboratorio';
    b.onclick = () => actual.id && abrir(actual.id, actual.nombre);
    const ant = $('op-btn') || $('od-btn-hc'); zona.insertBefore(b, ant ? ant.nextSibling : zona.firstChild);
  }
}
function iniciar() { if (!habilitado()) return; enganchar(); boton(); }
window.abrirLaboratorio = abrir;
window.addEventListener('domino:listo', iniciar);
if (D() && D().listo) iniciar();
