// Pruebas MULTI-CENTRO: cada centro con su planilla, sesión con cuenta de Firebase, alta de centros y aislamiento de datos.
const { crear } = require('./mock'), { seed } = require('./seed'); const assert = require('assert');
let ok = 0, fail = 0; const T = (n, f) => { try { f(); ok++; console.log('  ✓ ' + n); } catch (e) { fail++; console.log('  ✗ ' + n + '\n     ' + e.message); } };
const HOY = Date.parse('2026-10-26T13:00:00Z');
const jwt = (email, aud = 'domino-bienestar', exp = Math.floor(HOY / 1000) + 3600) => 'x.' + Buffer.from(JSON.stringify({ email, aud, exp })).toString('base64url') + '.y';
const nuevo = () => { const m = crear(seed()); m.setAhora(HOY); return m; };
// Firestore simulado: el token es válido si está registrado; cada doc se ve con cualquier token válido (las reglas reales limitan qué se puede leer)
const cuenta = (m, email, perfil, neg) => { const t = jwt(email); m.fsDocs[t + '|ok'] = true; m.fsDocs['*|users/' + email] = perfil; if (neg) m.fsDocs['*|negocios/' + perfil.negocio_id] = neg; return t; };
const admin = (m) => { const t = jwt('daniel@dom.test'); m.fsDocs[t + '|ok'] = true; m.fsDocs['*|superadmins/daniel@dom.test'] = { x: true }; return t; };
const futuro = new Date(HOY + 3 * 86400000).toISOString(), pasado = new Date(HOY - 86400000).toISOString();

console.log('Alta de centros');
T('solo un superadmin da de alta un centro', () => { const m = nuevo(); const t = cuenta(m, 'otro@x.test', { activo: true, negocio_id: 'a', rol_jerarquia: 'senior' }, { estado: 'activo' }); assert.strictEqual(m.llamar({ accion: 'crear_negocio', id_token: t, nid: 'gym-uno', nombre: 'Gym Uno' }).error, 'sin_permiso'); assert.strictEqual(m.llamar({ accion: 'crear_negocio', id_token: 'basura', nid: 'gym-uno' }).error, 'sesion_invalida'); });
T('crea la planilla propia del centro y lo anota; repetir no duplica', () => {
  const m = nuevo(), t = admin(m); const r = m.llamar({ accion: 'crear_negocio', id_token: t, nid: 'gym-uno', nombre: 'Gym Uno' });
  assert(r.ok && r.libro_id, JSON.stringify(r)); assert(m.extra[r.libro_id].config && m.extra[r.libro_id].turnos && m.extra[r.libro_id].usuarios);
  assert(m.libros.negocios.some(f => f[0] === 'gym-uno'));
  const r2 = m.llamar({ accion: 'crear_negocio', id_token: t, nid: 'gym-uno' }); assert(r2.existente && r2.libro_id === r.libro_id);
  assert.strictEqual(m.llamar({ accion: 'crear_negocio', id_token: t, nid: 'Mal Nombre!' }).error, 'negocio_invalido');
});
T('el token de otro proyecto o vencido no sirve', () => { const m = nuevo(); assert.strictEqual(m.llamar({ accion: 'crear_negocio', id_token: jwt('daniel@dom.test', 'otro-proyecto'), nid: 'abc' }).error, 'sesion_invalida'); assert.strictEqual(m.llamar({ accion: 'crear_negocio', id_token: jwt('daniel@dom.test', 'domino-bienestar', 5), nid: 'abc' }).error, 'sesion_invalida'); });

