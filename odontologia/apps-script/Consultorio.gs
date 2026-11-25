/**
 * DOMino Bienestar · Módulo Odontología · Script del consultorio.
 * Va en la cuenta de Google DEL CONSULTORIO: los archivos (radiografías, fotos, estudios) quedan en SU Drive.
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

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Para probar desde el editor: ▶ Ejecutar → probar. Muestra si las propiedades están bien y crea la carpeta. */
function probar() {
  var centro = prop_('CENTRO');
  if (!centro) { Logger.log('Falta la propiedad CENTRO.'); return; }
  var raiz = carpeta_(DriveApp.getRootFolder(), CARPETA_RAIZ);
  Logger.log('Carpeta lista: ' + raiz.getName() + ' · Centro: ' + centro + ' · Proyecto: ' + (prop_('PROYECTO') || 'domino-bienestar'));
}
