import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB0y7cFZ-HnGrasLsg-HTeWXvenZSZzSpQ",
  authDomain: "domino-bienestar.firebaseapp.com",
  projectId: "domino-bienestar",
  storageBucket: "domino-bienestar.firebasestorage.app",
  messagingSenderId: "68194219142",
  appId: "1:68194219142:web:cf68e1a910584c963f4d07"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Ingreso "líquido" (dom-login.js): el botón se divide en los campos y al entrar se vuelve a unir
const mensajeError = (e) => {
    const c = (e && e.code) || '';
    if (c.includes('too-many-requests')) return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
    if (c.includes('network')) return 'No hay conexión. Revisá internet y probá de nuevo.';
    if (c.includes('invalid-email')) return 'El correo no tiene un formato válido.';
    return 'Credenciales incorrectas. Verificá tu email y contraseña.';
};
window.__dl = window.DomLogin.mount(document.getElementById('dl-host'), {
    campos: [
        { nombre: 'email', etiqueta: 'Correo electrónico', tipo: 'email', autocomplete: 'username' },
        { nombre: 'clave', etiqueta: 'Contraseña', tipo: 'password', autocomplete: 'current-password' }
    ],
    boton: 'Ingresar', enviando: 'Ingresando…', listo: 'Bienvenido',
    enviar: async (v) => {
        try {
            await setPersistence(auth, browserLocalPersistence);
            await signInWithEmailAndPassword(auth, v.email, v.clave);
        } catch (error) { console.error(error); throw new Error(mensajeError(error)); }
    },
    hecho: () => window.location.replace('index.html')
});

document.getElementById('link-recuperar').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = (window.__dl.valores().email || '').trim();
    if (!email) {
        window.__dl.abrir();
        alert("Escribí tu correo y volvé a tocar «¿Olvidaste tu contraseña?».");
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        alert("Te enviamos un email para restablecer tu contraseña.");
    } catch (error) {
        alert("Error al enviar el email. Verificá que el email sea correcto.");
    }
});