console.log('Sesión con cuenta de Firebase');
const dosCentros = () => {
  const m = nuevo(), ta = admin(m);
  ['gym-uno', 'gym-dos'].forEach(n => assert(m.llamar({ accion: 'crear_negocio', id_token: ta, nid: n, nombre: n }).ok));
  const t1 = cuenta(m, 'ana@uno.test', { activo: true, negocio_id: 'gym-uno', rol_jerarquia: 'senior', nombre_display: 'Ana Uno' }, { estado: 'prueba', vence: futuro });
  const s1 = m.llamar({ accion: 'sesion_fb', id_token: t1 });
  m.fsDocs['*|users/beto@dos.test'] = { activo: true, negocio_id: 'gym-dos', rol_jerarquia: 'senior', nombre_display: 'Beto Dos' }; m.fsDocs['*|negocios/gym-dos'] = { estado: 'activo' };
  const t2 = jwt('beto@dos.test'); m.fsDocs[t2 + '|ok'] = true; const s2 = m.llamar({ accion: 'sesion_fb', id_token: t2 });
  return { m, s1, s2 };
};
T('la sesión devuelve token, rol y centro', () => { const { s1, s2 } = dosCentros(); assert(s1.ok && s1.negocio === 'gym-uno' && s1.usuario.rol === 'Senior' && s1.usuario.nombre === 'Ana Uno', JSON.stringify(s1)); assert(s2.ok && s2.negocio === 'gym-dos'); });
T('prueba vencida, centro suspendido, usuario inactivo o sin centro: rechazados', () => {
  const m = nuevo(), ta = admin(m); m.llamar({ accion: 'crear_negocio', id_token: ta, nid: 'gym-uno' });
  const p = o => cuenta(m, 'u@uno.test', Object.assign({ activo: true, negocio_id: 'gym-uno', rol_jerarquia: 'senior' }, o.perfil), o.neg);
  assert.strictEqual(m.llamar({ accion: 'sesion_fb', id_token: p({ neg: { estado: 'prueba', vence: pasado } }) }).error, 'negocio_vencido');
  assert.strictEqual(m.llamar({ accion: 'sesion_fb', id_token: p({ neg: { estado: 'suspendido' } }) }).error, 'negocio_vencido');
  assert.strictEqual(m.llamar({ accion: 'sesion_fb', id_token: p({ neg: { estado: 'activo' }, perfil: { activo: false } }) }).error, 'usuario_invalido');
  assert.strictEqual(m.llamar({ accion: 'sesion_fb', id_token: p({ neg: { estado: 'activo' }, perfil: { negocio_id: '' } }) }).error, 'usuario_invalido');
  assert(m.llamar({ accion: 'sesion_fb', id_token: p({ neg: { estado: 'prueba' } }) }).ok, 'prueba sin vence todavía (primer ingreso) entra');
});
T('un token de Firestore no válido (reglas lo niegan) no abre sesión', () => { const m = nuevo(); assert.strictEqual(m.llamar({ accion: 'sesion_fb', id_token: jwt('x@y.test') }).error, 'sesion_invalida'); });

