// DOMino Bienestar · Módulo exclusivo ODONTOLOGÍA (etapa 3b: consentimientos firmados en pantalla).
// Pestaña «Consentimientos» de la historia clínica (solo profesionales).
// Modelos: negocios/{id}/config/odonto_consentimientos (los edita la Dirección; vienen 4 modelos generales para revisar).
// Firmados: negocios/{id}/clinica/{paciente}/consentimientos/{id} → texto final + firmas (imagen chica). Solo se crean; nunca se modifican.
// El PDF se arma cuando se pide, a partir de lo guardado.
import { getDoc, getDocs, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { collection, doc } from "./tenant.js";

const D = () => window.DOMINO, $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yo = () => String((D().auth && D().auth.currentUser && D().auth.currentUser.email) || D().email || '').toLowerCase();
const fechaHora = (t) => { const d = t && t.toDate ? t.toDate() : (t ? new Date(t) : null); return d ? d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) + ' h' : ''; };
const ms = (t) => t && t.toMillis ? t.toMillis() : (t ? new Date(t).getTime() : 0);

// Modelos generales. Son un punto de partida: el consultorio los revisa con su asesor y los ajusta desde «Modelos».
const MODELOS = [
  { id: 'general', titulo: 'Consentimiento informado para tratamiento odontológico',
    texto: `Yo, {paciente}, DNI {dni}, declaro que {profesional} me explicó en un lenguaje claro mi diagnóstico, el tratamiento propuesto ({practica}), sus beneficios, sus riesgos y molestias más frecuentes, las alternativas posibles y lo que puede pasar si no me trato.

Entiendo que durante el tratamiento puede ser necesario usar anestesia local, tomar radiografías o fotografías clínicas, y que en algunos casos el plan puede cambiar según lo que se encuentre; si eso pasa, se me va a informar antes.

Informé con sinceridad mis enfermedades, alergias, medicación y si estoy embarazada. Tuve la oportunidad de hacer preguntas y me fueron respondidas. Sé que puedo retirar este consentimiento en cualquier momento antes de iniciar el tratamiento.

Por todo lo anterior, doy mi consentimiento para que se realice el tratamiento indicado en {consultorio}.` },
  { id: 'extraccion', titulo: 'Consentimiento informado para extracción dentaria',
    texto: `Yo, {paciente}, DNI {dni}, autorizo a {profesional} a realizar la extracción de la/s pieza/s {practica}.

Se me explicó que es un procedimiento quirúrgico con anestesia local y que después puedo tener dolor, inflamación, sangrado leve o un moretón durante algunos días. Con menor frecuencia pueden presentarse infección, alveolitis (dolor por mala cicatrización), sensibilidad o adormecimiento transitorio del labio o la lengua, comunicación con el seno maxilar o fractura de la raíz, que pueden requerir otros tratamientos.

Me comprometo a seguir las indicaciones que se me den después de la extracción. Informé mis enfermedades, alergias y medicación (en especial anticoagulantes).

Doy mi consentimiento para la extracción en {consultorio}.` },
  { id: 'endodoncia', titulo: 'Consentimiento informado para tratamiento de conducto',
    texto: `Yo, {paciente}, DNI {dni}, autorizo a {profesional} a realizar el tratamiento de conducto (endodoncia) de la/s pieza/s {practica}.

Se me explicó que el tratamiento busca conservar la pieza limpiando y sellando sus conductos, que puede requerir más de una sesión y que después la pieza suele necesitar una restauración o corona. Puede haber molestias durante unos días. En algunos casos el tratamiento no da el resultado esperado (por ejemplo, por conductos calcificados o curvos, fractura de un instrumento o fisura de la pieza) y puede ser necesario repetirlo, hacer una cirugía o extraer la pieza.

Informé mis enfermedades, alergias y medicación. Doy mi consentimiento para el tratamiento en {consultorio}.` },
  { id: 'blanqueamiento', titulo: 'Consentimiento informado para blanqueamiento dental',
    texto: `Yo, {paciente}, DNI {dni}, autorizo a {profesional} a realizar un blanqueamiento dental ({practica}).

Se me explicó que el resultado varía en cada persona y no se puede garantizar un tono exacto; que las restauraciones, coronas o carillas no cambian de color; que durante y después del tratamiento puede aparecer sensibilidad dental o irritación de las encías, que suelen ser pasajeras; y que el resultado dura más si evito tabaco, café, té, mate y vino tinto y mantengo los controles.

Informé si estoy embarazada o amamantando y mis alergias. Doy mi consentimiento para el blanqueamiento en {consultorio}.` }
];
let MOD = null;
async function modelos() {
  if (MOD) return MOD;
  try { const s = await getDoc(doc(D().db, 'config', 'odonto_consentimientos')); MOD = s.exists() && (s.data().items || []).length ? s.data().items : MODELOS.map((m) => Object.assign({}, m)); } catch (e) { MOD = MODELOS.map((m) => Object.assign({}, m)); }
  return MOD;
}

