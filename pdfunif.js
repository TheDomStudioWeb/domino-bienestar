// DOMino Profesional · Unificador de archivos en PDF
// Junta fotos, PDF, Word (.docx) y Excel (.xlsx, .xls, .csv) en un solo PDF.
// Todo ocurre en el dispositivo: ningún archivo se sube ni se envía a ningún servidor.
// Las librerías se cargan recién cuando hacen falta (pdf-lib siempre; mammoth solo para Word; xlsx solo para Excel).

const $ = (id) => document.getElementById(id);
const aviso = (t) => { if (window.DOMINO && window.DOMINO.aviso) window.DOMINO.aviso(t); else console.log(t); };

const LIBS = { pdflib: 'libs/pdf-lib.min.js', mammoth: 'libs/mammoth.browser.min.js', xlsx: 'libs/xlsx.mini.min.js' };
const cargadas = {};
function cargarLib(k) {
  if (!cargadas[k]) {
    cargadas[k] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = LIBS[k]; s.onload = res;
      s.onerror = () => { delete cargadas[k]; rej(new Error('No se pudo cargar ' + LIBS[k] + '. Revisá la conexión.')); };
      document.head.appendChild(s);
    });
  }
  return cargadas[k];
}

const A4 = [595.28, 841.89];
const MAX_FILAS = 3000;
const NO_SOPORTADOS = /\.(pptx?|zip|rar|7z|mp3|wav|m4a|ogg|aac|mp4|mov|avi|mkv)$/i;
let items = []; // { tipo: 'img'|'pdf'|'word'|'excel', nombre, blob, url?, paginas?, giro }
let resultado = null;

const tipoDe = (f) => {
  const n = (f.name || '').toLowerCase();
  if (NO_SOPORTADOS.test(n)) return 'no';
  if (f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/.test(n)) return 'img';
  if (f.type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.docx')) return 'word';
  if (n.endsWith('.doc')) return 'doc';
  if (/\.(xlsx|xls|csv)$/.test(n)) return 'excel';
  return 'no';
};

// ---------------------------------------------------------------
// Alta de archivos
// ---------------------------------------------------------------
async function agregar(files) {
  const rechazados = [];
  for (const f of files) {
    const t = tipoDe(f);
    try {
      if (t === 'img') items.push({ tipo: 'img', nombre: f.name || 'foto.jpg', blob: f, url: URL.createObjectURL(f), giro: 0 });
      else if (t === 'pdf') {
        await cargarLib('pdflib');
        const doc = await PDFLib.PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
        items.push({ tipo: 'pdf', nombre: f.name, blob: f, paginas: doc.getPageCount() });
      } else if (t === 'word') items.push({ tipo: 'word', nombre: f.name, blob: f });
      else if (t === 'excel') items.push({ tipo: 'excel', nombre: f.name, blob: f });
      else if (t === 'doc') rechazados.push(`${f.name}: es un Word antiguo (.doc). Guardalo como .docx o exportalo a PDF.`);
      else rechazados.push(`${f.name}: este tipo de archivo no se puede unir. Exportalo a PDF desde su programa.`);
    } catch (e) { rechazados.push(`${f.name}: no se pudo leer (${e.message || 'archivo dañado'}).`); }
  }
  dibujarLista();
  const out = $('pdf-aviso');
  out.innerHTML = rechazados.length ? '<b>No se agregaron:</b><br>' + rechazados.map((x) => esc(x)).join('<br>') : '';
  out.className = 'tool-out' + (rechazados.length ? ' mal' : '');
}
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ETQ = { img: 'FOTO', pdf: 'PDF', word: 'WORD', excel: 'EXCEL' };

function dibujarLista() {
  resultado = null; $('pdf-resultado').hidden = true;
  $('pdf-lista-wrap').hidden = !items.length;
  const total = items.reduce((s, it) => s + (it.tipo === 'pdf' ? it.paginas : 1), 0);
  $('pdf-cuenta').textContent = items.length ? `${items.length} ${items.length === 1 ? 'archivo' : 'archivos'}` : '';
  $('pdf-lista').innerHTML = items.map((it, i) => `
    <div class="pdf-it" data-i="${i}">
      ${it.tipo === 'img' ? `<div class="pdf-th" style="background-image:url(${it.url});transform:rotate(${it.giro}deg)"></div>` : `<div class="pdf-th pdf-th-t">${ETQ[it.tipo]}</div>`}
      <div class="pdf-nm"><b>${esc(it.nombre)}</b><small>${it.tipo === 'pdf' ? `${it.paginas} ${it.paginas === 1 ? 'página' : 'páginas'}` : it.tipo === 'img' ? 'Una página' : 'Se convierte al unir'}</small></div>
      <div class="pdf-ac">
        ${it.tipo === 'img' ? `<button type="button" data-a="giro" aria-label="Girar">⟳</button>` : ''}
        <button type="button" data-a="up" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" data-a="down" aria-label="Bajar" ${i === items.length - 1 ? 'disabled' : ''}>▼</button>
        <button type="button" data-a="del" class="pdf-del" aria-label="Quitar">✕</button>
      </div>
    </div>`).join('');
}

// ---------------------------------------------------------------
// Imágenes → JPEG (con giro y límite de tamaño) para incrustar
// ---------------------------------------------------------------
async function imagenAJpeg(it) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo abrir ' + it.nombre)); i.src = it.url; });
  const k = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const g = ((it.giro % 360) + 360) % 360;
  const c = document.createElement('canvas');
  c.width = g % 180 ? h : w; c.height = g % 180 ? w : h;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.translate(c.width / 2, c.height / 2); x.rotate(g * Math.PI / 180);
  x.drawImage(img, -w / 2, -h / 2, w, h);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.84));
  return new Uint8Array(await blob.arrayBuffer());
}

