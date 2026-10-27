import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, query, where, getDoc, serverTimestamp, onSnapshot, orderBy,deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "PEGAR_apiKey",
  authDomain: "PEGAR_authDomain",
  projectId: "PEGAR_projectId",
  storageBucket: "PEGAR_storageBucket",
  messagingSenderId: "PEGAR_messagingSenderId",
  appId: "PEGAR_appId",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Escapa texto antes de insertarlo como HTML (nombres, archivos, mensajes)
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
window.DOMINO = { db, auth, esc, listo: false };

// Aviso breve en pantalla (reemplaza alert para confirmaciones)
window.DOMINO.aviso = function(texto, tipo) {
    let t = document.getElementById('toast-dom');
    if (!t) { t = document.createElement('div'); t.id = 'toast-dom'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = texto; t.className = 'toast-dom ' + (tipo || 'ok') + ' show';
    clearTimeout(window.__toastT); window.__toastT = setTimeout(() => t.classList.remove('show'), 6000);
};

// Alta de acceso: crea el usuario con una clave descartable en una conexión aparte (para no cerrar la sesión de
// quien lo hace) y envía el correo para que la propia persona elija su primera clave. Nadie más conoce la clave.
let appAlta = null;
window.DOMINO.crearAcceso = async function(email) {
    email = String(email || '').trim().toLowerCase();
    if (!email) throw Object.assign(new Error('sin correo'), { code: 'auth/invalid-email' });
    if (!appAlta) appAlta = initializeApp(firebaseConfig, 'alta');
    const authAlta = getAuth(appAlta);
    let resultado = 'creado';
    try {
        const tmp = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())) + 'Aa1!';
        await createUserWithEmailAndPassword(authAlta, email, tmp);
    } catch (e) {
        if (e.code === 'auth/email-already-in-use') resultado = 'existente'; else throw e;
    }
    await sendPasswordResetEmail(authAlta, email);
    try { await signOut(authAlta); } catch (e) { /* sin sesión que cerrar */ }
    return resultado;
};
window.DOMINO.textoErrorAcceso = function(e) {
    const c = (e && e.code) || '';
    if (c === 'auth/invalid-email') return 'El correo no es válido. Revisalo.';
    if (c === 'auth/network-request-failed') return 'No hay conexión. Probá de nuevo en un momento.';
    if (c === 'auth/operation-not-allowed') return 'El ingreso con correo y clave no está habilitado en Firebase.';
    if (c === 'auth/too-many-requests') return 'Demasiados intentos. Esperá unos minutos.';
    return 'No se pudo enviar el acceso. Probá de nuevo.';
};
window.enviarAcceso = async function(email, btn) {
    const txt = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
    try {
        const r = await window.DOMINO.crearAcceso(email);
        window.DOMINO.aviso(r === 'creado'
            ? `Listo. Le enviamos un correo a ${email} para que cree su clave.`
            : `${email} ya tenía acceso. Le enviamos un correo para que restablezca su clave.`);
    } catch (e) { console.error(e); window.DOMINO.aviso(window.DOMINO.textoErrorAcceso(e), 'error'); }
    if (btn) { btn.disabled = false; btn.textContent = txt; }
};

const modal = document.getElementById('modal-cliente');
const btnNuevoCliente = document.getElementById('btn-nuevo-cliente');
const btnCloseModal = document.getElementById('close-modal');
const formAlta = document.getElementById('form-alta-cliente');

const mapaEstados = {
    "Pendiente de Procesar": ["En Revisión", "Solicitar Información"],
    "Pendiente": ["En Revisión", "Solicitar Información"],
    "En Revisión": ["Solicitar Información", "En Proceso"],
    "Solicitar Información": ["En Revisión", "En Proceso", "Procesado/Liquidado"],
    "En Proceso": ["Procesado/Liquidado", "Proceso Completo/Finalizado"],
    "Procesado/Liquidado": ["Proceso Completo/Finalizado"],
    "Proceso Completo/Finalizado": []
};

const colorEstado = {
    "Pendiente de Procesar": "border-rojo",
    "Pendiente": "border-rojo",
    "En Revisión": "border-rojo",
    "Solicitar Información": "border-ambar",
    "En Proceso": "border-ambar",
    "Procesado/Liquidado": "border-ambar",
    "Proceso Completo/Finalizado": "border-verde"
};

btnNuevoCliente.addEventListener('click', () => modal.style.display = 'flex');
btnCloseModal.addEventListener('click', () => modal.style.display = 'none');

const hamburger = document.getElementById('hamburger');
const menu = document.getElementById('menu');
function cerrarMenuMovil() { menu.classList.remove('show'); hamburger.setAttribute('aria-expanded', 'false'); hamburger.textContent = '☰'; document.body.classList.remove('menu-abierto'); }
function abrirMenuMovil() { window.scrollTo(0, 0); menu.classList.add('show'); hamburger.setAttribute('aria-expanded', 'true'); hamburger.textContent = '✕'; document.body.classList.add('menu-abierto'); }
hamburger.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.contains('show') ? cerrarMenuMovil() : abrirMenuMovil(); });
document.getElementById('menu-cerrar').addEventListener('click', cerrarMenuMovil);
menu.addEventListener('click', (e) => { if (e.target.closest('a')) cerrarMenuMovil(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('show')) cerrarMenuMovil(); });


// =========================================
// LOGICA DE DATOS: CLIENTES (FIRESTORE)
// =========================================

// 1. Cargar Clientes Activos
async function cargarClientes(filtro = "activo") {
    const listaClientes = document.getElementById('client-list');
    listaClientes.innerHTML = "";
    const tituloCartera = document.querySelector('.client-board h2');
const textoVacio = filtro === 'inactivo' ? 'No hay clientes inactivos registrados.' : 'No hay clientes activos registrados.';
tituloCartera.innerText = filtro === 'inactivo' ? (window.DOMINO_T ? window.DOMINO_T('cartera_inactivos', 'Cartera de Clientes Inactivos') : 'Cartera de Clientes Inactivos') : (window.DOMINO_T ? window.DOMINO_T('cartera_activos', 'Cartera de Clientes Activos') : 'Cartera de Clientes Activos');

    try {
        let q;

if (filtro === "todas") {
    q = query(collection(db, "clients"));
} else {
    q = query(collection(db, "clients"), where("estado", "==", filtro));
}

const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            listaClientes.innerHTML = `<p style='color: var(--text-muted);'>${textoVacio}</p>`;
            return;
        }

        querySnapshot.forEach((documento) => {
            const cliente = documento.data();
            const idDoc = documento.id;
            cacheClientes[idDoc] = cliente.nombre_empresa;

            const clienteHTML = `
                <div class="client-card" id="card-${idDoc}">
                    <div data-act="expediente" data-id="${esc(idDoc)}" data-nombre="${esc(cliente.nombre_empresa)}" role="button" tabindex="0" style="cursor: pointer; flex-grow: 1;">
                        <h4 style="pointer-events: none;">${esc(cliente.nombre_empresa)}</h4>
                        <p style="color: var(--text-muted); font-size: 0.85rem; pointer-events: none;">${window.DOMINO_T ? window.DOMINO_T('id_label', 'CUIT') : 'CUIT'}: ${esc(cliente.cuit)}</p>
                        ${(window.DOMINO_MODULOS || {}).mascotas && (cliente.mascotas || []).length ? `<p style="color: var(--text-muted); font-size: 0.85rem; pointer-events: none;">Mascotas: ${esc(cliente.mascotas.map((m) => m.nombre).join(', '))}</p>` : ''}
                    </div>
                    <button class="${cliente.estado === 'activo' ? 'btn-baja' : 'btn-activar'}" 
        data-id="${idDoc}" 
        data-estado="${cliente.estado}">
    ${cliente.estado === 'activo' ? 'Desactivar' : 'Activar'}
</button>
                    <button class="btn-secundario" data-act="accesos" data-id="${esc(idDoc)}" data-nombre="${esc(cliente.nombre_empresa)}" title="Quiénes de esta empresa entran al portal y qué pueden hacer">Accesos</button>
                    ${(window.DOMINO_MODULOS || {}).turnos ? `<a class="btn-secundario" style="text-decoration:none;display:inline-flex;align-items:center" href="turnos/panel.html?cliente=${encodeURIComponent(idDoc)}" title="Turnos de este cliente">Turnos</a>` : ''}
                    ${cliente.usuario_id ? `<button class="btn-secundario" data-act="acceso" data-email="${esc(cliente.usuario_id)}" title="Envía al cliente un correo para crear o restablecer su clave del portal">Enviar acceso</button>` : ''}
                </div>
            `;
            listaClientes.innerHTML += clienteHTML;
        });

        document.querySelectorAll('.btn-baja, .btn-activar').forEach(button => {
    button.addEventListener('click', async (e) => {
        const idCliente = e.target.getAttribute('data-id');
        const estadoActual = e.target.getAttribute('data-estado');

        if (estadoActual === 'activo') {
            await desactivarCliente(idCliente);
        } else {
            await reactivarCliente(idCliente);
        }
    });
});

    } catch (error) {
        console.error("Error al cargar clientes:", error);
    }
}

