// Base local de la demostración: imita lo que las pantallas usan de Firestore, con datos de ejemplo (seed.js).
import { SEED } from './seed.js';
const KEY = 'domino_demo_db_' + SEED.id;

export class Timestamp {
  constructor(ms) { this._ms = ms; this.seconds = Math.floor(ms / 1000); this.nanoseconds = (ms % 1000) * 1e6; }
  toMillis() { return this._ms; } toDate() { return new Date(this._ms); }
  static now() { return new Timestamp(Date.now()); } static fromDate(d) { return new Timestamp(d.getTime()); } static fromMillis(m) { return new Timestamp(m); }
}
const esTs = (v) => v && typeof v === 'object' && v.__t !== undefined;
const SERVER = { __sentinel: 'server' };
export const serverTimestamp = () => SERVER;
export const arrayUnion = (...v) => ({ __sentinel: 'union', v });
export const arrayRemove = (...v) => ({ __sentinel: 'remove', v });
export const increment = (n) => ({ __sentinel: 'inc', n });
export const deleteField = () => ({ __sentinel: 'del' });

let db = null;
const cargar = () => {
  if (db) return db;
  try { const t = localStorage.getItem(KEY); if (t) { db = JSON.parse(t); return db; } } catch (e) {}
  db = JSON.parse(JSON.stringify(SEED.docs)); guardar(); return db;
};
const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };

const cod = (v) => {
  if (v instanceof Timestamp) return { __t: v._ms };
  if (v instanceof Date) return { __t: v.getTime() };
  if (Array.isArray(v)) return v.map(cod);
  if (v && typeof v === 'object' && !v.__sentinel && !esTs(v)) { const r = {}; for (const k in v) r[k] = cod(v[k]); return r; }
  return v;
};
const dec = (v) => {
  if (esTs(v)) return new Timestamp(v.__t);
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === 'object') { const r = {}; for (const k in v) r[k] = dec(v[k]); return r; }
  return v;
};
const campo = (o, ruta) => String(ruta).split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const ponerCampo = (o, ruta, v) => { const p = String(ruta).split('.'); let a = o; for (let i = 0; i < p.length - 1; i++) { if (typeof a[p[i]] !== 'object' || a[p[i]] === null) a[p[i]] = {}; a = a[p[i]]; } if (v && v.__sentinel === 'del') delete a[p[p.length - 1]]; else a[p[p.length - 1]] = v; };
const resolver = (previo, k, v) => {
  if (v && v.__sentinel === 'server') return { __t: Date.now() };
  if (v && v.__sentinel === 'union') { const a = Array.isArray(previo) ? previo.slice() : []; v.v.forEach(x => { if (!a.some(y => JSON.stringify(y) === JSON.stringify(cod(x)))) a.push(cod(x)); }); return a; }
  if (v && v.__sentinel === 'remove') return (Array.isArray(previo) ? previo : []).filter(y => !v.v.some(x => JSON.stringify(y) === JSON.stringify(cod(x))));
  if (v && v.__sentinel === 'inc') return (Number(previo) || 0) + v.n;
  return v;
};
const aplicar = (base, datos, fusionar) => {
  const r = fusionar ? base : {};
  for (const k in datos) { const v = datos[k]; if (v && v.__sentinel === 'del') { ponerCampo(r, k, v); continue; } ponerCampo(r, k, resolver(campo(r, k), k, cod(v))); }
  return r;
};

export const getFirestore = () => ({ __db: true });
const trozos = (a) => a.flatMap(s => String(s).split('/')).filter(Boolean);
const rnd = () => 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
export const collection = (base, ...s) => ({ type: 'collection', path: ((base && base.path ? [base.path] : []).concat(trozos(s))).join('/') });
export const doc = (base, ...s) => {
  const t = trozos(s);
  if (base && base.type === 'collection' && !t.length) t.push(rnd());
  const p = ((base && base.path ? [base.path] : []).concat(t)).join('/');
  return { type: 'document', path: p, id: p.split('/').pop(), parent: { path: p.split('/').slice(0, -1).join('/') } };
};
export const where = (f, op, v) => ({ t: 'w', f, op, v });
export const orderBy = (f, d) => ({ t: 'o', f, d: d || 'asc' });
export const limit = (n) => ({ t: 'l', n });
export const query = (c, ...cs) => ({ type: 'query', path: c.path, cs: (c.cs || []).concat(cs) });

