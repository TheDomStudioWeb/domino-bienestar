#!/usr/bin/env node
// Prepara una COPIA de DOMino Profesional para un cliente nuevo: pone su Firebase, su rubro, su nombre y su servicio de turnos.
// Uso (desde la raíz de la copia):   node alta/preparar-cliente.js alta/cliente.json
// Ver GUIA_Alta_de_cliente_nuevo.md. No toca datos: solo cambia archivos de la copia.
const fs = require('fs'), path = require('path');
const raiz = path.resolve(__dirname, '..');
const arch = process.argv[2];
if (!arch) { console.error('Falta el archivo de datos del cliente. Ejemplo: node alta/preparar-cliente.js alta/cliente.json'); process.exit(1); }
const d = JSON.parse(fs.readFileSync(path.resolve(arch), 'utf8'));
const RUBROS = ['general', 'contador', 'veterinaria', 'bienestar'];
const F = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const errores = [];
if (!d.nombre || d.nombre.length < 3) errores.push('Falta "nombre" del negocio.');
if (!RUBROS.includes(d.rubro)) errores.push('"rubro" debe ser uno de: ' + RUBROS.join(', ') + '.');
F.forEach(k => { if (!d.firebase || !d.firebase[k] || /PEGAR|XXXX/i.test(d.firebase[k])) errores.push('Falta firebase.' + k + '.'); });
if (d.firebase && ['domino-profesional', 'domino-veterinaria'].includes(d.firebase.projectId)) errores.push('firebase.projectId es el de otro proyecto de DOMino: cada cliente necesita el suyo.');
if (d.turnos_url && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(d.turnos_url)) errores.push('"turnos_url" debe ser la dirección /exec de Apps Script (o dejarse vacío si todavía no se creó).');
if (errores.length) { console.error('No se pudo preparar la copia:\n - ' + errores.join('\n - ')); process.exit(1); }

const leer = f => fs.readFileSync(path.join(raiz, f), 'utf8'), escribir = (f, t) => fs.writeFileSync(path.join(raiz, f), t);
let cambios = 0;
function reemplazar(f, re, nuevo, obligatorio = true) {
  const t = leer(f); if (!re.test(t)) { if (obligatorio) { console.error('No se encontró en ' + f + ': ' + re); process.exit(1); } return; }
  escribir(f, t.replace(re, nuevo)); cambios++;
}
// 1. Firebase en las cinco pantallas
['app.js', 'app-cliente.js', 'login.js', 'login-cliente.js'].forEach(f => F.forEach(k => reemplazar(f, new RegExp('(' + k + ':\\s*")[^"]*(")'), '$1' + d.firebase[k] + '$2')));
reemplazar('app.js', /measurementId:\s*"[^"]*"/, 'measurementId: "' + (d.firebase.measurementId || '').replace(/[^A-Za-z0-9-]/g, '') + '"');
F.forEach(k => reemplazar('turnos/fichas.js', new RegExp('(' + k + ':\\s*")[^"]*(")'), '$1' + d.firebase[k] + '$2'));
// 2. Rubro
reemplazar('modulos.js', /const RUBRO = '[a-z]+';/, "const RUBRO = '" + d.rubro + "';");
// 2b. Gestión de documentos: solo se enciende si Storage está activo y probado en el proyecto del cliente
reemplazar('modulos.js', /const DOCUMENTOS = (true|false);/, 'const DOCUMENTOS = ' + (d.documentos === true ? 'true' : 'false') + ';');
// 2c. Marca del negocio: nombre y logo (el logo es un archivo PNG/WebP/SVG; se copia como imagenes/logo-cliente.png)
reemplazar('modulos.js', /const CLIENTE = \{ nombre: '[^']*'/, "const CLIENTE = { nombre: '" + d.nombre.replace(/['\\]/g, '') + "'");
if (d.logo) {
  const origen = path.resolve(path.dirname(path.resolve(arch)), d.logo);
  if (!fs.existsSync(origen)) { console.error('No se encontró el logo: ' + origen); process.exit(1); }
  if (!/\.png$/i.test(origen)) { console.error('El logo tiene que ser PNG (se guarda como imagenes/logo-cliente.png).'); process.exit(1); }
  fs.copyFileSync(origen, path.join(raiz, 'imagenes', 'logo-cliente.png')); cambios++;
} else console.log('Sin "logo": el Hub mostrará la marca DOMino hasta que se agregue imagenes/logo-cliente.png.');
// 3. Servicio de turnos
if (d.turnos_url) reemplazar('turnos/config.js', /window\.TURNOS_API = '[^']*';/, "window.TURNOS_API = '" + d.turnos_url + "';");
// 4. Nombre en la aplicación instalable
const mf = JSON.parse(leer('manifest.json')); mf.name = 'DOMino · ' + d.nombre; mf.short_name = d.nombre.slice(0, 12); escribir('manifest.json', JSON.stringify(mf, null, 4)); cambios++;
console.log('Listo: ' + cambios + ' cambios. Rubro: ' + d.rubro + '. Firebase: ' + d.firebase.projectId + (d.turnos_url ? '. Turnos: configurado.' : '. Turnos: falta turnos_url (ver la guía, paso 6).'));
// 5. Control final: que no quede nada del proyecto de referencia
const restos = [];
(function rec(dir) { fs.readdirSync(dir, { withFileTypes: true }).forEach(e => { if (['.git', 'node_modules', 'libs', 'pruebas', 'alta', 'imagenes'].includes(e.name)) return; const p = path.join(dir, e.name); if (e.isDirectory()) return rec(p); if (!/\.(js|html|json)$/.test(e.name)) return; const t = fs.readFileSync(p, 'utf8'); if (/domino-(profesional|veterinaria)\.(firebaseapp|appspot|firebasestorage)|AIzaSyBfI_BBvq61f43ZaFYtZOYvcFZB39jsNt0|AIzaSyByGM7M0mIKSZXMttAdkMM9ek1NB6O7u00|G-NPFGT0HZJP|script\.google\.com\/macros\/s\/AKfycbwg3bpG/.test(t)) restos.push(path.relative(raiz, p)); }); })(raiz);
if (restos.length) { console.error('ATENCIÓN: todavía hay datos del proyecto de referencia en: ' + restos.join(', ')); process.exit(2); }
console.log('Control final: no quedan datos del proyecto de referencia.');
