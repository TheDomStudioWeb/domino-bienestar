#!/usr/bin/env node
// Copia el catálogo de actividades (turnos/catalogo-actividades.json, única fuente) a los dos lugares que lo usan:
//   1) actividades-datos.js  → lo lee el Hub (asistente de actividades)
//   2) turnos/apps-script/Code.gs  → entre las marcas <CATALOGO> … </CATALOGO>
// Uso:  node alta/sincronizar-catalogo.js          (escribe)     ·     node alta/sincronizar-catalogo.js --verificar   (solo compara)
const fs = require('fs'), path = require('path');
const raiz = path.resolve(__dirname, '..'), p = f => path.join(raiz, f);
const cat = JSON.parse(fs.readFileSync(p('turnos/catalogo-actividades.json'), 'utf8'));
const ids = new Set(); const err = [];
cat.actividades.forEach(a => {
  if (!/^[a-z]+$/.test(a.id)) err.push('id inválido: ' + a.id); if (ids.has(a.id)) err.push('id repetido: ' + a.id); ids.add(a.id);
  const dur = [...(a.servicios || []), ...(a.clases || [])].map(s => s.duracion_min);
  dur.forEach(d => { if (d % 30) err.push(a.id + ': duración no múltiplo de 30 min (' + d + ')'); });
  (a.clases || []).forEach(c => { if (!(c.cupo > 1)) err.push(a.id + '/' + c.nombre + ': una clase necesita cupo mayor a 1'); });
  if (!a.recurso && !(a.clases || []).length) err.push(a.id + ': sin recurso ni clases');
});
if (err.length) { console.error('Catálogo con errores:\n - ' + err.join('\n - ')); process.exit(1); }
const json = JSON.stringify(cat);
const js = '// GENERADO por alta/sincronizar-catalogo.js desde turnos/catalogo-actividades.json — no editar a mano.\nwindow.DOMINO_CATALOGO = ' + json + ';\n';
let gs = fs.readFileSync(p('turnos/apps-script/Code.gs'), 'utf8');
const re = /\/\/ <CATALOGO>\n[\s\S]*?\/\/ <\/CATALOGO>/;
if (!re.test(gs)) { console.error('Code.gs no tiene las marcas <CATALOGO>.'); process.exit(1); }
gs = gs.replace(re, () => '// <CATALOGO>\nconst CATALOGO_ = ' + json + ';\n// </CATALOGO>');
if (process.argv.includes('--verificar')) {
  const igual = fs.existsSync(p('actividades-datos.js')) && fs.readFileSync(p('actividades-datos.js'), 'utf8') === js && fs.readFileSync(p('turnos/apps-script/Code.gs'), 'utf8') === gs;
  console.log(igual ? 'Catálogo sincronizado.' : 'ATENCIÓN: el catálogo no está sincronizado. Correr: node alta/sincronizar-catalogo.js'); process.exit(igual ? 0 : 1);
}
fs.writeFileSync(p('actividades-datos.js'), js); fs.writeFileSync(p('turnos/apps-script/Code.gs'), gs);
console.log('Catálogo sincronizado: ' + cat.actividades.length + ' actividades.');
