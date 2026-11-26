/**
 * DOMino Bienestar · Módulo Odontología · Script del consultorio.
 * Va en la cuenta de Google DEL CONSULTORIO: los archivos (radiografías, fotos, estudios) quedan en SU Drive.
 * También arma las carpetas de las órdenes de laboratorio y las comparte SOLO con el mail del laboratorio de esa orden.
 * Más adelante este mismo script guarda la clave de Mercado Pago del consultorio (etapa 2b).
 *
 * Seguridad: la app manda el token de sesión de Firebase de quien está usando la app. El script pide a Firestore,
 * con ese mismo token, la historia clínica del paciente: si las reglas lo dejan leerla (profesional del centro con
 * el módulo activo), lo deja subir o ver los archivos de ese paciente. Si no, rechaza.
 *
 * Propiedades del script (Configuración del proyecto → Propiedades del script):
 *   PROYECTO = domino-bienestar     (proyecto de Firebase; fijo, para que nadie use otro)
 *   CENTRO   = <id del centro>      (el identificador del consultorio en DOMino Bienestar)
 */
var CARPETA_RAIZ = 'DOMino Odontología · Archivos de pacientes';
var MAX_BYTES = 25 * 1024 * 1024;

function doGet() {
  return json_({ ok: true, servicio: 'DOMino Odontología', centro: prop_('CENTRO') || '(sin configurar)' });
}

function doPost(e) {
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var centro = prop_('CENTRO'), proyecto = prop_('PROYECTO') || 'domino-bienestar';
    if (!centro) return json_({ ok: false, error: 'sin_configurar' });
    if (b.nid !== centro) return json_({ ok: false, error: 'otro_centro' });
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(b.cid || ''))) return json_({ ok: false, error: 'paciente_invalido' });
    if (/^orden_/.test(String(b.accion))) return json_(laboratorio_(proyecto, centro, b));
    if (b.accion === 'ping') return json_({ ok: puedeVer_(proyecto, centro, b.cid, b.token) });
    if (!puedeVer_(proyecto, centro, b.cid, b.token)) return json_({ ok: false, error: 'sin_permiso' });
    if (b.accion === 'subir') return json_(subir_(centro, b));
    if (b.accion === 'bajar') return json_(bajar_(centro, b));
    return json_({ ok: false, error: 'accion_desconocida' });
  } catch (err) {
    return json_({ ok: false, error: 'error', detalle: String(err && err.message || err).slice(0, 200) });
  }
}

// La historia clínica la puede leer solo un profesional del centro con el módulo activo: lo deciden las reglas de Firestore.
function puedeVer_(proyecto, centro, cid, token) {
  if (!token) return false;
  var url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(proyecto) +
    '/databases/(default)/documents/negocios/' + encodeURIComponent(centro) + '/clinica/' + encodeURIComponent(cid) + '?mask.fieldPaths=socio_id';
  var r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  var c = r.getResponseCode();
  return c === 200 || c === 404; // 404 = el paciente todavía no tiene ficha, pero el permiso alcanzó
}