const aNum = (v) => (v && v.toMillis ? v.toMillis() : v);
const cmp = (a, b) => { a = aNum(a); b = aNum(b); return a === b ? 0 : (a === undefined || a === null) ? -1 : (b === undefined || b === null) ? 1 : a < b ? -1 : 1; };
const cumple = (d, c) => {
  const x = aNum(campo(d, c.f)), v = aNum(c.v);
  switch (c.op) {
    case '==': return x === v; case '!=': return x !== v;
    case '<': return x < v; case '<=': return x <= v; case '>': return x > v; case '>=': return x >= v;
    case 'in': return (c.v || []).some(y => aNum(y) === x); case 'not-in': return !(c.v || []).some(y => aNum(y) === x);
    case 'array-contains': return Array.isArray(campo(d, c.f)) && campo(d, c.f).some(y => JSON.stringify(y) === JSON.stringify(c.v));
    case 'array-contains-any': return Array.isArray(campo(d, c.f)) && campo(d, c.f).some(y => (c.v || []).some(z => JSON.stringify(y) === JSON.stringify(z)));
  }
  return true;
};
const snapDoc = (path) => { const d = cargar()[path]; const id = path.split('/').pop(); const ref = doc({ path: path.split('/').slice(0, -1).join('/'), type: 'collection' }, id);
  return { id, ref, exists: () => d !== undefined, data: () => (d === undefined ? undefined : dec(d)), get: (f) => (d === undefined ? undefined : dec(campo(d, f))) }; };
const ejecutar = (q) => {
  const base = cargar(), pre = q.path + '/';
  let ids = Object.keys(base).filter(k => k.startsWith(pre) && k.slice(pre.length).indexOf('/') < 0);
  let docs = ids.map(k => ({ k, d: base[k] }));
  const cs = q.cs || [];
  cs.filter(c => c.t === 'w').forEach(c => { docs = docs.filter(x => cumple(x.d, c)); });
  cs.filter(c => c.t === 'o').slice().reverse().forEach(c => { docs.sort((a, b) => (c.d === 'desc' ? -1 : 1) * cmp(campo(a.d, c.f), campo(b.d, c.f))); });
  const l = cs.find(c => c.t === 'l'); if (l) docs = docs.slice(0, l.n);
  const ds = docs.map(x => snapDoc(x.k));
  return { docs: ds, empty: ds.length === 0, size: ds.length, forEach: (f) => ds.forEach(f), docChanges: () => ds.map(d => ({ type: 'added', doc: d })) };
};

const oyentes = [];
const avisar = () => oyentes.slice().forEach(o => { try { o.f(); } catch (e) { console.error(e); } });
export const getDocs = async (q) => ejecutar(q);
export const getDoc = async (r) => snapDoc(r.path);
export const addDoc = async (c, datos) => { const id = rnd(); cargar()[c.path + '/' + id] = aplicar({}, datos, false); guardar(); avisar(); return doc(c, id); };
export const setDoc = async (r, datos, op) => { const b = cargar(); b[r.path] = aplicar(op && op.merge ? (b[r.path] || {}) : {}, datos, !!(op && op.merge)); guardar(); avisar(); };
export const updateDoc = async (r, datos) => { const b = cargar(); if (!b[r.path]) throw Object.assign(new Error('No existe'), { code: 'not-found' }); aplicar(b[r.path], datos, true); guardar(); avisar(); };
export const deleteDoc = async (r) => { delete cargar()[r.path]; guardar(); avisar(); };
export const onSnapshot = (x, ok, err) => {
  const f = () => ok(x.type === 'document' ? snapDoc(x.path) : ejecutar(x));
  const o = { f }; oyentes.push(o); setTimeout(f, 0);
  return () => { const i = oyentes.indexOf(o); if (i >= 0) oyentes.splice(i, 1); };
};
export const writeBatch = () => { const ops = [];
  return { set: (r, d, o) => ops.push(() => setDoc(r, d, o)), update: (r, d) => ops.push(() => updateDoc(r, d)), delete: (r) => ops.push(() => deleteDoc(r)), commit: async () => { for (const f of ops) await f(); } }; };
export const collectionGroup = (db, id) => ({ type: 'query', path: '__grupo__' + id, cs: [] });