// ---------------------------------------------------------------
// Escritor de texto con saltos de línea y de página (Word y Excel)
// ---------------------------------------------------------------
function crearEscritor(out, fuentes, opts = {}) {
  const W = { pagina: opts.size || A4, margen: opts.margen ?? 54 };
  const e = { pg: null, y: 0 };
  const ancho = () => W.pagina[0] - W.margen * 2;
  const limpio = (txt, f) => {
    const set = f.getCharacterSet ? new Set(f.getCharacterSet()) : null;
    let r = '';
    const NBSP = String.fromCharCode(160), LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
    const base = String(txt).split(NBSP).join(' ').split(LS).join(' ').split(PS).join(' ').replace(/\t/g, ' ').replace(/[\r\n]+/g, ' ');
    for (const ch of base) {
      const cp = ch.codePointAt(0);
      r += (!set || set.has(cp)) ? ch : (cp === 0x2022 || cp === 0x25CF ? '•' : '?');
    }
    return r;
  };
  const nueva = () => { e.pg = out.addPage(W.pagina); e.y = W.pagina[1] - W.margen; if (opts.alNuevaPagina) opts.alNuevaPagina(e); return e.pg; };
  const asegura = (alto) => { if (!e.pg || e.y - alto < W.margen) nueva(); };
  const ancho_ = (txt, f, s) => f.widthOfTextAtSize(txt, s);
  // Parte un texto en renglones que entran en 'maxW'
  const partir = (txt, f, s, maxW) => {
    const palabras = limpio(txt, f).split(' ').filter((p) => p !== '');
    const lineas = []; let l = '';
    for (const p of palabras) {
      let t = l ? l + ' ' + p : p;
      if (ancho_(t, f, s) <= maxW) { l = t; continue; }
      if (l) lineas.push(l);
      l = p;
      while (ancho_(l, f, s) > maxW && l.length > 1) { // palabra más larga que el renglón
        let n = l.length; while (n > 1 && ancho_(l.slice(0, n), f, s) > maxW) n--;
        lineas.push(l.slice(0, n)); l = l.slice(n);
      }
    }
    if (l || !lineas.length) lineas.push(l);
    return lineas;
  };
  return { W, e, ancho, limpio, nueva, asegura, partir, ancho_ };
}

