// Vínculo con las fichas de DOMino Profesional (Firestore). Usa la sesión del Hub: mismo sitio, misma sesión.
// Si no hay sesión (o Firebase no carga), el panel de turnos sigue funcionando sin esta parte.
const CFG = { apiKey: "AIzaSyB0y7cFZ-HnGrasLsg-HTeWXvenZSZzSpQ", authDomain: "domino-bienestar.firebaseapp.com", projectId: "domino-bienestar", storageBucket: "domino-bienestar.firebasestorage.app", messagingSenderId: "68194219142", appId: "1:68194219142:web:cf68e1a910584c963f4d07" };
const V = '10.8.0', base = `https://www.gstatic.com/firebasejs/${V}/`;
let F = null, estado = null;

export async function conectar() {
  if (estado) return estado;
  estado = (async () => {
    try {
      const [app, auth, fs] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);
      const a = app.initializeApp(CFG), au = auth.getAuth(a);
      const user = await new Promise(res => { const off = auth.onAuthStateChanged(au, u => { off(); res(u); }); setTimeout(() => res(null), 6000); });
      if (!user) return { ok: false, motivo: 'sin_sesion' };
      F = { fs, user, db: fs.getFirestore(a), email: String(user.email || '').toLowerCase() };
      return { ok: true, email: F.email };
    } catch (e) { console.warn('Fichas: no disponible', e); return { ok: false, motivo: 'sin_firebase' }; }
  })();
  return estado;
}
export async function idToken() { const c = await conectar(); return c.ok && F.user ? F.user.getIdToken() : ''; }
const NID = () => { try { return window.DOMINO_NID || localStorage.getItem('domino_nid') || ''; } catch (e) { return ''; } };
const dig = s => String(s || '').replace(/\D/g, '');
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// Todas las fichas activas (para sugerir y para buscar a mano).
export async function todas() {
  const { fs, db } = F, snap = await fs.getDocs(fs.query(fs.collection(db, 'negocios', NID(), 'clients'), fs.where('estado', '==', 'activo'))), out = [];
  snap.forEach(d => { const c = d.data(); out.push({ id: d.id, nombre: String(c.nombre_empresa || ''), telefono: String(c.telefono || ''), mascotas: (c.mascotas || []).map(m => m.nombre).join(', ') }); });
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}
// Parecidas al turno: mismo teléfono (últimos 7 dígitos) o nombre parecido.
export function parecidas(lista, nombre, tel) {
  const t = dig(tel).slice(-7), n = norm(nombre), out = [];
  lista.forEach(c => {
    const nc = norm(c.nombre), tc = dig(c.telefono).slice(-7), mismoTel = t.length >= 7 && tc === t;
    const parecido = n.length > 2 && nc && (nc.includes(n) || n.includes(nc) || n.split(' ').filter(x => x.length > 2).some(x => nc.includes(x)));
    if (mismoTel || parecido) out.push({ ...c, exacto: mismoTel });
  });
  return out.sort((a, b) => (b.exacto - a.exacto) || a.nombre.localeCompare(b.nombre)).slice(0, 6);
}
// Búsqueda manual por nombre o teléfono.
export function buscar(lista, q) {
  const n = norm(q), d = dig(q); if (!n) return lista.slice(0, 8);
  return lista.filter(c => norm(c.nombre).includes(n) || (d.length >= 3 && dig(c.telefono).includes(d)) || norm(c.mascotas).includes(n)).slice(0, 8);
}
export async function nombreDe(id) {
  try { const { fs, db } = F; const s = await fs.getDoc(fs.doc(db, 'negocios', NID(), 'clients', id)); return s.exists() ? (s.data().nombre_empresa || '') : ''; } catch (e) { return ''; }
}
export async function crearFicha({ nombre, tel, email, sujeto_nombre, sujeto_tipo }) {
  const { fs, db } = F;
  const datos = { nombre_empresa: String(nombre).trim(), cuit: '', estado: 'activo', fecha_creacion: new Date().toISOString(), usuario_id: '', telefono: String(tel || '').trim(), email_contacto: String(email || '').trim().toLowerCase(), origen: 'turnos', mascotas: sujeto_nombre ? [{ nombre: sujeto_nombre, tipo: sujeto_tipo || 'Perro' }] : [] };
  const r = await fs.addDoc(fs.collection(db, 'negocios', NID(), 'clients'), datos); return { id: r.id, nombre: datos.nombre_empresa };
}
export async function sumarMascota(id, sujeto_nombre, sujeto_tipo) {
  if (!sujeto_nombre) return;
  const { fs, db } = F, ref = fs.doc(db, 'negocios', NID(), 'clients', id), s = await fs.getDoc(ref); if (!s.exists()) return;
  const ya = (s.data().mascotas || []).some(m => norm(m.nombre) === norm(sujeto_nombre));
  if (!ya) await fs.updateDoc(ref, { mascotas: fs.arrayUnion({ nombre: sujeto_nombre, tipo: sujeto_tipo || 'Perro' }) });
}

