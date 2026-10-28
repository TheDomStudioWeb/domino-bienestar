// Negocio (centro) de esta sesión: lo fija el Hub al ingresar el personal, o viene en la dirección de la página de reservas (?n=…).
export function negocioId() {
  try {
    if (window.DOMINO_NID) return window.DOMINO_NID;
    const q = new URLSearchParams(location.search).get('n');
    if (q && /^[a-z0-9-]{3,60}$/.test(q)) { localStorage.setItem('domino_nid', q); return q; }
    const g = localStorage.getItem('domino_nid');
    return g && /^[a-z0-9-]{3,60}$/.test(g) ? g : '';
  } catch (e) { return ''; }
}
// Sesión de la agenda. Con la cuenta del Hub (Firebase) se abre sola: el script verifica el id_token y devuelve una sesión de 12 h.
export function sesionAgenda() {
  try { const s = JSON.parse(localStorage.getItem('turnos_sesion') || 'null'); if (!s || !s.tok || (s.exp && s.exp < Date.now())) return null; if (s.nid && negocioId() && s.nid !== negocioId()) return null; return s; } catch (e) { return null; }
}
export function guardarSesionAgenda(s) { try { s ? localStorage.setItem('turnos_sesion', JSON.stringify(s)) : localStorage.removeItem('turnos_sesion'); } catch (e) {} }
// getIdToken: función que devuelve el id_token de Firebase de quien está dentro del Hub (o '' si nadie). Devuelve la sesión o null.
export async function abrirSesionAgenda(getIdToken) {
  const s = sesionAgenda(); if (s) return s;
  try {
    const t = await getIdToken(); if (!t) return null;
    const r = await llamar('sesion_fb', { id_token: t }); if (!r.ok) return null;
    const n = { tok: r.token, user: r.usuario, nid: r.negocio, exp: Date.now() + 11 * 3600000, fb: 1 };
    try { if (r.negocio) localStorage.setItem('domino_nid', r.negocio); } catch (e) {}
    guardarSesionAgenda(n); return n;
  } catch (e) { return null; }
}
// Cliente del servicio de Turnos. POST con texto JSON (evita el preaviso CORS).
export async function llamar(accion, datos = {}, ms = 25000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(window.TURNOS_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ accion, negocio: negocioId(), ...datos }), signal: c.signal, redirect: 'follow' });
    return await r.json();
  } catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'tiempo_agotado' : 'sin_conexion' }; }
  finally { clearTimeout(t); }
}
export const MENSAJES = {
  negocio_vencido: 'La prueba de este centro terminó o el centro está suspendido. Escríbanos para continuar.', negocio_inexistente: 'No encontramos este centro.', usuario_invalido: 'Esta cuenta no tiene acceso a la agenda.',
  horario_ocupado: 'Ese horario acaba de ser tomado. Elija otro, por favor.', fuera_de_horario: 'Ese horario ya no está disponible.', sistema_ocupado: 'Hay mucha demanda en este momento. Intente de nuevo en unos segundos.',
  falta_nombre: 'Escriba su nombre.', falta_telefono: 'Escriba un teléfono de contacto.', email_invalido: 'El correo no parece válido.', falta_consentimiento: 'Necesitamos su autorización para contactarlo por este turno.',
  demasiadas_reservas: 'Ya hay varias solicitudes con este teléfono. Llámenos para gestionar más turnos.', fuera_de_plazo: 'Ya no se puede cancelar por este medio. Comuníquese con nosotros.', turno_no_encontrado: 'No encontramos ese turno. Revise el enlace.',
  sin_conexion: 'No hay conexión. Revise su internet e intente de nuevo.', tiempo_agotado: 'El servicio tarda en responder. Intente de nuevo.', servicio_invalido: 'Ese servicio no está disponible.', error_interno: 'Ocurrió un problema. Intente de nuevo en un momento.'
};
export const msg = e => MENSAJES[e] || MENSAJES.error_interno;
