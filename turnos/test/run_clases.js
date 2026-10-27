// Pruebas de CLASES CON CUPO (Bienestar): una clase = una fila de «horarios»; varios turnos comparten el mismo tramo hasta llegar al cupo.
const { crear } = require('./mock'), { seed } = require('./seed'); const assert = require('assert');
let ok = 0, fail = 0; const T = (n, f) => { try { f(); ok++; console.log('  ✓ ' + n); } catch (e) { fail++; console.log('  ✗ ' + n + '\n     ' + e.message); } };
const HOY = Date.parse('2026-10-26T13:00:00Z'); // lunes 10:00 Mendoza
const nuevo = () => {
  const s = seed();
  s.recursos.push(['R9', 'Sala de clases', 'sala', '#4CC38A', '', 'si']);
  s.servicios.push(['S9', 'Yoga', 60, 'R9', 'si', 'si']); s.servicios[0].push('cupo'); s.servicios.slice(1).forEach(r => r.push(''));
  s.servicios[s.servicios.length - 1][s.servicios[0].length - 1] = 3;
  s.horarios.push(['R9', 2, '19:00', '20:00'], ['R9', 2, '20:00', '21:00']);
  const m = crear(s); m.setAhora(HOY); return m;
};
const rsv = (m, i, o = {}) => m.llamar(Object.assign({ accion: 'reservar', servicio_id: 'S9', recurso_id: 'R9', fecha: '2026-10-27', hora: '19:00', nombre: 'Socio ' + i, tel: '261 555 10' + i + i, consentimiento: true }, o));
console.log('Clases con cupo');
T('la clase ofrece un solo inicio por fila y muestra los lugares libres', () => { const m = nuevo(), r = m.llamar({ accion: 'horarios_libres', servicio_id: 'S9', desde: '2026-10-27', dias: 1 }); assert(r.ok); assert.deepStrictEqual(r.dias[0].recursos.R9, ['19:00', '20:00']); assert.strictEqual(r.dias[0].lugares.R9['19:00'], 3); });
T('entran 3 personas y la 4.ª recibe horario_ocupado (cupo lleno)', () => { const m = nuevo(); for (let i = 1; i <= 3; i++) assert(rsv(m, i).ok, 'reserva ' + i); const r4 = rsv(m, 4); assert(!r4.ok && r4.error === 'horario_ocupado'); });
T('al llenarse una clase sigue libre la siguiente; los lugares bajan', () => { const m = nuevo(); rsv(m, 1); rsv(m, 2); let r = m.llamar({ accion: 'horarios_libres', servicio_id: 'S9', desde: '2026-10-27', dias: 1 }); assert.strictEqual(r.dias[0].lugares.R9['19:00'], 1); rsv(m, 3); r = m.llamar({ accion: 'horarios_libres', servicio_id: 'S9', desde: '2026-10-27', dias: 1 }); assert.deepStrictEqual(r.dias[0].recursos.R9, ['20:00']); });
T('cancelar libera un lugar', () => { const m = nuevo(); const a = rsv(m, 1); rsv(m, 2); rsv(m, 3); assert(m.llamar({ accion: 'cancelar_turno', codigo: a.codigo }).ok); assert(rsv(m, 4).ok); });
T('un servicio individual (cupo vacío) sigue siendo de un turno por horario', () => { const m = nuevo(); const r = m.llamar({ accion: 'reservar', servicio_id: 'S1', recurso_id: 'R1', fecha: '2026-10-27', hora: '10:00', nombre: 'Laura', tel: '261 555 1234', consentimiento: true }); assert(r.ok); const r2 = m.llamar({ accion: 'reservar', servicio_id: 'S1', recurso_id: 'R1', fecha: '2026-10-27', hora: '10:00', nombre: 'Otra', tel: '261 555 9876', consentimiento: true }); assert.strictEqual(r2.error, 'horario_ocupado'); });
console.log('Carga de actividades desde el catálogo');
const conAct = (lista) => { const m = nuevo(); m.libros.config.push(['actividades', lista]); return m; };
T('cargarActividades crea salas, clases con cupo y servicios individuales', () => { const m = conAct('clases,peluqueria'); const r = m.ctx.cargarActividades(); assert(r.recursos === 4 && r.servicios === 8, JSON.stringify(r)); const sv = m.libros.servicios, h = sv[0], iC = h.indexOf('cupo'); const fun = sv.find(x => x[1] === 'Funcional'); assert.strictEqual(Number(fun[iC]), 15); const corte = sv.find(x => x[1] === 'Corte'); assert(!corte[iC]); });
T('es idempotente: repetirla no duplica nada', () => { const m = conAct('clases'); m.ctx.cargarActividades(); const n1 = m.libros.servicios.length, h1 = m.libros.horarios.length; const r = m.ctx.cargarActividades(); assert(r.recursos === 0 && r.servicios === 0 && r.horarios === 0 && m.libros.servicios.length === n1 && m.libros.horarios.length === h1); });
T('lo cargado se puede reservar: clase de Funcional con cupo 15', () => { const m = conAct('clases'); m.ctx.cargarActividades(); const id = m.libros.servicios.find(x => x[1] === 'Funcional')[0]; const r = m.llamar({ accion: 'horarios_libres', servicio_id: id, desde: '2026-10-27', dias: 7 }); assert(r.ok && r.dias.length >= 1); const d = r.dias[0], rid = Object.keys(d.recursos)[0], hh = d.recursos[rid][0]; assert.strictEqual(d.lugares[rid][hh], 15); const ok1 = m.llamar({ accion: 'reservar', servicio_id: id, recurso_id: rid, fecha: d.fecha, hora: hh, nombre: 'Socia Uno', tel: '261 555 1111', consentimiento: true }); assert(ok1.ok, JSON.stringify(ok1)); });
T('actividad que no existe o fila ausente → error claro', () => { const m = conAct('inventada'); assert.throws(() => m.ctx.cargarActividades(), /catálogo/); const m2 = nuevo(); assert.throws(() => m2.ctx.cargarActividades(), /actividades/); });
console.log('\n' + ok + ' bien, ' + fail + ' con error'); process.exit(fail ? 1 : 0);
