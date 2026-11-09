/* DOMino · Barra inferior en el teléfono (ref. video "Glassy Navigation Tabs").
   Copia las secciones del menú que la persona puede ver (respeta los roles), con un haz de luz
   que se desliza a la sección activa. El menú ☰ sigue igual para el resto (cerrar sesión, etc.).
   Desarrollado por The DOM Studio Web. */
(function () {
  var ICON = {
    hub: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    expedientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/>',
    kanban: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
    'mis-tareas': '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'
  };
  var CSS = [
    '@media (max-width:768px){',
    ' body.con-bnav{padding-bottom:calc(84px + env(safe-area-inset-bottom,0px))}',
    ' .bnav{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:900;display:flex;padding:6px;border-radius:22px;overflow:hidden;',
    '  background:rgba(22,24,28,.78);backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);',
    '  border:1px solid rgba(255,255,255,.12);box-shadow:0 12px 34px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06)}',
    ' .bnav button{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 0 7px;border:0;background:none;color:var(--text-muted,#a8a396);',
    '  font:600 .64rem var(--font-sans,Montserrat,sans-serif);cursor:pointer;position:relative;z-index:1;transition:color .25s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    ' .bnav svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;transition:transform .3s,filter .3s}',
    ' .bnav button.on{color:var(--gold-light,#e8c766)}',
    ' .bnav button.on svg{transform:translateY(-1px);filter:drop-shadow(0 0 6px rgba(212,175,55,.7))}',
    ' .bnav .bdg{position:absolute;top:3px;left:calc(50% + 6px);min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:var(--rojo-alerta,#ff6b61);color:#fff;font-size:.6rem;display:grid;place-items:center}',
    ' .bnav .bdg[hidden]{display:none}',
    ' .bnav-ind{position:absolute;top:0;left:0;height:100%;width:0;pointer-events:none;transition:transform .45s cubic-bezier(.3,1.25,.4,1),width .3s}',
    ' .bnav-ind:before{content:"";position:absolute;top:0;left:50%;width:34px;height:3px;margin-left:-17px;border-radius:0 0 4px 4px;background:var(--gold,#d4af37);box-shadow:0 0 12px 2px rgba(212,175,55,.75)}',
    ' .bnav-ind:after{content:"";position:absolute;top:3px;left:50%;width:70px;height:78%;margin-left:-35px;clip-path:polygon(30% 0,70% 0,100% 100%,0 100%);background:linear-gradient(180deg,rgba(212,175,55,.28),transparent 85%)}',
    ' body.menu-abierto .bnav{display:none}',
    ' body:has(#demo-barra) .bnav{bottom:calc(46px + env(safe-area-inset-bottom,0px))}',
    ' body.con-bnav:has(#demo-barra){padding-bottom:calc(120px + env(safe-area-inset-bottom,0px))!important}',
    '}',
    '@media (min-width:769px){.bnav{display:none}}',
    '@media (prefers-reduced-motion:reduce){.bnav-ind{transition:none}}'
  ].join('\n');

  var nav, ind, actual = 'hub';
  function visible(a) { return a && a.style.display !== 'none' && !a.hidden; }
  function texto(a) { return (a.childNodes[0] && a.childNodes[0].textContent || a.textContent).trim(); }
  function armar() {
    var menu = document.getElementById('menu');
    if (!menu) return;
    if (!nav) {
      var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      nav = document.createElement('nav'); nav.className = 'bnav'; nav.setAttribute('aria-label', 'Secciones');
      document.body.appendChild(nav);
      nav.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.dataset.v === 'chat') { if (window.abrirChat) window.abrirChat(); return; }
        if (window.navegarA) window.navegarA(b.dataset.v);
      });
      window.addEventListener('resize', mover);
    }
    var items = [];
    menu.querySelectorAll('a[data-vista]').forEach(function (a) { if (visible(a)) items.push({ v: a.dataset.vista, t: texto(a) }); });
    var chat = document.getElementById('nav-chat');
    if (visible(chat)) items.push({ v: 'chat', t: 'Chat' });
    nav.innerHTML = '<span class="bnav-ind" aria-hidden="true"></span>' + items.map(function (i) {
      return '<button type="button" data-v="' + i.v + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + (ICON[i.v] || ICON.hub) + '</svg>' + i.t + (i.v === 'chat' ? '<span class="bdg" hidden></span>' : '') + '</button>';
    }).join('');
    ind = nav.querySelector('.bnav-ind');
    document.body.classList.add('con-bnav');
    marcar(actual); badge();
  }
  function marcar(v) {
    var grupo = { expediente: 'expedientes', buzon: 'expedientes', cartera: 'expedientes', herramientas: 'hub', equipo: 'hub' }[v] || v;
    actual = grupo;
    if (!nav) return;
    nav.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === grupo); b.setAttribute('aria-current', b.dataset.v === grupo ? 'page' : 'false'); });
    mover();
  }
  function mover() {
    if (!nav || !ind) return;
    var b = nav.querySelector('button.on');
    if (!b || !b.offsetWidth) { ind.style.opacity = '0'; return; }
    ind.style.opacity = '1'; ind.style.width = b.offsetWidth + 'px'; ind.style.transform = 'translateX(' + b.offsetLeft + 'px)';
  }
  function badge() {
    var src = document.getElementById('badge-chat'), b = nav && nav.querySelector('.bdg');
    if (!src || !b) return;
    var on = src.style.display !== 'none' && src.textContent.trim() && src.textContent.trim() !== '0';
    b.hidden = !on; b.textContent = on ? src.textContent.trim() : '';
  }
  window.addEventListener('domino:listo', function () { setTimeout(armar, 0); });
  window.addEventListener('domino:vista', function (e) { if (!nav) armar(); marcar(e.detail); });
  document.addEventListener('DOMContentLoaded', function () {
    var src = document.getElementById('badge-chat');
    if (src && window.MutationObserver) new MutationObserver(badge).observe(src, { attributes: true, childList: true, characterData: true, subtree: true });
  });
})();
