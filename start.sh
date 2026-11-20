#!/bin/sh
cd "$(dirname "$0")"
echo "Запуск ScentFromV: http://localhost:3000"
exec node --disable-warning=ExperimentalWarning server/index.js
