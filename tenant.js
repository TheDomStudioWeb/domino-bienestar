// DOMino Bienestar · Un negocio por cuenta, todos en la misma app.
// Los datos de cada gimnasio viven bajo  negocios/{id}/…  y nadie ve los de otro negocio (lo garantizan las reglas de Firestore).
// Este archivo reemplaza collection() y doc() para que el resto del código siga escribiendo  collection(db, "clients")  como siempre:
// si la colección es de negocio, agrega la ruta negocios/{id}/ por delante. Las demás (users, negocios, superadmins) quedan igual.
import { collection as _collection, doc as _doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const COLECCIONES_NEGOCIO = ['clients', 'tasks', 'documents', 'entregas', 'accesos_portal', 'mensajes', 'config'];

// Negocio activo: el que fijó la sesión del personal (app.js) o, en el portal del socio, el de la dirección (?n=…).
export function negocioActual() {
  if (window.DOMINO_NID) return window.DOMINO_NID;
  try {
    const q = new URLSearchParams(location.search).get('n');
    if (q && /^[a-z0-9-]{3,60}$/.test(q)) { localStorage.setItem('domino_nid', q); return q; }
    const g = localStorage.getItem('domino_nid');
    if (g && /^[a-z0-9-]{3,60}$/.test(g)) return g;
  } catch (e) { /* sin almacenamiento */ }
  return '';
}
export function fijarNegocio(id) { window.DOMINO_NID = id; try { localStorage.setItem('domino_nid', id); } catch (e) {} }

function ruta(segs) {
  if (typeof segs[0] === 'string' && COLECCIONES_NEGOCIO.includes(segs[0])) {
    const n = negocioActual();
    if (!n) throw Object.assign(new Error('Falta el negocio de esta sesión'), { code: 'sin-negocio' });
    return ['negocios', n, ...segs];
  }
  return segs;
}
const esReferencia = (a) => a && (a.type === 'collection' || a.type === 'document');
export const collection = (a, ...segs) => esReferencia(a) ? _collection(a, ...segs) : _collection(a, ...ruta(segs));
export const doc = (a, ...segs) => esReferencia(a) ? _doc(a, ...segs) : _doc(a, ...ruta(segs));