console.log('Aislamiento entre centros');
const reservar = (m, neg, o = {}) => m.llamar(Object.assign({ accion: 'reservar', negocio: neg, servicio_id: 'S1', recurso_id: 'R1', fecha: '2026-10-27', hora: '10:00', nombre: 'Persona', tel: '2615551111', consentimiento: true }, o));
const preparar = (m, libro) => { const s = seed(); ['recursos', 'servicios', 'horarios'].forEach(h => { s[h].slice(1).forEach(r => m.extra[libro][h].push(r.slice())); }); };
T('una reserva pública cae en la planilla de SU centro y el otro no la ve', () => {
  const { m, s1, s2 } = dosCentros(); const l1 = m.libros.negocios.find(f => f[0] === 'gym-uno')[1], l2 = m.libros.negocios.find(f => f[0] === 'gym-dos')[1]; preparar(m, l1); preparar(m, l2);
  const r = reservar(m, 'gym-uno'); assert(r.ok, JSON.stringify(r));
  assert.strictEqual(m.extra[l1].turnos.length, 2); assert.strictEqual(m.extra[l2].turnos.length, 1); assert.strictEqual(m.libros.turnos.length, 1);
  assert.strictEqual(m.llamar({ accion: 'agenda', token: s2.token, desde: '2026-10-26', hasta: '2026-10-30' }).turnos.length, 0, 'el centro 2 no ve el turno del 1');
  assert.strictEqual(m.llamar({ accion: 'agenda', token: s1.token, desde: '2026-10-26', hasta: '2026-10-30' }).turnos.length, 1);
});
T('el mismo horario puede reservarse en dos centros (no se pisan)', () => {
  const { m } = dosCentros(); const l1 = m.libros.negocios.find(f => f[0] === 'gym-uno')[1], l2 = m.libros.negocios.find(f => f[0] === 'gym-dos')[1]; preparar(m, l1); preparar(m, l2);
  assert(reservar(m, 'gym-uno').ok); assert(reservar(m, 'gym-dos', { tel: '2615552222' }).ok); assert.strictEqual(reservar(m, 'gym-uno', { tel: '2615553333' }).error, 'horario_ocupado');
});
T('el límite de reservas por teléfono es por centro', () => {
  const { m } = dosCentros(); const l1 = m.libros.negocios.find(f => f[0] === 'gym-uno')[1], l2 = m.libros.negocios.find(f => f[0] === 'gym-dos')[1]; preparar(m, l1); preparar(m, l2);
  ['09:00', '09:30', '10:00'].forEach(h => assert(reservar(m, 'gym-uno', { hora: h }).ok)); assert.strictEqual(reservar(m, 'gym-uno', { hora: '10:30' }).error, 'demasiadas_reservas'); assert(reservar(m, 'gym-dos', { hora: '09:00' }).ok);
});
T('centro inexistente: error y no toca la planilla del script', () => { const m = nuevo(); assert.strictEqual(reservar(m, 'no-existe').error, 'negocio_inexistente'); assert.strictEqual(m.llamar({ accion: 'config_publica', negocio: 'no-existe' }).error, 'negocio_inexistente'); assert.strictEqual(m.libros.turnos.length, 1); });
T('config_publica con ?negocio= devuelve el nombre de ese centro', () => { const { m } = dosCentros(); assert.strictEqual(m.llamar({ accion: 'config_publica', negocio: 'gym-dos' }).negocio.nombre, 'gym-dos'); });
T('un token no sirve para cambiar de centro: manda el del token', () => {
  const { m, s1 } = dosCentros(); const l1 = m.libros.negocios.find(f => f[0] === 'gym-uno')[1], l2 = m.libros.negocios.find(f => f[0] === 'gym-dos')[1]; preparar(m, l1); preparar(m, l2); reservar(m, 'gym-dos');
  const r = m.llamar({ accion: 'agenda', negocio: 'gym-dos', token: s1.token, desde: '2026-10-26', hasta: '2026-10-30' }); assert.strictEqual(r.turnos.length, 0);
});
T('un token falsificado o de otro formato es rechazado', () => { const { m, s1 } = dosCentros(); const [pl, f] = s1.token.split('.'); assert.strictEqual(m.llamar({ accion: 'agenda', token: pl + '.' + f.slice(1) + 'x' }).error, 'sesion_invalida'); });
T('el token de Firebase vence a las 12 h', () => { const { m, s1 } = dosCentros(); m.setAhora(HOY + 13 * 3600000); assert.strictEqual(m.llamar({ accion: 'agenda', token: s1.token, desde: '2026-10-26', hasta: '2026-10-30' }).error, 'sesion_invalida'); });
T('sincronizar_actividades carga recursos y servicios en la planilla del centro', () => {
  const { m, s1, s2 } = dosCentros(); const l1 = m.libros.negocios.find(f => f[0] === 'gym-uno')[1], l2 = m.libros.negocios.find(f => f[0] === 'gym-dos')[1];
  const r = m.llamar({ accion: 'sincronizar_actividades', token: s1.token, actividades: ['gimnasio'] }); assert(r.ok && r.nuevos.servicios > 0, JSON.stringify(r));
  assert(m.extra[l1].servicios.length > 1); assert.strictEqual(m.extra[l2].servicios.length, 1);
  assert.strictEqual(m.llamar({ accion: 'sincronizar_actividades', token: s1.token, actividades: ['nada'] }).error, 'sin_actividades');
});
T('sincronizar_actividades copia el nombre y teléfono del centro a la planilla (lo que ve quien reserva)', () => {
  const { m, s1 } = dosCentros(); assert(m.llamar({ accion: 'sincronizar_actividades', token: s1.token, actividades: ['gimnasio'], nombre: 'Gimnasio Real', telefono: '261 555 0000' }).ok);
  assert.strictEqual(m.llamar({ accion: 'config_publica', negocio: 'gym-uno' }).negocio.nombre, 'Gimnasio Real');
});
T('recordatorios: recorre todos los centros', () => {
  const { m } = dosCentros(); const l1 = m.libros.negocios.find(f => f[0] === 'gym-uno')[1], l2 = m.libros.negocios.find(f => f[0] === 'gym-dos')[1]; preparar(m, l1); preparar(m, l2);
  reservar(m, 'gym-uno', { email: 'a@a.test', fecha: '2026-10-27' }); reservar(m, 'gym-dos', { email: 'b@b.test', fecha: '2026-10-27', tel: '2615554444' });
  m.correos.length = 0; m.api.enviarRecordatorios(); assert.strictEqual(m.correos.length, 2, 'correos: ' + m.correos.length);
});
T('modo anterior intacto: sin negocio usa la planilla del script', () => { const m = nuevo(); const r = m.llamar({ accion: 'login', email: 'dueno@ejemplo.test', clave: 'ejemplo-1234' }); assert(r.ok); assert.strictEqual(m.llamar({ accion: 'agenda', token: r.token, desde: '2026-10-26', hasta: '2026-10-30' }).ok, true); });
console.log(`\n${ok} bien, ${fail} con error`); process.exit(fail ? 1 : 0);