let CTX = null;
async function montar(cont, ctx) {
  CTX = ctx; cont.innerHTML = '<p>Cargando…</p>';
  await modelos();
  let lista = [];
  try { const s = await getDocs(collection(D().db, 'clinica', ctx.id, 'consentimientos')); lista = s.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => ms(b.fecha) - ms(a.fecha)); }
  catch (e) { cont.innerHTML = '<p class="od-err">No se pudieron cargar los consentimientos.</p>'; return; }
  cont.innerHTML = `
    <div class="od-fila"><select class="od-in" id="okc-mod" style="flex:1;min-width:220px" aria-label="Modelo de consentimiento">${MOD.map((m) => `<option value="${esc(m.id)}">${esc(m.titulo)}</option>`).join('')}</select>
      <button type="button" class="od-btn" id="okc-nuevo">Firmar consentimiento</button>
      ${window.rolActual === 'senior' ? '<button type="button" class="od-btn sec" id="okc-modelos">Modelos</button>' : ''}</div>
    <div id="od-msg"></div>
    ${lista.length ? lista.map((k) => `<div class="od-ev"><div class="meta">${esc(fechaHora(k.fecha))} · ${esc(k.profesional_nombre || k.autor)}</div><div class="od-fila" style="justify-content:space-between"><b>${esc(k.titulo)}</b><button type="button" class="od-btn sec" data-pdf="${esc(k.id)}" style="padding:7px 12px">Ver PDF</button></div>${k.firmante && k.firmante.vinculo ? `<div class="od-pend">Firmó ${esc(k.firmante.nombre)} (${esc(k.firmante.vinculo)})</div>` : ''}</div>`).join('') : '<p class="od-sub" style="margin-top:12px">Este paciente todavía no firmó consentimientos.</p>'}`;
  $('okc-nuevo').onclick = () => firmar(cont, MOD.find((m) => m.id === $('okc-mod').value));
  if ($('okc-modelos')) $('okc-modelos').onclick = () => editarModelos(cont);
  cont.querySelectorAll('[data-pdf]').forEach((b) => b.onclick = () => pdf(lista.find((k) => k.id === b.dataset.pdf), b));
}

// ── Firma ───────────────────────────────────────────────────────────────────
function pad(cv) {
  const g = cv.getContext('2d'); let on = false, ult = null, trazos = 0;
  const ajustar = () => { const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#0a0a0a'; g.fillStyle = '#fff'; g.fillRect(0, 0, r.width, r.height); trazos = 0; };
  ajustar();
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => { on = true; ult = pt(e); cv.setPointerCapture(e.pointerId); g.beginPath(); g.arc(ult[0], ult[1], 1.1, 0, 7); g.fillStyle = '#0a0a0a'; g.fill(); trazos++; });
  cv.addEventListener('pointermove', (e) => { if (!on) return; const p = pt(e); g.beginPath(); g.moveTo(ult[0], ult[1]); g.lineTo(p[0], p[1]); g.stroke(); ult = p; trazos++; });
  const fin = () => { on = false; }; cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
  return { limpiar: ajustar, vacia: () => trazos < 6, png: () => recortar(cv) };
}
function recortar(cv) {
  const g = cv.getContext('2d'), { width: w, height: h } = cv, d = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const i = (y * w + x) * 4; if (d[i] < 200) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (x1 <= x0) return '';
  const m = 8; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w, x1 + m); y1 = Math.min(h, y1 + m);
  const k = Math.min(1, 500 / (x1 - x0)), o = document.createElement('canvas'); o.width = Math.round((x1 - x0) * k); o.height = Math.round((y1 - y0) * k);
  const og = o.getContext('2d'); og.fillStyle = '#fff'; og.fillRect(0, 0, o.width, o.height); og.drawImage(cv, x0, y0, x1 - x0, y1 - y0, 0, 0, o.width, o.height);
  return o.toDataURL('image/png');
}
const rellenar = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null && v[k] !== '' ? v[k] : '____________'));

