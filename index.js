'use strict';
const path = require('node:path');

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 5)) {
  console.error('Потрібен Node.js 22.5 або новіший (зараз ' + process.version + '). Завантажте його на https://nodejs.org');
  process.exit(1);
}
const { createApp } = require('./app');

const port = Number(process.env.PORT) || 3000;
const root = path.join(__dirname, '..');
const server = createApp({
  dbFile: process.env.DB_FILE || path.join(root, 'data', 'scentfromv.db'),
  publicDir: path.join(root, 'public'),
  adminToken: process.env.ADMIN_TOKEN || '',
});
server.listen(port, () => {
  console.log(`ScentFromV: http://localhost:${port}` + (process.env.ADMIN_TOKEN ? '' : '  (адміністрування вимкнено: не задано ADMIN_TOKEN)'));
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