// 2. Alta de Cliente
formAlta.addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita que la página se recargue

    const nombre = document.getElementById('client-name').value;
    const cuit = document.getElementById('client-cuit').value;

    try {
        await addDoc(collection(db, "clients"), {
            nombre_empresa: nombre,
            cuit: cuit,
            estado: "activo",
            fecha_creacion: new Date().toISOString(),
            usuario_id: document.getElementById('client-usuario-id').value.trim().toLowerCase()
        });

        formAlta.reset(); // Limpiamos los campos
        modal.style.display = 'none'; // Cerramos el formulario
        cargarClientes(); // Recargamos la lista en pantalla

    } catch (error) {
        alert("Error al guardar el cliente: " + error.message);
    }
});

// 3. Baja Lógica de Cliente (Cambio de estado)
async function desactivarCliente(id) {
    if (confirm("¿Estás seguro de que deseas desactivar este cliente?")) {
        try {
            const clienteRef = doc(db, "clients", id);
            await updateDoc(clienteRef, {
                estado: "inactivo"
            });
            
            
            cargarClientes(selectorContador.value);
        } catch (error) {
            console.error("Error al desactivar:", error);
        }
    }
}

async function reactivarCliente(id) {
    if (confirm("¿Confirma que el cliente vuelve al estudio?")) {
        try {
            const clienteRef = doc(db, "clients", id);
            await updateDoc(clienteRef, {
                estado: "activo"
            });

            cargarClientes(selectorContador.value);
        } catch (error) {
            console.error("Error al Reactivar:", error);
        }
    }
}

// =========================================
// MÓDULO: EXPEDIENTE Y TAREAS RELACIONALES
// =========================================

// Variables de la interfaz de Expediente
const vistaDashboard = document.getElementById('vista-dashboard');
const vistaExpediente = document.getElementById('vista-expediente');
const btnVolver = document.getElementById('btn-volver');
const tituloExpediente = document.getElementById('titulo-expediente');
console.log("btnVolver:", btnVolver);

// Variables del Modal de Tareas
const modalTarea = document.getElementById('modal-tarea');
const btnNuevaTarea = document.getElementById('btn-nueva-tarea');
const btnCloseModalTarea = document.getElementById('close-modal-tarea');
const formAltaTarea = document.getElementById('form-alta-tarea');

let cacheClientes = {};
window.DOMINO.clientes = cacheClientes;
let vistaOrigen = 'expedientes';
let vistaActual = null;
let idClienteActivo = null; 

btnVolver.addEventListener('click', () => {
    idClienteActivo = null;
    navegarA(window.rolActual === 'asistente' ? 'mis-tareas' : (vistaOrigen || 'expedientes'));
});

btnNuevaTarea.addEventListener('click', () => modalTarea.style.display = 'flex');
btnCloseModalTarea.addEventListener('click', () => modalTarea.style.display = 'none');


window.abrirExpediente = function(id, nombre) {
    if (vistaActual && vistaActual !== 'expediente' && vistaActual !== 'buzon') vistaOrigen = vistaActual;
    idClienteActivo = id; 
    tituloExpediente.innerText = nombre; 
    mostrarVista('expediente');
    cargarTareasDelCliente(id);
    if (window.mostrarFichaDatos) window.mostrarFichaDatos(id);
};

// 4. Guardar una Tarea en Firestore (Atada al Cliente)
formAltaTarea.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!idClienteActivo) return; // Seguridad: no guardar si no hay cliente

    const nombreTarea = document.getElementById('task-name').value;
    const fecha = document.getElementById('task-date').value;
    const responsable = document.getElementById('task-responsable').value;

    try {
        await addDoc(collection(db, "tasks"), {
            cliente_id: idClienteActivo,
            titulo: nombreTarea,
            vencimiento: fecha,
            responsable: responsable,
            estado: "Pendiente de Procesar"
        });

        formAltaTarea.reset();
        modalTarea.style.display = 'none';
        cargarTareasDelCliente(idClienteActivo); // Recargamos la lista

    } catch (error) {
        alert("Error al guardar tarea: " + error.message);
    }
});

