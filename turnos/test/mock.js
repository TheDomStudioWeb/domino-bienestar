// Simulación mínima de los servicios de Apps Script para probar Code.gs en Node
const crypto = require('crypto'), fs = require('fs'), vm = require('vm');
function crear(datosIniciales) {
  const libros = JSON.parse(JSON.stringify(datosIniciales)); // {hoja: [[...],[...]]}
  const props = {}, cache = {}, correos = []; let ahora = Date.now(); let lockTomado = false;
  const hojaDe = (L, n) => {
    if (!L[n]) return null;
    const v = () => L[n];
    const lim = x => (typeof x === 'string' && x[0] === "'") ? x.slice(1) : x;
    const api = {
      getDataRange: () => ({ getValues: () => v().map(r => r.slice()) }),
      getLastRow: () => v().length, getLastColumn: () => Math.max(0, ...v().map(r => r.length)),
      getRange: (f, c, nf = 1, nc = 1) => ({
        getValues: () => { const o = []; for (let i = 0; i < nf; i++) { const r = []; for (let j = 0; j < nc; j++) r.push((v()[f - 1 + i] || [])[c - 1 + j] ?? ''); o.push(r); } return o; },
        setValues: vals => vals.forEach((r, i) => r.forEach((x, j) => { while (v().length < f + i) v().push([]); v()[f - 1 + i][c - 1 + j] = lim(x); })),
        setValue: x => { while (v().length < f) v().push([]); v()[f - 1][c - 1] = lim(x); },
        getValue: () => (v()[f - 1] || [])[c - 1] ?? ''
      }),
      appendRow: r => v().push(r.map(lim)), deleteRow: i => v().splice(i - 1, 1)
    };
    return api;
  };
  const extra = {}, fsDocs = {}; let nExtra = 0, fetches = 0;
  const hoja = n => hojaDe(libros, n);
  const ssDe = (L, id) => ({ getSheetByName: n => hojaDe(L, n), getId: () => id, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id, getSheets: () => Object.keys(L).map(k => Object.assign(hojaDe(L, k), { setName: nn => { L[nn] = L[k]; delete L[k]; return hojaDe(L, nn); } })), insertSheet: n => { L[n] = [[]]; L[n].length = 0; return hojaDe(L, n); } });
  const ctx = {
    console, Date, JSON, Math, Object, String, Number, Array, Error, Boolean, RegExp, Promise,
    SpreadsheetApp: { getActiveSpreadsheet: () => ssDe(libros, 'ACTIVA'), openById: id => { if (!extra[id]) throw new Error('sin libro ' + id); return ssDe(extra[id], id); }, create: nombre => { const id = 'LIBRO' + (++nExtra); extra[id] = { Sheet1: [] }; return ssDe(extra[id], id); } },
    UrlFetchApp: { fetch: (url, o) => { fetches++; const tok = (o.headers.Authorization || '').replace('Bearer ', ''); const ruta = decodeURIComponent(url.split('/documents/')[1]); const d = fsDocs[tok + '|' + ruta] || fsDocs['*|' + ruta]; if (!fsDocs[tok + '|ok'] ) return { getResponseCode: () => 401, getContentText: () => '{}' }; if (!d) return { getResponseCode: () => 404, getContentText: () => '{}' }; const f = {}; Object.keys(d).forEach(k => { const x = d[k]; f[k] = typeof x === 'boolean' ? { booleanValue: x } : { stringValue: String(x) }; }); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ fields: f }) }; } },
    Logger: { log: () => {} },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (lockTomado) return false; lockTomado = true; return true; }, waitLock: () => { lockTomado = true; }, releaseLock: () => { lockTomado = false; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, x) => { cache[k] = x; }, remove: k => { delete cache[k]; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, x) => { props[k] = x; } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ t, setMimeType() { return this; }, getContent() { return t; } }) },
    Session: { getScriptTimeZone: () => 'America/Argentina/Mendoza' },
    MailApp: { sendEmail: (a, s, c) => correos.push({ a, s, c }), getRemainingDailyQuota: () => 100 },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create() {} }) }) }) }), deleteTrigger() {} },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      base64EncodeWebSafe: b => Buffer.from(b).toString('base64url').replace(/=+$/, '') + '==',
      base64DecodeWebSafe: s => [...Buffer.from(s, 'base64url')],
      computeHmacSha256Signature: (t, k) => [...crypto.createHmac('sha256', String(k)).update(String(t)).digest()],
      newBlob: x => ({ getBytes: () => [...Buffer.from(x)], getDataAsString: () => Buffer.from(x).toString() }),
      formatDate: (d, tz, fmt) => { const p = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d); return fmt === 'yyyy-MM-dd HH:mm' ? p : fmt === 'HH:mm' ? p.slice(11) : p.slice(0, 10); }
    }
  };
  // Date controlable
  const RealDate = Date;
  ctx.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(ahora); } static now() { return ahora; } };
  ctx.Date.UTC = RealDate.UTC;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + '/../apps-script/Code.gs', 'utf8') + '\n;globalThis.__api={doPost,doGet,prepararWidget,enviarRecordatorios,protegerClaves};', ctx);
  const llamar = p => JSON.parse(ctx.__api.doPost({ postData: { contents: JSON.stringify(p) } }).getContent());
  return { fsDocs, extra, fetchesN: () => fetches, llamar, libros, correos, ctx, setAhora: t => { ahora = t; }, props, cache, api: ctx.__api, forzarLock: v => { lockTomado = v; } };
}
module.exports = { crear };
