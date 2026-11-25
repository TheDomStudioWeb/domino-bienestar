// DOMino Bienestar · Módulo exclusivo ODONTOLOGÍA (etapa 3a: radiografías, fotos y estudios).
// Los archivos van al Google Drive DEL CONSULTORIO a través de su propio script (odontologia/apps-script/Consultorio.gs);
// en Firestore queda cada archivo con su miniatura y las marcas: negocios/{id}/clinica/{paciente}/archivos/{id}.
// Visor: zoom, mover, brillo, contraste, negativo, comparar dos lado a lado y marcado a mano (lápiz, flecha, círculo, texto).
// Además, un esquema de la boca para marcar sin necesidad de subir nada.
import { getDoc, getDocs, setDoc, addDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { collection, doc } from "./tenant.js";

const D = () => window.DOMINO, $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yo = () => String((D().auth && D().auth.currentUser && D().auth.currentUser.email) || D().email || '').toLowerCase();
const fecha = (t) => { const d = t && t.toDate ? t.toDate() : (t ? new Date(t) : null); return d ? d.toLocaleDateString('es-AR') : ''; };
const ms = (t) => t && t.toMillis ? t.toMillis() : (t ? new Date(t).getTime() : 0);
const TIPOS = { radiografia: 'Radiografía', foto: 'Foto', estudio: 'Estudio', esquema: 'Esquema de la boca', otro: 'Otro' };
const MAX = 25 * 1024 * 1024;

let URL_DRIVE = null, CTX = null, LISTA = [], SEL = new Set();

async function urlDrive() {
  if (URL_DRIVE !== null) return URL_DRIVE;
  try { const s = await getDoc(doc(D().db, 'config', 'odonto')); URL_DRIVE = s.exists() ? String(s.data().drive_url || '') : ''; } catch (e) { URL_DRIVE = ''; }
  return URL_DRIVE;
}
async function llamar(accion, extra) {
  const url = await urlDrive(); if (!url) throw new Error('sin_drive');
  const token = await D().auth.currentUser.getIdToken();
  const r = await fetch(url, { method: 'POST', body: JSON.stringify(Object.assign({ accion, token, nid: window.DOMINO_NID || D().nid, cid: CTX.id }, extra || {})) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'error');
  return j;
}
const errTxt = (e) => {
  const m = String(e && (e.message || e.code) || e);
  if (/sin_drive/.test(m)) return 'Falta conectar el Drive del consultorio.';
  if (/sin_permiso|permission/i.test(m)) return 'Su usuario no tiene permiso para los archivos de este paciente.';
  if (/muy_grande/.test(m)) return 'El archivo supera los 25 MB.';
  if (/tipo_no_permitido/.test(m)) return 'Solo se pueden subir imágenes o PDF.';
  if (/sin_configurar|otro_centro/.test(m)) return 'El Drive conectado no corresponde a este consultorio. Avise a The DOM.';
  return 'No se pudo completar. Revise su conexión e intente de nuevo.';
};

function estilos() {
  if ($('odi-css')) return;
  const s = document.createElement('style'); s.id = 'odi-css';
  s.textContent = `
  .odi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:10px}
  .odi-card{position:relative;border:1px solid var(--line,#2a2d33);border-radius:6px;overflow:hidden;background:#0f1114;cursor:pointer;text-align:left;padding:0;color:inherit;font:inherit}
  .odi-card img,.odi-card .odi-pdf{display:block;width:100%;height:110px;object-fit:cover;background:#000}
  .odi-card .odi-pdf{display:flex;align-items:center;justify-content:center;font-size:2rem}
  .odi-card .odi-t{padding:6px 8px;font-size:.8rem;line-height:1.3}.odi-card .odi-t b{display:block;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .odi-card .odi-sel{position:absolute;top:6px;left:6px;width:22px;height:22px}
  .odi-card .odi-m{position:absolute;top:6px;right:6px;background:rgba(229,72,77,.9);color:#fff;font-size:.72rem;border-radius:999px;padding:1px 7px}
  .odi-v{position:fixed;inset:0;z-index:2300;background:#050607;display:flex;flex-direction:column;color:#f4f1ea}
  .odi-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 10px;background:#111317;border-bottom:1px solid #2a2d33}
  .odi-bar .od-chip{padding:7px 10px;font-size:.85rem}.odi-bar label{display:flex;align-items:center;gap:6px;font-size:.82rem;color:#a8a396}
  .odi-bar input[type=range]{width:90px}.odi-bar .sep{width:1px;height:24px;background:#2a2d33;margin:0 2px}
  .odi-col{display:inline-block;width:22px;height:22px;border-radius:50%;border:2px solid transparent;cursor:pointer}.odi-col[aria-pressed=true]{border-color:#fff}
  .odi-paneles{flex:1;display:flex;gap:2px;min-height:0}.odi-panel{position:relative;flex:1;min-width:0;background:#000;touch-action:none}
  .odi-panel canvas{position:absolute;inset:0;width:100%;height:100%}.odi-panel.activo{outline:2px solid var(--gold,#d4af37);outline-offset:-2px}
  .odi-cap{position:absolute;left:8px;bottom:8px;font-size:.8rem;background:rgba(0,0,0,.6);padding:3px 8px;border-radius:4px;pointer-events:none}
  .odi-msg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#a8a396}
  @media (max-width:700px){.odi-paneles{flex-direction:column}.odi-bar input[type=range]{width:70px}}`;
  document.head.appendChild(s);
}

// ── Pestaña «Imágenes» dentro de la historia clínica ────────────────────────
async function montar(cont, ctx) {
  estilos(); CTX = ctx; SEL = new Set();
  cont.innerHTML = '<p>Cargando imágenes…</p>';
  const url = await urlDrive();
  try {
    const s = await getDocs(collection(D().db, 'clinica', ctx.id, 'archivos'));
    LISTA = s.docs.map((d) => Object.assign({ id: d.id }, d.data())).filter((a) => !a.oculto).sort((a, b) => ms(b.fecha) - ms(a.fecha));
  } catch (e) { cont.innerHTML = `<p class="od-err">${esc(errTxt(e))}</p>`; return; }
  const conectar = !url ? (window.rolActual === 'senior'
    ? `<div class="od-ev"><b>Conectar el Drive del consultorio</b><p class="od-pend">Las radiografías y estudios se guardan en el Google Drive del consultorio. Pegue la dirección que le pasó The DOM:</p><div class="od-fila"><input class="od-in" id="odi-url" placeholder="https://script.google.com/macros/s/…/exec" style="flex:1;min-width:220px"><button type="button" class="od-btn" id="odi-url-ok">Conectar</button></div><div id="odi-url-msg"></div></div>`
    : '<p class="od-pend">Para subir radiografías y estudios falta conectar el Drive del consultorio (lo hace la Dirección).</p>') : '';
  cont.innerHTML = `${conectar}
    <div class="od-fila" style="margin-top:6px">
      ${url ? `<label class="od-btn" style="display:inline-flex;align-items:center;gap:6px">+ Subir radiografía o estudio<input type="file" id="odi-file" accept="image/*,application/pdf" multiple hidden></label>
      <select class="od-in" id="odi-tipo" style="width:auto" aria-label="Tipo de archivo">${['radiografia', 'foto', 'estudio', 'otro'].map((k) => `<option value="${k}">${TIPOS[k]}</option>`).join('')}</select>` : ''}
      <button type="button" class="od-btn sec" id="odi-esq">Marcar en esquema de la boca</button>
      <button type="button" class="od-btn sec" id="odi-comp" disabled>Comparar 2 seleccionadas</button>
    </div>
    <div id="odi-msg"></div>
    ${LISTA.length ? `<div class="odi-grid">${LISTA.map((a) => `<div class="odi-card" role="button" tabindex="0" data-a="${esc(a.id)}">
        ${a.thumb ? `<img src="${esc(a.thumb)}" alt="">` : `<div class="odi-pdf">${a.mime === 'application/pdf' ? '📄' : '🖼️'}</div>`}
        ${a.mime !== 'application/pdf' ? `<input type="checkbox" class="odi-sel" data-sel="${esc(a.id)}" aria-label="Seleccionar para comparar">` : ''}
        ${(a.marcas || []).length ? `<span class="odi-m">${(a.marcas || []).length} marca${(a.marcas || []).length === 1 ? '' : 's'}</span>` : ''}
        <div class="odi-t"><b>${esc(a.nombre)}</b>${esc(TIPOS[a.tipo] || a.tipo)} · ${esc(fecha(a.fecha))}</div></div>`).join('')}</div>`
      : '<p class="od-sub" style="margin-top:12px">Todavía no hay imágenes de este paciente.</p>'}`;
  const up = $('odi-url-ok');
  if (up) up.onclick = async () => {
    const v = $('odi-url').value.trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(v)) { $('odi-url-msg').innerHTML = '<p class="od-err">La dirección tiene que empezar con https://script.google.com/macros/s/ y terminar en /exec.</p>'; return; }
    up.disabled = true; URL_DRIVE = v;
    try { await llamar('ping'); await setDoc(doc(D().db, 'config', 'odonto'), { drive_url: v, actualizado: serverTimestamp(), actualizado_por: yo() }, { merge: true }); montar(cont, ctx); }
    catch (e) { URL_DRIVE = ''; up.disabled = false; $('odi-url-msg').innerHTML = `<p class="od-err">No se pudo conectar: ${esc(errTxt(e))}</p>`; }
  };
  const f = $('odi-file'); if (f) f.onchange = () => subir([...f.files], $('odi-tipo').value, cont);
  $('odi-esq').onclick = () => abrirVisor([{ esquema: true, nombre: 'Esquema de la boca' }]);
  cont.querySelectorAll('[data-sel]').forEach((c) => {
    c.onclick = (e) => e.stopPropagation();
    c.onchange = () => { if (c.checked) SEL.add(c.dataset.sel); else SEL.delete(c.dataset.sel); if (SEL.size > 2) { const p = [...SEL][0]; SEL.delete(p); const o = cont.querySelector(`[data-sel="${p}"]`); if (o) o.checked = false; } $('odi-comp').disabled = SEL.size !== 2; };
  });
  $('odi-comp').onclick = () => abrirVisor([...SEL].map((id) => LISTA.find((a) => a.id === id)));
  cont.querySelectorAll('[data-a]').forEach((c) => {
    const abrir = () => { const a = LISTA.find((x) => x.id === c.dataset.a); if (a) a.mime === 'application/pdf' ? abrirPdf(a) : abrirVisor([a]); };
    c.onclick = abrir; c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } };
  });
}

