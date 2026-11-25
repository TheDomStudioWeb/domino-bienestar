// DOMino Bienestar · Módulo exclusivo ODONTOLOGÍA (etapa 1: historia clínica).
// Se ve solo si The DOM activó el módulo en el centro (negocios/{id}.modulos.odontologia, desde /centros/)
// y solo para profesionales (Dirección y Mid Senior); Recepción no ve nada clínico. Las reglas de Firestore lo garantizan.
//
// Datos:  negocios/{id}/clinica/{socioId}                → ficha (antecedentes, obra social, odontograma actual)
//         negocios/{id}/clinica/{socioId}/evoluciones/{id} → registro cronológico; solo se crean, nunca se editan ni borran.
// Cada cambio de ficha u odontograma deja una evolución automática con autor y hora del servidor (historia íntegra e inalterable).
import { getDoc, getDocs, query, orderBy, limit, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { collection, doc } from "./tenant.js";

const D = () => window.DOMINO, $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const habilitado = () => !!(D() && D().negocioDoc && D().negocioDoc.modulos && D().negocioDoc.modulos.odontologia);
const esProfesional = () => ['senior', 'midsenior'].includes(window.rolActual);
const yo = () => String((D().auth && D().auth.currentUser && D().auth.currentUser.email) || D().email || '').toLowerCase();
const fechaTxt = (t) => { const d = t && t.toDate ? t.toDate() : (t ? new Date(t) : null); return d ? d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'guardando…'; };

// ── Odontograma: numeración FDI ─────────────────────────────────────────────
const PERM = { arriba: [[18, 17, 16, 15, 14, 13, 12, 11], [21, 22, 23, 24, 25, 26, 27, 28]], abajo: [[48, 47, 46, 45, 44, 43, 42, 41], [31, 32, 33, 34, 35, 36, 37, 38]] };
const TEMP = { arriba: [[55, 54, 53, 52, 51], [61, 62, 63, 64, 65]], abajo: [[85, 84, 83, 82, 81], [71, 72, 73, 74, 75]] };
const CARA_NOM = { V: 'vestibular', L: 'lingual/palatina', M: 'mesial', D: 'distal', O: 'oclusal/incisal' };
const HERR = [
  { k: 'caries', t: 'Caries', nivel: 'cara', fijo: 'r' },
  { k: 'restauracion', t: 'Restauración', nivel: 'cara' },
  { k: 'sellante', t: 'Sellante', nivel: 'cara' },
  { k: 'corona', t: 'Corona', nivel: 'pieza' },
  { k: 'endodoncia', t: 'Endodoncia', nivel: 'pieza' },
  { k: 'extraccion', t: 'Extracción', nivel: 'pieza', fijo: 'r' },
  { k: 'implante', t: 'Implante', nivel: 'pieza' },
  { k: 'ausente', t: 'Ausente', nivel: 'pieza', fijo: 'g' },
  { k: 'borrar', t: 'Borrar', nivel: 'ambos' }
];
const COL = { r: '#e5484d', a: '#3b82f6', g: '#8a8f98' };
const MODO_TXT = { r: 'a realizar', a: 'existente', g: '' };
const cuad = (p) => Math.floor(p / 10);
const arriba = (p) => [1, 2, 5, 6].includes(cuad(p));
const mesialDerecha = (p) => [1, 4, 5, 8].includes(cuad(p)); // en pantalla: cuadrantes del lado izquierdo del dibujo tienen la mesial a la derecha
// Caras en un cuadrado de 40: arriba, abajo, izquierda, derecha y centro.
const GEO = { t: '2,2 38,2 27,13 13,13', b: '13,27 27,27 38,38 2,38', l: '2,2 13,13 13,27 2,38', r: '38,2 38,38 27,27 27,13', c: '13,13 27,13 27,27 13,27' };
function caraDe(p, zona) {
  if (zona === 'c') return 'O';
  if (zona === 't') return arriba(p) ? 'V' : 'L';
  if (zona === 'b') return arriba(p) ? 'L' : 'V';
  const derecha = zona === 'r';
  return (derecha === mesialDerecha(p)) ? 'M' : 'D';
}

let S = null; // estado de la historia abierta
function nuevaSesion(id, nombre) { return { id, nombre, ficha: {}, odo: {}, odoOrig: '{}', cambios: [], evol: [], herr: 'caries', modo: 'r', denticion: 'permanente', tab: 'odonto', cargando: true }; }

function estilos() {
  if ($('od-css')) return;
  const s = document.createElement('style'); s.id = 'od-css';
  s.textContent = `
  .od-fondo{position:fixed;inset:0;z-index:2100;background:rgba(0,0,0,.82);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:max(12px,env(safe-area-inset-top)) 10px 24px}
  .od-caja{position:relative;width:min(980px,100%);background:var(--bg-panel,#16181c);border:1px solid var(--gold,#d4af37);border-radius:6px;padding:20px 16px 18px;color:var(--text,#f4f1ea)}
  .od-caja h2{margin:0 40px 2px 0;font-family:Cinzel,serif;color:var(--gold-light,#e8c766);font-size:1.25rem}.od-sub{color:var(--text-muted,#a8a396);font-size:.9rem;margin:0}
  .od-x{position:absolute;top:10px;right:10px;width:40px;height:40px;border:1px solid var(--line,#2a2d33);border-radius:6px;background:transparent;color:inherit;font-size:1.1rem;cursor:pointer}
  .od-alerta{margin:12px 0 0;padding:10px 12px;border:1px solid #e5484d;border-radius:6px;background:rgba(229,72,77,.12);color:#ffb3b5;font-weight:600}
  .od-tabs{display:flex;gap:4px;margin:14px 0 12px;border-bottom:1px solid var(--line,#2a2d33);overflow-x:auto}
  .od-tab{flex:1;min-width:max-content;padding:11px 10px;border:0;border-bottom:3px solid transparent;background:transparent;color:var(--text-muted,#a8a396);font-weight:700;font-size:.98rem;cursor:pointer}
  .od-tab[aria-selected=true]{color:var(--gold-light,#e8c766);border-bottom-color:var(--gold,#d4af37)}
  .od-btn{padding:11px 16px;border-radius:6px;border:1px solid var(--gold,#d4af37);background:var(--gold,#d4af37);color:#0a0a0a;font-weight:700;font-size:.98rem;cursor:pointer}
  .od-btn.sec{background:transparent;color:var(--gold-light,#e8c766)}.od-btn:disabled{opacity:.5;cursor:default}
  .od-fila{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.od-fila.fin{justify-content:flex-end;margin-top:14px}
  .od-herr{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
  .od-chip{padding:8px 11px;border-radius:999px;border:1px solid var(--line,#2a2d33);background:transparent;color:inherit;font-size:.9rem;cursor:pointer}
  .od-chip[aria-pressed=true]{border-color:var(--gold,#d4af37);background:rgba(212,175,55,.16);color:var(--gold-light,#e8c766)}
  .od-chip.r[aria-pressed=true]{border-color:#e5484d;background:rgba(229,72,77,.16);color:#ffb3b5}.od-chip.a[aria-pressed=true]{border-color:#3b82f6;background:rgba(59,130,246,.16);color:#bcd5ff}
  .od-arco{overflow-x:auto;padding:4px 0 8px}.od-hilera{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 14px}.od-medio{display:flex;gap:2px}
  .od-pieza{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:.72rem;color:var(--text-muted,#a8a396)}
  .od-pieza svg{width:44px;height:44px;display:block}.od-pieza polygon{fill:#0f1114;stroke:#5b606a;stroke-width:1;cursor:pointer}@media (hover:hover){.od-pieza polygon:hover{stroke:var(--gold,#d4af37);stroke-width:2}}
  .od-sep{height:1px;background:var(--line,#2a2d33);margin:10px 0}
  .od-l{display:block;margin:12px 0 4px;color:var(--text-muted,#a8a396);font-size:.9rem}
  .od-in{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:6px;border:1px solid var(--line,#2a2d33);background:#0f1114;color:inherit;font:inherit}
  textarea.od-in{min-height:84px;resize:vertical}
  .od-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 14px}
  .od-checks{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:4px}.od-checks label{display:flex;gap:6px;align-items:center;font-size:.95rem}
  .od-ev{border:1px solid var(--line,#2a2d33);border-radius:6px;padding:10px 12px;margin-top:8px}
  .od-ev.corregida{opacity:.6}.od-ev .meta{font-size:.82rem;color:var(--text-muted,#a8a396);margin-bottom:4px}.od-ev .txt{white-space:pre-wrap}
  .od-tag{display:inline-block;font-size:.75rem;padding:1px 7px;border-radius:999px;border:1px solid var(--line,#2a2d33);margin-left:6px}
  .od-err{color:#ffb3b5;margin-top:8px}.od-ok{color:#7ee0a3;margin-top:8px}
  .od-pend{font-size:.88rem;color:var(--text-muted,#a8a396);margin-top:6px}
  @media (max-width:760px){.od-caja{padding:16px 10px}.od-pieza svg{width:38px;height:38px}.od-medio{gap:1px}}`;
  document.head.appendChild(s);
}

// ── Caja ────────────────────────────────────────────────────────────────────
function cerrar() { const f = $('od-fondo'); if (f) f.remove(); document.body.style.overflow = ''; }
function intentarCerrar() {
  if (S && S.cambios.length && !confirm('Hay cambios del odontograma sin guardar. ¿Cerrar igual?')) return;
  cerrar();
}
function caja() {
  estilos(); cerrar();
  const f = document.createElement('div'); f.id = 'od-fondo'; f.className = 'od-fondo'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-labelledby', 'od-t');
  f.innerHTML = '<div class="od-caja" id="od-caja"></div>';
  document.body.appendChild(f); document.body.style.overflow = 'hidden';
  f.addEventListener('click', (e) => { if (e.target === f) intentarCerrar(); });
  f.addEventListener('keydown', (e) => { if (e.key === 'Escape') intentarCerrar(); });
  return f;
}

function alertas() {
  const f = S.ficha || {}, a = [];
  if ((f.alergias || '').trim()) a.push('Alergias: ' + f.alergias.trim());
  const c = f.condiciones || {};
  if (c.anticoagulado) a.push('Anticoagulado');
  if (c.embarazo) a.push('Embarazo');
  if (c.cardiopatia) a.push('Cardiopatía');
  if (c.diabetes) a.push('Diabetes');
  return a.length ? `<p class="od-alerta" role="alert">⚠ ${a.map(esc).join(' · ')}</p>` : '';
}

function pintar() {
  const c = $('od-caja'); if (!c) return;
  const os = S.ficha.os || {};
  c.innerHTML = `<button type="button" class="od-x" id="od-x" aria-label="Cerrar">✕</button>
    <h2 id="od-t">Historia clínica</h2><p class="od-sub">${esc(S.nombre)}${os.nombre ? ' · ' + esc(os.nombre) + (os.afiliado ? ' Nº ' + esc(os.afiliado) : '') : ''}</p>
    ${alertas()}
    <div class="od-tabs" role="tablist">
      ${[['odonto', 'Odontograma'], ['evol', 'Evoluciones'], ['ficha', 'Ficha']].map(([k, t]) => `<button type="button" role="tab" class="od-tab" data-tab="${k}" aria-selected="${S.tab === k}">${t}</button>`).join('')}
    </div>
    <div id="od-cuerpo">${S.cargando ? '<p>Cargando historia clínica…</p>' : S.tab === 'odonto' ? vOdonto() : S.tab === 'evol' ? vEvol() : vFicha()}</div>
    <div class="od-fila fin"><button type="button" class="od-btn sec" id="od-pdf"${S.cargando ? ' disabled' : ''}>Exportar historia en PDF</button></div>`;
  $('od-x').onclick = intentarCerrar;
  c.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { S.tab = b.dataset.tab; pintar(); });
  $('od-pdf').onclick = exportarPDF;
  if (S.cargando) return;
  if (S.tab === 'odonto') enlazarOdonto(); else if (S.tab === 'evol') enlazarEvol(); else enlazarFicha();
}

