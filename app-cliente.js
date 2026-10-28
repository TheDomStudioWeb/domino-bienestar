import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, doc, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getAuth, onAuthStateChanged,signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Tu misma configuración de Firebase (Ambas apps apuntan al mismo motor)
const firebaseConfig = {
  apiKey: "AIzaSyB0y7cFZ-HnGrasLsg-HTeWXvenZSZzSpQ",
  authDomain: "domino-bienestar.firebaseapp.com",
  projectId: "domino-bienestar",
  storageBucket: "domino-bienestar.firebasestorage.app",
  messagingSenderId: "68194219142",
  appId: "1:68194219142:web:cf68e1a910584c963f4d07"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

window.cerrarSesionCliente = async function() {
    if (confirm("¿Estás seguro que querés cerrar sesión?")) {
        await signOut(auth);
        window.location.replace('login-cliente.html');
    }
}

// Permisos por empresa: el titular (usuario_id de la ficha) lo puede todo; las demás personas de la empresa
// entran por accesos_portal con permisos propios (enviar documentos / ver y descargar lo entregado).
const PERMISOS = {};
let ID_CLIENTE = null;

function aplicarPermisos() {
    const p = PERMISOS[ID_CLIENTE] || { subir: false, descargar: false };
    const cardSubir = document.querySelector('.upload-card');
    if (cardSubir) cardSubir.style.display = p.subir ? '' : 'none';
    const bloque = document.getElementById('bloque-entregas');
    if (bloque) bloque.style.display = p.descargar ? '' : 'none';
    const aviso = document.getElementById('aviso-permisos');
    if (aviso) {
        const faltan = [];
        if (!p.subir) faltan.push('enviar documentos');
        if (!p.descargar) faltan.push('ver lo que entrega el centro');
        aviso.style.display = faltan.length ? 'block' : 'none';
        aviso.textContent = faltan.length ? 'Su usuario no tiene habilitado: ' + faltan.join(' ni ') + '. Si lo necesita, pídaselo al centro.' : '';
    }
}

async function cargarEmpresasCliente(usuarioId) {
    const selector = document.getElementById('selector-empresas-cliente');
    try {
        const empresas = [];
        const vistas = new Set();

        // 1) Empresas de las que es titular
        const titular = await getDocs(query(collection(db, "clients"), where("usuario_id", "==", usuarioId)));
        titular.forEach((d) => {
            vistas.add(d.id);
            PERMISOS[d.id] = { subir: true, descargar: true };
            empresas.push({ id: d.id, nombre: d.data().nombre_empresa });
        });

        // 2) Empresas a las que fue habilitado con permisos propios
        let habilitado = { docs: [] };
        try {
            habilitado = await getDocs(query(collection(db, "accesos_portal"), where("email", "==", usuarioId)));
        } catch (err) { console.error("Accesos del portal no disponibles:", err); } // el titular entra igual
        for (const a of habilitado.docs) {
            const x = a.data();
            if (x.activo !== true || vistas.has(x.cliente_id)) continue;
            try {
                const ficha = await getDoc(doc(db, "clients", x.cliente_id));
                if (!ficha.exists()) continue;
                vistas.add(x.cliente_id);
                PERMISOS[x.cliente_id] = { subir: x.puede_subir === true, descargar: x.puede_descargar === true };
                empresas.push({ id: x.cliente_id, nombre: ficha.data().nombre_empresa });
            } catch (err) { console.error("Empresa no accesible:", x.cliente_id, err); }
        }

        if (!empresas.length) {
            selector.style.display = 'none';
            ID_CLIENTE = null;
            return;
        }

        ID_CLIENTE = empresas[0].id;
        if (empresas.length === 1) {
            selector.style.display = 'none';
        } else {
            selector.innerHTML = '';
            empresas.forEach((e) => {
                const op = document.createElement('option');
                op.value = e.id;
                op.textContent = e.nombre; // textContent: el nombre no se interpreta como HTML
                selector.appendChild(op);
            });
            selector.style.display = 'block';
            selector.addEventListener('change', () => {
                ID_CLIENTE = selector.value;
                aplicarPermisos();
                if ((PERMISOS[ID_CLIENTE] || {}).descargar) cargarEntregas('recientes');
            });
        }
    } catch (error) {
        console.error("Error al cargar empresas:", error);
    }
}

onAuthStateChanged(auth, async (usuario) => {
    if (!usuario) {
        window.location.replace('login-cliente.html');
        return;
    }
    const usuarioId = usuario.email;
    await cargarEmpresasCliente(usuarioId);
    if (!ID_CLIENTE) {
        document.getElementById('lista-entregas').innerHTML = "<p style='color: var(--text-muted);'>Su usuario todavía no tiene una ficha de socio asignada. Comuníquese con el centro.</p>";
        document.getElementById('form-cliente-subir').style.display = 'none';
        return;
    }
    aplicarPermisos();
    if ((PERMISOS[ID_CLIENTE] || {}).descargar) cargarEntregas('recientes');
});

const formCliente = document.getElementById('form-cliente-subir');
const mensajeExito = document.getElementById('mensaje-exito');

// ID_CLIENTE (empresa activa) se declara arriba, junto con los permisos.

formCliente.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!ID_CLIENTE || !(PERMISOS[ID_CLIENTE] || {}).subir) return;

    const categoria = document.getElementById('cliente-categoria').value;
    const archivoInput = document.getElementById('cliente-archivo');
    const archivos = archivoInput.files;
    const fechaHoy = new Date().toLocaleDateString('es-ES');

    try {
        const btnSubmit = formCliente.querySelector('.btn-primary');
        btnSubmit.innerText = "Subiendo...";
        btnSubmit.disabled = true;

        for (const archivo of archivos) {
            const nombreArchivo = archivo.name;
            const storageRef = ref(storage, `documentos/${ID_CLIENTE}/${new Date().toISOString().slice(0, 10)}/${Date.now()}_${nombreArchivo}`);
            await uploadBytes(storageRef, archivo);
            const downloadURL = await getDownloadURL(storageRef);
            await addDoc(collection(db, "documents"), {
                cliente_id: ID_CLIENTE,
                categoria: categoria,
                nombre_archivo: nombreArchivo,
                fecha_subida: fechaHoy,
                estado: "Pendiente de Procesar",
                url_descarga: downloadURL
            });
        }

        formCliente.reset();
        formCliente.style.display = 'none';
        mensajeExito.style.display = 'block';
        btnSubmit.innerText = "Subir y avisar al centro";
        btnSubmit.disabled = false;

    setTimeout(() => {
    mensajeExito.style.display = 'none';
    formCliente.style.display = 'block';
}, 3000);

    } catch (error) {
        alert("Hubo un error al enviar el documento.");
        console.error(error);
    }
});

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
async function cargarEntregas(filtro = 'recientes', orden = 'reciente') {
    const listaEntregas = document.getElementById('lista-entregas');
    listaEntregas.innerHTML = "<p style='color: var(--text-muted);'>Cargando...</p>";
    
    try {
        const ahora = new Date();
        const hace30dias = new Date();
        hace30dias.setDate(ahora.getDate() - 30);
        const limite = Timestamp.fromDate(hace30dias);

        let q;
        if (filtro === 'recientes') {
            q = query(
                collection(db, "entregas"),
                where("cliente_id", "==", ID_CLIENTE),
                where("fecha_timestamp", ">=", limite)
            );
        } else {
            q = query(
                collection(db, "entregas"),
                where("cliente_id", "==", ID_CLIENTE),
                where("fecha_timestamp", "<", limite)
            );
        }

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            listaEntregas.innerHTML = "<p style='color: var(--text-muted);'>No hay documentos en esta sección.</p>";
            return;
        }

        listaEntregas.innerHTML = '';
        let entregas = [];
querySnapshot.forEach((doc) => {
    entregas.push({ id: doc.id, ...doc.data() });
});

entregas.sort((a, b) => {
    const fechaA = a.fecha_timestamp?.toDate() || new Date(0);
    const fechaB = b.fecha_timestamp?.toDate() || new Date(0);
    return orden === 'antiguo' ? fechaA - fechaB : fechaB - fechaA;
});

entregas.forEach((entrega) => {
    listaEntregas.innerHTML += `
        <div class="doc-item" style="margin-bottom: 10px;">
            <div>
                <h4>${esc(entrega.nombre_archivo)}</h4>
                <p style="color: var(--text-muted); font-size: 0.85rem;">
                    ${esc(entrega.categoria)} | ${esc(entrega.fecha_envio)}
                </p>
            </div>
            <a href="${esc(entrega.url_descarga)}" target="_blank" rel="noopener" class="btn-activar">
                Descargar
            </a>
        </div>
    `;
});
    } 
    catch (error) {
        console.error("Error al cargar entregas:", error);
        listaEntregas.innerHTML = "<p style='color: var(--rojo-alerta);'>Error al cargar documentos.</p>";
    }
}

window.filtrarEntregas = function(filtro) {
    document.getElementById('btn-recientes').className = filtro === 'recientes' ? 'btn-primary' : 'btn-secundario';
    document.getElementById('btn-historicos').className = filtro === 'historicos' ? 'btn-primary' : 'btn-secundario';
    cargarEntregas(filtro);
}

window.filtrarEntregasFecha = function(orden) {
    document.getElementById('pill-reciente').className = orden === 'reciente' ? 'btn-primary' : 'btn-secundario';
    document.getElementById('pill-antiguo').className = orden === 'antiguo' ? 'btn-primary' : 'btn-secundario';
    cargarEntregas('recientes', orden);
}

setInterval(() => {
    cargarEntregas('recientes');
}, 15 * 60 * 1000);