// ---------------------------------------------------------------
// Word (.docx) → PDF: texto, títulos, listas, tablas e imágenes simples
// ---------------------------------------------------------------
async function agregarWord(out, it, F) {
  await cargarLib('mammoth');
  const res = await mammoth.convertToHtml({ arrayBuffer: await it.blob.arrayBuffer() });
  const doc = new DOMParser().parseFromString('<body>' + res.value + '</body>', 'text/html');
  const w = crearEscritor(out, F);
  const { e } = w;
  const fuenteDe = (b, i) => (b && i ? F.negrCurs : b ? F.neg : i ? F.curs : F.reg);
  // Aplana un nodo en "corridas" { t, b, i }
  const corridas = (nodo, b = false, i = false, acc = []) => {
    for (const n of nodo.childNodes) {
      if (n.nodeType === 3) acc.push({ t: n.nodeValue, b, i });
      else if (n.nodeType === 1) {
        const tag = n.tagName.toLowerCase();
        if (tag === 'br') acc.push({ t: '\n', b, i });
        else if (tag === 'img') continue;
        else corridas(n, b || tag === 'strong' || tag === 'b', i || tag === 'em' || tag === 'i', acc);
      }
    }
    return acc;
  };
  // Escribe un párrafo con estilos mezclados dentro de [x0, x0+maxW]
  const parrafo = (cs, size, x0, maxW, color) => {
    const alto = size * 1.35;
    const tokens = [];
    for (const c of cs) {
      const partes = String(c.t).split('\n');
      partes.forEach((p, k) => { if (k) tokens.push({ salto: true }); p.split(/(\s+)/).forEach((pp) => { if (pp !== '') tokens.push({ t: pp, f: fuenteDe(c.b, c.i) }); }); });
    }
    let linea = [], lw = 0;
    const volcar = () => {
      w.asegura(alto);
      let x = x0;
      for (const s of linea) { const tx = w.limpio(s.t, s.f); if (tx.trim() || s.t === ' ') e.pg.drawText(tx, { x, y: e.y - size, size, font: s.f, color }); x += w.ancho_(tx, s.f, size); }
      e.y -= alto; linea = []; lw = 0;
    };
    for (const tk of tokens) {
      if (tk.salto) { volcar(); continue; }
      const anchoTk = w.ancho_(w.limpio(tk.t, tk.f), tk.f, size);
      const espacio = /^\s+$/.test(tk.t);
      if (!espacio && lw + anchoTk > maxW && linea.length) { while (linea.length && /^\s+$/.test(linea[linea.length - 1].t)) linea.pop(); volcar(); }
      if (espacio && !linea.length) continue;
      linea.push(tk.t.match(/^\s+$/) ? { t: ' ', f: tk.f } : tk); lw += espacio ? w.ancho_(' ', tk.f, size) : anchoTk;
    }
    if (linea.length) volcar();
  };
  const negro = PDFLib.rgb(0.07, 0.07, 0.07);
  const bloque = async (el, sangria = 0) => {
    const tag = el.tagName.toLowerCase();
    const x0 = w.W.margen + sangria, maxW = w.ancho() - sangria;
    if (/^h[1-6]$/.test(tag)) {
      const n = +tag[1]; const s = [20, 16, 14, 12.5, 11.5, 11][n - 1];
      e.y -= s * 0.5; w.asegura(s * 2);
      parrafo(corridas(el).map((c) => ({ ...c, b: true })), s, x0, maxW, negro); e.y -= s * 0.25;
    } else if (tag === 'p') {
      const imgs = el.querySelectorAll('img');
      const cs = corridas(el);
      if (cs.some((c) => c.t.trim())) { parrafo(cs, 11, x0, maxW, negro); e.y -= 5; }
      for (const im of imgs) await imagen(im, x0, maxW);
    } else if (tag === 'ul' || tag === 'ol') {
      let k = 1;
      for (const li of el.children) {
        if (li.tagName.toLowerCase() !== 'li') continue;
        const marca = tag === 'ol' ? (k++) + '.' : '•';
        const alto = 11 * 1.35; w.asegura(alto);
        e.pg.drawText(marca, { x: x0 + 4, y: e.y - 11, size: 11, font: F.reg, color: negro });
        const sub = [...li.children].filter((c) => /^(ul|ol)$/i.test(c.tagName));
        const copia = li.cloneNode(true); copia.querySelectorAll('ul,ol').forEach((n) => n.remove());
        parrafo(corridas(copia), 11, x0 + 22, maxW - 22, negro);
        for (const s of sub) await bloque(s, sangria + 22);
      }
      e.y -= 4;
    } else if (tag === 'table') await tabla(el, x0, maxW);
    else if (tag === 'img') await imagen(el, x0, maxW);
    else { for (const h of el.children) await bloque(h, sangria); }
  };
  const imagen = async (im, x0, maxW) => {
    try {
      const src = im.getAttribute('src') || '';
      const m = src.match(/^data:image\/(png|jpe?g);base64,(.+)$/i); if (!m) return;
      const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
      const pi = /png/i.test(m[1]) ? await out.embedPng(bytes) : await out.embedJpg(bytes);
      const maxH = w.W.pagina[1] - w.W.margen * 2;
      const d = pi.scaleToFit(maxW, maxH); w.asegura(d.height + 6);
      e.pg.drawImage(pi, { x: x0, y: e.y - d.height, width: d.width, height: d.height }); e.y -= d.height + 8;
    } catch (_) { /* imagen no soportada: se omite */ }
  };
  const tabla = async (t, x0, maxW) => {
    const filas = [...t.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => ({ txt: c.textContent.replace(/\s+/g, ' ').trim(), enc: c.tagName.toLowerCase() === 'th' })));
    if (!filas.length) return;
    const cols = Math.max(...filas.map((f) => f.length)); const cw = maxW / cols; const s = 9.5, pad = 4, alto = s * 1.3;
    const gris = PDFLib.rgb(0.6, 0.6, 0.6);
    for (const f of filas) {
      const celdas = Array.from({ length: cols }, (_, i) => w.partir((f[i] || { txt: '' }).txt, (f[i] && f[i].enc) ? F.neg : F.reg, s, cw - pad * 2));
      const h = Math.max(...celdas.map((c) => c.length)) * alto + pad * 2;
      w.asegura(h);
      celdas.forEach((ls, i) => {
        const x = x0 + i * cw;
        e.pg.drawRectangle({ x, y: e.y - h, width: cw, height: h, borderColor: gris, borderWidth: 0.6, color: (f[i] && f[i].enc) ? PDFLib.rgb(0.93, 0.93, 0.93) : undefined });
        ls.forEach((l, k) => e.pg.drawText(l, { x: x + pad, y: e.y - pad - s - k * alto + 1, size: s, font: (f[i] && f[i].enc) ? F.neg : F.reg, color: negro }));
      });
      e.y -= h;
    }
    e.y -= 8;
  };
  w.nueva();
  for (const el of doc.body.children) await bloque(el);
  return res.messages.filter((m) => m.type === 'warning').length;
}

