// DOMino Bienestar · Módulo exclusivo ODONTOLOGÍA (etapa 2a: presupuestos, lista de precios y cobros).
// Lo ve todo el personal del centro con el módulo activo (también Recepción); no muestra nada clínico.
// Datos: negocios/{id}/presupuestos/{id} (no se borran: se anulan), negocios/{id}/cobros/{id} (solo se crean;
// un error se corrige con una anulación en negativo) y negocios/{id}/config/odonto_aranceles (lista de precios, solo Dirección).
// Etapa 2b (pendiente de la cuenta del consultorio): cobro automático con Mercado Pago y seña al reservar.
import { getDoc, getDocs, setDoc, updateDoc, addDoc, query, where, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { collection, doc } from "./tenant.js";

const D = () => window.DOMINO, $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const habilitado = () => !!(D() && D().negocioDoc && D().negocioDoc.modulos && D().negocioDoc.modulos.odontologia);
const esPersonal = () => ['senior', 'midsenior', 'asistente'].includes(window.rolActual);
const esDireccion = () => window.rolActual === 'senior';
const yo = () => String((D().auth && D().auth.currentUser && D().auth.currentUser.email) || D().email || '').toLowerCase();
const $$ = (n) => { const v = Math.round(Number(n) || 0); return (v < 0 ? '-$ ' : '$ ') + Math.abs(v).toLocaleString('es-AR'); };
const num = (v) => { const n = Number(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const fecha = (t) => { const d = t && t.toDate ? t.toDate() : (t ? new Date(t) : null); return d ? d.toLocaleDateString('es-AR') : '—'; };
const ms = (t) => t && t.toMillis ? t.toMillis() : (t ? new Date(t).getTime() : 0);

const MEDIOS = [['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['debito', 'Débito'], ['credito', 'Crédito'], ['mercadopago', 'Mercado Pago'], ['obra_social', 'Obra social'], ['otro', 'Otro']];
const MEDIO_TXT = Object.fromEntries(MEDIOS);
const ESTADOS = { borrador: 'Borrador', aceptado: 'Aceptado', rechazado: 'Rechazado', terminado: 'Terminado', anulado: 'Anulado' };
const SUGERIDOS = ['Consulta y diagnóstico', 'Limpieza y control', 'Arreglo de caries (resina)', 'Tratamiento de conducto', 'Extracción', 'Blanqueamiento', 'Control de ortodoncia', 'Urgencia', 'Corona', 'Radiografía'];

let P = null; // estado de la pantalla abierta
let ARANCELES = null, PROFES = null;

async function cargarAranceles() {
  if (ARANCELES) return ARANCELES;
  try { const s = await getDoc(doc(D().db, 'config', 'odonto_aranceles')); ARANCELES = s.exists() ? (s.data().items || []) : []; } catch (e) { ARANCELES = []; }
  return ARANCELES;
}
async function cargarProfes() {
  if (PROFES) return PROFES;
  try {
    const s = await getDocs(query(collection(D().db, 'users'), where('negocio_id', '==', window.DOMINO_NID || D().nid)));
    PROFES = s.docs.map((d) => d.data()).filter((u) => u.activo !== false && ['senior', 'midsenior'].includes(u.rol_jerarquia)).map((u) => ({ email: String(u.email || '').toLowerCase(), nombre: u.nombre_display || u.email }));
  } catch (e) { PROFES = []; }
  if (!PROFES.length && ['senior', 'midsenior'].includes(window.rolActual)) PROFES = [{ email: yo(), nombre: window.nombreDisplay || yo() }];
  return PROFES;
}
const profeNombre = (email) => ((PROFES || []).find((p) => p.email === email) || {}).nombre || email || '—';

// ── Caja (reusa los estilos del módulo de historia clínica) ─────────────────
function cerrar() { const f = $('op-fondo'); if (f) f.remove(); document.body.style.overflow = ''; }
function caja() {
  if (window.odEstilos) window.odEstilos();
  cerrar();
  const f = document.createElement('div'); f.id = 'op-fondo'; f.className = 'od-fondo'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-labelledby', 'op-t');
  f.innerHTML = '<div class="od-caja" id="op-caja"></div>';
  document.body.appendChild(f); document.body.style.overflow = 'hidden';
  f.addEventListener('click', (e) => { if (e.target === f) cerrar(); });
  f.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
  if (!$('op-css')) {
    const s = document.createElement('style'); s.id = 'op-css';
    s.textContent = `.op-res{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.op-res div{border:1px solid var(--line,#2a2d33);border-radius:6px;padding:10px;text-align:center}.op-res b{display:block;font-size:1.15rem;color:var(--gold-light,#e8c766)}.op-res span{font-size:.82rem;color:var(--text-muted,#a8a396)}
    .op-res .deuda b{color:#ffb3b5}.op-h{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:18px 0 6px}.op-h h3{margin:0;font-size:1.05rem}
    .op-it{display:grid;grid-template-columns:1fr 64px 56px 110px 34px 40px;gap:6px;align-items:center;margin-top:6px}.op-it .od-in{padding:9px 8px}
    .op-it-h{font-size:.78rem;color:var(--text-muted,#a8a396)}.op-del{width:40px;height:40px;border:1px solid var(--line,#2a2d33);border-radius:6px;background:transparent;color:inherit;cursor:pointer}
    .op-chip{display:inline-block;font-size:.75rem;padding:2px 8px;border-radius:999px;border:1px solid var(--line,#2a2d33);margin-left:6px}.op-chip.aceptado{border-color:#3b82f6;color:#bcd5ff}.op-chip.terminado{border-color:#4cc38a;color:#9ff0c4}.op-chip.anulado,.op-chip.rechazado{opacity:.6}
    .op-neg{color:#ffb3b5}.op-tabla{width:100%;border-collapse:collapse;margin-top:8px;font-size:.92rem}.op-tabla td,.op-tabla th{padding:7px 6px;border-bottom:1px solid var(--line,#2a2d33);text-align:left}.op-tabla td.n,.op-tabla th.n{text-align:right;white-space:nowrap}.op-m{display:none}
    @media (max-width:600px){#op-items .op-it{grid-template-columns:64px 56px 1fr 30px 40px;padding-bottom:8px;border-bottom:1px solid var(--line,#2a2d33)}#op-items .op-it>[data-k=practica]{grid-column:1/-1}.op-tabla .c-medio{display:none}.op-m{display:inline}.op-it-h{display:none}.op-res b{font-size:1rem}}`;
    document.head.appendChild(s);
  }
}
const cabecera = (t, sub) => `<button type="button" class="od-x" id="op-x" aria-label="Cerrar">✕</button><h2 id="op-t">${esc(t)}</h2><p class="od-sub">${esc(sub || '')}</p>`;
const enlazarX = () => { $('op-x').onclick = cerrar; };
const errTxt = (e) => /permission/i.test(String(e && (e.code || e.message))) ? 'Sin permiso: el módulo Odontología tiene que estar activo y su usuario en este centro.' : 'No se pudo guardar. Revise su conexión e intente de nuevo.';

// ── Pantalla principal del paciente ─────────────────────────────────────────
async function abrir(id, nombre) {
  if (!habilitado() || !esPersonal()) return;
  P = { id, nombre, pres: [], cobros: [], tel: '' };
  caja(); $('op-caja').innerHTML = cabecera('Presupuestos y pagos', nombre) + '<p>Cargando…</p>'; enlazarX();
  try {
    const db = D().db;
    const [pr, co, so] = await Promise.all([
      getDocs(query(collection(db, 'presupuestos'), where('socio_id', '==', id))),
      getDocs(query(collection(db, 'cobros'), where('socio_id', '==', id))),
      getDoc(doc(db, 'clients', id)).catch(() => null), cargarAranceles(), cargarProfes()
    ]);
    P.pres = pr.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => ms(b.creado) - ms(a.creado));
    P.cobros = co.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => ms(b.fecha) - ms(a.fecha));
    const sd = so && so.exists && so.exists() ? so.data() : {};
    P.tel = String(sd.telefono || sd.celular || sd.whatsapp || '').replace(/\D/g, '');
    vista();
  } catch (e) { console.error(e); $('op-caja').innerHTML = cabecera('Presupuestos y pagos', nombre) + `<p class="od-err">${esc(errTxt(e))}</p>`; enlazarX(); }
}
const vigentes = () => P.pres.filter((p) => ['aceptado', 'terminado'].includes(p.estado));
function totales() {
  const pres = vigentes().reduce((a, p) => a + (Number(p.total) || 0), 0);
  const cob = P.cobros.reduce((a, c) => a + (Number(c.monto) || 0), 0);
  return { pres, cob, saldo: pres - cob };
}
function vista() {
  const t = totales(), anulados = new Set(P.cobros.filter((c) => c.anula).map((c) => c.anula));
  $('op-caja').innerHTML = cabecera('Presupuestos y pagos', P.nombre) + `
    <div class="op-res"><div><b>${$$(t.pres)}</b><span>Presupuestos aceptados</span></div><div><b>${$$(t.cob)}</b><span>Cobrado</span></div><div class="${t.saldo > 0 ? 'deuda' : ''}"><b>${$$(t.saldo)}</b><span>${t.saldo >= 0 ? 'Saldo a pagar' : 'Saldo a favor'}</span></div></div>
    <div class="op-h"><h3>Presupuestos</h3><button type="button" class="od-btn" id="op-nuevo">+ Nuevo presupuesto</button></div>
    ${P.pres.length ? P.pres.map((p) => `<div class="od-ev"><div class="meta">${esc(fecha(p.creado))} · ${esc(profeNombre(p.profesional))}<span class="op-chip ${esc(p.estado)}">${esc(ESTADOS[p.estado] || p.estado)}</span></div>
        <div class="od-fila" style="justify-content:space-between"><span>${(p.items || []).length} práctica${(p.items || []).length === 1 ? '' : 's'}${(p.items || []).some((i) => i.hecho) ? ` · ${(p.items || []).filter((i) => i.hecho).length} hecha${(p.items || []).filter((i) => i.hecho).length === 1 ? '' : 's'}` : ''}</span><b>${$$(p.total)}</b></div>
        <div class="od-fila fin" style="margin-top:6px"><button type="button" class="od-btn sec" data-ver="${esc(p.id)}" style="padding:7px 12px">Ver o editar</button></div></div>`).join('') : '<p class="od-sub">Todavía no hay presupuestos.</p>'}
    <div class="op-h"><h3>Cobros</h3><button type="button" class="od-btn" id="op-cobrar">+ Registrar cobro</button></div>
    ${P.cobros.length ? `<table class="op-tabla"><thead><tr><th>Fecha</th><th>Concepto</th><th class="c-medio">Medio</th><th class="n">Monto</th><th></th></tr></thead><tbody>${P.cobros.map((c) => `<tr${anulados.has(c.id) ? ' style="opacity:.5"' : ''}><td>${esc(fecha(c.fecha))}</td><td>${esc(c.concepto || '')}${c.profesional ? `<br><small class="od-sub">${esc(profeNombre(c.profesional))}</small>` : ''}<small class="od-sub op-m"><br>${esc(MEDIO_TXT[c.medio] || c.medio)}</small>${anulados.has(c.id) ? '<br><small class="od-sub">Anulado</small>' : ''}</td><td class="c-medio">${esc(MEDIO_TXT[c.medio] || c.medio)}</td><td class="n ${c.monto < 0 ? 'op-neg' : ''}">${$$(c.monto)}</td><td>${!c.anula && !anulados.has(c.id) ? `<button type="button" class="op-del" data-anular="${esc(c.id)}" aria-label="Anular cobro" title="Anular">↺</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="od-sub">Todavía no hay cobros.</p>'}
    ${esDireccion() ? '<div class="od-fila fin" style="margin-top:18px"><button type="button" class="od-btn sec" id="op-precios">Lista de precios</button><button type="button" class="od-btn sec" id="op-resumen">Resumen de cobros</button></div>' : ''}
    <div id="od-msg"></div>`;
  enlazarX();
  $('op-nuevo').onclick = () => editor(null);
  $('op-cobrar').onclick = () => cobro();
  $('op-caja').querySelectorAll('[data-ver]').forEach((b) => b.onclick = () => editor(P.pres.find((p) => p.id === b.dataset.ver)));
  $('op-caja').querySelectorAll('[data-anular]').forEach((b) => b.onclick = () => anular(P.cobros.find((c) => c.id === b.dataset.anular)));
  if ($('op-precios')) $('op-precios').onclick = precios;
  if ($('op-resumen')) $('op-resumen').onclick = resumen;
}

// ── Editor de presupuesto ───────────────────────────────────────────────────
function editor(pres) {
  const E = pres ? JSON.parse(JSON.stringify(pres)) : { items: [], estado: 'borrador', profesional: ['senior', 'midsenior'].includes(window.rolActual) ? yo() : ((PROFES[0] || {}).email || '') };
  if (!E.items.length) E.items.push({ practica: '', pieza: '', cant: 1, precio: 0, hecho: false });
  const bloqueado = ['anulado', 'rechazado'].includes(E.estado);
  const fila = (it, i) => `<div class="op-it" data-i="${i}">
      <input class="od-in" list="op-ar" data-k="practica" value="${esc(it.practica)}" placeholder="Práctica" aria-label="Práctica" ${bloqueado ? 'disabled' : ''}>
      <input class="od-in op-pz" data-k="pieza" value="${esc(it.pieza)}" placeholder="Pieza" aria-label="Pieza" inputmode="numeric" ${bloqueado ? 'disabled' : ''}>
      <input class="od-in op-cant" data-k="cant" value="${esc(it.cant)}" placeholder="Cant." aria-label="Cantidad" inputmode="numeric" ${bloqueado ? 'disabled' : ''}>
      <input class="od-in" data-k="precio" value="${esc(it.precio || '')}" placeholder="Precio" aria-label="Precio" inputmode="decimal" ${bloqueado ? 'disabled' : ''}>
      <input type="checkbox" data-k="hecho" ${it.hecho ? 'checked' : ''} aria-label="Hecha" title="Hecha" style="width:22px;height:22px" ${bloqueado ? 'disabled' : ''}>
      ${bloqueado ? '<span></span>' : `<button type="button" class="op-del" data-quitar="${i}" aria-label="Quitar práctica">✕</button>`}</div>`;
  const total = () => E.items.reduce((a, it) => a + num(it.cant || 1) * num(it.precio), 0);
  const pintar = () => {
    $('op-caja').innerHTML = cabecera(pres ? 'Presupuesto' : 'Nuevo presupuesto', P.nombre) + `
      <datalist id="op-ar">${(ARANCELES || []).map((a) => `<option value="${esc(a.nombre)}">`).join('')}${SUGERIDOS.filter((s) => !(ARANCELES || []).some((a) => a.nombre === s)).map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
      <div class="od-grid"><div><label class="od-l" for="op-prof">Profesional</label><select class="od-in" id="op-prof" ${bloqueado ? 'disabled' : ''}>${(PROFES || []).map((p) => `<option value="${esc(p.email)}" ${p.email === E.profesional ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></div>
      <div><label class="od-l">Estado</label><p style="margin:8px 0"><span class="op-chip ${esc(E.estado)}" style="margin:0">${esc(ESTADOS[E.estado])}</span></p></div></div>
      <div class="op-it op-it-h" style="margin-top:14px"><span>Práctica</span><span class="op-pz">Pieza</span><span class="op-cant">Cant.</span><span>Precio c/u</span><span title="Hecha">✓</span><span></span></div>
      <div id="op-items">${E.items.map(fila).join('')}</div>
      ${bloqueado ? '' : '<div class="od-fila" style="margin-top:8px"><button type="button" class="od-btn sec" id="op-mas" style="padding:8px 12px">+ Agregar práctica</button></div>'}
      <div class="od-fila" style="justify-content:space-between;margin-top:14px;font-size:1.1rem"><span>Total</span><b id="op-total">${$$(total())}</b></div>
      <label class="od-l" for="op-nota">Nota para el paciente (opcional)</label><textarea class="od-in" id="op-nota" maxlength="1000" ${bloqueado ? 'disabled' : ''}>${esc(E.nota || '')}</textarea>
      <div class="od-fila fin">
        <button type="button" class="od-btn sec" id="op-volver">Volver</button>
        ${pres && !bloqueado ? '<button type="button" class="od-btn sec" id="op-wa">Enviar por WhatsApp</button>' : ''}
        ${!bloqueado ? '<button type="button" class="od-btn sec" id="op-guardar">Guardar</button>' : ''}
        ${!bloqueado && E.estado === 'borrador' ? '<button type="button" class="od-btn" id="op-aceptar">Aceptado por el paciente</button>' : ''}
        ${E.estado === 'aceptado' ? '<button type="button" class="od-btn" id="op-terminar">Tratamiento terminado</button>' : ''}
      </div>
      ${pres && !bloqueado ? `<div class="od-fila fin" style="margin-top:8px">${E.estado === 'borrador' ? '<button type="button" class="od-btn sec" id="op-rechazar" style="padding:7px 12px">Rechazado</button>' : ''}<button type="button" class="od-btn sec" id="op-anular" style="padding:7px 12px">Anular presupuesto</button></div>` : ''}
      <div id="od-msg"></div>`;
    enlazarX();
    $('op-volver').onclick = vista;
    const leer = () => {
      E.profesional = $('op-prof') ? $('op-prof').value : E.profesional; E.nota = $('op-nota').value.trim();
      $('op-items').querySelectorAll('.op-it').forEach((r) => {
        const it = E.items[Number(r.dataset.i)]; if (!it) return;
        r.querySelectorAll('[data-k]').forEach((inp) => { const k = inp.dataset.k; it[k] = k === 'hecho' ? inp.checked : (k === 'cant' ? Math.max(1, Math.round(num(inp.value)) || 1) : k === 'precio' ? num(inp.value) : inp.value.trim()); });
      });
    };
    $('op-items').addEventListener('input', (e) => {
      const r = e.target.closest('.op-it');
      if (e.target.dataset.k === 'practica' && r) { const a = (ARANCELES || []).find((x) => x.nombre === e.target.value); const pr = r.querySelector('[data-k=precio]'); if (a && pr && !num(pr.value)) pr.value = a.precio; }
      leer(); $('op-total').textContent = $$(total());
    });
    $('op-items').addEventListener('change', () => { leer(); });
    if ($('op-mas')) $('op-mas').onclick = () => { leer(); E.items.push({ practica: '', pieza: '', cant: 1, precio: 0, hecho: false }); pintar(); };
    $('op-caja').querySelectorAll('[data-quitar]').forEach((b) => b.onclick = () => { leer(); E.items.splice(Number(b.dataset.quitar), 1); if (!E.items.length) E.items.push({ practica: '', pieza: '', cant: 1, precio: 0, hecho: false }); pintar(); });
    const guardar = async (estado, msgOk) => {
      leer();
      const items = E.items.filter((it) => it.practica);
      if (!items.length) { $('od-msg').innerHTML = '<p class="od-err">Agregue al menos una práctica.</p>'; return; }
      if (items.some((it) => !(num(it.precio) > 0)) && estado !== 'anulado') { $('od-msg').innerHTML = '<p class="od-err">Falta el precio de alguna práctica.</p>'; return; }
      const datos = { socio_id: P.id, socio_nombre: P.nombre, profesional: E.profesional, items, total: items.reduce((a, it) => a + num(it.cant || 1) * num(it.precio), 0), nota: E.nota || '', estado: estado || E.estado, actualizado: serverTimestamp(), actualizado_por: yo() };
      if (estado === 'aceptado') datos.aceptado = serverTimestamp();
      if (estado === 'terminado') datos.terminado = serverTimestamp();
      if (estado === 'anulado') datos.anulado = serverTimestamp();
      $('op-caja').querySelectorAll('.od-btn').forEach((b) => b.disabled = true);
      try {
        if (E.id) await updateDoc(doc(D().db, 'presupuestos', E.id), datos);
        else { datos.creado = serverTimestamp(); datos.creado_por = yo(); const r = await addDoc(collection(D().db, 'presupuestos'), datos); E.id = r.id; }
        const local = Object.assign({}, E, datos, { id: E.id, creado: E.creado || new Date(), actualizado: new Date() });
        P.pres = [local].concat(P.pres.filter((p) => p.id !== E.id)).sort((a, b) => ms(b.creado) - ms(a.creado));
        vista(); $('od-msg').innerHTML = `<p class="od-ok">${esc(msgOk)}</p>`;
      } catch (e) { console.error(e); $('op-caja').querySelectorAll('.od-btn').forEach((b) => b.disabled = false); $('od-msg').innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
    };
    if ($('op-guardar')) $('op-guardar').onclick = () => guardar(null, 'Presupuesto guardado.');
    if ($('op-aceptar')) $('op-aceptar').onclick = () => guardar('aceptado', 'Presupuesto aceptado: ya cuenta en el saldo del paciente.');
    if ($('op-terminar')) $('op-terminar').onclick = () => { if (confirm('¿Marcar el tratamiento como terminado?')) guardar('terminado', 'Tratamiento terminado.'); };
    if ($('op-rechazar')) $('op-rechazar').onclick = () => { if (confirm('¿Marcar el presupuesto como rechazado por el paciente?')) guardar('rechazado', 'Presupuesto marcado como rechazado.'); };
    if ($('op-anular')) $('op-anular').onclick = () => { if (confirm('¿Anular este presupuesto? Queda guardado como anulado y deja de contar en el saldo.')) guardar('anulado', 'Presupuesto anulado.'); };
    if ($('op-wa')) $('op-wa').onclick = () => {
      leer();
      const neg = (D().negocioDoc && D().negocioDoc.nombre) || '';
      const txt = `Hola ${P.nombre.split(' ')[0]}, le paso el presupuesto${neg ? ' de ' + neg : ''}:\n\n` + E.items.filter((i) => i.practica).map((i) => `• ${i.practica}${i.pieza ? ' (pieza ' + i.pieza + ')' : ''}${num(i.cant) > 1 ? ' x' + i.cant : ''}: ${$$(num(i.cant || 1) * num(i.precio))}`).join('\n') + `\n\nTotal: ${$$(total())}` + (E.nota ? `\n\n${E.nota}` : '') + '\n\nCualquier consulta, quedamos a disposición.';
      window.open('https://wa.me/' + (P.tel ? (P.tel.startsWith('54') ? P.tel : '549' + P.tel.replace(/^0/, '')) : '') + '?text=' + encodeURIComponent(txt), '_blank', 'noopener');
    };
  };
  pintar();
}

// ── Cobros ──────────────────────────────────────────────────────────────────
function cobro() {
  const abiertos = P.pres.filter((p) => ['aceptado', 'borrador'].includes(p.estado));
  const t = totales();
  $('op-caja').innerHTML = cabecera('Registrar cobro', P.nombre) + `
    <form id="op-cf" novalidate>
    <div class="od-grid">
      <div><label class="od-l" for="op-monto">Monto</label><input class="od-in" id="op-monto" inputmode="decimal" placeholder="${t.saldo > 0 ? esc(Math.round(t.saldo)) : ''}"></div>
      <div><label class="od-l" for="op-medio">Medio de pago</label><select class="od-in" id="op-medio">${MEDIOS.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div><label class="od-l" for="op-conc">Concepto</label><input class="od-in" id="op-conc" list="op-concs" placeholder="Ej.: Seña, Consulta, Pago a cuenta"><datalist id="op-concs"><option value="Seña"><option value="Consulta"><option value="Pago a cuenta"><option value="Pago total"><option value="Cuota"></datalist></div>
      <div><label class="od-l" for="op-cpres">Presupuesto (opcional)</label><select class="od-in" id="op-cpres"><option value="">Sin presupuesto</option>${abiertos.map((p) => `<option value="${esc(p.id)}">${esc(fecha(p.creado))} · ${esc($$(p.total))}</option>`).join('')}</select></div>
      <div><label class="od-l" for="op-cprof">Profesional</label><select class="od-in" id="op-cprof"><option value="">—</option>${(PROFES || []).map((p) => `<option value="${esc(p.email)}" ${p.email === ((abiertos[0] || {}).profesional || (['senior', 'midsenior'].includes(window.rolActual) ? yo() : '')) ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></div>
    </div>
    <div class="od-fila fin"><button type="button" class="od-btn sec" id="op-volver">Volver</button><button type="submit" class="od-btn" id="op-cok">Registrar cobro</button></div>
    <p class="od-pend">Los cobros no se borran: si hay un error, se anula y queda registrado.</p>
    <div id="od-msg"></div></form>`;
  enlazarX();
  $('op-volver').onclick = vista;
  $('op-cpres').onchange = () => { const p = P.pres.find((x) => x.id === $('op-cpres').value); if (p && p.profesional) $('op-cprof').value = p.profesional; };
  $('op-cf').onsubmit = async (ev) => {
    ev.preventDefault();
    const monto = num($('op-monto').value);
    if (!(monto > 0)) { $('od-msg').innerHTML = '<p class="od-err">Escriba el monto cobrado.</p>'; return; }
    const datos = { socio_id: P.id, socio_nombre: P.nombre, monto, medio: $('op-medio').value, concepto: $('op-conc').value.trim() || 'Cobro', presupuesto_id: $('op-cpres').value || '', profesional: $('op-cprof').value || '', registrado_por: yo(), registrado_nombre: window.nombreDisplay || '', fecha: serverTimestamp() };
    $('op-cok').disabled = true; $('op-cok').textContent = 'Guardando…';
    try {
      const r = await addDoc(collection(D().db, 'cobros'), datos);
      P.cobros.unshift(Object.assign({ id: r.id }, datos, { fecha: new Date() }));
      vista(); $('od-msg').innerHTML = `<p class="od-ok">Cobro de ${esc($$(monto))} registrado.</p>`;
    } catch (e) { console.error(e); $('op-cok').disabled = false; $('op-cok').textContent = 'Registrar cobro'; $('od-msg').innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
  };
}
async function anular(c) {
  if (!c) return;
  const motivo = prompt(`¿Anular el cobro de ${$$(c.monto)} del ${fecha(c.fecha)}? Escriba el motivo:`);
  if (motivo === null) return;
  if (!motivo.trim()) { alert('Escriba el motivo de la anulación.'); return; }
  const datos = { socio_id: P.id, socio_nombre: P.nombre, monto: -Math.abs(Number(c.monto) || 0), medio: c.medio, concepto: 'Anulación: ' + motivo.trim(), anula: c.id, presupuesto_id: c.presupuesto_id || '', profesional: c.profesional || '', registrado_por: yo(), registrado_nombre: window.nombreDisplay || '', fecha: serverTimestamp() };
  try { const r = await addDoc(collection(D().db, 'cobros'), datos); P.cobros.unshift(Object.assign({ id: r.id }, datos, { fecha: new Date() })); vista(); $('od-msg').innerHTML = '<p class="od-ok">Cobro anulado.</p>'; }
  catch (e) { console.error(e); alert(errTxt(e)); }
}

// ── Lista de precios (Dirección) ────────────────────────────────────────────
function precios() {
  const L = (ARANCELES && ARANCELES.length ? ARANCELES : SUGERIDOS.map((n) => ({ nombre: n, precio: '' }))).map((a) => Object.assign({}, a));
  const pintar = () => {
    $('op-caja').innerHTML = cabecera('Lista de precios', 'Se usa al armar presupuestos; se puede cambiar el precio en cada uno.') + `
      <div id="op-pl">${L.map((a, i) => `<div class="op-it" style="grid-template-columns:1fr 130px 40px" data-i="${i}"><input class="od-in" data-k="nombre" value="${esc(a.nombre)}" aria-label="Práctica"><input class="od-in" data-k="precio" value="${esc(a.precio)}" inputmode="decimal" placeholder="Precio" aria-label="Precio"><button type="button" class="op-del" data-q="${i}" aria-label="Quitar">✕</button></div>`).join('')}</div>
      <div class="od-fila" style="margin-top:8px"><button type="button" class="od-btn sec" id="op-pmas" style="padding:8px 12px">+ Agregar práctica</button></div>
      <div class="od-fila fin"><button type="button" class="od-btn sec" id="op-volver">Volver</button><button type="button" class="od-btn" id="op-pok">Guardar lista</button></div><div id="od-msg"></div>`;
    enlazarX();
    const leer = () => $('op-pl').querySelectorAll('.op-it').forEach((r) => { const a = L[Number(r.dataset.i)]; a.nombre = r.querySelector('[data-k=nombre]').value.trim(); a.precio = r.querySelector('[data-k=precio]').value.trim(); });
    $('op-volver').onclick = vista;
    $('op-pmas').onclick = () => { leer(); L.push({ nombre: '', precio: '' }); pintar(); };
    $('op-caja').querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { leer(); L.splice(Number(b.dataset.q), 1); pintar(); });
    $('op-pok').onclick = async () => {
      leer();
      const items = L.filter((a) => a.nombre).map((a) => ({ nombre: a.nombre, precio: num(a.precio) }));
      $('op-pok').disabled = true;
      try { await setDoc(doc(D().db, 'config', 'odonto_aranceles'), { items, actualizado: serverTimestamp(), actualizado_por: yo() }); ARANCELES = items; vista(); $('od-msg').innerHTML = '<p class="od-ok">Lista de precios guardada.</p>'; }
      catch (e) { console.error(e); $('op-pok').disabled = false; $('od-msg').innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
    };
  };
  pintar();
}

// ── Resumen de cobros del mes (Dirección) ───────────────────────────────────
async function resumen(mesTxt) {
  const hoy = new Date(), m = typeof mesTxt === 'string' ? mesTxt : `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const [y, mm] = m.split('-').map(Number), desde = new Date(y, mm - 1, 1), hasta = new Date(y, mm, 1);
  $('op-caja').innerHTML = cabecera('Resumen de cobros', 'Todo el centro') + `<div class="od-fila"><label class="od-l" for="op-mes" style="margin:0">Mes</label><input class="od-in" type="month" id="op-mes" value="${m}" style="max-width:200px"></div><div id="op-rs"><p>Cargando…</p></div><div class="od-fila fin"><button type="button" class="od-btn sec" id="op-volver">Volver</button></div>`;
  enlazarX(); $('op-volver').onclick = vista; $('op-mes').onchange = () => resumen($('op-mes').value);
  try {
    const s = await getDocs(query(collection(D().db, 'cobros'), where('fecha', '>=', Timestamp.fromDate(desde)), where('fecha', '<', Timestamp.fromDate(hasta))));
    const cs = s.docs.map((d) => d.data()), porProf = {}, porMedio = {};
    cs.forEach((c) => { const k = c.profesional || ''; porProf[k] = (porProf[k] || 0) + (Number(c.monto) || 0); porMedio[c.medio] = (porMedio[c.medio] || 0) + (Number(c.monto) || 0); });
    const tot = cs.reduce((a, c) => a + (Number(c.monto) || 0), 0);
    $('op-rs').innerHTML = `<div class="op-res" style="grid-template-columns:1fr 1fr"><div><b>${$$(tot)}</b><span>Total cobrado</span></div><div><b>${cs.filter((c) => c.monto > 0).length}</b><span>Cobros</span></div></div>
      <table class="op-tabla"><thead><tr><th>Profesional</th><th class="n">Cobrado</th></tr></thead><tbody>${Object.entries(porProf).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k ? profeNombre(k) : 'Sin profesional')}</td><td class="n">${$$(v)}</td></tr>`).join('') || '<tr><td colspan="2">Sin cobros en el mes.</td></tr>'}</tbody></table>
      <table class="op-tabla" style="margin-top:14px"><thead><tr><th>Medio de pago</th><th class="n">Cobrado</th></tr></thead><tbody>${Object.entries(porMedio).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(MEDIO_TXT[k] || k)}</td><td class="n">${$$(v)}</td></tr>`).join('')}</tbody></table>`;
  } catch (e) { console.error(e); $('op-rs').innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
}

// ── Botón en la ficha del socio ─────────────────────────────────────────────
let actual = { id: null, nombre: '' };
function enganchar() {
  if (window.__opFicha || typeof window.abrirExpediente !== 'function') return;
  window.__opFicha = true;
  const orig = window.abrirExpediente;
  window.abrirExpediente = function (id, nombre) { actual = { id, nombre }; const r = orig.apply(this, arguments); boton(); return r; };
}
function boton() {
  const zona = document.querySelector('#vista-expediente .topbar-right'); if (!zona) return;
  let b = $('op-btn');
  if (!habilitado() || !esPersonal()) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement('button'); b.id = 'op-btn'; b.type = 'button'; b.className = 'btn-secundario'; b.textContent = '💲 Presupuestos y pagos';
    b.onclick = () => actual.id && abrir(actual.id, actual.nombre);
    const hc = $('od-btn-hc'); zona.insertBefore(b, hc ? hc.nextSibling : zona.firstChild);
  }
}
function iniciar() { if (!habilitado()) return; enganchar(); boton(); }
window.abrirPresupuestosPagos = abrir;
window.addEventListener('domino:listo', iniciar);
if (D() && D().listo) iniciar();
