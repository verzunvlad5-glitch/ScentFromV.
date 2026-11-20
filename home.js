/* home.js — головна сторінка: перевірка поля пошуку.
   Форма надсилається методом GET на catalog.html?q=..., де запит читає catalog.js. */
(function (w, d) {
  'use strict';

  var ui = w.SFV.ui;
  var form = d.getElementById('home-search');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    if (!form.elements.q.value.trim()) {
      e.preventDefault(); // порожній запит не надсилаємо
      ui.toast('Введіть назву або бренд для пошуку', 'error');
      form.elements.q.focus();
    }
  });
})(window, document);