export const mismaPersona = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
// Otras personas que usan la ficha (familiares, vecinos...). El responsable es el nombre de la ficha.
export async function sumarPersona(id, nombre, relacion, tel) {
  const { fs, db } = F, ref = fs.doc(db, 'negocios', NID(), 'clients', id), s = await fs.getDoc(ref); if (!s.exists()) return;
  const c = s.data(); if (mismaPersona(c.nombre_empresa, nombre) || (c.personas || []).some(p => mismaPersona(p.nombre, nombre))) return;
  await fs.updateDoc(ref, { personas: fs.arrayUnion({ nombre: String(nombre).trim(), relacion: String(relacion || '').trim(), telefono: String(tel || '').trim() }) });
}

export async function datosDe(id) {
  try { const { fs, db } = F; const s = await fs.getDoc(fs.doc(db, 'negocios', NID(), 'clients', id)); if (!s.exists()) return null; const c = s.data(); return { nombre: c.nombre_empresa || '', telefono: c.telefono || '', email: c.email_contacto || '' }; } catch (e) { return null; }
}
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const difDias = s => Math.round((new Date(s + 'T12:00:00') - new Date(hoyISO() + 'T12:00:00')) / 86400000);
// Controles de la libreta que vencieron (hasta 90 días atrás) o vencen en los próximos `ventana` días, sin turno ya agendado
// y sin un registro más nuevo del mismo tipo para esa mascota.
export async function controles(ventana = 30) {
  const { fs, db } = F, snap = await fs.getDocs(fs.query(fs.collection(db, 'negocios', NID(), 'clients'), fs.where('estado', '==', 'activo'))), out = [];
  snap.forEach(d => { const c = d.data(); (c.mascotas || []).forEach(m => { const ls = m.libreta || []; ls.forEach(e => {
    if (!e.proxima || e.agendado) return; const n = difDias(e.proxima); if (n > ventana || n < -90) return;
    if (ls.some(o => o !== e && o.tipo === e.tipo && (o.fecha || '') > (e.fecha || ''))) return;
    out.push({ cid: d.id, dueno: c.nombre_empresa || '', tel: c.telefono || '', mascota: m.nombre, tipo: m.tipo || 'Perro', control: e.tipo, proxima: e.proxima, reg: e.id, dias: n });
  }); }); });
  return out.sort((a, b) => a.proxima.localeCompare(b.proxima));
}
export async function marcarAgendado(cid, mascota, regId, fecha) {
  const { fs, db } = F, ref = fs.doc(db, 'negocios', NID(), 'clients', cid), s = await fs.getDoc(ref); if (!s.exists()) return;
  const m = (s.data().mascotas || []).map(x => x.nombre === mascota ? { ...x, libreta: (x.libreta || []).map(e => e.id === regId ? { ...e, agendado: fecha } : e) } : x);
  await fs.updateDoc(ref, { mascotas: m });
}
