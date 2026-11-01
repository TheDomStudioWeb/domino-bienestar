// Archivos de la demostración: quedan solo en la memoria de la pestaña.
export const getStorage = () => ({});
export const ref = (s, ruta) => ({ fullPath: String(ruta || ''), name: String(ruta || '').split('/').pop() });
const guardados = {};
export const uploadBytes = async (r, archivo) => { try { guardados[r.fullPath] = URL.createObjectURL(archivo); } catch (e) { guardados[r.fullPath] = '#'; } return { ref: r }; };
export const getDownloadURL = async (r) => guardados[r.fullPath] || '#';
export const deleteObject = async () => {};