// 5. Traer solo las tareas de este cliente
async function cargarTareasDelCliente(id) {
    const listaTareas = document.getElementById('lista-tareas-cliente');
    listaTareas.innerHTML = "";

    try {
        // Pedimos a Firestore: "Trae las tareas DONDE el cliente_id sea igual a idClienteActivo"
        const q = query(collection(db, "tasks"), where("cliente_id", "==", id));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            listaTareas.innerHTML = "<p style='color: var(--text-muted);'>No hay procesos activos para este cliente.</p>";
            return;
        }

        querySnapshot.forEach((taskDoc) => {
            const tarea = taskDoc.data();
            const idTarea = taskDoc.id;
            listaTareas.innerHTML += `
                <div class="task-item ${colorEstado[tarea.estado] || 'border-ambar'}">
                    <div class="task-info">
                        <h4>${esc(tarea.titulo)}</h4>
                        <p style="color: var(--text-muted); font-size: 0.85rem;">
                            Asignado a: <strong>${esc(tarea.responsable)}</strong> | Vence: ${esc(tarea.vencimiento)} | Estado: ${esc(tarea.estado)}
                        </p>
                    </div>
                    <div style="display: flex; gap: 8px;">
    <button class="btn-action" data-act="docs-tarea" data-id="${esc(idTarea)}" data-titulo="${esc(tarea.titulo)}">
        Documentos
    </button>
    <button class="btn-secundario" data-act="estado" data-id="${esc(idTarea)}" data-estado="${esc(tarea.estado)}" data-titulo="${esc(tarea.titulo)}">
        ${esc(tarea.estado)}
    </button>
</div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Error cargando tareas:", error);
    }
}

// =========================================
// MÓDULO: BUZÓN DOCUMENTAL
// =========================================

const vistaBuzon = document.getElementById('vista-buzon');
const btnVolverBuzon = document.getElementById('btn-volver-buzon');
const formSubirDoc = document.getElementById('form-subir-doc');

async function cargarTareasEnSelectores(idCliente) {
    try {
        const q = query(
            collection(db, "tasks"),
            where("cliente_id", "==", idCliente)
        );
        const querySnapshot = await getDocs(q);
        
        const selectores = document.querySelectorAll('.selector-tarea');
        selectores.forEach(selector => {
            selector.innerHTML = '<option value="">Asignar a tarea...</option>';
            querySnapshot.forEach((taskDoc) => {
                const tarea = taskDoc.data();
                selector.innerHTML += `<option value="${esc(taskDoc.id)}">${esc(tarea.titulo)} — ${esc(tarea.responsable || 'Sin asignar')}</option>`;
            });
        });
    } catch (error) {
        console.error("Error cargando tareas en selectores:", error);
    }
}

// 1. Navegación: Ir de Expediente a Buzón
['filtro-fecha', 'filtro-area', 'filtro-estado', 'filtro-asignacion'].forEach((fid) => {
    document.getElementById(fid).addEventListener('change', () => { if (idClienteActivo) cargarDocumentosDelCliente(idClienteActivo); });
});

window.abrirBuzon = function() {
    if (!idClienteActivo) return; // Si no hay cliente seleccionado, no hace nada
    document.getElementById('titulo-buzon').innerText = "Buzón Documental · " + (tituloExpediente.innerText || '');
    mostrarVista('buzon');
    
    // Cargamos los documentos previos
    cargarDocumentosDelCliente(idClienteActivo);
    cargarTareasEnSelectores(idClienteActivo);
};

// 2. Navegación: Volver de Buzón a Expediente
btnVolverBuzon.addEventListener('click', () => {
    mostrarVista('expediente');
});

// 3. Guardar el registro del documento
formSubirDoc.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!idClienteActivo) return;

    const categoria = document.getElementById('doc-category').value;
    
    // Obtenemos el nombre real del archivo que el usuario seleccionó
    const archivoInput = document.getElementById('doc-file');
    const nombreArchivo = archivoInput.files[0].name; 

    // Generamos la fecha actual en formato legible
    const fechaHoy = new Date().toLocaleDateString('es-ES');
    const btnSubir = formSubirDoc.querySelector('.btn-primary');

    try {
        btnSubir.disabled = true;
        btnSubir.innerText = "Subiendo...";
        // El archivo se guarda en Storage (antes solo se registraba el nombre y no se podía descargar)
        const carpeta = new Date().toISOString().slice(0, 10);
        const storageRef = ref(storage, `documentos/${idClienteActivo}/${carpeta}/${Date.now()}_${nombreArchivo}`);
        await uploadBytes(storageRef, archivoInput.files[0]);
        const urlDescarga = await getDownloadURL(storageRef);

        await addDoc(collection(db, "documents"), {
            cliente_id: idClienteActivo,
            categoria: categoria,
            nombre_archivo: nombreArchivo,
            fecha_subida: fechaHoy,
            estado: "Pendiente de Procesar", // Ideal para que el Asistente sepa qué es nuevo
            url_descarga: urlDescarga
        });

        formSubirDoc.reset();
        cargarDocumentosDelCliente(idClienteActivo); // Recargamos la lista
        actualizarKPIs();

    } catch (error) {
        alert("Error al registrar el documento: " + error.message);
    } finally {
        btnSubir.disabled = false;
        btnSubir.innerText = "Subir y Centralizar";
    }
});

// 4. Traer el historial de documentos
async function cargarDocumentosDelCliente(id) {
    const listaDocs = document.getElementById('lista-documentos');
    listaDocs.innerHTML = "";
    
    const filtroFecha = document.getElementById('filtro-fecha').value;
    const filtroArea = document.getElementById('filtro-area').value;
    const filtroEstado = document.getElementById('filtro-estado').value;
    const filtroAsignacion = document.getElementById('filtro-asignacion').value;
    
    try {
        const q = query(collection(db, "documents"), where("cliente_id", "==", id));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            listaDocs.innerHTML = "<p style='color: var(--text-muted);'>No hay documentos en el buzón.</p>";
            return;
        }

        let docs = [];
        querySnapshot.forEach((docSnap) => {
            docs.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Filtrar por área
        if (filtroArea !== 'todas') {
            docs = docs.filter(d => d.categoria === filtroArea);
        }

        // Filtrar por estado
        if (filtroEstado !== 'todos') {
            docs = docs.filter(d => d.estado === filtroEstado);
        }

        // Filtrar por asignación
        if (filtroAsignacion === 'asignado') {
            docs = docs.filter(d => d.tarea_id);
        } else if (filtroAsignacion === 'sin_asignar') {
            docs = docs.filter(d => !d.tarea_id);
        }

        // Ordenar por fecha
        docs.sort((a, b) => {
            const fechaA = new Date(a.fecha_subida.split('/').reverse().join('-'));
            const fechaB = new Date(b.fecha_subida.split('/').reverse().join('-'));
            return filtroFecha === 'reciente' ? fechaB - fechaA : fechaA - fechaB;
        });

        if (docs.length === 0) {
            listaDocs.innerHTML = "<p style='color: var(--text-muted);'>No hay documentos con los filtros seleccionados.</p>";
            return;
        }

        docs.forEach((documento) => {
            listaDocs.innerHTML += `
                <div class="doc-item">
                    <div>
                        <h4>${esc(documento.nombre_archivo)}</h4>
                        <p style="color: var(--text-muted); font-size: 0.85rem;">
                            Área: <strong>${esc(documento.categoria)}</strong> | Fecha: ${esc(documento.fecha_subida)}
                        </p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-end;">
                        <span style="font-size: 0.85rem; padding: 5px 10px; background: var(--bg-panel); border-radius: 4px; color: var(--ambar-espera);">
                            ${esc(documento.estado)}
                        </span>
                        ${!documento.tarea_id ? `
                        <select class="mini-selector selector-tarea" data-doc-id="${esc(documento.id)}" style="font-size: 0.8rem;">
                            <option value="">Asignar a tarea...</option>
                        </select>
                        <button class="btn-action btn-asignar-tarea" data-id="x" data-doc-id="${esc(documento.id)}" style="font-size: 0.8rem;">
                            Asignar
                        </button>
                        ` : `<span style="font-size: 0.75rem; color: var(--verde-ok);">✓ Asignado</span>`}
                    </div>
                </div>
            `;
        });

        cargarTareasEnSelectores(idClienteActivo);

    } catch (error) {
        console.error("Error cargando documentos:", error);
    }
}
// Función para cambiar de empresa activa
function cambiarEmpresaActiva(idEmpresa) {
    localStorage.setItem('empresa_activa', idEmpresa);
    // Disparamos un evento para que las otras partes de la app se refresquen
    window.dispatchEvent(new Event('empresaCambiada'));
    
    // Si estamos en el dashboard, recargamos la lista
    if(typeof cargarClientes === 'function') cargarClientes();
}

// Escuchamos el cambio en toda la aplicación
window.addEventListener('empresaCambiada', () => {
    const id = localStorage.getItem('empresa_activa');
    console.log("Nueva empresa seleccionada:", id);
    // Aquí iría el filtro lógico que usaremos en el futuro
});

// Ejecución inicial al abrir la app
const selectorContador = document.getElementById('selector-empresas-contador');

selectorContador.addEventListener('change', () => {
    cargarClientes(selectorContador.value);
});

// =========================================
// MÓDULO: WORKFLOW DE ESTADOS
// =========================================

const modalEstado = document.getElementById('modal-estado');
const closeModalEstado = document.getElementById('close-modal-estado');
const opcionesEstado = document.getElementById('opciones-estado');
const camposEnProceso = document.getElementById('campos-en-proceso');
const btnConfirmarEstado = document.getElementById('btn-confirmar-estado');

let idTareaActiva = null;
let estadoDestino = null;

closeModalEstado.addEventListener('click', () => modalEstado.style.display = 'none');

window.abrirModalEstado = function(id, estadoActual, tituloTarea) {
    idTareaActiva = id;
    estadoDestino = null;
    
    document.getElementById('titulo-tarea-modal').innerText = tituloTarea;
    camposEnProceso.style.display = 'none';
    btnConfirmarEstado.style.display = 'none';
    
    const siguientes = mapaEstados[estadoActual] || [];
    opcionesEstado.innerHTML = '';
    
    
    siguientes.forEach(estado => {
        const btn = document.createElement('button');
        btn.className = 'btn-secundario';
        btn.innerText = estado;
        btn.addEventListener('click', () => seleccionarEstado(estado));
        opcionesEstado.appendChild(btn);
    });
    
    modalEstado.style.display = 'flex';
};

function seleccionarEstado(estado){
    estadoDestino = estado;
    if (estado === "En Proceso") { 
        camposEnProceso.style.display = "flex"; 
    } 
    else { 
        camposEnProceso.style.display = "none"; 
    }
    btnConfirmarEstado.style.display = "block";
}

btnConfirmarEstado.addEventListener('click', async () => {
    const responsable = document.getElementById('modal-responsable').value;
    const vencimiento = document.getElementById('modal-vencimiento').value;
    const tareaRef = doc(db, "tasks", idTareaActiva);
    try {
        await updateDoc(tareaRef, {
            estado: estadoDestino,
            responsable: responsable,
            vencimiento: vencimiento
        });
        modalEstado.style.display = 'none';
        idTareaActiva = null;
        cargarTareasDelCliente(idClienteActivo);
        actualizarKPIs();
    } catch (error) {
        console.error("Error al cambiar estado:", error);
    }
});

async function cargarCacheClientes() {
    const querySnapshot = await getDocs(collection(db, "clients"));
    querySnapshot.forEach((documento) => {
        cacheClientes[documento.id] = documento.data().nombre_empresa;
    });
}

const _T = (k, d) => (window.DOMINO_T ? window.DOMINO_T(k, d) : d);
const ETIQUETA_ROL = { senior: _T('rol_senior', 'Profesional Senior'), midsenior: _T('rol_midsenior', 'Profesional Mid Senior'), asistente: _T('rol_asistente', 'Asistente') };

function aplicarPermisosPorRol(rol) {
    // El menú muestra solo lo que corresponde al nivel de cada persona
    document.querySelectorAll('#menu a[data-roles]').forEach((a) => {
        a.style.display = a.dataset.roles.split(',').includes(rol) ? '' : 'none';
    });
    const spanRol = document.querySelector('.user-profile span');
    if (spanRol) spanRol.innerText = ETIQUETA_ROL[rol] || rol;
}

// Indicadores del Centro de Comando (esta función se llamaba pero no existía)
async function actualizarKPIs() {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        const [tareas, pendientes] = await Promise.all([
            getDocs(collection(db, "tasks")),
            getDocs(query(collection(db, "documents"), where("estado", "==", "Pendiente de Procesar")))
        ]);
        let venceHoy = 0, enProceso = 0, listos = 0;
        tareas.forEach((t) => {
            const d = t.data();
            if (d.estado === "Proceso Completo/Finalizado") { listos++; return; }
            if (d.vencimiento === hoy) venceHoy++;
            if (d.estado === "En Proceso" || d.estado === "Procesado/Liquidado") enProceso++;
        });
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
        set('kpi-vencimientos', venceHoy);
        set('kpi-en-proceso', enProceso);
        set('kpi-finalizados', listos);
        set('kpi-docs-numero', pendientes.size);
        window.DOMINO.kpis = { venceHoy, enProceso, listos, docsPendientes: pendientes.size };
        window.dispatchEvent(new CustomEvent('domino:kpis', { detail: window.DOMINO.kpis }));
    } catch (error) {
        console.error("Error al calcular indicadores:", error);
    }
}
window.actualizarKPIs = actualizarKPIs;

async function iniciarApp() {
    onAuthStateChanged(auth, async (usuario) => {
        if (!usuario) {
            window.location.replace('login.html');
            return;
        }
        
        const q = query(collection(db, "users"), where("email", "==", usuario.email));
        const userSnap = await getDocs(q);

        if (userSnap.empty) {
            alert("Usuario sin perfil asignado. Contacte al administrador.");
            await signOut(auth);
            window.location.replace('login.html');
            return;
        }

        const perfil = userSnap.docs[0].data();
        if (perfil.activo === false) {
            alert("Tu acceso está dado de baja. Contactá al responsable del estudio.");
            await signOut(auth);
            window.location.replace('login.html');
            return;
        }
        const rolUsuario = perfil.rol_jerarquia;
        window.rolActual = rolUsuario;
        window.nombreDisplay = perfil.nombre_display || '';
        Object.assign(window.DOMINO, { rol: rolUsuario, nombre: window.nombreDisplay, email: usuario.email });

        document.getElementById('main-content').style.display = 'block';
        aplicarPermisosPorRol(rolUsuario);

        // Primero el cache de empresas (lo usan tareas y prioridades), después el resto
        await cargarCacheClientes();
        if (rolUsuario !== 'asistente') {
            await Promise.all([cargarClientes(selectorContador.value), actualizarKPIs()]);
        } else {
            await cargarMisTareas(window.nombreDisplay);
        }
        iniciarBadgeChat();
        window.DOMINO.listo = true;
        window.dispatchEvent(new Event('domino:listo'));
        navegarA('hub');
        if (window.activarAtras && !window.__atrasOn) { window.__atrasOn = true; window.activarAtras(volverAtras); }
    });
}

// =========================================
// MÓDULO: DOCUMENTOS PENDIENTES
// =========================================

const closeModalDocs = document.getElementById('close-modal-docs');
closeModalDocs.addEventListener('click', () => 
    document.getElementById('modal-docs-pendientes').style.display = 'none'
);

window.abrirModalDocsPendientes = async function() {
    const listaDocs = document.getElementById('lista-docs-pendientes');
    listaDocs.innerHTML = '<p style="color: var(--text-muted);">Cargando...</p>';
    document.getElementById('modal-docs-pendientes').style.display = 'flex';

try {
    const q = query(
        collection(db, "documents"), 
        where("estado", "==", "Pendiente de Procesar")
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        listaDocs.innerHTML = '<p style="color: var(--text-muted);">No hay documentos pendientes.</p>';
        return;
    }
listaDocs.innerHTML = '';

for (const docSnap of querySnapshot.docs) {
    const documento = docSnap.data();
    const idDocumento = docSnap.id;

    const clienteRef = doc(db, "clients", documento.cliente_id);
    const clienteSnap = await getDoc(clienteRef);
    const nombreEmpresa = clienteSnap.exists() ? clienteSnap.data().nombre_empresa : "Empresa desconocida";

    listaDocs.innerHTML += `
        <div class="doc-item">
            <div>
                <h4>${esc(documento.nombre_archivo)}</h4>
                <p style="color: var(--text-muted); font-size: 0.85rem;">
                    Empresa: <strong>${esc(nombreEmpresa)}</strong> | 
                    Área: ${esc(documento.categoria)} | 
                    Fecha: ${esc(documento.fecha_subida)}
                </p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-end;">
    <span style="font-size: 0.85rem; padding: 5px 10px; background: var(--bg-panel); border-radius: 4px; color: var(--ambar-espera);">
        ${esc(documento.estado)}
    </span>
    ${documento.url_descarga ? `<button class="btn-action" data-act="descargar"
        data-id="${esc(idDocumento)}"
        data-url="${esc(documento.url_descarga)}"
        data-empresa="${esc(nombreEmpresa)}" data-categoria="${esc(documento.categoria)}" data-archivo="${esc(documento.nombre_archivo)}">
        Descargar
    </button>` : `<span style="font-size:0.75rem;color:var(--text-muted);">Sin archivo adjunto</span>`}
</div>
        </div>
    `;
}

} catch (error) {
    console.error("Error al traer documentos pendientes:", error);
}
}
// =========================================
// MÓDULO: PRIORIDADES DE LA SEMANA
// =========================================
window.cargarPrioridades = async function() {
    const listaPrioridades = document.getElementById('lista-prioridades');
    if (!listaPrioridades) return; // las prioridades ahora se muestran en Inicio
    listaPrioridades.innerHTML = '';

    try {
        const hoy = new Date();
        const fechaHoy = hoy.toISOString().split('T')[0];
        
        const limite = new Date();
        limite.setDate(limite.getDate() + 4);
        const fechaLimite = limite.toISOString().split('T')[0];

        const q = query(
            collection(db, "tasks"),
            where("vencimiento", ">=", fechaHoy),
            where("vencimiento", "<=", fechaLimite)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            listaPrioridades.innerHTML = "<p style='color: var(--text-muted);'>No hay tareas urgentes esta semana.</p>";
            return;
        }

        querySnapshot.forEach((taskDoc) => {
            const tarea = taskDoc.data();
            if (tarea.estado === "Proceso Completo/Finalizado") return;
            const nombreEmpresa = cacheClientes[tarea.cliente_id] || "Empresa desconocida";
            
            listaPrioridades.innerHTML += `
                <div class="task-item ${colorEstado[tarea.estado] || 'border-ambar'}">
                    <div class="task-info">
                        <h4>${esc(tarea.titulo)}</h4>
                        <p style="color: var(--text-muted); font-size: 0.85rem;">
                            <strong>${esc(nombreEmpresa)}</strong> | 
                            Área: ${esc(tarea.responsable)} | 
                            Vence: ${esc(tarea.vencimiento)} | Estado: ${esc(tarea.estado)}
                        </p>
                    </div>
                    <button class="btn-action" data-act="expediente" data-id="${esc(tarea.cliente_id)}" data-nombre="${esc(nombreEmpresa)}">
                        Ver Expediente
                    </button>
                </div>
            `;
        });

    } catch (error) {
        console.error("Error al cargar prioridades:", error);
    }
}

window.descargarDocumento = async function(id, url, nombreEmpresa, categoria, nombreArchivo) {
    try {
        const nombreDescarga = `${nombreEmpresa}_${categoria}_${nombreArchivo}`;
        const urlDescarga = url + '&response-content-disposition=attachment';
window.open(urlDescarga, '_blank');
        
        const docRef = doc(db, "documents", id);
        await updateDoc(docRef, {
            estado: "En Revisión"
        });
        
        abrirModalDocsPendientes();
        actualizarKPIs();
        
    } catch (error) {
        console.error("Error al descargar documento:", error);
    }
}

const formEnviarCliente = document.getElementById('form-enviar-cliente'); formEnviarCliente.addEventListener('submit', async (e) => {  
e.preventDefault();  

const categoria = document.getElementById('entrega-categoria').value;  
const archivoInput = document.getElementById('entrega-file'); 
const archivo = archivoInput.files[0];  
const nombreArchivo = archivo.name;  
const fechaHoy = new Date().toLocaleDateString('es-ES'); 
const enviado_por = "Profesional" ; 

try {  
const btnSend = formEnviarCliente.querySelector('.btn-primary');  
btnSend.innerText = "Enviando...";  
btnSend.disabled = true;

const storageRef = ref(storage, `documentos/${idClienteActivo}/${fechaHoy}/${nombreArchivo}`);  
await uploadBytes(storageRef, archivo);  
const downloadURL = await getDownloadURL(storageRef);  

await addDoc(collection(db, "entregas"), {  
cliente_id: idClienteActivo,  
categoria: categoria,  
nombre_archivo: nombreArchivo,  
fecha_envio: fechaHoy,  
url_descarga: downloadURL ,
enviado_por:"Profesional",
fecha_timestamp: serverTimestamp()
});  

formEnviarCliente.reset();  
alert("Documento enviado al cliente correctamente.");
btnSend.innerText = "Enviar al Cliente";
btnSend.disabled = false;

} catch (error) {  
alert("Hubo un error al enviar el documento.");  
console.error(error);  
}  
});

// Filtro opcional de tareas (desde las tarjetas de Inicio): 'vencidas' | null
window.filtroTareas = null;
function hoyISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function pasaFiltro(t) {
    if (window.filtroTareas !== 'vencidas') return true;
    return t.estado !== 'Proceso Completo/Finalizado' && !!t.vencimiento && t.vencimiento < hoyISO();
}
function pintarBannerFiltro() {
    ['kanban', 'mis-tareas'].forEach((v) => {
        const b = document.getElementById('filtro-banner-' + v);
        if (!b) return;
        b.hidden = window.filtroTareas !== 'vencidas';
    });
}
window.quitarFiltroTareas = function() { window.filtroTareas = null; pintarBannerFiltro(); if (vistaActual === 'kanban') cargarKanban(); else cargarMisTareas(window.nombreDisplay); };
window.verVencidas = function() { window.filtroTareas = 'vencidas'; navegarA(window.rolActual === 'asistente' ? 'mis-tareas' : 'kanban'); };

async function cargarKanban() {
    pintarBannerFiltro();
    const columnas = {
        "Pendiente de Procesar": document.getElementById('cards-pendiente'),
        "Pendiente": document.getElementById('cards-pendiente'),
        "En Revisión": document.getElementById('cards-revision'),
        "Solicitar Información": document.getElementById('cards-revision'),
        "En Proceso": document.getElementById('cards-proceso'),
        "Procesado/Liquidado": document.getElementById('cards-proceso'),
        "Proceso Completo/Finalizado": document.getElementById('cards-finalizado')
    };

    Object.values(columnas).forEach(col => {
        if (col) col.innerHTML = '';
    });

    try {
        const querySnapshot = await getDocs(collection(db, "tasks"));
        
        querySnapshot.forEach((taskDoc) => {
            const tarea = taskDoc.data();
            const columna = columnas[tarea.estado];
            if (!columna || !pasaFiltro(tarea)) return;
            
            const nombreEmpresa = cacheClientes[tarea.cliente_id] || "Empresa desconocida";
            
            columna.innerHTML += `
                <div class="kanban-card" data-act="expediente" data-id="${esc(tarea.cliente_id)}" data-nombre="${esc(nombreEmpresa)}" role="button" tabindex="0">
                    <h4>${esc(tarea.titulo)}</h4>
                    <p>${esc(nombreEmpresa)}</p>
                    <p>Vence: ${esc(tarea.vencimiento || 'Sin fecha')}</p>
                </div>
            `;
        });

        document.getElementById('kanban-ultima-actualizacion').innerText = 
            `Actualizado: ${new Date().toLocaleTimeString('es-ES')}`;

    } catch (error) {
        console.error("Error al cargar kanban:", error);
    }
}

const VISTAS = ['hub', 'cartera', 'expedientes', 'expediente', 'buzon', 'kanban', 'mis-tareas', 'calendario', 'herramientas', 'equipo'];

let hubScroll = 0;
function mostrarVista(nombre) {
    if (vistaActual === 'hub' && nombre !== 'hub') hubScroll = window.scrollY;
    if (nombre !== 'kanban' && nombre !== 'mis-tareas') window.filtroTareas = null;
    const volverAlHub = nombre === 'hub' && vistaActual && vistaActual !== 'hub';
    vistaActual = nombre;
    VISTAS.forEach((v) => {
        const el = document.getElementById('vista-' + v);
        if (el) el.style.display = v === nombre ? 'block' : 'none';
    });
    // En el menú se resalta la sección a la que pertenece la vista
    const grupo = { expediente: 'expedientes', buzon: 'expedientes', cartera: 'expedientes', herramientas: 'hub', equipo: 'hub' }[nombre] || nombre;
    document.querySelectorAll('#menu a').forEach((a) => a.classList.toggle('active', a.dataset.vista === grupo));
    cerrarMenuMovil();
    window.scrollTo(0, volverAlHub ? hubScroll : 0);
    if (volverAlHub) [150, 500].forEach((ms) => setTimeout(() => { if (vistaActual === 'hub') window.scrollTo(0, hubScroll); }, ms));
    window.dispatchEvent(new CustomEvent('domino:vista', { detail: nombre }));
}

// "Atrás" del teléfono: hace lo mismo que el botón Volver de la pantalla en la que se está
function volverAtras() {
    const abiertos = [...document.querySelectorAll('.modal')].filter((m) => getComputedStyle(m).display !== 'none');
    if (abiertos.length) { abiertos.forEach((m) => { m.style.display = 'none'; }); return true; }
    if (menu.classList.contains('show')) { cerrarMenuMovil(); return true; }
    if (document.getElementById('panel-chat').style.display === 'flex') { cerrarChat(); return true; }
    switch (vistaActual) {
        case 'hub': return false;
        case 'buzon': mostrarVista('expediente'); return true;
        case 'expediente': btnVolver.click(); return true;
        case 'cartera': navegarA('expedientes'); return true;
        default: navegarA('hub'); return true;
    }
}

window.navegarA = function(seccion) {
    if (seccion === 'dashboard') seccion = 'hub'; // el Centro de Comando ahora vive en Inicio
    if (window.rolActual === 'asistente' && ['cartera', 'expedientes', 'kanban', 'equipo'].includes(seccion)) seccion = 'mis-tareas';
    if (window.rolActual && window.rolActual !== 'senior' && seccion === 'equipo') seccion = 'hub';
    if (document.getElementById('panel-chat').style.display === 'flex') cerrarChat();
    mostrarVista(seccion);
    if (seccion === 'cartera') cargarClientes(selectorContador.value);
    else if (seccion === 'kanban') cargarKanban();
    else if (seccion === 'mis-tareas') cargarMisTareas(window.nombreDisplay);
}
window.cerrarSesion = async function() {
    if (confirm("¿Estás seguro que querés cerrar sesión?")) {
        await signOut(auth);
        window.location.replace('login.html');
    }
}

// Autorefresh cada 15 minutos
setInterval(() => {
    if (window.rolActual && window.rolActual !== 'asistente') {
        actualizarKPIs();
    }
}, 10 * 60 * 1000);

async function cargarMisTareas(nombreAsistente) {
    pintarBannerFiltro();
    const columnas = {
        "Pendiente de Procesar": document.getElementById('mis-tareas-pendiente'),
        "Pendiente": document.getElementById('mis-tareas-pendiente'),
        "En Revisión": document.getElementById('mis-tareas-pendiente'),
        "Solicitar Información": document.getElementById('mis-tareas-pendiente'),
        "En Proceso": document.getElementById('mis-tareas-proceso'),
        "Procesado/Liquidado": document.getElementById('mis-tareas-proceso'),
        "Proceso Completo/Finalizado": document.getElementById('mis-tareas-finalizado')
    };

    Object.values(columnas).forEach(col => {
        if (col) col.innerHTML = '';
    });

    try {
        const q = query(
            collection(db, "tasks"),
            where("responsable", "==", nombreAsistente)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            document.getElementById('mis-tareas-pendiente').innerHTML = 
                "<p style='color: var(--text-muted);'>No tenés tareas asignadas.</p>";
            return;
        }

        querySnapshot.forEach((taskDoc) => {
            const tarea = taskDoc.data();
            const columna = columnas[tarea.estado];
            if (!columna || !pasaFiltro(tarea)) return;
            
            const nombreEmpresa = cacheClientes[tarea.cliente_id] || "Empresa desconocida";
            
            columna.innerHTML += `
    <div class="kanban-card" data-act="docs-tarea" data-id="${esc(taskDoc.id)}" data-titulo="${esc(tarea.titulo)}" data-cliente="${esc(tarea.cliente_id)}" role="button" tabindex="0">
        <h4>${esc(tarea.titulo)}</h4>
        <p>${esc(nombreEmpresa)}</p>
        <p>Vence: ${esc(tarea.vencimiento || 'Sin fecha')}</p>
    </div>
`;
        });

        document.getElementById('mis-tareas-actualizacion').innerText = 
            `Actualizado: ${new Date().toLocaleTimeString('es-ES')}`;

    } catch (error) {
        console.error("Error al cargar mis tareas:", error);
    }
}


// =========================================
// ACCESOS AL PORTAL POR EMPRESA (permisos por persona)
// El titular es el correo de la ficha (usuario_id) y siempre tiene todos los permisos. Cada persona extra vive en
// accesos_portal con ID "correo__idEmpresa" y permisos propios (enviar documentos / ver y descargar lo entregado).
// =========================================
let accesosEmpresa = { id: null, nombre: '' };
const idAcceso = (email, clienteId) => `${email}__${clienteId}`;

window.abrirAccesos = async function(clienteId, nombre) {
    accesosEmpresa = { id: clienteId, nombre: nombre || '' };
    document.getElementById('titulo-accesos').textContent = 'Accesos al portal: ' + (nombre || '');
    document.getElementById('modal-accesos').style.display = 'flex';
    await renderAccesos();
};

async function renderAccesos() {
    const lista = document.getElementById('lista-accesos');
    lista.innerHTML = '<p style="color: var(--text-muted);">Cargando…</p>';
    try {
        const [fic, snap] = await Promise.all([
            getDoc(doc(db, 'clients', accesosEmpresa.id)),
            getDocs(query(collection(db, 'accesos_portal'), where('cliente_id', '==', accesosEmpresa.id)))
        ]);
        const titular = fic.exists() ? (fic.data().usuario_id || '') : '';
        const filas = [];
        snap.forEach((d) => filas.push({ id: d.id, ...d.data() }));
        filas.sort((a, b) => String(a.nombre || a.email).localeCompare(String(b.nombre || b.email)));
        let html = titular
            ? `<div class="acc-fila acc-titular"><div><strong>${esc(titular)}</strong><span class="acc-sub">Titular de la empresa · todos los permisos</span></div></div>`
            : `<p style="color: var(--text-muted);">Esta ficha no tiene titular. Cargá un correo en el campo «usuario» de la ficha.</p>`;
        html += filas.map((f) => `
            <div class="acc-fila ${f.activo === false ? 'acc-baja' : ''}" data-aid="${esc(f.id)}" data-email="${esc(f.email)}">
                <div><strong>${esc(f.nombre || f.email)}</strong><span class="acc-sub">${esc(f.email)}${f.activo === false ? ' · dado de baja' : ''}</span></div>
                <div class="acc-perm">
                    <label><input type="checkbox" data-perm="puede_subir" ${f.puede_subir ? 'checked' : ''} ${f.activo === false ? 'disabled' : ''}> Enviar documentos</label>
                    <label><input type="checkbox" data-perm="puede_descargar" ${f.puede_descargar ? 'checked' : ''} ${f.activo === false ? 'disabled' : ''}> Ver y descargar</label>
                </div>
                <div class="acc-botones">
                    ${f.activo === false
                        ? '<button class="btn-secundario" data-ac="reactivar">Reactivar</button>'
                        : '<button class="btn-secundario" data-ac="reenviar">Reenviar acceso</button><button class="btn-baja" data-ac="baja">Dar de baja</button>'}
                </div>
            </div>`).join('');
        lista.innerHTML = html;
    } catch (e) {
        console.error('Accesos:', e);
        lista.innerHTML = '<p style="color: var(--rojo-alerta);">No se pudieron cargar los accesos.</p>';
    }
}

document.getElementById('close-modal-accesos').addEventListener('click', () => {
    document.getElementById('modal-accesos').style.display = 'none';
});

document.getElementById('lista-accesos').addEventListener('change', async (e) => {
    const chk = e.target.closest('input[data-perm]');
    if (!chk) return;
    const fila = chk.closest('[data-aid]');
    try {
        await updateDoc(doc(db, 'accesos_portal', fila.dataset.aid), { [chk.dataset.perm]: chk.checked });
        window.DOMINO.aviso('Permiso actualizado.');
    } catch (err) {
        console.error(err); chk.checked = !chk.checked;
        window.DOMINO.aviso('No se pudo cambiar el permiso.', 'error');
    }
});

document.getElementById('lista-accesos').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-ac]');
    if (!btn) return;
    const fila = btn.closest('[data-aid]');
    const ref = doc(db, 'accesos_portal', fila.dataset.aid);
    try {
        if (btn.dataset.ac === 'reenviar') { await window.enviarAcceso(fila.dataset.email, btn); return; }
        if (btn.dataset.ac === 'baja') {
            if (!confirm('¿Dar de baja a esta persona? Deja de entrar al portal de esta empresa.')) return;
            await updateDoc(ref, { activo: false });
        } else if (btn.dataset.ac === 'reactivar') {
            await updateDoc(ref, { activo: true });
        }
        await renderAccesos();
    } catch (err) {
        console.error(err); window.DOMINO.aviso('No se pudo completar la acción.', 'error');
    }
});

document.getElementById('form-acceso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('acc-nombre').value.trim();
    const email = document.getElementById('acc-email').value.trim().toLowerCase();
    if (!nombre || !email || !accesosEmpresa.id) return;
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    try {
        const fic = await getDoc(doc(db, 'clients', accesosEmpresa.id));
        if (fic.exists() && String(fic.data().usuario_id || '').toLowerCase() === email) {
            window.DOMINO.aviso('Ese correo ya es el titular de la empresa.', 'error'); btn.disabled = false; return;
        }
        const ref = doc(db, 'accesos_portal', idAcceso(email, accesosEmpresa.id));
        if ((await getDoc(ref)).exists()) {
            window.DOMINO.aviso('Esa persona ya figura en la lista de esta empresa.', 'error'); btn.disabled = false; return;
        }
        await setDoc(ref, {
            email, nombre, cliente_id: accesosEmpresa.id, cliente_nombre: accesosEmpresa.nombre,
            puede_subir: document.getElementById('acc-subir').checked,
            puede_descargar: document.getElementById('acc-descargar').checked,
            activo: true, creado: serverTimestamp()
        });
    } catch (err) {
        console.error(err); window.DOMINO.aviso('No se pudo guardar a la persona. Verificá tus permisos.', 'error'); btn.disabled = false; return;
    }
    try {
        const r = await window.DOMINO.crearAcceso(email);
        window.DOMINO.aviso(r === 'creado' ? `Listo. Le enviamos un correo a ${email} para que cree su clave.` : `${email} ya tenía clave. Le enviamos un correo por si quiere restablecerla.`);
    } catch (err) {
        console.error(err);
        window.DOMINO.aviso('La persona quedó cargada, pero el correo no salió: ' + window.DOMINO.textoErrorAcceso(err) + ' Usá «Reenviar acceso».', 'error');
    }
    e.target.reset(); document.getElementById('acc-subir').checked = true; btn.disabled = false;
    await renderAccesos();
});

// Acciones de tarjetas (delegadas, con datos escapados en atributos)
document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const d = el.dataset;
    if (d.act === 'expediente') abrirExpediente(d.id, d.nombre);
    else if (d.act === 'docs-tarea') { if (d.cliente) idClienteActivo = d.cliente; abrirModalDocsTarea(d.id, d.titulo); }
    else if (d.act === 'estado') abrirModalEstado(d.id, d.estado, d.titulo);
    else if (d.act === 'descargar') descargarDocumento(d.id, d.url, d.empresa, d.categoria, d.archivo);
    else if (d.act === 'acceso') enviarAcceso(d.email, el);
    else if (d.act === 'accesos') abrirAccesos(d.id, d.nombre);
    else if (d.act === 'buzon') { abrirExpediente(d.id, d.nombre); abrirBuzon(); }
});
document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-act][role="button"]')) { e.preventDefault(); e.target.click(); }
});

document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-asignar-tarea')) {
        const docId = e.target.getAttribute('data-doc-id');
        const selector = document.querySelector(`.selector-tarea[data-doc-id="${docId}"]`);
        const tareaId = selector.value;
        
        if (!tareaId) {
            alert("Seleccioná una tarea primero.");
            return;
        }
        
        try {
            await updateDoc(doc(db, "documents", docId), {
                tarea_id: tareaId
            });
            cargarDocumentosDelCliente(idClienteActivo);
        } catch (error) {
            console.error("Error al asignar tarea:", error);
        }
    }
    
    if (e.target.classList.contains('btn-agregar-doc')) {
        const docId = e.target.getAttribute('data-doc-id');
        const tareaId = e.target.getAttribute('data-tarea-id');
        
        try {
            await updateDoc(doc(db, "documents", docId), {
                tarea_id: tareaId
            });
            const tituloActual = document.getElementById('titulo-modal-docs-tarea').innerText.replace('Documentos: ', '');
abrirModalDocsTarea(tareaId, tituloActual);
abrirModalDocsDisponibles(tareaId);
        } catch (error) {
            console.error("Error al agregar documento:", error);
        }
    }
});

const closeModalDocsTarea = document.getElementById('close-modal-docs-tarea');
closeModalDocsTarea.addEventListener('click', () => 
    document.getElementById('modal-docs-tarea').style.display = 'none'
);

const closeModalDocsDisponibles = document.getElementById('close-modal-docs-disponibles');
closeModalDocsDisponibles.addEventListener('click', () => 
    document.getElementById('modal-docs-disponibles').style.display = 'none'
);

window.abrirModalDocsTarea = async function(idTarea, tituloTarea) {
    document.getElementById('titulo-modal-docs-tarea').innerText = `Documentos: ${tituloTarea}`;
    const listaDocs = document.getElementById('lista-docs-tarea');
    listaDocs.innerHTML = '<p style="color: var(--text-muted);">Cargando...</p>';
    document.getElementById('modal-docs-tarea').style.display = 'flex';

    try {
        // Traer documentos asignados a esta tarea
        const qAsignados = query(
            collection(db, "documents"),
            where("tarea_id", "==", idTarea)
        );
        
        // Traer documentos disponibles de la empresa sin tarea asignada
        const qDisponibles = query(
    collection(db, "documents"),
    where("cliente_id", "==", idClienteActivo)
);

        const [snapAsignados, snapDisponibles] = await Promise.all([
            getDocs(qAsignados),
            getDocs(qDisponibles)
        ]);

        let html = '';

        // Sección 1 — Asignados
        html += `<h4 style="color: var(--verde-ok); margin-bottom: 10px;">Documentos asignados</h4>`;
        if (snapAsignados.empty) {
            html += `<p style="color: var(--text-muted); font-size: 0.85rem;">No hay documentos asignados aún.</p>`;
        } else {
            snapAsignados.forEach((docSnap) => {
                const documento = docSnap.data();
                html += `
                    <div class="doc-item" style="margin-bottom: 8px;">
                        <div>
                            <h4>${esc(documento.nombre_archivo)}</h4>
                            <p style="color: var(--text-muted); font-size: 0.85rem;">
                                ${esc(documento.categoria)} | ${esc(documento.fecha_subida)}
                            </p>
                        </div>
                        ${documento.url_descarga ? `<a href="${esc(documento.url_descarga)}" target="_blank" rel="noopener" class="btn-action">Descargar</a>` : `<span style="font-size:0.75rem;color:var(--text-muted);">Sin archivo</span>`}
                    </div>
                `;
            });
        }

        // Sección 2 — Disponibles
if (window.rolActual !== 'asistente') {
    html += `<h4 style="color: var(--ambar-espera); margin: 20px 0 10px;">Agregar documentos</h4>`;
    html += `<button class="btn-primary" onclick="abrirModalDocsDisponibles('${esc(idTarea)}')">
        + Seleccionar documentos disponibles
    </button>`;
}

        listaDocs.innerHTML = html;

    } catch (error) {
        console.error("Error al cargar documentos de tarea:", error);
    }
}

window.abrirModalDocsDisponibles = async function(idTarea) {
    const listaDocs = document.getElementById('lista-docs-disponibles');
    listaDocs.innerHTML = '<p style="color: var(--text-muted);">Cargando...</p>';
    document.getElementById('modal-docs-disponibles').style.display = 'flex';

    try {
        const q = query(
            collection(db, "documents"),
            where("cliente_id", "==", idClienteActivo)
        );
        const querySnapshot = await getDocs(q);

        listaDocs.innerHTML = '';
        let hayDisponibles = false;

        querySnapshot.forEach((docSnap) => {
            const documento = docSnap.data();
            if (documento.tarea_id) return;
            hayDisponibles = true;
            listaDocs.innerHTML += `
                <div class="doc-item" style="margin-bottom: 8px;">
                    <div>
                        <h4>${esc(documento.nombre_archivo)}</h4>
                        <p style="color: var(--text-muted); font-size: 0.85rem;">
                            ${esc(documento.categoria)} | ${esc(documento.fecha_subida)}
                        </p>
                    </div>
                    <button class="btn-action btn-agregar-doc" 
                        data-doc-id="${esc(docSnap.id)}" 
                        data-tarea-id="${esc(idTarea)}">
                        Agregar
                    </button>
                </div>
            `;
        });

        if (!hayDisponibles) {
            listaDocs.innerHTML = "<p style='color: var(--text-muted);'>No hay documentos disponibles.</p>";
        }

    } catch (error) {
        console.error("Error al cargar documentos disponibles:", error);
    }
}

// =========================================
// MÓDULO: CHAT INTERNO
// =========================================
let unsubscribeChat = null;

let usuariosChat = [];

async function cargarUsuariosChat() {
    const querySnapshot = await getDocs(collection(db, "users"));
    usuariosChat = [];
    querySnapshot.forEach((doc) => {
        const user = doc.data();
        const rolUser = user.rol_jerarquia || '';
        if (user.nombre_display && 
            user.email !== auth.currentUser.email &&
            rolUser !== 'cliente_externo') {
            usuariosChat.push(user.nombre_display);
        }
    });
}

window.abrirChat = function() {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('panel-chat').style.display = 'flex';
    document.getElementById('badge-chat').style.display = 'none';
    document.getElementById('badge-chat').innerText = '0';
    
    if (window.innerWidth <= 768) {
        document.getElementById('main-content').style.display = 'none';
    }
    
    localStorage.setItem(`chat_visto_${auth.currentUser.uid}`, new Date().toISOString());
    cargarUsuariosChat();
    
    if (window.rolActual === 'senior') {
        document.getElementById('btn-limpiar-chat').style.display = 'block';
    }
    const inputMensaje = document.getElementById('input-mensaje');
    inputMensaje.addEventListener('input', () => {
        const texto = inputMensaje.value;
        const ultimoArroba = texto.lastIndexOf('@');
        const sugerencias = document.getElementById('sugerencias-menciones');
        
        if (ultimoArroba === -1) {
            sugerencias.style.display = 'none';
            return;
        }
        
        const busqueda = texto.slice(ultimoArroba + 1).toLowerCase();
        const filtrados = usuariosChat.filter(u => u.toLowerCase().includes(busqueda));
        
        if (filtrados.length === 0) {
            sugerencias.style.display = 'none';
            return;
        }
        
        sugerencias.innerHTML = '';
        filtrados.forEach(nombre => {
            sugerencias.innerHTML += `
 <div data-mencion="${esc(nombre)}" onclick="insertarMencion(this.dataset.mencion)" 
                    style="padding: 8px 12px; cursor: pointer; font-size: 0.85rem; color: var(--text-main);"
                    onmouseover="this.style.background='var(--bg-hover)'"
                    onmouseout="this.style.background='none'">
                    @${esc(nombre)}
                </div>
            `;
        });
        sugerencias.style.display = 'block';
    });
    
inputMensaje.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        enviarMensaje();
    }
});

    localStorage.setItem(`chat_visto_${auth.currentUser.uid}`, new Date().toISOString());cargarUsuariosChat();
    
    const q = query(collection(db, "mensajes"), orderBy("fecha_timestamp", "asc"));
    unsubscribeChat = onSnapshot(q, (snapshot) => {
        const listaMensajes = document.getElementById('lista-mensajes');
        listaMensajes.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const msg = docSnap.data();
            const esMio = msg.autor_uid === auth.currentUser.uid;
            listaMensajes.innerHTML += `
                <div style="display: flex; flex-direction: column; align-items: ${esMio ? 'flex-end' : 'flex-start'};">
                    <span style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 3px;">
                        ${esMio ? 'Vos' : esc(msg.nombre_display)} · ${esc(msg.rol)}
                    </span>
                   <div style="background: ${esMio ? 'var(--bg-hover)' : 'var(--bg-panel)'}; 
            color: var(--text-main); 
            padding: 8px 12px; border-radius: 8px; max-width: 85%; font-size: 0.85rem;">
                        ${esc(msg.texto).replace(/@(\w+\s?\w+)/g, '<span style="color: var(--ambar-espera); font-weight: 500;">@$1</span>')}
                    </div>
                </div>
            `;
        });
        listaMensajes.scrollTop = listaMensajes.scrollHeight;
    });
}

window.cerrarChat = function() {
    if (unsubscribeChat) {
        unsubscribeChat();
        unsubscribeChat = null;
    }
    document.getElementById('panel-chat').style.display = 'none';
    document.getElementById('menu').style.display = '';

    // En mobile restauramos el main
    if (window.innerWidth <= 768) {
        document.getElementById('main-content').style.display = 'block';
    }
}

window.enviarMensaje = async function() {
    const input = document.getElementById('input-mensaje');
    const texto = input.value.trim();
    if (!texto) return;
    
    try {
        await addDoc(collection(db, "mensajes"), {
            texto: texto,
            autor_uid: auth.currentUser.uid,
            nombre_display: auth.currentUser.displayName || window.nombreDisplay || 'Usuario',
            rol: window.rolActual || 'usuario',
            fecha_timestamp: serverTimestamp()
        });
        input.value = '';
    } catch (error) {
        console.error("Error al enviar mensaje:", error);
    }
}

window.insertarMencion = function(nombre) {
    const input = document.getElementById('input-mensaje');
    const texto = input.value;
    const ultimoArroba = texto.lastIndexOf('@');
    input.value = texto.slice(0, ultimoArroba) + '@' + nombre + ' ';
    document.getElementById('sugerencias-menciones').style.display = 'none';
    input.focus();
}

window.limpiarChat = async function() {
    if (!confirm("¿Estás seguro? Esto borrará todo el historial del chat.")) return;
    try {
        const querySnapshot = await getDocs(collection(db, "mensajes"));
        const borrados = querySnapshot.docs.map(d => deleteDoc(doc(db, "mensajes", d.id)));
        await Promise.all(borrados);
    } catch (error) {
        console.error("Error al limpiar chat:", error);
    }
}

async function iniciarBadgeChat() {
    const ultimaVez = localStorage.getItem(`chat_visto_${auth.currentUser.uid}`);
    if (!ultimaVez) return;
    
    const q = query(
        collection(db, "mensajes"),
        where("fecha_timestamp", ">", new Date(ultimaVez))
    );
    
    onSnapshot(q, (snapshot) => {
        const cantidad = snapshot.docs.filter(d => d.data().autor_uid !== auth.currentUser.uid).length;
        const badge = document.getElementById('badge-chat');
        if (cantidad > 0) {
            badge.innerText = cantidad;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    });
}

iniciarApp();

// Ventanas flotantes: se cierran con Esc o tocando afuera
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal').forEach((m) => { if (getComputedStyle(m).display !== 'none') m.style.display = 'none'; });
});
document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('modal')) e.target.style.display = 'none';
});