function carpetaPaciente_(centro, cid) {
  var raiz = carpeta_(DriveApp.getRootFolder(), CARPETA_RAIZ);
  var c = carpeta_(raiz, centro);
  return carpeta_(c, cid);
}
function carpeta_(padre, nombre) {
  var it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function subir_(centro, b) {
  var datos = Utilities.base64Decode(String(b.datos || ''));
  if (!datos.length) return { ok: false, error: 'vacio' };
  if (datos.length > MAX_BYTES) return { ok: false, error: 'muy_grande' };
  var mime = String(b.mime || 'application/octet-stream');
  if (!/^(image\/(jpeg|png|webp|gif|bmp|tiff)|application\/pdf)$/.test(mime)) return { ok: false, error: 'tipo_no_permitido' };
  var nombre = String(b.nombre || 'archivo').replace(/[\\\/:*?"<>|]/g, '').slice(0, 120);
  var f = carpetaPaciente_(centro, b.cid).createFile(Utilities.newBlob(datos, mime, nombre));
  f.setDescription('dom:' + centro + ':' + b.cid); // marca para comprobar a quién pertenece
  return { ok: true, id: f.getId(), bytes: datos.length };
}

function bajar_(centro, b) {
  var f;
  try { f = DriveApp.getFileById(String(b.id || '')); } catch (e) { return { ok: false, error: 'no_existe' }; }
  if (f.getDescription() !== 'dom:' + centro + ':' + b.cid || f.isTrashed()) return { ok: false, error: 'no_existe' };
  var blob = f.getBlob();
  return { ok: true, mime: blob.getContentType(), nombre: f.getName(), datos: Utilities.base64Encode(blob.getBytes()) };
}

// ── Laboratorio ──────────────────────────────────────────────────────────────
// La orden se lee en Firestore con el token de quien usa la app: si las reglas lo dejan, se usan los datos guardados
// (paciente, trabajo y mail del laboratorio). El mail con el que se comparte sale de la orden guardada, no de lo que mande la app.
var MIME_LAB = /^(image\/(jpeg|png|webp|gif|bmp|tiff)|application\/(pdf|zip|x-zip-compressed|sla|vnd\.ms-pki\.stl|octet-stream)|model\/(stl|x\.stl-binary|x\.stl-ascii|obj|ply))$/;
var EXT_LAB = /\.(jpe?g|png|webp|gif|bmp|tiff?|pdf|stl|ply|obj|zip)$/i;

function laboratorio_(proyecto, centro, b) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(b.oid || ''))) return { ok: false, error: 'orden_invalida' };
  var o = leerOrden_(proyecto, centro, b.oid, b.token);
  if (!o || o.socio_id !== b.cid) return { ok: false, error: 'sin_permiso' };
  if (o.estado === 'anulado' && b.accion !== 'orden_cerrar') return { ok: false, error: 'orden_anulada' };
  if (b.accion === 'orden_carpeta') return carpetaOrden_(centro, b, o);
  var dir = carpetaDeOrden_(centro, b);
  if (!dir) return { ok: false, error: 'no_existe' };
  if (b.accion === 'orden_subir') {
    var datos = Utilities.base64Decode(String(b.datos || ''));
    if (!datos.length) return { ok: false, error: 'vacio' };
    if (datos.length > MAX_BYTES) return { ok: false, error: 'muy_grande' };
    var nombre = String(b.nombre || 'archivo').replace(/[\\\/:*?"<>|]/g, '').slice(0, 120);
    var mime = String(b.mime || 'application/octet-stream');
    if (!MIME_LAB.test(mime) || (!/^image\//.test(mime) && !EXT_LAB.test(nombre))) return { ok: false, error: 'tipo_no_permitido' };
    var f = dir.createFile(Utilities.newBlob(datos, mime, nombre));
    f.setDescription('dom:' + centro + ':lab:' + b.oid);
    return { ok: true, id: f.getId() };
  }
  if (b.accion === 'orden_copiar') {
    // Copiar una radiografía o foto del paciente exige además poder ver su historia clínica (profesional).
    if (!puedeVer_(proyecto, centro, b.cid, b.token)) return { ok: false, error: 'sin_permiso' };
    var orig;
    try { orig = DriveApp.getFileById(String(b.id || '')); } catch (e) { return { ok: false, error: 'no_existe' }; }
    if (orig.getDescription() !== 'dom:' + centro + ':' + b.cid || orig.isTrashed()) return { ok: false, error: 'no_existe' };
    var copia = orig.makeCopy(orig.getName(), dir);
    copia.setDescription('dom:' + centro + ':lab:' + b.oid);
    return { ok: true, id: copia.getId(), nombre: orig.getName() };
  }
  if (b.accion === 'orden_cerrar') {
    // Orden anulada: el laboratorio deja de ver la carpeta.
    dir.getEditors().forEach(function (u) { try { dir.removeEditor(u); } catch (e) {} });
    dir.getViewers().forEach(function (u) { try { dir.removeViewer(u); } catch (e) {} });
    return { ok: true };
  }
  return { ok: false, error: 'accion_desconocida' };
}

function leerOrden_(proyecto, centro, oid, token) {
  if (!token) return null;
  var url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(proyecto) +
    '/databases/(default)/documents/negocios/' + encodeURIComponent(centro) + '/laboratorio/' + encodeURIComponent(oid);
  var r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  var f = (JSON.parse(r.getContentText()).fields) || {}, o = {};
  ['socio_id', 'socio_nombre', 'trabajo', 'lab_email', 'lab_nombre', 'estado'].forEach(function (k) { o[k] = f[k] && f[k].stringValue || ''; });
  return o;
}

function carpetaOrden_(centro, b, o) {
  var dir = carpetaDeOrden_(centro, b);
  if (!dir) {
    var raiz = carpeta_(carpeta_(carpeta_(DriveApp.getRootFolder(), CARPETA_RAIZ), centro), 'Laboratorio');
    var hoy = Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd');
    var nombre = (hoy + ' · ' + o.socio_nombre + ' · ' + o.trabajo + (o.lab_nombre ? ' · ' + o.lab_nombre : '')).replace(/[\\\/:*?"<>|]/g, '').slice(0, 150);
    dir = raiz.createFolder(nombre);
    dir.setDescription('dom:' + centro + ':lab:' + b.oid);
  }
  var compartida = false;
  if (o.lab_email) {
    try { dir.addEditor(o.lab_email); compartida = true; } catch (e) { compartida = false; }
  }
  return { ok: true, id: dir.getId(), url: dir.getUrl(), compartida: compartida };
}

// Busca la carpeta de la orden por id (si la app lo manda) o por su marca; comprueba que sea de esta orden.
function carpetaDeOrden_(centro, b) {
  var marca = 'dom:' + centro + ':lab:' + b.oid;
  if (b.carpeta) {
    try { var d = DriveApp.getFolderById(String(b.carpeta)); if (d.getDescription() === marca && !d.isTrashed()) return d; } catch (e) {}
  }
  var raiz = DriveApp.getRootFolder().getFoldersByName(CARPETA_RAIZ);
  if (!raiz.hasNext()) return null;
  var c = raiz.next().getFoldersByName(centro); if (!c.hasNext()) return null;
  var l = c.next().getFoldersByName('Laboratorio'); if (!l.hasNext()) return null;
  var it = l.next().getFolders();
  while (it.hasNext()) { var x = it.next(); if (x.getDescription() === marca && !x.isTrashed()) return x; }
  return null;
}

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Para probar desde el editor: ▶ Ejecutar → probar. Muestra si las propiedades están bien y crea la carpeta. */
function probar() {
  var centro = prop_('CENTRO');
  if (!centro) { Logger.log('Falta la propiedad CENTRO.'); return; }
  var raiz = carpeta_(DriveApp.getRootFolder(), CARPETA_RAIZ);
  Logger.log('Carpeta lista: ' + raiz.getName() + ' · Centro: ' + centro + ' · Proyecto: ' + (prop_('PROYECTO') || 'domino-bienestar'));
}
