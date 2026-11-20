/* nav.js — інтерактивна навігація:
   • мобільне меню (кнопка, aria-expanded, закриття за Esc, кліком поза меню та при зміні ширини);
   • тінь шапки під час прокручування;
   • кнопка «Нагору», що з’являється після прокручування. */
(function (w, d) {
  'use strict';

  var burger = d.querySelector('.burger');
  var nav = d.getElementById('main-nav');
  var header = d.querySelector('.site-header');

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.textContent = open ? 'Закрити' : 'Меню';
  }

  if (burger && nav) {
    burger.addEventListener('click', function () {
      setOpen(!nav.classList.contains('is-open'));
    });

    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        burger.focus();
      }
    });

    d.addEventListener('click', function (e) {
      // клік поза шапкою закриває відкрите меню
      if (nav.classList.contains('is-open') && !e.target.closest('.site-header')) setOpen(false);
      // клік по пункту меню теж закриває його
      if (e.target.closest('#main-nav a')) setOpen(false);
    });

    // при розширенні вікна меню знову стає звичайним рядком
    var wide = w.matchMedia('(min-width: 901px)');
    var onChange = function (e) {
      if (e.matches) setOpen(false);
    };
    if (wide.addEventListener) wide.addEventListener('change', onChange);
    else wide.addListener(onChange);
  }

  /* Кнопка «Нагору» і тінь шапки. Подію scroll обмежено requestAnimationFrame */
  var toTop = d.createElement('button');
  toTop.type = 'button';
  toTop.className = 'to-top';
  toTop.hidden = true;
  toTop.setAttribute('aria-label', 'Прокрутити нагору');
  toTop.textContent = '↑';
  d.body.appendChild(toTop);

  toTop.addEventListener('click', function () {
    w.scrollTo({ top: 0, behavior: 'smooth' });
  });

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    w.requestAnimationFrame(function () {
      var y = w.pageYOffset;
      toTop.hidden = y < 600;
      if (header) header.classList.toggle('is-scrolled', y > 8);
      ticking = false;
    });
  }
  w.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})(window, document);
