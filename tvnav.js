/* Управление пультом/стрелками: пространственная навигация, OK, Назад, приоритет пульта над мышью */
(function () {
  var H = window.TVNAV = window.TVNAV || {};
  var SEL = '.focusable,button,a[href],input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])';
  var AUTO = '.card,.nav-item,.genre-chip,.season-chip,.episode-row,.star,.ctx-item,.rate-skip,.hero-dot,.hero-nav-arrow,.cast-card,.pf,#user-chip,.tab,a.back,.focusable';
  var root = document.documentElement, lastKey = 0, mx = 0, my = 0, pending = null;

  function setKbd(on){ root.classList.toggle('kbd', on); }
  addEventListener('mousemove', function (e) {
    if (Date.now() - lastKey < 500) return;
    if (Math.abs(e.screenX - mx) + Math.abs(e.screenY - my) > 8) setKbd(false);
    mx = e.screenX; my = e.screenY;
  }, true);
  addEventListener('mousedown', function(){ setKbd(false); }, true);
  addEventListener('touchstart', function(){ setKbd(false); }, { passive: true, capture: true });

  function vis(el){ return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.disabled; }
  function cands(scope){ return Array.prototype.filter.call(scope.querySelectorAll(SEL), function (el) { return vis(el) && el.tabIndex !== -1; }); }

  // Коды клавиш: буквы НЕ должны попадать сюда (например keyCode 66 — это клавиша B).
  // Числовые коды используем только если браузер не дал нормальное имя клавиши (key пустой или Unidentified).
  function noName(e){ return !e.key || e.key === 'Unidentified'; }
  function dirOf(e){
    var m = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' }[e.key];
    if (m) return m;
    if (noName(e)) return { 37:'left', 38:'up', 39:'right', 40:'down', 19:'up', 20:'down', 21:'left', 22:'right' }[e.keyCode];
  }
  function isOK(e){ return e.key === 'Enter' || e.key === 'Select' || e.key === 'NumpadEnter' || (noName(e) && [13, 23, 66].indexOf(e.keyCode) > -1); }
  function isBack(e){
    return e.key === 'Backspace' || e.key === 'Escape' || e.key === 'BrowserBack' || e.key === 'GoBack' || e.key === 'XF86Back' ||
      [4, 166, 461, 10009].indexOf(e.keyCode) > -1;
  }

  // ---- прокрутка: лента двигается сама по горизонтали, страница — только когда нужно ----
  function scrollable(el, axis){
    for (var p = el.parentElement; p && p !== document.body && p !== root; p = p.parentElement) {
      var cs = getComputedStyle(p), o = axis === 'x' ? cs.overflowX : cs.overflowY;
      if ((o === 'auto' || o === 'scroll') && (axis === 'x' ? p.scrollWidth > p.clientWidth + 2 : p.scrollHeight > p.clientHeight + 2)) return p;
    }
    return null;
  }
  function inFixed(el){
    for (var p = el; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') return true;
    return false;
  }
  function reveal(el, dir){
    if (inFixed(el)) return;
    var r = el.getBoundingClientRect();
    var sx = scrollable(el, 'x');
    if (sx) {
      var s = sx.getBoundingClientRect();
      sx.scrollTo({ left: sx.scrollLeft + (r.left + r.width / 2) - (s.left + s.width / 2), behavior: 'smooth' });
    }
    var sy = scrollable(el, 'y');
    var view = sy ? sy.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    var out = r.top < view.top + 40 || r.bottom > view.bottom - 40;
    if (dir === 'up' || dir === 'down' || out) {
      var delta = (r.top + r.height / 2) - (view.top + (view.bottom - view.top) / 2);
      if (sy) sy.scrollBy({ top: delta, behavior: 'smooth' }); else scrollBy({ top: delta, behavior: 'smooth' });
    }
  }
  function focusEl(el, dir){
    try { el.focus({ preventScroll: true }); } catch (x) { el.focus(); }
    reveal(el, dir);
  }
  function pickStart(list){
    var pref = list.filter(function (el) { return el.matches('[data-autofocus],.btn-primary'); })[0];
    if (pref) return pref;
    var h = innerHeight;
    return list.filter(function (el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < h; })[0] || list[0];
  }
  function gap(a0, a1, b0, b1){ return b0 >= a1 ? b0 - a1 : (b1 <= a0 ? a0 - b1 : 0); }

  function move(dir){
    var scope = (H.scope && H.scope()) || document.body, list = cands(scope);
    if (!list.length) return;
    var cur = document.activeElement;
    if (!cur || cur === document.body || list.indexOf(cur) < 0) { focusEl(pickStart(list), dir); return; }
    var a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    var vertical = dir === 'up' || dir === 'down';
    function reg(el){ var r = el.closest('[data-tv-region]'); return r ? r.getAttribute('data-tv-region') : ''; }
    var curReg = reg(cur);

    function scan(sameRowOnly){
      var best = null, bs = Infinity;
      list.forEach(function (el) {
        if (el === cur || cur.contains(el) || el.contains(cur)) return;
        var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, p, perp;
        if (dir === 'right') { if (cx - ax <= 2) return; p = Math.max(0, r.left - a.right) + 0.1 * (cx - ax); perp = gap(a.top, a.bottom, r.top, r.bottom) * 3 + 0.2 * Math.abs(cy - ay); }
        else if (dir === 'left') { if (cx - ax >= -2) return; p = Math.max(0, a.left - r.right) + 0.1 * (ax - cx); perp = gap(a.top, a.bottom, r.top, r.bottom) * 3 + 0.2 * Math.abs(cy - ay); }
        else if (dir === 'down') { if (cy - ay <= 2) return; p = Math.max(0, r.top - a.bottom) + 0.1 * (cy - ay); perp = gap(a.left, a.right, r.left, r.right) * 3 + 0.2 * Math.abs(cx - ax); }
        else { if (cy - ay >= -2) return; p = Math.max(0, a.top - r.bottom) + 0.1 * (ay - cy); perp = gap(a.left, a.right, r.left, r.right) * 3 + 0.2 * Math.abs(cx - ax); }
        var overlap = vertical ? gap(a.left, a.right, r.left, r.right) === 0 : gap(a.top, a.bottom, r.top, r.bottom) === 0;
        if (sameRowOnly && !overlap) return;
        if (vertical && !overlap && reg(el) !== curReg) return;
        var score = p + perp;
        if (score < bs) { bs = score; best = el; }
      });
      return best;
    }
    var best = scan(!vertical);              // по горизонтали сначала ищем в той же ленте/строке
    if (!best && !vertical) {
      var sib = list.filter(function (el) { return el.parentElement === cur.parentElement; });
      if (sib.length > 1 && dir === 'right') {  // бесконечная лента: после последнего — первый
        sib.sort(function (x, y) { return x.getBoundingClientRect().left - y.getBoundingClientRect().left; });
        best = sib[0];
      } else best = scan(false);               // например влево из первой карточки — в боковое меню
      if (!best && sib.length > 1) {           // влево без меню — тоже по кругу
        sib.sort(function (x, y) { return x.getBoundingClientRect().left - y.getBoundingClientRect().left; });
        best = sib[sib.length - 1];
      }
    }
    if (!best && vertical) best = scan(false);
    if (best) focusEl(best, dir);
    else if (vertical) scrollBy({ top: dir === 'down' ? 240 : -240, behavior: 'smooth' });
  }
  H.move = move; H.cands = cands;
  H.focusFirst = function (container) { var l = cands(container); if (l.length) { try { pickStart(l).focus({ preventScroll: true }); } catch (x) {} } };

  addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var a = document.activeElement, tag = a ? a.tagName : '';
    var typing = tag === 'TEXTAREA' || (tag === 'INPUT' && !/^(button|checkbox|radio|submit)$/.test(a.type));
    // при вводе текста буквы и цифры никогда не трогаем
    if (typing && e.key && e.key.length === 1) return;
    var dir = dirOf(e), back = isBack(e), ok = isOK(e);
    if (dir || back || ok) { lastKey = Date.now(); setKbd(true); }
    if (back) {
      if (typing && e.key === 'Backspace') return;
      if (typing && e.key === 'Escape') { a.blur(); e.preventDefault(); return; }
      if (!H.back) return;
      e.preventDefault(); H.back(); return;
    }
    if (dir) {
      if (typing && (dir === 'left' || dir === 'right')) return;
      e.preventDefault();
      move(dir); return;
    }
    if (ok) {
      if (typing) { if (a.getAttribute('data-tvnav-enter') === 'down') { e.preventDefault(); move('down'); } return; }
      if (!a || a === document.body) { e.preventDefault(); move('down'); return; }
      e.preventDefault();
      if (e.repeat) return;
      var p = { el: a, fired: false };
      p.t = setTimeout(function () { p.fired = true; if (H.longPress) H.longPress(a); }, 550);
      pending = p;
    }
  }, true);
  addEventListener('keyup', function (e) {
    if (!isOK(e) || !pending) return;
    var p = pending; pending = null; clearTimeout(p.t);
    if (p.fired) return;
    e.preventDefault();
    var el = p.el;
    if (!el || !el.isConnected) return;
    if (el.tagName === 'SELECT') { try { el.showPicker(); } catch (x) { el.focus(); } } else el.click();
  }, true);

  function ensureTab(node){
    if (!node || node.nodeType !== 1) return;
    var list = node.matches && node.matches(AUTO) ? [node] : [];
    if (node.querySelectorAll) list = list.concat(Array.prototype.slice.call(node.querySelectorAll(AUTO)));
    list.forEach(function (el) { if (!el.hasAttribute('tabindex') && !(/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || (el.tagName === 'A' && el.hasAttribute('href')))) el.tabIndex = 0; });
  }
  var prevFocus = new WeakMap();
  function isLayer(el){ return el.matches && el.matches('.overlay,.player-overlay,.ctx-menu'); }
  new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      if (m.type === 'childList') { m.addedNodes.forEach(ensureTab); return; }
      var t = m.target;
      if (m.type === 'attributes' && isLayer(t)) {
        var was = /(^|\s)show(\s|$)/.test(m.oldValue || ''), now = t.classList.contains('show');
        if (now && !was) { prevFocus.set(t, document.activeElement); setTimeout(function () { H.focusFirst(t); }, 60); }
        if (!now && was) { var p = prevFocus.get(t); if (p && p.isConnected && root.classList.contains('kbd')) setTimeout(function () { p.focus({ preventScroll: true }); }, 30); }
      }
    });
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  document.addEventListener('DOMContentLoaded', function () { ensureTab(document.body); });
})();