async function firmar(cont, m) {
  if (!m) return;
  let socio = {};
  try { const s = await getDoc(doc(D().db, 'clients', CTX.id)); socio = s.exists() ? s.data() : {}; } catch (e) { /* sin datos */ }
  const neg = (D().negocioDoc && D().negocioDoc.nombre) || 'el consultorio';
  const prof = window.nombreDisplay || yo();
  cont.innerHTML = `<h3 style="margin:4px 0 8px">${esc(m.titulo)}</h3>
    <div class="od-grid">
      <div><label class="od-l" for="okc-pr">Tratamiento o piezas</label><input class="od-in" id="okc-pr" placeholder="Ej.: extracción de la pieza 38"></div>
      <div><label class="od-l" for="okc-dni">DNI del paciente</label><input class="od-in" id="okc-dni" value="${esc(socio.cuit || '')}" inputmode="numeric"></div>
    </div>
    <label class="od-checks" style="margin-top:10px"><label><input type="checkbox" id="okc-resp"> Firma otra persona (madre, padre, tutor o responsable)</label></label>
    <div class="od-grid" id="okc-respd" hidden>
      <div><label class="od-l" for="okc-rn">Nombre de quien firma</label><input class="od-in" id="okc-rn"></div>
      <div><label class="od-l" for="okc-rd">DNI</label><input class="od-in" id="okc-rd" inputmode="numeric"></div>
      <div><label class="od-l" for="okc-rv">Vínculo con el paciente</label><input class="od-in" id="okc-rv" placeholder="Ej.: madre"></div>
    </div>
    <label class="od-l">Texto que se firma</label>
    <div class="od-ev" id="okc-txt" style="white-space:pre-wrap;max-height:260px;overflow:auto;background:#0f1114"></div>
    <label class="od-l">Firma del paciente <span id="okc-quien"></span></label>
    <canvas id="okc-fp" style="width:100%;height:170px;border:1px dashed #8a8f98;border-radius:6px;background:#fff;touch-action:none"></canvas>
    <div class="od-fila fin" style="margin-top:4px"><button type="button" class="od-btn sec" id="okc-lp" style="padding:6px 12px">Borrar firma</button></div>
    <label class="od-l">Firma de ${esc(prof)}</label>
    <canvas id="okc-fr" style="width:100%;height:130px;border:1px dashed #8a8f98;border-radius:6px;background:#fff;touch-action:none"></canvas>
    <div class="od-fila fin" style="margin-top:4px"><button type="button" class="od-btn sec" id="okc-lr" style="padding:6px 12px">Borrar firma</button></div>
    <div class="od-fila fin"><button type="button" class="od-btn sec" id="okc-volver">Volver</button><button type="button" class="od-btn" id="okc-ok">Guardar consentimiento firmado</button></div>
    <p class="od-pend">Una vez guardado no se puede modificar. Si hay un error, se firma uno nuevo.</p><div id="od-msg"></div>`;
  const vals = () => ({ paciente: socio.nombre_empresa || CTX.nombre, dni: $('okc-dni').value.trim(), profesional: prof, practica: $('okc-pr').value.trim(), consultorio: neg, fecha: new Date().toLocaleDateString('es-AR') });
  const ver = () => {
    let t = rellenar(m.texto, vals());
    if ($('okc-resp').checked) t += `\n\nFirma en representación del paciente: ${$('okc-rn').value.trim() || '____________'}, DNI ${$('okc-rd').value.trim() || '____________'} (${$('okc-rv').value.trim() || 'vínculo'}).`;
    $('okc-txt').textContent = t; $('okc-quien').textContent = $('okc-resp').checked ? '(o de quien firma por él/ella)' : '';
    return t;
  };
  ['okc-pr', 'okc-dni', 'okc-rn', 'okc-rd', 'okc-rv'].forEach((id) => $(id).addEventListener('input', ver));
  $('okc-resp').onchange = () => { $('okc-respd').hidden = !$('okc-resp').checked; ver(); };
  ver();
  const fp = pad($('okc-fp')), fr = pad($('okc-fr'));
  $('okc-lp').onclick = fp.limpiar; $('okc-lr').onclick = fr.limpiar;
  $('okc-volver').onclick = () => montar(cont, CTX);
  $('okc-ok').onclick = async () => {
    const msg = $('od-msg');
    if (!$('okc-pr').value.trim()) { msg.innerHTML = '<p class="od-err">Escriba el tratamiento o las piezas.</p>'; return; }
    if ($('okc-resp').checked && (!$('okc-rn').value.trim() || !$('okc-rv').value.trim())) { msg.innerHTML = '<p class="od-err">Complete el nombre y el vínculo de quien firma.</p>'; return; }
    if (fp.vacia()) { msg.innerHTML = '<p class="od-err">Falta la firma del paciente.</p>'; return; }
    if (fr.vacia()) { msg.innerHTML = '<p class="od-err">Falta la firma de la profesional.</p>'; return; }
    const b = $('okc-ok'); b.disabled = true; b.textContent = 'Guardando…';
    const datos = { modelo: m.id, titulo: m.titulo, texto: ver(), practica: $('okc-pr').value.trim(), paciente: vals().paciente, dni: vals().dni,
      firmante: $('okc-resp').checked ? { nombre: $('okc-rn').value.trim(), dni: $('okc-rd').value.trim(), vinculo: $('okc-rv').value.trim() } : null,
      firma_paciente: fp.png(), firma_profesional: fr.png(), profesional: yo(), profesional_nombre: prof, consultorio: neg, autor: yo(), fecha: serverTimestamp() };
    try {
      await addDoc(collection(D().db, 'clinica', CTX.id, 'consentimientos'), datos);
      if (CTX.registrar) await CTX.registrar({ tipo: 'evolucion', texto: `Consentimiento firmado: ${m.titulo} (${datos.practica})${datos.firmante ? ` · firmó ${datos.firmante.nombre}, ${datos.firmante.vinculo}` : ''}` }).catch(() => {});
      await montar(cont, CTX); $('od-msg').innerHTML = '<p class="od-ok">Consentimiento guardado. Puede verlo o compartirlo en PDF.</p>';
    } catch (e) { console.error(e); b.disabled = false; b.textContent = 'Guardar consentimiento firmado'; msg.innerHTML = `<p class="od-err">${/permission/i.test(String(e.code || e.message)) ? 'Sin permiso para guardar (solo profesionales).' : 'No se pudo guardar. Revise su conexión.'}</p>`; }
  };
}

