/* data.js — контейнер для довідкових даних магазину.
   Каталог, групи ароматів, доставка й промокоди надходять із сервера (GET /api/bootstrap),
   їх записує boot.js до запуску решти модулів. */
(function (w) {
  'use strict';
  var SFV = (w.SFV = w.SFV || {});
  SFV.data = { products: [], families: [], genders: [], recommended: [], freeFrom: 0, promos: {}, delivery: {} };
})(window);