// ---------------------------------------------------------------
// Excel (.xlsx, .xls, .csv) → PDF: cada hoja como tabla
// ---------------------------------------------------------------
async function agregarExcel(out, it, F) {
  await cargarLib('xlsx');
  const wb = XLSX.read(await it.blob.arrayBuffer(), { type: 'array', cellDates: true });
  let recortada = false;
  for (const nombre of wb.SheetNames) {
    let filas = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: false, defval: '', blankrows: false });
    filas = filas.map((f) => f.map((c) => String(c ?? '')));
    while (filas.length && filas[filas.length - 1].every((c) => c === '')) filas.pop();
    if (!filas.length) continue;
    if (filas.length > MAX_FILAS) { filas = filas.slice(0, MAX_FILAS); recortada = true; }
    let cols = Math.max(...filas.map((f) => f.length));
    // quitar columnas finales vacías
    while (cols > 1 && filas.every((f) => (f[cols - 1] ?? '') === '')) cols--;
    filas = filas.map((f) => Array.from({ length: cols }, (_, i) => f[i] ?? ''));
    const apaisada = cols > 5;
    const size = apaisada ? [A4[1], A4[0]] : A4, margen = 36;
    const util = size[0] - margen * 2;
    // Ancho proporcional al contenido (tope 40 caracteres), con mínimo
    const largo = Array.from({ length: cols }, (_, c) => {
      const ls = filas.map((f) => f[c].length).sort((a, b) => a - b);
      return Math.min(40, Math.max(4, ls[Math.floor(ls.length * 0.95) - (ls.length > 1 ? 0 : 0)] || ls[ls.length - 1]));
    });
    const suma = largo.reduce((a, b) => a + b, 0);
    const s = cols > 14 ? 6.5 : cols > 9 ? 7.5 : 9, pad = 3, alto = s * 1.3;
    const anchos = largo.map((l) => util * l / suma);
    const encabezado = filas[0];
    const w = crearEscritor(out, F, { size, margen, alNuevaPagina: (e) => {
      e.pg.drawText(w.limpio(`${it.nombre} · ${nombre}`, F.reg), { x: margen, y: e.y - 8, size: 8, font: F.reg, color: PDFLib.rgb(0.45, 0.45, 0.45) });
      e.y -= 18;
    } });
    const gris = PDFLib.rgb(0.62, 0.62, 0.62), ink = PDFLib.rgb(0.07, 0.07, 0.07);
    const dibujarFila = (f, esEnc) => {
      const celdas = f.map((t, c) => w.partir(t, esEnc ? F.neg : F.reg, s, anchos[c] - pad * 2));
      const h = Math.max(...celdas.map((c) => c.length)) * alto + pad * 2;
      w.asegura(h);
      let x = margen;
      celdas.forEach((ls, c) => {
        w.e.pg.drawRectangle({ x, y: w.e.y - h, width: anchos[c], height: h, borderColor: gris, borderWidth: 0.5, color: esEnc ? PDFLib.rgb(0.92, 0.92, 0.92) : undefined });
        ls.forEach((l, k) => w.e.pg.drawText(l, { x: x + pad, y: w.e.y - pad - s - k * alto + 1, size: s, font: esEnc ? F.neg : F.reg, color: ink }));
        x += anchos[c];
      });
      w.e.y -= h;
    };
    w.nueva();
    dibujarFila(encabezado, true);
    for (let r = 1; r < filas.length; r++) {
      // si la fila no entra, se salta de página y se repite el encabezado
      const h = Math.max(...filas[r].map((t, c) => w.partir(t, F.reg, s, anchos[c] - pad * 2).length)) * alto + pad * 2;
      if (w.e.y - h < margen) { w.nueva(); dibujarFila(encabezado, true); }
      dibujarFila(filas[r], false);
    }
  }
  return recortada;
}