// ── Modelos (Dirección) ─────────────────────────────────────────────────────
function editarModelos(cont) {
  const L = MOD.map((m) => Object.assign({}, m));
  const pintar = () => {
    cont.innerHTML = `<p class="od-pend">Son modelos generales para revisar con su asesor. Puede usar estos datos, que se completan solos: {paciente}, {dni}, {profesional}, {practica}, {consultorio}, {fecha}.</p>
      ${L.map((m, i) => `<div class="od-ev" data-i="${i}"><label class="od-l" style="margin-top:0">Título</label><input class="od-in" data-k="titulo" value="${esc(m.titulo)}"><label class="od-l">Texto</label><textarea class="od-in" data-k="texto" style="min-height:180px">${esc(m.texto)}</textarea><div class="od-fila fin" style="margin-top:6px"><button type="button" class="od-btn sec" data-q="${i}" style="padding:6px 12px">Quitar modelo</button></div></div>`).join('')}
      <div class="od-fila"><button type="button" class="od-btn sec" id="okc-mas">+ Agregar modelo</button><button type="button" class="od-btn sec" id="okc-rest">Volver a los modelos de fábrica</button></div>
      <div class="od-fila fin"><button type="button" class="od-btn sec" id="okc-volver">Volver</button><button type="button" class="od-btn" id="okc-gm">Guardar modelos</button></div><div id="od-msg"></div>`;
    const leer = () => cont.querySelectorAll('[data-i]').forEach((d) => { const m = L[Number(d.dataset.i)]; m.titulo = d.querySelector('[data-k=titulo]').value.trim(); m.texto = d.querySelector('[data-k=texto]').value; });
    $('okc-volver').onclick = () => montar(cont, CTX);
    $('okc-mas').onclick = () => { leer(); L.push({ id: 'm' + Date.now().toString(36), titulo: 'Nuevo consentimiento', texto: 'Yo, {paciente}, DNI {dni}, ' }); pintar(); };
    $('okc-rest').onclick = () => { if (!confirm('¿Volver a los 4 modelos de fábrica? Se pierden los cambios que no guardó.')) return; L.splice(0, L.length, ...MODELOS.map((m) => Object.assign({}, m))); pintar(); };
    cont.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { leer(); L.splice(Number(b.dataset.q), 1); pintar(); });
    $('okc-gm').onclick = async () => {
      leer(); const items = L.filter((m) => m.titulo && m.texto.trim());
      if (!items.length) { $('od-msg').innerHTML = '<p class="od-err">Tiene que quedar al menos un modelo.</p>'; return; }
      try { await setDoc(doc(D().db, 'config', 'odonto_consentimientos'), { items, actualizado: serverTimestamp(), actualizado_por: yo() }); MOD = items; await montar(cont, CTX); $('od-msg').innerHTML = '<p class="od-ok">Modelos guardados.</p>'; }
      catch (e) { $('od-msg').innerHTML = '<p class="od-err">No se pudo guardar (solo Dirección).</p>'; }
    };
  };
  pintar();
}

