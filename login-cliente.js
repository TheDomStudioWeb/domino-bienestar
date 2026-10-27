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

document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const errorMsg = document.getElementById('login-error-msg');
    const btnLogin = document.getElementById('btn-login');

    if (!email || !password) {
        errorMsg.innerText = "Completá todos los campos.";
        errorDiv.style.display = 'block';
        return;
    }

    try {
        btnLogin.innerText = "Ingresando...";
        btnLogin.disabled = true;

        await setPersistence(auth, browserLocalPersistence);
        await signInWithEmailAndPassword(auth, email, password);
        window.location.replace('portal-cliente.html');

    } catch (error) {
        btnLogin.innerText = "Ingresar";
        btnLogin.disabled = false;
        errorMsg.innerText = "Credenciales incorrectas. Verificá tu email y contraseña.";
        errorDiv.style.display = 'block';
        console.error(error);
    }
});

document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('btn-login').click();
    }
});

window.togglePassword = function() {
    const input = document.getElementById('login-password');
    const btn = document.getElementById('btn-ojo');
    if (input.type === 'password') {
        input.type = 'text';
        btn.style.opacity = '1';
    } else {
        input.type = 'password';
        btn.style.opacity = '0.5';
    }
}
document.getElementById('link-recuperar').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    if (!email) {
        alert("Ingresá tu email primero.");
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        alert("Te enviamos un email para restablecer tu contraseña.");
    } catch (error) {
        alert("Error al enviar el email. Verificá que el email sea correcto.");
    }
});