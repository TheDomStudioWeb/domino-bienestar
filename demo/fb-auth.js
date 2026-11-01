import { SEED } from './seed.js';
const U = 'domino_demo_user';
const detectores = [];
const leer = () => { try { return sessionStorage.getItem(U) || ''; } catch (e) { return ''; } };
const auth = { currentUser: null };
const refrescar = () => {
  const mail = leer(), u = (SEED.users || []).find(x => x.email === mail);
  auth.currentUser = mail ? { email: mail, uid: 'demo-' + mail, displayName: u ? u.nombre_display : mail, getIdToken: async () => 'demo' } : null;
};
refrescar();
export const getAuth = () => auth;
export const initializeAuth = () => auth;
export const inMemoryPersistence = {}; export const browserLocalPersistence = {}; export const browserSessionPersistence = {};
export const setPersistence = async () => {};
export const onAuthStateChanged = (a, cb) => { detectores.push(cb); setTimeout(() => cb(auth.currentUser), 0); return () => { const i = detectores.indexOf(cb); if (i >= 0) detectores.splice(i, 1); }; };
export const signInWithEmailAndPassword = async (a, email) => { try { sessionStorage.setItem(U, String(email || '').toLowerCase()); } catch (e) {} refrescar(); detectores.forEach(f => f(auth.currentUser)); return { user: auth.currentUser }; };
export const createUserWithEmailAndPassword = async (a, email) => ({ user: { email: String(email || '').toLowerCase(), uid: 'demo-' + email } });
export const sendPasswordResetEmail = async () => {};
export const signOut = async () => { try { sessionStorage.removeItem(U); sessionStorage.removeItem('domino_demo'); } catch (e) {} refrescar(); detectores.forEach(f => f(null)); };
