// Botón / gesto "atrás" del teléfono: vuelve dentro de la app en lugar de salir.
// En la pantalla de inicio pide tocar atrás dos veces para salir.
(function () {
  var armado = false, t = null;
  function aviso(txt) {
    var d = document.getElementById('toast-atras');
    if (!d) {
      d = document.createElement('div'); d.id = 'toast-atras'; d.setAttribute('role', 'status');
      d.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:92vw;padding:14px 20px;border-radius:8px;background:#16181c;color:#f4f1ea;border:1px solid #d4af37;font:500 15px/1.4 Montserrat,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.6);z-index:5000;text-align:center;transition:opacity .3s';
      document.body.appendChild(d);
    }
    d.textContent = txt; d.style.opacity = '1';
    clearTimeout(d._t); d._t = setTimeout(function () { d.style.opacity = '0'; }, 2400);
  }
  // accion(): devuelve true si resolvió el "atrás" dentro de la app
  window.activarAtras = function (accion) {
    try { history.replaceState({ dom: 'raiz' }, ''); history.pushState({ dom: 'app' }, ''); } catch (e) { return; }
    window.addEventListener('popstate', function (ev) {
      if (ev.state && ev.state.dom === 'app') return;
      var hecho = false;
      try { hecho = accion && accion(); } catch (e) { console.error(e); }
      if (hecho) { history.pushState({ dom: 'app' }, ''); return; }
      if (armado) { armado = false; clearTimeout(t); history.back(); return; }
      armado = true; aviso('Toque atrás otra vez para salir');
      history.pushState({ dom: 'app' }, '');
      t = setTimeout(function () { armado = false; }, 2500);
    });
  };
})();
