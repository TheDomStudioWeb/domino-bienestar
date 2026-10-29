// DOMino Bienestar · Datos del negocio y actividades.
// La primera vez que entra la Dirección, carga el nombre del negocio y elige qué actividades realiza (gimnasio, clases, spa, peluquería…).
// Se guarda en Firestore: config/negocio. El catálogo de actividades sale de turnos/catalogo-actividades.json (ver actividades-datos.js).
// Para sumar una actividad nueva: agregarla al catálogo y correr  node alta/sincronizar-catalogo.js  (no se toca nada más).
import { getDoc, setDoc, updateDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { llamar, sesionAgenda, guardarSesionAgenda, abrirSesionAgenda } from "./turnos/api.js";
import { collection, doc } from "./tenant.js";

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
  .bn-tabs{display:flex;gap:6px;margin:18px 0 4px;border-bottom:1px solid var(--line,#2a2d33)}.bn-tab{flex:1;padding:12px 10px;border:0;border-bottom:3px solid transparent;background:transparent;color:var(--text-muted,#a8a396);font-weight:700;font-size:1rem;cursor:pointer}.bn-tab[aria-selected=true]{color:var(--gold-light,#e8c766);border-bottom-color:var(--gold,#d4af37)}
  .bn-logo-fila{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.bn-logo-prev{width:96px;height:96px;border:1px dashed var(--line,#2a2d33);border-radius:10px;display:grid;place-items:center;background:repeating-conic-gradient(#ffffff10 0 25%,transparent 0 50%) 0 0/16px 16px;overflow:hidden;flex:none}.bn-logo-prev img{max-width:88px;max-height:88px;object-fit:contain}.bn-logo-prev span{font-size:.8rem;color:var(--text-muted,#a8a396)}
  .bn-sal{display:flex;gap:10px;align-items:flex-end}.bn-hab{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:.8rem;color:var(--text-muted,#a8a396);cursor:pointer;min-width:84px}.bn-hab input{width:24px;height:24px;accent-color:#4CC38A}.bn-sal:has(.bn-hab input:not(:checked)) input[type=text]{opacity:.55;text-decoration:line-through}
  .bn-x{position:sticky;top:0;float:right;margin:-8px -6px 0 8px;width:44px;height:44px;border-radius:50%;border:1px solid var(--line,#2a2d33);background:var(--bg-base,#0a0a0a);color:var(--text-main,#f4f1ea);font-size:1.1rem;cursor:pointer;z-index:2}
  .bn-caja{background:var(--bg-panel,#16181c);border:1px solid var(--hairline,#d4af3740);border-radius:12px;width:100%;max-width:560px;margin:auto;padding:22px 20px;color:var(--text-main,#f4f1ea)}
  .bn-caja h2{font-family:Cinzel,serif;font-size:1.35rem;margin:0 0 6px;color:var(--gold-light,#e8c766)}
  .bn-caja p{margin:0 0 12px;color:var(--text-muted,#a8a396);line-height:1.5}
  .bn-caja label.bn-l{display:block;margin:14px 0 6px;font-weight:600}
  .bn-caja input[type=text],.bn-caja input[type=tel],.bn-caja input[type=password]{width:100%;padding:12px;border-radius:8px;border:1px solid var(--line,#2a2d33);background:var(--bg-base,#0a0a0a);color:inherit;font-size:1rem}
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


// ── Logo del centro: se guarda en la ficha del centro (config/negocio) como imagen embebida, sin necesidad de Storage ──
// PNG: se achica a 256 px como máximo. SVG: se guarda tal cual (hasta 150 KB); en <img> los scripts de un SVG no se ejecutan.
function prepararLogo(file) {
  return new Promise((ok, mal) => {
    const esSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name), esPng = /png/i.test(file.type) || /\.png$/i.test(file.name);
    if (!esSvg && !esPng) return mal(new Error('El logo tiene que ser PNG o SVG.'));
    if (file.size > 3 * 1024 * 1024) return mal(new Error('El archivo es muy pesado (máximo 3 MB).'));
    const r = new FileReader();
    r.onerror = () => mal(new Error('No se pudo leer el archivo.'));
    if (esSvg) {
      if (file.size > 150 * 1024) return mal(new Error('El SVG es muy pesado (máximo 150 KB). Pruebe con un PNG.'));
      r.onload = () => { const t = String(r.result); if (!/<svg[\s>]/i.test(t)) return mal(new Error('El archivo no parece un SVG válido.')); ok('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(t)))); };
      r.readAsText(file);
    } else {
      r.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 256 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); const url = c.toDataURL('image/png'); url.length > 700000 ? mal(new Error('El logo quedó muy pesado. Pruebe con una imagen más simple.')) : ok(url); }; img.onerror = () => mal(new Error('No se pudo abrir la imagen.')); img.src = String(r.result); };
      r.readAsDataURL(file);
    }
  });
}
function aplicarLogo() {
  const url = negocio && negocio.logo;
  document.querySelectorAll('.brand-icon').forEach((el) => {
    if (!el.dataset.orig) el.dataset.orig = el.getAttribute('src') || '';
    if (url && /^data:image\/(png|svg\+xml);base64,/.test(url)) { el.src = url; el.alt = (negocio && negocio.nombre) || 'Logo'; el.removeAttribute('width'); el.removeAttribute('height'); el.style.height = '38px'; el.style.width = 'auto'; el.style.maxWidth = '120px'; el.style.objectFit = 'contain'; }
    else if (el.dataset.orig) { el.src = el.dataset.orig; el.style.height = ''; el.style.width = ''; }
  });
}

function asistente(tabInicial) {
  estilos(); cerrar();
  const sel = new Set((negocio && negocio.actividades) || []), primera = !negocio;
  const f = document.createElement('div'); f.id = 'bn-fondo'; f.className = 'bn-fondo'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-labelledby', 'bn-t');
  f.innerHTML = `<form class="bn-caja" id="bn-form" novalidate>
    <button type="button" class="bn-x" id="bn-x" aria-label="Cerrar">✕</button>
    <h2 id="bn-t">${primera ? 'Bienvenido a DOMino Bienestar' : 'Actividades, salones y equipo del centro'}</h2>
    <p>${primera ? 'Antes de empezar, cuéntenos sobre su centro. Nombre, actividades y salones: lo puede cambiar cuando quiera.' : 'Sume o quite actividades. Los datos que ya cargó no se borran. Si suma una actividad nueva, The DOM Studio Web la deja lista en la agenda de turnos y en la página de reservas.'}</p>
    <label class="bn-l" for="bn-nombre">Nombre del centro</label>
    <input type="text" id="bn-nombre" maxlength="60" autocomplete="organization" placeholder="Ej. Vita Aura" value="${esc((negocio && negocio.nombre) || nombreInicial())}">
    <label class="bn-l" for="bn-tel">Teléfono o WhatsApp (se muestra en la página de reservas)</label>
    <input type="tel" id="bn-tel" maxlength="30" autocomplete="tel" placeholder="Ej. 261 555 0000" value="${esc((negocio && negocio.telefono) || '')}">
    <label class="bn-l" for="bn-logo">Logo del centro (PNG o SVG, opcional)</label>
    <div class="bn-logo-fila"><div class="bn-logo-prev" id="bn-logo-prev">${negocio && negocio.logo ? `<img src="${esc(negocio.logo)}" alt="Logo actual">` : '<span>Sin logo</span>'}</div>
    <div style="display:grid;gap:6px"><input type="file" id="bn-logo" accept="image/png,image/svg+xml,.png,.svg"><button type="button" class="bn-btn sec" id="bn-logo-quitar"${negocio && negocio.logo ? '' : ' hidden'}>Quitar logo</button><small style="color:var(--text-muted,#a8a396)">Se muestra en el menú del Hub. Ideal: fondo transparente.</small></div></div>
    <div class="bn-tabs" role="tablist"><button type="button" role="tab" class="bn-tab" id="bn-tab-a" aria-selected="true" aria-controls="bn-pan-a">Actividades</button><button type="button" role="tab" class="bn-tab" id="bn-tab-s" aria-selected="false" aria-controls="bn-pan-s">Salones${((negocio && negocio.salones) || []).length ? ' (' + negocio.salones.length + ')' : ''}</button><button type="button" role="tab" class="bn-tab" id="bn-tab-e" aria-selected="false" aria-controls="bn-pan-e" hidden>Equipo y puestos</button></div>
    <div id="bn-pan-a" role="tabpanel" aria-labelledby="bn-tab-a">
    <label class="bn-l">¿Qué actividades realizan? Elija todas las que correspondan.</label>
    <div class="bn-acts">${CAT().map((a) => `<label class="bn-act"><input type="checkbox" value="${esc(a.id)}"${sel.has(a.id) ? ' checked' : ''}><span><b>${esc(a.nombre)}</b><small>${esc(a.texto)}</small></span></label>`).join('')}</div>
    <button type="button" class="bn-btn sec" id="bn-ir-sal" style="margin-top:12px">Siguiente: salones →</button></div>
    <div id="bn-pan-s" role="tabpanel" aria-labelledby="bn-tab-s" hidden>
    <label class="bn-l" for="bn-nsal">¿Cuántos salones tiene el centro?</label>
    <p style="margin:0 0 8px">Por ejemplo: musculación y aeróbica, dos salones de aeróbica, o aeróbica y baile. Se usan para asignar cada clase a su salón y que no se superpongan.</p>
    <div style="display:flex;gap:8px;align-items:center"><button type="button" class="bn-btn sec" id="bn-sal-menos" aria-label="Un salón menos" style="padding:10px 16px">−</button><input type="number" id="bn-nsal" min="0" max="20" inputmode="numeric" style="width:90px;text-align:center;padding:12px;border-radius:8px;border:1px solid var(--line,#2a2d33);background:var(--bg-base,#0a0a0a);color:inherit;font-size:1.1rem" value="${((negocio && negocio.salones) || []).length || (negocio && !tieneClases([...sel]) ? 0 : 1)}"><button type="button" class="bn-btn sec" id="bn-sal-mas" aria-label="Un salón más" style="padding:10px 16px">+</button></div>
    <div id="bn-sal-campos" style="display:grid;gap:8px;margin-top:12px"></div></div>
    <div id="bn-pan-e" role="tabpanel" aria-labelledby="bn-tab-e" hidden>
    <p style="margin:0 0 8px">Para peluquería, barbería, uñas, spa, estética y consultorio: cuántos puestos de atención tiene (sillas, camillas, cabinas) y quiénes atienden. Quien reserva puede elegir con quién, o dejar «cualquiera disponible» y se le asigna a quien esté libre, sin pasarse de los puestos que tiene.</p>
    <div id="bn-eq" style="display:grid;gap:18px"></div></div>
    <div class="bn-err" id="bn-err" role="alert"></div>
    <div class="bn-fila"><button type="submit" class="bn-btn" id="bn-ok">${primera ? 'Guardar y empezar' : 'Guardar cambios'}</button><button type="button" class="bn-btn sec" id="bn-no">${primera ? 'Más tarde' : 'Cancelar'}</button></div></form>`;
  document.body.appendChild(f); document.body.style.overflow = 'hidden';
  $('bn-nombre').focus();
  $('bn-no').onclick = cerrar; $('bn-x').onclick = cerrar;
  const verTab = (cual) => { ['a', 's', 'e'].forEach((k) => { $('bn-pan-' + k).hidden = cual !== k; $('bn-tab-' + k).setAttribute('aria-selected', String(cual === k)); }); };
  $('bn-tab-a').onclick = () => verTab('a'); $('bn-tab-s').onclick = () => verTab('s'); $('bn-tab-e').onclick = () => verTab('e');
  // Equipo y puestos: solo para las actividades tildadas que atienden por turno en un puesto (sillas, camillas, cabinas).
  const conPuesto = () => [...f.querySelectorAll('.bn-act input:checked')].map((i) => CAT().find((a) => a.id === i.value)).filter((a) => a && a.puesto && a.recurso);
  const equipoD = JSON.parse(JSON.stringify((negocio && negocio.equipo) || {})), puestosD = Object.assign({}, (negocio && negocio.puestos) || {});
  const leerEq = () => f.querySelectorAll('.bn-eqa').forEach((bl) => { puestosD[bl.dataset.a] = bl.querySelector('.bn-npu').value; equipoD[bl.dataset.a] = [...bl.querySelectorAll('.bn-nom')].map((i) => i.value); });
  const pintarEq = (leer = true) => {
    if (leer) leerEq();
    const L = conPuesto(); $('bn-tab-e').hidden = !L.length;
    if (!L.length && !$('bn-pan-e').hidden) verTab('a');
    $('bn-eq').innerHTML = L.map((a) => { const nombres = (equipoD[a.id] && equipoD[a.id].length) ? equipoD[a.id] : ['']; return `<div class="bn-eqa" data-a="${esc(a.id)}"><h3 class="bn-sub" style="margin:0 0 6px">${esc(a.nombre)}</h3>
      <label class="bn-l" for="bn-npu-${esc(a.id)}">¿Cuántas ${esc(a.puesto.varios)} tiene?</label>
      <input class="bn-npu" id="bn-npu-${esc(a.id)}" type="number" min="1" max="50" inputmode="numeric" placeholder="Sin límite" value="${esc(puestosD[a.id] || '')}" style="width:120px;text-align:center;padding:12px;border-radius:8px;border:1px solid var(--line,#2a2d33);background:var(--bg-base,#0a0a0a);color:inherit;font-size:1.05rem">
      <small style="display:block;margin-top:4px;color:var(--text-muted,#a8a396)">Si lo deja vacío, atienden a la vez tantas personas como profesionales haya. Con ${esc(puestosD[a.id] || 'N')} ${esc(a.puesto.varios)}, nunca se agendan más turnos juntos que ese número.</small>
      <label class="bn-l">Quiénes atienden (${esc(a.recurso.nombre.toLowerCase())})</label>
      <div style="display:grid;gap:8px">${nombres.map((n, k) => `<div class="bn-sal"><input type="text" class="bn-nom" maxlength="40" placeholder="Ej. ${['Ana', 'Luis', 'Marta', 'Sofía'][k] || 'Nombre'}" value="${esc(n)}" aria-label="Profesional ${k + 1}" style="flex:1"><button type="button" class="bn-btn sec bn-qn" data-a="${esc(a.id)}" data-k="${k}" aria-label="Quitar a ${esc(n || 'esta persona')}" style="padding:10px 14px">✕</button></div>`).join('')}</div>
      <button type="button" class="bn-btn sec bn-mas" data-a="${esc(a.id)}" style="margin-top:8px">+ Agregar profesional</button></div>`; }).join('');
  };
  $('bn-eq').addEventListener('click', (e) => {
    const b = e.target.closest('.bn-mas,.bn-qn'); if (!b) return; leerEq(); const id = b.dataset.a; equipoD[id] = equipoD[id] && equipoD[id].length ? equipoD[id] : [''];
    if (b.classList.contains('bn-mas')) equipoD[id].push(''); else equipoD[id].splice(Number(b.dataset.k), 1);
    pintarEq(false); if (b.classList.contains('bn-mas')) { const ins = $('bn-eq').querySelectorAll(`.bn-eqa[data-a="${id}"] .bn-nom`); if (ins.length) ins[ins.length - 1].focus(); }
  });
  f.querySelector('.bn-acts').addEventListener('change', () => pintarEq());
  pintarEq(false); $('bn-ir-sal').onclick = () => { verTab('s'); $('bn-nsal').focus(); };
  let nombresSal = ((negocio && negocio.salones) || []).slice();
  const offIni = new Set(((negocio && negocio.salones_off) || []).map((x) => x.toLowerCase()));
  let habSal = nombresSal.map((n) => !offIni.has(String(n).toLowerCase()));
  const camposSal = () => {
    [...$('bn-sal-campos').querySelectorAll('.bn-sal')].forEach((r, k) => { nombresSal[k] = r.querySelector('input[type=text]').value; habSal[k] = r.querySelector('input[type=checkbox]').checked; });
    const n = Math.max(0, Math.min(20, Math.floor(Number($('bn-nsal').value) || 0)));
    $('bn-sal-campos').innerHTML = Array.from({ length: n }, (_, k) => `<div class="bn-sal"><label style="display:grid;gap:4px;flex:1"><span style="color:var(--text-muted,#a8a396);font-size:.9rem">Salón ${k + 1}</span><input type="text" maxlength="40" placeholder="${['Ej. Musculación', 'Ej. Aeróbica', 'Ej. Baile', 'Ej. Salón 4'][k] || 'Ej. Salón ' + (k + 1)}" value="${esc(nombresSal[k] || '')}"></label><label class="bn-hab"><input type="checkbox"${habSal[k] === false ? '' : ' checked'}><span>Habilitado</span></label></div>`).join('') || '<p class="bn-aviso">Sin salones: las clases se cargan sin salón asignado.</p>';
  };
  $('bn-nsal').addEventListener('input', camposSal);
  $('bn-sal-menos').onclick = () => { $('bn-nsal').value = Math.max(0, (Number($('bn-nsal').value) || 0) - 1); camposSal(); };
  $('bn-sal-mas').onclick = () => { $('bn-nsal').value = Math.min(20, (Number($('bn-nsal').value) || 0) + 1); camposSal(); };
  camposSal();
  if (tabInicial === 's') verTab('s');
  if (tabInicial === 'e' && !$('bn-tab-e').hidden) verTab('e');
  let logoNuevo = (negocio && negocio.logo) || '';
  const prevLogo = () => { $('bn-logo-prev').innerHTML = logoNuevo ? `<img src="${esc(logoNuevo)}" alt="Logo">` : '<span>Sin logo</span>'; $('bn-logo-quitar').hidden = !logoNuevo; };
  $('bn-logo-quitar').onclick = () => { logoNuevo = ''; $('bn-logo').value = ''; prevLogo(); };
  $('bn-logo').onchange = async () => {
    const file = $('bn-logo').files[0]; $('bn-err').textContent = ''; if (!file) return;
    try { logoNuevo = await prepararLogo(file); prevLogo(); }
    catch (e) { $('bn-logo').value = ''; $('bn-err').textContent = e.message || 'No se pudo leer el logo.'; }
  };
  f.addEventListener('click', (e) => { if (e.target === f) cerrar(); });
  $('bn-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const nom = $('bn-nombre').value.trim(), tel = $('bn-tel').value.trim(), acts = [...f.querySelectorAll('.bn-act input:checked')].map((i) => i.value);
    const err = (m) => { $('bn-err').textContent = m; };
    if (nom.length < 3) return err('Escriba el nombre del centro.');
    if (!acts.length) { verTab('a'); return err('Elija al menos una actividad.'); }
    const filasSal = [...$('bn-sal-campos').querySelectorAll('.bn-sal')];
    const salones = filasSal.map((r, k) => r.querySelector('input[type=text]').value.trim() || 'Salón ' + (k + 1));
    const salones_off = salones.filter((x, k) => !filasSal[k].querySelector('input[type=checkbox]').checked);
    const repetido = salones.find((x, k) => salones.findIndex((y) => y.toLowerCase() === x.toLowerCase()) !== k);
    if (repetido) { verTab('s'); return err(`Hay dos salones con el nombre «${repetido}». Póngales nombres distintos (por ejemplo, Aeróbica 1 y Aeróbica 2).`); }
    leerEq();
    const equipo = {}, puestos = {};
    for (const a of conPuesto()) {
      const nombres = []; (equipoD[a.id] || []).forEach((n) => { const t = String(n).trim(); if (t) nombres.push(t); });
      const rep = nombres.find((x, k) => nombres.findIndex((y) => y.toLowerCase() === x.toLowerCase()) !== k);
      if (rep) { verTab('e'); return err(`En ${a.nombre} hay dos personas con el nombre «${rep}». Póngales nombres distintos (por ejemplo, Ana M. y Ana R.).`); }
      equipo[a.id] = nombres; const n = Math.floor(Number(puestosD[a.id])); puestos[a.id] = n > 0 ? Math.min(n, 50) : 0;
    }
    $('bn-ok').disabled = true; $('bn-ok').textContent = 'Guardando…';
    try {
      const datos = { nombre: nom, telefono: tel, actividades: acts, salones, salones_off, equipo: Object.assign({}, (negocio && negocio.equipo) || {}, equipo), puestos: Object.assign({}, (negocio && negocio.puestos) || {}, puestos), logo: logoNuevo || '', version_catalogo: (window.DOMINO_CATALOGO || {}).version || 1, actualizado: serverTimestamp() };
      if (!negocio) datos.creado = serverTimestamp();
      await setDoc(doc(D().db, 'config', 'negocio'), datos, { merge: true });
      negocio = Object.assign({}, negocio, datos); window.DOMINO_NEGOCIO = negocio;
      // La agenda de turnos del centro se arma sola con las actividades elegidas (recursos, servicios y horarios típicos; no pisa lo ya cargado).
      if (window.TURNOS_API) apiAgenda('sincronizar_actividades', { actividades: acts, nombre: nom, telefono: tel, equipo, puestos }).then((r) => { if (!r.ok) console.warn('Agenda: no se pudieron cargar las actividades', r.error); }).catch(() => {});
      cerrar(); pintarPanel(true); aplicarLogo(); if (nom) document.querySelectorAll('.brand-name b').forEach((el) => { el.textContent = nom; });
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
    p.innerHTML = `<h2>${esc(negocio.nombre)}</h2><div class="bn-chips">${acts.map((a) => `<span class="bn-chip">${esc(nombreActividad(a))}</span>`).join('')}</div>${(negocio.salones || []).length ? `<p style="margin:10px 0 0;color:var(--text-muted)">Salones: ${negocio.salones.map((n) => salonCerrado(n) ? `<s>${esc(n)}</s> (inhabilitado)` : esc(n)).join(' · ')}</p>` : ''}
    ${resumenEquipo(acts)}
    ${senior ? `<div class="bn-fila"><button type="button" class="bn-btn sec" id="bn-abrir">Actividades</button><button type="button" class="bn-btn sec" id="bn-salones">Salones</button>${conPuestos(acts) ? '<button type="button" class="bn-btn sec" id="bn-equipo">Equipo y puestos</button>' : ''}${tieneClases(acts) ? '<button type="button" class="bn-btn sec" id="bn-clases-adm">Administrar clases</button>' : ''}</div>` : ''}`;
  }
  const a = $('bn-abrir'); if (a) a.onclick = () => asistente();
  const sl = $('bn-salones'); if (sl) sl.onclick = () => asistente('s');
  const eq = $('bn-equipo'); if (eq) eq.onclick = () => asistente('e');
  const ac = $('bn-clases-adm'); if (ac) ac.onclick = () => adminClases();
}

async function iniciar() {
  if (!activo() || !D() || !D().listo) return;
  if (!cargado) await leerNegocio();
  pintarPanel(false);
  if (cargado && !negocio && D().rol === 'senior' && !window.__bnOfrecido) { window.__bnOfrecido = true; asistente(); }
  const t = (negocio && negocio.nombre) ? negocio.nombre : null;
  if (t && window.DOMINO_CLIENTE) { document.querySelectorAll('.brand-name b').forEach((el) => { el.textContent = t; }); }
  aplicarLogo();
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
let socios = null, clases = null, clasesErr = '', puestosHoy = [], pendientes = null;

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
  if (r && r.ok) { clases = r.clases; puestosHoy = Array.isArray(r.puestos) ? r.puestos : []; clasesErr = ''; return; }
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
    ...(pendientes ? [{ n: pendientes.length, t: pendientes.length === 1 ? 'Turno por confirmar' : 'Turnos por confirmar', cls: pendientes.length ? 'text-ambar' : 'text-verde', go: 'bnVerTurnos()' }] : []),
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
  const soloPuestos = puestosHoy.length && !tieneClases((negocio && negocio.actividades) || []);
  const h2 = document.querySelector('.hub-hoy-head h2'); if (h2) h2.textContent = soloPuestos ? 'Puestos de atención ahora' : 'Clases de hoy y los próximos días';
  const pu = puestosHoy.map((p) => { const lleno = p.libres <= 0; return `<div class="bn-cl${lleno ? ' lleno' : p.libres === 1 ? ' pocos' : ''}"><span class="h" aria-hidden="true">${p.libres}/${p.total}</span><span><b>${esc(p.nombre)}</b><small>${p.profesionales} ${p.profesionales === 1 ? 'profesional' : 'profesionales'}</small></span><span class="bn-cupo">${lleno ? `${esc(p.varios)} ocupadas` : `${p.libres} de ${p.total} ${esc(p.varios)} libres`}${lleno ? '' : '<small>ahora</small>'}</span></div>`; }).join('');
  const bloquePu = pu ? `<div class="bn-dia"><h3>${soloPuestos ? 'Ahora' : 'Puestos de atención ahora'}</h3><div class="bn-cls">${pu}</div></div>` : '';
  if (soloPuestos && clases && !clases.length) { box.innerHTML = bloquePu; return; }
  if (!clases) {
    box.innerHTML = bloquePu + (clasesErr === 'sin_conexion_planilla'
      ? '<p class="bn-aviso">Las clases aparecen acá cuando la agenda de turnos está conectada.</p>'
      : clasesErr ? '<p class="bn-aviso">No se pudieron traer las clases. Revise su conexión e intente de nuevo.</p>' : '<p class="bn-aviso">Cargando clases…</p>');
    return;
  }
  const visibles = clases.filter((c) => !(c.fecha === hoyStr() && c.pasada));
  if (!visibles.length) { box.innerHTML = bloquePu + '<p class="bn-aviso">No hay clases cargadas para estos días.</p>'; return; }
  const dias = [...new Set(visibles.map((c) => c.fecha))];
  box.innerHTML = bloquePu + dias.map((f) => `<div class="bn-dia"><h3>${f === hoyStr() ? 'Hoy' : esc(fechaLarga(f))}</h3><div class="bn-cls">${visibles.filter((c) => c.fecha === f).map((c) => {
    const lleno = c.libres <= 0, pocos = !lleno && c.libres <= Math.max(2, Math.ceil(c.cupo * 0.2));
    if (salonCerrado(c.sala)) c.suspendida = true;
    const estado = salonCerrado(c.sala) ? 'Salón inhabilitado' : c.suspendida ? 'Suspendida' : lleno ? 'Completa' : `${c.libres} de ${c.cupo}`;
    return `<div class="bn-cl${c.suspendida || lleno ? ' lleno' : pocos ? ' pocos' : ''}"><span class="h">${esc(c.hora)}</span><span><b>${esc(c.clase)}</b><small>${esc([c.profesor ? 'Prof. ' + c.profesor : '', c.sala].filter(Boolean).join(' · '))}</small></span><span class="bn-cupo">${esc(estado)}${!c.suspendida && !lleno ? '<small>lugares libres</small>' : ''}</span></div>`;
  }).join('')}</div></div>`).join('');
}

window.BIENESTAR_RESUMEN = (r) => { pintarResumen(r); };
window.BIENESTAR_HOY = (lista, hoy, base) => {
  base(lista, hoy);
  const cont = $('hub-lista-hoy');
  if (cont) cont.innerHTML = lista.length ? '<h3 class="bn-sub">Seguimientos</h3>' + cont.innerHTML : '';
  pintarClases();
};
// Solicitudes de turno que esperan confirmación (reservas hechas por los clientes en modo «solicitud»). Solo las ve el personal con agenda.
async function leerPendientes() {
  if (!window.TURNOS_API || !D() || !['senior', 'midsenior', 'asistente'].includes(D().rol)) { pendientes = null; return; }
  await new Promise((ok) => setTimeout(ok, 0)); // si el Hub ya estaba listo al cargar este archivo, deja terminar de definir las funciones de la agenda
  const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, hoy = hoyStr(), lim = new Date(); lim.setDate(lim.getDate() + 120);
  try { const r = await apiAgenda('agenda', { desde: hoy, hasta: f(lim) }); pendientes = r && r.ok ? (r.turnos || []).filter((t) => t.estado === 'Por confirmar' && t.fecha >= hoy) : null; }
  catch (e) { pendientes = null; }
}
window.bnVerTurnos = () => window.open('turnos/panel.html', '_blank', 'noopener');
async function refrescarHubBienestar() {
  if (!activo() || !D() || !D().listo) return;
  pintarClases();
  await Promise.all([leerSocios(), leerClases(), leerPendientes()]);
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


// ── Administrar clases: agregar, editar profesor/cupo/horarios o quitar ──
// Usa la sesión de la Agenda de turnos (misma clave que la planilla, hoja usuarios). Solo Dirección (Senior o Mid Senior en la planilla).
const DIAS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mié'], [4, 'Jue'], [5, 'Vie'], [6, 'Sáb'], [0, 'Dom']];
const nomDia = (d) => (DIAS.find((x) => x[0] === d) || [0, '?'])[1];
const salonCerrado = (n) => ((negocio && negocio.salones_off) || []).some((x) => String(x).toLowerCase() === String(n || '').toLowerCase());
const salonesCentro = () => ((negocio && negocio.salones) || []).filter((n) => n && !salonCerrado(n));
const conPuestos = (acts) => (acts || []).some((id) => { const a = CAT().find((x) => x.id === id); return a && a.puesto && a.recurso; });
const resumenEquipo = (acts) => {
  const filas = (acts || []).map((id) => CAT().find((x) => x.id === id)).filter((a) => a && a.puesto && a.recurso).map((a) => {
    const n = Number((negocio.puestos || {})[a.id]) || 0, eq = ((negocio.equipo || {})[a.id] || []).filter(Boolean);
    return `${esc(a.nombre)}: ${n ? n + ' ' + esc(n === 1 ? a.puesto.uno : a.puesto.varios) : 'sin límite de ' + esc(a.puesto.varios)}${eq.length ? ' · ' + eq.map(esc).join(', ') : ''}`;
  });
  return filas.length ? `<p style="margin:10px 0 0;color:var(--text-muted)">${filas.join('<br>')}</p>` : '';
};
const tieneClases = (acts) => (acts || []).some((id) => ((CAT().find((a) => a.id === id) || {}).clases || []).length);
const ERR_CLASE = { cupo_invalido: 'El cupo tiene que ser de 2 a 500 personas.', duracion_invalida: 'Elija una duración de la lista.', horario_invalido: 'Revise los horarios: elija al menos un día y la hora de inicio.', faltan_horarios: 'Agregue al menos un día y horario.', falta_nombre_clase: 'Escriba el nombre de la clase.', sin_permiso: 'Su usuario de la agenda no tiene permiso para cambiar clases (lo hace la Dirección).', usuario_invalido: 'Ese correo no está habilitado en la agenda.', clave_incorrecta: 'La clave no es correcta.', demasiados_intentos: 'Demasiados intentos. Espere unos minutos.', servicio_invalido: 'Esa clase ya no existe. Actualice la lista.', accion_desconocida: 'La agenda todavía usa el script anterior: falta implementar el Code.gs nuevo como «Nueva versión».', tiempo_agotado: 'La agenda tarda en responder. Intente de nuevo.', sin_conexion: 'No hay conexión con la agenda. Revise su internet e intente de nuevo.' };
const errClase = (e) => ERR_CLASE[e] || 'No se pudo completar (' + (e || 'error') + '). Intente de nuevo.';
const tokenCuenta = async () => { try { const u = D().auth && D().auth.currentUser; return u ? await u.getIdToken() : ''; } catch (e) { return ''; } };
const renovarAgenda = () => abrirSesionAgenda(tokenCuenta);
async function apiAgenda(accion, datos) {
  const s = await renovarAgenda(); if (!s || !s.tok) return { ok: false, error: 'sesion_invalida' };
  const r = await llamar(accion, Object.assign({}, datos, { token: s.tok }));
  if (!r.ok && r.error === 'sesion_invalida') guardarSesionAgenda(null);
  return r;
}
let listaClases = [];
function cajaClases(html) {
  estilos(); estilosHub(); cerrar();
  const f = document.createElement('div'); f.id = 'bn-fondo'; f.className = 'bn-fondo'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-labelledby', 'bn-t');
  f.innerHTML = `<div class="bn-caja" id="bn-caja"><button type="button" class="bn-x" id="bn-x" aria-label="Cerrar">✕</button>${html}</div>`;
  document.body.appendChild(f); document.body.style.overflow = 'hidden';
  $('bn-x').onclick = cerrar; f.addEventListener('click', (e) => { if (e.target === f) cerrar(); }); f.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
  return f;
}
async function adminClases() {
  if (!window.TURNOS_API) { cajaClases('<h2 id="bn-t">Clases del centro</h2><p>La agenda de turnos todavía no está conectada.</p>'); return; }
  cajaClases('<h2 id="bn-t">Clases del centro</h2><p>Cargando clases…</p>');
  if (!(await renovarAgenda())) return loginAgenda();
  const r = await apiAgenda('clases_config', {});
  if (!r.ok) { if (r.error === 'sesion_invalida') return loginAgenda(); cajaClases(`<h2 id="bn-t">Clases del centro</h2><p class="bn-err">${esc(errClase(r.error))}</p>`); return; }
  listaClases = r.clases || []; pintarListaClases();
}
function loginAgenda(msg) {
  const f = cajaClases(`<form id="bn-lg" novalidate><h2 id="bn-t">Ingresar a la agenda</h2><p>Para cambiar clases, entre con el correo y la clave de la <b>Agenda de turnos</b>. Queda guardado en este dispositivo.</p>
    <label class="bn-l" for="bn-lg-e">Correo</label><input type="text" id="bn-lg-e" inputmode="email" autocomplete="username" value="${esc((D().auth && D().auth.currentUser && D().auth.currentUser.email) || '')}">
    <label class="bn-l" for="bn-lg-c">Clave</label><div style="display:flex;gap:8px"><input type="password" id="bn-lg-c" autocomplete="current-password" style="flex:1"><button type="button" class="bn-btn sec" id="bn-lg-ver" aria-label="Mostrar la clave" aria-pressed="false" style="padding:0 14px">👁</button></div>
    <div class="bn-err" id="bn-lg-err" role="alert">${esc(msg || '')}</div><div class="bn-fila"><button type="submit" class="bn-btn" id="bn-lg-ok">Ingresar</button></div></form>`);
  $('bn-lg-e').focus();
  $('bn-lg-ver').onclick = () => { const i = $('bn-lg-c'), ver = i.type === 'password'; i.type = ver ? 'text' : 'password'; $('bn-lg-ver').setAttribute('aria-pressed', String(ver)); $('bn-lg-ver').setAttribute('aria-label', ver ? 'Ocultar la clave' : 'Mostrar la clave'); i.focus(); };
  $('bn-lg').onsubmit = async (ev) => {
    ev.preventDefault(); const b = $('bn-lg-ok'); b.disabled = true; b.textContent = 'Ingresando…';
    const r = await llamar('login', { email: $('bn-lg-e').value.trim(), clave: $('bn-lg-c').value });
    if (!r.ok) { b.disabled = false; b.textContent = 'Ingresar'; $('bn-lg-err').textContent = errClase(r.error); return; }
    guardarSesionAgenda({ tok: r.token, user: r.usuario }); adminClases();
  };
  return f;
}
function textoHorarios(hs) {
  const porHora = {}; (hs || []).forEach((h) => { (porHora[h.desde] = porHora[h.desde] || []).push(h.dia); });
  return Object.entries(porHora).sort((a, b) => a[0].localeCompare(b[0])).map(([hh, ds]) => DIAS.filter((d) => ds.includes(d[0])).map((d) => d[1]).join(', ') + ' ' + hh).join(' · ') || 'Sin horarios';
}
function pintarListaClases() {
  const acts = ((negocio && negocio.actividades) || []).filter((id) => ((CAT().find((a) => a.id === id) || {}).clases || []).length);
  const grupos = acts.map((id) => ({ id, nombre: nombreActividad(id) }));
  if (listaClases.some((c) => c.actividad === 'propia' || !acts.includes(c.actividad))) grupos.push({ id: 'propia', nombre: 'Otras clases' });
  if (!grupos.length) grupos.push({ id: 'propia', nombre: 'Clases' });
  const de = (g) => listaClases.filter((c) => g.id === 'propia' ? (c.actividad === 'propia' || !acts.includes(c.actividad)) : c.actividad === g.id);
  cajaClases(`<h2 id="bn-t">Clases del centro</h2><p>Sume clases, cambie el profesor, el cupo o los horarios. Los cambios se ven enseguida en la agenda, en la página de reservas y en el inicio.</p>
    ${grupos.map((g) => `<h3 class="bn-sub">${esc(g.nombre)}</h3><div class="bn-lista">${de(g).map((c) => `<div class="bn-li"><span><b>${esc(c.nombre)}</b><small>${esc([c.profesor ? 'Prof. ' + c.profesor : 'Sin profesor asignado', 'cupo ' + c.cupo, c.duracion_min + ' min'].join(' · '))}</small><small>${esc(textoHorarios(c.horarios))}${c.publico ? '' : ' · no se muestra en reservas'}</small>${salonCerrado(c.sala) ? `<small style="color:#ff9b93">El salón «${esc(c.sala)}» está inhabilitado: edítela y pásela a otro salón, o quítela.</small>` : ''}</span><span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button type="button" class="bn-btn sec" data-ed="${esc(c.servicio_id)}">Editar</button><button type="button" class="bn-btn sec" data-qt="${esc(c.servicio_id)}" aria-label="Quitar ${esc(c.nombre)}">Quitar</button></span></div>`).join('') || '<p class="bn-aviso">Todavía no hay clases acá.</p>'}</div>
    <div class="bn-fila" style="margin-top:10px"><button type="button" class="bn-btn" data-nueva="${esc(g.id)}">+ Agregar clase</button></div>`).join('')}
    <div class="bn-err" id="bn-cl-err" role="alert"></div>`);
  const caja = $('bn-caja');
  caja.addEventListener('click', async (e) => {
    const n = e.target.closest('[data-nueva]'); if (n) return formClase(null, n.dataset.nueva);
    const ed = e.target.closest('[data-ed]'); if (ed) return formClase(listaClases.find((c) => c.servicio_id === ed.dataset.ed));
    const q = e.target.closest('[data-qt]');
    if (q) {
      const c = listaClases.find((x) => x.servicio_id === q.dataset.qt); if (!c || !confirm(`¿Quitar la clase «${c.nombre}»? Deja de aparecer en la agenda y en la página de reservas. Los turnos ya tomados no se borran.`)) return;
      q.disabled = true; q.textContent = 'Quitando…';
      const r = await apiAgenda('quitar_clase', { servicio_id: c.servicio_id });
      if (!r.ok) { if (r.error === 'sesion_invalida') return loginAgenda('Vuelva a ingresar para continuar.'); q.disabled = false; q.textContent = 'Quitar'; $('bn-cl-err').textContent = errClase(r.error); return; }
      listaClases = listaClases.filter((x) => x.servicio_id !== c.servicio_id); pintarListaClases(); refrescarHubBienestar();
    }
  });
}
function filaHorario(dias, hora) {
  return `<div class="bn-hor"><div class="bn-dias" role="group" aria-label="Días">${DIAS.map(([d, t]) => `<label class="bn-dia-b"><input type="checkbox" value="${d}"${(dias || []).includes(d) ? ' checked' : ''}><span>${t}</span></label>`).join('')}</div><label class="bn-hora">Empieza a las<input type="time" step="1800" value="${esc(hora || '19:00')}"></label><button type="button" class="bn-quita-h" aria-label="Quitar este horario">✕</button></div>`;
}
function formClase(c, actividad) {
  const porHora = {}; ((c && c.horarios) || []).forEach((h) => { (porHora[h.desde] = porHora[h.desde] || []).push(h.dia); });
  const filas = Object.entries(porHora).sort((a, b) => a[0].localeCompare(b[0]));
  const durs = [30, 45, 60, 90, 120, 150, 180].filter((m) => m % 30 === 0);
  cajaClases(`<form id="bn-fc" novalidate><h2 id="bn-t">${c ? 'Editar clase' : 'Agregar clase'}</h2>
    <label class="bn-l" for="fc-n">Clase</label><input type="text" id="fc-n" maxlength="60" placeholder="Ej. Salsa, Spinning, Zumba" value="${esc((c && c.nombre) || '')}">
    <label class="bn-l" for="fc-p">Profesor/a</label><input type="text" id="fc-p" maxlength="60" placeholder="Ej. Ana Gómez" value="${esc((c && c.profesor) || '')}">
    <div class="bn-vence"><label>Cupo (personas)<input type="number" id="fc-c" min="2" max="500" inputmode="numeric" value="${esc((c && c.cupo) || 15)}"></label>
    <label>Duración<select id="fc-d">${durs.map((m) => `<option value="${m}"${((c && c.duracion_min) || 60) === m ? ' selected' : ''}>${m} min</option>`).join('')}</select></label></div>
    <label class="bn-l" for="fc-s">Salón</label>${salonesCentro().length ? `<select id="fc-s"><option value="">Elegí el salón…</option>${salonesCentro().map((n) => `<option${c && c.sala === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}${c && c.sala && !salonesCentro().includes(c.sala) ? `<option value="" selected disabled>${esc(c.sala)} (${salonCerrado(c.sala) ? 'inhabilitado' : 'no está en la lista de salones'})</option>` : ''}</select>` : `<input type="text" id="fc-s" maxlength="60" list="fc-salas" placeholder="Ej. Salón de baile" value="${esc((c && c.sala) || '')}"><datalist id="fc-salas">${[...new Set(listaClases.map((x) => x.sala).filter(Boolean))].map((n) => `<option value="${esc(n)}">`).join('')}</datalist>`}
    <small style="display:block;margin-top:4px;color:var(--text-muted,#a8a396)">${salonesCentro().length ? 'Los salones se cargan, habilitan o inhabilitan con el botón «Salones» del inicio.' : 'Obligatorio si la clase coincide en día y horario con otra.'} Dos clases no pueden darse a la vez en el mismo salón.</small>
    <label class="bn-l">Días y hora de inicio</label><div id="fc-hs">${(filas.length ? filas : [['19:00', []]]).map(([h, ds]) => filaHorario(ds, h)).join('')}</div>
    <button type="button" class="bn-btn sec" id="fc-mas" style="margin-top:8px">+ Otro horario</button>
    <label class="bn-act" style="margin-top:14px"><input type="checkbox" id="fc-pub"${!c || c.publico ? ' checked' : ''}><span><b>Mostrar en la página de reservas</b><small>Si la destilda, solo se puede anotar a alguien desde la agenda.</small></span></label>
    <div class="bn-err" id="fc-err" role="alert"></div>
    <div class="bn-fila"><button type="submit" class="bn-btn" id="fc-ok">Guardar clase</button><button type="button" class="bn-btn sec" id="fc-no">Volver</button></div></form>`);
  const st = document.createElement('style'); st.textContent = '.bn-hor{display:grid;gap:8px;padding:10px;border:1px solid var(--line,#2a2d33);border-radius:10px;margin-top:8px;position:relative}.bn-dias{display:flex;flex-wrap:wrap;gap:6px;padding-right:40px}.bn-dia-b input{position:absolute;opacity:0;pointer-events:none}.bn-dia-b span{display:inline-block;min-width:44px;padding:9px 6px;text-align:center;border:1px solid var(--gold,#d4af37);border-radius:8px;cursor:pointer;color:var(--gold-light,#e8c766)}.bn-dia-b input:checked+span{background:var(--gold,#d4af37);color:#0a0a0a;font-weight:700}.bn-dia-b input:focus-visible+span{outline:2px solid #fff}.bn-hora{display:flex;gap:10px;align-items:center;color:var(--text-muted,#a8a396)}.bn-hora input{padding:10px;border-radius:8px;border:1px solid var(--line,#2a2d33);background:var(--bg-base,#0a0a0a);color:inherit;font-size:1rem}.bn-quita-h{position:absolute;top:8px;right:8px;width:36px;height:36px;border-radius:50%;border:1px solid var(--line,#2a2d33);background:transparent;color:inherit;cursor:pointer}.bn-caja select{width:100%;padding:12px;border-radius:8px;border:1px solid var(--line,#2a2d33);background:var(--bg-base,#0a0a0a);color:inherit;font-size:1rem}.bn-caja input[type=number]{width:100%;padding:12px;border-radius:8px;border:1px solid var(--line,#2a2d33);background:var(--bg-base,#0a0a0a);color:inherit;font-size:1rem}';
  $('bn-caja').appendChild(st);
  $('fc-n').focus();
  $('fc-no').onclick = pintarListaClases;
  $('fc-mas').onclick = () => $('fc-hs').insertAdjacentHTML('beforeend', filaHorario([], '19:00'));
  $('fc-hs').addEventListener('click', (e) => { const b = e.target.closest('.bn-quita-h'); if (b && $('fc-hs').children.length > 1) b.parentNode.remove(); });
  $('bn-fc').onsubmit = async (ev) => {
    ev.preventDefault();
    const err = (m) => { $('fc-err').textContent = m; };
    const horarios = [...$('fc-hs').querySelectorAll('.bn-hor')].map((h) => ({ dias: [...h.querySelectorAll('.bn-dias input:checked')].map((i) => Number(i.value)), desde: (h.querySelector('input[type=time]').value || '').slice(0, 5) })).filter((h) => h.dias.length || h.desde);
    const datos = { nombre: $('fc-n').value.trim(), profesor: $('fc-p').value.trim(), cupo: Number($('fc-c').value), duracion_min: Number($('fc-d').value), sala: $('fc-s').value.trim(), publico: $('fc-pub').checked, horarios, actividad: c ? c.actividad : actividad };
    if (datos.nombre.length < 2) return err(ERR_CLASE.falta_nombre_clase);
    if (salonesCentro().length && !datos.sala) { $('fc-s').focus(); return err('Elegí en qué salón se da la clase.'); }
    if (!(datos.cupo >= 2 && datos.cupo <= 500)) return err(ERR_CLASE.cupo_invalido);
    if (!horarios.length || horarios.some((h) => !h.dias.length || !/^\d{2}:\d{2}$/.test(h.desde))) return err(ERR_CLASE.horario_invalido);
    if (c) datos.servicio_id = c.servicio_id;
    const b = $('fc-ok'); b.disabled = true; b.textContent = 'Guardando…';
    const r = await apiAgenda('guardar_clase', datos);
    if (!r.ok) {
      if (r.error === 'sesion_invalida') return loginAgenda('Vuelva a ingresar para guardar la clase.');
      b.disabled = false; b.textContent = 'Guardar clase';
      if (r.error === 'falta_sala' || r.error === 'sala_ocupada') {
        const cuando = `el ${nomDia(r.dia).toLowerCase()} a las ${r.hora}`;
        $('fc-s').focus(); $('fc-s').style.borderColor = '#ff9b93';
        return err(r.error === 'falta_sala' ? `${cuando} ya está «${r.clase}»${r.sala ? ' en ' + r.sala : ''}. Indique en qué sala se va a dar esta clase.` : `En «${r.sala}» ya está «${r.clase}» ${cuando}. Elija otra sala u otro horario.`);
      }
      return err(errClase(r.error));
    }
    await adminClases(); refrescarHubBienestar();
  };
}