const aBase64 = (blob) => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = mal; r.readAsDataURL(blob); });
const cargarImg = (src) => new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = src; });
async function miniatura(img) {
  const k = 240 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round((img.naturalWidth || img.width) * Math.min(1, k))); c.height = Math.max(1, Math.round((img.naturalHeight || img.height) * Math.min(1, k)));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}
async function subir(files, tipo, cont) {
  const msg = $('odi-msg');
  for (const file of files) {
    if (file.size > MAX) { msg.innerHTML = `<p class="od-err">${esc(file.name)}: supera los 25 MB.</p>`; continue; }
    if (!/^image\/|^application\/pdf$/.test(file.type)) { msg.innerHTML = `<p class="od-err">${esc(file.name)}: solo imágenes o PDF.</p>`; continue; }
    msg.innerHTML = `<p class="od-pend">Subiendo ${esc(file.name)}…</p>`;
    try {
      let thumb = '';
      if (file.type.startsWith('image/')) { const u = URL.createObjectURL(file); try { thumb = await miniatura(await cargarImg(u)); } catch (e) { /* formato que el navegador no muestra */ } URL.revokeObjectURL(u); }
      const r = await llamar('subir', { nombre: file.name, mime: file.type, datos: await aBase64(file) });
      const datos = { nombre: file.name.replace(/\.[^.]+$/, ''), tipo, mime: file.type, drive_id: r.id, bytes: file.size, thumb, marcas: [], oculto: false, fecha: serverTimestamp(), autor: yo(), autor_nombre: window.nombreDisplay || '' };
      await addDoc(collection(D().db, 'clinica', CTX.id, 'archivos'), datos);
      if (CTX.registrar) await CTX.registrar({ tipo: 'evolucion', texto: `Se agregó ${TIPOS[tipo].toLowerCase()}: ${datos.nombre}` }).catch(() => {});
    } catch (e) { console.error(e); msg.innerHTML = `<p class="od-err">${esc(file.name)}: ${esc(errTxt(e))}</p>`; return; }
  }
  montar(cont, CTX);
}
async function abrirPdf(a) {
  const w = window.open('', '_blank');
  try { const r = await llamar('bajar', { id: a.drive_id }); const blob = new Blob([Uint8Array.from(atob(r.datos), (c) => c.charCodeAt(0))], { type: 'application/pdf' }); const u = URL.createObjectURL(blob); if (w) w.location = u; else window.open(u, '_blank'); }
  catch (e) { if (w) w.close(); alert(errTxt(e)); }
}