// ---------------------------------------------------------------
// Armado final
// ---------------------------------------------------------------
async function generar() {
  const btn = $('pdf-generar'); btn.disabled = true; const txt0 = btn.textContent; btn.textContent = 'Armando el PDF…';
  const nota = $('pdf-nota'); nota.innerHTML = '';
  try {
    await cargarLib('pdflib');
    const { PDFDocument, StandardFonts } = PDFLib;
    const out = await PDFDocument.create();
    const F = { reg: await out.embedFont(StandardFonts.Helvetica), neg: await out.embedFont(StandardFonts.HelveticaBold), curs: await out.embedFont(StandardFonts.HelveticaOblique), negCurs: await out.embedFont(StandardFonts.HelveticaBoldOblique) };
    const avisos = [];
    for (const it of items) {
      if (it.tipo === 'pdf') {
        const src = await PDFDocument.load(await it.blob.arrayBuffer(), { ignoreEncryption: true });
        (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
      } else if (it.tipo === 'img') {
        const jpg = await out.embedJpg(await imagenAJpeg(it));
        const apais = jpg.width > jpg.height; const [W, H] = apais ? [A4[1], A4[0]] : A4;
        const pg = out.addPage([W, H]); const m = 18; const d = jpg.scaleToFit(W - m * 2, H - m * 2);
        pg.drawImage(jpg, { x: (W - d.width) / 2, y: (H - d.height) / 2, width: d.width, height: d.height });
      } else if (it.tipo === 'word') {
        await agregarWord(out, it, F);
        avisos.push(`<b>${esc(it.nombre)}</b>: se convirtió el texto, los títulos, las listas, las tablas y las imágenes. Los colores, los encabezados y los diseños especiales no se conservan.`);
      } else if (it.tipo === 'excel') {
        const rec = await agregarExcel(out, it, F);
        avisos.push(`<b>${esc(it.nombre)}</b>: cada hoja quedó como una tabla (sin fórmulas ni gráficos).${rec ? ` Se tomaron las primeras ${MAX_FILAS} filas de alguna hoja.` : ''}`);
      }
    }
    const nombre = ($('pdf-nombre').value || 'Documento unificado').trim().replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80);
    out.setTitle(nombre); out.setProducer('DOMino Profesional · The DOM Studio Web');
    const bytes = await out.save();
    resultado = new Blob([bytes], { type: 'application/pdf' }); resultado.nombre = nombre + '.pdf';
    $('pdf-res-nombre').textContent = resultado.nombre;
    $('pdf-res-info').textContent = `${out.getPageCount()} ${out.getPageCount() === 1 ? 'página' : 'páginas'} · ${(resultado.size / 1048576).toFixed(resultado.size > 1048576 ? 1 : 2).replace('.', ',')} MB`;
    nota.innerHTML = avisos.join('<br>');
    $('pdf-resultado').hidden = false; $('pdf-resultado').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    console.error(err); aviso('No se pudo armar el PDF: ' + (err.message || err));
    nota.innerHTML = '<span class="mal-txt">No se pudo armar el PDF. ' + esc(err.message || '') + '</span>';
  } finally { btn.disabled = false; btn.textContent = txt0; }
}

