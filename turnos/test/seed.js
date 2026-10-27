// Datos de EJEMPLO: veterinaria ficticia (no es un negocio real)
function seed() {
  return {
    config: [['clave', 'valor'], ['nombre', 'Veterinaria Ejemplo'], ['rubro', 'veterinaria'], ['telefono', '261 000 0000'], ['paso_min', 30], ['modo_reserva', 'solicitud'], ['anticipacion_min_horas', 2], ['cancelacion_limite_horas', 4], ['ventana_dias', 30]],
    recursos: [['id', 'nombre', 'tipo', 'color', 'usuario_email', 'activo'], ['R1', 'Dra. Ejemplo', 'profesional', '#4CC38A', 'vet1@ejemplo.test', 'si'], ['R2', 'Dr. Muestra', 'profesional', '#D4AF37', 'vet2@ejemplo.test', 'si'], ['R3', 'Peluquería canina', 'profesional', '#22D3EE', '', 'si']],
    servicios: [['id', 'nombre', 'duracion_min', 'recursos', 'publico', 'activo'], ['S1', 'Consulta general', 30, 'R1,R2', 'si', 'si'], ['S2', 'Vacunación', 30, 'R1,R2', 'si', 'si'], ['S3', 'Baño y corte', 60, 'R3', 'si', 'si'], ['S4', 'Cirugía menor', 90, 'R1', 'no', 'si']],
    horarios: [['recurso_id', 'dia_semana', 'desde', 'hasta']].concat([1, 2, 3, 4, 5].flatMap(d => [['R1', d, '09:00', '13:00'], ['R1', d, '16:00', '19:00'], ['R2', d, '10:00', '14:00'], ['R3', d, '09:00', '17:00']])),
    bloqueos: [['id', 'recurso_id', 'desde', 'hasta', 'motivo']],
    turnos: [['id', 'codigo', 'estado', 'fecha', 'hora', 'duracion_min', 'recurso_id', 'servicio_id', 'cliente_id', 'contacto_nombre', 'contacto_tel', 'contacto_email', 'sujeto_nombre', 'sujeto_tipo', 'nota', 'motivo_cancelacion', 'reprogramado_de', 'origen', 'consentimiento', 'avisado', 'creado', 'actualizado']],
    slots: [['clave', 'turno_id']],
    usuarios: [['nombre', 'email', 'rol', 'clave', 'estado'], ['Dueño Ejemplo', 'dueno@ejemplo.test', 'Senior', 'ejemplo-1234', 'Activo'], ['Recepción Ejemplo', 'recepcion@ejemplo.test', 'Asistente', 'ejemplo-5678', 'Activo'], ['Dra. Ejemplo', 'vet1@ejemplo.test', 'Profesional', 'ejemplo-1111', 'Activo'], ['Dr. Muestra', 'vet2@ejemplo.test', 'Profesional', 'ejemplo-2222', 'Activo']]
  };
}
module.exports = { seed };
