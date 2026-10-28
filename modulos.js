// DOMino Profesional · Perfil por rubro.
// Cada copia de DOMino (una por cliente) trabaja con UN rubro. Para cambiarlo, modificar RUBRO.
// El perfil decide qué grupos y herramientas muestra el Hub, cómo se llaman las cosas y qué módulos opcionales trae.
// OJO: el rubro ordena lo que se ve; NO da ni quita permisos (eso lo controlan los roles y las reglas de Firestore).
(function () {
  const RUBRO = 'bienestar';
  // Marca del negocio que contrata DOMino. En el Hub se muestra SU logo (imagenes/logo-cliente.png) y su nombre, no los de DOMino.
  // Si el archivo del logo no existe, se ve el de DOMino. Lo completa alta/preparar-cliente.js.
  const CLIENTE = { nombre: 'Bienestar (demo)', logo: 'imagenes/logo-cliente.png' };
  // Gestión de documentos (guardar y enviar archivos). Necesita Firebase Storage activo en el proyecto del cliente.
  // Mientras esté en false, el Hub muestra «Próximamente» y no deja cargar documentos. Pasar a true cuando Storage esté listo y probado.
  const DOCUMENTOS = false;

  // Esta copia es solo de Bienestar: siempre se habla de «socios».
  const PERFILES = {
    // Bienestar: gimnasios, clases, spa, peluquería, uñas, estética, consultorios. Un solo perfil; las actividades se eligen al cargar el negocio (bienestar.js).
    // Sin mascotas ni libreta sanitaria. Clases con cupos y turnos individuales vienen del módulo de turnos.
    bienestar: {
      nombre: 'Bienestar',
      modulos: { turnos: true },
      ocultar: ['portal', 'pendientes', 'cuit', 'iva'],
      orden: ['Agenda y turnos', 'Gestión del centro', 'Plazos y equipo', 'Documentos', 'Herramientas'],
      etiquetas: {
        expedientes: { t: 'Socios', d: 'Fichas de socios, con su contacto, sus turnos y sus seguimientos. Desde acá también se da de alta o baja a un socio.' },
        kanban: { t: 'Seguimientos', d: 'Cuotas por vencer, renovaciones y pendientes, por estado.' },
        tareas: { t: 'Mis seguimientos', d: 'Lo que tenés asignado, por estado.' },
        buzon: { t: 'Documentos del socio', d: 'Cargar aptos médicos, planes y fichas, o enviarlos al socio.' },
        calendario: { t: 'Calendario', d: 'Vencimientos de cuotas y renovaciones del mes, día por día.' }
      },
      textos: {
        gestion: 'Gestión del centro', clientes: 'Socios', cartera_activos: 'Socios activos', cartera_inactivos: 'Socios inactivos',
        expedientes: 'Socios', ayuda_expediente: 'Elegí la persona para ver su ficha, sus turnos y sus seguimientos.', procesos: 'Seguimientos activos',
        hub_sub: 'Todo su centro de bienestar en un solo lugar: clases, turnos y socios a un toque.',
        rol_senior: 'Dirección', rol_midsenior: 'Profesor/a o profesional', rol_asistente: 'Recepción',
        kpi_listos: 'Seguimientos resueltos', ver_ficha: 'Ver ficha', kpi_finalizadas: 'Finalizados', id_label: 'DNI', empresa: 'Socio', proceso: 'seguimiento abierto', procesos_n: 'seguimientos abiertos',
        herr_titulo: 'Herramientas', equipo_titulo: 'Equipo del centro', desconocido: 'Socio sin ficha',
        buscar_ayuda_buzon: 'Elegí la persona para cargar documentos recibidos o enviarle documentación.'
      },
      dom: [
        ['#nav-kanban', 'Seguimientos'], ['#vista-kanban h1', 'Seguimientos'], ['label[for=hub-q]', 'Ir directo a un socio'],
        ['#hub-q', null, 'Escribí el nombre o el DNI'], ['#hub-buscar', null, null, 'Buscar socio'],
        ['#buscar-expediente', null, 'Buscar por nombre o DNI', 'Buscar socio'],
        ['#selector-empresas-contador option[value=todas]', 'Todos los socios'],
        ['#modal-cliente h3', 'Registrar nuevo socio'], ['#modal-cliente .form-group:nth-child(1) label', 'Nombre y apellido'], ['#client-name', null, 'Ej. Laura Pérez'],
        ['#modal-cliente .form-group:nth-child(2) label', 'DNI'], ['#client-cuit', null, 'Ej. 30123456'],
        ['#modal-cliente .form-group:nth-child(3) label', 'Correo del socio (opcional)'], ['#modal-cliente .btn-submit', 'Guardar socio'],
        ['.client-board h2', 'Socios activos'], ['#btn-admin-cartera', 'Administrar socios'],
        ['#persona-nivel option[value=asistente]', 'Recepción'], ['#persona-nivel option[value=midsenior]', 'Profesor/a o profesional'], ['#persona-nivel option[value=senior]', 'Dirección'],
        ['#col-pendiente h3', 'Por hacer'], ['#col-proceso h3', 'En gestión'], ['#col-finalizado h3', 'Resuelto'],
        ['#vista-mis-tareas h1', 'Mis seguimientos'], ['#vista-mis-tareas .kanban-columna:nth-child(1) h3', 'Por hacer'], ['#vista-mis-tareas .kanban-columna:nth-child(2) h3', 'En gestión'], ['#vista-mis-tareas .kanban-columna:nth-child(3) h3', 'Resuelto'],
        ['#modal-tarea h3', 'Nuevo seguimiento'], ['#modal-tarea .form-group:nth-child(1) label', 'Qué hay que hacer (ej. avisar vencimiento de cuota)'], ['#modal-tarea .form-group:nth-child(2) label', 'Para cuándo'],
        ['#modal-tarea .form-group:nth-child(3) label', 'Quién se encarga'], ['#modal-tarea .btn-submit', 'Guardar seguimiento'], ['#btn-nueva-tarea', '+ Nuevo seguimiento'], ['#modal-estado h3', 'Cambiar estado del seguimiento']
      ],
      // Nombres de los estados de un seguimiento (el valor guardado no cambia; solo cómo se ve).
      estados: { 'Pendiente de Procesar': 'Por hacer', 'Pendiente': 'Por hacer', 'En Revisión': 'Por hacer', 'Solicitar Información': 'En gestión', 'En Proceso': 'En gestión', 'Procesado/Liquidado': 'En gestión', 'Proceso Completo/Finalizado': 'Resuelto' },
      responsables: ['Recepción', 'Profesores', 'Administración', 'Dirección'],
      // Seguimientos en tres pasos: Por hacer → En gestión → Resuelto (sin «En revisión»).
      sinRevision: true,
      flujo: {
        'Pendiente de Procesar': ['En Proceso', 'Proceso Completo/Finalizado'], 'Pendiente': ['En Proceso', 'Proceso Completo/Finalizado'],
        'En Revisión': ['En Proceso', 'Proceso Completo/Finalizado'], 'Solicitar Información': ['En Proceso', 'Proceso Completo/Finalizado'],
        'En Proceso': ['Proceso Completo/Finalizado'], 'Procesado/Liquidado': ['Proceso Completo/Finalizado'], 'Proceso Completo/Finalizado': []
      }
    }
  };

  // Copia de un solo rubro: no hay vista previa de otros.
  let elegido = RUBRO;
  try { const q = new URLSearchParams(location.search).get('rubro'); if (q && PERFILES[q]) elegido = q; } catch (e) {}
  const P = PERFILES[elegido];
  window.DOMINO_RUBRO = elegido;
  window.DOMINO_PERFIL = P;
  window.DOMINO_MODULOS = Object.assign({ turnos: false, mascotas: false }, P.modulos);
  window.DOMINO_FUNC = { documentos: DOCUMENTOS };
  window.DOMINO_T = (k, porDefecto) => (P.textos && P.textos[k]) || porDefecto;
  window.TXT_ESTADO = (e) => (P.estados && P.estados[e]) || e;
  // Reemplaza los textos fijos del perfil cuando la página ya está lista
  const aplicarDom = () => {
    (P.dom || []).forEach(([sel, txt, ph, aria]) => {
      document.querySelectorAll(sel).forEach((el) => { if (txt) el.textContent = txt; if (ph) el.setAttribute('placeholder', ph); if (aria) el.setAttribute('aria-label', aria); });
    });
    const sr = document.getElementById('task-responsable');
    if (sr && P.responsables && !sr.dataset.rubro) { sr.dataset.rubro = '1'; sr.innerHTML = '<option value="" disabled selected>Elegí quién se encarga…</option>' + P.responsables.map((r) => '<option>' + r + '</option>').join(''); }
    const fe = document.getElementById('filtro-estado');
    if (fe && P.estados) fe.querySelectorAll('option').forEach((o) => { if (P.estados[o.value]) o.textContent = P.estados[o.value]; });
    if (P.sinRevision) {
      const cr = document.getElementById('col-revision'); if (cr) cr.style.display = 'none';
      if (fe) fe.querySelectorAll('option[value="En Revisión"]').forEach((o) => o.remove());
    }
    const mr = document.getElementById('modal-responsable');
    if (mr && P.responsables && !mr.dataset.rubro) { mr.dataset.rubro = '1'; mr.innerHTML = '<option value="">Sin cambiar</option>' + P.responsables.map((r) => '<option>' + r + '</option>').join(''); }
    document.querySelectorAll('h1').forEach((h) => { if (P.textos && P.textos.herr_titulo && /^Herramientas del estudio$/i.test(h.textContent.trim())) h.textContent = P.textos.herr_titulo; if (P.textos && P.textos.equipo_titulo && /^Equipo del estudio$/i.test(h.textContent.trim())) h.textContent = P.textos.equipo_titulo; });
  };
  window.DOMINO_CLIENTE = CLIENTE;
  // Logo y nombre del negocio en el menú lateral y en el portal; sin logo cargado queda la marca DOMino.
  const aplicarMarca = () => {
    const img = new Image();
    img.onload = () => {
      document.querySelectorAll('.brand-icon, [data-marca-logo]').forEach((el) => { el.src = CLIENTE.logo; el.alt = CLIENTE.nombre || 'Logo'; el.removeAttribute('width'); el.removeAttribute('height'); el.style.height = el.classList.contains('brand-icon') ? '38px' : ''; el.style.width = 'auto'; el.style.maxWidth = '120px'; el.style.objectFit = 'contain'; });
      if (!CLIENTE.nombre) document.querySelectorAll('.brand-name').forEach((el) => { el.style.display = 'none'; });
    };
    img.src = CLIENTE.logo;
    if (CLIENTE.nombre) document.querySelectorAll('.brand-name').forEach((el) => { el.innerHTML = '<b></b><small>Gestión</small>'; el.querySelector('b').textContent = CLIENTE.nombre; });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicarMarca); else aplicarMarca();
  if (P.dom) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicarDom); else aplicarDom(); setTimeout(aplicarDom, 800); }
})();