// ---------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------
function iniciar() {
  if (!$('tool-pdf')) return;
  $('pdf-archivos').addEventListener('change', async (ev) => { const f = [...ev.target.files]; ev.target.value = ''; await agregar(f); });
  $('pdf-camara').addEventListener('change', async (ev) => { const f = [...ev.target.files]; ev.target.value = ''; await agregar(f); });
  $('pdf-lista').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-a]'); if (!b) return;
    const i = +b.closest('.pdf-it').dataset.i, a = b.dataset.a;
    if (a === 'del') { const [x] = items.splice(i, 1); if (x.url) URL.revokeObjectURL(x.url); }
    else if (a === 'up' && i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
    else if (a === 'down' && i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
    else if (a === 'giro') items[i].giro = (items[i].giro + 90) % 360;
    dibujarLista();
  });
  $('pdf-limpiar').addEventListener('click', () => {
    items.forEach((x) => x.url && URL.revokeObjectURL(x.url)); items = []; $('pdf-nombre').value = ''; $('pdf-aviso').innerHTML = ''; $('pdf-nota').innerHTML = ''; dibujarLista();
    aviso('Listo: se limpió la lista.');
  });
  $('pdf-generar').addEventListener('click', generar);
  $('pdf-guardar').addEventListener('click', () => {
    if (!resultado) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(resultado); a.download = resultado.nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
  const puedeCompartir = () => { try { const f = new File([resultado], resultado.nombre, { type: 'application/pdf' }); return navigator.canShare && navigator.canShare({ files: [f] }) ? f : null; } catch (_) { return null; } };
  $('pdf-compartir').addEventListener('click', async () => {
    const f = resultado && puedeCompartir();
    if (!f) { aviso('Este dispositivo no permite compartir archivos desde acá. Usá «Guardar».'); return; }
    try { await navigator.share({ files: [f], title: resultado.nombre }); } catch (_) { /* cancelado */ }
  });
  dibujarLista();
}
iniciar();
