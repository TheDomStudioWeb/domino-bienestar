/* DOMino · modo demostración. Si la demo está activa, las pantallas usan una base local con datos inventados
   en lugar de Firebase (no se conecta a ningún servidor). Se carga antes que cualquier módulo. */
(function () {
  var K = 'domino_demo';
  function on() { try { return sessionStorage.getItem(K) === '1'; } catch (e) { return false; } }
  var base = document.currentScript ? new URL('.', document.currentScript.src).href : '';
  window.DOMINO_DEMO = {
    activa: on(),
    entrar: function (email) { try { sessionStorage.setItem(K, '1'); sessionStorage.setItem('domino_demo_user', email || ''); } catch (e) {} },
    salir: function () { try { sessionStorage.removeItem(K); sessionStorage.removeItem('domino_demo_user'); } catch (e) {} },
    reiniciar: function () { try { Object.keys(localStorage).filter(function (k) { return k.indexOf('domino_demo_db') === 0; }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} location.reload(); }
  };
  if (!on()) return;
  var G = 'https://www.gstatic.com/firebasejs/10.8.0/';
  var m = { imports: {} };
  m.imports[G + 'firebase-app.js'] = base + 'fb-app.js';
  m.imports[G + 'firebase-analytics.js'] = base + 'fb-analytics.js';
  m.imports[G + 'firebase-auth.js'] = base + 'fb-auth.js';
  m.imports[G + 'firebase-firestore.js'] = base + 'fb-firestore.js';
  m.imports[G + 'firebase-storage.js'] = base + 'fb-storage.js';
  var s = document.createElement('script'); s.type = 'importmap'; s.textContent = JSON.stringify(m);
  document.head.appendChild(s);
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('div'); b.id = 'demo-barra';
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#D4AF37;color:#0A0A0A;font:600 12px Montserrat,system-ui,sans-serif;padding:6px 12px calc(6px + env(safe-area-inset-bottom,0px));display:flex;gap:10px;align-items:center;justify-content:center;text-align:center;flex-wrap:wrap';
    b.innerHTML = 'DEMOSTRACIÓN · datos de ejemplo, solo en este dispositivo <a href="#" id="demo-reiniciar" style="color:#0A0A0A;text-decoration:underline">Reiniciar</a>';
    document.body.appendChild(b); document.body.style.paddingBottom = '34px';
    document.getElementById('demo-reiniciar').onclick = function (e) { e.preventDefault(); window.DOMINO_DEMO.reiniciar(); };
  });
})();
