// Funciones que todavía no están habilitadas en esta copia (por ejemplo, guardar documentos, que necesita Firebase Storage).
// Se controlan desde modulos.js (DOCUMENTOS). Mientras estén apagadas, se muestra «Próximamente» y no se deja cargar nada,
// para que nadie crea que un documento quedó guardado cuando no es así.
(function () {
  const F = window.DOMINO_FUNC || {};
  if (F.documentos !== false) return;
  const TXT = 'Próximamente: la gestión de documentos (guardar y enviar archivos) todavía no está disponible en esta versión. No cargue documentos por ahora.';
  window.DOMINO_PROXIMO = function (que) {
    const t = que ? que + ' — Próximamente. Todavía no está disponible en esta versión.' : TXT;
    if (window.DOMINO && window.DOMINO.aviso) window.DOMINO.aviso(t, 'info'); else alert(t);
  };
  const FORMS = ['form-subir-doc', 'form-enviar-cliente', 'form-cliente-subir'];
  const BLOQ = '[data-act="docs-tarea"],[data-act="buzon"],[onclick*="abrirBuzon"],[onclick*="abrirModalDocsPendientes"]';
  // Envíos de formularios de documentos: se frenan antes de que lleguen al código que sube archivos.
  document.addEventListener('submit', (e) => { if (FORMS.includes(e.target.id)) { e.preventDefault(); e.stopImmediatePropagation(); window.DOMINO_PROXIMO(); } }, true);
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest(BLOQ); if (b) { e.preventDefault(); e.stopImmediatePropagation(); window.DOMINO_PROXIMO('Gestión de documentos'); } }, true);
  document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-act="docs-tarea"],[data-act="buzon"]')) { e.preventDefault(); e.stopImmediatePropagation(); window.DOMINO_PROXIMO('Gestión de documentos'); } }, true);
  // Aviso visible en cada formulario y botones apagados.
  function marcar() {
    FORMS.forEach((id) => {
      const f = document.getElementById(id); if (!f || f.dataset.prox) return; f.dataset.prox = '1';
      const a = document.createElement('div'); a.className = 'prox-aviso'; a.setAttribute('role', 'status'); a.innerHTML = '<b>Próximamente</b><br>' + TXT;
      f.prepend(a); f.querySelectorAll('input,select,textarea,button').forEach((x) => { x.disabled = true; });
    });
    document.querySelectorAll('[onclick*="abrirBuzon"]').forEach((b) => { if (!b.dataset.prox) { b.dataset.prox = '1'; b.insertAdjacentHTML('beforeend', ' <small class="prox-pill">Próximamente</small>'); } });
  }
  document.addEventListener('DOMContentLoaded', marcar); marcar();
  new MutationObserver(marcar).observe(document.documentElement, { childList: true, subtree: true });
})();