// ── Esquema de la boca (dibujado acá, sin subir nada) ───────────────────────
function esquemaSVG() {
  const W = 1200, H = 900, cx = 600;
  const ancho = (p) => { const d = p % 10; return d >= 6 ? 66 : d >= 4 ? 52 : d === 3 ? 46 : d === 2 ? 40 : 44; };
  // Reparte las piezas sobre media elipse según su ancho, para que no se encimen.
  const arco = (fila, cy, arriba) => {
    const rx = 470, ry = 320, a0 = 168 * Math.PI / 180, a1 = 12 * Math.PI / 180, N = 600, pts = [];
    for (let k = 0; k <= N; k++) { const a = a0 + (a1 - a0) * k / N; pts.push([cx + rx * Math.cos(a), cy + (arriba ? -1 : 1) * ry * Math.sin(a)]); }
    const acum = [0]; for (let k = 1; k <= N; k++) acum.push(acum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const total = acum[N], anchos = fila.map(ancho), suma = anchos.reduce((a, b) => a + b, 0), hueco = (total - suma) / (fila.length - 1 + 1);
    let pos = hueco / 2;
    return fila.map((p, i) => {
      const cen = pos + anchos[i] / 2; pos += anchos[i] + hueco;
      let k = acum.findIndex((v) => v >= cen); if (k < 1) k = 1;
      const [x, y] = pts[k], [x0, y0] = pts[k - 1], ang = Math.atan2(y - y0, x - x0) * 180 / Math.PI;
      const nx = cx - x, ny = cy - y, nl = Math.hypot(nx, ny) || 1, lx = x + nx / nl * 62, ly = y + ny / nl * 62;
      const w = anchos[i], h = w >= 60 ? 60 : w >= 50 ? 54 : 58, molar = w >= 60;
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(1)})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${molar ? 16 : 20}" fill="#fbfaf6" stroke="#7b7f88" stroke-width="3"/>${molar ? `<path d="M${-w / 4} ${-h / 4} L${w / 4} ${h / 4} M${w / 4} ${-h / 4} L${-w / 4} ${h / 4}" stroke="#c9ccd2" stroke-width="2"/>` : w >= 50 ? `<path d="M${-w / 4} 0 L${w / 4} 0" stroke="#c9ccd2" stroke-width="2"/>` : ''}</g><text x="${lx.toFixed(1)}" y="${(ly + 8).toFixed(1)}" text-anchor="middle" font-family="Arial" font-size="22" fill="#8f949c">${p}</text>`;
    }).join('');
  };
  const sup = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28], inf = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>
    <text x="40" y="56" font-family="Arial" font-size="26" fill="#9aa0aa">Superior</text><text x="40" y="${H - 34}" font-family="Arial" font-size="26" fill="#9aa0aa">Inferior</text>
    <text x="${W - 40}" y="56" font-family="Arial" font-size="22" fill="#b5b9c0" text-anchor="end">Derecha del paciente  |  Izquierda del paciente</text>
    <line x1="${cx}" y1="80" x2="${cx}" y2="${H - 80}" stroke="#e3e5e8" stroke-width="2" stroke-dasharray="8 8"/>
    ${arco(sup, 420, true)}${arco(inf, 480, false)}</svg>`;
}

// ── Visor ───────────────────────────────────────────────────────────────────
const COLORES = ['#ff3b30', '#ffd60a', '#32d4ff', '#34c759'];
function abrirVisor(archivos) {
  estilos();
  const V = document.createElement('div'); V.className = 'odi-v'; V.setAttribute('role', 'dialog'); V.setAttribute('aria-modal', 'true'); V.setAttribute('aria-label', 'Visor de imágenes');
  const comparar = archivos.length > 1;
  V.innerHTML = `<div class="odi-bar">
      <button type="button" class="od-chip" data-z="-" aria-label="Alejar">−</button><button type="button" class="od-chip" data-z="+" aria-label="Acercar">+</button><button type="button" class="od-chip" data-z="0">Ajustar</button>
      <span class="sep"></span>
      <label>Brillo <input type="range" id="odi-b" min="40" max="220" value="100"></label><label>Contraste <input type="range" id="odi-c" min="40" max="260" value="100"></label>
      <button type="button" class="od-chip" id="odi-neg" aria-pressed="false">Negativo</button>
      <span class="sep"></span>
      ${['mover', 'lapiz', 'flecha', 'circulo', 'texto'].map((t) => `<button type="button" class="od-chip" data-h="${t}" aria-pressed="${t === 'mover'}">${{ mover: 'Mover', lapiz: 'Lápiz', flecha: 'Flecha', circulo: 'Círculo', texto: 'Texto' }[t]}</button>`).join('')}
      ${COLORES.map((c, i) => `<span class="odi-col" role="button" tabindex="0" data-c="${c}" aria-pressed="${i === 0}" aria-label="Color" style="background:${c}"></span>`).join('')}
      <button type="button" class="od-chip" id="odi-undo">Deshacer</button>
      <span style="flex:1"></span>
      <button type="button" class="od-btn" id="odi-save" disabled style="padding:8px 14px">Guardar marcas</button>
      ${!comparar && archivos[0].id ? '<button type="button" class="od-btn sec" id="odi-ocultar" style="padding:8px 12px">Ocultar archivo</button>' : ''}
      <button type="button" class="od-x" id="odi-x" style="position:static" aria-label="Cerrar visor">✕</button>
    </div><div class="odi-paneles">${archivos.map((a, i) => `<div class="odi-panel${i === 0 ? ' activo' : ''}" data-p="${i}"><canvas></canvas><span class="odi-msg">Cargando…</span><span class="odi-cap">${esc(a.nombre || '')}${a.fecha ? ' · ' + esc(fecha(a.fecha)) : ''}</span></div>`).join('')}</div>`;
  document.body.appendChild(V);
  const paneles = archivos.map((a, i) => ({ a, el: V.querySelectorAll('.odi-panel')[i], img: null, s: 1, ox: 0, oy: 0, b: 1, c: 1, neg: false, marcas: (a.marcas || []).slice(), nuevas: 0 }));
  let act = paneles[0], herr = 'mover', color = COLORES[0], dibujando = null;
  const punteros = new Map();
  const cerrarV = () => { if (paneles.some((p) => p.nuevas) && !confirm('Hay marcas sin guardar. ¿Cerrar igual?')) return; V.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = (e) => { if (e.key === 'Escape') cerrarV(); };
  document.addEventListener('keydown', tecla);
  $('odi-x').onclick = cerrarV;

  const ajustar = (p) => { const r = p.el.getBoundingClientRect(); if (!p.img || !r.width) return; p.s = Math.min(r.width / p.img.width, r.height / p.img.height) * 0.95; p.ox = (r.width - p.img.width * p.s) / 2; p.oy = (r.height - p.img.height * p.s) / 2; };
  const dibujar = (p) => {
    const cv = p.el.querySelector('canvas'), r = p.el.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
    if (!p.img) return;
    g.setTransform(dpr * p.s, 0, 0, dpr * p.s, dpr * p.ox, dpr * p.oy);
    g.filter = `brightness(${p.b}) contrast(${p.c})${p.neg ? ' invert(1)' : ''}`; g.drawImage(p.img, 0, 0); g.filter = 'none';
    pintarMarcas(g, dibujando && dibujando.p === p ? p.marcas.concat([dibujando.m]) : p.marcas, p.s);
  };
  function pintarMarcas(g, todas, sc) {
    const lw = 3 / sc;
    todas.forEach((m) => {
      g.strokeStyle = m.c; g.fillStyle = m.c; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
      if (m.t === 'lapiz') { g.beginPath(); m.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); }
      else if (m.t === 'flecha') { const [ax, ay] = m.a, [bx, by] = m.b, an = Math.atan2(by - ay, bx - ax), L = 16 / sc; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - L * Math.cos(an - .45), by - L * Math.sin(an - .45)); g.lineTo(bx - L * Math.cos(an + .45), by - L * Math.sin(an + .45)); g.closePath(); g.fill(); }
      else if (m.t === 'circulo') { const [ax, ay] = m.a, [bx, by] = m.b; g.beginPath(); g.ellipse((ax + bx) / 2, (ay + by) / 2, Math.abs(bx - ax) / 2 || 1, Math.abs(by - ay) / 2 || 1, 0, 0, Math.PI * 2); g.stroke(); }
      else if (m.t === 'texto') { const fs = 22 / sc; g.font = `bold ${fs}px Arial`; g.lineWidth = 4 / sc; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(m.txt, m.a[0], m.a[1]); g.fillText(m.txt, m.a[0], m.a[1]); }
    });
  }
  const todo = () => paneles.forEach(dibujar);
  const estadoGuardar = () => { const b = $('odi-save'); if (b) b.disabled = !paneles.some((p) => p.nuevas); };
  window.addEventListener('resize', todo);

  // Carga de cada imagen
  paneles.forEach(async (p) => {
    try {
      let src;
      if (p.a.esquema || p.a.tipo === 'esquema') src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(esquemaSVG());
      else { const r = await llamar('bajar', { id: p.a.drive_id }); src = 'data:' + r.mime + ';base64,' + r.datos; }
      p.img = await cargarImg(src); p.el.querySelector('.odi-msg').remove(); ajustar(p); dibujar(p);
    } catch (e) { console.error(e); p.el.querySelector('.odi-msg').textContent = errTxt(e); }
  });

  // Barra
  V.querySelectorAll('[data-z]').forEach((b) => b.onclick = () => { const p = act, r = p.el.getBoundingClientRect(); if (b.dataset.z === '0') ajustar(p); else zoom(p, b.dataset.z === '+' ? 1.25 : 0.8, r.width / 2, r.height / 2); dibujar(p); });
  const sl = () => { act.b = $('odi-b').value / 100; act.c = $('odi-c').value / 100; dibujar(act); };
  $('odi-b').oninput = sl; $('odi-c').oninput = sl;
  $('odi-neg').onclick = () => { act.neg = !act.neg; $('odi-neg').setAttribute('aria-pressed', act.neg); dibujar(act); };
  V.querySelectorAll('[data-h]').forEach((b) => b.onclick = () => { herr = b.dataset.h; V.querySelectorAll('[data-h]').forEach((x) => x.setAttribute('aria-pressed', x === b)); });
  V.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { color = b.dataset.c; V.querySelectorAll('[data-c]').forEach((x) => x.setAttribute('aria-pressed', x === b)); });
  $('odi-undo').onclick = () => { if (act.nuevas) { act.marcas.pop(); act.nuevas--; dibujar(act); estadoGuardar(); } };
  const elegir = (p) => { act = p; paneles.forEach((x) => x.el.classList.toggle('activo', x === p)); $('odi-b').value = Math.round(p.b * 100); $('odi-c').value = Math.round(p.c * 100); $('odi-neg').setAttribute('aria-pressed', p.neg); };

  function zoom(p, k, cx, cy) { const ns = Math.min(30, Math.max(0.05, p.s * k)); p.ox = cx - (cx - p.ox) * (ns / p.s); p.oy = cy - (cy - p.oy) * (ns / p.s); p.s = ns; }
  const aImg = (p, e) => { const r = p.el.getBoundingClientRect(); return [(e.clientX - r.left - p.ox) / p.s, (e.clientY - r.top - p.oy) / p.s]; };

  paneles.forEach((p) => {
    const el = p.el;
    el.addEventListener('wheel', (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoom(p, e.deltaY < 0 ? 1.15 : 0.87, e.clientX - r.left, e.clientY - r.top); dibujar(p); }, { passive: false });
    el.addEventListener('pointerdown', (e) => {
      elegir(p); el.setPointerCapture(e.pointerId); punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!p.img) return;
      if (punteros.size === 1 && herr !== 'mover') {
        const pt = aImg(p, e);
        if (herr === 'texto') { const t = prompt('Texto de la marca (ej.: caries, fractura, pieza 36):'); punteros.delete(e.pointerId); if (t && t.trim()) { p.marcas.push({ t: 'texto', c: color, a: pt, txt: t.trim().slice(0, 60), autor: yo(), f: Date.now() }); p.nuevas++; dibujar(p); estadoGuardar(); } return; }
        dibujando = { p, m: herr === 'lapiz' ? { t: 'lapiz', c: color, pts: [pt] } : { t: herr, c: color, a: pt, b: pt } };
      } else dibujando = null;
    });
    el.addEventListener('pointermove', (e) => {
      if (!punteros.has(e.pointerId)) return;
      const prev = punteros.get(e.pointerId); punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (punteros.size === 2) { // pellizco: zoom y mover
        const [a, b] = [...punteros.values()], otro = [...punteros.entries()].find(([k]) => k !== e.pointerId)[1];
        const dAnt = Math.hypot(prev.x - otro.x, prev.y - otro.y), dAct = Math.hypot(a.x - b.x, a.y - b.y), r = el.getBoundingClientRect();
        if (dAnt > 0) zoom(p, dAct / dAnt, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        p.ox += (e.clientX - prev.x) / 2; p.oy += (e.clientY - prev.y) / 2; dibujando = null; dibujar(p); return;
      }
      if (dibujando && dibujando.p === p) { const pt = aImg(p, e); if (dibujando.m.t === 'lapiz') dibujando.m.pts.push(pt); else dibujando.m.b = pt; dibujar(p); }
      else if (herr === 'mover' || !dibujando) { p.ox += e.clientX - prev.x; p.oy += e.clientY - prev.y; dibujar(p); }
    });
    const fin = (e) => {
      punteros.delete(e.pointerId);
      if (dibujando && dibujando.p === p) {
        const m = dibujando.m; dibujando = null;
        const util = m.t === 'lapiz' ? m.pts.length > 2 : Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]) * p.s > 8;
        if (util) { if (m.t === 'lapiz') m.pts = m.pts.filter((_, i) => i % 2 === 0 || i === m.pts.length - 1).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]); p.marcas.push(Object.assign(m, { autor: yo(), f: Date.now() })); p.nuevas++; estadoGuardar(); }
        dibujar(p);
      }
    };
    el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin);
  });

  // Guardar marcas (y dejar constancia en la historia)
  $('odi-save').onclick = async () => {
    const b = $('odi-save'); b.disabled = true; b.textContent = 'Guardando…';
    try {
      for (const p of paneles.filter((x) => x.nuevas)) {
        if (p.a.esquema) { // el esquema se guarda como un archivo nuevo, con su miniatura
          const cv = document.createElement('canvas'); cv.width = p.img.width; cv.height = p.img.height; const g = cv.getContext('2d'); g.drawImage(p.img, 0, 0);
          pintarMarcas(g, p.marcas, 0.5);
          const thumb = await miniatura(cv);
          const r = await addDoc(collection(D().db, 'clinica', CTX.id, 'archivos'), { nombre: 'Esquema de la boca ' + new Date().toLocaleDateString('es-AR'), tipo: 'esquema', mime: 'image/svg+xml', drive_id: '', bytes: 0, thumb, marcas: p.marcas, oculto: false, fecha: serverTimestamp(), autor: yo(), autor_nombre: window.nombreDisplay || '' });
          p.a = Object.assign({}, p.a, { id: r.id, esquema: false, tipo: 'esquema' });
          if (CTX.registrar) await CTX.registrar({ tipo: 'evolucion', texto: `Marcas en el esquema de la boca: ${p.marcas.length}` + resumenTextos(p.marcas) }).catch(() => {});
        } else {
          await updateDoc(doc(D().db, 'clinica', CTX.id, 'archivos', p.a.id), { marcas: p.marcas, marcas_actualizado: serverTimestamp(), marcas_por: yo() });
          const a = LISTA.find((x) => x.id === p.a.id); if (a) a.marcas = p.marcas.slice();
          if (CTX.registrar) await CTX.registrar({ tipo: 'evolucion', texto: `Marcas en «${p.a.nombre}»: ${p.nuevas} nueva${p.nuevas === 1 ? '' : 's'}` + resumenTextos(p.marcas.slice(-p.nuevas)) }).catch(() => {});
        }
        p.nuevas = 0;
      }
      b.textContent = 'Marcas guardadas ✓'; setTimeout(() => { if (b.isConnected) b.textContent = 'Guardar marcas'; }, 2000);
      if (CTX.refrescar) CTX.refrescar();
    } catch (e) { console.error(e); b.disabled = false; b.textContent = 'Guardar marcas'; alert(errTxt(e)); }
    estadoGuardar();
  };
  const oc = $('odi-ocultar');
  if (oc) oc.onclick = async () => {
    const motivo = prompt('¿Por qué se oculta este archivo? (queda registrado; el archivo no se borra del Drive)'); if (motivo === null) return;
    if (!motivo.trim()) { alert('Escriba el motivo.'); return; }
    try {
      await updateDoc(doc(D().db, 'clinica', CTX.id, 'archivos', archivos[0].id), { oculto: true, oculto_motivo: motivo.trim(), oculto_por: yo(), oculto_en: serverTimestamp() });
      if (CTX.registrar) await CTX.registrar({ tipo: 'evolucion', texto: `Se ocultó «${archivos[0].nombre}». Motivo: ${motivo.trim()}` }).catch(() => {});
      paneles.forEach((p) => p.nuevas = 0); V.remove(); if (CTX.refrescar) CTX.refrescar();
    } catch (e) { alert(errTxt(e)); }
  };
  if (comparar) paneles.forEach((p) => p.el.addEventListener('pointerdown', () => elegir(p)));
}
const resumenTextos = (ms_) => { const t = ms_.filter((m) => m.t === 'texto').map((m) => m.txt); return t.length ? ` (${t.join(', ')})` : ''; };

window.odImagenes = { montar };
