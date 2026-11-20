/* ui.js — спільні інтерфейсні функції:
   утиліти, сповіщення (toast), шаблон картки товару, швидкий перегляд (<dialog>),
   лічильники в шапці та ДЕЛЕГУВАННЯ подій: один обробник click на document
   обслуговує всі кнопки з атрибутом data-action (навіть створені пізніше). */
(function (w, d) {
  'use strict';

  var SFV = (w.SFV = w.SFV || {});
  var store = SFV.store;

  function $(selector, root) {
    return (root || d).querySelector(selector);
  }
  function $$(selector, root) {
    return Array.prototype.slice.call((root || d).querySelectorAll(selector));
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) {
    return Math.round(n).toLocaleString('uk-UA') + ' грн';
  }
  function plural(n, forms) {
    var a = n % 10;
    var b = n % 100;
    return a === 1 && b !== 11 ? forms[0] : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? forms[1] : forms[2];
  }

  /* ---------- Сповіщення ---------- */
  var toastTimer;
  function toast(message, type) {
    var el = $('#toast');
    if (!el) {
      el = d.createElement('div');
      el.id = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      d.body.appendChild(el);
    }
    el.textContent = message;
    el.className = 'toast toast--' + (type || 'ok') + ' is-visible';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-visible');
    }, 2600);
  }

  /* ---------- Лічильники в шапці ---------- */
  function setBadge(name, n, bump) {
    $$('[data-badge="' + name + '"]').forEach(function (badge) {
      badge.hidden = !n;
      var counter = $('[data-count]', badge);
      if (counter) counter.textContent = n;
      if (bump) {
        badge.classList.remove('bump');
        void badge.offsetWidth; // перезапуск CSS-анімації
        badge.classList.add('bump');
      }
    });
  }
  function renderBadges(bump) {
    setBadge('cart', store.Cart.count(), bump === 'cart');
    setBadge('fav', store.Favs.list().length, bump === 'fav');
  }

  /* ---------- Шаблон картки товару ---------- */
  var HEART =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

  function favLabel(p, on) {
    return (on ? 'Прибрати з обраного' : 'Додати в обране') + ': ' + p.title;
  }

  function card(p) {
    var on = store.Favs.has(p.id);
    return (
      '<li class="card-item" data-gender="' + p.gender + '" data-fam="' + p.fam + '">' +
      '<article class="card">' +
      '<a class="card-img' + (p.cover ? ' card-img--cover' : '') + '" href="product-' + p.id + '.html" tabindex="-1">' +
      '<img src="' + p.img + '" width="' + p.w + '" height="' + p.h + '" alt="Флакон ' + esc(p.title) + '"></a>' +
      '<button type="button" class="fav' + (on ? ' fav--on' : '') + '" data-action="fav" data-id="' + p.id + '" aria-pressed="' + on + '" aria-label="' + esc(favLabel(p, on)) + '">' + HEART + '</button>' +
      '<button type="button" class="quick" data-action="quick" data-id="' + p.id + '">Швидкий перегляд</button>' +
      '<div class="card-body">' +
      '<p class="brand">' + esc(p.brand) + '</p>' +
      '<h3><a href="product-' + p.id + '.html">' + esc(p.title) + '</a></h3>' +
      '<p class="ml">' + p.ml + ' ml</p>' +
      '<p class="price">' + fmt(p.price) + '</p>' +
      '<button type="button" class="buy" data-action="add" data-id="' + p.id + '" aria-label="Купити: ' + esc(p.title) + '">Купити</button>' +
      '</div></article></li>'
    );
  }

  function emptyState(title, text, href, linkText) {
    return (
      '<div class="empty"><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p>' +
      (href ? '<a class="btn" href="' + href + '">' + esc(linkText) + '</a>' : '') + '</div>'
    );
  }

  /* ---------- Швидкий перегляд (елемент <dialog>) ---------- */
  var dialog = null;
  var lastFocus = null;

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = d.createElement('dialog');
    dialog.className = 'quickview';
    dialog.setAttribute('aria-labelledby', 'qv-title');
    dialog.addEventListener('click', function (e) {
      // клік по затемненому тлу (сам <dialog>) закриває вікно
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', function () {
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    });
    d.body.appendChild(dialog);
    return dialog;
  }

  function openQuick(id, trigger) {
    var p = store.byId(id);
    if (!p) return;
    lastFocus = trigger;
    var dlg = ensureDialog();
    dlg.innerHTML =
      '<button type="button" class="qv-close" data-action="close-dialog" aria-label="Закрити">×</button>' +
      '<div class="qv-grid">' +
      '<div class="qv-photo' + (p.cover ? ' qv-photo--cover' : '') + '"><img src="' + p.img + '" alt="Флакон ' + esc(p.title) + '"></div>' +
      '<div><p class="brand">' + esc(p.brand) + '</p>' +
      '<h2 id="qv-title">' + esc(p.title) + '</h2>' +
      '<ul class="tags"><li class="tag">' + p.ml + ' ml</li><li class="tag">' + esc(p.genderName) + '</li><li class="tag">' + esc(p.famName) + '</li></ul>' +
      '<p class="lede">' + esc(p.desc) + '</p>' +
      '<dl class="notes"><div><dt>Верхні ноти</dt><dd>' + esc(p.top) + '</dd></div><div><dt>Серце</dt><dd>' + esc(p.heart) + '</dd></div><div><dt>База</dt><dd>' + esc(p.base) + '</dd></div></dl>' +
      '<p class="price">' + fmt(p.price) + '</p>' +
      '<div class="buy-row"><div class="stepper">' +
      '<button type="button" data-action="step" data-step="-1" data-target="#qv-qty" aria-label="Менше">−</button>' +
      '<input id="qv-qty" type="number" min="1" max="10" value="1" inputmode="numeric" aria-label="Кількість">' +
      '<button type="button" data-action="step" data-step="1" data-target="#qv-qty" aria-label="Більше">+</button></div>' +
      '<button type="button" class="btn" data-action="add" data-id="' + p.id + '" data-qty-from="#qv-qty">Додати в кошик</button></div>' +
      '<a class="link" href="product-' + p.id + '.html">Детальніше про аромат →</a></div></div>';
    dlg.showModal();
  }

  /* ---------- Дії кнопок ---------- */
  function readQty(selector) {
    var input = $(selector);
    var n = Number(input ? input.value : 1);
    if (!Number.isInteger(n) || n < 1 || n > store.MAX_QTY) return 0;
    return n;
  }

  function addToCart(button, id) {
    var qty = 1;
    if (button.dataset.qtyFrom) {
      qty = readQty(button.dataset.qtyFrom);
      if (!qty) {
        toast('Вкажіть кількість від 1 до ' + store.MAX_QTY, 'error');
        return;
      }
    }
    var p = store.byId(id);
    store.Cart.add(id, qty);
    renderBadges('cart');
    toast('«' + p.title + '» додано в кошик' + (qty > 1 ? ' (' + qty + ' шт.)' : ''));
  }

  function syncFavButtons() {
    $$('[data-action="fav"]').forEach(function (b) {
      var p = store.byId(b.dataset.id);
      if (!p) return;
      var on = store.Favs.has(p.id);
      b.setAttribute('aria-pressed', on);
      b.classList.toggle('fav--on', on);
      if (b.dataset.favText !== undefined) b.textContent = on ? 'В обраному' : 'В обране';
      else b.setAttribute('aria-label', favLabel(p, on));
    });
  }

  function toggleFav(id) {
    var p = store.byId(id);
    var added = store.Favs.toggle(id);
    syncFavButtons();
    renderBadges(added ? 'fav' : null);
    toast(added ? '«' + p.title + '» додано в обране' : '«' + p.title + '» прибрано з обраного');
  }

  function stepInput(button) {
    var input = $(button.dataset.target);
    if (!input) return;
    var n = Number(input.value);
    if (!Number.isInteger(n)) n = 1;
    input.value = Math.max(1, Math.min(store.MAX_QTY, n + Number(button.dataset.step)));
  }

  /* Делегування: один обробник на весь документ */
  d.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]');
    if (!t) return;
    var id = Number(t.dataset.id);
    switch (t.dataset.action) {
      case 'add': addToCart(t, id); break;
      case 'fav': toggleFav(id); break;
      case 'quick': openQuick(id, t); break;
      case 'step': stepInput(t); break;
      case 'close-dialog': if (dialog) dialog.close(); break;
      default: break; // решту дій обробляють скрипти конкретних сторінок
    }
  });

  w.addEventListener('sfv:change', function () {
    renderBadges();
    syncFavButtons();
  });

  renderBadges();
  syncFavButtons();

  SFV.ui = {
    $: $, $$: $$, esc: esc, fmt: fmt, plural: plural, toast: toast, card: card,
    emptyState: emptyState, renderBadges: renderBadges, syncFavButtons: syncFavButtons
  };
})(window, document);
