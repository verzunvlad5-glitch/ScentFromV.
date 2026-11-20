/* contacts.js — сторінка «Контакти»: форма звернення з валідацією і лічильником символів,
   повідомлення про успіх замість форми, акордеон «Питання й відповіді»
   (одночасно відкрите лише одне питання). */
(function (w, d) {
  'use strict';

  var SFV = w.SFV;
  var form = d.getElementById('contact-form');
  if (!form) return;

  var success = d.getElementById('contact-success');
  var counter = d.getElementById('c-count');
  var message = form.elements.message;
  var LIMIT = Number(message.getAttribute('maxlength')) || 500;

  SFV.validate.bind(form);

  function updateCounter() {
    counter.textContent = message.value.length + ' / ' + LIMIT;
  }
  message.addEventListener('input', updateCounter);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var errors = SFV.validate.form(form);
    if (errors) {
      SFV.validate.setStatus(form, SFV.validate.summary(errors));
      return;
    }
    var btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    SFV.api.request('POST', '/api/messages', {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      topic: form.elements.topic.value,
      message: message.value.trim()
    }).then(
      function () {
        btn.disabled = false;
        d.getElementById('c-who').textContent = form.elements.name.value.trim();
        form.hidden = true;
        success.hidden = false;
        success.focus();
      },
      function (err) {
        btn.disabled = false;
        var fields = err.fields || {};
        Object.keys(fields).forEach(function (k) {
          if (form.elements[k]) SFV.validate.showError(form.elements[k], fields[k]);
        });
        SFV.validate.setStatus(form, Object.keys(fields).length ? 'Перевірте виділені поля' : err.message, 'error');
      }
    );
  });

  d.getElementById('c-again').addEventListener('click', function () {
    form.reset();
    updateCounter();
    SFV.validate.setStatus(form, '');
    form.hidden = false;
    success.hidden = true;
    form.elements.name.focus();
  });

  /* Акордеон: подія toggle з’являється в <details> при відкритті/закритті */
  var items = SFV.ui.$$('details.faq');
  items.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (!item.open) return;
      items.forEach(function (other) {
        if (other !== item) other.open = false;
      });
    });
  });

  updateCounter();
})(window, document);