// ── Odontograma ─────────────────────────────────────────────────────────────
function svgPieza(p) {
  const d = S.odo[p] || {}, caras = d.caras || {}, pz = d.pieza;
  const fill = (z) => { const cr = caras[caraDe(p, z)]; return cr ? `style="fill:${COL[cr.c] || COL.r};fill-opacity:${cr.t === 'sellante' ? .45 : .9}"` : ''; };
  let extra = '';
  if (pz) {
    const col = COL[pz.c] || COL.r;
    if (pz.t === 'ausente' || pz.t === 'extraccion') extra = `<path d="M3 3 L37 37 M37 3 L3 37" stroke="${col}" stroke-width="4" stroke-linecap="round" pointer-events="none"/>`;
    else if (pz.t === 'corona') extra = `<circle cx="20" cy="20" r="18.5" fill="none" stroke="${col}" stroke-width="3" pointer-events="none"/>`;
    else if (pz.t === 'endodoncia') extra = `<path d="M20 1 L20 39" stroke="${col}" stroke-width="4" pointer-events="none"/>`;
    else if (pz.t === 'implante') extra = `<rect x="1" y="1" width="38" height="38" fill="none" stroke="${col}" stroke-width="3" stroke-dasharray="4 3" pointer-events="none"/><text x="20" y="25" text-anchor="middle" font-size="13" font-weight="700" fill="${col}" pointer-events="none">I</text>`;
  }
  return `<div class="od-pieza"><svg viewBox="0 0 40 40" role="group" aria-label="Pieza ${p}">${['t', 'b', 'l', 'r', 'c'].map((z) => `<polygon points="${GEO[z]}" data-p="${p}" data-z="${z}" ${fill(z)}><title>Pieza ${p}, cara ${CARA_NOM[caraDe(p, z)]}</title></polygon>`).join('')}${extra}</svg><span>${p}</span></div>`;
}
function hilera(par) { return `<div class="od-hilera">${par.map((lado) => `<div class="od-medio">${lado.map(svgPieza).join('')}</div>`).join('')}</div>`; }
function arcos() {
  const tipos = S.denticion === 'mixta' ? [PERM, TEMP] : [S.denticion === 'temporal' ? TEMP : PERM];
  return tipos.map((T) => `<div class="od-arco">${hilera(T.arriba)}<div class="od-sep"></div>${hilera(T.abajo)}</div>`).join('<div style="height:10px"></div>');
}
function vOdonto() {
  const h = HERR.find((x) => x.k === S.herr) || HERR[0];
  return `<div class="od-fila"><span class="od-sub">Dentición:</span>${[['permanente', 'Permanente'], ['temporal', 'Temporal'], ['mixta', 'Mixta']].map(([k, t]) => `<button type="button" class="od-chip" data-den="${k}" aria-pressed="${S.denticion === k}">${t}</button>`).join('')}</div>
    <div class="od-herr" role="group" aria-label="Qué marcar">${HERR.map((x) => `<button type="button" class="od-chip" data-herr="${x.k}" aria-pressed="${S.herr === x.k}">${x.t}</button>`).join('')}</div>
    <div class="od-fila" ${h.fijo || h.k === 'borrar' ? 'hidden' : ''}><button type="button" class="od-chip r" data-modo="r" aria-pressed="${S.modo === 'r'}">Rojo: a realizar</button><button type="button" class="od-chip a" data-modo="a" aria-pressed="${S.modo === 'a'}">Azul: existente</button></div>
    <p class="od-pend">${h.nivel === 'pieza' ? 'Toque cualquier parte de la pieza.' : h.nivel === 'cara' ? 'Toque la cara de la pieza.' : 'Toque una cara para borrarla; tóquela otra vez para borrar la marca de la pieza.'}</p>
    ${arcos()}
    <div class="od-pend" id="od-cambios">${S.cambios.length ? '<b>Sin guardar:</b> ' + S.cambios.map(esc).join(' · ') : 'Sin cambios pendientes.'}</div>
    <div class="od-fila fin"><button type="button" class="od-btn sec" id="od-deshacer"${S.cambios.length ? '' : ' disabled'}>Descartar cambios</button><button type="button" class="od-btn" id="od-guardar-odo"${S.cambios.length ? '' : ' disabled'}>Guardar odontograma</button></div>
    <div id="od-msg"></div>`;
}
function marcar(p, z) {
  const h = HERR.find((x) => x.k === S.herr); if (!h) return;
  const cara = caraDe(p, z), d = S.odo[p] || (S.odo[p] = {}), color = h.fijo || S.modo;
  d.caras = d.caras || {};
  if (h.k === 'borrar') {
    if (d.caras[cara]) { const v = d.caras[cara]; delete d.caras[cara]; S.cambios.push(`Pieza ${p}, cara ${CARA_NOM[cara]}: se quitó ${v.t}`); }
    else if (d.pieza) { const v = d.pieza; delete d.pieza; S.cambios.push(`Pieza ${p}: se quitó ${v.t}`); }
    else return;
  } else if (h.nivel === 'cara') {
    d.caras[cara] = { t: h.k, c: color };
    S.cambios.push(`Pieza ${p}, cara ${CARA_NOM[cara]}: ${h.t.toLowerCase()}${MODO_TXT[color] ? ' (' + MODO_TXT[color] + ')' : ''}`);
  } else {
    d.pieza = { t: h.k, c: color };
    S.cambios.push(`Pieza ${p}: ${h.t.toLowerCase()}${MODO_TXT[color] ? ' (' + MODO_TXT[color] + ')' : ''}`);
  }
  if (!Object.keys(d.caras).length) delete d.caras;
  if (!d.caras && !d.pieza) delete S.odo[p];
  const y = window.scrollY, cuerpo = $('od-fondo') && $('od-fondo').scrollTop;
  pintar(); if ($('od-fondo')) $('od-fondo').scrollTop = cuerpo; window.scrollTo(0, y);
}
function enlazarOdonto() {
  const c = $('od-caja');
  c.querySelectorAll('[data-den]').forEach((b) => b.onclick = () => { S.denticion = b.dataset.den; pintar(); });
  c.querySelectorAll('[data-herr]').forEach((b) => b.onclick = () => { S.herr = b.dataset.herr; pintar(); });
  c.querySelectorAll('[data-modo]').forEach((b) => b.onclick = () => { S.modo = b.dataset.modo; pintar(); });
  c.querySelectorAll('polygon[data-p]').forEach((pg) => pg.addEventListener('click', () => marcar(Number(pg.dataset.p), pg.dataset.z)));
  $('od-deshacer').onclick = () => { if (!confirm('¿Descartar los cambios sin guardar?')) return; S.odo = JSON.parse(S.odoOrig); S.cambios = []; pintar(); };
  $('od-guardar-odo').onclick = guardarOdonto;
}
async function guardarOdonto() {
  const b = $('od-guardar-odo'); b.disabled = true; b.textContent = 'Guardando…';
  const texto = 'Odontograma actualizado:\n' + S.cambios.map((x) => '• ' + x).join('\n');
  try {
    await escribir({ odontograma: S.odo, denticion: S.denticion }, ['odontograma', 'denticion'], { tipo: 'odontograma', texto });
    S.odoOrig = JSON.stringify(S.odo); S.cambios = []; pintar(); $('od-msg').innerHTML = '<p class="od-ok">Odontograma guardado. El cambio quedó registrado en Evoluciones.</p>';
  } catch (e) { console.error(e); b.disabled = false; b.textContent = 'Guardar odontograma'; $('od-msg').innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
}

// ── Escritura: ficha + evolución automática, en un solo paso ─────────────────
async function escribir(campos, nombres, evol) {
  const db = D().db, b = writeBatch(db);
  const ref = doc(db, 'clinica', S.id);
  b.set(ref, Object.assign({}, campos, { socio_id: S.id, actualizado: serverTimestamp(), actualizado_por: yo() }), { mergeFields: nombres.concat(['socio_id', 'actualizado', 'actualizado_por']) });
  const eref = doc(collection(db, 'clinica', S.id, 'evoluciones'));
  const ev = Object.assign({ autor: yo(), autor_nombre: window.nombreDisplay || '', fecha: serverTimestamp() }, evol);
  b.set(eref, ev);
  await b.commit();
  S.evol.unshift(Object.assign({ id: eref.id }, ev, { fecha: new Date() }));
  Object.assign(S.ficha, campos);
}
const errTxt = (e) => /permission/i.test(String(e && (e.code || e.message))) ? 'No tiene permiso para guardar en la historia clínica (solo profesionales, con el módulo activo).' : 'No se pudo guardar. Revise su conexión e intente de nuevo.';

// ── Evoluciones ─────────────────────────────────────────────────────────────
const TIPO_TXT = { evolucion: 'Evolución', odontograma: 'Odontograma', ficha: 'Ficha', correccion: 'Corrección' };
function vEvol() {
  const corregidas = new Set(S.evol.filter((e) => e.corrige).map((e) => e.corrige));
  return `<form id="od-ev-form" novalidate>
      <label class="od-l" for="od-ev-txt">Nueva evolución</label>
      <textarea class="od-in" id="od-ev-txt" maxlength="8000" placeholder="Ej.: Pieza 36: obturación oclusal con resina. Paciente sin dolor. Control en 6 meses."></textarea>
      <div class="od-grid"><div><label class="od-l" for="od-ev-pz">Piezas (opcional)</label><input class="od-in" id="od-ev-pz" inputmode="numeric" placeholder="Ej.: 36, 37"></div></div>
      <div class="od-fila fin"><button type="submit" class="od-btn" id="od-ev-ok">Agregar evolución</button></div>
      <p class="od-pend">Las evoluciones no se pueden editar ni borrar: para corregir una, use «Corregir» y queda registrada la corrección.</p>
      <div id="od-msg"></div></form>
    ${S.evol.length ? S.evol.map((e) => `<div class="od-ev ${corregidas.has(e.id) ? 'corregida' : ''}">
        <div class="meta">${esc(fechaTxt(e.fecha))} · ${esc(e.autor_nombre || e.autor)}<span class="od-tag">${esc(TIPO_TXT[e.tipo] || e.tipo)}</span>${e.piezas ? `<span class="od-tag">Piezas ${esc(e.piezas)}</span>` : ''}${corregidas.has(e.id) ? '<span class="od-tag">Corregida</span>' : ''}</div>
        ${e.corrige ? `<div class="meta">Corrige la evolución del ${esc(fechaTxt((S.evol.find((x) => x.id === e.corrige) || {}).fecha))}</div>` : ''}
        <div class="txt">${esc(e.texto)}</div>
        ${e.tipo !== 'correccion' && !corregidas.has(e.id) ? `<div class="od-fila fin" style="margin-top:6px"><button type="button" class="od-btn sec" data-corr="${esc(e.id)}" style="padding:7px 12px">Corregir</button></div>` : ''}
      </div>`).join('') : '<p class="od-sub" style="margin-top:12px">Todavía no hay evoluciones.</p>'}`;
}
function enlazarEvol() {
  $('od-ev-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const t = $('od-ev-txt').value.trim(), pz = ($('od-ev-pz').value || '').replace(/[^0-9, ]/g, '').trim();
    if (!t) { $('od-msg').innerHTML = '<p class="od-err">Escriba la evolución.</p>'; return; }
    const b = $('od-ev-ok'); b.disabled = true; b.textContent = 'Guardando…';
    try { await escribirEvol(Object.assign({ tipo: 'evolucion', texto: t }, pz ? { piezas: pz } : {})); pintar(); }
    catch (e) { console.error(e); b.disabled = false; b.textContent = 'Agregar evolución'; $('od-msg').innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
  };
  $('od-caja').querySelectorAll('[data-corr]').forEach((b) => b.onclick = async () => {
    const orig = S.evol.find((x) => x.id === b.dataset.corr); if (!orig) return;
    const t = prompt('Escriba la versión corregida. La evolución original queda guardada y marcada como corregida.', orig.texto);
    if (t === null || !t.trim() || t.trim() === orig.texto) return;
    b.disabled = true;
    try { await escribirEvol({ tipo: 'correccion', texto: t.trim(), corrige: orig.id }); pintar(); }
    catch (e) { console.error(e); b.disabled = false; alert(errTxt(e)); }
  });
}
async function escribirEvol(evol) {
  const db = D().db, eref = doc(collection(db, 'clinica', S.id, 'evoluciones'));
  const ev = Object.assign({ autor: yo(), autor_nombre: window.nombreDisplay || '', fecha: serverTimestamp() }, evol);
  const b = writeBatch(db); b.set(eref, ev);
  // La ficha existe siempre que haya evoluciones (para que el centro sepa qué socios tienen historia clínica).
  b.set(doc(db, 'clinica', S.id), { socio_id: S.id, actualizado: serverTimestamp(), actualizado_por: yo() }, { merge: true });
  await b.commit();
  S.evol.unshift(Object.assign({ id: eref.id }, ev, { fecha: new Date() }));
}

// ── Ficha y antecedentes ────────────────────────────────────────────────────
const CONDS = [['diabetes', 'Diabetes'], ['hipertension', 'Hipertensión'], ['cardiopatia', 'Cardiopatía'], ['anticoagulado', 'Toma anticoagulantes'], ['embarazo', 'Embarazo'], ['fumador', 'Fuma'], ['bruxismo', 'Bruxismo']];
const CAMPOS_TXT = [['motivo', 'Motivo de la primera consulta'], ['alergias', 'Alergias (medicamentos, anestesia, látex…)'], ['medicacion', 'Medicación actual'], ['enfermedades', 'Otras enfermedades o cirugías'], ['observaciones', 'Observaciones']];
function vFicha() {
  const f = S.ficha || {}, os = f.os || {}, c = f.condiciones || {};
  return `<form id="od-fi" novalidate>
    <div class="od-grid">
      <div><label class="od-l" for="od-os">Obra social o prepaga</label><input class="od-in" id="od-os" value="${esc(os.nombre)}" placeholder="Particular si no tiene"></div>
      <div><label class="od-l" for="od-os-plan">Plan</label><input class="od-in" id="od-os-plan" value="${esc(os.plan)}"></div>
      <div><label class="od-l" for="od-os-af">Número de afiliado</label><input class="od-in" id="od-os-af" value="${esc(os.afiliado)}"></div>
      <div><label class="od-l" for="od-nac">Fecha de nacimiento</label><input class="od-in" type="date" id="od-nac" value="${esc(f.nacimiento)}"></div>
    </div>
    <label class="od-l">Condiciones de salud</label>
    <div class="od-checks">${CONDS.map(([k, t]) => `<label><input type="checkbox" data-cond="${k}" ${c[k] ? 'checked' : ''}> ${t}</label>`).join('')}</div>
    ${CAMPOS_TXT.map(([k, t]) => `<label class="od-l" for="od-f-${k}">${t}</label><textarea class="od-in" id="od-f-${k}" maxlength="3000" style="min-height:${k === 'alergias' ? 56 : 70}px">${esc(f[k])}</textarea>`).join('')}
    <div class="od-fila fin"><button type="submit" class="od-btn" id="od-fi-ok">Guardar ficha</button></div>
    <p class="od-pend">Cada cambio de la ficha queda registrado en Evoluciones, con quién lo hizo y cuándo.</p>
    <div id="od-msg"></div></form>`;
}
function enlazarFicha() {
  $('od-fi').onsubmit = async (ev) => {
    ev.preventDefault();
    const antes = S.ficha || {}, nuevo = {
      os: { nombre: $('od-os').value.trim(), plan: $('od-os-plan').value.trim(), afiliado: $('od-os-af').value.trim() },
      nacimiento: $('od-nac').value || '',
      condiciones: Object.fromEntries(CONDS.map(([k]) => [k, !!document.querySelector(`[data-cond="${k}"]`).checked]))
    };
    CAMPOS_TXT.forEach(([k]) => { nuevo[k] = $('od-f-' + k).value.trim(); });
    const cambios = [];
    const osA = antes.os || {};
    if ((osA.nombre || '') !== nuevo.os.nombre || (osA.plan || '') !== nuevo.os.plan || (osA.afiliado || '') !== nuevo.os.afiliado) cambios.push(`Obra social: ${[nuevo.os.nombre || 'sin dato', nuevo.os.plan, nuevo.os.afiliado ? 'Nº ' + nuevo.os.afiliado : ''].filter(Boolean).join(' · ')}`);
    if ((antes.nacimiento || '') !== nuevo.nacimiento) cambios.push('Fecha de nacimiento: ' + (nuevo.nacimiento ? nuevo.nacimiento.split('-').reverse().join('/') : 'sin dato'));
    CONDS.forEach(([k, t]) => { const a = !!(antes.condiciones || {})[k], n = nuevo.condiciones[k]; if (a !== n) cambios.push(`${t}: ${n ? 'sí' : 'no'}`); });
    CAMPOS_TXT.forEach(([k, t]) => { if ((antes[k] || '') !== nuevo[k]) cambios.push(`${t.replace(/ \(.*\)$/, '')}: ${nuevo[k] || '(vacío)'}`); });
    if (!cambios.length) { $('od-msg').innerHTML = '<p class="od-pend">No hay cambios para guardar.</p>'; return; }
    const b = $('od-fi-ok'); b.disabled = true; b.textContent = 'Guardando…';
    try {
      await escribir(nuevo, ['os', 'nacimiento', 'condiciones'].concat(CAMPOS_TXT.map(([k]) => k)), { tipo: 'ficha', texto: 'Ficha actualizada:\n' + cambios.map((x) => '• ' + x).join('\n') });
      pintar(); $('od-msg').innerHTML = '<p class="od-ok">Ficha guardada.</p>';
    } catch (e) { console.error(e); b.disabled = false; b.textContent = 'Guardar ficha'; $('od-msg').innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; }
  };
}

// ── Abrir ───────────────────────────────────────────────────────────────────
async function abrir(id, nombre) {
  if (!habilitado() || !esProfesional()) return;
  S = nuevaSesion(id, nombre); caja(); pintar();
  try {
    const db = D().db;
    const [f, ev] = await Promise.all([getDoc(doc(db, 'clinica', id)), getDocs(query(collection(db, 'clinica', id, 'evoluciones'), orderBy('fecha', 'desc'), limit(500)))]);
    const data = f.exists() ? f.data() : {};
    S.ficha = data; S.odo = data.odontograma || {}; S.odoOrig = JSON.stringify(S.odo); S.denticion = data.denticion || 'permanente';
    S.evol = ev.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    S.cargando = false; pintar();
  } catch (e) {
    console.error(e);
    const c = $('od-cuerpo'); if (c) c.innerHTML = `<p class="od-err">${/permission/i.test(String(e.code || e.message)) ? 'Su usuario no puede ver historias clínicas (solo profesionales).' : 'No se pudo cargar la historia clínica. Revise su conexión.'}</p>`;
  }
}
window.abrirHistoriaClinica = abrir;
window.odEstilos = estilos;

// ── PDF de la historia (para entregar copia al paciente) ────────────────────
function cargarPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  return new Promise((ok, mal) => { const s = document.createElement('script'); s.src = 'libs/pdf-lib.min.js'; s.onload = () => ok(window.PDFLib); s.onerror = mal; document.head.appendChild(s); });
}
const ansi = (t) => String(t ?? '').replace(/[•]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
async function exportarPDF() {
  const b = $('od-pdf'); if (b) { b.disabled = true; b.textContent = 'Armando PDF…'; }
  try {
    const { PDFDocument, StandardFonts, rgb } = await cargarPdfLib();
    let socio = {};
    try { const s = await getDoc(doc(D().db, 'clients', S.id)); socio = s.exists() ? s.data() : {}; } catch (e) { /* sin datos extra */ }
    const pdf = await PDFDocument.create(), fR = await pdf.embedFont(StandardFonts.Helvetica), fB = await pdf.embedFont(StandardFonts.HelveticaBold);
    const W = 595.28, H = 841.89, M = 48, tinta = rgb(.08, .08, .08), gris = rgb(.42, .42, .42), oro = rgb(.48, .37, .05);
    let pg = pdf.addPage([W, H]), y = H - M;
    const nueva = () => { pg = pdf.addPage([W, H]); y = H - M; };
    const lineas = (t, f, s, ancho) => {
      const out = [];
      ansi(t).split('\n').forEach((par) => {
        let l = '';
        par.split(' ').forEach((w) => { const p = l ? l + ' ' + w : w; if (f.widthOfTextAtSize(p, s) > ancho && l) { out.push(l); l = w; } else l = p; });
        out.push(l);
      });
      return out;
    };
    const texto = (t, o = {}) => {
      const f = o.b ? fB : fR, s = o.s || 10, x = o.x || M, ancho = o.w || (W - M - x);
      lineas(t, f, s, ancho).forEach((l) => { if (y < M + 30) nueva(); pg.drawText(l, { x, y, size: s, font: f, color: o.c || tinta }); y -= s * 1.35; });
    };
    const titulo = (t) => { y -= 6; if (y < M + 60) nueva(); texto(t, { b: true, s: 12, c: oro }); pg.drawLine({ start: { x: M, y: y + 9 }, end: { x: W - M, y: y + 9 }, thickness: .6, color: oro }); y -= 4; };

    const neg = (D().negocioDoc && D().negocioDoc.nombre) || (window.DOMINO_NEGOCIO && window.DOMINO_NEGOCIO.nombre) || '';
    texto('Historia clínica odontológica', { b: true, s: 17 });
    if (neg) texto(neg, { s: 11, c: gris });
    y -= 6;
    const f = S.ficha || {}, os = f.os || {};
    texto('Paciente: ' + (socio.nombre_empresa || S.nombre), { b: true, s: 11 });
    if (socio.cuit) texto('DNI: ' + socio.cuit);
    if (f.nacimiento) texto('Fecha de nacimiento: ' + f.nacimiento.split('-').reverse().join('/'));
    texto('Obra social: ' + ([os.nombre, os.plan, os.afiliado ? 'Nº ' + os.afiliado : ''].filter(Boolean).join(' · ') || 'Particular / sin dato'));
    texto('Emitida el ' + new Date().toLocaleString('es-AR') + ' por ' + (window.nombreDisplay || yo()), { c: gris, s: 9 });

    titulo('Antecedentes');
    const conds = CONDS.filter(([k]) => (f.condiciones || {})[k]).map(([, t]) => t);
    texto('Condiciones: ' + (conds.join(', ') || 'ninguna registrada'));
    CAMPOS_TXT.forEach(([k, t]) => { if (f[k]) texto(t.replace(/ \(.*\)$/, '') + ': ' + f[k]); });

    titulo('Odontograma');
    // Dibujo: mismas caras que en la app, 22 pt por pieza.
    const dib = (arco, x0) => {
      const tam = 20, gap = 2.5;
      [arco.arriba, arco.abajo].forEach((fila, fi) => {
        if (y < M + 60) nueva();
        let x = x0;
        fila.forEach((lado, li) => {
          lado.forEach((p) => {
            const d = S.odo[p] || {}, caras = d.caras || {}, pz = d.pieza;
            ['t', 'b', 'l', 'r', 'c'].forEach((z) => {
              const cr = caras[caraDe(p, z)], pts = GEO[z].split(' ').map((q) => q.split(',').map(Number));
              const path = 'M ' + pts.map(([a, bb]) => (a * tam / 40) + ' ' + (bb * tam / 40)).join(' L ') + ' Z';
              const col = cr ? (cr.c === 'a' ? rgb(.23, .51, .96) : cr.c === 'g' ? rgb(.54, .56, .6) : rgb(.9, .28, .3)) : undefined;
              pg.drawSvgPath(path, { x, y, borderColor: rgb(.45, .45, .45), borderWidth: .5, color: col, opacity: cr && cr.t === 'sellante' ? .5 : 1 });
            });
            if (pz) {
              const col = pz.c === 'a' ? rgb(.23, .51, .96) : pz.c === 'g' ? rgb(.54, .56, .6) : rgb(.9, .28, .3);
              if (pz.t === 'ausente' || pz.t === 'extraccion') { pg.drawLine({ start: { x, y }, end: { x: x + tam, y: y - tam }, thickness: 1.6, color: col }); pg.drawLine({ start: { x: x + tam, y }, end: { x, y: y - tam }, thickness: 1.6, color: col }); }
              else if (pz.t === 'corona') pg.drawEllipse({ x: x + tam / 2, y: y - tam / 2, xScale: tam / 2, yScale: tam / 2, borderColor: col, borderWidth: 1.4 });
              else if (pz.t === 'endodoncia') pg.drawLine({ start: { x: x + tam / 2, y }, end: { x: x + tam / 2, y: y - tam }, thickness: 1.8, color: col });
              else if (pz.t === 'implante') pg.drawText('I', { x: x + tam / 2 - 2, y: y - tam / 2 - 3, size: 9, font: fB, color: col });
            }
            pg.drawText(String(p), { x: x + 4, y: y - tam - 8, size: 6.5, font: fR, color: gris });
            x += tam + gap;
          });
          if (li === 0) x += 8;
        });
        y -= tam + 16;
      });
      y -= 4;
    };
    const anchoArco = (arco) => arco.arriba.flat().length * 22.5 + 8;
    const arcosPdf = S.denticion === 'mixta' ? [PERM, TEMP] : [S.denticion === 'temporal' ? TEMP : PERM];
    arcosPdf.forEach((A) => dib(A, (W - anchoArco(A)) / 2));
    texto('Rojo: a realizar · Azul: existente · Gris: ausente', { s: 8, c: gris, x: M });
    const hall = [];
    Object.keys(S.odo).map(Number).sort((a, bb) => a - bb).forEach((p) => {
      const d = S.odo[p] || {};
      if (d.pieza) hall.push(`Pieza ${p}: ${(HERR.find((h) => h.k === d.pieza.t) || { t: d.pieza.t }).t.toLowerCase()}${MODO_TXT[d.pieza.c] ? ' (' + MODO_TXT[d.pieza.c] + ')' : ''}`);
      Object.entries(d.caras || {}).forEach(([cara, v]) => hall.push(`Pieza ${p}, cara ${CARA_NOM[cara]}: ${(HERR.find((h) => h.k === v.t) || { t: v.t }).t.toLowerCase()}${MODO_TXT[v.c] ? ' (' + MODO_TXT[v.c] + ')' : ''}`));
    });
    texto(hall.length ? hall.join('\n') : 'Sin hallazgos registrados.', { s: 9.5 });

    titulo('Evoluciones');
    const lista = S.evol.slice().reverse();
    if (!lista.length) texto('Sin evoluciones registradas.');
    lista.forEach((e) => {
      if (y < M + 70) nueva();
      texto(`${fechaTxt(e.fecha)} · ${e.autor_nombre || e.autor} · ${TIPO_TXT[e.tipo] || e.tipo}${e.piezas ? ' · Piezas ' + e.piezas : ''}`, { b: true, s: 9.5 });
      texto(e.texto, { s: 9.5 });
      y -= 4;
    });

    const pags = pdf.getPages();
    pags.forEach((p, i) => {
      p.drawText(ansi(`Página ${i + 1} de ${pags.length} · Documento generado desde DOMino Bienestar · Desarrollado por The DOM Studio Web · WhatsApp 261-3431216`), { x: M, y: 24, size: 7, font: fR, color: gris });
    });
    const bytes = await pdf.save();
    const nom = ('Historia clinica - ' + (socio.nombre_empresa || S.nombre)).replace(/[\\/:*?"<>|]/g, '').slice(0, 80) + '.pdf';
    const file = new File([bytes], nom, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: nom }); } catch (e) { /* cancelado */ } }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = nom; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  } catch (e) { console.error(e); alert('No se pudo armar el PDF. Intente de nuevo.'); }
  if (b) { b.disabled = false; b.textContent = 'Exportar historia en PDF'; }
}

// ── Botón en la ficha del socio ─────────────────────────────────────────────
let actual = { id: null, nombre: '' };
function engancharFicha() {
  if (window.__odFicha || typeof window.abrirExpediente !== 'function') return;
  window.__odFicha = true;
  const orig = window.abrirExpediente;
  window.abrirExpediente = function (id, nombre) { actual = { id, nombre }; const r = orig.apply(this, arguments); ponerBoton(); return r; };
}
function ponerBoton() {
  const zona = document.querySelector('#vista-expediente .topbar-right'); if (!zona) return;
  let b = $('od-btn-hc');
  if (!habilitado() || !esProfesional()) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement('button'); b.id = 'od-btn-hc'; b.type = 'button'; b.className = 'btn-primary'; b.textContent = '🦷 Historia clínica';
    b.onclick = () => actual.id && abrir(actual.id, actual.nombre);
    zona.insertBefore(b, zona.firstChild);
  }
}
// ── Vocabulario de consultorio: en un centro con el módulo Odontología se habla de pacientes, no de socios ──
const VOCAB = [
  [/Todo su centro de bienestar en un solo lugar: clases, turnos y socios a un toque\./g, 'Todo su consultorio en un solo lugar: turnos, pacientes, historias clínicas y cobros.'],
  [/ \(en gimnasios, también cuotas y aptos médicos\)/g, ''],
  [/avisar vencimiento de cuota/g, 'llamar para un control'],
  [/Cuotas por vencer, renovaciones y pendientes, por estado\./g, 'Pendientes y avisos con los pacientes, por estado.'],
  [/Vencimientos de cuotas y renovaciones del mes, día por día\./g, 'Turnos y avisos del mes, día por día.'],
  [/Cargar aptos médicos, planes y fichas/g, 'Cargar estudios, planes y fichas'],
  [/centro de bienestar/g, 'consultorio'], [/Centro de bienestar/g, 'Consultorio'],
  [/Profesor\/a o profesional/g, 'Profesional'], [/\bProfesores\b/g, 'Profesionales'], [/\bprofesores\b/g, 'profesionales'],
  [/\bSOCIOS\b/g, 'PACIENTES'], [/\bSocios\b/g, 'Pacientes'], [/\bsocios\b/g, 'pacientes'],
  [/\bSOCIO\b/g, 'PACIENTE'], [/\bSocio\b/g, 'Paciente'], [/\bsocio\b/g, 'paciente']
];
const cambiar = (t) => { let r = t; for (const [re, v] of VOCAB) r = r.replace(re, v); return r; };
function traducirNodo(raiz) {
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodos = []; while (w.nextNode()) nodos.push(w.currentNode);
  nodos.forEach((n) => { if (/ocio|rofesor|bienestar|uota|aptos/i.test(n.nodeValue)) { const v = cambiar(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } });
  const els = raiz.querySelectorAll ? raiz.querySelectorAll('[placeholder],[aria-label],[title]') : [];
  [raiz].concat([...els]).forEach((el) => { if (!el.getAttribute) return; ['placeholder', 'aria-label', 'title'].forEach((at) => { const v = el.getAttribute(at); if (v && /ocio|rofesor/i.test(v)) { const n = cambiar(v); if (n !== v) el.setAttribute(at, n); } }); });
}
function vocabulario() {
  if (window.__odVocab) return; window.__odVocab = true;
  document.title = cambiar(document.title);
  traducirNodo(document.body);
  const nativos = { confirm: window.confirm, alert: window.alert, prompt: window.prompt };
  window.confirm = (m) => nativos.confirm.call(window, cambiar(String(m ?? '')));
  window.alert = (m) => nativos.alert.call(window, cambiar(String(m ?? '')));
  window.prompt = (m, d) => nativos.prompt.call(window, cambiar(String(m ?? '')), d);
  let pend = null;
  new MutationObserver((ms) => {
    ms.forEach((m) => { if (m.type === 'characterData') { const n = m.target; if (/ocio|rofesor|bienestar/i.test(n.nodeValue)) { const v = cambiar(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } } else m.addedNodes.forEach((n) => { if (n.nodeType === 1) traducirNodo(n); else if (n.nodeType === 3 && /ocio|rofesor|bienestar/i.test(n.nodeValue)) { const v = cambiar(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } }); });
    clearTimeout(pend); pend = setTimeout(() => traducirNodo(document.body), 120);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

function iniciar() { if (!habilitado()) return; vocabulario(); engancharFicha(); ponerBoton(); }
window.addEventListener('domino:listo', iniciar);
if (D() && D().listo) iniciar();
