/* Управление пультом/стрелками: пространственная навигация, OK, Назад, приоритет пульта над мышью */
(function () {
  var H = window.TVNAV = window.TVNAV || {};
  var SEL = '.focusable,button,a[href],input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])';
  var AUTO = '.card,.nav-item,.genre-chip,.episode-row,.star,.ctx-item,.rate-skip,.hero-dot,.hero-nav-arrow,.cast-card,.pf,#user-chip,.tab,a.back,.focusable';
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
  function dirOf(e){
    var m = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' }[e.key];
    return m || { 37:'left', 38:'up', 39:'right', 40:'down', 19:'up', 20:'down', 21:'left', 22:'right' }[e.keyCode];
  }
  function isOK(e){ return e.key === 'Enter' || e.key === 'Select' || e.key === 'NumpadEnter' || [13, 23, 66].indexOf(e.keyCode) > -1; }
  function isBack(e){ return e.key === 'Backspace' || e.key === 'Escape' || e.key === 'BrowserBack' || e.key === 'GoBack' || [4, 27, 166, 461, 10009].indexOf(e.keyCode) > -1; }
  function focusEl(el){
    try { el.focus({ preventScroll: true }); } catch (x) { el.focus(); }
    try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); } catch (x) {}
  }
  function pickStart(list){
    var pref = list.filter(function (el) { return el.matches('[data-autofocus],.btn-primary'); })[0];
    if (pref) return pref;
    var h = innerHeight;
    return list.filter(function (el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < h; })[0] || list[0];
  }
  function move(dir){
    var scope = (H.scope && H.scope()) || document.body, list = cands(scope);
    if (!list.length) return;
    var cur = document.activeElement;
    if (!cur || cur === document.body || list.indexOf(cur) < 0) { focusEl(pickStart(list)); return; }
    var a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2, best = null, bs = Infinity;
    var vertical = dir === 'up' || dir === 'down';
    function reg(el){ var r = el.closest('[data-tv-region]'); return r ? r.getAttribute('data-tv-region') : ''; }
    var curReg = reg(cur);
    function scan(needOverlap){
      list.forEach(function (el) {
        if (el === cur || cur.contains(el) || el.contains(cur)) return;
        var r = el.getBoundingClientRect(), dx = r.left + r.width / 2 - ax, dy = r.top + r.height / 2 - ay, p, s, ov;
        if (dir === 'right') { if (dx <= 2) return; p = dx; s = Math.abs(dy); ov = r.bottom > a.top && r.top < a.bottom; }
        else if (dir === 'left') { if (dx >= -2) return; p = -dx; s = Math.abs(dy); ov = r.bottom > a.top && r.top < a.bottom; }
        else if (dir === 'down') { if (dy <= 2) return; p = dy; s = Math.abs(dx); ov = r.right > a.left && r.left < a.right; }
        else { if (dy >= -2) return; p = -dy; s = Math.abs(dx); ov = r.right > a.left && r.left < a.right; }
        if (needOverlap && !ov) return;
        if (!needOverlap && vertical && reg(el) !== curReg) return;
        if (ov) s *= 0.25;
        var score = p + s * 2.5;
        if (score < bs) { bs = score; best = el; }
      });
    }
    if (vertical) { scan(true); if (!best) scan(false); } else scan(false);
    if (best) focusEl(best);
    else if (dir === 'down' || dir === 'up') scrollBy({ top: dir === 'down' ? 240 : -240, behavior: 'smooth' });
  }
  H.move = move; H.cands = cands;
  H.focusFirst = function (container) { var l = cands(container); if (l.length) { try { pickStart(l).focus({ preventScroll: true }); } catch (x) {} } };

  addEventListener('keydown', function (e) {
    var a = document.activeElement, tag = a ? a.tagName : '';
    var typing = tag === 'TEXTAREA' || (tag === 'INPUT' && !/^(button|checkbox|radio|submit)$/.test(a.type));
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
      if (tag === 'SELECT' && (dir === 'left' || dir === 'right')) {
        a.selectedIndex = Math.max(0, Math.min(a.options.length - 1, a.selectedIndex + (dir === 'right' ? 1 : -1)));
        a.dispatchEvent(new Event('change', { bubbles: true })); return;
      }
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
