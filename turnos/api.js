// Cliente del servicio de Turnos. POST con texto JSON (evita el preaviso CORS).
export async function llamar(accion, datos = {}, ms = 25000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(window.TURNOS_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ accion, ...datos }), signal: c.signal, redirect: 'follow' });
    return await r.json();
  } catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'tiempo_agotado' : 'sin_conexion' }; }
  finally { clearTimeout(t); }
}
export const MENSAJES = {
  horario_ocupado: 'Ese horario acaba de ser tomado. Elija otro, por favor.', fuera_de_horario: 'Ese horario ya no está disponible.', sistema_ocupado: 'Hay mucha demanda en este momento. Intente de nuevo en unos segundos.',
  falta_nombre: 'Escriba su nombre.', falta_telefono: 'Escriba un teléfono de contacto.', email_invalido: 'El correo no parece válido.', falta_consentimiento: 'Necesitamos su autorización para contactarlo por este turno.',
  demasiadas_reservas: 'Ya hay varias solicitudes con este teléfono. Llámenos para gestionar más turnos.', fuera_de_plazo: 'Ya no se puede cancelar por este medio. Comuníquese con nosotros.', turno_no_encontrado: 'No encontramos ese turno. Revise el enlace.',
  sin_conexion: 'No hay conexión. Revise su internet e intente de nuevo.', tiempo_agotado: 'El servicio tarda en responder. Intente de nuevo.', servicio_invalido: 'Ese servicio no está disponible.', error_interno: 'Ocurrió un problema. Intente de nuevo en un momento.'
};
export const msg = e => MENSAJES[e] || MENSAJES.error_interno;
