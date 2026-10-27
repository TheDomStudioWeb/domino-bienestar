// DOMino Bienestar · Datos del negocio y actividades.
// La primera vez que entra la Dirección, carga el nombre del negocio y elige qué actividades realiza (gimnasio, clases, spa, peluquería…).
// Se guarda en Firestore: config/negocio. El catálogo de actividades sale de turnos/catalogo-actividades.json (ver actividades-datos.js).
// Para sumar una actividad nueva: agregarla al catálogo y correr  node alta/sincronizar-catalogo.js  (no se toca nada más).
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
    <h2 id="bn-t">${primera ? 'Bienvenido a DOMino Bienestar' : 'Actividades del negocio'}</h2>
    <p>${primera ? 'Antes de empezar, cuéntenos sobre su negocio. Son dos pasos y lo puede cambiar cuando quiera.' : 'Sume o quite actividades. Los datos que ya cargó no se borran.'}</p>
    <label class="bn-l" for="bn-nombre">Nombre del negocio</label>
    <input type="text" id="bn-nombre" maxlength="60" autocomplete="organization" placeholder="Ej. Vita Aura" value="${esc((negocio && negocio.nombre) || nombreInicial())}">
    <label class="bn-l" for="bn-tel">Teléfono o WhatsApp (se muestra en la página de reservas)</label>
    <input type="tel" id="bn-tel" maxlength="30" autocomplete="tel" placeholder="Ej. 261 555 0000" value="${esc((negocio && negocio.telefono) || '')}">
    <label class="bn-l">¿Qué actividades realizan? Elija todas las que correspondan.</label>
    <div class="bn-acts">${CAT().map((a) => `<label class="bn-act"><input type="checkbox" value="${esc(a.id)}"${sel.has(a.id) ? ' checked' : ''}><span><b>${esc(a.nombre)}</b><small>${esc(a.texto)}</small></span></label>`).join('')}</div>
    <div class="bn-err" id="bn-err" role="alert"></div>
    <div class="bn-fila"><button type="submit" class="bn-btn" id="bn-ok">${primera ? 'Guardar y empezar' : 'Guardar cambios'}</button><button type="button" class="bn-btn sec" id="bn-no">${primera ? 'Más tarde' : 'Cancelar'}</button></div></form>`;
  document.body.appendChild(f); document.body.style.overflow = 'hidden';
  $('bn-nombre').focus();
  $('bn-no').onclick = cerrar;
  $('bn-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const nom = $('bn-nombre').value.trim(), tel = $('bn-tel').value.trim(), acts = [...f.querySelectorAll('.bn-act input:checked')].map((i) => i.value);
    const err = (m) => { $('bn-err').textContent = m; };
    if (nom.length < 3) return err('Escriba el nombre del negocio.');
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
  let p = $('hub-negocio'); if (!p) { p = document.createElement('section'); p.id = 'hub-negocio'; p.setAttribute('aria-label', 'Su negocio'); dest.parentNode.insertBefore(p, dest); }
  const senior = D() && D().rol === 'senior';
  if (!cargado) { p.hidden = true; return; }
  p.hidden = false;
  if (!negocio) {
    p.innerHTML = `<h2>Falta cargar los datos del negocio</h2><p style="margin:0;color:var(--text-muted)">${senior ? 'Cargue el nombre y las actividades para dejar todo listo.' : 'La Dirección todavía no cargó las actividades del negocio.'}</p>${senior ? '<div class="bn-fila"><button type="button" class="bn-btn" id="bn-abrir">Cargar ahora</button></div>' : ''}`;
  } else {
    const acts = negocio.actividades || [];
    p.innerHTML = `<h2>${esc(negocio.nombre)}</h2><div class="bn-chips">${acts.map((a) => `<span class="bn-chip">${esc(nombreActividad(a))}</span>`).join('')}</div>
    ${senior ? `<div class="bn-fila"><button type="button" class="bn-btn sec" id="bn-abrir">Cambiar actividades</button></div>
    <details${abrirPasos ? ' open' : ''}><summary>Cómo activar las reservas de estas actividades</summary>
      <p>Lo hace una sola vez la persona que administra la planilla de turnos (The DOM Studio Web puede hacerlo por usted):</p>
      <ol style="margin:0 0 8px 18px;line-height:1.6"><li>En la planilla de turnos, hoja <b>config</b>, agregue esta fila (columna <b>clave</b> y columna <b>valor</b>):<code class="bn-code" id="bn-linea">${esc(lineaPlanilla(acts))}</code></li><li>En Apps Script, elija la función <b>cargarActividades</b> y toque <b>Ejecutar</b>.</li><li>Listo: aparecen los servicios, las clases con cupos y los horarios típicos. Después se ajustan precios, horarios y profesionales en la misma planilla.</li></ol>
      <button type="button" class="bn-btn sec" id="bn-copiar">Copiar la fila</button></details>` : ''}`;
    const c = $('bn-copiar'); if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(lineaPlanilla(acts)); c.textContent = 'Copiado ✓'; } catch (e) { const r = document.createRange(); r.selectNodeContents($('bn-linea')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); c.textContent = 'Seleccionado: copie con su teléfono'; } };
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
