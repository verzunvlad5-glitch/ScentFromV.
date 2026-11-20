/* api.js — клієнт REST API на основі Fetch API, Promise і async/await-подібних ланцюжків.
   SFV.api.request(метод, адреса, тіло) повертає Promise з розібраним JSON або відхиляється
   об’єктом помилки {status, message, fields}. Токен сесії зберігається в localStorage. */
(function (w) {
  'use strict';

  var SFV = (w.SFV = w.SFV || {});
  var TOKEN_KEY = 'sfv5_token';
  var memoryToken = null;

  function getToken() {
    try {
      return w.localStorage.getItem(TOKEN_KEY) || memoryToken;
    } catch (e) {
      return memoryToken;
    }
  }

  function setToken(token) {
    memoryToken = token;
    try {
      if (token) w.localStorage.setItem(TOKEN_KEY, token);
      else w.localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      /* сховище недоступне: токен живе лише в пам’яті сторінки */
    }
  }

  function request(method, url, body, extraHeaders) {
    var headers = {};
    var token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    Object.keys(extraHeaders || {}).forEach(function (k) {
      headers[k] = extraHeaders[k];
    });

    return w
      .fetch(url, { method: method, headers: headers, body: body !== undefined ? JSON.stringify(body) : undefined })
      .catch(function () {
        // fetch відхиляється лише при мережевій помилці
        throw { status: 0, message: 'Немає зв’язку із сервером. Перевірте підключення й спробуйте ще раз.' };
      })
      .then(function (res) {
        if (res.status === 204) return null;
        return res.json().then(
          function (data) {
            if (!res.ok) throw { status: res.status, message: data.error || 'Помилка сервера', fields: data.fields };
            return data;
          },
          function (e) {
            if (e && e.status) throw e;
            throw { status: res.status, message: 'Некоректна відповідь сервера' };
          }
        );
      });
  }

  SFV.api = { request: request, getToken: getToken, setToken: setToken };
})(window);
