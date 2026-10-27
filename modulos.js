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

  const PERFILES = {
    // Todo lo que tiene DOMino Profesional, sin módulos opcionales. Sirve de base para rubros nuevos.
    general: {
      nombre: 'General', modulos: {}, ocultar: [], orden: [], etiquetas: {}, textos: {}
    },
    // Estudio contable / profesional con clientes empresas y trámites con vencimiento.
    contador: {
      nombre: 'Contador', modulos: {}, ocultar: [], orden: [], etiquetas: {}, textos: {}
    },
    // Bienestar: gimnasios, clases, spa, peluquería, uñas, estética, consultorios. Un solo perfil; las actividades se eligen al cargar el negocio (bienestar.js).
    // Sin mascotas ni libreta sanitaria. Clases con cupos y turnos individuales vienen del módulo de turnos.
    bienestar: {
      nombre: 'Bienestar',
      modulos: { turnos: true },
      ocultar: ['portal', 'pendientes', 'cuit', 'iva'],
      orden: ['Agenda y turnos', 'Gestión del estudio', 'Plazos y equipo', 'Documentos', 'Herramientas'],
      etiquetas: {
        expedientes: { t: 'Socios y clientes', d: 'Fichas de socios y clientes, con su contacto, sus turnos y sus seguimientos. Desde acá también se da de alta o baja a una persona.' },
        kanban: { t: 'Seguimientos', d: 'Cuotas por vencer, renovaciones y pendientes, por estado.' },
        tareas: { t: 'Mis seguimientos', d: 'Lo que tenés asignado, por estado.' },
        buzon: { t: 'Documentos del socio', d: 'Cargar aptos médicos, planes y fichas, o enviarlos al socio.' },
        calendario: { t: 'Calendario', d: 'Vencimientos de cuotas y renovaciones del mes, día por día.' }
      },
      textos: {
        gestion: 'Gestión del negocio', clientes: 'Socios y clientes', cartera_activos: 'Socios activos', cartera_inactivos: 'Socios inactivos',
        expedientes: 'Socios y clientes', ayuda_expediente: 'Elegí la persona para ver su ficha, sus turnos y sus seguimientos.', procesos: 'Seguimientos activos',
        hub_sub: 'Todo el negocio en un solo lugar: clases, turnos y socios a un toque.',
        rol_senior: 'Dirección', rol_midsenior: 'Profesor/a o profesional', rol_asistente: 'Recepción',
        kpi_listos: 'Seguimientos listos', ver_ficha: 'Ver ficha', kpi_finalizadas: 'Finalizados', id_label: 'DNI', empresa: 'Socio', proceso: 'seguimiento abierto', procesos_n: 'seguimientos abiertos',
        herr_titulo: 'Herramientas', equipo_titulo: 'Equipo del negocio',
        buscar_ayuda_buzon: 'Elegí la persona para cargar documentos recibidos o enviarle documentación.'
      },
      dom: [
        ['#nav-kanban', 'Seguimientos'], ['#vista-kanban h1', 'Seguimientos'], ['label[for=hub-q]', 'Ir directo a un socio o cliente'],
        ['#hub-q', null, 'Escribí el nombre o el DNI'], ['#hub-buscar', null, null, 'Buscar socio o cliente'],
        ['#buscar-expediente', null, 'Buscar por nombre o documento', 'Buscar socio o cliente'],
        ['#selector-empresas-contador option[value=todas]', 'Todos los socios'],
        ['#modal-cliente h3', 'Registrar nuevo socio o cliente'], ['#modal-cliente .form-group:nth-child(1) label', 'Nombre y apellido'], ['#client-name', null, 'Ej. Laura Pérez'],
        ['#modal-cliente .form-group:nth-child(2) label', 'DNI / Identificador'], ['#client-cuit', null, 'Ej. 30123456'],
        ['#modal-cliente .form-group:nth-child(3) label', 'Correo del socio (si va a usar el portal)'], ['#modal-cliente .btn-submit', 'Guardar socio'],
        ['.client-board h2', 'Cartera de socios'], ['#btn-admin-cartera', 'Administrar socios'],
        ['#persona-nivel option[value=asistente]', 'Recepción'], ['#persona-nivel option[value=midsenior]', 'Profesor/a o profesional'], ['#persona-nivel option[value=senior]', 'Dirección']
      ]
    },
    // Veterinaria: dueños y mascotas, agenda de turnos, libreta sanitaria. Sin portal de documentos ni herramientas fiscales.
    veterinaria: {
      nombre: 'Veterinaria',
      modulos: { turnos: true, mascotas: true },
      ocultar: ['portal', 'pendientes', 'cuit', 'iva'],
      orden: ['Agenda y turnos', 'Gestión del estudio', 'Plazos y equipo', 'Documentos', 'Herramientas'],
      etiquetas: {
        expedientes: { t: 'Dueños y mascotas', d: 'Fichas de dueños, mascotas, libretas sanitarias y turnos. Desde acá también se da de alta o baja a un dueño.' },
        kanban: { t: 'Seguimientos', d: 'Todos los seguimientos y tareas, por estado.' },
        tareas: { t: 'Mis seguimientos', d: 'Lo que tenés asignado, por estado.' },
        buzon: { t: 'Documentos del dueño', d: 'Cargar certificados, estudios y recetas, o enviarlos al dueño.' },
        calendario: { t: 'Calendario', d: 'Vencimientos y controles del mes, día por día.' }
      },
      textos: {
        gestion: 'Gestión de la veterinaria', clientes: 'Dueños y mascotas', cartera_activos: 'Dueños activos', cartera_inactivos: 'Dueños inactivos',
        expedientes: 'Dueños y mascotas', ayuda_expediente: 'Elegí el dueño para ver sus mascotas, turnos y seguimientos.', procesos: 'Seguimientos activos',
        hub_sub: 'Todo lo de la veterinaria en un solo lugar: elegí una herramienta y entrás en un toque.',
        rol_senior: 'Dirección', rol_midsenior: 'Veterinario/a', rol_asistente: 'Recepción',
        kpi_listos: 'Seguimientos listos', ver_ficha: 'Ver ficha', kpi_finalizadas: 'Finalizados', id_label: 'DNI', empresa: 'Dueño', proceso: 'seguimiento abierto', procesos_n: 'seguimientos abiertos',
        herr_titulo: 'Herramientas', equipo_titulo: 'Equipo de la veterinaria',
        buscar_ayuda_buzon: 'Elegí el dueño para cargar documentos recibidos o enviarle documentación.'
      },
      // Textos fijos de la pantalla (selector → texto / placeholder). Solo cambia lo que se ve; no toca datos.
      dom: [
        ['#nav-kanban', 'Seguimientos'], ['#vista-kanban h1', 'Seguimientos'], ['label[for=hub-q]', 'Ir directo a un dueño o mascota'],
        ['#hub-q', null, 'Escribí el nombre del dueño o de la mascota'], ['#hub-buscar', null, null, 'Buscar dueño o mascota'],
        ['#buscar-expediente', null, 'Buscar por nombre, mascota o documento', 'Buscar dueño'],
        ['#selector-empresas-contador option[value=todas]', 'Todos los dueños'],
        ['#modal-cliente h3', 'Registrar nuevo dueño'], ['#modal-cliente .form-group:nth-child(1) label', 'Nombre del dueño'], ['#client-name', null, 'Ej. Juan Pérez'],
        ['#modal-cliente .form-group:nth-child(2) label', 'DNI / Identificador'], ['#client-cuit', null, 'Ej. 30123456'],
        ['#modal-cliente .form-group:nth-child(3) label', 'Correo del dueño (si va a usar el portal)'], ['#modal-cliente .btn-submit', 'Guardar dueño'],
        ['.client-board h2', 'Cartera de dueños'], ['#btn-admin-cartera', 'Administrar dueños'],
        ['#persona-nivel option[value=asistente]', 'Recepción'], ['#persona-nivel option[value=midsenior]', 'Veterinario/a'], ['#persona-nivel option[value=senior]', 'Dirección']
      ]
    }
  };

  // Vista previa de otro rubro sin tocar la copia: ?rubro=contador (solo cambia lo que se ve en ese navegador).
  let elegido = RUBRO;
  try { const q = new URLSearchParams(location.search).get('rubro'); if (q && PERFILES[q]) elegido = q; } catch (e) {}
  const P = PERFILES[elegido];
  window.DOMINO_RUBRO = elegido;
  window.DOMINO_PERFIL = P;
  window.DOMINO_MODULOS = Object.assign({ turnos: false, mascotas: false }, P.modulos);
  window.DOMINO_FUNC = { documentos: DOCUMENTOS };
  window.DOMINO_T = (k, porDefecto) => (P.textos && P.textos[k]) || porDefecto;
  // Reemplaza los textos fijos del perfil cuando la página ya está lista
  const aplicarDom = () => {
    (P.dom || []).forEach(([sel, txt, ph, aria]) => {
      document.querySelectorAll(sel).forEach((el) => { if (txt) el.textContent = txt; if (ph) el.setAttribute('placeholder', ph); if (aria) el.setAttribute('aria-label', aria); });
    });
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