// ── PDF ─────────────────────────────────────────────────────────────────────
const ansi = (t) => String(t ?? '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, '-').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
function cargarPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  return new Promise((ok, mal) => { const s = document.createElement('script'); s.src = 'libs/pdf-lib.min.js'; s.onload = () => ok(window.PDFLib); s.onerror = mal; document.head.appendChild(s); });
}
async function pdf(k, boton) {
  if (!k) return; if (boton) { boton.disabled = true; boton.textContent = 'Armando…'; }
  try {
    const { PDFDocument, StandardFonts, rgb } = await cargarPdfLib();
    const doc_ = await PDFDocument.create(), fR = await doc_.embedFont(StandardFonts.Helvetica), fB = await doc_.embedFont(StandardFonts.HelveticaBold);
    const W = 595.28, H = 841.89, M = 56; let pg = doc_.addPage([W, H]), y = H - M;
    const linea = (t, f, s, ancho) => { const out = []; ansi(t).split('\n').forEach((par) => { let l = ''; par.split(' ').forEach((w) => { const p = l ? l + ' ' + w : w; if (f.widthOfTextAtSize(p, s) > ancho && l) { out.push(l); l = w; } else l = p; }); out.push(l); }); return out; };
    const texto = (t, o = {}) => { const f = o.b ? fB : fR, s = o.s || 10.5; linea(t, f, s, W - 2 * M).forEach((l) => { if (y < M + 40) { pg = doc_.addPage([W, H]); y = H - M; } pg.drawText(l, { x: M, y, size: s, font: f, color: o.c || rgb(.08, .08, .08) }); y -= s * 1.45; }); };
    texto(k.consultorio || '', { s: 10, c: rgb(.42, .42, .42) });
    texto(k.titulo, { b: true, s: 15 }); y -= 6;
    texto(k.texto); y -= 18;
    if (y < M + 190) { pg = doc_.addPage([W, H]); y = H - M; }
    const firma = async (src, x, rot) => {
      if (src) { const img = await doc_.embedPng(src), k2 = Math.min(200 / img.width, 70 / img.height, 1); pg.drawImage(img, { x, y: y - 70 + (70 - img.height * k2), width: img.width * k2, height: img.height * k2 }); }
      pg.drawLine({ start: { x, y: y - 76 }, end: { x: x + 210, y: y - 76 }, thickness: .7, color: rgb(.3, .3, .3) });
      linea(rot, fR, 8.5, 210).forEach((l, i) => pg.drawText(l, { x, y: y - 90 - i * 11, size: 8.5, font: fR, color: rgb(.3, .3, .3) }));
    };
    await firma(k.firma_paciente, M, k.firmante ? `${k.firmante.nombre} · DNI ${k.firmante.dni || '-'} · ${k.firmante.vinculo} de ${k.paciente}` : `${k.paciente} · DNI ${k.dni || '-'}`);
    await firma(k.firma_profesional, W - M - 210, `${k.profesional_nombre}`);
    y -= 130; texto(`Firmado el ${fechaHora(k.fecha)}. Documento generado desde DOMino Bienestar; el original firmado se conserva en la historia clínica y no se puede modificar.`, { s: 8.5, c: rgb(.42, .42, .42) });
    doc_.getPages().forEach((p) => p.drawText('Desarrollado por The DOM Studio Web · WhatsApp 261-3431216', { x: M, y: 24, size: 7, font: fR, color: rgb(.5, .5, .5) }));
    const bytes = await doc_.save(), nom = ansi(`${k.titulo} - ${k.paciente}`).replace(/[\\/:*?"<>|]/g, '').slice(0, 90) + '.pdf', file = new File([bytes], nom, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: nom }); } catch (e) { /* cancelado */ } }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = nom; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  } catch (e) { console.error(e); alert('No se pudo armar el PDF.'); }
  if (boton) { boton.disabled = false; boton.textContent = 'Ver PDF'; }
}

window.odConsentimientos = { montar };
