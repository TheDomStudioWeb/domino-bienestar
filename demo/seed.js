// Datos inventados de la demostración de DOMino Bienestar (centro de bienestar ficticio).
const dia = 86400000, ahora = Date.now();
const iso = (n) => new Date(ahora + n * dia).toISOString().split('T')[0];
const es = (n) => new Date(ahora + n * dia).toLocaleDateString('es-ES');
const ts = (n) => ({ __t: ahora + n * dia });
const N = 'negocios/demo-vita-aura/';
const C = (id, nombre, dni, tel, cuota, apto) => [N + 'clients/' + id, { nombre_empresa: nombre, cuit: dni, estado: 'activo', fecha_creacion: new Date(ahora - 100 * dia).toISOString(), usuario_id: '', telefono: tel, email_contacto: '', cuota_vence: iso(cuota), apto_vence: iso(apto) }];
const T = (id, cli, titulo, venc, resp, est) => [N + 'tasks/' + id, { cliente_id: cli, titulo, vencimiento: iso(venc), responsable: resp, estado: est }];
const D = (id, cli, arch, f, est) => [N + 'documents/' + id, { cliente_id: cli, categoria: 'Legal', nombre_archivo: arch, fecha_subida: es(f), estado: est, url_descarga: '#' }];
const lista = [
  ['negocios/demo-vita-aura', { nombre: 'Vita Aura Bienestar', estado: 'activo', vence: null, dias_prueba: 7 }],
  [N + 'config/negocio', { nombre: 'Vita Aura Bienestar', telefono: '2615550000', actividades: ['gimnasio', 'clases', 'yoga', 'spa'], salones: [], salones_off: [], equipo: {}, puestos: {}, logo: '', creado: ts(-60) }],
  ['users/direccion@demo.com', { email: 'direccion@demo.com', nombre_display: 'Valeria Ortiz', rol_jerarquia: 'senior', activo: true, negocio_id: 'demo-vita-aura' }],
  ['users/profesor@demo.com', { email: 'profesor@demo.com', nombre_display: 'Prof. Diego Salinas', rol_jerarquia: 'midsenior', activo: true, negocio_id: 'demo-vita-aura' }],
  ['users/recepcion@demo.com', { email: 'recepcion@demo.com', nombre_display: 'Recepción', rol_jerarquia: 'asistente', activo: true, negocio_id: 'demo-vita-aura' }],
  C('c1', 'Camila Fernández', '35111222', '2615550201', 0, 40),
  C('c2', 'Lucas Benítez', '38222333', '2615550202', 2, -3),
  C('c3', 'Andrea Molina', '30333444', '2615550203', -2, 25),
  C('c4', 'Tomás Aguirre', '41444555', '2615550204', 12, 60),
  C('c5', 'Florencia Rey', '33555666', '2615550205', 5, 9),
  C('c6', 'Mariano Cabrera', '29666777', '2615550206', 20, 90),
  T('t1', 'c1', 'Avisar vencimiento de cuota', 0, 'Recepción', 'Pendiente de Procesar'),
  T('t2', 'c2', 'Pedir apto médico renovado', 1, 'Recepción', 'En Proceso'),
  T('t3', 'c3', 'Cuota vencida: llamar para renovar', -2, 'Recepción', 'Pendiente de Procesar'),
  T('t4', 'c4', 'Armar plan de entrenamiento', 4, 'Profesores', 'En Proceso'),
  T('t5', 'c5', 'Renovación de plan trimestral', 5, 'Administración', 'Pendiente de Procesar'),
  T('t6', 'c6', 'Bienvenida a nuevo socio', -4, 'Recepción', 'Proceso Completo/Finalizado'),
  D('d1', 'c2', 'Apto_medico_Benitez.pdf', -1, 'Pendiente de Procesar'),
  D('d2', 'c4', 'Plan_entrenamiento_Aguirre.pdf', -2, 'En Proceso'),
  [N + 'mensajes/m1', { texto: 'Hoy hay clase de yoga a las 19: faltan 3 cupos.', autor_uid: 'demo-recepcion@demo.com', nombre_display: 'Recepción', rol: 'asistente', fecha_timestamp: ts(-0.1) }]
];
export const SEED = { id: 'bienestar', users: [
  { email: 'direccion@demo.com', nombre_display: 'Valeria Ortiz' }, { email: 'profesor@demo.com', nombre_display: 'Prof. Diego Salinas' }, { email: 'recepcion@demo.com', nombre_display: 'Recepción' } ],
  docs: Object.fromEntries(lista) };
