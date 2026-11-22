/* Shahid TV: controle remoto da Samsung no shahid.mbc.net (módulo TizenBrew).
 * Setas: navega entre links/botões. OK: abre. Voltar: volta.
 * No player: esquerda/direita = -10s/+10s, OK/play-pause = pausa, cima/baixo = mexer nos botões do player.
 * Vermelho ou 0: liga/desliga o cursor (pra telas que a navegação não alcança).
 */
(function () {
  'use strict';
  if (window.top !== window) return;
  if (window.__shahidTV) return;
  window.__shahidTV = true;

  var K = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13,
    BACK: 10009, ESC: 27,
    PLAYPAUSE: 10252, PLAY: 415, PAUSE: 19, STOP: 413, FF: 417, RW: 412,
    RED: 403, ZERO: 48
  };
  var SEL = 'a[href],button,[role=button],[role=link],[role=tab],[role=menuitem],[role=option],' +
    'input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"]),[onclick]';
  var TEXT_INPUT = /^(INPUT|TEXTAREA|SELECT)$/;

  // Teclas de mídia e cores precisam ser registradas no Tizen (o TizenBrew já faz pelo package.json; aqui é reforço).
  try {
    if (window.tizen && tizen.tvinputdevice) {
      ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind', 'ColorF0Red', '0']
        .forEach(function (k) { try { tizen.tvinputdevice.registerKey(k); } catch (e) {} });
    }
  } catch (e) {}

  /* ---------- visual ---------- */
  var css = '' +
    '.stv-focus{outline:4px solid #fff!important;outline-offset:2px!important;' +
    'box-shadow:0 0 0 9px rgba(0,204,153,.65)!important;border-radius:6px}' +
    '#stv-cursor{position:fixed;left:0;top:0;width:34px;height:34px;z-index:2147483647;pointer-events:none;display:none;' +
    'filter:drop-shadow(0 2px 3px rgba(0,0,0,.8))}' +
    '#stv-toast{position:fixed;top:28px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.82);color:#fff;' +
    'font:600 26px/1.2 sans-serif;padding:12px 26px;border-radius:12px;z-index:2147483647;opacity:0;' +
    'transition:opacity .2s;pointer-events:none;direction:ltr}';
  var cursorEl, toastEl, toastTimer;

  function onReady(fn) {
    if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn);
  }
  onReady(function () {
    var st = document.createElement('style');
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
    cursorEl = document.createElement('div');
    cursorEl.id = 'stv-cursor';
    cursorEl.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M4 2l16 10-7 1.5L16.5 21l-3 1.3-3.4-7.6L4 19z" fill="#fff" stroke="#000" stroke-width="1.2"/></svg>';
    document.body.appendChild(cursorEl);
    toastEl = document.createElement('div');
    toastEl.id = 'stv-toast';
    document.body.appendChild(toastEl);
    setTimeout(ensureFocus, 1500);
  });

  function toast(msg, ms) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.style.opacity = '0'; }, ms || 1200);
  }

  /* ---------- candidatos ---------- */
  var cache = null;
  var mo = new MutationObserver(function () { cache = null; });
  onReady(function () { mo.observe(document.body, { childList: true, subtree: true }); });

  function isShown(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    var s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) === 0) return false;
    if (el.disabled || el.getAttribute('aria-hidden') === 'true') return false;
    return true;
  }

  function collect() {
    if (cache) return cache;
    var list = Array.prototype.slice.call(document.querySelectorAll(SEL));
    // React costuma pôr onClick em div/span sem role: pega quem tem cursor de mãozinha
    var extra = document.querySelectorAll('div,span,li,img,svg,p,h2,h3');
    for (var i = 0; i < extra.length; i++) {
      var e = extra[i];
      if (e.closest(SEL)) continue;
      var cs = getComputedStyle(e);
      if (cs.cursor !== 'pointer') continue;
      var p = e.parentElement;
      if (p && getComputedStyle(p).cursor === 'pointer') continue; // fica só com o mais externo
      list.push(e);
    }
    cache = list;
    return list;
  }

  function candidates() {
    var list = collect().filter(function (el) { return document.contains(el) && isShown(el); });
    // Modal aberto: só o que está dentro dele
    var dlg = Array.prototype.slice.call(document.querySelectorAll('[role=dialog],[aria-modal=true],dialog[open]'))
      .filter(isShown).pop();
    if (dlg) {
      var inside = list.filter(function (el) { return dlg.contains(el); });
      if (inside.length) list = inside;
    }
    // Tira filho que é praticamente o mesmo retângulo do pai
    return list.filter(function (el) {
      var p = el.parentElement;
      while (p && p !== document.body) {
        if (list.indexOf(p) !== -1) {
          var a = el.getBoundingClientRect(), b = p.getBoundingClientRect();
          if (a.width * a.height > 0.8 * b.width * b.height) return false;
          break;
        }
        p = p.parentElement;
      }
      return true;
    });
  }

  /* ---------- foco ---------- */
  var focused = null, lastRect = null;

  function hover(el, on) {
    var types = on ? ['pointerover', 'mouseover', 'mouseenter'] : ['pointerout', 'mouseout', 'mouseleave'];
    var r = el.getBoundingClientRect();
    types.forEach(function (t) {
      try {
        el.dispatchEvent(new MouseEvent(t, {
          bubbles: t.indexOf('enter') === -1 && t.indexOf('leave') === -1,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2
        }));
      } catch (e) {}
    });
  }

  function setFocus(el) {
    if (!el) return;
    if (focused && focused !== el) {
      focused.classList.remove('stv-focus');
      hover(focused, false);
    }
    focused = el;
    el.classList.add('stv-focus');
    if (!TEXT_INPUT.test(el.tagName)) {
      try { el.focus({ preventScroll: true }); } catch (e) {}
    }
    hover(el, true);
    reveal(el);
    lastRect = el.getBoundingClientRect();
    setTimeout(function () { nudgeCarousel(el, 0); }, 350);
  }

  // Carrossel por transform: se o item focado ficou fora da tela, aperta a seta do carrossel
  function nudgeCarousel(el, tries) {
    if (tries > 3 || el !== focused || !document.contains(el)) return;
    var r = el.getBoundingClientRect();
    var side = r.left < 0 ? 'left' : (r.right > innerWidth ? 'right' : null);
    if (!side) return;
    // No Shahid o carrossel é "group/carousel" e as setas são faixas de 50px nas bordas (invisíveis até passar o mouse)
    var box = el.closest('[class*="group/carousel"]');
    if (!box) {
      box = el.parentElement;
      while (box && box.getBoundingClientRect().width < innerWidth * 0.6) box = box.parentElement;
    }
    if (!box) return;
    var br = box.getBoundingClientRect();
    var arrows = Array.prototype.slice.call(box.querySelectorAll('*')).filter(function (a) {
      if (a.contains(el) || el.contains(a)) return false;
      if (a.closest('.slider-slide') || a.querySelector('a[href],img') || (a.innerText || '').trim()) return false;
      if (a.tagName !== 'BUTTON' && getComputedStyle(a).cursor !== 'pointer') return false;
      var ar = a.getBoundingClientRect();
      if (ar.width < 10 || ar.width > 90 || ar.height < 20) return false;
      var cx = ar.left + ar.width / 2;
      return side === 'left' ? cx < br.left + 80 : cx > br.right - 80;
    }).sort(function (a, b) { return b.getBoundingClientRect().height - a.getBoundingClientRect().height; });
    if (!arrows.length) return;
    arrows[0].click();
    setTimeout(function () { nudgeCarousel(el, tries + 1); }, 500);
  }

  function scrollableParent(el) {
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      var oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 4) return p;
    }
    return null;
  }

  // Rola só na vertical: scrollIntoView em carrossel de transform dá pulo pro topo
  function reveal(el) {
    if (scrollableParent(el)) { try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {} return; }
    var r = el.getBoundingClientRect();
    if (r.top < 90 || r.bottom > innerHeight - 40) {
      window.scrollBy({ top: r.top + r.height / 2 - innerHeight / 2, behavior: 'smooth' });
    }
  }

  function ensureFocus() {
    if (focused && document.contains(focused) && isShown(focused)) return focused;
    var list = candidates();
    if (!list.length) return null;
    var best = null, bestD = Infinity;
    var ref = lastRect || { left: innerWidth / 2, top: innerHeight / 3, width: 0, height: 0 };
    list.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      var d = Math.hypot((r.left + r.width / 2) - (ref.left + ref.width / 2), (r.top + r.height / 2) - (ref.top + ref.height / 2));
      if (d < bestD) { bestD = d; best = el; }
    });
    if (best) setFocus(best);
    return best;
  }

  function move(dir) {
    var cur = ensureFocus();
    if (!cur) return;
    var c = cur.getBoundingClientRect();
    var ccx = c.left + c.width / 2, ccy = c.top + c.height / 2;
    var best = null, bestScore = Infinity;
    candidates().forEach(function (el) {
      if (el === cur || el.contains(cur) || cur.contains(el)) return;
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var main, cross;
      if (dir === 'right') { if (cx <= ccx + 2 || r.right <= c.right) return; main = Math.max(0, r.left - c.right); cross = overlap(r.top, r.bottom, c.top, c.bottom) ? 0 : Math.abs(cy - ccy); }
      else if (dir === 'left') { if (cx >= ccx - 2 || r.left >= c.left) return; main = Math.max(0, c.left - r.right); cross = overlap(r.top, r.bottom, c.top, c.bottom) ? 0 : Math.abs(cy - ccy); }
      else if (dir === 'down') { if (cy <= ccy + 2 || r.bottom <= c.bottom) return; main = Math.max(0, r.top - c.bottom); cross = overlap(r.left, r.right, c.left, c.right) ? 0 : Math.abs(cx - ccx); }
      else { if (cy >= ccy - 2 || r.top >= c.top) return; main = Math.max(0, c.top - r.bottom); cross = overlap(r.left, r.right, c.left, c.right) ? 0 : Math.abs(cx - ccx); }
      var score = main + cross * 2.5;
      // Subindo/descendo, prefere o card que está na tela ao que está escondido no carrossel
      if ((dir === 'up' || dir === 'down') && (r.right < 0 || r.left > innerWidth)) score += 5000;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) { setFocus(best); return; }
    // Nada nessa direção: rola a página (carrega mais linhas) e tenta de novo
    if (dir === 'down' || dir === 'up') {
      window.scrollBy({ top: (dir === 'down' ? 1 : -1) * innerHeight * 0.6, behavior: 'smooth' });
      cache = null;
    }
  }

  function overlap(a1, a2, b1, b2) { return Math.min(a2, b2) - Math.max(a1, b1) > 4; }

  function activate(el) {
    if (!el) return;
    if (TEXT_INPUT.test(el.tagName)) { el.focus(); try { el.click(); } catch (e) {} return; }
    // Card do Shahid é uma div com mãozinha embrulhando um único link: clica no link, que é o que navega
    if (el.tagName !== 'A' && el.tagName !== 'BUTTON') {
      var links = el.querySelectorAll('a[href]');
      if (links.length === 1) el = links[0];
    }
    var r = el.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach(function (t) {
      try { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })); } catch (e) {}
    });
    el.click();
    cache = null;
  }

  /* ---------- player ---------- */
  var playerNav = false;

  function bigVideo() {
    var vids = document.querySelectorAll('video');
    var onPlayerPage = location.pathname.indexOf('/player/') !== -1;
    for (var i = 0; i < vids.length; i++) {
      var v = vids[i], r = v.getBoundingClientRect();
      if (v.readyState < 1) continue;
      if (onPlayerPage && r.width >= innerWidth * 0.5) return v;
      if (document.fullscreenElement && document.fullscreenElement.contains(v)) return v;
      if (r.width >= innerWidth * 0.85 && r.height >= innerHeight * 0.85) return v;
    }
    return null;
  }

  function wakePlayer(v) {
    var target = v.parentElement || v;
    var r = target.getBoundingClientRect();
    try { target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); } catch (e) {}
  }

  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  var seekBoost = 0, seekTimer;
  function seek(v, delta) {
    seekBoost++;
    clearTimeout(seekTimer);
    seekTimer = setTimeout(function () { seekBoost = 0; }, 600);
    var step = delta * (seekBoost > 6 ? 3 : 1);
    var t = Math.min(Math.max(0, v.currentTime + step), (v.duration || Infinity) - 1);
    v.currentTime = t;
    toast((step > 0 ? '+' : '') + step + 's   ' + fmt(t) + (v.duration ? ' / ' + fmt(v.duration) : ''));
  }

  function togglePlay(v) {
    if (v.paused) { v.play(); toast('▶'); } else { v.pause(); toast('❚❚ ' + fmt(v.currentTime)); }
  }

  function playerKey(v, code) {
    wakePlayer(v);
    if (code === K.PLAY) { v.play(); return true; }
    if (code === K.PAUSE) { v.pause(); return true; }
    if (code === K.PLAYPAUSE) { togglePlay(v); return true; }
    if (code === K.FF) { seek(v, 30); return true; }
    if (code === K.RW) { seek(v, -30); return true; }
    if (playerNav) {
      if (code === K.BACK || code === K.ESC) { playerNav = false; if (focused) focused.classList.remove('stv-focus'); focused = null; toast('Modo avançar/voltar'); return true; }
      return false; // setas e OK caem na navegação normal, entre os botões do player
    }
    if (code === K.LEFT) { seek(v, -10); return true; }
    if (code === K.RIGHT) { seek(v, 10); return true; }
    if (code === K.ENTER) { togglePlay(v); return true; }
    if (code === K.UP || code === K.DOWN) { playerNav = true; toast('Botões do player (Voltar sai)'); ensureFocus(); return true; }
    return false;
  }

  /* ---------- cursor ---------- */
  var cursorOn = false, cx = 0, cy = 0, accel = 0, accelTimer;

  function placeCursor() {
    cursorEl.style.transform = 'translate(' + cx + 'px,' + cy + 'px)';
    var el = document.elementFromPoint(cx, cy);
    if (el) {
      try { el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: cx, clientY: cy })); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: cx, clientY: cy })); } catch (e) {}
    }
  }

  function toggleCursor() {
    cursorOn = !cursorOn;
    if (!cursorEl) return;
    if (cursorOn) {
      var r = focused ? focused.getBoundingClientRect() : null;
      cx = r ? r.left + r.width / 2 : innerWidth / 2;
      cy = r ? r.top + r.height / 2 : innerHeight / 2;
      cursorEl.style.display = 'block';
      placeCursor();
      toast('Cursor ligado (vermelho ou 0 desliga)');
    } else {
      cursorEl.style.display = 'none';
      toast('Cursor desligado');
    }
  }

  function cursorKey(code) {
    if (code === K.ENTER) {
      var el = document.elementFromPoint(cx, cy);
      if (el) {
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (t) {
          try { el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0 })); } catch (e) {}
        });
        if (TEXT_INPUT.test(el.tagName)) el.focus();
      }
      return true;
    }
    var dx = 0, dy = 0;
    if (code === K.LEFT) dx = -1; else if (code === K.RIGHT) dx = 1;
    else if (code === K.UP) dy = -1; else if (code === K.DOWN) dy = 1;
    else return false;
    accel = Math.min(accel + 1, 12);
    clearTimeout(accelTimer);
    accelTimer = setTimeout(function () { accel = 0; }, 250);
    var step = 14 + accel * 7;
    cx = Math.min(Math.max(0, cx + dx * step), innerWidth - 4);
    cy = Math.min(Math.max(0, cy + dy * step), innerHeight - 4);
    if (cy <= 2 && dy < 0) window.scrollBy(0, -step * 2);
    if (cy >= innerHeight - 6 && dy > 0) window.scrollBy(0, step * 2);
    placeCursor();
    return true;
  }

  /* ---------- voltar ---------- */
  function goBack() {
    var path = location.pathname.replace(/\/+$/, '');
    if (path === '' || path === '/ar' || path === '/en') {
      try { tizen.application.getCurrentApplication().exit(); } catch (e) {}
      return;
    }
    history.back();
    focused = null;
    setTimeout(ensureFocus, 900);
  }

  /* ---------- teclado ---------- */
  window.addEventListener('keydown', function (ev) {
    var code = ev.keyCode;
    var ae = document.activeElement;
    var typing = ae && TEXT_INPUT.test(ae.tagName) && ae.type !== 'checkbox' && ae.type !== 'radio' && ae.type !== 'submit';
    var handled = false;

    if (code === K.RED || code === K.ZERO && !typing) { toggleCursor(); handled = true; }
    else if (cursorOn && code !== K.BACK && code !== K.ESC) { handled = cursorKey(code); }
    else if (typing) {
      // Digitando: OK e setas laterais ficam com o campo; cima/baixo/voltar saem dele
      if (code === K.UP || code === K.DOWN) { ae.blur(); move(code === K.UP ? 'up' : 'down'); handled = true; }
      else if (code === K.BACK || code === K.ESC) { ae.blur(); handled = true; }
    } else {
      var v = bigVideo();
      if (v) handled = playerKey(v, code);
      if (!handled) {
        if (code === K.LEFT) { move('left'); handled = true; }
        else if (code === K.RIGHT) { move('right'); handled = true; }
        else if (code === K.UP) { move('up'); handled = true; }
        else if (code === K.DOWN) { move('down'); handled = true; }
        else if (code === K.ENTER) { activate(ensureFocus()); handled = true; }
        else if (code === K.BACK || code === K.ESC) {
          if (cursorOn) toggleCursor();
          else if (document.fullscreenElement) document.exitFullscreen();
          else goBack();
          handled = true;
        }
      }
    }
    if (handled) { ev.preventDefault(); ev.stopPropagation(); }
  }, true);

  // Mudou de página dentro do site (SPA): reposiciona o foco
  var lastPath = location.pathname;
  setInterval(function () {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      focused = null; playerNav = false; cache = null;
      setTimeout(ensureFocus, 1200);
    }
  }, 500);
})();
